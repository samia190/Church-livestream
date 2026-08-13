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

type DirectorChatMessage = { id: string; user: string; message: string; timestamp: Date; role?: string };
export type ContributorFeed = { identity: string; name: string; stream: MediaStream; track: MediaStreamTrack };

function encodeChat(message: string, user: string, role: string) {
  return new TextEncoder().encode(JSON.stringify({
    type: "chat-message",
    id: crypto.randomUUID(),
    user,
    message,
    timestamp: Date.now(),
    role,
  }));
}

function decodeChat(payload: Uint8Array, identity: string): DirectorChatMessage | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(payload));
    if (parsed.type !== "chat-message" || typeof parsed.message !== "string") return null;
    return {
      id: String(parsed.id ?? `${identity}-${Date.now()}`),
      user: String(parsed.user ?? "Viewer"),
      message: parsed.message.slice(0, 2000),
      timestamp: new Date(Number(parsed.timestamp ?? Date.now())),
      role: typeof parsed.role === "string" ? parsed.role : undefined,
    };
  } catch {
    return null;
  }
}

async function publishTrack(room: Room, track: MediaStreamTrack, source: Track.Source, name: string) {
  return room.localParticipant.publishTrack(track, {
    source,
    name,
    simulcast: source === Track.Source.Camera,
  });
}

