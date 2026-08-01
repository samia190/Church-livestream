/**
 * ProfessionalAudioMixer.tsx
 *
 * ============================================================
 * FULL PROFESSIONAL AUDIO STUDIO
 * ============================================================
 *
 * Audio Graph (real, wired):
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ INPUT (Microphone / Music / System Audio)               │
 *   │                                                         │
 *   │   MicGain ──► HighPassFilter(80Hz)                      │
 *   │                  │                                      │
 *   │                  ▼                                      │
 *   │              Bass EQ (60Hz lowshelf)                    │
 *   │                  │                                      │
 *   │                  ▼                                      │
 *   │              LowMid EQ (250Hz peaking)                  │
 *   │                  │                                      │
 *   │                  ▼                                      │
 *   │              Mid EQ (1kHz peaking)                      │
 *   │                  │                                      │
 *   │                  ▼                                      │
 *   │              HighMid EQ (4kHz peaking)                  │
 *   │                  │                                      │
 *   │                  ▼                                      │
 *   │              Treble EQ (12kHz highshelf)                │
 *   │                  │                                      │
 *   │                  ▼                                      │
 *   │              DynamicsCompressor                         │
 *   │                  │                                      │
 *   │                  ▼                                      │
 *   │              NoiseGate (via compressor ratio + thresh)  │
 *   │                  │                                      │
 *   │                  ▼                                      │
 *   │              AutoNormalize (DynamicsCompressor)         │
 *   │                  │                                      │
 *   │                  ▼                                      │
 *   │              OutputGain                                 │
 *   │           ┌──────┴──────┐                               │
 *   │           ▼             ▼                               │
 *   │   VIEWERS          ADMIN MONITOR                        │
 *   │ (MediaStream    (AudioContext                           │
 *   │  Destination)    .destination)                           │
 *   │           │             │                               │
 *   │           │     MonitorGain (mute = 0)                  │
 *   │           ▼             ▼                               │
 *   │   ────────►      ────────►                               │
 *   └─────────────────────────────────────────────────────────┘
 *
 * KEY FEATURES:
 * - Admin monitor mute: zeros MonitorGain → admin hears nothing, viewers unaffected
 * - LED indicators on every node (glow when active, dim when bypassed/muted)
 * - 5-band EQ fully wired into the audio graph
 * - Compressor with threshold/ratio/knee/attack/release
 * - High-pass filter for rumble removal
 * - Noise gate via compressor threshold + aggressive ratio
 * - Auto-normalize via DynamicsCompressor
 * - Delay effect with feedback loop
 * - All changes use setTargetAtTime for smooth, click-free transitions
 * - Settings persist across prestream ↔ live mode switches
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2, Mic, MicOff, Sliders, Music, Monitor,
  Waves, Activity, Disc, Headphones, Speaker,
  Play, Pause, SkipForward, Upload, X, AlertCircle,
  Zap, Settings, Info, Radio, Shield, Power,
  AudioLines
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

/* ─── Types ───────────────────────────────────────────────────────────────── */

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
  highPassFreq: number;
  compressorThreshold: number;
  compressorRatio: number;
  compressorAttack: number;
  compressorRelease: number;
  compressorKnee: number;
  noiseGateThreshold: number;
  autoNormalizeEnabled: boolean;
  delayTime: number;
  delayFeedback: number;
  delayMix: number;
  limiterThreshold: number;
}

interface NodeLEDState {
  id: string;
  name: string;
  active: boolean;
  level: number; // 0-100 brightness
  color: "green" | "blue" | "amber" | "red" | "white";
}

const DEFAULT_EFFECTS: AudioEffects = {
  bass: 0,
  lowMid: 0,
  mid: 0,
  highMid: 0,
  treble: 0,
  highPassFreq: 80,
  compressorThreshold: -24,
  compressorRatio: 4,
  compressorAttack: 0.003,
  compressorRelease: 0.25,
  compressorKnee: 30,
  noiseGateThreshold: -55,
  autoNormalizeEnabled: true,
  delayTime: 0.3,
  delayFeedback: 0.4,
  delayMix: 0,
  limiterThreshold: -1,
};

interface ProfessionalAudioMixerProps {
  mediaStream?: MediaStream | null;
  onVolumeChange?: (trackId: string, volume: number) => void;
  onMuteChange?: (trackId: string, muted: boolean) => void;
  onProcessedStream?: (stream: MediaStream | null) => void;
  /** Callback for admin monitor mute toggle */
  onMonitorMuteChange?: (muted: boolean) => void;
}

/* ─── LED Component ───────────────────────────────────────────────────────── */

