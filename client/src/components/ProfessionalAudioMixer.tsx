import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2, Mic, MicOff, Sliders, Music, Monitor,
  Waves, Activity, Disc, Headphones, Speaker,
  Play, Pause, SkipForward, Upload, X, AlertCircle,
  Zap, Settings, Info, Radio
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface MixerTrack {
  id: string;
  name: string;
  icon: React.ReactNode;
  volume: number;
  muted: boolean;
  level: number;
  peakLevel: number;
}

interface AudioEffects {
  bass: number;
  lowMid: number;
  mid: number;
  highMid: number;
  treble: number;
  compressorThreshold: number;
  compressorRatio: number;
  compressorAttack: number;
  compressorRelease: number;
  reverbMix: number;
  reverbDecay: number;
  delayTime: number;
  delayFeedback: number;
  delayMix: number;
  limiterThreshold: number;
}

const DEFAULT_EFFECTS: AudioEffects = {
  bass: 0,
  lowMid: 0,
  mid: 0,
  highMid: 0,
  treble: 0,
  compressorThreshold: -24,
  compressorRatio: 4,
  compressorAttack: 0.003,
  compressorRelease: 0.25,
  reverbMix: 0,
  reverbDecay: 2,
  delayTime: 0.3,
  delayFeedback: 0.4,
  delayMix: 0,
  limiterThreshold: -1,
};

interface ProfessionalAudioMixerProps {
  mediaStream?: MediaStream | null;
  onVolumeChange?: (trackId: string, volume: number) => void;
  onMuteChange?: (trackId: string, muted: boolean) => void;
  /** Callback that receives the processed output stream (audio only) for broadcasting */
  onProcessedStream?: (stream: MediaStream | null) => void;
}

