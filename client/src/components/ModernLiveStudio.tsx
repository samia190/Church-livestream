import React, { useRef, useState, useEffect, useCallback } from 'react';
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
  const { data: connectedPlatforms, refetch: refetchPlatforms, isLoading: platformsLoading, error: platformsError } = trpc.streaming.getPlatforms.useQuery();
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

  // Audio mixer state
  const mixerRef = useRef<any>(null);
  const [mixerProcessedStream, setMixerProcessedStream] = useState<MediaStream | null>(null);
  const [preStreamAudioStream, setPreStreamAudioStream] = useState<MediaStream | null>(null);
  const [broadcastAudioReady, setBroadcastAudioReady] = useState(false);

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
    updateMixerAudio,
    chatMessages: liveChatMessages,
    sendChatMessage,
    deleteChatMessage
  } = useBroadcaster();

  const { mutateAsync: goLiveMutation, isPending: goLivePending } = trpc.streaming.goLive.useMutation();
  const { mutateAsync: startMultiPlatformBroadcastMutation } = trpc.streaming.startMultiPlatformBroadcast.useMutation();
  const { mutateAsync: stopMultiPlatformBroadcastMutation } = trpc.streaming.stopMultiPlatformBroadcast.useMutation();
  const { mutateAsync: endLiveMutation } = trpc.streaming.endLive.useMutation();
  const [externalBroadcastId, setExternalBroadcastId] = useState<string | null>(null);

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

  // When mixer produces a new processed stream, update the broadcaster's audio
  useEffect(() => {
    if (isLive && mixerProcessedStream && broadcastAudioReady) {
      updateMixerAudio(mixerProcessedStream);
    }
  }, [mixerProcessedStream, isLive, broadcastAudioReady, updateMixerAudio]);

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

      const platforms = (connectedPlatforms ?? []).map(platform => platform.platform) as Array<'youtube' | 'facebook' | 'instagram' | 'tiktok' | 'twitter' | 'twitch'>;
      if (platforms.length > 0) {
        const external = await startMultiPlatformBroadcastMutation({
          title: streamTitle,
          description: streamDescription,
          platforms,
        });
        setExternalBroadcastId(external.broadcastId ?? null);
      }

      let initialStream = stream;
      let initialMode: 'live' | 'pre-stream' = 'live';

      if (activeOverlayStream) {
        initialStream = activeOverlayStream;
        initialMode = 'pre-stream';
        setOverlaySource('media');
        setIsOverlayActive(true);
      }

      // Pass the mixer-processed stream so the broadcaster uses it as the audio source
      startBroadcast(initialStream, {
        sessionId: result.sessionId,
        title: streamTitle,
        description: streamDescription,
        initialMode,
        originalCameraStream: stream,
        mixerProcessedStream: mixerProcessedStream,
      });

      setIsLive(true);
      setBroadcastAudioReady(true);
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
    setBroadcastAudioReady(false);
    setPreStreamAudioStream(null);
    if (externalBroadcastId) {
      try {
        await stopMultiPlatformBroadcastMutation({ broadcastId: externalBroadcastId });
      } catch (err) {
        toast.error('External platform broadcast could not be stopped');
      }
    }
    if (sessionId !== null) {
      try {
        await endLiveMutation({ sessionId });
      } catch (err) {
        toast.error('Live session status could not be updated');
      }
    }
    setExternalBroadcastId(null);
    setSessionId(null);
    toast.success('Broadcast ended');
  };

  const handleAddPlatform = async () => {
    const platform = window.prompt('Platform (youtube or instagram)', 'youtube')?.trim().toLowerCase();
    if (platform !== 'youtube' && platform !== 'instagram') {
      toast.error('Only YouTube and Instagram are currently supported by the Restream event API');
      return;
    }
    const accountName = window.prompt('Account name');
    const accessToken = window.prompt('Provider access token');
    if (!accountName || !accessToken) return;
    try {
      await addPlatformMutation({ platform, accountName, accessToken });
      await refetchPlatforms();
      toast.success(`${platform} connected`);
    } catch {
      toast.error(`Unable to connect ${platform}`);
    }
  };

  const handleRemovePlatform = async (id: string) => {
    try {
      await removePlatformMutation({ id });
      await refetchPlatforms();
      toast.success('Platform disconnected');
    } catch {
      toast.error('Unable to disconnect platform');
    }
  };

  /**
   * Switch viewers to see pre-stream media (video only).
   * Audio remains from the mixer — NO audio collision possible.
   */
  const handleShowMediaToViewers = async () => {
    if (!preStreamRef.current) return;
    const mediaStream = await preStreamRef.current.captureStream();
    if (!mediaStream) {
      toast.error('Start playing media first');
      return;
    }

    // Extract VIDEO track only — audio is handled by the mixer
    const videoTrack = mediaStream.getVideoTracks()[0];
    const audioTrack = mediaStream.getAudioTracks()[0];

    // Create a video-only stream for the overlay preview
    const videoOnlyStream = new MediaStream();
    if (videoTrack) videoOnlyStream.addTrack(videoTrack);
    setActiveOverlayStream(videoOnlyStream);
    setIsOverlayActive(true);
    setOverlaySource('media');

    // Route the pre-stream AUDIO through the mixer (not directly to broadcast)
    if (audioTrack) {
      const audioStream = new MediaStream([audioTrack]);
      setPreStreamAudioStream(audioStream);
      toast.success('Switching to Media — video shows to viewers, audio routes through mixer');
    } else {
      setPreStreamAudioStream(null);
      toast.success('Switching to Media (no audio)');
    }

    if (isLive) {
      try {
        // replaceStream now ONLY replaces video — audio stays from mixer
        const videoOnlyForBroadcast = new MediaStream();
        if (videoTrack) videoOnlyForBroadcast.addTrack(videoTrack);
        // Add the mixer audio track so broadcast has both
        if (mixerProcessedStream) {
          const mixerAudio = mixerProcessedStream.getAudioTracks()[0];
          if (mixerAudio) videoOnlyForBroadcast.addTrack(mixerAudio);
        }
        await replaceStream(videoOnlyForBroadcast);
      } catch (err) {
        toast.error('Failed to switch to media');
      }
    }
  };

  /**
   * Switch viewers back to camera (video only).
   * Audio remains from the mixer — no raw camera audio replacement.
   */
  const handleShowCameraToViewers = async () => {
    if (!stream) return;
    setActiveOverlayStream(null);
    setIsOverlayActive(false);
    setOverlaySource('camera');
    setPreStreamAudioStream(null);

    if (isLive) {
      try {
        // Create a combined stream with camera video + mixer audio
        const broadcastStream = new MediaStream();
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) broadcastStream.addTrack(videoTrack);
        if (mixerProcessedStream) {
          const mixerAudio = mixerProcessedStream.getAudioTracks()[0];
          if (mixerAudio) broadcastStream.addTrack(mixerAudio);
        }
        await replaceStream(broadcastStream);
        toast.success('Switching to Camera — audio stays from mixer');
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
      setPreStreamAudioStream(null);
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

  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>("default");

  // Enumerate microphone devices
  useEffect(() => {
    async function listMics() {
      try {
        // Request permission first so labels are populated
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tempStream.getTracks().forEach(t => t.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAvailableMics(devices.filter(d => d.kind === 'audioinput'));
      } catch (err) {
        console.warn('Could not enumerate mic devices:', err);
      }
    }
    listMics();
  }, []);

  /**
   * Switch microphone device via the mixer.
   * The mixer handles the audio graph re-wiring.
   * We just update the video preview with the new video track.
   */
  const handleSwitchMicrophone = useCallback(async (deviceId: string) => {
    setSelectedMicId(deviceId);
    if (mixerRef.current) {
      const newMicStream = await mixerRef.current.switchMicrophone(deviceId);
      if (newMicStream && stream) {
        // Create a combined stream: camera video + new mic audio
        const combined = new MediaStream();
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) combined.addTrack(videoTrack);
        newMicStream.getAudioTracks().forEach((t: MediaStreamTrack) => combined.addTrack(t));
        if (videoRef.current) videoRef.current.srcObject = combined;
      }
    }
    toast.success('Microphone device switched');
  }, [stream]);

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

  const [monitorMuted, setMonitorMuted] = useState(false);

  const handleMixerMuteChange = useCallback((trackId: string, muted: boolean) => {
    toast.success(`${trackId} ${muted ? 'muted' : 'unmuted'}`);
  }, []);

  const handleMixerVolumeChange = useCallback((trackId: string, volume: number) => {
    // Volume is handled by the audio graph internally
  }, []);

  /**
   * Handle mixer output stream — this is the UNIVERSAL processed audio.
   * When live, the broadcaster's updateMixerAudio will replace audio tracks on peers.
   */
  const handleMixerProcessedStream = useCallback((processedStream: MediaStream | null) => {
    setMixerProcessedStream(processedStream);
    // The useEffect above will call updateMixerAudio when isLive && broadcastAudioReady
  }, []);

  const handleMonitorMuteChange = useCallback((muted: boolean) => {
    setMonitorMuted(muted);
    toast.info(muted ? 'Monitor muted — viewers still hear full audio' : 'Monitor unmuted — you hear the processed audio');
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
    <div className="min-h-screen bg-slate-950 text-slate-200 p-3 sm:p-6 font-sans">
      <div className="max-w-[1600px] mx-auto grid lg:grid-cols-12 gap-3 sm:gap-6">

        {/* LEFT COLUMN: Controls & Preview */}
        <div className="lg:col-span-8 space-y-6">

          {/* Header Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
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
          <div className="relative aspect-video bg-black rounded-xl sm:rounded-[2rem] overflow-hidden border-2 sm:border-4 border-slate-900 shadow-2xl group">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Status overlay */}
            {isLive && (
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <div className="flex items-center gap-2 bg-red-600 px-3 py-1.5 rounded-lg shadow-lg">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-[10px] font-black uppercase text-white tracking-widest">
                    {broadcastMode === 'pre-stream' ? 'Pre-Stream' : 'LIVE'}
                  </span>
                </div>
              </div>
            )}

            {!stream && !activeOverlayStream && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
                <div className="text-center space-y-4">
                  <Camera className="w-16 h-16 mx-auto text-slate-700" />
                  <p className="text-slate-500 text-sm">Camera not available</p>
                </div>
              </div>
            )}
          </div>

          {/* Go Live / Control Buttons */}
          <Card className="bg-slate-900 border-slate-800 p-4 rounded-xl sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {!isLive ? (
                  <Button
                    onClick={handleGoLive}
                    disabled={goLivePending}
                    className="bg-red-600 hover:bg-red-700 text-white font-black uppercase italic tracking-[0.2em] px-10 py-8 h-auto rounded-2xl shadow-2xl transition-all hover:-translate-y-1"
                  >
                    {goLivePending ? <Loader2 className="w-6 h-6 mr-3 animate-spin" /> : <Radio className="w-6 h-6 mr-3" />}
                    {goLivePending ? 'Going Live...' : 'Go Live'}
                  </Button>
                ) : (
                  <Button
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
                <Button variant="outline" onClick={() => document.getElementById('broadcast-settings')?.scrollIntoView({ behavior: 'smooth' })} className="bg-slate-800 border-slate-700 text-white h-12 w-12 p-0 rounded-xl" aria-label="Jump to broadcast settings">
                  <Settings className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Bottom Grid: Pre-Stream & Audio */}
          <div className="grid sm:grid-cols-2 gap-3 sm:gap-6">
             <div className="h-auto sm:h-[500px]">
               <PreStreamMediaPlayer
                 ref={preStreamRef}
                 isLive={isLive}
                 onMediaActivate={handlePreStreamMediaActivate}
                 onAudioCapture={setPreStreamAudioStream}
               />
             </div>
             <div className="h-auto sm:h-[500px]">
               <ProfessionalAudioMixer
                 ref={mixerRef}
                 mediaStream={stream}
                 preStreamAudioStream={preStreamAudioStream}
                 onVolumeChange={handleMixerVolumeChange}
                 onMuteChange={handleMixerMuteChange}
                 onProcessedStream={handleMixerProcessedStream}
                 onMonitorMuteChange={handleMonitorMuteChange}
                 onMicrophoneSwitch={(newStream) => {
                   if (newStream && stream) {
                     const combined = new MediaStream();
                     const videoTrack = stream.getVideoTracks()[0];
                     if (videoTrack) combined.addTrack(videoTrack);
                     newStream.getAudioTracks().forEach(t => combined.addTrack(t));
                     if (videoRef.current) videoRef.current.srcObject = combined;
                   }
                 }}
               />
             </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Chat & Management */}
        <div className="lg:col-span-4 space-y-6">

          {/* Live Chat Sidebar */}
          <Card className="bg-slate-900 border-slate-800 rounded-xl sm:rounded-[2.5rem] flex flex-col h-[500px] sm:h-[750px] shadow-2xl overflow-hidden">
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

          {/* Connected Platforms Card */}
          <Card className="bg-slate-900 border-slate-800 p-3 sm:p-6 rounded-xl sm:rounded-[2.5rem]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-black text-white italic uppercase tracking-tight">Connected Platforms</h3>
                <p className="text-[10px] text-slate-500 mt-1">Destinations used when you go live</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => refetchPlatforms()} className="text-slate-400"><RefreshCw className="w-4 h-4" /></Button>
                <Button variant="outline" onClick={handleAddPlatform} disabled={addPlatformPending} className="bg-slate-800 border-slate-700 text-white">{addPlatformPending ? 'Connecting…' : 'Add platform'}</Button>
              </div>
            </div>
            {platformsLoading ? (
              <p className="text-sm text-slate-500 py-4">Loading connected platforms…</p>
            ) : platformsError ? (
              <p className="text-sm text-red-400 py-4">Unable to load platforms. Check administrator access and try again.</p>
            ) : !connectedPlatforms?.length ? (
              <p className="text-sm text-slate-500 py-4">No platforms connected. Add YouTube or Instagram before starting an external broadcast.</p>
            ) : (
              <div className="space-y-2">
                {connectedPlatforms.map((platform: any) => (
                  <div key={platform._id} className="flex items-center justify-between rounded-xl bg-slate-950 border border-slate-800 px-4 py-3">
                    <div><p className="text-sm font-bold text-white capitalize">{platform.platform}</p><p className="text-xs text-slate-500">{platform.accountName}</p></div>
                    <Button variant="ghost" size="sm" onClick={() => handleRemovePlatform(platform._id)} className="text-red-400 hover:text-red-300">Disconnect</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Stream Settings Card */}
          <Card id="broadcast-settings" className="bg-slate-900 border-slate-800 p-3 sm:p-6 rounded-xl sm:rounded-[2.5rem]">
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
          <Card className="bg-slate-900 border-slate-800 p-3 sm:p-6 rounded-xl sm:rounded-[2.5rem]">
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

          {/* Microphone Selector */}
          <Card className="bg-slate-900 border-slate-800 p-3 sm:p-6 rounded-xl sm:rounded-[2.5rem]">
            <div className="flex items-center gap-3 mb-6">
              <Mic className="w-5 h-5 text-slate-400" />
              <h3 className="font-black text-white italic uppercase tracking-tight">Microphone</h3>
            </div>

            <div className="space-y-3">
              {availableMics.map(device => (
                <motion.button
                  key={device.deviceId}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSwitchMicrophone(device.deviceId)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    device.deviceId === selectedMicId
                      ? 'bg-green-500/10 border-green-500/30 text-white shadow-lg shadow-green-900/10'
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    device.deviceId === selectedMicId ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-400'
                  }`}>
                    <Mic className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{device.label || 'Unknown Microphone'}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                      {device.deviceId === selectedMicId ? 'Active' : 'Click to switch'}
                    </p>
                  </div>
                  {device.deviceId === selectedMicId && (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  )}
                </motion.button>
              ))}

              {availableMics.length === 0 && (
                <div className="text-center py-6 text-slate-500">
                  <Mic className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No microphones detected</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ModernLiveStudio;