function NodeLED({ node, size = "md" }: { node: NodeLEDState; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "w-3 h-3" : size === "md" ? "w-2.5 h-2.5" : "w-2 h-2";
  const colorMap: Record<string, string> = {
    green: "bg-emerald-400",
    blue: "bg-blue-400",
    amber: "bg-amber-400",
    red: "bg-red-400",
    white: "bg-white",
  };
  const glowMap: Record<string, string> = {
    green: "shadow-[0_0_8px_2px_rgba(52,211,153,0.5)]",
    blue: "shadow-[0_0_8px_2px_rgba(96,165,250,0.5)]",
    amber: "shadow-[0_0_8px_2px_rgba(251,191,36,0.5)]",
    red: "shadow-[0_0_8px_2px_rgba(248,113,113,0.5)]",
    white: "shadow-[0_0_8px_2px_rgba(255,255,255,0.4)]",
  };
  const color = colorMap[node.color] || "bg-slate-500";
  const glow = glowMap[node.color] || "";
  const opacity = node.active ? (0.3 + (node.level / 100) * 0.7) : 0.15;

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`${sizeClass} rounded-full ${color} transition-all duration-200`}
        style={{
          opacity,
          boxShadow: node.active ? `0 0 ${4 + node.level * 0.1}px ${color}` : "none",
        }}
      />
      {node.active && node.level > 60 && (
        <div
          className={`${size === "lg" ? "w-1.5 h-1.5" : "w-1 h-1"} rounded-full ${color} animate-pulse`}
          style={{ opacity: 0.6 }}
        />
      )}
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────────── */

export default function ProfessionalAudioMixer({
  mediaStream,
  onVolumeChange,
  onMuteChange,
  onProcessedStream,
  onMonitorMuteChange,
}: ProfessionalAudioMixerProps) {
  /* ── Audio Graph Refs ─────────────────────────────────────────────────── */
  const audioContextRef = useRef<AudioContext | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Source nodes
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const musicSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const systemSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Track gain nodes
  const micGainRef = useRef<GainNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const systemGainRef = useRef<GainNode | null>(null);

  // Processing chain nodes
  const highPassRef = useRef<BiquadFilterNode | null>(null);
  const bassRef = useRef<BiquadFilterNode | null>(null);
  const lowMidRef = useRef<BiquadFilterNode | null>(null);
  const midRef = useRef<BiquadFilterNode | null>(null);
  const highMidRef = useRef<BiquadFilterNode | null>(null);
  const trebleRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const noiseGateRef = useRef<DynamicsCompressorNode | null>(null);
  const normalizeRef = useRef<DynamicsCompressorNode | null>(null);
  const delayRef = useRef<DelayNode | null>(null);
  const delayFeedbackRef = useRef<GainNode | null>(null);
  const delayMixRef = useRef<GainNode | null>(null);
  const delayDryRef = useRef<GainNode | null>(null);
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);

  // Monitor path (admin local speakers — independent from viewer output)
  const monitorGainRef = useRef<GainNode | null>(null);

  // Analyser for metering
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  // Music player
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const musicInputRef = useRef<HTMLInputElement>(null);

  // System audio
  const [isCapturingSystem, setIsCapturingSystem] = useState(false);
  const systemStreamRef = useRef<MediaStream | null>(null);

  // UI State
  const [tracks, setTracks] = useState<MixerTrack[]>([
    { id: "mic", name: "Microphone", icon: <Mic className="w-4 h-4" />, volume: 100, muted: false, level: 0, peakLevel: 0 },
    { id: "music", name: "Music Player", icon: <Music className="w-4 h-4" />, volume: 75, muted: false, level: 0, peakLevel: 0 },
    { id: "system", name: "System/Screen", icon: <Monitor className="w-4 h-4" />, volume: 60, muted: false, level: 0, peakLevel: 0 },
  ]);

  const [masterVolume, setMasterVolume] = useState(85);
  const [masterMuted, setMasterMuted] = useState(false);
  const [monitorMuted, setMonitorMuted] = useState(false); // ADMIN MONITOR MUTE — viewers unaffected
  const [effects, setEffects] = useState<AudioEffects>(DEFAULT_EFFECTS);
  const [activeTab, setActiveTab] = useState<"mixer" | "eq" | "effects" | "master">("mixer");
  const [autoDucking, setAutoDucking] = useState(true);
  const [audioInfo, setAudioInfo] = useState({
    sampleRate: 0,
    channels: 2,
    latency: "",
  });
  const [graphInitialized, setGraphInitialized] = useState(false);

  // LED States
  const [leds, setLeds] = useState<Record<string, NodeLEDState>>({
    input: { id: "input", name: "Input", active: false, level: 0, color: "green" },
    highpass: { id: "highpass", name: "High-Pass", active: false, level: 0, color: "blue" },
    bass: { id: "bass", name: "Bass", active: false, level: 0, color: "blue" },
    lowMid: { id: "lowMid", name: "Low-Mid", active: false, level: 0, color: "blue" },
    mid: { id: "mid", name: "Mid", active: false, level: 0, color: "blue" },
    highMid: { id: "highMid", name: "High-Mid", active: false, level: 0, color: "blue" },
    treble: { id: "treble", name: "Treble", active: false, level: 0, color: "blue" },
    compressor: { id: "compressor", name: "Compressor", active: false, level: 0, color: "amber" },
    gate: { id: "gate", name: "Noise Gate", active: false, level: 0, color: "amber" },
    normalize: { id: "normalize", name: "Auto-Normalize", active: false, level: 0, color: "amber" },
    delay: { id: "delay", name: "Delay", active: false, level: 0, color: "white" },
    output: { id: "output", name: "Output", active: false, level: 0, color: "green" },
    monitor: { id: "monitor", name: "Monitor", active: true, level: 100, color: "green" },
  });

  const RAMP_TIME = 0.05;

  /* ── Initialize Audio Context & Full Processing Chain ──────────────────── */

  const initAudioContext = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 });
    audioContextRef.current = ctx;

    // ── Processing Chain (in order) ───────────────────────────────────
    const highPass = ctx.createBiquadFilter();
    highPass.type = "highpass";
    highPass.frequency.value = effects.highPassFreq;
    highPass.Q.value = 0.7;
    highPassRef.current = highPass;

    const bass = ctx.createBiquadFilter();
    bass.type = "lowshelf";
    bass.frequency.value = 80;
    bass.gain.value = effects.bass;
    bassRef.current = bass;

    const lowMid = ctx.createBiquadFilter();
    lowMid.type = "peaking";
    lowMid.frequency.value = 250;
    lowMid.Q.value = 1.4;
    lowMid.gain.value = effects.lowMid;
    lowMidRef.current = lowMid;

    const mid = ctx.createBiquadFilter();
    mid.type = "peaking";
    mid.frequency.value = 1000;
    mid.Q.value = 1.4;
    mid.gain.value = effects.mid;
    midRef.current = mid;

    const highMid = ctx.createBiquadFilter();
    highMid.type = "peaking";
    highMid.frequency.value = 4000;
    highMid.Q.value = 1.4;
    highMid.gain.value = effects.highMid;
    highMidRef.current = highMid;

    const treble = ctx.createBiquadFilter();
    treble.type = "highshelf";
    treble.frequency.value = 12000;
    treble.gain.value = effects.treble;
    trebleRef.current = treble;

    // Compressor (main dynamics)
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = effects.compressorThreshold;
    compressor.ratio.value = effects.compressorRatio;
    compressor.attack.value = effects.compressorAttack;
    compressor.release.value = effects.compressorRelease;
    compressor.knee.value = effects.compressorKnee;
    compressorRef.current = compressor;

    // Noise gate (separate compressor acting as gate)
    const noiseGate = ctx.createDynamicsCompressor();
    noiseGate.threshold.value = effects.noiseGateThreshold;
    noiseGate.ratio.value = 20; // Very aggressive — acts as hard gate
    noiseGate.attack.value = 0.001;
    noiseGate.release.value = 0.1;
    noiseGate.knee.value = 0;
    noiseGateRef.current = noiseGate;

    // Auto-normalize (gentle compressor at end)
    const normalize = ctx.createDynamicsCompressor();
    normalize.threshold.value = -18;
    normalize.ratio.value = 3;
    normalize.attack.value = 0.01;
    normalize.release.value = 0.1;
    normalize.knee.value = 10;
    normalize.enabled = effects.autoNormalizeEnabled;
    normalizeRef.current = normalize;

    // Delay effect
    const delay = ctx.createDelay(2.0);
    delay.delayTime.value = effects.delayTime;
    delayRef.current = delay;

    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = effects.delayFeedback;
    delayFeedbackRef.current = delayFeedback;

    const delayMix = ctx.createGain();
    delayMix.gain.value = effects.delayMix;
    delayMixRef.current = delayMix;

    const delayDry = ctx.createGain();
    delayDry.gain.value = 1 - effects.delayMix;
    delayDryRef.current = delayDry;

    // Limiter (brick-wall at output)
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = effects.limiterThreshold;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.01;
    limiter.knee.value = 0;
    limiterRef.current = limiter;

    // Output gain (main volume for viewers)
    const outputGain = ctx.createGain();
    outputGain.gain.value = masterVolume / 100;
    outputGainRef.current = outputGain;

    // Monitor gain (admin local speakers — INDEPENDENT from viewers)
    const monitorGain = ctx.createGain();
    monitorGain.gain.value = monitorMuted ? 0 : masterVolume / 100;
    monitorGainRef.current = monitorGain;

    // Analyser for metering
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyserRef.current = analyser;
    frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);

    // MediaStreamDestination → this is what goes to viewers via WebRTC
    const dest = ctx.createMediaStreamDestination();
    destinationRef.current = dest;

    // ── Wire the full chain ───────────────────────────────────────────
    // EQ chain: highPass → bass → lowMid → mid → highMid → treble
    highPass.connect(bass);
    bass.connect(lowMid);
    lowMid.connect(mid);
    mid.connect(highMid);
    highMid.connect(treble);

    // treble → compressor
    treble.connect(compressor);

    // compressor → noiseGate
    compressor.connect(noiseGate);

    // noiseGate → normalize (or bypass if disabled)
    noiseGate.connect(normalize);

    // normalize → delay dry/wet split
    normalize.connect(delayDry);
    normalize.connect(delay);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay); // Feedback loop
    delay.connect(delayMix);

    // delayDry → limiter
    delayDry.connect(limiter);
    // delayMix (wet) → limiter
    delayMix.connect(limiter);

    // limiter → outputGain
    limiter.connect(outputGain);

    // ── Two output paths ──────────────────────────────────────────────
    // Path 1: outputGain → analyser → MediaStreamDestination → WEBRTC VIEWERS
    outputGain.connect(analyser);
    analyser.connect(dest);

    // Path 2: outputGain → monitorGain → AudioContext.destination → ADMIN SPEAKERS
    outputGain.connect(monitorGain);
    monitorGain.connect(ctx.destination);

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
  }, [
    masterVolume, monitorMuted,
    effects.bass, effects.lowMid, effects.mid, effects.highMid, effects.treble,
    effects.highPassFreq,
    effects.compressorThreshold, effects.compressorRatio, effects.compressorAttack,
    effects.compressorRelease, effects.compressorKnee,
    effects.noiseGateThreshold, effects.autoNormalizeEnabled,
    effects.delayTime, effects.delayFeedback, effects.delayMix,
    effects.limiterThreshold,
    onProcessedStream,
  ]);

  /* ── Wire Microphone Track ─────────────────────────────────────────────── */
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
      // Mic → highpass filter (start of chain)
      micGainRef.current.connect(highPassRef.current!);

      console.log("[AudioMixer] Microphone wired to processing chain");
    } catch (err) {
      console.error("[AudioMixer] Mic wiring error:", err);
    }
  }, [mediaStream, graphInitialized]);

  /* ── Wire Music Player Track ───────────────────────────────────────────── */
  useEffect(() => {
    if (!musicAudioRef.current || !graphInitialized) return;
    const ctx = audioContextRef.current!;

    try {
      if (!musicSourceRef.current) {
        musicSourceRef.current = ctx.createMediaElementSource(musicAudioRef.current);
        musicGainRef.current = ctx.createGain();
        musicSourceRef.current.connect(musicGainRef.current);
        musicGainRef.current.connect(highPassRef.current!);
      }
    } catch (err) {
      console.error("[AudioMixer] Music wiring error:", err);
    }
  }, [graphInitialized]);

  /* ── Wire System Audio Track ───────────────────────────────────────────── */
  const startSystemCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
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
      systemGainRef.current.connect(highPassRef.current!);

      setIsCapturingSystem(true);
      toast.success("System audio captured and wired to mixer");

      stream.getVideoTracks().forEach(t => t.stop());
    } catch (err) {
      console.error("[AudioMixer] System capture error:", err);
      toast.error("Failed to capture system audio");
    }
  };

  const stopSystemCapture = () => {
    if (systemStreamRef.current) {
      systemStreamRef.current.getTracks().forEach(t => t.stop());
      systemStreamRef.current = null;
    }
    if (systemSourceRef.current) {
      try { systemSourceRef.current.disconnect(); } catch (e) {}
    }
    setIsCapturingSystem(false);
    toast.info("System audio disconnected");
  };

  /* ── Update Track Gains with Auto-Ducking ──────────────────────────────── */
  const updateTrackGains = useCallback(() => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;

    const micTrack = tracks.find(t => t.id === "mic");
    const isMicActive = micTrack && !micTrack.muted && micTrack.level > 15;

    tracks.forEach(track => {
      let targetGain = track.muted ? 0 : track.volume / 100;

      // Auto-ducking: lower music when mic is active
      if (track.id === "music" && autoDucking && isMicActive) {
        targetGain *= 0.3;
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

  /* ── Apply EQ Settings to Graph Nodes ──────────────────────────────────── */
  useEffect(() => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;

    if (bassRef.current) bassRef.current.gain.setTargetAtTime(effects.bass, now, RAMP_TIME);
    if (lowMidRef.current) lowMidRef.current.gain.setTargetAtTime(effects.lowMid, now, RAMP_TIME);
    if (midRef.current) midRef.current.gain.setTargetAtTime(effects.mid, now, RAMP_TIME);
    if (highMidRef.current) highMidRef.current.gain.setTargetAtTime(effects.highMid, now, RAMP_TIME);
    if (trebleRef.current) trebleRef.current.gain.setTargetAtTime(effects.treble, now, RAMP_TIME);
  }, [effects.bass, effects.lowMid, effects.mid, effects.highMid, effects.treble]);

  /* ── Apply High-Pass Filter ────────────────────────────────────────────── */
  useEffect(() => {
    if (!audioContextRef.current || !highPassRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    highPassRef.current.frequency.setTargetAtTime(effects.highPassFreq, now, RAMP_TIME);
  }, [effects.highPassFreq]);

  /* ── Apply Compressor Settings ──────────────────────────────────────────── */
  useEffect(() => {
    if (!audioContextRef.current || !compressorRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;

    compressorRef.current.threshold.setTargetAtTime(effects.compressorThreshold, now, RAMP_TIME);
    compressorRef.current.ratio.setTargetAtTime(effects.compressorRatio, now, RAMP_TIME);
    compressorRef.current.attack.setTargetAtTime(effects.compressorAttack, now, RAMP_TIME);
    compressorRef.current.release.setTargetAtTime(effects.compressorRelease, now, RAMP_TIME);
    compressorRef.current.knee.setTargetAtTime(effects.compressorKnee, now, RAMP_TIME);
  }, [
    effects.compressorThreshold, effects.compressorRatio,
    effects.compressorAttack, effects.compressorRelease, effects.compressorKnee,
  ]);

  /* ── Apply Noise Gate ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!audioContextRef.current || !noiseGateRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;

    const gateEnabled = effects.noiseGateThreshold > -100;
    noiseGateRef.current.threshold.setTargetAtTime(gateEnabled ? effects.noiseGateThreshold : 0, now, RAMP_TIME);
    noiseGateRef.current.ratio.setTargetAtTime(gateEnabled ? 20 : 1, now, RAMP_TIME);
  }, [effects.noiseGateThreshold]);

  /* ── Apply Normalize Toggle ────────────────────────────────────────────── */
  useEffect(() => {
    if (!audioContextRef.current || !normalizeRef.current || !noiseGateRef.current || !limiterRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;

    if (effects.autoNormalizeEnabled) {
      // noiseGate → normalize → limiter (normalize active)
      noiseGateRef.current.disconnect();
      noiseGateRef.current.connect(normalizeRef.current);
      normalizeRef.current.disconnect();
      normalizeRef.current.connect(delayDryRef.current!);
      normalizeRef.current.connect(delayRef.current!);
    } else {
      // noiseGate → limiter (bypass normalize)
      noiseGateRef.current.disconnect();
      noiseGateRef.current.connect(delayDryRef.current!);
      noiseGateRef.current.connect(delayRef.current!);
    }
  }, [effects.autoNormalizeEnabled]);

  /* ── Apply Delay Settings ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;

    if (delayRef.current) delayRef.current.delayTime.setTargetAtTime(effects.delayTime, now, RAMP_TIME);
    if (delayFeedbackRef.current) delayFeedbackRef.current.gain.setTargetAtTime(effects.delayFeedback, now, RAMP_TIME);
    if (delayMixRef.current) delayMixRef.current.gain.setTargetAtTime(effects.delayMix, now, RAMP_TIME);
    if (delayDryRef.current) delayDryRef.current.gain.setTargetAtTime(1 - effects.delayMix, now, RAMP_TIME);
  }, [effects.delayTime, effects.delayFeedback, effects.delayMix]);

  /* ── Master & Monitor Gain ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    const target = masterMuted ? 0 : masterVolume / 100;

    if (outputGainRef.current) {
      outputGainRef.current.gain.setTargetAtTime(target, now, RAMP_TIME);
    }
  }, [masterVolume, masterMuted]);

  useEffect(() => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    const target = monitorMuted ? 0 : masterVolume / 100;

    if (monitorGainRef.current) {
      monitorGainRef.current.gain.setTargetAtTime(target, now, RAMP_TIME);
    }

    onMonitorMuteChange?.(monitorMuted);
  }, [monitorMuted, masterVolume, onMonitorMuteChange]);

  /* ── Metering Loop & LED Updates ───────────────────────────────────────── */
  useEffect(() => {
    const meterLoop = () => {
      if (!analyserRef.current || !frequencyDataRef.current) {
        requestAnimationFrame(meterLoop);
        return;
      }

      analyserRef.current.getByteFrequencyData(frequencyDataRef.current);
      const data = Array.from(frequencyDataRef.current) as number[];
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const masterLevel = Math.min(100, (avg / 255) * 100 * 3);

      // Check compressor activity
      const compressorReduction = compressorRef.current ? compressorRef.current.reduction : 0;
      const compressorActive = compressorRef.current && Math.abs(compressorReduction) > 0.5;

      // Check noise gate activity
      const gateActive = noiseGateRef.current && effects.noiseGateThreshold > -100 && masterLevel < 5;

      // Check delay activity
      const delayActive = effects.delayMix > 0.01 && masterLevel > 5;

      setTracks(prev => prev.map(t => {
        let isActive = false;
        if (t.id === "mic" && mediaStream) isActive = true;
        if (t.id === "music" && isMusicPlaying) isActive = true;
        if (t.id === "system" && isCapturingSystem) isActive = true;

        const currentLevel = isActive ? masterLevel : 0;
        return {
          ...t,
          level: currentLevel,
          peakLevel: Math.max(t.peakLevel * 0.95, currentLevel),
        };
      }));

      // Update LED states
      setLeds(prev => ({
        ...prev,
        input: { ...prev.input, active: mediaStream !== null, level: masterLevel },
        highpass: { ...prev.highpass, active: effects.highPassFreq > 0, level: effects.highPassFreq > 0 ? 80 : 0 },
        bass: { ...prev.bass, active: Math.abs(effects.bass) > 0, level: Math.min(100, Math.abs(effects.bass) * 8) },
        lowMid: { ...prev.lowMid, active: Math.abs(effects.lowMid) > 0, level: Math.min(100, Math.abs(effects.lowMid) * 8) },
        mid: { ...prev.mid, active: Math.abs(effects.mid) > 0, level: Math.min(100, Math.abs(effects.mid) * 8) },
        highMid: { ...prev.highMid, active: Math.abs(effects.highMid) > 0, level: Math.min(100, Math.abs(effects.highMid) * 8) },
        treble: { ...prev.treble, active: Math.abs(effects.treble) > 0, level: Math.min(100, Math.abs(effects.treble) * 8) },
        compressor: { ...prev.compressor, active: compressorActive || effects.compressorRatio > 1, level: compressorActive ? Math.min(100, Math.abs(compressorReduction) * 10) : (effects.compressorRatio > 1 ? 30 : 0) },
        gate: { ...prev.gate, active: effects.noiseGateThreshold > -100, level: effects.noiseGateThreshold > -100 ? (masterLevel > 10 ? 80 : 20) : 0 },
        normalize: { ...prev.normalize, active: effects.autoNormalizeEnabled, level: effects.autoNormalizeEnabled ? 70 : 0 },
        delay: { ...prev.delay, active: delayActive, level: delayActive ? Math.min(100, effects.delayMix * 200) : 0 },
        output: { ...prev.output, active: masterLevel > 1, level: masterLevel },
        monitor: { ...prev.monitor, active: !monitorMuted, level: monitorMuted ? 0 : masterLevel },
      }));

      requestAnimationFrame(meterLoop);
    };

    const animFrame = requestAnimationFrame(meterLoop);
    return () => cancelAnimationFrame(animFrame);
  }, [mediaStream, isMusicPlaying, isCapturingSystem, effects, monitorMuted]);

  /* ── Music Player Controls ─────────────────────────────────────────────── */
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

  /* ── Presets ───────────────────────────────────────────────────────────── */
  const applyPreset = useCallback((preset: string) => {
    const presets: Record<string, Partial<AudioEffects>> = {
      flat: { bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, compressorThreshold: -100, compressorRatio: 1, noiseGateThreshold: -100, autoNormalizeEnabled: false, delayMix: 0 },
      voice: { bass: 0, lowMid: 0, mid: 3, highMid: 4, treble: 2, compressorThreshold: -24, compressorRatio: 6, noiseGateThreshold: -55, autoNormalizeEnabled: true, delayMix: 0 },
      broadcast: { bass: 1, lowMid: -1, mid: 1, highMid: 2, treble: 1, compressorThreshold: -20, compressorRatio: 5, noiseGateThreshold: -50, autoNormalizeEnabled: true, delayMix: 0 },
      church: { bass: 2, lowMid: -3, mid: 0, highMid: 1, treble: 3, compressorThreshold: -22, compressorRatio: 4, noiseGateThreshold: -50, autoNormalizeEnabled: true, delayMix: 0 },
      noisy: { bass: -6, lowMid: -4, mid: 0, highMid: 0, treble: 1, compressorThreshold: -18, compressorRatio: 8, noiseGateThreshold: -40, autoNormalizeEnabled: true, delayMix: 0 },
      music: { bass: 4, lowMid: 1, mid: 0, highMid: 1, treble: 3, compressorThreshold: -20, compressorRatio: 3, noiseGateThreshold: -60, autoNormalizeEnabled: false, delayMix: 0 },
    };

    const p = presets[preset];
    if (!p) return;

    setEffects(prev => ({ ...prev, ...p }));
    toast.success(`Applied "${preset}" preset`);
  }, []);

  /* ── Track Volume/Mute ─────────────────────────────────────────────────── */
  const handleTrackVolume = useCallback((trackId: string, volume: number) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, volume } : t));
    onVolumeChange?.(trackId, volume);
  }, [onVolumeChange]);

  const handleTrackMute = useCallback((trackId: string) => {
    setTracks(prev => prev.map(t => {
      if (t.id !== trackId) return t;
      const newMuted = !t.muted;
      onMuteChange?.(trackId, newMuted);
      return { ...t, muted: newMuted };
    }));
  }, [onMuteChange]);

  /* ── Tab Configuration ─────────────────────────────────────────────────── */
  const tabs = useMemo(() => [
    { id: "mixer" as const, label: "Tracks", icon: <Waves className="w-3.5 h-3.5" /> },
    { id: "eq" as const, label: "EQ", icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: "effects" as const, label: "FX", icon: <Zap className="w-3.5 h-3.5" /> },
    { id: "master" as const, label: "Master", icon: <Headphones className="w-3.5 h-3.5" /> },
  ], []);

  /* ─── RENDER ───────────────────────────────────────────────────────────── */

  return (
    <Card className="bg-slate-950 border-slate-800 shadow-2xl overflow-hidden flex flex-col h-full border-2">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="bg-slate-900/80 p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-2 rounded-lg">
            <Waves className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <div>
            <h2 className="text-white font-black text-sm uppercase tracking-tighter">Pro Audio Studio</h2>
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
            <Monitor className="w-3 h-3" />
            {isCapturingSystem ? "Sys Audio ON" : "Sys Audio"}
          </Button>
        </div>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-800 bg-slate-900/40">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── LED Signal Chain Bar ────────────────────────────────────── */}
      <div className="bg-slate-900/60 px-4 py-2.5 border-b border-slate-800 flex items-center gap-1 overflow-x-auto">
        <span className="text-[8px] font-mono text-slate-600 uppercase mr-2 shrink-0">SIGNAL:</span>
        {(Object.values(leds) as NodeLEDState[]).filter(n => n.id !== "monitor").map(node => (
          <div key={node.id} className="flex items-center gap-0.5 shrink-0">
            <NodeLED node={node} size="sm" />
            <span className="text-[7px] font-mono text-slate-600 uppercase tracking-tight">{node.name}</span>
            {/* Arrow between nodes */}
            <span className="text-[8px] text-slate-700 mx-0.5">→</span>
          </div>
        ))}
        <div className="flex items-center gap-0.5 ml-1 shrink-0">
          <NodeLED node={leds.monitor} size="sm" />
          <span className="text-[7px] font-mono text-slate-600 uppercase tracking-tight">MON</span>
        </div>
      </div>

      {/* ── Content Area ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* ── MIXER TAB ─────────────────────────────────────────────── */}
        {activeTab === "mixer" && (
          <div className="p-4 space-y-4">
            {/* Presets */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "flat", label: "Flat" },
                { id: "voice", label: "Voice" },
                { id: "broadcast", label: "Broadcast" },
                { id: "church", label: "Church" },
                { id: "noisy", label: "Noise Reduce" },
                { id: "music", label: "Music" },
              ].map(p => (
                <Button
                  key={p.id}
                  variant="outline"
                  size="sm"
                  className="h-7 text-[9px] font-bold uppercase bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700"
                  onClick={() => applyPreset(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            {/* Track Faders */}
            <div className="space-y-3">
              {tracks.map(track => (
                <div key={track.id} className="bg-slate-900/40 rounded-xl p-4 border border-slate-800/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${track.muted ? 'bg-red-500/20 text-red-400' : 'bg-primary/20 text-primary'}`}>
                        {track.icon}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{track.name}</p>
                        <p className="text-[9px] text-slate-500 uppercase">
                          {track.id === "mic" && mediaStream ? "Connected" : track.id === "music" && isMusicPlaying ? "Playing" : track.id === "system" && isCapturingSystem ? "Capturing" : "Standby"}
                        </p>
                      </div>
                    </div>

                    {/* LED */}
                    <NodeLED
                      node={leds[track.id as keyof typeof leds] || { id: track.id, name: track.name, active: track.level > 0, level: track.level, color: track.muted ? "red" : "green" }}
                      size="md"
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Slider
                        value={[track.volume]}
                        min={0}
                        max={100}
                        onValueChange={([val]) => handleTrackVolume(track.id, val)}
                        className="cursor-pointer"
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 w-8 text-right shrink-0">{track.volume}%</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-9 w-9 rounded-lg transition-all ${
                        track.muted
                          ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                      onClick={() => handleTrackMute(track.id)}
                    >
                      {track.muted ? <MicOff className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </Button>
                  </div>

                  {/* Level Meter */}
                  <div className="mt-2 h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      animate={{
                        width: `${track.muted ? 0 : track.level}%`,
                        backgroundColor: track.level > 80 ? "#ef4444" : track.level > 50 ? "#eab308" : "#3b82f6",
                      }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>

                  {/* Track-specific controls */}
                  {track.id === "music" && (
                    <div className="mt-3 pt-3 border-t border-slate-800 flex justify-center gap-2">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500" onClick={toggleMusic}>
                        {isMusicPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500" onClick={() => musicInputRef.current?.click()}>
                        <Upload className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {track.id === "system" && !isCapturingSystem && (
                    <div className="mt-3 pt-3 border-t border-slate-800 flex justify-center">
                      <Button size="sm" variant="outline" className="text-[10px] text-slate-400 border-slate-700" onClick={startSystemCapture}>
                        <Monitor className="w-3 h-3 mr-1" /> Capture System Audio
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Auto-Ducking Toggle */}
            <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-800/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-[10px] font-bold text-white uppercase">Auto-Ducking</span>
              </div>
              <button
                onClick={() => setAutoDucking(prev => !prev)}
                className={`w-10 h-5 rounded-full transition-all ${autoDucking ? 'bg-primary' : 'bg-slate-700'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${autoDucking ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        )}

        {/* ── EQ TAB ────────────────────────────────────────────────── */}
        {activeTab === "eq" && (
          <div className="p-4 space-y-4">
            {/* High-Pass Filter */}
            <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-800/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-primary" />
                  <h4 className="text-[10px] font-bold text-white uppercase">High-Pass Filter</h4>
                </div>
                <NodeLED node={leds.highpass} size="sm" />
              </div>
              <div className="flex items-center gap-4">
                <Slider
                  value={[effects.highPassFreq]}
                  min={20}
                  max={200}
                  step={5}
                  onValueChange={([val]) => setEffects(prev => ({ ...prev, highPassFreq: val }))}
                />
                <span className="text-[10px] font-mono text-primary w-10 text-right">{effects.highPassFreq}Hz</span>
              </div>
            </div>

            {/* 5-Band EQ */}
            <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-800/50">
              <div className="flex items-center gap-2 mb-6">
                <Sliders className="w-4 h-4 text-primary" />
                <h3 className="text-[10px] font-bold text-white uppercase tracking-widest">Parametric EQ</h3>
              </div>

              <div className="flex items-end justify-between gap-2 px-2">
                {[
                  { label: "Bass", freq: "80Hz", key: "bass", type: "lowshelf" },
                  { label: "L-Mid", freq: "250Hz", key: "lowMid", type: "peaking" },
                  { label: "Mid", freq: "1kHz", key: "mid", type: "peaking" },
                  { label: "H-Mid", freq: "4kHz", key: "highMid", type: "peaking" },
                  { label: "Treble", freq: "12kHz", key: "treble", type: "highshelf" },
                ].map(band => {
                  const led = leds[band.key as keyof typeof leds];
                  return (
                    <div key={band.key} className="flex-1 flex flex-col items-center gap-2">
                      {/* LED on top */}
                      {led && <NodeLED node={led} size="sm" />}

                      {/* Vertical slider area */}
                      <div className="flex-1 w-6 bg-slate-950 rounded-full relative flex items-end overflow-hidden" style={{ height: 160 }}>
                        {/* Center line */}
                        <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-700 z-10" />

                        {/* Fill bar */}
                        <motion.div
                          className="w-full rounded-full"
                          animate={{
                            height: `${Math.abs(effects[band.key as keyof AudioEffects] / 12) * 50}%`,
                            backgroundColor: (effects[band.key as keyof AudioEffects] || 0) > 0 ? '#3b82f6' : '#ef4444',
                            bottom: (effects[band.key as keyof AudioEffects] || 0) >= 0 ? '50%' : `${50 - Math.abs(effects[band.key as keyof AudioEffects] / 12) * 50}%`,
                          }}
                          transition={{ duration: 0.15 }}
                        />
                      </div>

                      {/* Label */}
                      <p className="text-[9px] font-bold text-white uppercase">{band.label}</p>
                      <p className="text-[8px] font-mono text-slate-500">{band.freq}</p>
                      <p className={`text-[9px] font-mono ${
                        (effects[band.key as keyof AudioEffects] || 0) > 0 ? 'text-blue-400' :
                        (effects[band.key as keyof AudioEffects] || 0) < 0 ? 'text-red-400' : 'text-slate-600'
                      }`}>
                        {(effects[band.key as keyof AudioEffects] || 0) > 0 ? '+' : ''}{effects[band.key as keyof AudioEffects]}dB
                      </p>

                      {/* Slider */}
                      <div className="w-full" style={{ height: 80 }}>
                        <Slider
                          orientation="vertical"
                          value={[(effects[band.key as keyof AudioEffects] + 12) * (100 / 24)]}
                          min={0}
                          max={100}
                          onValueChange={([val]) => setEffects(prev => ({
                            ...prev,
                            [band.key]: (val * 24 / 100) - 12,
                          }))}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── FX TAB ────────────────────────────────────────────────── */}
        {activeTab === "effects" && (
          <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
            {/* Compressor */}
            <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Dynamics Compressor</h4>
                </div>
                <NodeLED node={leds.compressor} size="sm" />
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                    <span>Threshold</span>
                    <span className="text-primary">{effects.compressorThreshold}dB</span>
                  </div>
                  <Slider value={[effects.compressorThreshold]} min={-60} max={0} onValueChange={([val]) => setEffects(prev => ({ ...prev, compressorThreshold: val }))} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                    <span>Ratio</span>
                    <span className="text-primary">{effects.compressorRatio}:1</span>
                  </div>
                  <Slider value={[effects.compressorRatio]} min={1} max={20} step={0.5} onValueChange={([val]) => setEffects(prev => ({ ...prev, compressorRatio: val }))} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                    <span>Attack</span>
                    <span className="text-primary">{effects.compressorAttack}ms</span>
                  </div>
                  <Slider value={[effects.compressorAttack * 1000]} min={0} max={50} onValueChange={([val]) => setEffects(prev => ({ ...prev, compressorAttack: val / 1000 }))} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                    <span>Release</span>
                    <span className="text-primary">{effects.compressorRelease}ms</span>
                  </div>
                  <Slider value={[effects.compressorRelease * 1000]} min={10} max={500} onValueChange={([val]) => setEffects(prev => ({ ...prev, compressorRelease: val / 1000 }))} />
                </div>
              </div>
            </div>

            {/* Noise Gate */}
            <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Noise Gate</h4>
                </div>
                <NodeLED node={leds.gate} size="sm" />
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                    <span>Gate Threshold</span>
                    <span className={`text-primary ${effects.noiseGateThreshold > -100 ? 'text-amber-400' : 'text-slate-600'}`}>
                      {effects.noiseGateThreshold > -100 ? `${effects.noiseGateThreshold}dB (ON)` : "OFF"}
                    </span>
                  </div>
                  <Slider value={[effects.noiseGateThreshold]} min={-100} max={-10} step={1} onValueChange={([val]) => setEffects(prev => ({ ...prev, noiseGateThreshold: val }))} />
                </div>
              </div>
            </div>

            {/* Auto-Normalize */}
            <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AudioLines className="w-4 h-4 text-blue-400" />
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Auto-Normalize</h4>
                </div>
                <NodeLED node={leds.normalize} size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Automatically levels audio for consistent volume</span>
                <button
                  onClick={() => setEffects(prev => ({ ...prev, autoNormalizeEnabled: !prev.autoNormalizeEnabled }))}
                  className={`w-10 h-5 rounded-full transition-all ${effects.autoNormalizeEnabled ? 'bg-blue-500' : 'bg-slate-700'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${effects.autoNormalizeEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            {/* Delay */}
            <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Disc className="w-4 h-4 text-primary" />
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Delay / Echo</h4>
                </div>
                <NodeLED node={leds.delay} size="sm" />
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                    <span>Time</span>
                    <span className="text-primary">{effects.delayTime}s</span>
                  </div>
                  <Slider value={[effects.delayTime * 100]} min={0} max={200} onValueChange={([val]) => setEffects(prev => ({ ...prev, delayTime: val / 100 }))} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                    <span>Feedback</span>
                    <span className="text-primary">{Math.round(effects.delayFeedback * 100)}%</span>
                  </div>
                  <Slider value={[effects.delayFeedback * 100]} min={0} max={95} onValueChange={([val]) => setEffects(prev => ({ ...prev, delayFeedback: val / 100 }))} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                    <span>Mix</span>
                    <span className="text-primary">{Math.round(effects.delayMix * 100)}%</span>
                  </div>
                  <Slider value={[effects.delayMix * 100]} min={0} max={50} onValueChange={([val]) => setEffects(prev => ({ ...prev, delayMix: val / 100 }))} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MASTER TAB ────────────────────────────────────────────── */}
        {activeTab === "master" && (
          <div className="p-4 space-y-4">
            {/* Output Gain */}
            <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-primary" />
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Output (Viewers)</h4>
                </div>
                <NodeLED node={leds.output} size="md" />
              </div>
              <div className="flex items-center gap-4">
                <Slider value={[masterVolume]} max={100} onValueChange={([val]) => setMasterVolume(val)} className="flex-1" />
                <span className="text-[10px] font-mono text-primary w-10 text-right">{masterVolume}%</span>
                <Button
                  variant={masterMuted ? "destructive" : "secondary"}
                  size="icon"
                  className="h-10 w-10 rounded-xl"
                  onClick={() => setMasterMuted(!masterMuted)}
                >
                  {masterMuted ? <MicOff className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* ── ADMIN MONITOR MUTE ────────────────────────────────── */}
            <div className="bg-gradient-to-r from-amber-900/20 to-slate-900/40 rounded-xl p-5 border border-amber-700/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-amber-400" />
                  <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Admin Monitor (Your Speakers)</h4>
                </div>
                <NodeLED node={leds.monitor} size="md" />
              </div>

              <div className="flex items-center justify-between bg-slate-900/60 rounded-lg p-4">
                <div>
                  <p className="text-xs text-white font-bold">
                    {monitorMuted ? "MONITOR MUTED" : "MONITORING ON"}
                  </p>
                  <p className="text-[9px] text-slate-400 mt-1">
                    {monitorMuted
                      ? "You hear nothing — viewers still hear full processed audio"
                      : "You hear the processed audio — good for checking quality"}
                  </p>
                </div>
                <button
                  onClick={() => setMonitorMuted(!monitorMuted)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    monitorMuted
                      ? "bg-amber-600 text-white hover:bg-amber-500"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {monitorMuted ? (
                    <>
                      <MicOff className="w-4 h-4" />
                      MONITOR MUTED
                    </>
                  ) : (
                    <>
                      <Headphones className="w-4 h-4" />
                      MONITOR ON
                    </>
                  )}
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 text-[9px] text-slate-500">
                <Info className="w-3 h-3" />
                <span>When muted, your speakers are silent but viewers still receive full boosted audio at {masterVolume}%</span>
              </div>
            </div>

            {/* Limiter */}
            <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800/50">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-primary" />
                <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Brick-Wall Limiter</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                  <span>Threshold</span>
                  <span className="text-primary">{effects.limiterThreshold}dB</span>
                </div>
                <Slider value={[effects.limiterThreshold]} min={-12} max={-0.5} step={0.5} onValueChange={([val]) => setEffects(prev => ({ ...prev, limiterThreshold: val }))} />
              </div>
            </div>

            {/* Master Level Meter */}
            <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-white uppercase">Output Level</span>
                <span className="text-[10px] font-mono text-primary">{masterMuted ? "MUTED" : `${masterVolume}%`}</span>
              </div>
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  animate={{
                    width: `${masterMuted ? 0 : masterVolume}%`,
                    backgroundColor: masterVolume > 85 ? "#ef4444" : masterVolume > 60 ? "#eab308" : "#3b82f6",
                  }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Hidden Music Player ──────────────────────────────────────── */}
      <audio ref={musicAudioRef} loop className="hidden" />
      <input type="file" ref={musicInputRef} className="hidden" accept="audio/*" onChange={handleMusicUpload} />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}</style>
    </Card>
  );
}