export default function ProfessionalAudioMixer({
  mediaStream,
  onVolumeChange,
  onMuteChange,
  onProcessedStream,
}: ProfessionalAudioMixerProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  
  // Track Source Nodes
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const musicSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const systemSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Track Gain Nodes
  const micGainRef = useRef<GainNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const systemGainRef = useRef<GainNode | null>(null);
  
  // Music Player Refs
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const musicInputRef = useRef<HTMLInputElement>(null);

  // System Audio Refs
  const [isCapturingSystem, setIsCapturingSystem] = useState(false);
  const systemStreamRef = useRef<MediaStream | null>(null);

  // Effect nodes refs
  const bassNodeRef = useRef<BiquadFilterNode | null>(null);
  const lowMidNodeRef = useRef<BiquadFilterNode | null>(null);
  const midNodeRef = useRef<BiquadFilterNode | null>(null);
  const highMidNodeRef = useRef<BiquadFilterNode | null>(null);
  const trebleNodeRef = useRef<BiquadFilterNode | null>(null);
  const compressorNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const delayFeedbackNodeRef = useRef<GainNode | null>(null);
  const delayMixNodeRef = useRef<GainNode | null>(null);
  const delayDryNodeRef = useRef<GainNode | null>(null);
  const reverbNodeRef = useRef<ConvolverNode | null>(null);
  const reverbMixNodeRef = useRef<GainNode | null>(null);
  const reverbDryNodeRef = useRef<GainNode | null>(null);
  const limiterNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const animFrameRef = useRef<number>(0);

  const [tracks, setTracks] = useState<MixerTrack[]>([
    { id: "mic", name: "Microphone", icon: <Mic className="w-4 h-4" />, volume: 100, muted: false, level: 0, peakLevel: 0 },
    { id: "music", name: "Music Player", icon: <Music className="w-4 h-4" />, volume: 75, muted: false, level: 0, peakLevel: 0 },
    { id: "system", name: "System/Screen", icon: <Monitor className="w-4 h-4" />, volume: 60, muted: false, level: 0, peakLevel: 0 },
  ]);

  const [masterVolume, setMasterVolume] = useState(85);
  const [masterMuted, setMasterMuted] = useState(false);
  const [effects, setEffects] = useState<AudioEffects>(DEFAULT_EFFECTS);
  const [activeTab, setActiveTab] = useState<"mixer" | "eq" | "effects" | "master">("mixer");
  const [autoDucking, setAutoDucking] = useState(true);
  const [audioInfo, setAudioInfo] = useState({
    sampleRate: 0,
    channels: 2,
    latency: "",
  });
  const [graphInitialized, setGraphInitialized] = useState(false);

  // Professional Ramping Constant
  const RAMP_TIME = 0.05; // 50ms for smooth transitions

  /**
   * INITIALIZE AUDIO CONTEXT AND MASTER NODES
   */
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;

      // Master Chain
      const masterGain = ctx.createGain();
      masterGain.gain.value = masterVolume / 100;
      masterGainRef.current = masterGain;

      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = effects.limiterThreshold;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.01;
      limiterNodeRef.current = limiter;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;
      frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);

      const dest = ctx.createMediaStreamDestination();
      destinationRef.current = dest;

      // EQ & FX Chain
      const bass = ctx.createBiquadFilter();
      bass.type = "lowshelf";
      bass.frequency.value = 60;
      bassNodeRef.current = bass;

      const treble = ctx.createBiquadFilter();
      treble.type = "highshelf";
      treble.frequency.value = 12000;
      trebleNodeRef.current = treble;

      // Simple routing for master chain
      bass.connect(treble);
      treble.connect(masterGain);
      masterGain.connect(limiter);
      limiter.connect(analyser);
      analyser.connect(dest);
      analyser.connect(ctx.destination); // Local monitor

      setAudioInfo({
        sampleRate: ctx.sampleRate,
        channels: 2,
        latency: `${(ctx.baseLatency * 1000).toFixed(1)}ms`,
      });

      if (onProcessedStream) {
        onProcessedStream(dest.stream);
      }
      
      setGraphInitialized(true);
      return ctx;
    }
    return audioContextRef.current;
  }, [masterVolume, effects.limiterThreshold, onProcessedStream]);

  /**
   * WIRE MICROPHONE TRACK
   */
  useEffect(() => {
    if (!mediaStream || !graphInitialized) return;
    const ctx = audioContextRef.current!;

    try {
      if (micSourceRef.current) micSourceRef.current.disconnect();
      
      const source = ctx.createMediaStreamSource(mediaStream);
      micSourceRef.current = source;

      if (!micGainRef.current) {
        micGainRef.current = ctx.createGain();
      }
      
      source.connect(micGainRef.current);
      micGainRef.current.connect(bassNodeRef.current!);
      
      console.log("[Mixer] Mic track wired successfully");
    } catch (err) {
      console.error("[Mixer] Mic wiring error:", err);
    }
  }, [mediaStream, graphInitialized]);

  /**
   * WIRE MUSIC PLAYER TRACK
   */
  useEffect(() => {
    if (!musicAudioRef.current || !graphInitialized) return;
    const ctx = audioContextRef.current!;

    try {
      if (!musicSourceRef.current) {
        musicSourceRef.current = ctx.createMediaElementSource(musicAudioRef.current);
        musicGainRef.current = ctx.createGain();
        musicSourceRef.current.connect(musicGainRef.current);
        musicGainRef.current.connect(bassNodeRef.current!);
      }
    } catch (err) {
      console.error("[Mixer] Music wiring error:", err);
    }
  }, [graphInitialized]);

  /**
   * HANDLE SYSTEM AUDIO CAPTURE
   */
  const startSystemCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach(t => t.stop());
        toast.error("No system audio detected. Make sure to check 'Share system audio'.");
        return;
      }

      const ctx = initAudioContext();
      systemStreamRef.current = stream;
      
      if (systemSourceRef.current) systemSourceRef.current.disconnect();
      systemSourceRef.current = ctx.createMediaStreamSource(new MediaStream(audioTracks));
      
      if (!systemGainRef.current) {
        systemGainRef.current = ctx.createGain();
      }
      
      systemSourceRef.current.connect(systemGainRef.current);
      systemGainRef.current.connect(bassNodeRef.current!);
      
      setIsCapturingSystem(true);
      toast.success("System audio captured");
      
      stream.getVideoTracks().forEach(t => t.stop()); // We only need audio
    } catch (err) {
      console.error("[Mixer] System capture error:", err);
      toast.error("Failed to capture system audio");
    }
  };

  const stopSystemCapture = () => {
    if (systemStreamRef.current) {
      systemStreamRef.current.getTracks().forEach(t => t.stop());
      systemStreamRef.current = null;
    }
    setIsCapturingSystem(false);
    toast.info("System audio disconnected");
  };

  /**
   * PROFESSIONAL GAIN RAMPING (Prevents hanging/glitches)
   */
  const updateTrackGains = useCallback(() => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;

    const micTrack = tracks.find(t => t.id === "mic");
    const isMicActive = micTrack && !micTrack.muted && micTrack.level > 15;

    tracks.forEach(track => {
      let targetGain = track.muted ? 0 : track.volume / 100;
      
      // Auto-Ducking Logic: Lower music volume when mic is active
      if (track.id === "music" && autoDucking && isMicActive) {
        targetGain *= 0.3; // Duck by 70%
      }

      let node: GainNode | null = null;
      if (track.id === "mic") node = micGainRef.current;
      if (track.id === "music") node = musicGainRef.current;
      if (track.id === "system") node = systemGainRef.current;

      if (node) {
        node.gain.setTargetAtTime(targetGain, now, RAMP_TIME);
      }
    });
  }, [tracks, autoDucking]);

  useEffect(() => {
    updateTrackGains();
  }, [updateTrackGains]);

  /**
   * MASTER GAIN RAMPING
   */
  useEffect(() => {
    if (masterGainRef.current && audioContextRef.current) {
      const target = masterMuted ? 0 : masterVolume / 100;
      masterGainRef.current.gain.setTargetAtTime(target, audioContextRef.current.currentTime, RAMP_TIME);
    }
  }, [masterVolume, masterMuted]);

  /**
   * METERING LOOP
   */
  useEffect(() => {
    const meterLoop = () => {
      if (!analyserRef.current || !frequencyDataRef.current) {
        animFrameRef.current = requestAnimationFrame(meterLoop);
        return;
      }

      analyserRef.current.getByteFrequencyData(frequencyDataRef.current);
      const data = Array.from(frequencyDataRef.current) as number[];
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const level = Math.min(100, (avg / 255) * 100 * 3);

      setTracks(prev => prev.map(t => {
        // Simple visualization: only show levels for active sources
        let isActive = false;
        if (t.id === "mic" && mediaStream) isActive = true;
        if (t.id === "music" && isMusicPlaying) isActive = true;
        if (t.id === "system" && isCapturingSystem) isActive = true;

        const currentLevel = isActive ? level : 0;
        return {
          ...t,
          level: currentLevel,
          peakLevel: Math.max(t.peakLevel * 0.95, currentLevel)
        };
      }));

      animFrameRef.current = requestAnimationFrame(meterLoop);
    };
    
    animFrameRef.current = requestAnimationFrame(meterLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [mediaStream, isMusicPlaying, isCapturingSystem]);

  /**
   * MUSIC PLAYER CONTROLS
   */
  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMusicFile(file);
      if (musicAudioRef.current) {
        musicAudioRef.current.src = URL.createObjectURL(file);
        setIsMusicPlaying(false);
      }
      initAudioContext();
    }
  };

  const toggleMusic = () => {
    if (!musicAudioRef.current || !musicFile) {
      musicInputRef.current?.click();
      return;
    }
    
    initAudioContext();
    if (isMusicPlaying) {
      musicAudioRef.current.pause();
    } else {
      musicAudioRef.current.play().catch(e => toast.error("Playback failed"));
    }
    setIsMusicPlaying(!isMusicPlaying);
  };

  return (
    <Card className="bg-slate-950 border-slate-800 shadow-2xl overflow-hidden flex flex-col h-full border-2">
      {/* Top Header with Stats */}
      <div className="bg-slate-900/80 p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-2 rounded-lg">
            <Waves className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <div>
            <h2 className="text-white font-black text-sm uppercase tracking-tighter">Pro Audio Engine v2</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-slate-500 font-mono uppercase">{audioInfo.sampleRate}Hz</span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              <span className="text-[10px] text-slate-500 font-mono uppercase">{audioInfo.latency} Latency</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className={`h-8 text-[10px] font-bold uppercase gap-2 border-slate-700 ${isCapturingSystem ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-slate-800 text-slate-400'}`}
            onClick={isCapturingSystem ? stopSystemCapture : startSystemCapture}
          >
            <Radio className={`w-3 h-3 ${isCapturingSystem ? 'animate-pulse' : ''}`} />
            {isCapturingSystem ? "System Live" : "Capture System"}
          </Button>
          <div className="flex items-center gap-2 mr-4">
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 text-[9px] font-black uppercase gap-1.5 px-2 ${autoDucking ? 'text-primary bg-primary/10' : 'text-slate-500'}`}
              onClick={() => setAutoDucking(!autoDucking)}
            >
              <Zap className={`w-3 h-3 ${autoDucking ? 'fill-primary' : ''}`} />
              Auto-Duck
            </Button>
          </div>
          <div className="flex bg-slate-800 rounded-lg p-1">
            {(["mixer", "eq", "effects"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all ${
                  activeTab === tab ? "bg-primary text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 p-4">
        {activeTab === "mixer" && (
          <div className="grid grid-cols-3 gap-4 h-full">
            {tracks.map(track => (
              <div key={track.id} className="bg-slate-900/40 rounded-2xl p-4 border border-slate-800/50 flex flex-col items-center group relative overflow-hidden">
                {/* Visual Level Meter Background */}
                <div className="absolute inset-x-0 bottom-0 bg-primary/5 transition-all duration-300" style={{ height: `${track.level}%` }} />
                
                <div className={`p-3 rounded-xl mb-4 transition-all ${track.muted ? 'bg-slate-800 text-slate-600' : 'bg-primary/10 text-primary shadow-lg shadow-primary/10'}`}>
                  {track.icon}
                </div>
                
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">{track.name}</h3>
                
                {/* Professional Vertical Fader */}
                <div className="flex-1 w-full flex justify-center gap-4 mb-6">
                  <div className="relative w-12 h-full bg-slate-950 rounded-full border border-slate-800 flex flex-col items-center py-4 group-hover:border-slate-700 transition-colors">
                    {/* Level Meter (Small side bar) */}
                    <div className="absolute right-1 inset-y-4 w-1 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div 
                        className="w-full bg-green-500 absolute bottom-0" 
                        animate={{ height: `${track.level}%` }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    </div>
                    
                    <Slider
                      orientation="vertical"
                      value={[track.volume]}
                      max={100}
                      step={1}
                      onValueChange={([val]) => {
                        setTracks(prev => prev.map(t => t.id === track.id ? { ...t, volume: val } : t));
                        onVolumeChange?.(track.id, val);
                      }}
                      className="h-full"
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center gap-3 w-full">
                  <span className="text-[10px] font-mono text-slate-500">{track.volume}%</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-10 w-10 rounded-xl transition-all ${
                      track.muted 
                        ? "bg-red-500/20 text-red-500 hover:bg-red-500/30" 
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                    onClick={() => {
                      const newMuted = !track.muted;
                      setTracks(prev => prev.map(t => t.id === track.id ? { ...t, muted: newMuted } : t));
                      onMuteChange?.(track.id, newMuted);
                    }}
                  >
                    {track.muted ? <MicOff className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                </div>

                {/* Track Specific Controls */}
                {track.id === "music" && (
                  <div className="mt-4 pt-4 border-t border-slate-800 w-full flex justify-center gap-2">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500" onClick={toggleMusic}>
                      {isMusicPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500" onClick={() => musicInputRef.current?.click()}>
                      <Upload className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === "eq" && (
          <div className="bg-slate-900/40 rounded-2xl p-6 border border-slate-800/50 h-full flex flex-col">
            <div className="flex items-center gap-3 mb-8">
              <Sliders className="w-5 h-5 text-primary" />
              <h3 className="text-white font-black text-sm uppercase italic">Parametric Equalizer</h3>
            </div>
            
            <div className="flex-1 flex items-end justify-between gap-4 px-4 pb-8">
              {[
                { label: "Bass", freq: "60Hz", key: "bass" },
                { label: "L-Mid", freq: "250Hz", key: "lowMid" },
                { label: "Mid", freq: "1kHz", key: "mid" },
                { label: "H-Mid", freq: "4kHz", key: "highMid" },
                { label: "High", freq: "12kHz", key: "treble" },
              ].map(band => (
                <div key={band.key} className="flex-1 flex flex-col items-center gap-4 h-full">
                  <div className="flex-1 w-2 bg-slate-950 rounded-full relative">
                    <Slider
                      orientation="vertical"
                      value={[effects[band.key as keyof AudioEffects]]}
                      min={-12}
                      max={12}
                      step={0.5}
                      onValueChange={([val]) => setEffects(prev => ({ ...prev, [band.key]: val }))}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-white uppercase">{band.label}</p>
                    <p className="text-[8px] font-mono text-slate-500 mt-0.5">{band.freq}</p>
                    <p className={`text-[10px] font-mono mt-1 ${effects[band.key as keyof AudioEffects] > 0 ? 'text-primary' : effects[band.key as keyof AudioEffects] < 0 ? 'text-red-400' : 'text-slate-600'}`}>
                      {effects[band.key as keyof AudioEffects] > 0 ? '+' : ''}{effects[band.key as keyof AudioEffects]}dB
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "effects" && (
          <div className="grid grid-cols-2 gap-4 h-full overflow-y-auto pr-2 custom-scrollbar">
            {/* Compressor Card */}
            <div className="bg-slate-900/40 rounded-2xl p-5 border border-slate-800/50">
              <div className="flex items-center gap-2 mb-6">
                <Activity className="w-4 h-4 text-primary" />
                <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Dynamic Compressor</h4>
              </div>
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-[9px] font-black uppercase text-slate-500">
                    <span>Threshold</span>
                    <span className="text-primary">{effects.compressorThreshold}dB</span>
                  </div>
                  <Slider 
                    value={[effects.compressorThreshold]} 
                    min={-60} max={0} 
                    onValueChange={([val]) => setEffects(prev => ({ ...prev, compressorThreshold: val }))} 
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-[9px] font-black uppercase text-slate-500">
                    <span>Ratio</span>
                    <span className="text-primary">{effects.compressorRatio}:1</span>
                  </div>
                  <Slider 
                    value={[effects.compressorRatio]} 
                    min={1} max={20} 
                    onValueChange={([val]) => setEffects(prev => ({ ...prev, compressorRatio: val }))} 
                  />
                </div>
              </div>
            </div>

            {/* Reverb/Delay Card */}
            <div className="bg-slate-900/40 rounded-2xl p-5 border border-slate-800/50">
              <div className="flex items-center gap-2 mb-6">
                <Disc className="w-4 h-4 text-primary" />
                <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Spatial Effects</h4>
              </div>
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-[9px] font-black uppercase text-slate-500">
                    <span>Reverb Mix</span>
                    <span className="text-primary">{Math.round(effects.reverbMix * 100)}%</span>
                  </div>
                  <Slider 
                    value={[effects.reverbMix * 100]} 
                    min={0} max={100} 
                    onValueChange={([val]) => setEffects(prev => ({ ...prev, reverbMix: val / 100 }))} 
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-[9px] font-black uppercase text-slate-500">
                    <span>Delay Mix</span>
                    <span className="text-primary">{Math.round(effects.delayMix * 100)}%</span>
                  </div>
                  <Slider 
                    value={[effects.delayMix * 100]} 
                    min={0} max={100} 
                    onValueChange={([val]) => setEffects(prev => ({ ...prev, delayMix: val / 100 }))} 
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Master Section */}
      <div className="bg-slate-900 p-6 border-t border-slate-800">
        <div className="flex items-center gap-8">
          <div className="flex-1 flex items-center gap-6">
            <div className={`p-3 rounded-2xl transition-all ${masterMuted ? 'bg-red-500/20 text-red-500' : 'bg-primary/20 text-primary'}`}>
              <Headphones className="w-6 h-6" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex justify-between">
                <span className="text-[10px] font-black text-white uppercase tracking-widest italic">Master Output</span>
                <span className="text-[10px] font-mono text-primary">{masterVolume}%</span>
              </div>
              <Slider
                value={[masterVolume]}
                max={100}
                onValueChange={([val]) => setMasterVolume(val)}
                className="cursor-pointer"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant={masterMuted ? "destructive" : "secondary"}
              size="icon"
              className="h-12 w-12 rounded-2xl shadow-xl"
              onClick={() => setMasterMuted(!masterMuted)}
            >
              {masterMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
            <div className="w-32 h-12 bg-slate-950 rounded-2xl border border-slate-800 flex items-center px-4 overflow-hidden relative">
              <div className="flex-1 flex gap-0.5 items-end h-6">
                {Array.from({ length: 20 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1 bg-primary/40 rounded-full"
                    animate={{ 
                      height: masterMuted ? "10%" : `${20 + Math.random() * 80}%`,
                      backgroundColor: i > 15 ? "#ef4444" : i > 12 ? "#eab308" : "#3b82f6"
                    }}
                    transition={{ duration: 0.1, repeat: Infinity }}
                  />
                ))}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Music Player */}
      <audio ref={musicAudioRef} loop className="hidden" />
      <input 
        type="file" 
        ref={musicInputRef} 
        className="hidden" 
        accept="audio/*" 
        onChange={handleMusicUpload} 
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}</style>
    </Card>
  );
}

function VolumeX(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4.702a.702.702 0 0 1 1.182-.512l5.011 4.707a.702.702 0 0 1 0 1.02l-5.011 4.707a.702.702 0 0 1-1.182-.512V4.702z" />
      <path d="M16 9l5 5" />
      <path d="M21 9l-5 5" />
      <path d="M2 10v4a2 2 0 0 0 2 2h3l5 5V3L7 8H4a2 2 0 0 0-2 2z" />
    </svg>
  );
}
