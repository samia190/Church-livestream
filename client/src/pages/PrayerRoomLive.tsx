import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Hand,
  Lock,
  MessageCircle,
  Mic,
  MicOff,
  PhoneOff,
  ShieldAlert,
  Users,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ICE_SERVERS } from "@/lib/iceServers";

type Participant = { id: string; name: string };
type ChatMessage = {
  senderId: string;
  senderName: string;
  text: string;
  at: number;
};

function RemoteVideo({ stream, name }: { stream: MediaStream; name: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
    return () => {
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [stream]);
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-void border border-border">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="h-full w-full object-cover"
      />
      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
        {name}
      </span>
    </div>
  );
}

export default function PrayerRoomLive() {
  const [, setLocation] = useLocation();
  const sessionId = useMemo(
    () => window.location.pathname.split("/")[2] ?? "",
    []
  );
  const authQuery = trpc.auth.me.useQuery(undefined, { retry: false });
  const auth = authQuery.data;
  const sessionStatus = trpc.prayerRoom.status.useQuery(
    { sessionId },
    { enabled: Boolean(auth && sessionId), refetchInterval: 15000 }
  );
  const join = trpc.prayerRoom.join.useMutation();
  const [status, setStatus] = useState("Preparing the safe room…");
  const [mediaReady, setMediaReady] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("Prayer Room");
  const [mode, setMode] = useState<"voice-video" | "voice">("voice-video");
  const [isHost, setIsHost] = useState(false);
  const [selfId, setSelfId] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const selfIdRef = useRef("");
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const pendingIceRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const participantNamesRef = useRef(new Map<string, string>());

  const send = (payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify(payload));
  };

  const closePeer = (peerId: string) => {
    peersRef.current.get(peerId)?.close();
    peersRef.current.delete(peerId);
    pendingIceRef.current.delete(peerId);
    setRemoteStreams(current => {
      const next = { ...current };
      delete next[peerId];
      return next;
    });
  };

  const createPeer = async (peerId: string, offer: boolean) => {
    if (peersRef.current.has(peerId)) return peersRef.current.get(peerId)!;
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current.set(peerId, peer);
    localStreamRef.current
      ?.getTracks()
      .forEach(track => peer.addTrack(track, localStreamRef.current!));
    peer.onicecandidate = event => {
      if (event.candidate)
        send({ type: "ice", targetId: peerId, candidate: event.candidate });
    };
    peer.ontrack = event => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      setRemoteStreams(current => ({ ...current, [peerId]: stream }));
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "closed") closePeer(peerId);
    };
    peer.oniceconnectionstatechange = async () => {
      if (peer.iceConnectionState !== "failed") return;
      try {
        const restarted = await peer.createOffer({ iceRestart: true });
        await peer.setLocalDescription(restarted);
        send({ type: "offer", targetId: peerId, sdp: restarted });
      } catch {
        closePeer(peerId);
      }
    };
    const queued = pendingIceRef.current.get(peerId) ?? [];
    for (const candidate of queued)
      await peer.addIceCandidate(candidate).catch(() => undefined);
    pendingIceRef.current.delete(peerId);
    if (offer) {
      const description = await peer.createOffer();
      await peer.setLocalDescription(description);
      send({ type: "offer", targetId: peerId, sdp: description });
    }
    return peer;
  };

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      if (authQuery.isLoading) return;
      if (!auth) {
        setStatus("Please sign in to enter this Prayer Room.");
        window.location.assign(
          `/auth?next=${encodeURIComponent(window.location.pathname)}`
        );
        return;
      }
      if (!sessionId) {
        setStatus("This Prayer Room link is incomplete.");
        return;
      }
      try {
        const room = await join.mutateAsync({ sessionId });
        if (cancelled) return;
        setSessionTitle(room.title);
        setMode(room.mode);
        setIsHost(room.role === "admin");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: room.mode === "voice-video",
        });
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        localStreamRef.current = stream;
        setMediaReady(true);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setCameraOn(room.mode === "voice-video");
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(
          `${protocol}//${window.location.host}/api/prayer-room-sync?sessionId=${encodeURIComponent(sessionId)}`
        );
        wsRef.current = ws;
        ws.onopen = () => setStatus("Connected. Make room for one another.");
        ws.onmessage = async event => {
          let message: any;
          try {
            message = JSON.parse(event.data);
          } catch {
            return;
          }
          if (message.type === "room-joined") {
            selfIdRef.current = message.participantId;
            setSelfId(message.participantId);
            setSessionTitle(message.title);
            setMode(message.mode);
            const existing = (message.participants ?? []) as Participant[];
            existing.forEach(participant =>
              participantNamesRef.current.set(participant.id, participant.name)
            );
            setParticipants(existing);
            for (const participant of existing)
              await createPeer(
                participant.id,
                message.participantId < participant.id
              );
          } else if (message.type === "participant-joined") {
            participantNamesRef.current.set(
              message.participant.id,
              message.participant.name
            );
            setParticipants(current =>
              current.some(item => item.id === message.participant.id)
                ? current
                : [...current, message.participant]
            );
            await createPeer(
              message.participant.id,
              selfIdRef.current < message.participant.id
            );
          } else if (message.type === "participant-left") {
            closePeer(message.participantId);
            setParticipants(current =>
              current.filter(item => item.id !== message.participantId)
            );
          } else if (message.type === "offer") {
            const peer = await createPeer(message.senderId, false);
            await peer.setRemoteDescription(message.sdp);
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            send({ type: "answer", targetId: message.senderId, sdp: answer });
          } else if (message.type === "answer") {
            await peersRef.current
              .get(message.senderId)
              ?.setRemoteDescription(message.sdp);
          } else if (message.type === "ice") {
            const peer = peersRef.current.get(message.senderId);
            if (peer?.remoteDescription)
              await peer
                .addIceCandidate(message.candidate)
                .catch(() => undefined);
            else {
              const queued = pendingIceRef.current.get(message.senderId) ?? [];
              queued.push(message.candidate);
              pendingIceRef.current.set(message.senderId, queued);
            }
          } else if (message.type === "chat")
            setMessages(current => [...current.slice(-49), message]);
          else if (message.type === "raise-hand")
            toast(
              message.raised
                ? `${message.senderName} raised a hand`
                : `${message.senderName} lowered a hand`
            );
          else if (message.type === "host-mute") {
            localStreamRef.current?.getAudioTracks().forEach(track => {
              track.enabled = false;
            });
            setMuted(true);
            toast("The host muted your microphone for safeguarding.");
          } else if (message.type === "host-remove") {
            ws.close();
            localStreamRef.current?.getTracks().forEach(track => track.stop());
            setStatus(
              "The host ended your participation in this room for safeguarding."
            );
            toast.error("You were removed from the Prayer Room.");
          } else if (message.type === "room-ended") {
            ws.close();
            localStreamRef.current?.getTracks().forEach(track => track.stop());
            setStatus(message.reason || "The host ended this Prayer Room.");
            toast("The Prayer Room has ended.");
          }
        };
        ws.onerror = () =>
          setStatus(
            "The room connection needs attention. Check your network and try again."
          );
        ws.onclose = () => setStatus("Disconnected from the room.");
      } catch (error) {
        setStatus(
          error instanceof Error
            ? error.message
            : "Unable to enter this Prayer Room"
        );
      }
    };
    void start();
    return () => {
      cancelled = true;
      wsRef.current?.close();
      peersRef.current.forEach(peer => peer.close());
      peersRef.current.clear();
      localStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [auth, authQuery.isLoading, sessionId]);

  useEffect(() => {
    if (
      sessionStatus.data?.status === "ended" ||
      sessionStatus.data?.status === "cancelled"
    ) {
      wsRef.current?.close();
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      setStatus(
        sessionStatus.data.status === "ended"
          ? "The host has ended this gathering."
          : "This gathering was cancelled by the church team."
      );
    }
  }, [sessionStatus.data?.status]);

  const leave = () => {
    wsRef.current?.close();
    setLocation("/prayer-gatherings");
  };
  const toggleMute = () => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach(track => {
      track.enabled = !next;
    });
    setMuted(next);
  };
  const toggleCamera = () => {
    const next = !cameraOn;
    localStreamRef.current?.getVideoTracks().forEach(track => {
      track.enabled = next;
    });
    setCameraOn(next);
  };
  const toggleHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    send({ type: "raise-hand", raised: next });
  };
  const sendChat = (event: FormEvent) => {
    event.preventDefault();
    if (!chatText.trim()) return;
    send({ type: "chat", text: chatText.trim() });
    setChatText("");
  };
  const moderate = (targetId: string, type: "host-mute" | "host-remove") =>
    send({ type, targetId });

  return (
    <div className="min-h-screen text-foreground">
      <Navigation />
      <main className="pt-28 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <p className="label-eyebrow mb-2">Private Prayer Room</p>
              <h1 className="text-3xl md:text-4xl font-bold">{sessionTitle}</h1>
              <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                <Lock className="w-4 h-4 text-ember" />
                {status}
              </p>
            </div>
            <Button variant="outline" onClick={leave} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Leave room
            </Button>
          </div>
          <div className="grid lg:grid-cols-[1fr_20rem] gap-6">
            <section>
              <div className="grid sm:grid-cols-2 gap-4">
                {mediaReady && (
                  <div className="relative aspect-video overflow-hidden rounded-xl bg-void border border-ember/50">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className={`h-full w-full object-cover ${cameraOn ? "" : "hidden"}`}
                    />
                    <div
                      className={`absolute inset-0 grid place-items-center text-muted-foreground ${cameraOn ? "hidden" : ""}`}
                    >
                      <Mic className="w-10 h-10" />
                    </div>
                    <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
                      You
                    </span>
                  </div>
                )}
                {Object.entries(remoteStreams).map(([peerId, stream]) => (
                  <RemoteVideo
                    key={peerId}
                    stream={stream}
                    name={
                      participantNamesRef.current.get(peerId) ?? "NICA member"
                    }
                  />
                ))}
              </div>
              <Card className="mt-5 p-4 flex flex-wrap items-center justify-center gap-3">
                <Button
                  size="icon"
                  variant={muted ? "destructive" : "outline"}
                  onClick={toggleMute}
                  aria-label={muted ? "Unmute microphone" : "Mute microphone"}
                >
                  {muted ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </Button>
                {mode === "voice-video" && (
                  <Button
                    size="icon"
                    variant={!cameraOn ? "destructive" : "outline"}
                    onClick={toggleCamera}
                    aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
                  >
                    {cameraOn ? (
                      <Camera className="w-4 h-4" />
                    ) : (
                      <CameraOff className="w-4 h-4" />
                    )}
                  </Button>
                )}
                <Button
                  size="icon"
                  variant={handRaised ? "default" : "outline"}
                  onClick={toggleHand}
                  aria-label={handRaised ? "Lower hand" : "Raise hand"}
                >
                  <Hand className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="destructive"
                  onClick={leave}
                  aria-label="Leave Prayer Room"
                >
                  <PhoneOff className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setLocation("/care")}
                >
                  <ShieldAlert className="w-4 h-4" />
                  Report a concern
                </Button>
              </Card>
            </section>
            <aside className="space-y-5">
              <Card className="p-5">
                <h2 className="font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 text-ember" />
                  People in the room ({participants.length + (selfId ? 1 : 0)})
                </h2>
                <p className="text-sm text-muted-foreground mt-3">
                  Speak briefly, listen generously, and do not record or forward
                  another person's story.
                </p>
                <div className="mt-4 space-y-2 text-sm">
                  {participants.map(participant => (
                    <div
                      key={participant.id}
                      className="rounded-lg border border-border px-3 py-2 flex items-center justify-between gap-2"
                    >
                      <span>{participant.name}</span>
                      {isHost && (
                        <span className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              moderate(participant.id, "host-mute")
                            }
                            aria-label={`Mute ${participant.name}`}
                          >
                            <MicOff className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() =>
                              moderate(participant.id, "host-remove")
                            }
                            aria-label={`Remove ${participant.name}`}
                          >
                            <PhoneOff className="w-3 h-3" />
                          </Button>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-5">
                <h2 className="font-bold flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-ember" />
                  Gentle chat
                </h2>
                <div className="mt-3 max-h-52 overflow-y-auto space-y-2">
                  {messages.length ? (
                    messages.map((message, index) => (
                      <p key={`${message.at}-${index}`} className="text-sm">
                        <span className="font-semibold">
                          {message.senderName}:
                        </span>{" "}
                        {message.text}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Use chat for short encouragements, prayer requests, or
                      practical room notes.
                    </p>
                  )}
                </div>
                <form onSubmit={sendChat} className="flex gap-2 mt-4">
                  <Input
                    value={chatText}
                    onChange={event => setChatText(event.target.value)}
                    maxLength={2000}
                    placeholder="Write a kind message"
                    aria-label="Prayer Room chat message"
                  />
                  <Button type="submit" size="sm">
                    Send
                  </Button>
                </form>
              </Card>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
