import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Volume2, Mic, MicOff, Sliders, Music, Monitor,
  Waves, Activity, Disc, Headphones, Speaker
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface MixerTrack {
  id: string;
  name: string;
  icon: React.ReactNode;
  volume: number;
  muted: boolean;
  level: number;
  peakLevel: number;
  gainNode?: GainNode;
  analyser?: AnalyserNode;
}

interface AudioEffects {
  // EQ bands (Hz)
  bass: number;       // 60Hz
  lowMid: number;     // 250Hz
  mid: number;        // 1kHz
  highMid: number;    // 4kHz
  treble: number;     // 12kHz

  // Dynamics
  compressorThreshold: number;
  compressorRatio: number;
  compressorAttack: number;
  compressorRelease: number;

  // Effects
  reverbMix: number;
  reverbDecay: number;
  delayTime: number;
  delayFeedback: number;
  delayMix: number;

  // Master
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
}

export default function ProfessionalAudioMixer({
  mediaStream,
  onVolumeChange,
  onMuteChange,
}: ProfessionalAudioMixerProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

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
  const frequencyDataRef = useRef<Uint8Array | null>(null);
  const animFrameRef = useRef<number>(0);

  const [tracks, setTracks] = useState<MixerTrack[]>([
    { id: "mic", name: "Microphone", icon: <Mic className="w-4 h-4" />, volume: 80, muted: false, level: 0, peakLevel: 0 },
    { id: "music", name: "Music", icon: <Music className="w-4 h-4" />, volume: 50, muted: false, level: 0, peakLevel: 0 },
    { id: "system", name: "System", icon: <Monitor className="w-4 h-4" />, volume: 60, muted: false, level: 0, peakLevel: 0 },
  ]);

  const [masterVolume, setMasterVolume] = useState(85);
  const [masterMuted, setMasterMuted] = useState(false);
  const [effects, setEffects] = useState<AudioEffects>(DEFAULT_EFFECTS);
  const [activeTab, setActiveTab] = useState<"mixer" | "eq" | "effects" | "master">("mixer");
  const [audioInfo, setAudioInfo] = useState({
    sampleRate: 0,
    channels: 2,
    latency: "",
  });

  // Initialize audio graph
  useEffect(() => {
    if (!mediaStream) {
      // No stream — show mock levels
      return;
    }

    if (!audioContextRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;

      // Create destination for processed output
      const dest = ctx.createMediaStreamDestination();
      destinationRef.current = dest;

      // === EQ Chain ===
      const bass = ctx.createBiquadFilter();
      bass.type = "lowshelf";
      bass.frequency.value = 60;
      bass.Q.value = 1;
      bass.gain.value = effects.bass;
      bassNodeRef.current = bass;

      const lowMid = ctx.createBiquadFilter();
      lowMid.type = "peaking";
      lowMid.frequency.value = 250;
      lowMid.Q.value = 1.2;
      lowMid.gain.value = effects.lowMid;
      lowMidNodeRef.current = lowMid;

      const mid = ctx.createBiquadFilter();
      mid.type = "peaking";
      mid.frequency.value = 1000;
      mid.Q.value = 1;
      mid.gain.value = effects.mid;
      midNodeRef.current = mid;

      const highMid = ctx.createBiquadFilter();
      highMid.type = "peaking";
      highMid.frequency.value = 4000;
      highMid.Q.value = 1;
      highMid.gain.value = effects.highMid;
      highMidNodeRef.current = highMid;

      const treble = ctx.createBiquadFilter();
      treble.type = "highshelf";
      treble.frequency.value = 12000;
      treble.Q.value = 1;
      treble.gain.value = effects.treble;
      trebleNodeRef.current = treble;

      // === Compressor ===
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = effects.compressorThreshold;
      compressor.ratio.value = effects.compressorRatio;
      compressor.attack.value = effects.compressorAttack;
      compressor.release.value = effects.compressorRelease;
      compressor.knee.value = 6;
      compressorNodeRef.current = compressor;

      // === Delay ===
      const delay = ctx.createDelay(5);
      delay.delayTime.value = effects.delayTime;
      delayNodeRef.current = delay;

      const delayFeedback = ctx.createGain();
      delayFeedback.gain.value = effects.delayFeedback;
      delayFeedbackNodeRef.current = delayFeedback;

      const delayMix = ctx.createGain();
      delayMix.gain.value = effects.delayMix;
      delayMixNodeRef.current = delayMix;

      const delayDry = ctx.createGain();
      delayDry.gain.value = 1 - effects.delayMix;
      delayDryNodeRef.current = delayDry;

      // Delay routing
      delay.connect(delayFeedback);
      delayFeedback.connect(delay); // feedback loop
      delay.connect(delayMix);

      // === Reverb (synthetic impulse response) ===
      const reverb = ctx.createConvolver();
      // Create a synthetic reverb impulse
      const rate = ctx.sampleRate;
      const length = rate * effects.reverbDecay;
      const impulse = ctx.createBuffer(2, length, rate);
      for (let ch = 0; ch < 2; ch++) {
        const channelData = impulse.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
        }
      }
      reverb.buffer = impulse;
      reverbNodeRef.current = reverb;

      const reverbMix = ctx.createGain();
      reverbMix.gain.value = effects.reverbMix;
      reverbMixNodeRef.current = reverbMix;

      const reverbDry = ctx.createGain();
      reverbDry.gain.value = 1 - effects.reverbMix;
      reverbDryNodeRef.current = reverbDry;

      // === Limiter ===
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = effects.limiterThreshold;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.01;
      limiter.knee.value = 0;
      limiterNodeRef.current = limiter;

      // === Master Gain ===
      const masterGain = ctx.createGain();
      masterGain.gain.value = masterVolume / 100;
      masterGainRef.current = masterGain;

      // === Analyser ===
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);

      // === Source ===
      const source = ctx.createMediaStreamSource(mediaStream);
      sourceRef.current = source;

      // Build the graph: source → EQ → compressor → [delay + reverb parallel] → limiter → master → analyser → destination
      source.connect(bass);
      bass.connect(lowMid);
      lowMid.connect(mid);
      mid.connect(highMid);
      highMid.connect(treble);
      treble.connect(compressor);

      // After compressor, split to dry and effects
      compressor.connect(delayDry);
      compressor.connect(delay);
      compressor.connect(reverbDry);
      compressor.connect(reverb);

      // Dry + delay
      delayDry.connect(masterGain);
      delayMix.connect(masterGain);

      // Dry + reverb
      reverbDry.connect(masterGain);
      reverbMix.connect(masterGain);

      // Master → limiter → analyser → destination
      masterGain.connect(limiter);
      limiter.connect(analyser);
      analyser.connect(dest);

      setAudioInfo({
        sampleRate: ctx.sampleRate,
        channels: mediaStream.getAudioTracks()[0]?.getSettings().channelCount || 2,
        latency: `${(ctx.baseLatency * 1000).toFixed(1)}ms`,
      });
    }

    // Start level metering
    const meterLoop = () => {
      if (!analyserRef.current || !frequencyDataRef.current) {
        animFrameRef.current = requestAnimationFrame(meterLoop);
        return;
      }

      analyserRef.current.getByteFrequencyData(frequencyDataRef.current);
      const data = Array.from(frequencyDataRef.current) as number[];

      // Calculate overall level (RMS-like)
      const sum = data.reduce((a, b) => a + b, 0);
      const avg = sum / data.length;
      const level = Math.min(100, (avg / 255) * 100 * 3); // boost for visibility

      // Calculate peak (top 10%)
      const sorted = [...data].sort((a, b) => b - a);
      const peakChunk = sorted.slice(0, Math.floor(sorted.length * 0.1));
      const peakAvg = peakChunk.reduce((a, b) => a + b, 0) / peakChunk.length;
      const peak = Math.min(100, (peakAvg / 255) * 100 * 3);

      setTracks(prev => prev.map(t =>
        t.id === "mic"
          ? { ...t, level, peakLevel: Math.max(t.peakLevel * 0.95, peak) }
          : t
      ));

      animFrameRef.current = requestAnimationFrame(meterLoop);
    };
    animFrameRef.current = requestAnimationFrame(meterLoop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      // Don't close audio context on every effect change — only on unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaStream]);

  // Apply EQ changes
  const applyEQ = useCallback(() => {
    if (bassNodeRef.current) bassNodeRef.current.gain.value = effects.bass;
    if (lowMidNodeRef.current) lowMidNodeRef.current.gain.value = effects.lowMid;
    if (midNodeRef.current) midNodeRef.current.gain.value = effects.mid;
    if (highMidNodeRef.current) highMidNodeRef.current.gain.value = effects.highMid;
    if (trebleNodeRef.current) trebleNodeRef.current.gain.value = effects.treble;
  }, [effects]);

  // Apply compressor changes
  const applyCompressor = useCallback(() => {
    if (compressorNodeRef.current) {
      compressorNodeRef.current.threshold.value = effects.compressorThreshold;
      compressorNodeRef.current.ratio.value = effects.compressorRatio;
      compressorNodeRef.current.attack.value = effects.compressorAttack;
      compressorNodeRef.current.release.value = effects.compressorRelease;
    }
  }, [effects]);

  // Apply delay changes
  const applyDelay = useCallback(() => {
    if (delayNodeRef.current) delayNodeRef.current.delayTime.value = effects.delayTime;
    if (delayFeedbackNodeRef.current) delayFeedbackNodeRef.current.gain.value = effects.delayFeedback;
    if (delayMixNodeRef.current) delayMixNodeRef.current.gain.value = effects.delayMix;
    if (delayDryNodeRef.current) delayDryNodeRef.current.gain.value = 1 - effects.delayMix;
  }, [effects]);

  // Apply reverb changes
  const applyReverb = useCallback(() => {
    if (reverbMixNodeRef.current) reverbMixNodeRef.current.gain.value = effects.reverbMix;
    if (reverbDryNodeRef.current) reverbDryNodeRef.current.gain.value = 1 - effects.reverbMix;
  }, [effects]);

  // Apply limiter
  const applyLimiter = useCallback(() => {
    if (limiterNodeRef.current) {
      limiterNodeRef.current.threshold.value = effects.limiterThreshold;
    }
  }, [effects]);

  // Apply master volume
  const applyMasterVolume = useCallback(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = masterMuted ? 0 : masterVolume / 100;
    }
  }, [masterVolume, masterMuted]);

  useEffect(() => applyEQ(), [applyEQ]);
  useEffect(() => applyCompressor(), [applyCompressor]);
  useEffect(() => applyDelay(), [applyDelay]);
  useEffect(() => applyReverb(), [applyReverb]);
  useEffect(() => applyLimiter(), [applyLimiter]);
  useEffect(() => applyMasterVolume(), [applyMasterVolume]);

  const toggleTrackMute = (id: string) => {
    setTracks(prev => prev.map(t =>
      t.id === id ? { ...t, muted: !t.muted } : t
    ));
    if (onMuteChange) {
      const track = tracks.find(t => t.id === id);
      if (track) onMuteChange(id, !track.muted);
    }
  };

  const handleTrackVolume = (id: string, volume: number) => {
    setTracks(prev => prev.map(t =>
      t.id === id ? { ...t, volume } : t
    ));
    if (onVolumeChange) onVolumeChange(id, volume);
  };

  const handleMasterVolumeChange = (v: number) => {
    setMasterVolume(v);
    setMasterMuted(false);
  };

  const resetEffects = () => {
    setEffects(DEFAULT_EFFECTS);
    toast.success("Effects reset to default");
  };

  const formatHz = (hz: number) => {
    if (hz >= 1000) return `${hz / 1000}k`;
    return `${hz}`;
  };

  // Level meter component
  const LevelMeter = ({ level, peakLevel, height = "h-32" }: { level: number; peakLevel: number; height?: string }) => {
    return (
      <div className={`relative ${height} w-4 bg-slate-800 rounded-full overflow-hidden mx-auto`}>
        <div
          className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-75"
          style={{
            height: `${level}%`,
            background: level > 85
              ? "linear-gradient(to top, #ef4444, #f97316)"
              : level > 60
                ? "linear-gradient(to top, #eab308, #f97316)"
                : "linear-gradient(to top, #22c55e, #eab308)",
          }}
        />
        <div
          className="absolute left-0 right-0 h-[2px] bg-red-400/80 transition-all duration-200"
          style={{ bottom: `${peakLevel}%` }}
        />
        {/* dB scale */}
        <div className="absolute -right-8 top-0 bottom-0 flex flex-col justify-between text-[8px] text-muted-foreground">
          <span>0</span>
          <span>-12</span>
          <span>-24</span>
          <span>-inf</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Tab Selector */}
      <div className="flex gap-1 bg-void/60 rounded-lg p-1 border border-border/40">
        {([
          { key: "mixer", label: "Mixer", icon: <Sliders className="w-3.5 h-3.5" /> },
          { key: "eq", label: "EQ", icon: <Waves className="w-3.5 h-3.5" /> },
          { key: "effects", label: "Effects", icon: <Disc className="w-3.5 h-3.5" /> },
          { key: "master", label: "Master", icon: <Speaker className="w-3.5 h-3.5" /> },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-colors ${
              activeTab === tab.key
                ? "bg-ember text-ember-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-primary/10"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== MIXER TAB ===== */}
      {activeTab === "mixer" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-gradient-to-br from-slate-900/60 to-slate-900/30 rounded-xl p-6 border border-purple-500/20"
        >
          {/* Channel Strips */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {tracks.map((track) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50"
              >
                {/* Track header */}
                <div className="text-center mb-3">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    {track.icon}
                    <span className="text-xs font-bold text-white">{track.name}</span>
                  </div>
                  {track.muted && (
                    <span className="text-[10px] text-destructive font-bold">MUTED</span>
                  )}
                </div>

                {/* Level meter */}
                <div className="flex items-end justify-center gap-1 mb-3">
                  <LevelMeter level={track.level} peakLevel={track.peakLevel} />
                </div>

                {/* Mute button */}
                <button
                  onClick={() => toggleTrackMute(track.id)}
                  className={`w-full py-1.5 rounded text-xs font-bold transition-colors mb-3 ${
                    track.muted
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {track.muted ? <MicOff className="w-3 h-3 inline mr-1" /> : <Mic className="w-3 h-3 inline mr-1" />}
                  {track.muted ? "UNMUTE" : "MUTE"}
                </button>

                {/* Volume slider */}
                <div className="space-y-1">
                  <div className="text-center text-xs text-purple-300 font-mono">{track.volume}%</div>
                  <Slider
                    value={[track.volume]}
                    onValueChange={([v]) => handleTrackVolume(track.id, v)}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>
              </motion.div>
            ))}

            {/* Master channel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-b from-purple-900/30 to-slate-800/50 rounded-lg p-3 border border-purple-500/30"
            >
              <div className="text-center mb-3">
                <Speaker className="w-4 h-4 mx-auto mb-1 text-purple-400" />
                <span className="text-xs font-bold text-white">MASTER</span>
              </div>

              <div className="flex items-end justify-center gap-1 mb-3">
                <LevelMeter
                  level={tracks[0]?.level || 0}
                  peakLevel={tracks[0]?.peakLevel || 0}
                  height="h-40"
                />
              </div>

              <button
                onClick={() => setMasterMuted(!masterMuted)}
                className={`w-full py-1.5 rounded text-xs font-bold transition-colors mb-3 ${
                  masterMuted
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-purple-800 text-purple-200 hover:bg-purple-700"
                }`}
              >
                {masterMuted ? <MicOff className="w-3 h-3 inline mr-1" /> : <Speaker className="w-3 h-3 inline mr-1" />}
                {masterMuted ? "UNMUTE" : "MUTE"}
              </button>

              <div className="space-y-1">
                <div className="text-center text-xs text-purple-300 font-mono">{masterVolume}%</div>
                <Slider
                  value={[masterVolume]}
                  onValueChange={([v]) => handleMasterVolumeChange(v)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            </motion.div>
          </div>

          {/* Audio Info */}
          <Card className="bg-slate-900/40 border-purple-500/10 p-3">
            <div className="grid grid-cols-3 gap-4 text-xs text-gray-400">
              <div className="flex justify-between">
                <span>Sample Rate:</span>
                <span className="text-purple-300 font-semibold">{audioInfo.sampleRate > 0 ? `${(audioInfo.sampleRate / 1000).toFixed(1)} kHz` : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span>Channels:</span>
                <span className="text-purple-300 font-semibold">{audioInfo.channels === 1 ? "Mono" : "Stereo"}</span>
              </div>
              <div className="flex justify-between">
                <span>Latency:</span>
                <span className="text-purple-300 font-semibold">{audioInfo.latency || "—"}</span>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ===== EQ TAB ===== */}
      {activeTab === "eq" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-gradient-to-br from-blue-900/20 to-slate-900/30 rounded-xl p-6 border border-blue-500/20"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Waves className="w-5 h-5 text-blue-400" />
              5-Band Equalizer
            </h3>
            <Button variant="outline" size="sm" onClick={resetEffects} className="text-xs">
              Reset All
            </Button>
          </div>

          <div className="grid grid-cols-5 gap-3 mb-6">
            {[
              { key: "bass" as const, label: "BASS", hz: "60 Hz", color: "text-red-400" },
              { key: "lowMid" as const, label: "LOW MID", hz: "250 Hz", color: "text-orange-400" },
              { key: "mid" as const, label: "MID", hz: "1 kHz", color: "text-yellow-400" },
              { key: "highMid" as const, label: "HIGH MID", hz: "4 kHz", color: "text-emerald-400" },
              { key: "treble" as const, label: "TREBLE", hz: "12 kHz", color: "text-blue-400" },
            ].map(band => (
              <div key={band.key} className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/30 text-center">
                <p className={`text-[10px] font-bold ${band.color} mb-1`}>{band.label}</p>
                <p className="text-[10px] text-gray-500 mb-3">{band.hz}</p>
                <Slider
                  value={[effects[band.key] + 12]} // 0-24 maps to -12 to +12 dB
                  onValueChange={([v]) => setEffects(prev => ({ ...prev, [band.key]: v - 12 }))}
                  min={0}
                  max={24}
                  step={0.5}
                  className="w-full mb-2"
                  style={{ height: "120px" }}
                  orientation="vertical"
                />
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>-12dB</span>
                  <span>0dB</span>
                  <span>+12dB</span>
                </div>
                <p className="text-sm font-mono text-white mt-2">
                  {effects[band.key] > 0 ? "+" : ""}{effects[band.key].toFixed(1)} dB
                </p>
              </div>
            ))}
          </div>

          {/* Visual EQ curve indicator */}
          <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700/30">
            <p className="text-xs text-gray-400 mb-2">EQ Curve</p>
            <div className="h-20 flex items-end justify-around gap-1">
              {(["bass", "lowMid", "mid", "highMid", "treble"] as const).map(key => {
                const val = effects[key];
                const pct = ((val + 12) / 24) * 100;
                return (
                  <motion.div
                    key={key}
                    animate={{ height: `${pct}%` }}
                    className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t"
                    style={{ minHeight: "4px" }}
                  />
                );
              })}
            </div>
            <div className="flex justify-around mt-1">
              {["60Hz", "250Hz", "1kHz", "4kHz", "12kHz"].map(hz => (
                <span key={hz} className="text-[9px] text-gray-500">{hz}</span>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ===== EFFECTS TAB ===== */}
      {activeTab === "effects" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* Compressor */}
          <Card className="bg-gradient-to-br from-amber-900/20 to-slate-900/30 border-amber-500/20 p-5">
            <h4 className="font-bold text-white mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              Compressor
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-400 flex justify-between">
                  <span>Threshold</span>
                  <span className="text-amber-300">{effects.compressorThreshold} dB</span>
                </label>
                <Slider
                  value={[effects.compressorThreshold + 60]}
                  onValueChange={([v]) => setEffects(prev => ({ ...prev, compressorThreshold: v - 60 }))}
                  min={0}
                  max={60}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400 flex justify-between">
                  <span>Ratio</span>
                  <span className="text-amber-300">{effects.compressorRatio}:1</span>
                </label>
                <Slider
                  value={[effects.compressorRatio]}
                  onValueChange={([v]) => setEffects(prev => ({ ...prev, compressorRatio: v }))}
                  min={1}
                  max={20}
                  step={0.5}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400 flex justify-between">
                  <span>Attack</span>
                  <span className="text-amber-300">{effects.compressorAttack * 1000}ms</span>
                </label>
                <Slider
                  value={[effects.compressorAttack * 1000]}
                  onValueChange={([v]) => setEffects(prev => ({ ...prev, compressorAttack: v / 1000 }))}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400 flex justify-between">
                  <span>Release</span>
                  <span className="text-amber-300">{effects.compressorRelease * 1000}ms</span>
                </label>
                <Slider
                  value={[effects.compressorRelease * 1000]}
                  onValueChange={([v]) => setEffects(prev => ({ ...prev, compressorRelease: v / 1000 }))}
                  min={10}
                  max={1000}
                  step={10}
                />
              </div>
            </div>
          </Card>

          {/* Delay */}
          <Card className="bg-gradient-to-br from-cyan-900/20 to-slate-900/30 border-cyan-500/20 p-5">
            <h4 className="font-bold text-white mb-4 flex items-center gap-2">
              <Disc className="w-4 h-4 text-cyan-400" />
              Delay
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-400 flex justify-between">
                  <span>Time</span>
                  <span className="text-cyan-300">{effects.delayTime}s</span>
                </label>
                <Slider
                  value={[effects.delayTime * 10]}
                  onValueChange={([v]) => setEffects(prev => ({ ...prev, delayTime: v / 10 }))}
                  min={0}
                  max={50}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400 flex justify-between">
                  <span>Feedback</span>
                  <span className="text-cyan-300">{(effects.delayFeedback * 100).toFixed(0)}%</span>
                </label>
                <Slider
                  value={[effects.delayFeedback * 100]}
                  onValueChange={([v]) => setEffects(prev => ({ ...prev, delayFeedback: v / 100 }))}
                  min={0}
                  max={90}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400 flex justify-between">
                  <span>Mix</span>
                  <span className="text-cyan-300">{(effects.delayMix * 100).toFixed(0)}%</span>
                </label>
                <Slider
                  value={[effects.delayMix * 100]}
                  onValueChange={([v]) => setEffects(prev => ({ ...prev, delayMix: v / 100 }))}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
            </div>
          </Card>

          {/* Reverb */}
          <Card className="bg-gradient-to-br from-purple-900/20 to-slate-900/30 border-purple-500/20 p-5">
            <h4 className="font-bold text-white mb-4 flex items-center gap-2">
              <Headphones className="w-4 h-4 text-purple-400" />
              Reverb
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-400 flex justify-between">
                  <span>Mix</span>
                  <span className="text-purple-300">{(effects.reverbMix * 100).toFixed(0)}%</span>
                </label>
                <Slider
                  value={[effects.reverbMix * 100]}
                  onValueChange={([v]) => setEffects(prev => ({ ...prev, reverbMix: v / 100 }))}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400 flex justify-between">
                  <span>Decay</span>
                  <span className="text-purple-300">{effects.reverbDecay.toFixed(1)}s</span>
                </label>
                <Slider
                  value={[effects.reverbDecay * 2]}
                  onValueChange={([v]) => setEffects(prev => ({ ...prev, reverbDecay: v / 2 }))}
                  min={0}
                  max={20}
                  step={0.5}
                />
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ===== MASTER TAB ===== */}
      {activeTab === "master" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* Master Volume */}
          <Card className="bg-gradient-to-br from-rose-900/20 to-slate-900/30 border-rose-500/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Volume2 className="w-6 h-6 text-rose-400" />
                <h3 className="font-bold text-white text-lg">Master Output</h3>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-rose-300">{masterVolume}%</div>
              </div>
            </div>

            <Slider
              value={[masterVolume]}
              onValueChange={([v]) => handleMasterVolumeChange(v)}
              max={100}
              step={1}
              className="w-full mb-4"
            />

            <Button
              onClick={() => setMasterMuted(!masterMuted)}
              variant={masterMuted ? "destructive" : "outline"}
              className="w-full gap-2"
            >
              {masterMuted ? <MicOff className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {masterMuted ? "MASTER MUTED — CLICK TO UNMUTE" : "MUTE MASTER"}
            </Button>
          </Card>

          {/* Limiter */}
          <Card className="bg-gradient-to-br from-red-900/20 to-slate-900/30 border-red-500/20 p-5">
            <h4 className="font-bold text-white mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-red-400" />
              Limiter (Final Output Safety)
            </h4>
            <div className="space-y-2">
              <label className="text-xs text-gray-400 flex justify-between">
                <span>Threshold</span>
                <span className="text-red-300">{effects.limiterThreshold} dB</span>
              </label>
              <Slider
                value={[effects.limiterThreshold + 60]}
                onValueChange={([v]) => setEffects(prev => ({ ...prev, limiterThreshold: v - 60 }))}
                min={0}
                max={60}
                step={1}
              />
              <p className="text-[10px] text-gray-500">Prevents clipping by limiting the final output level</p>
            </div>
          </Card>

          {/* Quick Presets */}
          <Card className="bg-gradient-to-br from-slate-800/40 to-slate-900/30 border-slate-700/30 p-5">
            <h4 className="font-bold text-white mb-3">Quick Presets</h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: "Church Service", desc: "Clear vocals, warm bass", settings: { bass: 2, lowMid: -1, mid: 1, highMid: 2, treble: 1 } },
                { name: "Music Performance", desc: "Full spectrum, punchy", settings: { bass: 4, lowMid: 2, mid: 0, highMid: 3, treble: 4 } },
                { name: "Speech/Podcast", desc: "Clear mid-range focus", settings: { bass: -2, lowMid: -1, mid: 3, highMid: 4, treble: 2 } },
                { name: "Flat/Neutral", desc: "No coloration", settings: { bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0 } },
              ].map(preset => (
                <button
                  key={preset.name}
                  onClick={() => {
                    setEffects(prev => ({ ...prev, ...preset.settings }));
                    toast.success(`Applied: ${preset.name}`);
                  }}
                  className="p-3 rounded-lg border border-slate-600/50 hover:border-ember/50 hover:bg-ember/5 text-left transition-colors"
                >
                  <p className="text-sm font-semibold text-white">{preset.name}</p>
                  <p className="text-[10px] text-gray-400">{preset.desc}</p>
                </button>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
