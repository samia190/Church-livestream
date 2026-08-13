import { useCallback, useRef, useState } from "react";
import {
  LocalTrackPublication,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "livekit-client";

type LiveKitChatMessage = { id: string; user: string; message: string; timestamp: Date; role?: string };

function nextStream(tracks: Map<string, MediaStreamTrack>) {
  return tracks.size > 0 ? new MediaStream(Array.from(tracks.values())) : null;
}

function encodeChat(message: string, user: string, role: string) {
  return new TextEncoder().encode(JSON.stringify({ type: "chat-message", id: crypto.randomUUID(), user, message, timestamp: Date.now(), role }));
}

function decodeChat(payload: Uint8Array, identity: string): LiveKitChatMessage | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(payload));
    if (parsed.type !== "chat-message" || typeof parsed.message !== "string") return null;
    return { id: String(parsed.id ?? `${identity}-${Date.now()}`), user: String(parsed.user ?? "Viewer"), message: parsed.message.slice(0, 2000), timestamp: new Date(Number(parsed.timestamp ?? Date.now())), role: typeof parsed.role === "string" ? parsed.role : undefined };
  } catch {
    return null;
  }
}

export function useLiveKitViewer() {
  const roomRef = useRef<Room | null>(null);
  const tracksRef = useRef(new Map<string, MediaStreamTrack>());
  const [connected, setConnected] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [needsAudioStart, setNeedsAudioStart] = useState(false);
  const [chatMessages, setChatMessages] = useState<LiveKitChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const disconnect = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    tracksRef.current.clear();
    setConnected(false);
    setIsLive(false);
    setRemoteStream(null);
    setViewerCount(0);
    setNeedsAudioStart(false);
    setChatMessages([]);
  }, []);

  const connect = useCallback(async (serverUrl: string, token: string) => {
    disconnect();
    setError(null);
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    const refreshStream = () => setRemoteStream(nextStream(tracksRef.current));
    const handleSubscribed = (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (track.kind !== Track.Kind.Audio && track.kind !== Track.Kind.Video) return;
      tracksRef.current.set(`${participant.identity}:${track.sid}`, track.mediaStreamTrack);
      refreshStream();
      setIsLive(true);
    };
    const handleUnsubscribed = (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      tracksRef.current.delete(`${participant.identity}:${track.sid}`);
      refreshStream();
      if (tracksRef.current.size === 0) setIsLive(false);
    };
    room.on(RoomEvent.TrackSubscribed, handleSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleUnsubscribed);
    room.on(RoomEvent.ParticipantConnected, () => setViewerCount(room.remoteParticipants.size));
    room.on(RoomEvent.ParticipantDisconnected, () => setViewerCount(room.remoteParticipants.size));
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => setNeedsAudioStart(!room.canPlaybackAudio));
    room.on(RoomEvent.DataReceived, (payload, participant) => {
      try {
        const parsed = JSON.parse(new TextDecoder().decode(payload));
        if (parsed.type === "chat-message-deleted" && typeof parsed.messageId === "string") {
          setChatMessages(current => current.filter(message => message.id !== parsed.messageId));
          return;
        }
      } catch { /* ignore malformed data packets */ }
      const message = decodeChat(payload, participant?.identity ?? "livekit");
      if (message) setChatMessages(current => [...current, message].slice(-100));
    });
    room.on(RoomEvent.Disconnected, () => {
      setConnected(false);
      setIsLive(false);
      setRemoteStream(null);
    });

    try {
      room.prepareConnection(serverUrl, token);
      await room.connect(serverUrl, token, { autoSubscribe: true });
      setConnected(true);
      setViewerCount(room.remoteParticipants.size);
      setNeedsAudioStart(!room.canPlaybackAudio);
    } catch (cause) {
      room.disconnect();
      roomRef.current = null;
      setError(cause instanceof Error ? cause.message : "Unable to connect to the scalable live stream");
      throw cause;
    }
  }, [disconnect]);

  const startAudio = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.startAudio();
    setNeedsAudioStart(!room.canPlaybackAudio);
  }, []);

  const sendChatMessage = useCallback((message: string, user = "Viewer") => {
    const room = roomRef.current;
    if (!room || !message.trim()) return;
    void room.localParticipant.publishData(encodeChat(message.trim().slice(0, 2000), user, "viewer"), { reliable: true });
  }, []);

  return { connect, disconnect, startAudio, connected, isLive, remoteStream, viewerCount, needsAudioStart, chatMessages, sendChatMessage, error };

}

