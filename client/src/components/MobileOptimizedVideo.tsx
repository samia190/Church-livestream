import { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MobileOptimizedVideoProps {
  stream: MediaStream | null;
  isLive: boolean;
  broadcastMode: 'offline' | 'pre-stream' | 'live';
  connectionState: string;
  networkQuality: string;
  onReconnect?: () => void;
}

export default function MobileOptimizedVideo({
  stream,
  isLive,
  broadcastMode,
  connectionState,
  networkQuality,
  onReconnect,
}: MobileOptimizedVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showReconnect, setShowReconnect] = useState(false);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide controls after inactivity
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

  // Show controls when video is playing
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

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Connect stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      // Professional: Optimization for low-latency playback
      const video = videoRef.current;
      video.srcObject = stream;
      
      // Force low latency attributes
      video.muted = true; // Required for autoplay
      video.autoplay = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      
      // Attempt immediate playback
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log("[Video] Autoplay prevented, waiting for interaction", error);
        });
      }
    }
  }, [stream]);

  const handleTap = () => {
    resetHideTimer();
    if (videoRef.current && stream) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      }
    }
  };

  const handleDoubleTap = useCallback(() => {
    toggleFullscreen();
  }, []);

  const toggleMute = () => {
    setMuted(prev => {
      if (videoRef.current) {
        videoRef.current.muted = !prev;
        // If unmute, also unmute the actual tracks
        if (!prev && stream) {
          stream.getAudioTracks().forEach(t => { t.enabled = true; });
        }
      }
      return !prev;
    });
  };

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

  const showOfflineState = (!isLive && broadcastMode === 'offline');

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-2xl sm:rounded-3xl overflow-hidden touch-manipulation select-none"
      onClick={handleTap}
      onDoubleClick={handleDoubleTap}
      role="application"
      aria-label="Live Stream Video"
    >
      {/* Video Element */}
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="absolute inset-0 w-full h-full object-contain"
          webkit-playsinline=""
          x5-playsinline=""
          x5-video-player-type="h5"
          x5-video-player-fullscreen="true"
          preload="auto"
        />
      ) : null}

      {/* Offline / Loading State */}
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

      {/* Connection Lost State */}
      {(connectionState === 'reconnecting' || connectionState === 'disconnected') && stream && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-30"
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

      {/* Live Indicator - always visible */}
      {isLive && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-red-600/90 backdrop-blur-md px-2.5 py-1 rounded-full">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          <span className="text-white font-black text-[9px] tracking-[0.15em] uppercase">LIVE</span>
        </div>
      )}

      {/* Controls Overlay */}
      {stream && !showOfflineState && (
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
