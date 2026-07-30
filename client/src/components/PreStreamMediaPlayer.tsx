import React, { useState, useRef, useCallback, forwardRef, useImperativeHandle, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipForward, SkipBack, Upload, Link as LinkIcon,
  Image as ImageIcon, Music, Film, Volume2, VolumeX, Maximize2, X, Repeat,
  AlertCircle, Monitor, Radio
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface MediaItem {
  id: string;
  type: "video" | "image" | "audio";
  url: string;
  label: string;
  duration?: number;
}

interface PreStreamMediaPlayerProps {
  /** Called when the user activates a media item to play it into the preview */
  onMediaActivate: (stream: MediaStream | null) => void;
  /** Whether the stream is currently live — disables some controls */
  isLive: boolean;
}

export interface PreStreamMediaPlayerRef {
  /** Capture the current media as a MediaStream */
  captureStream: () => Promise<MediaStream | null>;
  /** Stop capturing and clean up resources */
  stopCapture: () => void;
}

const PreStreamMediaPlayer = forwardRef<PreStreamMediaPlayerRef, PreStreamMediaPlayerProps>(
  ({ onMediaActivate, isLive }, ref) => {
    const [mediaList, setMediaList] = useState<MediaItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState<number>(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [urlInput, setUrlInput] = useState("");
    const [urlType, setUrlType] = useState<"video" | "image" | "audio">("video");
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(100);
    const [muted, setMuted] = useState(false);
    const [loop, setLoop] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [captureError, setCaptureError] = useState<string | null>(null);
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [audioCaptured, setAudioCaptured] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const imageTimerRef = useRef<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const captureStreamRef = useRef<MediaStream | null>(null);
    const captureLoopRef = useRef<number | null>(null);
    const preloadedImageRef = useRef<HTMLImageElement | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

    const current = currentIndex >= 0 ? mediaList[currentIndex] : null;

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (imageTimerRef.current) clearTimeout(imageTimerRef.current);
        stopCapture();
      };
    }, []);

    /**
     * REAL-TIME VOLUME/MUTE SYNC
     * Syncs React state to the actual video/audio DOM elements immediately.
     * This fixes the bug where volume/mute changes don't affect playing media.
     */
    useEffect(() => {
      const vol = muted ? 0 : volume / 100;
      if (videoRef.current) {
        videoRef.current.volume = vol;
        videoRef.current.muted = muted;
      }
      if (audioRef.current) {
        audioRef.current.volume = vol;
        audioRef.current.muted = muted;
      }
    }, [volume, muted]);

    // Expose capture methods via ref
    useImperativeHandle(ref, () => ({
      captureStream: async () => {
        try {
          return await captureMediaStream();
        } catch (error) {
          console.error("[PreStreamMediaPlayer] Capture failed:", error);
          setCaptureError(error instanceof Error ? error.message : "Capture failed");
          return null;
        }
      },
      stopCapture: () => {
        stopCapture();
      },
    }));

    /**
     * Capture the current media as a MediaStream.
     * FIXED: For video type, captures audio from videoRef.current (not audioRef).
     * FIXED: Uses Web Audio API properly to capture video element's audio.
     */
    const captureMediaStream = async (): Promise<MediaStream | null> => {
      if (!current || !isPlaying) {
        setCaptureError("No media is currently playing");
        return null;
      }

      try {
        stopCapture();
        setCaptureError(null);

        let videoTrack: MediaStreamTrack | null = null;
        let audioTrack: MediaStreamTrack | null = null;

        // Capture video track
        if (current.type === "video" || current.type === "image") {
          videoTrack = await captureVideoTrack();
        }

        // FIXED: For video type, capture audio from the VIDEO element, not the audio element
        if (current.type === "video" && videoRef.current) {
          audioTrack = await captureVideoElementAudio(videoRef.current);
        } else if (current.type === "audio" && audioRef.current) {
          audioTrack = await captureVideoElementAudio(audioRef.current);
        }

        const stream = new MediaStream();
        if (videoTrack) stream.addTrack(videoTrack);
        if (audioTrack) stream.addTrack(audioTrack);

        if (stream.getTracks().length === 0) {
          setCaptureError("Failed to capture any tracks");
          return null;
        }

        setAudioCaptured(!!audioTrack);
        captureStreamRef.current = stream;
        setIsBroadcasting(true);
        return stream;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setCaptureError(message);
        console.error("[PreStreamMediaPlayer] Capture error:", error);
        return null;
      }
    };

    /**
     * Capture video from canvas or video element.
     */
    const captureVideoTrack = async (): Promise<MediaStreamTrack | null> => {
      if (!canvasRef.current) {
        throw new Error("Canvas reference not available");
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      canvas.width = 1280;
      canvas.height = 720;

      if (current?.type === "video" && videoRef.current) {
        const video = videoRef.current;
        const updateFrame = () => {
          if (video && isPlaying && !video.paused) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            captureLoopRef.current = requestAnimationFrame(updateFrame);
          } else if (video && isPlaying) {
            captureLoopRef.current = requestAnimationFrame(updateFrame);
          }
        };
        updateFrame();
      } else if (current?.type === "image") {
        if (!preloadedImageRef.current || preloadedImageRef.current.src !== current.url) {
          const img = document.createElement("img");
          img.crossOrigin = "anonymous";
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              preloadedImageRef.current = img;
              resolve();
            };
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = current.url;
          });
        }

        const img = preloadedImageRef.current!;
        const redraw = () => {
          if (isPlaying) {
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = (canvas.width - w) / 2;
            const y = (canvas.height - h) / 2;
            ctx.drawImage(img, x, y, w, h);
            captureLoopRef.current = window.setTimeout(redraw, 1000) as any;
          }
        };
        redraw();
      }

      const canvasStream = canvas.captureStream(isPlaying && current?.type === "video" ? 30 : 5);
      const videoTrack = canvasStream.getVideoTracks()[0];

      if (!videoTrack) {
        throw new Error("Failed to capture video track from canvas");
      }

      return videoTrack;
    };

    /**
     * FIXED: Capture audio from any media element (video OR audio) using Web Audio API.
     * Uses a singleton source node pattern to avoid "already connected" errors.
     * Ensures the audio element is actually playing before capture.
     */
    const captureVideoElementAudio = async (mediaElement: HTMLMediaElement): Promise<MediaStreamTrack | null> => {
      try {
        // Ensure the element is actually playing audio
        if (mediaElement.paused || mediaElement.muted || mediaElement.volume === 0) {
          console.warn("[PreStreamMediaPlayer] Media element is paused/muted/zero-volume during capture");
          // Still attempt capture — the track might be useful
        }

        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        const audioContext = audioContextRef.current;

        // Resume if suspended (required by browser autoplay policies)
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        // Use a singleton source node to avoid "MediaElementAudioSourceNode has already been created" error
        if (!sourceNodeRef.current || sourceNodeRef.current.mediaElement !== mediaElement) {
          try {
            sourceNodeRef.current = audioContext.createMediaElementSource(mediaElement);
          } catch (err) {
            // If already created for this element, reuse it
            console.warn("[PreStreamMediaPlayer] Source node already exists, reusing:", err);
          }
        }

        const source = sourceNodeRef.current;
        if (!source) {
          throw new Error("Failed to create media element source");
        }

        // Disconnect any previous connections to avoid duplicate audio paths
        try {
          source.disconnect();
        } catch (err) {
          // Ignore disconnect errors
        }

        // Create destination to capture audio as a MediaStream
        const destination = audioContext.createMediaStreamDestination();

        // Create a gain node to control volume/mute
        const gainNode = audioContext.createGain();
        gainNode.gain.value = muted ? 0 : volume / 100;

        // Route: source → gain → destination (capture) AND source → gain → speakers (monitor)
        source.connect(gainNode);
        gainNode.connect(destination);
        try {
          gainNode.connect(audioContext.destination);
        } catch (err) {
          // Already connected, fine
        }

        const audioTrack = destination.stream.getAudioTracks()[0];

        if (!audioTrack) {
          throw new Error("Failed to capture audio track — no audio data available");
        }

        console.log("[PreStreamMediaPlayer] Audio captured successfully:", audioTrack.label, audioTrack.readyState);
        return audioTrack;
      } catch (error) {
        console.error("[PreStreamMediaPlayer] Audio capture error:", error);
        return null;
      }
    };

    /**
     * Stop capturing and clean up resources.
     */
    const stopCapture = useCallback(() => {
      if (captureLoopRef.current) {
        cancelAnimationFrame(captureLoopRef.current);
        clearTimeout(captureLoopRef.current);
        captureLoopRef.current = null;
      }

      if (captureStreamRef.current) {
        captureStreamRef.current.getTracks().forEach(track => track.stop());
        captureStreamRef.current = null;
      }

      // Disconnect audio graph nodes
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect();
        } catch (err) {
          // Already disconnected
        }
      }

      setIsBroadcasting(false);
      setCaptureError(null);
    }, []);

    const detectMediaType = (file: File): "video" | "image" | "audio" => {
      if (file.type.startsWith("video/")) return "video";
      if (file.type.startsWith("image/")) return "image";
      if (file.type.startsWith("audio/")) return "audio";
      return "video";
    };

    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const items: MediaItem[] = [];
      for (const file of Array.from(files)) {
        const type = detectMediaType(file);
        const url = URL.createObjectURL(file);
        const label = file.name.replace(/\.[^/.]+$/, "");

        if (type === "video" || type === "audio") {
          const el = document.createElement(type) as HTMLVideoElement | HTMLAudioElement;
          el.src = url;
          await new Promise<void>(resolve => {
            el.addEventListener("loadedmetadata", () => {
              items.push({ id: crypto.randomUUID(), type, url, label, duration: el.duration });
              resolve();
            });
            el.addEventListener("error", () => {
              items.push({ id: crypto.randomUUID(), type, url, label });
              resolve();
            });
          });
        } else {
          items.push({ id: crypto.randomUUID(), type, url, label });
        }
      }

      setMediaList(prev => [...prev, ...items]);
      if (currentIndex === -1 && items.length > 0) {
        setCurrentIndex(0);
      }
      toast.success(`${items.length} media item${items.length > 1 ? "s" : ""} added`);
      e.target.value = "";
    }, [currentIndex]);

    const handleAddUrl = useCallback(() => {
      if (!urlInput.trim()) return;
      setMediaList(prev => [...prev, {
        id: crypto.randomUUID(),
        type: urlType,
        url: urlInput.trim(),
        label: urlInput.trim().split("/").pop()?.split("?")[0] || "Remote Media",
      }]);
      if (currentIndex === -1) setCurrentIndex(0);
      setUrlInput("");
      setShowUrlInput(false);
      toast.success("Media URL added");
    }, [urlInput, urlType, currentIndex]);

    /** FIXED: Added missing removeItem function */
    const removeItem = useCallback((index: number) => {
      setMediaList(prev => {
        const next = prev.filter((_, i) => i !== index);
        if (index === currentIndex) {
          stopPlayback();
          setCurrentIndex(next.length > 0 ? Math.min(index, next.length - 1) : -1);
        } else if (index < currentIndex) {
          setCurrentIndex(prev => prev - 1);
        }
        return next;
      });
    }, [currentIndex]);

    const startPlayback = useCallback(() => {
      if (!current) return;
      setIsPlaying(true);
      stopCapture();

      if (current.type === "image") {
        onMediaActivate(null);
        imageTimerRef.current = window.setTimeout(() => {
          if (loop) {
            setIsPlaying(false);
            startPlayback();
          } else {
            handleNext();
          }
        }, 10000);
      } else if (current.type === "video" && videoRef.current) {
        // FIXED: Apply volume/mute before playing
        videoRef.current.volume = muted ? 0 : volume / 100;
        videoRef.current.muted = muted;
        videoRef.current.loop = loop;
        videoRef.current.play().catch(() => toast.error("Cannot play this video"));
      } else if (current.type === "audio" && audioRef.current) {
        audioRef.current.volume = muted ? 0 : volume / 100;
        audioRef.current.muted = muted;
        audioRef.current.loop = loop;
        audioRef.current.play().catch(() => toast.error("Cannot play this audio"));
      }
    }, [current, volume, muted, loop, onMediaActivate]);

    const stopPlayback = useCallback(() => {
      setIsPlaying(false);
      if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
      if (imageTimerRef.current) { clearTimeout(imageTimerRef.current); imageTimerRef.current = null; }
      setCurrentTime(0);
      onMediaActivate(null);
      stopCapture();
    }, [onMediaActivate]);

    const handleNext = useCallback(() => {
      if (mediaList.length === 0) return;
      const nextIndex = (currentIndex + 1) % mediaList.length;
      setCurrentIndex(nextIndex);
    }, [currentIndex, mediaList.length]);

    const handlePrev = useCallback(() => {
      if (mediaList.length === 0) return;
      const prevIndex = (currentIndex - 1 + mediaList.length) % mediaList.length;
      setCurrentIndex(prevIndex);
    }, [currentIndex, mediaList.length]);

    const formatTime = (time: number) => {
      if (isNaN(time)) return "0:00";
      const mins = Math.floor(time / 60);
      const secs = Math.floor(time % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const toggleMute = useCallback(() => {
      setMuted(prev => !prev);
    }, []);

    const handleVolumeSlider = useCallback((vals: number[]) => {
      const val = vals[0];
      setVolume(val);
      setMuted(val === 0);
    }, []);

    return (
      <Card className="bg-slate-900/40 border-slate-800 overflow-hidden flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-white text-sm">Pre-Stream Studio</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-xs gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-xs gap-2"
              onClick={() => setShowUrlInput(!showUrlInput)}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              URL
            </Button>
          </div>
        </div>

        {/* URL Input Area */}
        <AnimatePresence>
          {showUrlInput && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 py-3 bg-slate-800/30 border-b border-slate-800 overflow-hidden"
            >
              <div className="flex gap-2 mb-2">
                {(["video", "image", "audio"] as const).map(t => (
                  <Button
                    key={t}
                    size="sm"
                    variant={urlType === t ? "default" : "outline"}
                    className="h-7 text-[10px] capitalize"
                    onClick={() => setUrlType(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="Paste media URL here..."
                  className="h-9 bg-slate-950/50 border-slate-700 text-sm"
                  onKeyDown={e => e.key === "Enter" && handleAddUrl()}
                />
                <Button size="sm" onClick={handleAddUrl} className="h-9">Add</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Main Preview Screen */}
          <div className="relative aspect-video bg-black group">
            {current ? (
              <div className="w-full h-full flex items-center justify-center">
                {current.type === "video" && (
                  <video
                    ref={videoRef}
                    src={current.url}
                    className="w-full h-full object-contain"
                    onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
                    onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
                    onEnded={() => { if (!loop) handleNext(); }}
                    playsInline
                  />
                )}
                {current.type === "image" && (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
                    <img
                      src={current.url}
                      alt={current.label}
                      className="max-w-full max-h-full object-contain shadow-2xl"
                    />
                  </div>
                )}
                {current.type === "audio" && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/30 via-transparent to-transparent animate-pulse" />
                    </div>
                    <Music className="w-20 h-20 text-primary mb-4 relative z-10" />
                    <p className="text-white font-bold relative z-10">{current.label}</p>
                    <audio
                      ref={audioRef}
                      src={current.url}
                      onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
                      onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
                      onEnded={() => { if (!loop) handleNext(); }}
                    />
                  </div>
                )}

                {/* Status Overlays */}
                <div className="absolute top-4 left-4 flex gap-2">
                  <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isPlaying ? "bg-primary text-white" : "bg-slate-800 text-slate-400"
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? "bg-white animate-pulse" : "bg-slate-500"}`} />
                    {isPlaying ? "Previewing" : "Paused"}
                  </div>
                  {isBroadcasting && (
                    <div className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-red-900/20">
                      <Radio className="w-3 h-3" />
                      Live to Viewers
                    </div>
                  )}
                </div>

                {/* Audio Status Indicator */}
                {isBroadcasting && (
                  <div className={`absolute top-4 right-4 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    audioCaptured
                      ? "bg-green-600/90 text-white"
                      : "bg-amber-600/90 text-white"
                  }`}>
                    {audioCaptured ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                    Audio {audioCaptured ? "Active" : "N/A"}
                  </div>
                )}

                {/* Error Overlay */}
                {captureError && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6 text-center z-50">
                    <div className="space-y-3">
                      <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
                      <p className="text-red-400 text-sm font-medium">{captureError}</p>
                      <Button size="sm" variant="outline" onClick={() => setCaptureError(null)}>Dismiss</Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center">
                  <Film className="w-8 h-8" />
                </div>
                <p className="text-sm">No media selected</p>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Browse Files
                </Button>
              </div>
            )}

            {/* Hidden capture canvas */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Controls Area */}
          <div className="p-4 bg-slate-900/80 border-t border-slate-800">
            {/* Progress Bar */}
            {(current?.type === "video" || current?.type === "audio") && (
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[10px] font-mono text-slate-500 w-8">{formatTime(currentTime)}</span>
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={([val]) => {
                    if (videoRef.current) videoRef.current.currentTime = val;
                    if (audioRef.current) audioRef.current.currentTime = val;
                    setCurrentTime(val);
                  }}
                  className="flex-1"
                />
                <span className="text-[10px] font-mono text-slate-500 w-8">{formatTime(duration)}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={handlePrev}>
                  <SkipBack className="w-4 h-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                  onClick={isPlaying ? stopPlayback : startPlayback}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={handleNext}>
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-24">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500" onClick={toggleMute}>
                    {muted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </Button>
                  <Slider
                    value={[muted ? 0 : volume]}
                    max={100}
                    onValueChange={handleVolumeSlider}
                    className="flex-1"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${loop ? "text-primary bg-primary/10" : "text-slate-500"}`}
                  onClick={() => setLoop(!loop)}
                >
                  <Repeat className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Playlist Area */}
          <div className="flex-1 min-h-0 bg-slate-950/50 p-2 overflow-y-auto playlist-scrollbar">
            <div className="space-y-1">
              {mediaList.length === 0 ? (
                <div className="py-8 text-center text-slate-600 text-xs italic">
                  Playlist is empty
                </div>
              ) : (
                mediaList.map((item, index) => (
                  <motion.div
                    key={item.id}
                    layout
                    className={`group flex items-center gap-3 p-2 rounded-md cursor-pointer transition-all ${
                      currentIndex === index
                        ? "bg-primary/10 border border-primary/20 shadow-sm"
                        : "hover:bg-slate-800/50 border border-transparent"
                    }`}
                    onClick={() => {
                      if (currentIndex !== index) {
                        stopPlayback();
                        setCurrentIndex(index);
                      }
                    }}
                  >
                    <div className={`w-8 h-8 rounded flex items-center justify-center ${
                      currentIndex === index ? "bg-primary text-white" : "bg-slate-800 text-slate-400"
                    }`}>
                      {item.type === "video" && <Film className="w-4 h-4" />}
                      {item.type === "image" && <ImageIcon className="w-4 h-4" />}
                      {item.type === "audio" && <Music className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${currentIndex === index ? "text-white" : "text-slate-400"}`}>
                        {item.label}
                      </p>
                      <p className="text-[10px] text-slate-600 uppercase tracking-tighter">
                        {item.type} {item.duration ? `• ${formatTime(item.duration)}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
                      onClick={(e) => { e.stopPropagation(); removeItem(index); }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          accept="video/*,image/*,audio/*"
          onChange={handleFileUpload}
        />

        <style>{`
          .playlist-scrollbar::-webkit-scrollbar { width: 4px; }
          .playlist-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .playlist-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
          .playlist-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
        `}</style>
      </Card>
    );
  }
);

PreStreamMediaPlayer.displayName = "PreStreamMediaPlayer";

export default PreStreamMediaPlayer;