export function useLiveKitDirector() {
  const productionRoomRef = useRef<Room | null>(null);
  const programRoomRef = useRef<Room | null>(null);
  const programVideoPublicationRef = useRef<LocalTrackPublication | null>(null);
  const programAudioPublicationRef = useRef<LocalTrackPublication | null>(null);
  const contributorFeedsRef = useRef(new Map<string, ContributorFeed>());
  const [connected, setConnected] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [contributorFeeds, setContributorFeeds] = useState<ContributorFeed[]>([]);
  const [selectedFeedIdentity, setSelectedFeedIdentity] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<DirectorChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshContributorFeeds = useCallback(() => {
    setContributorFeeds(Array.from(contributorFeedsRef.current.values()));
  }, []);

  const stop = useCallback(async () => {
    const programRoom = programRoomRef.current;
    if (programRoom) {
      const tracks = [
        programVideoPublicationRef.current?.track?.mediaStreamTrack,
        programAudioPublicationRef.current?.track?.mediaStreamTrack,
      ].filter((track): track is MediaStreamTrack => Boolean(track));
      if (tracks.length) await programRoom.localParticipant.unpublishTracks(tracks).catch(() => undefined);
      programRoom.disconnect();
    }
    productionRoomRef.current?.disconnect();
    productionRoomRef.current = null;
    programRoomRef.current = null;
    programVideoPublicationRef.current = null;
    programAudioPublicationRef.current = null;
    contributorFeedsRef.current.clear();
    setContributorFeeds([]);
    setSelectedFeedIdentity(null);
    setConnected(false);
    setIsLive(false);
    setViewerCount(0);
    setChatMessages([]);
  }, []);

  const start = useCallback(async (input: {
    production: { serverUrl: string; token: string };
    program: { serverUrl: string; token: string };
    videoStream: MediaStream;
    audioStream?: MediaStream | null;
  }) => {
    await stop();
    setError(null);
    const productionRoom = new Room({ adaptiveStream: true, dynacast: true });
    const programRoom = new Room({ adaptiveStream: true, dynacast: true });
    productionRoomRef.current = productionRoom;
    programRoomRef.current = programRoom;

    const handleSubscribed = (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (track.kind !== Track.Kind.Video) return;
      contributorFeedsRef.current.set(participant.identity, {
        identity: participant.identity,
        name: participant.name || participant.identity,
        track: track.mediaStreamTrack,
        stream: new MediaStream([track.mediaStreamTrack]),
      });
      refreshContributorFeeds();
    };
    const handleUnsubscribed = (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (track.kind !== Track.Kind.Video) return;
      const current = contributorFeedsRef.current.get(participant.identity);
      if (current?.track === track.mediaStreamTrack) contributorFeedsRef.current.delete(participant.identity);
      refreshContributorFeeds();
    };
    const handleParticipantDisconnected = (participant: RemoteParticipant) => {
      contributorFeedsRef.current.delete(participant.identity);
      refreshContributorFeeds();
    };

    productionRoom.on(RoomEvent.TrackSubscribed, handleSubscribed);
    productionRoom.on(RoomEvent.TrackUnsubscribed, handleUnsubscribed);
    productionRoom.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    programRoom.on(RoomEvent.ParticipantConnected, () => setViewerCount(programRoom.remoteParticipants.size));
    programRoom.on(RoomEvent.ParticipantDisconnected, () => setViewerCount(programRoom.remoteParticipants.size));
    programRoom.on(RoomEvent.DataReceived, (payload, participant) => {
      try {
        const parsed = JSON.parse(new TextDecoder().decode(payload));
        if (parsed.type === "chat-message-deleted" && typeof parsed.messageId === "string") {
          setChatMessages(current => current.filter(message => message.id !== parsed.messageId));
          return;
        }
      } catch { /* ignore malformed packets */ }
      const message = decodeChat(payload, participant?.identity ?? "viewer");
      if (message) setChatMessages(current => [...current, message].slice(-100));
    });
    programRoom.on(RoomEvent.Disconnected, () => {
      setConnected(false);
      setIsLive(false);
    });

    try {
      productionRoom.prepareConnection(input.production.serverUrl, input.production.token);
      programRoom.prepareConnection(input.program.serverUrl, input.program.token);
      await productionRoom.connect(input.production.serverUrl, input.production.token, { autoSubscribe: true });
      await programRoom.connect(input.program.serverUrl, input.program.token, { autoSubscribe: false });
      const video = input.videoStream.getVideoTracks()[0];
      const audio = input.audioStream?.getAudioTracks()[0] ?? input.videoStream.getAudioTracks()[0];
      if (!video && !audio) throw new Error("The broadcast has no camera or audio track to publish");
      if (video) programVideoPublicationRef.current = await publishTrack(programRoom, video, Track.Source.Camera, "program-video");
      if (audio) programAudioPublicationRef.current = await publishTrack(programRoom, audio, Track.Source.Microphone, "program-audio");
      setConnected(true);
      setIsLive(true);
    } catch (cause) {
      await stop();
      setError(cause instanceof Error ? cause.message : "Unable to connect the director rooms");
      throw cause;
    }
  }, [refreshContributorFeeds, stop]);

  const replaceProgramVideoTrack = useCallback(async (track: MediaStreamTrack) => {
    const programRoom = programRoomRef.current;
    if (!programRoom) return;
    const current = programVideoPublicationRef.current?.track?.mediaStreamTrack;
    if (current && current !== track) await programRoom.localParticipant.unpublishTrack(current);
    programVideoPublicationRef.current = await publishTrack(programRoom, track, Track.Source.Camera, "program-video");
  }, []);

  const replaceProgramVideoFromStream = useCallback(async (stream: MediaStream, identity: string | null = null) => {
    const track = stream.getVideoTracks()[0];
    if (!track) throw new Error("The selected source has no video track");
    await replaceProgramVideoTrack(track);
    setSelectedFeedIdentity(identity);
  }, [replaceProgramVideoTrack]);

  const selectContributorFeed = useCallback(async (identity: string) => {
    const feed = contributorFeedsRef.current.get(identity);
    if (!feed) throw new Error("That contributor camera is no longer connected");
    await replaceProgramVideoTrack(feed.track);
    setSelectedFeedIdentity(identity);
  }, [replaceProgramVideoTrack]);

  const replaceAudioTrack = useCallback(async (stream: MediaStream | null) => {
    const programRoom = programRoomRef.current;
    const next = stream?.getAudioTracks()[0];
    if (!programRoom || !next) return;
    const current = programAudioPublicationRef.current?.track?.mediaStreamTrack;
    if (current) await programRoom.localParticipant.unpublishTrack(current);
    programAudioPublicationRef.current = await publishTrack(programRoom, next, Track.Source.Microphone, "program-audio");
  }, []);

  const sendChatMessage = useCallback((message: string, user = "Admin") => {
    const room = programRoomRef.current;
    if (!room || !message.trim()) return;
    void room.localParticipant.publishData(encodeChat(message.trim().slice(0, 2000), user, "admin"), { reliable: true });
  }, []);

  const deleteChatMessage = useCallback((messageId: string) => {
    const room = programRoomRef.current;
    if (!room || !messageId) return;
    void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: "chat-message-deleted", messageId })), { reliable: true });
  }, []);

  return {
    start,
    stop,
    replaceVideoTrack: replaceProgramVideoFromStream,
    replaceAudioTrack,
    selectContributorFeed,
    contributorFeeds,
    selectedFeedIdentity,
    sendChatMessage,
    deleteChatMessage,
    connected,
    isLive,
    viewerCount,
    chatMessages,
    error,
  };
}
