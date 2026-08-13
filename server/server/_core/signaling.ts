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
 * CRITICAL FIX: When a viewer connects and the stream is already live,
 * both the viewer AND the broadcaster are immediately notified to start
 * WebRTC negotiation. This ensures viewers who join after the admin goes
 * live can see the stream immediately.
 */

interface SessionInfo {
  sessionId: string;
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
  for (const viewer of Array.from(viewers.values())) {
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

            // FAST-START: If the stream is already live, immediately notify
            // both the viewer and the broadcaster to start WebRTC negotiation.
            if (broadcaster && currentSession) {
              safeSend(ws, { type: "viewer-joined" });
              safeSend(broadcaster.ws, { type: "viewer-joined", viewerId });
            }
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

          // Notify all connected viewers to start WebRTC negotiation
          for (const [viewerId, viewerEntry] of Array.from(viewers.entries())) {
            safeSend(viewerEntry.ws, { type: "viewer-joined" });
            if (broadcaster) {
              safeSend(broadcaster.ws, { type: "viewer-joined", viewerId });
            }
          }
          break;
        }

        case "end-live": {
          if (!entry || entry.role !== "admin") return;
          await endCurrentSession();
          break;
        }

        case "viewer-join": {
          if (!entry || entry.role !== "viewer" || !entry.viewerId) return;
          // Also tell the viewer to create their own offer (dual-mode)
          safeSend(ws, { type: "viewer-joined" });
          if (broadcaster) {
            safeSend(broadcaster.ws, { type: "viewer-joined", viewerId: entry.viewerId });
          }
          break;
        }

        case "webrtc-offer": {
          if (entry && entry.role === "admin" && msg.targetViewerId) {
            const target = viewers.get(msg.targetViewerId);
            if (target) {
              safeSend(target.ws, { type: "webrtc-offer", sdp: msg.sdp });
            }
          } else if (entry && entry.role === "viewer") {
            if (broadcaster) {
              safeSend(broadcaster.ws, {
                type: "webrtc-offer",
                viewerId: entry.viewerId,
                sdp: msg.sdp,
              });
            }
          }
          break;
        }

        case "webrtc-answer": {
          if (entry && entry.role === "viewer" && entry.viewerId) {
            if (broadcaster) {
              safeSend(broadcaster.ws, {
                type: "webrtc-answer",
                viewerId: entry.viewerId,
                sdp: msg.sdp,
              });
            }
          } else if (entry && entry.role === "admin" && msg.targetViewerId) {
            const target = viewers.get(msg.targetViewerId);
            if (target) {
              safeSend(target.ws, { type: "webrtc-answer", sdp: msg.sdp });
            }
          }
          break;
        }

        case "webrtc-ice-candidate": {
          if (!entry) return;
          if (entry.role === "admin" && msg.targetViewerId) {
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

        case "chat-message": {
          if (!entry) return;
          const chatPayload = {
            type: "chat-message",
            id: randomUUID(),
            user: msg.user || (entry.role === "admin" ? "Admin" : "Viewer"),
            message: msg.message,
            timestamp: Date.now(),
            role: entry.role,
          };
          broadcastToViewers(chatPayload);
          if (broadcaster) safeSend(broadcaster.ws, chatPayload);
          break;
        }

        case "delete-chat-message": {
          if (!entry || entry.role !== "admin") return;
          const deletePayload = {
            type: "chat-message-deleted",
            messageId: msg.messageId,
          };
          broadcastToViewers(deletePayload);
          if (broadcaster) safeSend(broadcaster.ws, deletePayload);
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
