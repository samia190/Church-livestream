import { AccessToken, TrackSource } from "livekit-server-sdk";
import { ENV } from "./env";

export type LiveKitRole = "director" | "contributor" | "viewer";
export type LiveKitRoomKind = "production" | "program";

export function isLiveKitConfigured() {
  return Boolean(ENV.liveKitUrl && ENV.liveKitApiKey && ENV.liveKitApiSecret);
}

export function liveKitRoomName(sessionId: string, kind: LiveKitRoomKind = "program") {
  return `nica-kibugu-${kind}-${sessionId}`;
}

export async function createLiveKitParticipantToken(input: {
  sessionId: string;
  identity: string;
  name: string;
  role: LiveKitRole;
  roomKind?: LiveKitRoomKind;
}) {
  if (!isLiveKitConfigured()) {
    throw new Error("LiveKit is not configured");
  }

  const roomKind = input.roomKind ?? (input.role === "viewer" ? "program" : "production");
  const token = new AccessToken(ENV.liveKitApiKey, ENV.liveKitApiSecret, {
    identity: input.identity,
    name: input.name,
    ttl: "2h",
  });
  const isDirector = input.role === "director";
  const isContributor = input.role === "contributor";
  const isProgramViewer = input.role === "viewer";
  token.addGrant({
    roomJoin: true,
    room: liveKitRoomName(input.sessionId, roomKind),
    canPublish: isDirector || (isContributor && roomKind === "production"),
    canPublishSources: isContributor && roomKind === "production" ? [TrackSource.CAMERA] : undefined,
    canSubscribe: isDirector || isProgramViewer,
    canPublishData: isDirector,
  });

  return {
    serverUrl: ENV.liveKitUrl,
    roomName: liveKitRoomName(input.sessionId, roomKind),
    token: await token.toJwt(),
    role: input.role,
    roomKind,
  };
}
