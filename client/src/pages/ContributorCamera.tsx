import { useCallback, useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { Room, Track, type LocalTrackPublication } from "livekit-client";
import { Camera, CameraOff, CheckCircle2, Loader2, LogOut, RefreshCw, ShieldCheck, Smartphone, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type ContributorStatus = "ready" | "connecting" | "live" | "leaving" | "error";

export default function ContributorCamera() {
  const [, params] = useRoute("/contribute/:code");
  const inviteCode = params?.code ?? "";
  const sessionId = new URLSearchParams(window.location.search).get("sessionId") ?? "";
  const [deviceName, setDeviceName] = useState("");
  const [status, setStatus] = useState<ContributorStatus>("ready");
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const statusRef = useRef<ContributorStatus>("ready");
  const roomRef = useRef<Room | null>(null);
  const publicationRef = useRef<LocalTrackPublication | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const contributorToken = trpc.streaming.acceptCameraInvitation.useMutation();
  const heartbeat = trpc.streaming.contributorHeartbeat.useMutation();

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = cameraStream;
    if (cameraStream) void videoRef.current.play().catch(() => undefined);
  }, [cameraStream]);

  const stopLocalCamera = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);
  }, []);

  const leave = useCallback(async () => {
    statusRef.current = "leaving";
    setStatus("leaving");
    if (heartbeatRef.current !== null) window.clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
    const room = roomRef.current;
    const track = publicationRef.current?.track?.mediaStreamTrack;
    if (room && track) await room.localParticipant.unpublishTrack(track).catch(() => undefined);
    room?.disconnect();
    roomRef.current = null;
    publicationRef.current = null;
    stopLocalCamera();
    statusRef.current = "ready";
    setStatus("ready");
  }, [stopLocalCamera]);

  useEffect(() => () => {
      if (heartbeatRef.current !== null) window.clearInterval(heartbeatRef.current);
    const track = publicationRef.current?.track?.mediaStreamTrack;
    if (track) track.stop();
    roomRef.current?.disconnect();
  }, []);

  const acquireCamera = useCallback(async (mode: "environment" | "user") => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("This device does not provide camera access.");
    const next = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    cameraStreamRef.current = next;
    setCameraStream(next);
    return next;
  }, []);

  const joinProduction = async () => {
    if (!inviteCode || !sessionId) {
      setError("This invite link is missing its live-session information. Ask the director for a fresh link.");
      setStatus("error");
      return;
    }
    if (!deviceName.trim()) {
      toast.error("Enter a name for this camera first");
      return;
    }
    setError(null);
    setStatus("connecting");
    try {
      const access = await contributorToken.mutateAsync({ sessionId, inviteToken: inviteCode, deviceName: deviceName.trim() });
      const nextStream = await acquireCamera(facingMode);
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      room.on("disconnected", () => {
        if (statusRef.current !== "leaving") {
          setStatus("error");
          setError("The director ended the broadcast or the production room disconnected.");
        }
      });
      await room.connect(access.serverUrl, access.token, { autoSubscribe: false });
      const track = nextStream.getVideoTracks()[0];
      if (!track) throw new Error("No camera track was available.");
      publicationRef.current = await room.localParticipant.publishTrack(track, {
        source: Track.Source.Camera,
        name: access.label || deviceName.trim(),
        simulcast: true,
      });
      heartbeatRef.current = window.setInterval(() => {
        void heartbeat.mutateAsync({ sessionId, invitationId: access.invitationId }).catch(() => undefined);
      }, 20_000);
      setStatus("live");
      toast.success("Your camera is now available to the director");
    } catch (cause) {
      roomRef.current?.disconnect();
      roomRef.current = null;
      stopLocalCamera();
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Unable to join the production room");
    }
  };

  const switchCamera = async () => {
    const room = roomRef.current;
    if (!room || status !== "live") return;
    const nextMode = facingMode === "environment" ? "user" : "environment";
    try {
      const nextStream = await acquireCamera(nextMode);
      const nextTrack = nextStream.getVideoTracks()[0];
      const oldTrack = publicationRef.current?.track?.mediaStreamTrack;
      if (!nextTrack) throw new Error("The alternate camera is unavailable.");
      if (oldTrack) await room.localParticipant.unpublishTrack(oldTrack);
      publicationRef.current = await room.localParticipant.publishTrack(nextTrack, {
        source: Track.Source.Camera,
        name: deviceName.trim() || "Mobile camera",
        simulcast: true,
      });
      oldTrack?.stop();
      setFacingMode(nextMode);
      toast.success(`Switched to ${nextMode === "environment" ? "back" : "front"} camera`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to switch camera");
    }
  };

  const isLive = status === "live";
  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-xl space-y-4">
        <header className="flex items-center gap-3 px-1">
          <div className="h-11 w-11 rounded-2xl bg-primary/20 text-primary grid place-items-center"><Smartphone className="h-5 w-5" /></div>
          <div><p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">NICA Kibugu Production</p><h1 className="text-2xl font-black tracking-tight">Mobile camera contributor</h1></div>
        </header>
        <Card className="overflow-hidden border-slate-800 bg-slate-900/90 shadow-2xl">
          <div className="relative aspect-[9/16] max-h-[68vh] bg-black">
            <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" aria-label="Your mobile camera preview" />
            {!cameraStream && <div className="absolute inset-0 grid place-items-center text-center text-slate-500 px-8"><Camera className="h-12 w-12 mx-auto mb-3 opacity-50" /><p>Camera preview will appear after you join.</p></div>}
            <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
              <div className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${isLive ? "bg-red-600 text-white" : "bg-slate-900/80 text-slate-300"}`}>
                {isLive ? "You are live" : status === "connecting" ? "Connecting" : "Camera ready"}
              </div>
              {isLive && <div className="rounded-full bg-black/60 p-2 text-green-300"><Wifi className="h-4 w-4" /></div>}
            </div>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 flex gap-2"><WifiOff className="h-4 w-4 mt-0.5 shrink-0" /><span>{error}</span></div>}
            {!isLive ? (
              <>
                <div className="space-y-2"><label className="text-sm font-semibold text-slate-200" htmlFor="device-name">Camera name</label><Input id="device-name" value={deviceName} onChange={event => setDeviceName(event.target.value)} placeholder="For example: Choir camera" className="bg-slate-950 border-slate-700 text-white" autoComplete="name" /></div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-xs text-slate-400 flex gap-2"><ShieldCheck className="h-4 w-4 text-primary shrink-0" /><span>Only your camera video is sent to the private production room. The director decides whether it appears on the public broadcast.</span></div>
                <Button onClick={joinProduction} disabled={status === "connecting"} className="w-full h-12 gap-2">{status === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} Join production</Button>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-200 flex gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /><span>Your camera is connected. Keep this page open and keep the phone steady.</span></div>
                <div className="grid grid-cols-2 gap-3"><Button variant="outline" onClick={switchCamera} className="h-12 gap-2 border-slate-700 bg-slate-950 text-white"><RefreshCw className="h-4 w-4" /> Switch camera</Button><Button variant="destructive" onClick={() => void leave()} className="h-12 gap-2"><LogOut className="h-4 w-4" /> Leave</Button></div>
              </>
            )}
            {status === "error" && <Button variant="ghost" onClick={() => { setStatus("ready"); setError(null); }} className="w-full text-slate-400">Try again</Button>}
          </div>
        </Card>
        <p className="text-center text-xs text-slate-500">Use a stable Wi-Fi or mobile-data connection. If you close this page, the director will see your camera disconnect.</p>
      </div>
    </main>
  );
}
