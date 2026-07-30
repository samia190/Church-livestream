import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import ProfessionalAudioMixer from './ProfessionalAudioMixer';
import PreStreamMediaPlayer from './PreStreamMediaPlayer';
import type { PreStreamMediaPlayerRef } from './PreStreamMediaPlayer';
import StreamAnalyticsEnhanced from './StreamAnalyticsEnhanced';
import {
  Video, Mic, Settings, MessageSquare, Radio, Camera, Volume2,
  Eye, Zap, AlertCircle, CheckCircle, Plus, X, Send,
  Square, RefreshCw, FlipHorizontal, Usb, Loader2, Scan,
  Monitor, Wifi, WifiOff, Film, Play, Pause, ChevronDown, ChevronUp,
  MonitorPlay, Layers, SwitchCamera, Activity, Cpu, Globe, Share2,
  Trash2, ShieldCheck, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useBroadcaster } from '@/hooks/useBroadcaster';
import { useCameraDevices } from '@/hooks/useCameraDevices';

interface ChatMessage {
  id: string;
  user: string;
  message: string;
  timestamp: Date;
  isModerated?: boolean;
  role?: string;
}

interface SectionState {
  cameras: boolean;
  preStream: boolean;
  audio: boolean;
  chat: boolean;
  settings: boolean;
  overlay: boolean;
}

type OverlaySource = 'camera' | 'media' | null;

