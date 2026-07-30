import { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipForward, SkipBack, Upload, Link as LinkIcon,
  Image, Music, Film, Volume2, VolumeX, Maximize2, X, Repeat,
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
    const [volume, setVolume] = useState(80);
    const [muted, setMuted] = useState(false);
    const [loop, setLoop] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [captureError, setCaptureError] = useState<string | null>(null);
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const imageTimerRef = useRef<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const captureStreamRef = useRef<MediaStream | null>(null);
    const captureLoopRef = useRef<number | null>(null);
    const imageDrawLoopRef = useRef<number | null>(null);

    const current = currentIndex >= 0 ? mediaList[currentIndex] : null;

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (imageTimerRef.current) clearTimeout(imageTimerRef.current);
        stopCapture();
      };
    }, []);

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
     * Handles video, image, and audio types with proper composition.
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

        // Capture video track (for video and image)
        if (current.type === "video" || current.type === "image") {
          videoTrack = await captureVideoTrack();
        }

        // Capture audio track (for video and audio)
        if ((current.type === "video" || current.type === "audio") && audioRef.current) {
          audioTrack = await captureAudioTrack(audioRef.current);
        }

        const stream = new MediaStream();
        if (videoTrack) stream.addTrack(videoTrack);
        if (audioTrack) stream.addTrack(audioTrack);

        if (stream.getTracks().length === 0) {
          setCaptureError("Failed to capture any tracks");
          return null;
        }

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
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      // Set canvas size to 1920x1080 for professional quality
      canvas.width = 1920;
      canvas.height = 1080;

      // Draw initial frame
      if (current?.type === "video" && videoRef.current) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      } else if (current?.type === "image") {
            const img = document.createElement("img");
            img.crossOrigin = "anonymous";
            await new Promise<void>((resolve, reject) => {
              img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve();
              };
              img.onerror = () => reject(new Error("Failed to load image"));
              img.src = current.url;
            });
      }

      // Get canvas stream at 30fps
      const canvasStream = canvas.captureStream(30);
      const videoTrack = canvasStream.getVideoTracks()[0];

      if (!videoTrack) {
        throw new Error("Failed to capture video track from canvas");
      }

      // For video, continuously update the canvas
      if (current?.type === "video" && videoRef.current) {
        const updateFrame = () => {
          if (videoRef.current && isPlaying) {
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            captureLoopRef.current = requestAnimationFrame(updateFrame);
          }
        };
        captureLoopRef.current = requestAnimationFrame(updateFrame);
      } else if (current?.type === "image") {
        // Keep redrawing the image to maintain the stream
        const redrawImage = () => {
          if (isPlaying) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Add a subtle animated overlay for images
            ctx.fillStyle = "#0a0a0a";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const img = document.createElement("img");
            img.crossOrigin = "anonymous";
            img.onload = () => {
              // Calculate dimensions to fit 1920x1080 while maintaining aspect ratio
              const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
              const w = img.width * scale;
              const h = img.height * scale;
              const x = (canvas.width - w) / 2;
              const y = (canvas.height - h) / 2;
              ctx.drawImage(img, x, y, w, h);
            };
            img.src = current.url;
            imageDrawLoopRef.current = requestAnimationFrame(redrawImage);
          }
        };
        // Draw once, then keep refreshing
        redrawImage();
      }

      return videoTrack as MediaStreamTrack;
    };

    /**
     * Capture audio from audio element using Web Audio API.
     */
    const captureAudioTrack = async (audioElement: HTMLAudioElement): Promise<MediaStreamTrack | null> => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        const audioContext = audioContextRef.current;

        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        // Create source from audio element
        const source = audioContext.createMediaElementSource(audioElement);

        // Create destination to capture audio
        const destination = audioContext.createMediaStreamDestination();

        // Connect source to destination (for broadcast)
        source.connect(destination);
        // Also connect to speakers so the host can hear it
        source.connect(audioContext.destination);

        const audioTrack = destination.stream.getAudioTracks()[0];

        if (!audioTrack) {
          throw new Error("Failed to capture audio track");
        }

        return audioTrack as MediaStreamTrack;
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
        captureLoopRef.current = null;
      }
      if (imageDrawLoopRef.current) {
        cancelAnimationFrame(imageDrawLoopRef.current);
        imageDrawLoopRef.current = null;
      }

      if (captureStreamRef.current) {
        captureStreamRef.current.getTracks().forEach(track => track.stop());
        captureStreamRef.current = null;
      }

      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
        audioContextRef.current = null;
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

    const detectTypeFromUrl = (url: string): "video" | "image" | "audio" => {
      const lower = url.toLowerCase();
      if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov") || lower.includes("youtube") || lower.includes("youtu.be")) return "video";
      if (lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".ogg") || lower.endsWith(".m4a")) return "audio";
      if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp") || lower.endsWith(".gif") || lower.endsWith(".svg")) return "image";
      return urlType;
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
          const el = type === "video"
            ? document.createElement("video")
            : document.createElement("audio");
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
      const type = detectTypeFromUrl(urlInput.trim());
      setMediaList(prev => [...prev, {
        id: crypto.randomUUID(),
        type,
        url: urlInput.trim(),
        label: urlInput.trim().split("/").pop()?.split("?")[0] || "Remote Media",
      }]);
      if (currentIndex === -1) setCurrentIndex(0);
      setUrlInput("");
      setShowUrlInput(false);
      toast.success("Media URL added");
    }, [urlInput, currentIndex]);

    const removeItem = (index: number) => {
      if (index === currentIndex) {
        stopPlayback();
        setMediaList(prev => {
          const next = prev.filter((_, i) => i !== index);
          setCurrentIndex(next.length > 0 ? Math.min(index, next.length - 1) : -1);
          return next;
        });
      } else {
        setMediaList(prev => prev.filter((_, i) => i !== index));
      }
    };

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
        videoRef.current.volume = muted ? 0 : volume / 100;
        videoRef.current.loop = loop;
        videoRef.current.play().catch(() => toast.error("Cannot play this video"));
      } else if (current.type === "audio" && audioRef.current) {
        audioRef.current.volume = muted ? 0 : volume / 100;
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

    const togglePlay = () => {
      if (isPlaying) {
        if (videoRef.current) videoRef.current.pause();
        if (audioRef.current) audioRef.current.pause();
        if (imageTimerRef.current) { clearTimeout(imageTimerRef.current); imageTimerRef.current = null; }
        setIsPlaying(false);
        stopCapture();
      } else {
        startPlayback();
      }
    };

    const handleNext = () => {
      if (mediaList.length === 0) return;
      const next = currentIndex + 1 >= mediaList.length ? 0 : currentIndex + 1;
      setCurrentIndex(next);
      stopPlayback();
      setTimeout(() => {
        setCurrentIndex(next);
        setIsPlaying(true);
      }, 50);
    };

    const handlePrev = () => {
      if (mediaList.length === 0) return;
      const prev = currentIndex - 1 < 0 ? mediaList.length - 1 : currentIndex - 1;
      setCurrentIndex(prev);
      stopPlayback();
      setTimeout(() => {
        setCurrentIndex(prev);
        setIsPlaying(true);
      }, 50);
    };

    const handleVolumeChange = (v: number) => {
      setVolume(v);
      setMuted(v === 0);
      if (videoRef.current) videoRef.current.volume = v / 100;
      if (audioRef.current) audioRef.current.volume = v / 100;
    };

    const toggleMute = () => {
      const newMuted = !muted;
      setMuted(newMuted);
      if (videoRef.current) videoRef.current.volume = newMuted ? 0 : volume / 100;
      if (audioRef.current) audioRef.current.volume = newMuted ? 0 : volume / 100;
    };

    const toggleFullscreen = () => {
      if (!videoRef.current) return;
      if (document.fullscreenElement) {
        document.exitFullscreen();
        setIsFullscreen(false);
      } else {
        videoRef.current.requestFullscreen().then(() => setIsFullscreen(true));
      }
    };

    const formatTime = (s: number) => {
      if (!s || isNaN(s)) return "0:00";
      const mins = Math.floor(s / 60);
      const secs = Math.floor(s % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
      <div className="space-y-4">
        {/* Hidden canvas and audio elements for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Capture Error Alert */}
        {captureError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="p-3 bg-red-500/10 border border-red-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-600">Capture Error</p>
                <p className="text-xs text-red-500/80">{captureError}</p>
              </div>
              <button onClick={() => setCaptureError(null)} className="text-red-500 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </Card>
          </motion.div>
        )}

        {/* Broadcasting Status */}
        {isBroadcasting && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30"
          >
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-2 h-2 bg-green-500 rounded-full"
            />
            <p className="text-xs font-semibold text-green-400">Broadcasting to viewers</p>
          </motion.div>
        )}

        {/* Add Media Buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*,audio/*"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800"
            disabled={isLive}
          >
            <Upload className="w-4 h-4" />
            Upload Files
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="flex-1 gap-2 border-primary/50"
            disabled={isLive}
          >
            <LinkIcon className="w-4 h-4" />
            Add from URL
          </Button>
        </div>

        {/* URL Input */}
        <AnimatePresence>
          {showUrlInput && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <Card className="p-4 glass-panel border-0 space-y-3">
                <div className="flex gap-2">
                  {(["video", "audio", "image"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setUrlType(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                        urlType === t
                          ? "bg-ember text-ember-foreground"
                          : "bg-primary/10 text-muted-foreground hover:bg-primary/20"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    placeholder={`Paste ${urlType} URL (e.g. YouTube link, image URL...)`}
                    onKeyPress={e => e.key === "Enter" && handleAddUrl()}
                  />
                  <Button onClick={handleAddUrl} size="sm" disabled={isLive}>
                    Add
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Media List */}
        {mediaList.length > 0 && (
          <Card className="glass-panel border-0 overflow-hidden">
            <div className="p-3 border-b border-border/40 bg-primary/5">
              <h4 className="font-bold text-sm text-foreground">Playlist ({mediaList.length})</h4>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {mediaList.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center gap-3 px-3 py-2.5 border-b border-border/20 last:border-0 cursor-pointer transition-colors ${
                    idx === currentIndex
                      ? "bg-ember/10 border-l-2 border-l-ember"
                      : "hover:bg-primary/5 border-l-2 border-l-transparent"
                  }`}
                  onClick={() => { setCurrentIndex(idx); stopPlayback(); setTimeout(() => setIsPlaying(true), 50); }}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    item.type === "video" ? "bg-blue-500/20" :
                    item.type === "audio" ? "bg-purple-500/20" : "bg-emerald-500/20"
                  }`}>
                    {item.type === "video" && <Film className="w-4 h-4 text-blue-400" />}
                    {item.type === "audio" && <Music className="w-4 h-4 text-purple-400" />}
                    {item.type === "image" && <Image className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {item.type}{item.duration ? ` \u2022 ${formatTime(item.duration)}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); removeItem(idx); }}
                    className="p-1 hover:bg-destructive/20 rounded"
                  >
                    <X className="w-3 h-3 text-destructive" />
                  </button>
                </motion.div>
              ))}
            </div>
          </Card>
        )}

        {/* Player Controls */}
        {current && (
          <Card className="glass-panel border-0 overflow-hidden">
            {/* Video/Image Display */}
            {(current.type === "video" || current.type === "image") && (
              <div className="relative bg-black aspect-video">
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
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-void to-void/50">
                    <img
                      src={current.url}
                      alt={current.label}
                      className="max-w-full max-h-full object-contain"
                    />
                    {isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center backdrop-blur">
                          <div className="w-12 h-12 rounded-full bg-white/30 animate-pulse" />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Progress bar for video */}
                {current.type === "video" && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                    <div
                      className="h-full bg-ember transition-all"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                  </div>
                )}

                {/* Time display for video */}
                {current.type === "video" && (
                  <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white font-mono">
                    <span>{formatTime(currentTime)}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span>{formatTime(duration)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Audio-only display */}
            {current.type === "audio" && (
              <audio
                ref={audioRef}
                src={current.url}
                onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
                onEnded={() => { if (!loop) handleNext(); }}
              />
            )}
            {current.type === "audio" && (
              <div className="p-8 bg-gradient-to-br from-purple-900/20 to-slate-900/40 flex flex-col items-center justify-center min-h-[200px]">
                <Music className="w-16 h-16 text-purple-400/60 mb-4" />
                <p className="text-foreground font-bold text-lg">{current.label}</p>
                <p className="text-muted-foreground text-sm capitalize">{current.type}</p>
              </div>
            )}

            {/* Playback Controls */}
            <div className="p-4 space-y-3 bg-void/40">
              {/* Progress bar */}
              {(current.type === "video" || current.type === "audio") && (
                <Slider
                  value={[currentTime]}
                  max={duration || 1}
                  step={0.1}
                  onValueChange={([v]) => {
                    if (current.type === "video" && videoRef.current) videoRef.current.currentTime = v;
                    if (current.type === "audio" && audioRef.current) audioRef.current.currentTime = v;
                    setCurrentTime(v);
                  }}
                  className="w-full"
                />
              )}

              {/* Main controls */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={handlePrev} className="hover:bg-primary/20">
                    <SkipBack className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={togglePlay}
                    className="bg-ember hover:bg-ember/90 text-ember-foreground w-10 h-10"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleNext} className="hover:bg-primary/20">
                    <SkipForward className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setLoop(!loop)}
                    className={loop ? "text-ember" : "text-muted-foreground"}
                  >
                    <Repeat className="w-4 h-4" />
                  </Button>
                  {current.type === "video" && (
                    <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* Volume */}
                <div className="flex items-center gap-2 w-28">
                  <button onClick={toggleMute} className="text-muted-foreground hover:text-foreground">
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <Slider
                    value={[muted ? 0 : volume]}
                    max={100}
                    step={1}
                    onValueChange={([v]) => handleVolumeChange(v)}
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Empty state */}
        {mediaList.length === 0 && (
          <Card className="glass-panel border-0 p-8 text-center">
            <Film className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              Upload videos, images, or audio files to create a pre-stream playlist.
              <br />
              You can also add media from a URL.
            </p>
          </Card>
        )}
      </div>
    );
  }
);

PreStreamMediaPlayer.displayName = "PreStreamMediaPlayer";

export default PreStreamMediaPlayer;
