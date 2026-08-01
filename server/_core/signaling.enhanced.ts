import type { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import { updateStreamStatus as dbUpdateStreamStatus } from "../db";

/**
 * Enhanced signaling server with pre-stream support.
 *
 * This server manages:
 * 1. WebRTC signaling (SDP offers/answers, ICE candidates)
 * 2. Broadcast mode state (offline, pre-stream, live)
 * 3. Chat messaging
 * 4. Viewer count and connection management
 *
 * The broadcast mode is synchronized across all clients so viewers know
 * whether they're watching pre-stream media or a live camera feed.
 */

type BroadcastMode = "offline" | "pre-stream" | "live";

interface SessionInfo {
  sessionId: string;
  title: string;
  description?: string;
  startedAt: number;
  broadcastMode: BroadcastMode;
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

/**
 * Create the current stream update payload.
 * This includes the broadcast mode so viewers know what they're watching.
 */
function currentStreamUpdatePayload() {
  return {
    type: "stream-update",
    session: currentSession
      ? {
          sessionId: currentSession.sessionId,
          isLive: currentSession.broadcastMode !== "offline",
          broadcastMode: currentSession.broadcastMode,
          title: currentSession.title,
          description: currentSession.description || "",
          viewers: viewers.size,
          startTime: currentSession.startedAt,
        }
      : {
          sessionId: null,
          isLive: false,
          broadcastMode: "offline" as BroadcastMode,
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

/**
 * Broadcast mode change to all clients.
 */
function broadcastModeChange(mode: BroadcastMode) {
  if (!currentSession) return;

  currentSession.broadcastMode = mode;

  const payload = {
    type: "broadcast-mode-changed",
    broadcastMode: mode,
    session: {
      sessionId: currentSession.sessionId,
      isLive: mode !== "offline",
      broadcastMode: mode,
      title: currentSession.title,
      description: currentSession.description || "",
      viewers: viewers.size,
      startTime: currentSession.startedAt,
    },
  };

  broadcastToViewers(payload);
  if (broadcaster) safeSend(broadcaster.ws, payload);

  console.log(`[Signaling] Broadcast mode changed to: ${mode}`);
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
            console.log("[Signaling] Admin connected");
          } else {
            const viewerId = randomUUID();
            entry = { ws, role: "viewer", viewerId };
            viewers.set(viewerId, entry);
            safeSend(ws, { type: "welcome", viewerId });
            safeSend(ws, currentStreamUpdatePayload());
            broadcastViewerCount();
            console.log(`[Signaling] Viewer connected: ${viewerId}`);

            // FAST-START: Immediately notify broadcaster that a new viewer is ready
            // This eliminates the need for the viewer to send 'viewer-join' and wait for round-trip.
            if (broadcaster && currentSession && currentSession.broadcastMode !== "offline") {
              safeSend(broadcaster.ws, { type: "viewer-joined", viewerId });
            }
          }
          break;
        }

        case "go-live": {
          if (!entry || entry.role !== "admin") return;

          const broadcastMode: BroadcastMode = msg.broadcastMode || "live";

          currentSession = {
            sessionId: msg.sessionId,
            title: msg.title || "Live Stream",
            description: msg.description || "",
            startedAt: Date.now(),
            broadcastMode,
          };

          broadcastToViewers(currentStreamUpdatePayload());
          console.log(`[Signaling] Stream started in ${broadcastMode} mode`);

          // NOTIFY ALL CONNECTED VIEWERS: When stream goes live, trigger join for all waiting viewers
          if (broadcastMode !== "offline") {
            for (const [viewerId, viewerEntry] of viewers.entries()) {
              if (broadcaster) {
                safeSend(broadcaster.ws, { type: "viewer-joined", viewerId });
              }
              // Also send viewer-join to the viewer so they can create their own offer
              safeSend(viewerEntry.ws, { type: "viewer-joined" });
            }
            console.log(`[Signaling] Notified ${viewers.size} viewers about live stream`);
          }
          break;
        }

        case "end-live": {
          if (!entry || entry.role !== "admin") return;
          await endCurrentSession();
          console.log("[Signaling] Stream ended");
          break;
        }

        case "broadcast-mode-changed": {
          if (!entry || entry.role !== "admin") return;

          const newMode: BroadcastMode = msg.broadcastMode;
          if (currentSession && newMode !== currentSession.broadcastMode) {
            broadcastModeChange(newMode);

            // When switching TO live, notify all viewers to join
            if (newMode !== "offline" && broadcaster) {
              for (const [viewerId, viewerEntry] of viewers.entries()) {
                safeSend(broadcaster.ws, { type: "viewer-joined", viewerId });
                safeSend(viewerEntry.ws, { type: "viewer-joined" });
              }
              console.log(`[Signaling] Mode changed to ${newMode}, notified ${viewers.size} viewers`);
            }
          }
          break;
        }

        case "viewer-join": {
          if (!entry || entry.role !== "viewer" || !entry.viewerId) return;
          if (broadcaster) {
            safeSend(broadcaster.ws, { type: "viewer-joined", viewerId: entry.viewerId });
          }
          break;
        }

        case "webrtc-offer": {
          // Accept offers from both admin (targeted to specific viewer) and from viewers (viewer-initiated offer)
          if (entry && entry.role === "admin" && msg.targetViewerId) {
            // Admin sending offer to a specific viewer
            const target = viewers.get(msg.targetViewerId);
            if (target) {
              safeSend(target.ws, { type: "webrtc-offer", sdp: msg.sdp });
            }
          } else if (entry && entry.role === "viewer") {
            // Viewer-initiated offer: forward to broadcaster so they can answer
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
          // Accept answers from both viewers (to broadcaster) and admin (targeted to viewer)
          if (entry && entry.role === "viewer" && entry.viewerId) {
            // Viewer sending answer to broadcaster
            if (broadcaster) {
              safeSend(broadcaster.ws, {
                type: "webrtc-answer",
                viewerId: entry.viewerId,
                sdp: msg.sdp,
              });
            }
          } else if (entry && entry.role === "admin" && msg.targetViewerId) {
            // Admin sending answer to specific viewer (for viewer-initiated offers)
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
            // Admin sending ICE candidate to specific viewer
            const target = viewers.get(msg.targetViewerId);
            if (target) {
              safeSend(target.ws, { type: "webrtc-ice-candidate", candidate: msg.candidate });
            }
          } else if (entry.viewerId && broadcaster) {
            // Viewer sending ICE candidate to broadcaster
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
          console.log("[Signaling] Admin disconnected");
        }
      } else if (entry.viewerId) {
        viewers.delete(entry.viewerId);
        if (broadcaster) {
          safeSend(broadcaster.ws, { type: "viewer-left", viewerId: entry.viewerId });
        }
        broadcastViewerCount();
        console.log(`[Signaling] Viewer disconnected: ${entry.viewerId}`);
      }
    });

    ws.on("error", (error) => {
      console.error("[Signaling] WebSocket error:", error);
    });
  });

  console.log("[Signaling] Enhanced WebRTC signaling server attached at /api/stream-sync");
  return wss;
}