async function publishSource(room: Room, track: MediaStreamTrack, source: Track.Source, name: string) {
  return room.localParticipant.publishTrack(track, { source, name, simulcast: source === Track.Source.Camera });
}

export function useLiveKitBroadcaster() {
  const roomRef = useRef<Room | null>(null);
  const videoPublicationRef = useRef<LocalTrackPublication | null>(null);
  const audioPublicationRef = useRef<LocalTrackPublication | null>(null);
  const [connected, setConnected] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<LiveKitChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(async () => {
    const room = roomRef.current;
    if (room) {
      await room.localParticipant.unpublishTracks([...(videoPublicationRef.current?.track ? [videoPublicationRef.current.track.mediaStreamTrack] : []), ...(audioPublicationRef.current?.track ? [audioPublicationRef.current.track.mediaStreamTrack] : [])]);
      room.disconnect();
    }
    roomRef.current = null;
    videoPublicationRef.current = null;
    audioPublicationRef.current = null;
    setConnected(false);
    setIsLive(false);
    setViewerCount(0);
    setChatMessages([]);
  }, []);

  const start = useCallback(async (input: { serverUrl: string; token: string; videoStream: MediaStream; audioStream?: MediaStream | null }) => {
    await stop();
    setError(null);
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    room.on(RoomEvent.ParticipantConnected, () => setViewerCount(room.remoteParticipants.size));
    room.on(RoomEvent.ParticipantDisconnected, () => setViewerCount(room.remoteParticipants.size));
    room.on(RoomEvent.DataReceived, (payload, participant) => {
      try {
        const parsed = JSON.parse(new TextDecoder().decode(payload));
        if (parsed.type === "chat-message-deleted" && typeof parsed.messageId === "string") {
          setChatMessages(current => current.filter(message => message.id !== parsed.messageId));
          return;
        }
      } catch { /* ignore malformed data packets */ }
      const message = decodeChat(payload, participant?.identity ?? "viewer");
      if (message) setChatMessages(current => [...current, message].slice(-100));
    });
    room.on(RoomEvent.Disconnected, () => { setConnected(false); setIsLive(false); });
    try {
      room.prepareConnection(input.serverUrl, input.token);
      await room.connect(input.serverUrl, input.token, { autoSubscribe: false });
      const video = input.videoStream.getVideoTracks()[0];
      const audio = input.audioStream?.getAudioTracks()[0] ?? input.videoStream.getAudioTracks()[0];
      if (!video && !audio) throw new Error("The broadcast has no camera or audio track to publish");
      if (video) videoPublicationRef.current = await publishSource(room, video, Track.Source.Camera, "live-camera");
      if (audio) audioPublicationRef.current = await publishSource(room, audio, Track.Source.Microphone, "live-audio");
      setConnected(true);
      setIsLive(true);
    } catch (cause) {
      await stop();
      setError(cause instanceof Error ? cause.message : "Unable to connect the broadcast to the scalable media room");
      throw cause;
    }
  }, [stop]);

  const replaceVideoTrack = useCallback(async (stream: MediaStream) => {
    const room = roomRef.current;
    if (!room) return;
    const next = stream.getVideoTracks()[0];
    if (!next) throw new Error("The replacement source has no video track");
    const current = videoPublicationRef.current?.track?.mediaStreamTrack;
    if (current) await room.localParticipant.unpublishTrack(current);
    videoPublicationRef.current = await publishSource(room, next, Track.Source.Camera, "live-camera");
  }, []);

  const sendChatMessage = useCallback((message: string, user = "Admin") => {
    const room = roomRef.current;
    if (!room || !message.trim()) return;
    void room.localParticipant.publishData(encodeChat(message.trim().slice(0, 2000), user, "admin"), { reliable: true });
  }, []);

  const deleteChatMessage = useCallback((messageId: string) => {
    const room = roomRef.current;
    if (!room || !messageId) return;
    void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: "chat-message-deleted", messageId })), { reliable: true });
  }, []);

  const replaceAudioTrack = useCallback(async (stream: MediaStream | null) => {
    const room = roomRef.current;
    const next = stream?.getAudioTracks()[0];
    if (!room || !next) return;
    const current = audioPublicationRef.current?.track?.mediaStreamTrack;
    if (current) await room.localParticipant.unpublishTrack(current);
    audioPublicationRef.current = await publishSource(room, next, Track.Source.Microphone, "live-audio");
  }, []);

  return { start, stop, replaceVideoTrack, replaceAudioTrack, sendChatMessage, deleteChatMessage, connected, isLive, viewerCount, chatMessages, error };
}
