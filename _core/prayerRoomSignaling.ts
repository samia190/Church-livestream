import type { Server as HttpServer, IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { sdk } from "./sdk";
import { authorizePrayerRoomParticipant, getUserByOpenId, updatePrayerRoomSession } from "../db";

type Participant = {
  id: string;
  ws: WebSocket;
  openId: string;
  name: string;
  role: "user" | "admin";
};

const rooms = new Map<string, Map<string, Participant>>();

function send(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function broadcast(room: Map<string, Participant>, payload: unknown, exceptId?: string) {
  for (const participant of Array.from(room.values())) {
    if (participant.id !== exceptId) send(participant.ws, payload);
  }
}

async function authenticate(request: IncomingMessage) {
  const cookies = parseCookieHeader(request.headers.cookie ?? "");
  const session = await sdk.verifySession(cookies[COOKIE_NAME]);
  if (!session) return null;
  return getUserByOpenId(session.openId);
}

export function attachPrayerRoomSignalingServer(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: "/api/prayer-room-sync" });

  wss.on("connection", async (ws, request) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      ws.close(1008, "Prayer Room session is required");
      return;
    }

    try {
      const user = await authenticate(request);
      if (!user) {
        ws.close(1008, "Authentication required");
        return;
      }
      const authorized = await authorizePrayerRoomParticipant(sessionId, user.openId);
      if (!authorized) {
        ws.close(1008, "You are not authorized for this Prayer Room");
        return;
      }
      const participant: Participant = {
        id: randomUUID(),
        ws,
        openId: user.openId,
        name: user.name || "NICA member",
        role: user.role,
      };
      const room = rooms.get(sessionId) ?? new Map<string, Participant>();
      rooms.set(sessionId, room);
      const existing = Array.from(room.values()).map(item => ({ id: item.id, name: item.name }));
      room.set(participant.id, participant);

      send(ws, {
        type: "room-joined",
        participantId: participant.id,
        sessionId: authorized.sessionId,
        title: authorized.title,
        mode: authorized.mode,
        participants: existing,
      });
      broadcast(room, { type: "participant-joined", participant: { id: participant.id, name: participant.name } }, participant.id);

      ws.on("message", raw => {
        const rawText = raw.toString();
        if (rawText.length > 250_000) return;
        let message: any;
        try { message = JSON.parse(rawText); } catch { return; }
        const targetId = typeof message.targetId === "string" ? message.targetId : null;
        if ((message.type === "host-mute" || message.type === "host-remove") && participant.role === "admin" && targetId && room.has(targetId)) {
          const target = room.get(targetId)!;
          if (target.role !== "admin") {
            send(target.ws, { type: message.type, senderId: participant.id, senderName: participant.name });
            if (message.type === "host-remove") target.ws.close(1000, "Removed by the host for safeguarding");
          }
          return;
        }
        if (targetId && room.has(targetId)) {
          send(room.get(targetId)!.ws, { ...message, senderId: participant.id, senderName: participant.name });
          return;
        }
        if (message.type === "chat" && typeof message.text === "string" && message.text.trim().length > 0 && message.text.length <= 2000) {
          broadcast(room, { type: "chat", senderId: participant.id, senderName: participant.name, text: message.text.trim(), at: Date.now() });
        }
        if (message.type === "raise-hand") broadcast(room, { type: "raise-hand", senderId: participant.id, senderName: participant.name, raised: Boolean(message.raised) });
      });

      ws.on("close", () => {
        room.delete(participant.id);
        if (participant.role === "admin") {
          void updatePrayerRoomSession(sessionId, { status: "ended" }).catch(error => console.warn("[PrayerRoom] Failed to persist host disconnect:", error));
          broadcast(room, { type: "room-ended", reason: "The host disconnected and the room was closed for safeguarding." });
        } else {
          broadcast(room, { type: "participant-left", participantId: participant.id });
        }
        if (room.size === 0) rooms.delete(sessionId);
      });
      ws.on("error", () => ws.close());
    } catch (error) {
      console.warn("[PrayerRoom] WebSocket authorization failed:", error instanceof Error ? error.message : error);
      ws.close(1008, "You are not authorized for this Prayer Room");
    }
  });

  console.log("[PrayerRoom] Authenticated room signaling attached at /api/prayer-room-sync");
  return wss;
}