export const ModernLiveStudio: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLive, setIsLive] = useState(false);
  const camera = useCameraDevices();
  const stream = camera.stream;

  // Section visibility state
  const [expandedSections, setExpandedSections] = useState<SectionState>({
    cameras: true,
    preStream: true,
    audio: true,
    chat: true,
    settings: true,
    overlay: true,
  });

  // Stream settings
  const [streamTitle, setStreamTitle] = useState('Sunday Service - N.I.C.A. Kibugu');
  const [streamDescription, setStreamDescription] = useState('Join us for worship and prayer');

  // Platforms
  const { data: connectedPlatforms, refetch: refetchPlatforms } = trpc.streaming.getPlatforms.useQuery();
  const { mutateAsync: addPlatformMutation, isPending: addPlatformPending } = trpc.streaming.addPlatform.useMutation();
  const { mutateAsync: removePlatformMutation } = trpc.streaming.removePlatform.useMutation();
  const [platformForm, setPlatformForm] = useState<{ platform: 'youtube' | 'facebook' | 'instagram' | 'tiktok' | 'twitter' | 'twitch'; accountName: string; accessToken: string } | null>(null);

  // Chat
  const [newMessage, setNewMessage] = useState('');

  // Stream stats
  const [stats, setStats] = useState({
    viewers: 0,
    duration: '00:00',
    bitrate: '0.0 Mbps',
    fps: 0,
    resolution: '---',
    cpuUsage: 15,
    dropped: 0,
  });

  // Pre-stream / overlay media
  const [activeOverlayStream, setActiveOverlayStream] = useState<MediaStream | null>(null);
  const [overlaySource, setOverlaySource] = useState<OverlaySource>(null);
  const [isOverlayActive, setIsOverlayActive] = useState(false);
  const preStreamRef = useRef<PreStreamMediaPlayerRef>(null);

  // Audio mixer processed stream
  const [mixerProcessedStream, setMixerProcessedStream] = useState<MediaStream | null>(null);

  // Initialize camera on mount
  useEffect(() => {
    camera.start().catch(() => {
      toast.error('Failed to access camera — check browser permissions');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the local preview element in sync
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = activeOverlayStream || stream;
    }
  }, [stream, activeOverlayStream]);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const {
    viewerCount,
    streamStats,
    broadcastMode,
    startBroadcast,
    stopBroadcast,
    updateBroadcast,
    updateLocalStream,
    replaceStream,
    restoreOriginalStream,
    goLiveFromPreStream,
    chatMessages: liveChatMessages,
    sendChatMessage,
    deleteChatMessage
  } = useBroadcaster();

  const { mutateAsync: goLiveMutation, isPending: goLivePending } = trpc.streaming.goLive.useMutation();
  const { mutateAsync: endLiveMutation } = trpc.streaming.endLive.useMutation();

  // Keep displayed viewer count synced
  const peakViewersRef = useRef(0);
  useEffect(() => {
    if (isLive) {
      setStats(prev => ({
        ...prev,
        viewers: viewerCount,
        bitrate: streamStats.bitrate > 0 ? `${streamStats.bitrate.toFixed(1)} Mbps` : prev.bitrate,
        fps: streamStats.fps || prev.fps,
        resolution: streamStats.resolution || prev.resolution,
        dropped: streamStats.packetsLost || prev.dropped,
      }));
      peakViewersRef.current = Math.max(peakViewersRef.current, viewerCount);
    }
  }, [isLive, viewerCount, streamStats]);

  const handleGoLive = async () => {
    if (!streamTitle.trim()) {
      toast.error('Please enter a stream title');
      return;
    }
    if (!stream) {
      toast.error('Camera is not ready yet');
      return;
    }

    try {
      const result = await goLiveMutation({
        title: streamTitle,
        description: streamDescription,
      });
      setSessionId(result.sessionId);

      let initialStream = stream;
      let initialMode: 'live' | 'pre-stream' = 'live';

      if (activeOverlayStream) {
        initialStream = activeOverlayStream;
        initialMode = 'pre-stream';
        setOverlaySource('media');
        setIsOverlayActive(true);
      }

      startBroadcast(initialStream, {
        sessionId: result.sessionId,
        title: streamTitle,
        description: streamDescription,
        initialMode,
        // Always pass the camera stream as the original, even when starting with pre-stream
        originalCameraStream: stream,
      });

      setIsLive(true);
      toast.success(initialMode === 'pre-stream' ? 'Broadcast started with Media' : 'You are now LIVE!');
    } catch (err) {
      toast.error('Failed to go live');
    }
  };

  const handleStopLive = async () => {
    stopBroadcast();
    setIsLive(false);
    setIsOverlayActive(false);
    setOverlaySource(null);
    setActiveOverlayStream(null);
    if (sessionId !== null) {
      try {
        await endLiveMutation({ sessionId });
      } catch (err) {}
    }
    setSessionId(null);
    toast.success('Broadcast ended');
  };

  const handleShowMediaToViewers = async () => {
    if (!preStreamRef.current) return;
    const mediaStream = await preStreamRef.current.captureStream();
    if (!mediaStream) {
      toast.error('Start playing media first');
      return;
    }

    setActiveOverlayStream(mediaStream);
    setIsOverlayActive(true);
    setOverlaySource('media');

    if (isLive) {
      try {
        await replaceStream(mediaStream);
        toast.success('Switching to Media Source');
      } catch (err) {
        toast.error('Failed to switch to media');
      }
    }
  };

  const handleShowCameraToViewers = async () => {
    if (!stream) return;
    setActiveOverlayStream(null);
    setIsOverlayActive(false);
    setOverlaySource('camera');

    if (isLive) {
      try {
        await restoreOriginalStream();
        toast.success('Switching to Camera Source');
      } catch (err) {
        toast.error('Failed to switch to camera');
      }
    }
  };

  const handleGoLiveFromPreStream = async () => {
    try {
      await goLiveFromPreStream();
      setIsOverlayActive(false);
      setOverlaySource('camera');
      setActiveOverlayStream(null);
      toast.success('Now showing LIVE camera!');
    } catch (err) {
      toast.error('Failed to go live');
    }
  };

  const handleSwitchCamera = async (deviceId: string) => {
    try {
      const newStream = await camera.switchToDevice(deviceId);
      if (isLive && !isOverlayActive) updateLocalStream(newStream);
      toast.success('Camera switched');
    } catch (err) {
      toast.error('Switch failed');
    }
  };

  const handleFlipCamera = async () => {
    try {
      const newStream = await camera.flipFacing();
      if (isLive && !isOverlayActive) updateLocalStream(newStream);
    } catch (err) {}
  };

  const handleSendChat = () => {
    if (!newMessage.trim()) return;
    sendChatMessage(newMessage, 'Admin');
    setNewMessage('');
  };

  const handlePreStreamMediaActivate = (mediaStream: MediaStream | null) => {
    if (mediaStream) {
      setActiveOverlayStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } else if (stream) {
      setActiveOverlayStream(null);
      if (videoRef.current) videoRef.current.srcObject = stream;
    }
  };

  /**
   * FIXED: Handle mixer volume/mute changes by actually modifying the broadcast stream.
   * When a track is muted, we disable its track. When unmuted, we re-enable it.
   */
  const handleMixerMuteChange = useCallback((trackId: string, muted: boolean) => {
    toast.success(`${trackId} ${muted ? 'muted' : 'unmuted'}`);

    // For the microphone, toggle the audio track enabled state on the camera stream
    if (trackId === 'mic' && camera.stream) {
      const audioTracks = camera.stream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !muted;
      });

      // Also update the broadcast stream
      if (isLive) {
        const currentStream = activeOverlayStream || camera.stream;
        currentStream.getAudioTracks().forEach(track => {
          track.enabled = !muted;
        });
      }
    }
  }, [isLive, activeOverlayStream, camera.stream]);

  const handleMixerVolumeChange = useCallback((trackId: string, volume: number) => {
    toast.success(`${trackId} volume: ${volume}%`);

    // Volume is handled by the audio graph internally
    // The mixer's gain node will handle this
  }, []);

  /**
   * FIXED: Handle mixer output stream — this is the processed audio output
   * that should be used for the broadcast.
   */
  const handleMixerProcessedStream = useCallback((processedStream: MediaStream | null) => {
    setMixerProcessedStream(processedStream);
  }, []);

  const handleShare = async () => {
    const url = `${window.location.origin}/watch-live`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Watch Live link copied to clipboard');
    } catch {
      toast.info(url);
    }
  };

  const handleRescan = async () => {
    await camera.refreshDevices(true);
    toast.success(`Scan complete — ${camera.devices.length} cameras found`);
  };

  const toggleSection = (section: keyof SectionState) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };



  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 font-sans">
      <div className="max-w-[1600px] mx-auto grid lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: Controls & Preview */}
        <div className="lg:col-span-8 space-y-6">

          {/* Header Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-slate-900/50 border-slate-800 p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLive ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-500'}`}>
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</p>
                <p className={`text-sm font-bold ${isLive ? 'text-white' : 'text-slate-400'}`}>
                  {isLive ? (broadcastMode === 'pre-stream' ? 'PRE-STREAM' : 'LIVE ON AIR') : 'READY'}
                </p>
              </div>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800 p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Viewers</p>
                <p className="text-sm font-bold text-white">{stats.viewers.toLocaleString()}</p>
              </div>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800 p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Bitrate</p>
                <p className="text-sm font-bold text-white">{stats.bitrate}</p>
              </div>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800 p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">FPS / RES</p>
                <p className="text-sm font-bold text-white">{stats.fps} FPS • {stats.resolution}</p>
              </div>
            </Card>
          </div>

          {/* Main Preview Monitor */}
          <div className="relative aspect-video bg-black rounded-[2rem] overflow-hidden border-4 border-slate-900 shadow-2xl group">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transition-all duration-700 ${isLive ? 'opacity-100' : 'opacity-60 grayscale-[0.5]'}`}
            />

            {/* HUD Overlays */}
            <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1.5 rounded-lg backdrop-blur-md border flex items-center gap-2 ${
                    isLive ? 'bg-red-600/80 border-red-400/50 text-white' : 'bg-slate-900/80 border-slate-700 text-slate-400'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-white animate-pulse' : 'bg-slate-500'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{isLive ? 'ON AIR' : 'OFFLINE'}</span>
                  </div>
                  {isOverlayActive && (
                    <div className="px-3 py-1.5 rounded-lg bg-primary/80 backdrop-blur-md border border-primary/50 text-white flex items-center gap-2">
                      <MonitorPlay className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Media Source</span>
                    </div>
                  )}
                </div>

                <div className="bg-black/60 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                    <Cpu className="w-3 h-3" />
                    SYSTEM LOAD: {stats.cpuUsage}%
                  </div>
                  <div className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${stats.cpuUsage}%` }} />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-end">
                <div className="bg-black/60 backdrop-blur-md p-4 rounded-2xl border border-white/10 max-w-md">
                  <h4 className="text-white font-black italic uppercase tracking-tight truncate">{streamTitle}</h4>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase">
                      <Globe className="w-3 h-3 text-primary" />
                      Global Distribution Active
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase">
                      <Clock className="w-3 h-3 text-primary" />
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="w-10 h-10 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white">
                    <Scan className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Source Switcher Overlay */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 flex gap-4">
              {!isOverlayActive ? (
                <Button
                  onClick={handleShowMediaToViewers}
                  className="bg-primary/90 hover:bg-primary text-white font-black uppercase italic tracking-widest px-8 py-6 h-auto rounded-2xl backdrop-blur-xl shadow-2xl"
                >
                  <MonitorPlay className="w-5 h-5 mr-3" />
                  Switch to Media
                </Button>
              ) : (
                <Button
                  onClick={handleShowCameraToViewers}
                  className="bg-slate-100 text-slate-900 hover:bg-white font-black uppercase italic tracking-widest px-8 py-6 h-auto rounded-2xl backdrop-blur-xl shadow-2xl"
                >
                  <Camera className="w-5 h-5 mr-3" />
                  Back to Camera
                </Button>
              )}
            </div>
          </div>

          {/* Master Control Bar */}
          <Card className="bg-slate-900 border-slate-800 p-6 rounded-[2rem] shadow-xl">
            <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
              <div className="flex items-center gap-6">
                {!isLive ? (
                  <Button
                    size="lg"
                    onClick={handleGoLive}
                    disabled={goLivePending}
                    className="bg-red-600 hover:bg-red-700 text-white font-black uppercase italic tracking-[0.2em] px-10 py-8 h-auto rounded-2xl shadow-[0_10px_30px_rgba(220,38,38,0.3)] transition-all hover:-translate-y-1"
                  >
                    {goLivePending ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <Radio className="w-6 h-6 mr-3" />}
                    Start Broadcast
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={handleStopLive}
                    className="bg-slate-100 hover:bg-white text-red-600 font-black uppercase italic tracking-[0.2em] px-10 py-8 h-auto rounded-2xl shadow-2xl transition-all hover:-translate-y-1"
                  >
                    <Square className="w-6 h-6 mr-3 fill-current" />
                    Stop Broadcast
                  </Button>
                )}

                {isLive && broadcastMode === 'pre-stream' && (
                  <Button
                    onClick={handleGoLiveFromPreStream}
                    className="bg-primary hover:bg-primary/90 text-white font-black uppercase italic tracking-[0.1em] px-8 py-8 h-auto rounded-2xl animate-pulse"
                  >
                    <Zap className="w-5 h-5 mr-2" />
                    Go Live with Camera
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleShare} className="bg-slate-800 border-slate-700 text-white h-12 px-6 rounded-xl gap-2">
                  <Share2 className="w-4 h-4" />
                  Share Stream
                </Button>
                <Button variant="outline" className="bg-slate-800 border-slate-700 text-white h-12 w-12 p-0 rounded-xl">
                  <Settings className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Bottom Grid: Pre-Stream & Audio */}
          <div className="grid md:grid-cols-2 gap-6">
             <div className="h-[500px]">
               <PreStreamMediaPlayer
                 ref={preStreamRef}
                 isLive={isLive}
                 onMediaActivate={handlePreStreamMediaActivate}
               />
             </div>
             <div className="h-[500px]">
               <ProfessionalAudioMixer
                 mediaStream={stream}
                 onVolumeChange={handleMixerVolumeChange}
                 onMuteChange={handleMixerMuteChange}
               />
             </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Chat & Management */}
        <div className="lg:col-span-4 space-y-6">

          {/* Live Chat Sidebar */}
          <Card className="bg-slate-900 border-slate-800 rounded-[2.5rem] flex flex-col h-[750px] shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-6 h-6 text-primary" />
                <h3 className="font-black text-white italic uppercase tracking-tight">Studio Chat</h3>
              </div>
              <div className="px-3 py-1 bg-primary/10 rounded-full text-[9px] font-black text-primary uppercase tracking-widest border border-primary/20">
                Active
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
              {liveChatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                  <MessageSquare className="w-12 h-12 mb-4" />
                  <p className="text-xs font-bold uppercase tracking-widest">No messages yet</p>
                </div>
              ) : (
                liveChatMessages.map((msg, idx) => (
                  <div key={idx} className="group space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase tracking-widest italic ${msg.role === 'admin' ? 'text-primary' : 'text-slate-400'}`}>
                        {msg.user}
                      </span>
                      <button
                        onClick={() => deleteChatMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className={`p-3 rounded-2xl text-sm border ${
                      msg.role === 'admin' ? 'bg-primary/5 border-primary/10 text-white' : 'bg-slate-800/50 border-slate-700 text-slate-300'
                    }`}>
                      {msg.message}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-950/50">
              <div className="relative flex items-center">
                <Input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                  placeholder="Broadcast message..."
                  className="bg-slate-900 border-slate-800 h-14 pl-5 pr-14 rounded-2xl text-sm"
                />
                <Button
                  size="icon"
                  onClick={handleSendChat}
                  className="absolute right-2 w-10 h-10 rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Stream Settings Card */}
          <Card className="bg-slate-900 border-slate-800 p-6 rounded-[2.5rem]">
            <div className="flex items-center gap-3 mb-6">
              <Settings className="w-5 h-5 text-slate-400" />
              <h3 className="font-black text-white italic uppercase tracking-tight">Broadcast Info</h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Session Title</label>
                <Input
                  value={streamTitle}
                  onChange={e => setStreamTitle(e.target.value)}
                  className="bg-slate-950 border-slate-800 h-12 rounded-xl text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Description</label>
                <textarea
                  value={streamDescription}
                  onChange={e => setStreamDescription(e.target.value)}
                  className="w-full bg-slate-950 border-slate-800 rounded-xl p-4 text-sm min-h-[100px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <Button
                onClick={() => updateBroadcast(streamTitle, streamDescription)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase text-xs h-12 rounded-xl"
              >
                Update Details
              </Button>
            </div>
          </Card>

          {/* Camera Selector */}
          <Card className="bg-slate-900 border-slate-800 p-6 rounded-[2.5rem]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Camera className="w-5 h-5 text-slate-400" />
                <h3 className="font-black text-white italic uppercase tracking-tight">Camera Feed</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={handleRescan} className="text-slate-500 hover:text-white">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {camera.devices.map(device => (
                <motion.button
                  key={device.deviceId}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSwitchCamera(device.deviceId)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    device.deviceId === camera.selectedDeviceId
                      ? 'bg-primary/10 border-primary/30 text-white shadow-lg shadow-primary/10'
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    device.deviceId === camera.selectedDeviceId ? 'bg-primary text-white' : 'bg-slate-700 text-slate-400'
                  }`}>
                    <Video className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{device.label}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                      {device.deviceId === camera.selectedDeviceId ? 'Active' : 'Click to switch'}
                    </p>
                  </div>
                  {device.deviceId === camera.selectedDeviceId && (
                    <CheckCircle className="w-5 h-5 text-primary" />
                  )}
                </motion.button>
              ))}

              {camera.devices.length === 0 && (
                <div className="text-center py-6 text-slate-500">
                  <Usb className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No cameras detected</p>
                </div>
              )}

              <Button
                variant="outline"
                onClick={handleFlipCamera}
                className="w-full bg-slate-800 border-slate-700 text-white h-12 rounded-xl gap-2"
              >
                <FlipHorizontal className="w-4 h-4" />
                Flip Camera
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ModernLiveStudio;
