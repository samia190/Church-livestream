import type { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import { updateStreamStatus as dbUpdateStreamStatus } from "../db";

/**
 * Real-time signaling for the live stream feature.
 *
 * This does NOT carry video itself — video/audio travels peer-to-peer over
 * WebRTC directly between the admin's browser and each viewer's browser.
 * This socket only exchanges the small handshake messages (SDP offers/
 * answers and ICE candidates) needed to set up those peer connections, plus
 * lightweight "is anyone live right now" status.
 *
 * Topology: one broadcaster (the admin), many viewers. Because this is a
 * peer-to-peer mesh (no media server), the admin's own upload bandwidth is
 * shared across every connected viewer — this is fine for a small
 * congregation watching from home, but it is not going to smoothly support
 * hundreds of simultaneous viewers. That would need a dedicated media
 * server (SFU) or an RTMP-based service, which is out of scope here.
 */

interface SessionInfo {
  sessionId: number;
  title: string;
  description?: string;
  startedAt: number;
}

type ClientRole = "admin" | "viewer";

interface ClientEntry {
  ws: WebSocket;
  role: ClientRole;
  viewerId?: string;
}

let broadcaster: ClientEntry | null = null;
const viewers = new Map<string, ClientEntry>();
let currentSession: SessionInfo | null = null;

function safeSend(ws: WebSocket, data: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcastToViewers(data: unknown) {
  for (const viewer of viewers.values()) {
    safeSend(viewer.ws, data);
  }
}

function currentStreamUpdatePayload() {
  return {
    type: "stream-update",
    session: currentSession
      ? {
          sessionId: currentSession.sessionId,
          isLive: true,
          title: currentSession.title,
          description: currentSession.description || "",
          viewers: viewers.size,
          startTime: currentSession.startedAt,
        }
      : {
          sessionId: null,
          isLive: false,
          title: "",
          description: "",
          viewers: 0,
          startTime: 0,
        },
  };
}

function broadcastViewerCount() {
  const payload = { type: "viewer-count-update", viewers: viewers.size };
  broadcastToViewers(payload);
  if (broadcaster) safeSend(broadcaster.ws, payload);
}

async function endCurrentSession() {
  if (currentSession) {
    try {
      await dbUpdateStreamStatus(currentSession.sessionId, "ended");
    } catch (error) {
      console.error("[Signaling] Failed to persist stream end:", error);
    }
  }
  currentSession = null;
  broadcastToViewers(currentStreamUpdatePayload());
  // Tell every viewer to tear down its peer connection.
  broadcastToViewers({ type: "broadcast-ended" });
}

export function attachSignalingServer(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: "/api/stream-sync" });

  wss.on("connection", ws => {
    let entry: ClientEntry | null = null;

    ws.on("message", async raw => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (msg.type) {
        case "subscribe": {
          const role: ClientRole = msg.role === "admin" ? "admin" : "viewer";
          if (role === "admin") {
            // Only one active admin/broadcaster connection at a time.
            entry = { ws, role: "admin" };
            broadcaster = entry;
            safeSend(ws, currentStreamUpdatePayload());
            safeSend(ws, { type: "viewer-count-update", viewers: viewers.size });
          } else {
            const viewerId = randomUUID();
            entry = { ws, role: "viewer", viewerId };
            viewers.set(viewerId, entry);
            safeSend(ws, { type: "welcome", viewerId });
            safeSend(ws, currentStreamUpdatePayload());
            broadcastViewerCount();
          }
          break;
        }

        case "go-live": {
          if (!entry || entry.role !== "admin") return;
          currentSession = {
            sessionId: msg.sessionId,
            title: msg.title || "Live Stream",
            description: msg.description || "",
            startedAt: Date.now(),
          };
          broadcastToViewers(currentStreamUpdatePayload());
          break;
        }

        case "end-live": {
          if (!entry || entry.role !== "admin") return;
          await endCurrentSession();
          break;
        }

        case "viewer-join": {
          // A viewer is ready to receive an offer. Ask the broadcaster to
          // create a peer connection for them.
          if (!entry || entry.role !== "viewer" || !entry.viewerId) return;
          if (broadcaster) {
            safeSend(broadcaster.ws, { type: "viewer-joined", viewerId: entry.viewerId });
          }
          break;
        }

        case "webrtc-offer": {
          // admin -> specific viewer
          if (!entry || entry.role !== "admin") return;
          const target = viewers.get(msg.targetViewerId);
          if (target) {
            safeSend(target.ws, { type: "webrtc-offer", sdp: msg.sdp });
          }
          break;
        }

        case "webrtc-answer": {
          // viewer -> admin, tagged with viewerId
          if (!entry || entry.role !== "viewer" || !entry.viewerId) return;
          if (broadcaster) {
            safeSend(broadcaster.ws, {
              type: "webrtc-answer",
              viewerId: entry.viewerId,
              sdp: msg.sdp,
            });
          }
          break;
        }

        case "webrtc-ice-candidate": {
          if (!entry) return;
          if (entry.role === "admin") {
            const target = viewers.get(msg.targetViewerId);
            if (target) {
              safeSend(target.ws, { type: "webrtc-ice-candidate", candidate: msg.candidate });
            }
          } else if (entry.viewerId && broadcaster) {
            safeSend(broadcaster.ws, {
              type: "webrtc-ice-candidate",
              viewerId: entry.viewerId,
              candidate: msg.candidate,
            });
          }
          break;
        }

        default:
          break;
      }
    });

    ws.on("close", async () => {
      if (!entry) return;
      if (entry.role === "admin") {
        if (broadcaster && broadcaster.ws === ws) {
          broadcaster = null;
          await endCurrentSession();
        }
      } else if (entry.viewerId) {
        viewers.delete(entry.viewerId);
        if (broadcaster) {
          safeSend(broadcaster.ws, { type: "viewer-left", viewerId: entry.viewerId });
        }
        broadcastViewerCount();
      }
    });

    ws.on("error", () => {
      // Swallow — the close handler above will still fire and clean up.
    });
  });

  console.log("[Signaling] WebRTC signaling server attached at /api/stream-sync");
  return wss;
}
