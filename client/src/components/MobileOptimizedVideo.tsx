/**
 * MobileOptimizedVideo.tsx
 *
 * ============================================================
 * VIEWER-SIDE MEDIA PLAYBACK
 * ============================================================
 *
 * The native video element is the authoritative audio and video path. This
 * keeps remote microphone and pre-stream audio together and avoids a second
 * suspended AudioContext silently swallowing sound. The volume control is
 * capped at the browser media-element range. When LiveKit reports that the
 * browser needs a user gesture, Watch Live supplies an explicit audio-unlock
 * action through Room.startAudio().
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2, Wifi, WifiOff, RefreshCw, Volume } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MobileOptimizedVideoProps {
  stream: MediaStream | null;
  isLive: boolean;
  broadcastMode: 'offline' | 'pre-stream' | 'live';
  connectionState: string;
  networkQuality: string;
  onReconnect?: () => void;
  onStartAudio?: () => Promise<void>;
  audioPlaybackBlocked?: boolean;
}

export default function MobileOptimizedVideo({
  stream,
  isLive,
  broadcastMode,
  connectionState,
  networkQuality,
  onReconnect,
  onStartAudio,
  audioPlaybackBlocked = false,
}: MobileOptimizedVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [needsTapToPlay, setNeedsTapToPlay] = useState(false);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Web Audio API for Viewer Audio Boost ──────────────────────────────────
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(100);
  const isAudioGraphConnectedRef = useRef(false);

  /**
   * Initialize Web Audio API graph for viewer audio boost.
   * Creates: MediaStreamSource → GainNode → AudioContext.destination
   */
  const initAudioBoost = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const ctx = audioContextRef.current!;

    // Resume context if suspended (browser policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    if (!gainNodeRef.current) {
      gainNodeRef.current = ctx.createGain();
      gainNodeRef.current.gain.value = volumeLevel / 100;
    }

    return { ctx, gain: gainNodeRef.current };
  }, [volumeLevel]);

  /**
   * Connect incoming WebRTC audio track to the Web Audio API boost pipeline.
   */
  const connectAudioBoost = useCallback(() => {
    if (!stream) return;

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      console.log("[Video] No audio track in stream");
      return;
    }

    const { ctx, gain } = initAudioBoost();

    // Disconnect old source if exists
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch (e) {}
    }

    try {
      // Create source from the WebRTC audio track
      const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
      sourceNodeRef.current = source;

      // Wire: source → gain → destination
      source.connect(gain);
      gain.connect(ctx.destination);

      isAudioGraphConnectedRef.current = true;
      console.log(`[Video] Audio boost connected at ${volumeLevel}% gain`);
    } catch (err) {
      console.error("[Video] Audio boost connection failed:", err);
    }
  }, [stream, initAudioBoost, volumeLevel]);

  // Disconnect audio boost when stream changes or unmounts
  const disconnectAudioBoost = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch (e) {}
    }
    isAudioGraphConnectedRef.current = false;
  }, []);

  // Use the media element as the authoritative playback path. This avoids
  // silent sessions when a browser suspends a secondary AudioContext graph.
  useEffect(() => {
    if (!videoRef.current || !stream) {
      disconnectAudioBoost();
      return;
    }
    const video = videoRef.current;
    video.srcObject = stream;
    video.muted = muted;
    video.volume = Math.min(1, volumeLevel / 100);
    video.play().then(() => setNeedsTapToPlay(false)).catch(() => setNeedsTapToPlay(true));
  }, [stream, muted, volumeLevel, disconnectAudioBoost]);

  // Update gain when volume level changes
  useEffect(() => {
    if (gainNodeRef.current && audioContextRef.current) {
      const targetGain = muted ? 0 : volumeLevel / 100;
      const now = audioContextRef.current.currentTime;
      // Smooth transition to avoid clicks/pops
      gainNodeRef.current.gain.setTargetAtTime(targetGain, now, 0.05);
    }
  }, [volumeLevel, muted]);

  // ── Auto-hide controls after inactivity ───────────────────────────────────
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    hideControlsTimer.current = setTimeout(() => {
      if (!isFullscreen) {
        setShowControls(false);
      }
    }, 4000);
  }, [isFullscreen]);

  // ── Show controls when video is playing ───────────────────────────────────
  useEffect(() => {
    if (stream) {
      setShowControls(true);
      hideControlsTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 4000);
    }
    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
    };
  }, [stream]);

  // ── Handle fullscreen changes ─────────────────────────────────────────────
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ── Connect stream to video element — with robust autoplay handling ───────
  useEffect(() => {
    if (videoRef.current && stream) {
      const video = videoRef.current;
      video.srcObject = stream;

      // Prefer audible native playback. If the browser blocks it, the overlay
      // asks the viewer for one explicit gesture and then retries.
      video.muted = muted;
      video.volume = Math.min(1, volumeLevel / 100);
      video.autoplay = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('x5-playsinline', 'true');

      // Attempt immediate playback
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setNeedsTapToPlay(false);
        }).catch(error => {
          console.log("[Video] Autoplay prevented, showing tap-to-play overlay", error);
          setNeedsTapToPlay(true);
        });
      }
    }
  }, [stream]);

  // ── Retry play when needed ────────────────────────────────────────────────
  useEffect(() => {
    if (!needsTapToPlay && videoRef.current && stream) {
      videoRef.current.play().catch(() => {});
    }
  }, [needsTapToPlay, stream]);

  const handleTap = () => {
    resetHideTimer();
    if (videoRef.current && stream) {
      setMuted(false);
      videoRef.current.muted = false;
      videoRef.current.volume = Math.min(1, volumeLevel / 100);
      videoRef.current.play().then(() => setNeedsTapToPlay(false)).catch(() => {});
    }
  };

  const handleDoubleTap = useCallback(() => {
    toggleFullscreen();
  }, []);

  /**
   * Toggle native media-element mute/unmute. Browsers may require one
   * explicit gesture before audible autoplay is allowed.
   */
  const toggleMute = () => {
      setMuted(prev => {
        const newMuted = !prev;
        if (videoRef.current) videoRef.current.muted = newMuted;
        return newMuted;
      });
  };

  /**
   * Handle the native media-element volume slider (0%–100%).
   */
  const handleVolumeChange = useCallback((value: number) => {
    setVolumeLevel(value);
    if (videoRef.current) videoRef.current.volume = Math.min(1, value / 100);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await containerRef.current.requestFullscreen();
      }
    } catch (err) {
      console.log('Fullscreen not supported:', err);
    }
  };

  const getNetworkIcon = () => {
    switch (networkQuality) {
      case 'excellent':
      case 'good':
        return <Wifi className="w-3.5 h-3.5 text-green-400" />;
      case 'moderate':
        return <Wifi className="w-3.5 h-3.5 text-amber-400" />;
      case 'poor':
        return <Wifi className="w-3.5 h-3.5 text-red-400" />;
      case 'offline':
        return <WifiOff className="w-3.5 h-3.5 text-red-500" />;
      default:
        return <Wifi className="w-3.5 h-3.5 text-green-400" />;
    }
  };

  const getConnectionIndicator = () => {
    if (connectionState === 'connected') {
      return (
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] font-bold text-green-400">CONNECTED</span>
        </div>
      );
    } else if (connectionState === 'connecting' || connectionState === 'reconnecting') {
      return (
        <div className="flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
          <span className="text-[10px] font-bold text-amber-400">
            {connectionState === 'reconnecting' ? 'RECONNECTING...' : 'CONNECTING...'}
          </span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-[10px] font-bold text-red-400">DISCONNECTED</span>
        </div>
      );
    }
  };

  // ── Offline / Connecting states ───────────────────────────────────────────
  const showOfflineState = (!isLive && broadcastMode === 'offline' && !stream);
  const showConnectingState = (isLive || broadcastMode !== 'offline') && !stream && 
    (connectionState === 'connecting' || connectionState === 'reconnecting' || connectionState === 'disconnected');

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-2xl sm:rounded-3xl overflow-hidden touch-manipulation select-none"
      onClick={handleTap}
      onDoubleClick={handleDoubleTap}
      role="region"
      aria-label="Live Stream Video"
    >
      {/* Video element carries both the remote video and audio tracks. */}
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-contain"
          webkit-playsinline=""
          x5-playsinline=""
          x5-video-player-type="h5"
          x5-video-player-fullscreen="true"
          preload="auto"
        />
      ) : null}

      {/* Offline State */}
      {showOfflineState && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-void to-void flex flex-col items-center justify-center gap-4 p-6">
          <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center border border-slate-700/50">
            <Play className="w-8 h-8 text-slate-500" />
          </div>
          <div className="text-center">
            <p className="text-white text-lg font-bold">No Stream Available</p>
            <p className="text-slate-400 text-sm mt-1">We're not broadcasting right now</p>
            <p className="text-slate-500 text-xs mt-2">Check back during our scheduled services</p>
          </div>
        </div>
      )}

      {/* Connecting / Buffering State */}
      {showConnectingState && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-void to-void flex flex-col items-center justify-center gap-4 p-6">
          <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center border border-slate-700/50">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-white text-base font-bold">
              {connectionState === 'reconnecting' ? 'Reconnecting...' : 'Connecting to stream...'}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {broadcastMode === 'pre-stream' ? 'Preparing pre-stream media' : 'Setting up live connection'}
            </p>
          </div>
        </div>
      )}

      {/* Explicit audio unlock for LiveKit/browser autoplay policy. */}
      {audioPlaybackBlocked && stream && (
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-40 cursor-pointer"
          onClick={(event) => {
            event.stopPropagation();
            void onStartAudio?.().then(() => handleTap());
          }}
        >
          <div className="w-20 h-20 rounded-full bg-primary/80 flex items-center justify-center border-2 border-primary/30 shadow-lg">
            <Volume2 className="w-10 h-10 text-white" />
          </div>
          <p className="text-white text-base font-bold">Tap to enable live audio</p>
          <p className="text-slate-400 text-xs">Your browser requires one tap before playing sound</p>
        </div>
      )}

      {/* Tap to Play Overlay — for browsers that block native media playback */}
      {needsTapToPlay && !audioPlaybackBlocked && stream && (
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-40 cursor-pointer"
          onClick={(event) => { event.stopPropagation(); handleTap(); }}
        >
          <div className="w-20 h-20 rounded-full bg-primary/80 flex items-center justify-center border-2 border-primary/30 shadow-lg">
            <Play className="w-10 h-10 text-white ml-1" />
          </div>
          <p className="text-white text-base font-bold">Tap to watch live</p>
          <p className="text-slate-400 text-xs">Tap once to start streaming</p>
        </div>
      )}

      {/* Connection Lost State */}
      {(connectionState === 'reconnecting' || connectionState === 'disconnected') && stream && !needsTapToPlay && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-30"
        >
          <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center border border-slate-700/50">
            {connectionState === 'reconnecting' ? (
              <RefreshCw className="w-7 h-7 text-amber-400 animate-spin" />
            ) : (
              <WifiOff className="w-7 h-7 text-red-400" />
            )}
          </div>
          <p className="text-white text-base font-bold">
            {connectionState === 'reconnecting' ? 'Reconnecting...' : 'Connection Lost'}
          </p>
          {connectionState === 'reconnecting' && (
            <p className="text-slate-400 text-sm">Trying to restore the stream...</p>
          )}
          {connectionState === 'disconnected' && onReconnect && (
            <button
              onClick={(e) => { e.stopPropagation(); onReconnect(); }}
              className="px-6 py-2.5 bg-primary text-white rounded-full text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          )}
        </motion.div>
      )}

      {/* Live Indicator */}
      {isLive && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-red-600/90 backdrop-blur-md px-2.5 py-1 rounded-full">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          <span className="text-white font-black text-[9px] tracking-[0.15em] uppercase">LIVE</span>
        </div>
      )}

      {/* Audio Boost Indicator (subtle) */}
      {!muted && volumeLevel > 100 && (
        <div className="absolute top-3 right-14 z-20 flex items-center gap-1 bg-blue-600/80 backdrop-blur-md px-2 py-0.5 rounded-full">
          <Volume className="w-2.5 h-2.5 text-white" />
          <span className="text-white font-bold text-[8px]">{volumeLevel}%</span>
        </div>
      )}

      {/* Controls Overlay */}
      {stream && !showOfflineState && !showConnectingState && !needsTapToPlay && (
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-20 pointer-events-none"
            >
              {/* Top Bar */}
              <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-3 pt-10 sm:pt-3 flex items-center justify-between pointer-events-auto">
                <div className="flex items-center gap-2">
                  {getConnectionIndicator()}
                </div>
                <div className="flex items-center gap-1.5">
                  {getNetworkIcon()}
                  <span className="text-[9px] font-bold text-white/70 uppercase tracking-wider">
                    {networkQuality}
                  </span>
                </div>
              </div>

              {/* Bottom Controls */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pb-10 sm:pb-3 pointer-events-auto">

                {/* Volume Slider Row */}
                {!muted && (
                  <div className="mb-3 px-2">
                    <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md rounded-full px-3 py-2">
                      <Volume className="w-3.5 h-3.5 text-white/70" />
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={volumeLevel}
                        onChange={(e) => handleVolumeChange(Number(e.target.value))}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className="flex-1 h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer
                          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg
                          [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                          [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
                      />
                      <span className="text-[10px] font-mono text-white/80 w-9 text-right">{volumeLevel}%</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  {/* Left: Mute */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-colors"
                    aria-label={muted ? 'Unmute' : 'Mute'}
                  >
                    {muted ? (
                      <VolumeX className="w-4 h-4 text-red-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-white" />
                    )}
                  </button>

                  {/* Center: Status */}
                  <div className="flex items-center gap-2">
                    {broadcastMode === 'pre-stream' && (
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                        Pre-Stream
                      </span>
                    )}
                  </div>

                  {/* Right: Fullscreen */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-colors"
                    aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  >
                    {isFullscreen ? (
                      <Minimize className="w-4 h-4 text-white" />
                    ) : (
                      <Maximize className="w-4 h-4 text-white" />
                    )}
                  </button>
                </div>

                {/* Mobile: Mute indicator overlay */}
                {muted && (
                  <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full pointer-events-none">
                    <VolumeX className="w-3 h-3 text-red-400" />
                    <span className="text-[10px] text-white/80 font-medium">Tap to unmute</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
