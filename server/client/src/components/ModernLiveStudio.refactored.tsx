import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import ProfessionalAudioMixer from './ProfessionalAudioMixer';
import PreStreamMediaPlayer from './PreStreamMediaPlayer';
import StreamAnalyticsEnhanced from './StreamAnalyticsEnhanced';
import {
  Video, Mic, Settings, MessageSquare, Radio, Camera, Volume2,
  Eye, Zap, AlertCircle, CheckCircle, Plus, X, Send,
  Square, RefreshCw, FlipHorizontal, Usb, Loader2, Scan,
  Monitor, Wifi, WifiOff, Film, Play, Pause, ChevronDown, ChevronUp
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
}

export const ModernLiveStudio: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLive, setIsLive] = useState(false);
  const camera = useCameraDevices();
  const stream = camera.stream;

  // Section visibility state (all sections remain mounted)
  const [expandedSections, setExpandedSections] = useState<SectionState>({
    cameras: true,
    preStream: true,
    audio: true,
    chat: true,
    settings: true,
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
    bitrate: '5.2 Mbps',
    fps: 60,
    resolution: '1080p',
    cpuUsage: 45,
    dropped: 0,
  });

  // Pre-stream media
  const [showPreStream, setShowPreStream] = useState(false);

  // Initialize camera on mount
  useEffect(() => {
    camera.start().catch(() => {
      toast.error('Failed to access camera — check browser permissions');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the local preview element in sync
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const { viewerCount, streamStats, startBroadcast, stopBroadcast, updateBroadcast, updateLocalStream, connected: signalingConnected, chatMessages: liveChatMessages, sendChatMessage, deleteChatMessage } = useBroadcaster();

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
      toast.error('Camera is not ready yet — check camera permissions and try again');
      return;
    }

    try {
      const result = await goLiveMutation({
        title: streamTitle,
        description: streamDescription,
      });
      setSessionId(result.sessionId);
      peakViewersRef.current = 0;
      startBroadcast(stream, {
        sessionId: result.sessionId,
        title: streamTitle,
        description: streamDescription,
      });
      setIsLive(true);
      setShowPreStream(false);
      toast.success('🔴 LIVE NOW — anyone on Watch Live can see you');
    } catch (err) {
      console.error('Go live failed:', err);
      toast.error('Failed to go live. Check your connection and try again.');
    }
  };

  const handleStopLive = async () => {
    stopBroadcast();
    setIsLive(false);
    if (sessionId !== null) {
      try {
        await endLiveMutation({ sessionId });
      } catch (err) {
        console.error('Failed to mark session ended:', err);
      }
    }
    setSessionId(null);
    toast.success('Stream ended');
  };

  const handleSwitchCamera = async (deviceId: string) => {
    try {
      const newStream = await camera.switchToDevice(deviceId);
      if (isLive) updateLocalStream(newStream);
      toast.success('Camera switched');
    } catch (err) {
      console.error('Camera switch failed:', err);
      toast.error('Could not switch to that camera');
    }
  };

  const handleFlipCamera = async () => {
    const switchingTo = camera.facingMode === 'user' ? 'back' : 'front';
    try {
      const newStream = await camera.flipFacing();
      if (isLive) updateLocalStream(newStream);
      toast.success(`Switched to ${switchingTo} camera`);
    } catch (err) {
      console.error('Camera flip failed:', err);
      toast.error('Could not switch camera — this device may only have one');
    }
  };

  const handleRescan = async () => {
    await camera.refreshDevices(true);
    toast.success(`Scan complete — ${camera.devices.length} camera${camera.devices.length !== 1 ? 's' : ''} found`);
  };

  const handleTestConnection = async () => {
    if (!stream) {
      toast.error('Camera/microphone not ready — grant permission first');
      return;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const testWs = new WebSocket(`${protocol}//${window.location.host}/api/stream-sync`);
    const timeout = setTimeout(() => {
      testWs.close();
      toast.error('Could not reach the signaling server — check your connection');
    }, 4000);
    testWs.onopen = () => {
      clearTimeout(timeout);
      toast.success('Camera and connection look good — ready to go live');
      testWs.close();
    };
    testWs.onerror = () => {
      clearTimeout(timeout);
      toast.error('Could not reach the signaling server — check your connection');
    };
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/watch-live`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Watch Live link copied to clipboard');
    } catch {
      toast.info(url);
    }
  };

  const handleConnectPlatform = async () => {
    if (!platformForm || !platformForm.accountName.trim() || !platformForm.accessToken.trim()) {
      toast.error('Enter an account name and access token / stream key');
      return;
    }
    try {
      await addPlatformMutation(platformForm);
      await refetchPlatforms();
      setPlatformForm(null);
      toast.success(`${platformForm.platform} connected`);
    } catch (err) {
      console.error('Platform connect failed:', err);
      toast.error('Failed to connect platform');
    }
  };

  const handleDisconnectPlatform = async (id: string, name: string) => {
    try {
      await removePlatformMutation({ id });
      await refetchPlatforms();
      toast.success(`${name} disconnected`);
    } catch (err) {
      console.error('Platform disconnect failed:', err);
      toast.error('Failed to disconnect platform');
    }
  };

  const handleSendChat = () => {
    if (!newMessage.trim()) return;
    sendChatMessage(newMessage, 'Admin');
    setNewMessage('');
  };

  const handleModerateChat = (messageId: string) => {
    deleteChatMessage(messageId);
    toast.success('Message removed');
  };

  const handlePreStreamMediaActivate = (mediaStream: MediaStream | null) => {
    if (mediaStream) {
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } else if (stream) {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    }
  };

  const toggleSection = (section: keyof SectionState) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Main Video Preview */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative"
      >
        <Card className="bg-black overflow-hidden">
          <div className="relative w-full aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Live Indicator */}
            {isLive && (
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-full flex items-center gap-2 font-bold z-10"
              >
                <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                LIVE
              </motion.div>
            )}

            {/* Pre-stream media indicator */}
            {showPreStream && !isLive && (
              <div className="absolute top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-full flex items-center gap-2 font-bold z-10">
                <Film className="w-4 h-4" />
                PRE-STREAM
              </div>
            )}

            {/* Signaling connection status */}
            <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/70 text-white px-3 py-1 rounded-full text-xs z-10">
              {signalingConnected ? (
                <><Wifi className="w-3 h-3 text-green-400" /> Connected</>
              ) : (
                <><WifiOff className="w-3 h-3 text-gray-400" /> Not connected</>
              )}
            </div>

            {/* Stats Overlay */}
            <div className="absolute bottom-4 left-4 space-y-2 text-white text-xs font-mono z-10">
              <div className="bg-black/70 px-3 py-1 rounded">
                {stats.resolution} @ {stats.fps}fps • {stats.bitrate}
              </div>
              <div className="bg-black/70 px-3 py-1 rounded">
                CPU: {stats.cpuUsage}% • Dropped: {stats.dropped}
              </div>
            </div>

            {/* Viewer Count */}
            <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded flex items-center gap-2 z-10">
              <Eye className="w-4 h-4" />
              {stats.viewers.toLocaleString()}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Single-Page Control Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ===== CAMERAS SECTION ===== */}
        <motion.div
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-4 glass-panel border-0">
            <button
              onClick={() => toggleSection('cameras')}
              className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
            >
              <h4 className="font-bold text-foreground flex items-center gap-2">
                <Camera className="w-4 h-4 text-ember" />
                Camera Management
              </h4>
              {expandedSections.cameras ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            <AnimatePresence>
              {expandedSections.cameras && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Usb className="w-3 h-3" />
                    USB webcams and HDMI capture cards appear below automatically once connected
                  </p>

                  {/* Real-time scanning animation */}
                  <AnimatePresence>
                    {camera.isScanning && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                          <div className="flex items-center gap-3 mb-3">
                            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                            <span className="text-sm font-semibold text-blue-300">
                              Scanning for devices...
                            </span>
                          </div>
                          <div className="h-2 bg-blue-900/30 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
                              initial={{ width: "0%" }}
                              animate={{ width: `${camera.scanProgress}%` }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Camera List */}
                  <div className="space-y-2">
                    {camera.devices.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {camera.isScanning ? 'Scanning...' : 'No cameras detected'}
                      </p>
                    ) : (
                      camera.devices.map(device => (
                        <div
                          key={device.deviceId}
                          className="p-3 bg-void/40 rounded-lg border border-border/40 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-signal" />
                            <div>
                              <p className="font-semibold text-foreground text-sm">{device.label}</p>
                              <p className="text-xs text-muted-foreground">Available</p>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleSwitchCamera(device.deviceId)}
                            variant="outline"
                            size="sm"
                          >
                            Select
                          </Button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Camera Controls */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleFlipCamera}
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                    >
                      <FlipHorizontal className="w-4 h-4" />
                      Flip Camera
                    </Button>
                    <Button
                      onClick={handleRescan}
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                    >
                      <Scan className="w-4 h-4" />
                      Scan Devices
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {camera.devices.length} camera{camera.devices.length !== 1 ? 's' : ''} detected
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        {/* ===== PRE-STREAM SECTION ===== */}
        <motion.div
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-4 glass-panel border-0">
            <button
              onClick={() => toggleSection('preStream')}
              className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
            >
              <h4 className="font-bold text-foreground flex items-center gap-2">
                <Film className="w-4 h-4 text-ember" />
                Pre-Stream Media
              </h4>
              {expandedSections.preStream ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            <AnimatePresence>
              {expandedSections.preStream && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <p className="text-xs text-muted-foreground">
                    Play videos, images, or music while waiting to go live. Upload files or add URLs.
                  </p>
                  <Button
                    variant={showPreStream ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowPreStream(!showPreStream)}
                    className={showPreStream ? "bg-ember text-ember-foreground w-full" : "w-full"}
                  >
                    {showPreStream ? (
                      <><Pause className="w-3 h-3 mr-1" /> Hide Preview</>
                    ) : (
                      <><Play className="w-3 h-3 mr-1" /> Show in Preview</>
                    )}
                  </Button>

                  <PreStreamMediaPlayer
                    onMediaActivate={handlePreStreamMediaActivate}
                    isLive={isLive}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        {/* ===== AUDIO SECTION ===== */}
        <motion.div
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-4 glass-panel border-0">
            <button
              onClick={() => toggleSection('audio')}
              className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
            >
              <h4 className="font-bold text-foreground flex items-center gap-2">
                <Mic className="w-4 h-4 text-ember" />
                Audio Mixer
              </h4>
              {expandedSections.audio ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            <AnimatePresence>
              {expandedSections.audio && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <ProfessionalAudioMixer
                    mediaStream={stream}
                    onVolumeChange={(trackId, volume) => {
                      toast.success(`${trackId} volume: ${volume}%`);
                    }}
                    onMuteChange={(trackId, muted) => {
                      toast.success(`${trackId} ${muted ? 'muted' : 'unmuted'}`);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        {/* ===== CHAT SECTION ===== */}
        <motion.div
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-4 bg-gradient-to-br from-pink-500/10 to-pink-600/10 border-pink-500/20">
            <button
              onClick={() => toggleSection('chat')}
              className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
            >
              <h4 className="font-bold text-foreground flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Live Chat
              </h4>
              {expandedSections.chat ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            <AnimatePresence>
              {expandedSections.chat && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  {/* Chat Messages */}
                  <div className="bg-slate-900/50 rounded border border-slate-700 h-64 overflow-y-auto p-3 space-y-2">
                    {liveChatMessages.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">No messages yet</p>
                    )}
                    {liveChatMessages.map(msg => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start justify-between gap-2 p-2 hover:bg-slate-800/50 rounded"
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold ${msg.role === 'admin' ? 'text-amber-400' : 'text-blue-400'}`}>
                            {msg.user} {msg.role === 'admin' && '(Admin)'}
                          </p>
                          <p className="text-sm text-foreground break-words">{msg.message}</p>
                        </div>
                        <Button
                          onClick={() => handleModerateChat(msg.id)}
                          size="sm"
                          variant="ghost"
                          className="flex-shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </motion.div>
                    ))}
                  </div>

                  {/* Send Message */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Send message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                    />
                    <Button onClick={handleSendChat} size="sm">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        {/* ===== SETTINGS SECTION ===== */}
        <motion.div
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2"
        >
          <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-500/20">
            <button
              onClick={() => toggleSection('settings')}
              className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
            >
              <h4 className="font-bold text-foreground flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Stream Settings
              </h4>
              {expandedSections.settings ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            <AnimatePresence>
              {expandedSections.settings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-foreground mb-2 block">Stream Title</label>
                      <div className="flex gap-2">
                        <Input
                          value={streamTitle}
                          onChange={(e) => setStreamTitle(e.target.value)}
                          placeholder="Enter stream title..."
                        />
                        {isLive && (
                          <Button size="sm" onClick={() => updateBroadcast(streamTitle, streamDescription)}>
                            Update
                          </Button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-foreground mb-2 block">Description</label>
                      <div className="flex gap-2">
                        <Input
                          value={streamDescription}
                          onChange={(e) => setStreamDescription(e.target.value)}
                          placeholder="Enter stream description..."
                        />
                        {isLive && (
                          <Button size="sm" onClick={() => updateBroadcast(streamTitle, streamDescription)}>
                            Update
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-foreground mb-2 block">Quality</label>
                      <select className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded">
                        <option>1080p (Full HD)</option>
                        <option>720p (HD)</option>
                        <option>480p (SD)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-foreground mb-2 block">Bitrate</label>
                      <select className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded">
                        <option>6 Mbps</option>
                        <option>8 Mbps</option>
                        <option>10 Mbps</option>
                      </select>
                    </div>
                  </div>

                  {/* Analytics */}
                  <StreamAnalyticsEnhanced
                    isLive={isLive}
                    sessionData={{
                      sessionId: sessionId ? String(sessionId) : '',
                      isLive,
                      startTime: Date.now(),
                      currentViewers: stats.viewers,
                      peakViewers: Math.max(stats.viewers, peakViewersRef.current),
                      totalViews: stats.viewers,
                      bitrate: parseFloat(stats.bitrate),
                      fps: stats.fps,
                      cpuUsage: stats.cpuUsage,
                      droppedFrames: stats.dropped,
                      resolution: stats.resolution,
                      platforms: (connectedPlatforms ?? []).map((p: any) => p.platform),
                    }}
                  />

                  {/* Platforms */}
                  <div className="border-t border-border/40 pt-4">
                    <h5 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Radio className="w-4 h-4 text-ember" />
                      Broadcast Platforms
                    </h5>
                    <p className="text-xs text-muted-foreground mb-4">
                      Connections are saved to the database. Streaming to these platforms additionally requires a Restream.io account or similar configured on the server.
                    </p>

                    <div className="space-y-2 mb-4">
                      {(connectedPlatforms ?? []).length === 0 && (
                        <p className="text-sm text-muted-foreground">No platforms connected yet.</p>
                      )}
                      {(connectedPlatforms ?? []).map((p: any) => (
                        <div
                          key={p._id}
                          className="p-3 bg-void/40 rounded-lg border border-border/40 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-signal" />
                            <div>
                              <p className="font-semibold text-foreground capitalize">{p.platform}</p>
                              <p className="text-xs text-muted-foreground">{p.accountName}</p>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleDisconnectPlatform(p._id, p.platform)}
                            variant="outline"
                            size="sm"
                          >
                            Disconnect
                          </Button>
                        </div>
                      ))}
                    </div>

                    {platformForm ? (
                      <div className="p-4 rounded-lg border border-border/60 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          {(['youtube', 'facebook', 'instagram', 'tiktok', 'twitter', 'twitch'] as const).map(p => (
                            <button
                              key={p}
                              onClick={() => setPlatformForm({ ...platformForm, platform: p })}
                              className={`px-3 py-2 rounded-lg border text-sm capitalize transition-colors ${
                                platformForm.platform === p
                                  ? 'border-ember bg-ember/10 text-ember'
                                  : 'border-border text-muted-foreground hover:border-primary/50'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                        <Input
                          placeholder="Account name (e.g. your channel name)"
                          value={platformForm.accountName}
                          onChange={e => setPlatformForm({ ...platformForm, accountName: e.target.value })}
                        />
                        <Input
                          placeholder="Access token / stream key"
                          type="password"
                          value={platformForm.accessToken}
                          onChange={e => setPlatformForm({ ...platformForm, accessToken: e.target.value })}
                        />
                        <div className="flex gap-2">
                          <Button onClick={handleConnectPlatform} disabled={addPlatformPending} className="bg-ember hover:bg-ember/90 text-ember-foreground">
                            {addPlatformPending ? 'Connecting...' : 'Save Connection'}
                          </Button>
                          <Button variant="outline" onClick={() => setPlatformForm(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full gap-2 border-primary/50"
                        onClick={() => setPlatformForm({ platform: 'youtube', accountName: '', accessToken: '' })}
                      >
                        <Plus className="w-4 h-4" />
                        Connect a Platform
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 sticky bottom-0 bg-background/95 backdrop-blur p-4 rounded-lg border border-border">
        {!isLive ? (
          <>
            <Button
              onClick={handleGoLive}
              disabled={goLivePending || !stream}
              className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 gap-2 py-6 text-lg disabled:opacity-50"
            >
              <Radio className="w-5 h-5" />
              {goLivePending ? 'GOING LIVE...' : 'GO LIVE'}
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleTestConnection}>
              <Zap className="w-4 h-4" />
              Test Stream
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={handleStopLive}
              variant="destructive"
              className="flex-1 gap-2 py-6 text-lg"
            >
              <Square className="w-5 h-5" />
              STOP LIVE
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleShare}>
              <Send className="w-4 h-4" />
              Share
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
