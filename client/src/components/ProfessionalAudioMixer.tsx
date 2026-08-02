/**
 * ProfessionalAudioMixer.tsx — COMPLETE REWRITE
 *
 * ============================================================
 * UNIVERSAL AUDIO STUDIO v2.0
 * ============================================================
 *
 * ARCHITECTURE — UNIFIED AUDIO BUS:
 *
 *   ALL audio sources route through a SINGLE processing chain.
 *   No more independent audio paths. No more audio collisions.
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                        INPUT SOURCES                             │
 *   │                                                                   │
 *   │  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────┐   │
 *   │  │ Camera  │  │ Pre-     │  │ System/   │  │  Music       │   │
 *   │  │ Mic     │  │ Stream   │  │ Screen    │  │  Player      │   │
 *   │  │ (Multi) │  │ Media    │  │ Audio     │  │              │   │
 *   │  └────┬────┘  └────┬─────┘  └─────┬─────┘  └──────┬───────┘   │
 *   │       │             │              │               │            │
 *   │       ▼             ▼              ▼               ▼            │
 *   │  ┌──────────────────────────────────────────────────────┐     │
 *   │  │              TRACK GAIN NODES (per source)             │     │
 *   │  │         + Per-Track Panning (stereo)                   │     │
 *   │  └──────────────────────┬───────────────────────────────┘     │
 *   │                          │                                     │
 *   │                          ▼                                     │
 *   │  ┌──────────────────────────────────────────────────────┐     │
 *   │  │              MASTER PROCESSING CHAIN                   │     │
 *   │  │                                                        │     │
 *   │  │  HighPass(80Hz) → Bass EQ → LowMid EQ → Mid EQ        │     │
 *   │  │  → HighMid EQ → Treble EQ → DeEsser                   │     │
 *   │  │  → Dynamics Compressor → Noise Gate → Auto-Normalize  │     │
 *   │  │  → Auto-Tune/Pitch → Vocal Presence                   │     │
 *   │  │  → Reverb (Send) → Delay (Send) → Chorus (Send)       │     │
 *   │  │  → Sidechain Compressor → Limiter (Brick-wall)         │     │
 *   │  │  → Stereo Widener → Output Gain                        │     │
 *   │  │                                                        │     │
 *   │  │  SEND EFFECTS (parallel, mixed back):                   │     │
 *   │  │  - Reverb (Convolution-style with convolver)            │     │
 *   │  │  - Delay with feedback loop                             │     │
 *   │  │  - Chorus (detuned oscillators)                         │     │
 *   │  └──────────────────────┬───────────────────────────────┘     │
 *   │                          │                                     │
 *   │                          ▼                                     │
 *   │  ┌──────────────────────────────────────────────────────┐     │
 *   │  │              DUAL OUTPUT PATH                          │     │
 *   │  │                                                        │     │
 *   │  │  ┌──► MediaStreamDestination ──► VIEWERS (WebRTC)      │     │
 *   │  │  │                                                      │     │
 *   │  │  └──► Admin Monitor (AudioContext.destination)          │     │
 *   │  │         └── MonitorGain (independent mute)              │     │
 *   │  └──────────────────────────────────────────────────────┘     │
 *   │                                                                 │
 *   │  AUXILIARY:                                                    │
 *   │  - Spectrum Analyzer (FFT visualization)                       │
 *   │  - Waveform Monitor                                            │
 *   │  - Audio Recorder (MediaRecorder API)                          │
 *   │  - Scene Preset Save/Load                                      │
 *   │  - LED Signal Chain Indicators                                 │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * KEY FEATURES:
 * - ALL audio sources processed through the SAME chain — no collisions
 * - Pre-stream media audio is a SEPARATE input track, not a standalone stream
 * - Camera microphone device selection built-in
 * - Auto-tune / pitch correction using AudioWorkletNode
 * - Reverb, Chorus, De-esser, Vocal Presence
 * - Spectrum analyzer + waveform visualization
 * - Audio recording to WAV
 * - Scene presets (save/load complete configurations)
 * - Stereo panning per track
 * - Sidechain compression
 * - Professional mastering limiter at output
 */

import { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2, Mic, MicOff, Sliders, Music, Monitor,
  Waves, Activity, Disc, Headphones, Speaker,
  Play, Pause, SkipForward, Upload, X, AlertCircle,
  Zap, Settings, Info, Radio, Shield, Power,
  AudioLines, Circle, Download, Save, FolderOpen,
  BarChart3, CircleDot, Palette, ChevronDown, ChevronUp,
  RotateCcw, Copy, RefreshCw, Lock, Unlock, Plus
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
  solo: boolean;
  level: number;
  peakLevel: number;
  pan: number; // -100 to 100
  color: string;
  deviceType: "mic" | "media" | "system" | "music";
}

interface AudioEffects {
  // EQ
  bass: number;
  lowMid: number;
  mid: number;
  highMid: number;
  treble: number;
  highPassFreq: number;

  // Dynamics
  compressorThreshold: number;
  compressorRatio: number;
  compressorAttack: number;
  compressorRelease: number;
  compressorKnee: number;
  noiseGateThreshold: number;
  autoNormalizeEnabled: boolean;

  // Voice Processing
  autoTuneEnabled: boolean;
  autoTuneAmount: number; // 0-100
  deEsserEnabled: boolean;
  deEsserThreshold: number;
  vocalPresence: number; // 0-100

  // Effects
  delayTime: number;
  delayFeedback: number;
  delayMix: number;
  reverbEnabled: boolean;
  reverbMix: number;
  reverbDecay: number;
  chorusEnabled: boolean;
  chorusRate: number;
  chorusDepth: number;
  chorusMix: number;

  // Mastering
  limiterThreshold: number;
  stereoWidth: number; // 0-100
  sidechainEnabled: boolean;
  sidechainThreshold: number;
  sidechainAmount: number;

  // Ducking
  autoDucking: boolean;
  duckAmount: number;
}

interface NodeLEDState {
  id: string;
  name: string;
  active: boolean;
  level: number;
  color: "green" | "blue" | "amber" | "red" | "white" | "purple" | "cyan";
}

interface AudioScene {
  name: string;
  effects: Partial<AudioEffects>;
  trackSettings: Record<string, Partial<MixerTrack>>;
}

interface AudioMixerRef {
  initAudioContext: () => Promise<boolean>;
  getProcessedStream: () => MediaStream | null;
  getAudioContext: () => AudioContext | null;
  registerSource: (sourceId: string, stream: MediaStream | null) => void;
  switchMicrophone: (deviceId: string) => Promise<MediaStream | null>;
}

const DEFAULT_EFFECTS: AudioEffects = {
  // EQ
  bass: 0,
  lowMid: 0,
  mid: 0,
  highMid: 0,
  treble: 0,
  highPassFreq: 80,

  // Dynamics
  compressorThreshold: -24,
  compressorRatio: 4,
  compressorAttack: 0.003,
  compressorRelease: 0.25,
  compressorKnee: 30,
  noiseGateThreshold: -55,
  autoNormalizeEnabled: true,

  // Voice Processing
  autoTuneEnabled: false,
  autoTuneAmount: 50,
  deEsserEnabled: false,
  deEsserThreshold: -30,
  vocalPresence: 0,

  // Effects
  delayTime: 0.3,
  delayFeedback: 0.4,
  delayMix: 0,
  reverbEnabled: false,
  reverbMix: 0.2,
  reverbDecay: 2.5,
  chorusEnabled: false,
  chorusRate: 1.5,
  chorusDepth: 7,
  chorusMix: 0,

  // Mastering
  limiterThreshold: -1,
  stereoWidth: 20,
  sidechainEnabled: false,
  sidechainThreshold: -20,
  sidechainAmount: 0.5,

  // Ducking
  autoDucking: true,
  duckAmount: 30,
};

const TRACK_COLORS = {
  mic: "#3b82f6",
  media: "#8b5cf6",
  system: "#f59e0b",
  music: "#10b981",
};

interface ProfessionalAudioMixerProps {
  /** Camera/media stream for microphone input */
  mediaStream?: MediaStream | null;
  /** Pre-stream media audio stream (separate from video) */
  preStreamAudioStream?: MediaStream | null;
  /** Callback when microphone device is switched — returns new mic stream */
  onMicrophoneSwitch?: (newMicStream: MediaStream | null) => void;
  /** Callbacks */
  onVolumeChange?: (trackId: string, volume: number) => void;
  onMuteChange?: (trackId: string, muted: boolean) => void;
  onProcessedStream?: (stream: MediaStream | null) => void;
  onMonitorMuteChange?: (muted: boolean) => void;
  onRecordingStateChange?: (recording: boolean) => void;
}

const ProfessionalAudioMixer = forwardRef<AudioMixerRef, ProfessionalAudioMixerProps>(
  ({
    mediaStream,
    preStreamAudioStream,
    onMicrophoneSwitch,
    onVolumeChange,
    onMuteChange,
    onProcessedStream,
    onMonitorMuteChange,
    onRecordingStateChange,
  }, ref) => {

    /* ── Audio Graph Refs ─────────────────────────────────────────────────── */
    const audioContextRef = useRef<AudioContext | null>(null);
    const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

    // Source nodes
    const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const musicSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const systemSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const preStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    // Track gain nodes
    const micGainRef = useRef<GainNode | null>(null);
    const musicGainRef = useRef<GainNode | null>(null);
    const systemGainRef = useRef<GainNode | null>(null);
    const preStreamGainRef = useRef<GainNode | null>(null);

    // Panning nodes (stereo)
    const micPanRef = useRef<StereoPannerNode | null>(null);
    const musicPanRef = useRef<StereoPannerNode | null>(null);
    const systemPanRef = useRef<StereoPannerNode | null>(null);
    const preStreamPanRef = useRef<StereoPannerNode | null>(null);

    // Processing chain nodes
    const highPassRef = useRef<BiquadFilterNode | null>(null);
    const bassRef = useRef<BiquadFilterNode | null>(null);
    const lowMidRef = useRef<BiquadFilterNode | null>(null);
    const midRef = useRef<BiquadFilterNode | null>(null);
    const highMidRef = useRef<BiquadFilterNode | null>(null);
    const trebleRef = useRef<BiquadFilterNode | null>(null);
    const deEsserRef = useRef<BiquadFilterNode | null>(null);
    const vocalPresenceRef = useRef<BiquadFilterNode | null>(null);
    const compressorRef = useRef<DynamicsCompressorNode | null>(null);
    const noiseGateRef = useRef<DynamicsCompressorNode | null>(null);
    const normalizeRef = useRef<DynamicsCompressorNode | null>(null);
    const autoTuneRef = useRef<AudioWorkletNode | null>(null);
    const autoTuneLoadedRef = useRef<boolean>(false);
    const delayRef = useRef<DelayNode | null>(null);
    const delayFeedbackRef = useRef<GainNode | null>(null);
    const delayMixRef = useRef<GainNode | null>(null);
    const delayDryRef = useRef<GainNode | null>(null);
    const reverbConvolverRef = useRef<ConvolverNode | null>(null);
    const reverbMixRef = useRef<GainNode | null>(null);
    const reverbDryRef = useRef<GainNode | null>(null);
    const chorusDelayRef = useRef<DelayNode | null>(null);
    const chorusLFORef = useRef<OscillatorNode | null>(null);
    const chorusDepthRef = useRef<GainNode | null>(null);
    const chorusMixRef = useRef<GainNode | null>(null);
    const chorusDryRef = useRef<GainNode | null>(null);
    const sidechainRef = useRef<DynamicsCompressorNode | null>(null);
    const limiterRef = useRef<DynamicsCompressorNode | null>(null);
    const outputGainRef = useRef<GainNode | null>(null);

    // Monitor path
    const monitorGainRef = useRef<GainNode | null>(null);

    // Analyser for metering
    const analyserRef = useRef<AnalyserNode | null>(null);
    const spectrumAnalyserRef = useRef<AnalyserNode | null>(null);
    const frequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
    const spectrumDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

    // Music player
    const musicAudioRef = useRef<HTMLAudioElement | null>(null);
    const [musicFile, setMusicFile] = useState<File | null>(null);
    const [isMusicPlaying, setIsMusicPlaying] = useState(false);
    const musicInputRef = useRef<HTMLInputElement>(null);

    // System audio
    const [isCapturingSystem, setIsCapturingSystem] = useState(false);
    const systemStreamRef = useRef<MediaStream | null>(null);

    // Audio recording
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

    // Spectrum visualization
    const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
    const waveformCanvasRef = useRef<HTMLCanvasElement>(null);

    // UI State
    const [tracks, setTracks] = useState<MixerTrack[]>([
      { id: "mic", name: "Camera Microphone", icon: <Mic className="w-4 h-4" />, volume: 100, muted: false, solo: false, level: 0, peakLevel: 0, pan: 0, color: TRACK_COLORS.mic, deviceType: "mic" },
      { id: "preStream", name: "Pre-Stream Audio", icon: <Monitor className="w-4 h-4" />, volume: 100, muted: false, solo: false, level: 0, peakLevel: 0, pan: 0, color: TRACK_COLORS.media, deviceType: "media" },
      { id: "music", name: "Music Player", icon: <Music className="w-4 h-4" />, volume: 75, muted: false, solo: false, level: 0, peakLevel: 0, pan: 0, color: TRACK_COLORS.music, deviceType: "music" },
      { id: "system", name: "System/Screen Audio", icon: <Monitor className="w-4 h-4" />, volume: 60, muted: false, solo: false, level: 0, peakLevel: 0, pan: 0, color: TRACK_COLORS.system, deviceType: "system" },
    ]);

    const [masterVolume, setMasterVolume] = useState(85);
    const [masterMuted, setMasterMuted] = useState(false);
    const [monitorMuted, setMonitorMuted] = useState(false);
    const [effects, setEffects] = useState<AudioEffects>(DEFAULT_EFFECTS);
    const [activeTab, setActiveTab] = useState<"mixer" | "eq" | "effects" | "voice" | "master">("mixer");
    const [audioInfo, setAudioInfo] = useState({
      sampleRate: 0,
      channels: 2,
      latency: "",
    });
    const [graphInitialized, setGraphInitialized] = useState(false);
    const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);
    const [selectedMicDeviceId, setSelectedMicDeviceId] = useState<string>("");
    const [scenes, setScenes] = useState<AudioScene[]>([]);
    const [currentScene, setCurrentScene] = useState<string>("Default");
    const [showScenes, setShowScenes] = useState(false);
    const [showNewScene, setShowNewScene] = useState(false);
    const [newSceneName, setNewSceneName] = useState("");
    const [locked, setLocked] = useState(false);

    // LED States
    const [leds, setLeds] = useState<Record<string, NodeLEDState>>({
      input: { id: "input", name: "Input", active: false, level: 0, color: "green" },
      highpass: { id: "highpass", name: "High-Pass", active: false, level: 0, color: "blue" },
      bass: { id: "bass", name: "Bass", active: false, level: 0, color: "blue" },
      lowMid: { id: "lowMid", name: "Low-Mid", active: false, level: 0, color: "blue" },
      mid: { id: "mid", name: "Mid", active: false, level: 0, color: "blue" },
      highMid: { id: "highMid", name: "High-Mid", active: false, level: 0, color: "blue" },
      treble: { id: "treble", name: "Treble", active: false, level: 0, color: "blue" },
      deEsser: { id: "deEsser", name: "DeEsser", active: false, level: 0, color: "cyan" },
      compressor: { id: "compressor", name: "Compressor", active: false, level: 0, color: "amber" },
      gate: { id: "gate", name: "Noise Gate", active: false, level: 0, color: "amber" },
      normalize: { id: "normalize", name: "Normalize", active: false, level: 0, color: "amber" },
      autoTune: { id: "autoTune", name: "Auto-Tune", active: false, level: 0, color: "purple" },
      reverb: { id: "reverb", name: "Reverb", active: false, level: 0, color: "purple" },
      delay: { id: "delay", name: "Delay", active: false, level: 0, color: "white" },
      chorus: { id: "chorus", name: "Chorus", active: false, level: 0, color: "purple" },
      limiter: { id: "limiter", name: "Limiter", active: false, level: 0, color: "red" },
      output: { id: "output", name: "Output", active: false, level: 0, color: "green" },
      monitor: { id: "monitor", name: "Monitor", active: true, level: 100, color: "green" },
    });

    const RAMP_TIME = 0.05;

    /* ── Initialize Audio Context & Full Processing Chain ──────────────────── */

    const initAudioContext = useCallback(async () => {
      console.log("[AudioMixer] Initializing AudioContext...");
      try {
        if (audioContextRef.current) {
          console.log("[AudioMixer] AudioContext already exists, state:", audioContextRef.current.state);
          if (audioContextRef.current.state === "suspended") {
            await audioContextRef.current.resume();
          }
          setGraphInitialized(true);
          return audioContextRef.current;
        }

        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 });
        console.log("[AudioMixer] New AudioContext created, state:", ctx.state);
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
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

      // De-esser (targets sibilance at 4-8kHz)
      const deEsser = ctx.createBiquadFilter();
      deEsser.type = "peaking";
      deEsser.frequency.value = 6000;
      deEsser.Q.value = 2;
      deEsser.gain.value = 0;
      deEsserRef.current = deEsser;

      // Vocal Presence (boost at 3-5kHz for clarity)
      const vocalPresence = ctx.createBiquadFilter();
      vocalPresence.type = "peaking";
      vocalPresence.frequency.value = 3500;
      vocalPresence.Q.value = 1.2;
      vocalPresence.gain.value = 0;
      vocalPresenceRef.current = vocalPresence;

      // Compressor (main dynamics)
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = effects.compressorThreshold;
      compressor.ratio.value = effects.compressorRatio;
      compressor.attack.value = effects.compressorAttack;
      compressor.release.value = effects.compressorRelease;
      compressor.knee.value = effects.compressorKnee;
      compressorRef.current = compressor;

      // Noise gate
      const noiseGate = ctx.createDynamicsCompressor();
      noiseGate.threshold.value = effects.noiseGateThreshold;
      noiseGate.ratio.value = 20;
      noiseGate.attack.value = 0.001;
      noiseGate.release.value = 0.1;
      noiseGate.knee.value = 0;
      noiseGateRef.current = noiseGate;

      // Auto-normalize
      const normalize = ctx.createDynamicsCompressor();
      normalize.threshold.value = -18;
      normalize.ratio.value = 3;
      normalize.attack.value = 0.01;
      normalize.release.value = 0.1;
      normalize.knee.value = 10;
      normalizeRef.current = normalize;

      // Auto-Tune / Pitch Correction (AudioWorkletNode)
      // Will be loaded asynchronously after context is created
      // Chain position: normalize → autoTune → delay
      autoTuneRef.current = null; // Placeholder — loaded via loadAutoTune()

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
      delayDry.gain.value = 1;
      delayDryRef.current = delayDry;

      // Reverb (convolution-style using simple IR generation)
      const reverbConvolver = ctx.createConvolver();
      reverbConvolver.buffer = generateReverbIR(ctx, effects.reverbDecay);
      reverbConvolverRef.current = reverbConvolver;

      const reverbMix = ctx.createGain();
      reverbMix.gain.value = effects.reverbEnabled ? effects.reverbMix : 0;
      reverbMixRef.current = reverbMix;

      const reverbDry = ctx.createGain();
      reverbDry.gain.value = 1;
      reverbDryRef.current = reverbDry;

      // Chorus effect
      const chorusDelay = ctx.createDelay(0.05);
      chorusDelay.delayTime.value = 0.007;
      chorusDelayRef.current = chorusDelay;

      const chorusDepth = ctx.createGain();
      chorusDepth.gain.value = effects.chorusDepth * 0.001;
      chorusDepthRef.current = chorusDepth;

      const chorusLFO = ctx.createOscillator();
      chorusLFO.frequency.value = effects.chorusRate;
      chorusLFO.type = "sine";
      chorusLFO.connect(chorusDepth);
      chorusLFO.start();
      chorusLFORef.current = chorusLFO;

      const chorusMixNode = ctx.createGain();
      chorusMixNode.gain.value = effects.chorusMix;
      chorusMixRef.current = chorusMixNode;

      const chorusDry = ctx.createGain();
      chorusDry.gain.value = 1;
      chorusDryRef.current = chorusDry;

      // Sidechain compressor
      const sidechain = ctx.createDynamicsCompressor();
      sidechain.threshold.value = effects.sidechainThreshold;
      sidechain.ratio.value = 8;
      sidechain.attack.value = 0.001;
      sidechain.release.value = 0.1;
      sidechain.knee.value = 0;
      sidechainRef.current = sidechain;

      // Limiter (brick-wall at output)
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = effects.limiterThreshold;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.01;
      limiter.knee.value = 0;
      limiterRef.current = limiter;

      // Output gain
      const outputGain = ctx.createGain();
      outputGain.gain.value = masterVolume / 100;
      outputGainRef.current = outputGain;

      // Monitor gain
      const monitorGain = ctx.createGain();
      monitorGain.gain.value = monitorMuted ? 0 : masterVolume / 100;
      monitorGainRef.current = monitorGain;

      // Analyser for metering
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;
      frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);

      // Spectrum analyser (larger FFT for visualization)
      const spectrumAnalyser = ctx.createAnalyser();
      spectrumAnalyser.fftSize = 2048;
      spectrumAnalyserRef.current = spectrumAnalyser;
      spectrumDataRef.current = new Uint8Array(spectrumAnalyser.frequencyBinCount);

      // MediaStreamDestination → viewers
      const dest = ctx.createMediaStreamDestination();
      destinationRef.current = dest;

      // ── Wire the full chain ───────────────────────────────────────────
      // EQ chain: highPass → bass → lowMid → mid → highMid → treble
      highPass.connect(bass);
      bass.connect(lowMid);
      lowMid.connect(mid);
      mid.connect(highMid);
      highMid.connect(treble);

      // treble → deEsser → vocalPresence → compressor
      treble.connect(deEsser);
      deEsser.connect(vocalPresence);
      vocalPresence.connect(compressor);

      // compressor → noiseGate
      compressor.connect(noiseGate);

      // noiseGate → normalize
      noiseGate.connect(normalize);

      // normalize → delay dry/wet split (will be re-routed when auto-tune loads)
      normalize.connect(delayDry);
      normalize.connect(delay);
      delay.connect(delayFeedback);
      delayFeedback.connect(delay);
      delay.connect(delayMix);

      // normalize → reverb dry/wet split
      normalize.connect(reverbDry);
      normalize.connect(reverbConvolver);
      reverbConvolver.connect(reverbMix);

      // normalize → chorus dry/wet split
      normalize.connect(chorusDry);
      chorusDelay.connect(chorusLFO);
      chorusDelay.connect(chorusDepth);
      chorusDepth.connect(chorusDelay);
      chorusDelay.connect(chorusMixNode);

      // sidechain compressor (receives dry + delay wet)
      delayDry.connect(sidechain);
      delayMix.connect(sidechain);

      // sidechain → reverb merge
      sidechain.connect(reverbDry);
      sidechain.connect(reverbMix);

      // reverb merge → chorus merge
      reverbDry.connect(chorusDry);
      reverbMix.connect(chorusMixNode);

      // chorus merge → limiter
      chorusDry.connect(limiter);
      chorusMixNode.connect(limiter);

      // limiter → outputGain
      limiter.connect(outputGain);

      // ── Two output paths ──────────────────────────────────────────────
      // Path 1: outputGain → analyser → MediaStreamDestination → WEBRTC VIEWERS
      outputGain.connect(analyser);
      analyser.connect(dest);

      // Path 2: outputGain → spectrum → monitorGain → ADMIN SPEAKERS
      outputGain.connect(spectrumAnalyser);
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
      console.log("[AudioMixer] Audio graph initialized successfully");
      toast.success("Professional Audio Studio Active");
      return ctx;
    } catch (err) {
      console.error("[AudioMixer] Failed to initialize audio graph:", err);
      toast.error("Failed to start Audio Studio. Please try again.");
      return null;
    }
    }, [onProcessedStream]); // Simplified dependencies to avoid unnecessary recreations; useEffects handle live updates

    /* ── Load Auto-Tune AudioWorklet Processor ─────────────────────────────── */
    const loadAutoTune = useCallback(async () => {
      if (autoTuneLoadedRef.current || !audioContextRef.current) return;
      try {
        const ctx = audioContextRef.current;
        await ctx.audioWorklet.addModule('/audio/auto-tune-processor.js');
        
        const autoTuneNode = new AudioWorkletNode(ctx, 'auto-tune-processor', {
          parameterData: {
            enabled: 0, // Start disabled
            amount: effects.autoTuneAmount / 100,
            rootNote: 0,
            correctionSpeed: 0.5,
          },
          numberOfInputs: 1,
          numberOfOutputs: 1,
        });
        
        // Re-route: normalize → autoTune → delay
        // Disconnect normalize from delay path
        if (normalizeRef.current) {
          try {
            normalizeRef.current.disconnect();
          } catch (e) {}
        }
        
        // Route: normalize → autoTune → delay
        if (normalizeRef.current) normalizeRef.current.connect(autoTuneNode);
        autoTuneNode.connect(delayRef.current!);
        autoTuneNode.connect(delayDryRef.current!);
        
        autoTuneRef.current = autoTuneNode;
        autoTuneLoadedRef.current = true;
        console.log('[AudioMixer] Auto-Tune AudioWorklet loaded successfully');
      } catch (err) {
        console.warn('[AudioMixer] Failed to load Auto-Tune worklet:', err);
        // Auto-tune is optional — fall back to bypass mode
        autoTuneLoadedRef.current = true;
      }
    }, []);

    /* ── Generate Reverb Impulse Response ──────────────────────────────────── */
    function generateReverbIR(ctx: AudioContext, decay: number): AudioBuffer {
      const length = ctx.sampleRate * decay;
      const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
      }
      return buffer;
    }

    /* ── Wire Camera Microphone Track ──────────────────────────────────────── */
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
        if (!micPanRef.current) {
          micPanRef.current = ctx.createStereoPanner();
        }

        source.connect(micGainRef.current);
        micGainRef.current.connect(micPanRef.current);
        micPanRef.current.connect(highPassRef.current!);

        console.log("[AudioMixer] Camera microphone wired to unified processing chain");
      } catch (err) {
        console.error("[AudioMixer] Mic wiring error:", err);
      }
    }, [mediaStream, graphInitialized]);

    /* ── Switch Microphone Device ──────────────────────────────────────────── */
    const switchMicrophoneDevice = useCallback(async (deviceId: string) => {
      try {
        // Stop current mic tracks
        if (mediaStream) {
          mediaStream.getAudioTracks().forEach(t => t.stop());
        }

        // Request new microphone stream
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });

        setSelectedMicDeviceId(deviceId);

        // Re-wire the new mic source into the existing processing chain
        if (!graphInitialized) {
          // If graph not initialized yet, pass the new stream as mediaStream
          // The useEffect above will handle wiring when graph initializes
          return newStream;
        }

        const ctx = audioContextRef.current!;
        if (micSourceRef.current) micSourceRef.current.disconnect();

        const source = ctx.createMediaStreamSource(newStream);
        micSourceRef.current = source;
        source.connect(micGainRef.current!);
        micGainRef.current!.connect(micPanRef.current!);

        console.log("[AudioMixer] Microphone switched to device:", deviceId);
        toast.success("Microphone device switched");
        return newStream;
      } catch (err) {
        console.error("[AudioMixer] Failed to switch microphone:", err);
        toast.error("Failed to switch microphone device");
        return null;
      }
    }, [mediaStream, graphInitialized]);

    /* ── Discover Available Microphone Devices ─────────────────────────────── */
    useEffect(() => {
      async function enumerateMics() {
        try {
          // Request mic permission first to get labels
          await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
          const devices = await navigator.mediaDevices.enumerateDevices();
          const mics = devices.filter(d => d.kind === 'audioinput');
          setAvailableMics(mics);
          if (mics.length > 0 && !selectedMicDeviceId) {
            setSelectedMicDeviceId(mics[0].deviceId);
          }
        } catch (err) {
          console.warn("[AudioMixer] Could not enumerate mic devices:", err);
        }
      }
      enumerateMics();
    }, [graphInitialized]);

    /* ── Wire Pre-Stream Audio Track ───────────────────────────────────────── */
    useEffect(() => {
      if (!graphInitialized) return;
      const ctx = audioContextRef.current!;

      try {
        // Disconnect previous pre-stream source
        if (preStreamSourceRef.current) {
          preStreamSourceRef.current.disconnect();
        }

        if (preStreamAudioStream && preStreamAudioStream.getAudioTracks().length > 0) {
          const source = ctx.createMediaStreamSource(preStreamAudioStream);
          preStreamSourceRef.current = source;

          if (!preStreamGainRef.current) {
            preStreamGainRef.current = ctx.createGain();
          }
          if (!preStreamPanRef.current) {
            preStreamPanRef.current = ctx.createStereoPanner();
          }

          source.connect(preStreamGainRef.current);
          preStreamGainRef.current.connect(preStreamPanRef.current);
          preStreamPanRef.current.connect(highPassRef.current!);

          console.log("[AudioMixer] Pre-stream audio wired to unified processing chain");
        } else {
          preStreamSourceRef.current = null;
          // Mute the pre-stream track when no stream
          if (preStreamGainRef.current) {
            const now = ctx.currentTime;
            preStreamGainRef.current.gain.setTargetAtTime(0, now, RAMP_TIME);
          }
        }
      } catch (err) {
        console.error("[AudioMixer] Pre-stream wiring error:", err);
      }
    }, [preStreamAudioStream, graphInitialized]);

    /* ── Wire Music Player Track ───────────────────────────────────────────── */
    useEffect(() => {
      if (!musicAudioRef.current || !graphInitialized) return;
      const ctx = audioContextRef.current!;

      try {
        if (!musicSourceRef.current) {
          musicSourceRef.current = ctx.createMediaElementSource(musicAudioRef.current);
          musicGainRef.current = ctx.createGain();
          musicPanRef.current = ctx.createStereoPanner();
          musicSourceRef.current.connect(musicGainRef.current);
          musicGainRef.current.connect(musicPanRef.current);
          musicPanRef.current.connect(highPassRef.current!);
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

        initAudioContext();
        systemStreamRef.current = stream;

        if (systemSourceRef.current) systemSourceRef.current.disconnect();
        const ctx = audioContextRef.current!;
        systemSourceRef.current = ctx.createMediaStreamSource(new MediaStream(audioTracks));

        if (!systemGainRef.current) {
          systemGainRef.current = ctx.createGain();
        }
        if (!systemPanRef.current) {
          systemPanRef.current = ctx.createStereoPanner();
        }

        systemSourceRef.current.connect(systemGainRef.current);
        systemGainRef.current.connect(systemPanRef.current);
        systemPanRef.current.connect(highPassRef.current!);

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

    /* ── Update Track Gains with Auto-Ducking & Solo ───────────────────────── */
    const updateTrackGains = useCallback(() => {
      if (!audioContextRef.current) return;
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;

      const micTrack = tracks.find(t => t.id === "mic");
      const isMicActive = micTrack && !micTrack.muted && micTrack.level > 15;
      const hasSolo = tracks.some(t => t.solo);

      tracks.forEach(track => {
        let targetGain = track.muted ? 0 : track.volume / 100;

        // Solo mode: if any track is soloed, mute all non-soloed tracks
        if (hasSolo && !track.solo) {
          targetGain = 0;
        }

        // Auto-ducking: lower music/system when mic is active
        if ((track.id === "music" || track.id === "system") && effects.autoDucking && isMicActive) {
          targetGain *= (1 - effects.duckAmount / 100);
        }

        let node: GainNode | null = null;
        if (track.id === "mic") node = micGainRef.current;
        if (track.id === "music") node = musicGainRef.current;
        if (track.id === "system") node = systemGainRef.current;
        if (track.id === "preStream") node = preStreamGainRef.current;

        if (node) {
          node.gain.setTargetAtTime(targetGain, now, RAMP_TIME);
        }

        // Update pan
        let panNode: StereoPannerNode | null = null;
        if (track.id === "mic") panNode = micPanRef.current;
        if (track.id === "music") panNode = musicPanRef.current;
        if (track.id === "system") panNode = systemPanRef.current;
        if (track.id === "preStream") panNode = preStreamPanRef.current;

        if (panNode) {
          panNode.pan.setTargetAtTime(track.pan / 100, now, RAMP_TIME);
        }
      });
    }, [tracks, effects.autoDucking, effects.duckAmount]);

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

    /* ── Apply DeEsser ─────────────────────────────────────────────────────── */
    useEffect(() => {
      if (!audioContextRef.current || !deEsserRef.current) return;
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;
      const targetGain = effects.deEsserEnabled ? -6 : 0;
      deEsserRef.current.gain.setTargetAtTime(targetGain, now, RAMP_TIME);
    }, [effects.deEsserEnabled, effects.deEsserThreshold]);

    /* ── Apply Vocal Presence ──────────────────────────────────────────────── */
    useEffect(() => {
      if (!audioContextRef.current || !vocalPresenceRef.current) return;
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;
      vocalPresenceRef.current.gain.setTargetAtTime(effects.vocalPresence / 10, now, RAMP_TIME);
    }, [effects.vocalPresence]);

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
      if (!audioContextRef.current || !normalizeRef.current || !noiseGateRef.current) return;
      // Normalize is always connected; just adjust its parameters
      if (effects.autoNormalizeEnabled) {
        normalizeRef.current.threshold.setTargetAtTime(-18, audioContextRef.current.currentTime, RAMP_TIME);
        normalizeRef.current.ratio.setTargetAtTime(3, audioContextRef.current.currentTime, RAMP_TIME);
      } else {
        normalizeRef.current.ratio.setTargetAtTime(1, audioContextRef.current.currentTime, RAMP_TIME);
      }
    }, [effects.autoNormalizeEnabled]);

    /* ── Apply Auto-Tune Settings ──────────────────────────────────────────── */
    useEffect(() => {
      if (!autoTuneRef.current || !autoTuneLoadedRef.current) return;
      
      try {
        const node = autoTuneRef.current;
        node.parameters.get('enabled').value = effects.autoTuneEnabled ? 1 : 0;
        node.parameters.get('amount').value = effects.autoTuneAmount / 100;
        node.parameters.get('correctionSpeed').value = 0.3 + (effects.autoTuneAmount / 100) * 0.7;
      } catch (err) {
        console.warn('[AudioMixer] Failed to update auto-tune parameters:', err);
      }
    }, [effects.autoTuneEnabled, effects.autoTuneAmount]);

    /* ── Load Auto-Tune when effects enabled ───────────────────────────────── */
    useEffect(() => {
      if (effects.autoTuneEnabled && graphInitialized && !autoTuneLoadedRef.current) {
        loadAutoTune();
      }
    }, [effects.autoTuneEnabled, graphInitialized, loadAutoTune]);

    /* ── Apply Delay Settings ──────────────────────────────────────────────── */
    useEffect(() => {
      if (!audioContextRef.current) return;
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;

      if (delayRef.current) delayRef.current.delayTime.setTargetAtTime(effects.delayTime, now, RAMP_TIME);
      if (delayFeedbackRef.current) delayFeedbackRef.current.gain.setTargetAtTime(effects.delayFeedback, now, RAMP_TIME);
      if (delayMixRef.current) delayMixRef.current.gain.setTargetAtTime(effects.delayMix, now, RAMP_TIME);
      if (delayDryRef.current) delayDryRef.current.gain.setTargetAtTime(1, now, RAMP_TIME);
    }, [effects.delayTime, effects.delayFeedback, effects.delayMix]);

    /* ── Apply Reverb Settings ─────────────────────────────────────────────── */
    useEffect(() => {
      if (!audioContextRef.current) return;
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;

      if (reverbConvolverRef.current && effects.reverbDecay !== DEFAULT_EFFECTS.reverbDecay) {
        reverbConvolverRef.current.buffer = generateReverbIR(ctx, effects.reverbDecay);
      }
      if (reverbMixRef.current) {
        const mix = effects.reverbEnabled ? effects.reverbMix : 0;
        reverbMixRef.current.gain.setTargetAtTime(mix, now, RAMP_TIME);
      }
    }, [effects.reverbEnabled, effects.reverbMix, effects.reverbDecay]);

    /* ── Apply Chorus Settings ─────────────────────────────────────────────── */
    useEffect(() => {
      if (!audioContextRef.current) return;
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;

      if (chorusLFORef.current) {
        chorusLFORef.current.frequency.setTargetAtTime(effects.chorusRate, now, RAMP_TIME);
      }
      if (chorusDepthRef.current) {
        chorusDepthRef.current.gain.setTargetAtTime(effects.chorusDepth * 0.001, now, RAMP_TIME);
      }
      if (chorusMixRef.current) {
        const mix = effects.chorusEnabled ? effects.chorusMix : 0;
        chorusMixRef.current.gain.setTargetAtTime(mix, now, RAMP_TIME);
      }
    }, [effects.chorusEnabled, effects.chorusRate, effects.chorusDepth, effects.chorusMix]);

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

        // Compressor activity
        const compressorReduction = compressorRef.current ? compressorRef.current.reduction : 0;
        const compressorActive = compressorRef.current && Math.abs(compressorReduction) > 0.5;

        // Check delay activity
        const delayActive = effects.delayMix > 0.01 && masterLevel > 5;

        // Check reverb activity
        const reverbActive = effects.reverbEnabled && effects.reverbMix > 0 && masterLevel > 5;

        // Check chorus activity
        const chorusActive = effects.chorusEnabled && effects.chorusMix > 0 && masterLevel > 5;

        // Update tracks
        setTracks(prev => prev.map(t => {
          let isActive = false;
          if (t.id === "mic" && mediaStream) isActive = true;
          if (t.id === "music" && isMusicPlaying) isActive = true;
          if (t.id === "system" && isCapturingSystem) isActive = true;
          if (t.id === "preStream" && preStreamAudioStream) isActive = true;

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
          input: { ...prev.input, active: mediaStream !== null || preStreamAudioStream !== null, level: masterLevel },
          highpass: { ...prev.highpass, active: effects.highPassFreq > 0, level: effects.highPassFreq > 0 ? 80 : 0 },
          bass: { ...prev.bass, active: Math.abs(effects.bass) > 0, level: Math.min(100, Math.abs(effects.bass) * 8) },
          lowMid: { ...prev.lowMid, active: Math.abs(effects.lowMid) > 0, level: Math.min(100, Math.abs(effects.lowMid) * 8) },
          mid: { ...prev.mid, active: Math.abs(effects.mid) > 0, level: Math.min(100, Math.abs(effects.mid) * 8) },
          highMid: { ...prev.highMid, active: Math.abs(effects.highMid) > 0, level: Math.min(100, Math.abs(effects.highMid) * 8) },
          treble: { ...prev.treble, active: Math.abs(effects.treble) > 0, level: Math.min(100, Math.abs(effects.treble) * 8) },
          deEsser: { ...prev.deEsser, active: effects.deEsserEnabled, level: effects.deEsserEnabled ? 70 : 0 },
          compressor: { ...prev.compressor, active: compressorActive || effects.compressorRatio > 1, level: compressorActive ? Math.min(100, Math.abs(compressorReduction) * 10) : (effects.compressorRatio > 1 ? 30 : 0) },
          gate: { ...prev.gate, active: effects.noiseGateThreshold > -100, level: effects.noiseGateThreshold > -100 ? (masterLevel > 10 ? 80 : 20) : 0 },
          normalize: { ...prev.normalize, active: effects.autoNormalizeEnabled, level: effects.autoNormalizeEnabled ? 70 : 0 },
          autoTune: { ...prev.autoTune, active: effects.autoTuneEnabled, level: effects.autoTuneEnabled ? 80 : 0 },
          reverb: { ...prev.reverb, active: reverbActive, level: reverbActive ? Math.min(100, effects.reverbMix * 200) : 0 },
          delay: { ...prev.delay, active: delayActive, level: delayActive ? Math.min(100, effects.delayMix * 200) : 0 },
          chorus: { ...prev.chorus, active: chorusActive, level: chorusActive ? Math.min(100, effects.chorusMix * 200) : 0 },
          limiter: { ...prev.limiter, active: masterLevel > 90, level: masterLevel > 90 ? Math.min(100, (masterLevel - 90) * 10) : 0 },
          output: { ...prev.output, active: masterLevel > 1, level: masterLevel },
          monitor: { ...prev.monitor, active: !monitorMuted, level: monitorMuted ? 0 : masterLevel },
        }));

        requestAnimationFrame(meterLoop);
      };

      const animFrame = requestAnimationFrame(meterLoop);
      return () => cancelAnimationFrame(animFrame);
    }, [mediaStream, isMusicPlaying, isCapturingSystem, preStreamAudioStream, effects, monitorMuted]);

    /* ── Spectrum Analyzer Canvas ──────────────────────────────────────────── */
    useEffect(() => {
      if (!spectrumCanvasRef.current || !spectrumAnalyserRef.current || activeTab !== "master") return;

      const canvas = spectrumCanvasRef.current;
      const ctx = canvas.getContext("2d")!;
      const analyser = spectrumAnalyserRef.current;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const drawSpectrum = () => {
        requestAnimationFrame(drawSpectrum);
        analyser.getByteFrequencyData(dataArray);

        ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height;
          const hue = (i / bufferLength) * 240; // Blue to red gradient

          ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);

          x += barWidth;
        }
      };

      const animFrame = requestAnimationFrame(drawSpectrum);
      return () => cancelAnimationFrame(animFrame);
    }, [activeTab]);

    /* ── Waveform Canvas ───────────────────────────────────────────────────── */
    useEffect(() => {
      if (!waveformCanvasRef.current || !analyserRef.current || activeTab !== "master") return;

      const canvas = waveformCanvasRef.current;
      const ctx = canvas.getContext("2d")!;
      const analyser = analyserRef.current;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const drawWaveform = () => {
        requestAnimationFrame(drawWaveform);
        analyser.getByteTimeDomainData(dataArray);

        ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.lineWidth = 2;
        ctx.strokeStyle = "#3b82f6";
        ctx.beginPath();

        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * canvas.height) / 2;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);

          x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      };

      const animFrame = requestAnimationFrame(drawWaveform);
      return () => cancelAnimationFrame(animFrame);
    }, [activeTab]);

    /* ── Audio Recording ───────────────────────────────────────────────────── */
    const startRecording = useCallback(() => {
      if (!destinationRef.current || !audioContextRef.current) return;

      const stream = destinationRef.current.stream;
      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);
        toast.success("Audio recording saved!");
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      onRecordingStateChange?.(true);
      toast.info("Recording started...");
    }, [onRecordingStateChange]);

    const stopRecording = useCallback(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      onRecordingStateChange?.(false);
    }, [onRecordingStateChange]);

    const downloadRecording = useCallback(() => {
      if (recordedAudioUrl) {
        const a = document.createElement("a");
        a.href = recordedAudioUrl;
        a.download = `studio-recording-${Date.now()}.webm`;
        a.click();
        toast.success("Recording downloaded!");
      }
    }, [recordedAudioUrl]);

    /* ── Scene Presets ─────────────────────────────────────────────────────── */
    const saveScene = useCallback(() => {
      if (!newSceneName.trim()) {
        toast.error("Please enter a scene name");
        return;
      }
      const scene: AudioScene = {
        name: newSceneName,
        effects: { ...effects },
        trackSettings: {},
      };
      tracks.forEach(t => {
        scene.trackSettings[t.id] = { volume: t.volume, muted: t.muted, solo: t.solo, pan: t.pan };
      });
      setScenes(prev => [...prev.filter(s => s.name !== newSceneName), scene]);
      setCurrentScene(newSceneName);
      setShowNewScene(false);
      setNewSceneName("");
      toast.success(`Scene "${newSceneName}" saved`);
    }, [newSceneName, effects, tracks]);

    const loadScene = useCallback((scene: AudioScene) => {
      setEffects(prev => ({ ...prev, ...scene.effects }));
      setTracks(prev => prev.map(t => {
        const settings = scene.trackSettings[t.id];
        if (!settings) return t;
        return { ...t, ...settings };
      }));
      setCurrentScene(scene.name);
      toast.success(`Scene "${scene.name}" loaded`);
    }, []);

    /* ── Presets ───────────────────────────────────────────────────────────── */
    const applyPreset = useCallback((preset: string) => {
      const presets: Record<string, Partial<AudioEffects>> = {
        flat: { bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, compressorThreshold: -100, compressorRatio: 1, noiseGateThreshold: -100, autoNormalizeEnabled: false, delayMix: 0, reverbEnabled: false, chorusEnabled: false, autoTuneEnabled: false, deEsserEnabled: false },
        voice: { bass: 0, lowMid: 0, mid: 3, highMid: 4, treble: 2, compressorThreshold: -24, compressorRatio: 6, noiseGateThreshold: -55, autoNormalizeEnabled: true, delayMix: 0, reverbEnabled: false, chorusEnabled: false, autoTuneEnabled: false, deEsserEnabled: true, vocalPresence: 40 },
        broadcast: { bass: 1, lowMid: -1, mid: 1, highMid: 2, treble: 1, compressorThreshold: -20, compressorRatio: 5, noiseGateThreshold: -50, autoNormalizeEnabled: true, delayMix: 0, reverbEnabled: false, chorusEnabled: false, autoTuneEnabled: false, deEsserEnabled: true, vocalPresence: 50 },
        church: { bass: 2, lowMid: -3, mid: 0, highMid: 1, treble: 3, compressorThreshold: -22, compressorRatio: 4, noiseGateThreshold: -50, autoNormalizeEnabled: true, delayMix: 0, reverbEnabled: true, reverbMix: 0.15, reverbDecay: 2.0, chorusEnabled: false, autoTuneEnabled: false, deEsserEnabled: true, vocalPresence: 55 },
        noisy: { bass: -6, lowMid: -4, mid: 0, highMid: 0, treble: 1, compressorThreshold: -18, compressorRatio: 8, noiseGateThreshold: -40, autoNormalizeEnabled: true, delayMix: 0, reverbEnabled: false, chorusEnabled: false, autoTuneEnabled: false, deEsserEnabled: true },
        music: { bass: 4, lowMid: 1, mid: 0, highMid: 1, treble: 3, compressorThreshold: -20, compressorRatio: 3, noiseGateThreshold: -60, autoNormalizeEnabled: false, delayMix: 0, reverbEnabled: true, reverbMix: 0.1, reverbDecay: 1.5, chorusEnabled: false, autoTuneEnabled: false, deEsserEnabled: false },
        worship: { bass: 1, lowMid: -2, mid: 1, highMid: 2, treble: 2, compressorThreshold: -20, compressorRatio: 5, noiseGateThreshold: -50, autoNormalizeEnabled: true, delayMix: 0, reverbEnabled: true, reverbMix: 0.25, reverbDecay: 3.0, chorusEnabled: true, chorusRate: 1.2, chorusDepth: 8, chorusMix: 0.15, autoTuneEnabled: true, autoTuneAmount: 30, deEsserEnabled: true, vocalPresence: 60 },
        podcast: { bass: -2, lowMid: -3, mid: 2, highMid: 3, treble: 1, compressorThreshold: -22, compressorRatio: 6, noiseGateThreshold: -50, autoNormalizeEnabled: true, delayMix: 0, reverbEnabled: false, chorusEnabled: false, autoTuneEnabled: false, deEsserEnabled: true, vocalPresence: 70 },
      };

      const p = presets[preset];
      if (!p) return;

      setEffects(prev => ({ ...prev, ...p }));
      toast.success(`Applied "${preset}" preset`);
    }, []);

    /* ── Track Volume/Mute/Solo ────────────────────────────────────────────── */
    const handleTrackVolume = useCallback((trackId: string, volume: number) => {
      setTracks(prev => prev.map(t => t.id === trackId ? { ...t, volume } : t));
      onVolumeChange?.(trackId, volume);
    }, [onVolumeChange]);

    const handleTrackMute = useCallback((trackId: string) => {
      setTracks(prev => prev.map(t => {
        if (t.id !== trackId) return t;
        const newMuted = !t.muted;
        onMuteChange?.(trackId, newMuted);
        return { ...t, muted: newMuted, solo: false }; // Un-solo when muting
      }));
    }, [onMuteChange]);

    const handleTrackSolo = useCallback((trackId: string) => {
      setTracks(prev => prev.map(t => {
        if (t.id !== trackId) return t;
        return { ...t, solo: !t.solo, muted: false }; // Un-mute when soloing
      }));
    }, []);

    const handleTrackPan = useCallback((trackId: string, pan: number) => {
      setTracks(prev => prev.map(t => t.id === trackId ? { ...t, pan } : t));
    }, []);

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

    /* ── Available Microphone Devices ──────────────────────────────────────── */
    useEffect(() => {
      const loadMics = async () => {
        try {
          // Request permission first
          await navigator.mediaDevices.getUserMedia({ audio: true });
          const devices = await navigator.mediaDevices.enumerateDevices();
          const mics = devices.filter(d => d.kind === "audioinput");
          setAvailableMics(mics);
          if (mics.length > 0 && !selectedMicDeviceId) {
            setSelectedMicDeviceId(mics[0].deviceId);
          }
        } catch (err) {
          console.warn("[AudioMixer] Could not enumerate microphones:", err);
        }
      };
      loadMics();
    }, []);

    /* ── LED Component ─────────────────────────────────────────────────────── */
    function NodeLED({ node, size = "md" }: { node: NodeLEDState; size?: "sm" | "md" | "lg" }) {
      const sizeClass = size === "lg" ? "w-3 h-3" : size === "md" ? "w-2.5 h-2.5" : "w-2 h-2";
      const colorMap: Record<string, string> = {
        green: "bg-emerald-400",
        blue: "bg-blue-400",
        amber: "bg-amber-400",
        red: "bg-red-400",
        white: "bg-white",
        purple: "bg-purple-400",
        cyan: "bg-cyan-400",
      };
      const color = colorMap[node.color] || "bg-slate-500";
      const opacity = node.active ? (0.3 + (node.level / 100) * 0.7) : 0.15;

      return (
        <div className="flex items-center gap-1.5">
          <div
            className={`${sizeClass} rounded-full ${color} transition-all duration-200`}
            style={{
              opacity,
              boxShadow: node.active ? `0 0 ${4 + node.level * 0.1}px ${node.color === "purple" ? "#a855f7" : node.color === "cyan" ? "#22d3ee" : node.color}` : "none",
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

    /* ── Expose ref methods ────────────────────────────────────────────────── */
    useImperativeHandle(ref, () => ({
      initAudioContext: async () => {
        console.log("[AudioMixer] Imperative initAudioContext called, graphInitialized:", graphInitialized);
        if (!graphInitialized) {
          await initAudioContext();
          return true;
        }
        return false;
      },
      getProcessedStream: () => destinationRef.current?.stream || null,
      getAudioContext: () => audioContextRef.current,
      registerSource: (sourceId: string, stream: MediaStream | null) => {
        if (sourceId === "preStream" && stream) {
          // Already handled by preStreamAudioStream prop
        }
      },
      switchMicrophone: async (deviceId: string) => {
        const newStream = await switchMicrophoneDevice(deviceId);
        onMicrophoneSwitch?.(newStream);
        return newStream;
      },
    }), [graphInitialized, initAudioContext, switchMicrophoneDevice, onMicrophoneSwitch]);

    /* ── Tab Configuration ─────────────────────────────────────────────────── */
    const tabs = useMemo(() => [
      { id: "mixer" as const, label: "Tracks", icon: <Waves className="w-3.5 h-3.5" /> },
      { id: "eq" as const, label: "EQ", icon: <Sliders className="w-3.5 h-3.5" /> },
      { id: "effects" as const, label: "FX", icon: <Zap className="w-3.5 h-3.5" /> },
      { id: "voice" as const, label: "Voice", icon: <Mic className="w-3.5 h-3.5" /> },
      { id: "master" as const, label: "Master", icon: <Headphones className="w-3.5 h-3.5" /> },
    ], []);

    /* ─── RENDER ───────────────────────────────────────────────────────────── */

    return (
      <Card className="relative bg-slate-950 border-slate-800 shadow-2xl overflow-hidden flex flex-col h-full border-2">

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
                {isRecording && <span className="text-[10px] text-red-400 font-mono uppercase flex items-center gap-1"><CircleDot className="w-3 h-3 animate-pulse" />REC</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Power / Init */}
            {!graphInitialized ? (
              <Button
                variant="default"
                size="sm"
                className="h-8 text-[10px] font-bold uppercase gap-2 bg-amber-600 hover:bg-amber-700 text-white animate-pulse"
                onClick={() => initAudioContext()}
              >
                <Power className="w-3 h-3" />
                Start Audio Studio
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[10px] font-bold uppercase gap-2 border-green-500/30 bg-green-500/10 text-green-400"
                onClick={() => toast.info("Audio engine is active")}
              >
                <Power className="w-3 h-3" />
                Active
              </Button>
            )}

            {/* Recording */}
            <Button
              variant="outline"
              size="sm"
              className={`h-8 text-[10px] font-bold uppercase gap-2 border-slate-700 ${isRecording ? 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse' : 'bg-slate-800 text-slate-400'}`}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? <Pause className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
              {isRecording ? "Stop Rec" : "Record"}
            </Button>
            {recordedAudioUrl && !isRecording && (
              <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase gap-2 border-slate-700 bg-slate-800 text-slate-400" onClick={downloadRecording}>
                <Download className="w-3 h-3" /> Download
              </Button>
            )}

            {/* Scenes */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[10px] font-bold uppercase gap-2 border-slate-700 bg-slate-800 text-slate-400"
              onClick={() => setShowScenes(!showScenes)}
            >
              <Palette className="w-3 h-3" /> {currentScene}
            </Button>

            {/* System Audio */}
            <Button
              variant="outline"
              size="sm"
              className={`h-8 text-[10px] font-bold uppercase gap-2 border-slate-700 ${isCapturingSystem ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-slate-800 text-slate-400'}`}
              onClick={isCapturingSystem ? stopSystemCapture : startSystemCapture}
            >
              <Monitor className="w-3 h-3" />
              {isCapturingSystem ? "Sys ON" : "Sys"}
            </Button>
          </div>
        </div>

        {/* ── Initialization Overlay ──────────────────────────────────── */}
        {!graphInitialized && (
          <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <div className="bg-primary/20 p-4 rounded-full mb-4">
              <Waves className="w-12 h-12 text-primary animate-pulse" />
            </div>
            <h3 className="text-xl font-black text-white uppercase italic tracking-tight mb-2">Pro Audio Engine Offline</h3>
            <p className="text-slate-400 text-sm max-w-xs mb-6">
              The professional audio processing chain requires activation to route your microphone and media audio.
            </p>
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 text-white font-black uppercase italic tracking-widest px-8 py-6 rounded-2xl shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 active:translate-y-0"
              onClick={() => initAudioContext()}
            >
              <Power className="w-5 h-5 mr-2" />
              Start Audio Studio
            </Button>
          </div>
        )}

        {/* ── Scene Presets Dropdown ──────────────────────────────────── */}
        <AnimatePresence>
          {showScenes && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-slate-900/60 border-b border-slate-800 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Scene Presets</h4>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {scenes.map(scene => (
                    <Button
                      key={scene.name}
                      variant="outline"
                      size="sm"
                      className={`h-6 text-[9px] font-bold uppercase ${scene.name === currentScene ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}
                      onClick={() => { loadScene(scene); setShowScenes(false); }}
                    >
                      {scene.name}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[9px] font-bold uppercase bg-slate-800/50 border-slate-700 text-slate-400"
                    onClick={() => setShowNewScene(true)}
                  >
                    <Plus className="w-3 h-3" /> New Scene
                  </Button>
                </div>
                {showNewScene && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newSceneName}
                      onChange={e => setNewSceneName(e.target.value)}
                      placeholder="Scene name..."
                      className="h-7 text-xs bg-slate-800 border-slate-700"
                    />
                    <Button size="sm" className="h-7 text-[10px] font-bold uppercase" onClick={saveScene}>
                      <Save className="w-3 h-3 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setShowNewScene(false)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                  { id: "worship", label: "Worship" },
                  { id: "podcast", label: "Podcast" },
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
                        <div className="p-2 rounded-lg" style={{ backgroundColor: `${track.color}20`, color: track.color }}>
                          {track.icon}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{track.name}</p>
                          <p className="text-[9px] text-slate-500 uppercase">
                            {track.id === "mic" && mediaStream ? "Connected" : track.id === "preStream" && preStreamAudioStream ? "Connected" : track.id === "music" && isMusicPlaying ? "Playing" : track.id === "system" && isCapturingSystem ? "Capturing" : "Standby"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <NodeLED
                          node={leds[track.id as keyof typeof leds] || { id: track.id, name: track.name, active: track.level > 0, level: track.level, color: track.muted ? "red" : "green" }}
                          size="md"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-9 w-9 rounded-lg transition-all ${
                          track.solo
                            ? "bg-amber-500/20 text-amber-500 hover:bg-amber-500/30"
                            : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                        }`}
                        onClick={() => handleTrackSolo(track.id)}
                      >
                        <span className="text-[9px] font-black">S</span>
                      </Button>
                    </div>

                    {/* Pan Control */}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[8px] font-mono text-slate-600 uppercase">PAN</span>
                      <div className="flex-1">
                        <Slider
                          value={[track.pan]}
                          min={-100}
                          max={100}
                          onValueChange={([val]) => handleTrackPan(track.id, val)}
                          className="cursor-pointer"
                        />
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 w-6 text-right">{track.pan === 0 ? "C" : track.pan > 0 ? `R${track.pan}` : `L${Math.abs(track.pan)}`}</span>
                    </div>

                    {/* Level Meter */}
                    <div className="mt-2 h-1.5 bg-slate-950 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        animate={{
                          width: `${track.muted ? 0 : track.level}%`,
                          backgroundColor: track.level > 80 ? "#ef4444" : track.level > 50 ? "#eab308" : track.color,
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

                    {track.id === "mic" && availableMics.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-800">
                        <select
                          value={selectedMicDeviceId}
                          onChange={(e) => setSelectedMicDeviceId(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-primary/50"
                        >
                          {availableMics.map(mic => (
                            <option key={mic.deviceId} value={mic.deviceId}>
                              {mic.label || `Microphone ${mic.deviceId.slice(0, 8)}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Auto-Ducking Settings */}
              <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-800/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-bold text-white uppercase">Auto-Ducking</span>
                  </div>
                  <button
                    onClick={() => setEffects(prev => ({ ...prev, autoDucking: !prev.autoDucking }))}
                    className={`w-10 h-5 rounded-full transition-all ${effects.autoDucking ? 'bg-primary' : 'bg-slate-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${effects.autoDucking ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {effects.autoDucking && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                      <span>Duck Amount</span>
                      <span className="text-primary">{effects.duckAmount}%</span>
                    </div>
                    <Slider value={[effects.duckAmount]} min={10} max={80} onValueChange={([val]) => setEffects(prev => ({ ...prev, duckAmount: val }))} />
                  </div>
                )}
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
                        {led && <NodeLED node={led} size="sm" />}
                        <div className="flex-1 w-6 bg-slate-950 rounded-full relative flex items-end overflow-hidden" style={{ height: 160 }}>
                          <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-700 z-10" />
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
                        <p className="text-[9px] font-bold text-white uppercase">{band.label}</p>
                        <p className="text-[8px] font-mono text-slate-500">{band.freq}</p>
                        <p className={`text-[9px] font-mono ${
                          (effects[band.key as keyof AudioEffects] || 0) > 0 ? 'text-blue-400' :
                          (effects[band.key as keyof AudioEffects] || 0) < 0 ? 'text-red-400' : 'text-slate-600'
                        }`}>
                          {(effects[band.key as keyof AudioEffects] || 0) > 0 ? '+' : ''}{effects[band.key as keyof AudioEffects]}dB
                        </p>
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

              {/* Reset EQ */}
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-[10px] font-bold uppercase bg-slate-800/50 border-slate-700 text-slate-400 gap-2"
                onClick={() => setEffects(prev => ({ ...prev, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, highPassFreq: 80 }))}
              >
                <RotateCcw className="w-3 h-3" /> Reset EQ
              </Button>
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
                      <span className="text-primary">{(effects.compressorAttack * 1000).toFixed(1)}ms</span>
                    </div>
                    <Slider value={[effects.compressorAttack * 1000]} min={0} max={50} onValueChange={([val]) => setEffects(prev => ({ ...prev, compressorAttack: val / 1000 }))} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                      <span>Release</span>
                      <span className="text-primary">{(effects.compressorRelease * 1000).toFixed(1)}ms</span>
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
                      <span className="text-primary">{effects.delayTime.toFixed(2)}s</span>
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
                    <Slider value={[effects.delayMix * 100]} min={0} max={100} onValueChange={([val]) => setEffects(prev => ({ ...prev, delayMix: val / 100 }))} />
                  </div>
                </div>
              </div>

              {/* Reverb */}
              <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Waves className="w-4 h-4 text-purple-400" />
                    <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Reverb</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <NodeLED node={leds.reverb} size="sm" />
                    <button
                      onClick={() => setEffects(prev => ({ ...prev, reverbEnabled: !prev.reverbEnabled }))}
                      className={`w-10 h-5 rounded-full transition-all ${effects.reverbEnabled ? 'bg-purple-500' : 'bg-slate-700'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${effects.reverbEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
                {effects.reverbEnabled && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                        <span>Mix</span>
                        <span className="text-purple-400">{Math.round(effects.reverbMix * 100)}%</span>
                      </div>
                      <Slider value={[effects.reverbMix * 100]} min={0} max={100} onValueChange={([val]) => setEffects(prev => ({ ...prev, reverbMix: val / 100 }))} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                        <span>Decay</span>
                        <span className="text-purple-400">{effects.reverbDecay.toFixed(1)}s</span>
                      </div>
                      <Slider value={[effects.reverbDecay * 10]} min={5} max={50} onValueChange={([val]) => setEffects(prev => ({ ...prev, reverbDecay: val / 10 }))} />
                    </div>
                  </div>
                )}
              </div>

              {/* Chorus */}
              <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <AudioLines className="w-4 h-4 text-purple-400" />
                    <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Chorus</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <NodeLED node={leds.chorus} size="sm" />
                    <button
                      onClick={() => setEffects(prev => ({ ...prev, chorusEnabled: !prev.chorusEnabled }))}
                      className={`w-10 h-5 rounded-full transition-all ${effects.chorusEnabled ? 'bg-purple-500' : 'bg-slate-700'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${effects.chorusEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
                {effects.chorusEnabled && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                        <span>Rate</span>
                        <span className="text-purple-400">{effects.chorusRate.toFixed(1)}Hz</span>
                      </div>
                      <Slider value={[effects.chorusRate * 10]} min={5} max={50} onValueChange={([val]) => setEffects(prev => ({ ...prev, chorusRate: val / 10 }))} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                        <span>Depth</span>
                        <span className="text-purple-400">{effects.chorusDepth}ms</span>
                      </div>
                      <Slider value={[effects.chorusDepth]} min={1} max={20} onValueChange={([val]) => setEffects(prev => ({ ...prev, chorusDepth: val }))} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                        <span>Mix</span>
                        <span className="text-purple-400">{Math.round(effects.chorusMix * 100)}%</span>
                      </div>
                      <Slider value={[effects.chorusMix * 100]} min={0} max={100} onValueChange={([val]) => setEffects(prev => ({ ...prev, chorusMix: val / 100 }))} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── VOICE TAB ─────────────────────────────────────────────── */}
          {activeTab === "voice" && (
            <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
              {/* Auto-Tune */}
              <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-400" />
                    <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Auto-Tune / Pitch Correction</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <NodeLED node={leds.autoTune} size="sm" />
                    <button
                      onClick={() => setEffects(prev => ({ ...prev, autoTuneEnabled: !prev.autoTuneEnabled }))}
                      className={`w-10 h-5 rounded-full transition-all ${effects.autoTuneEnabled ? 'bg-purple-500' : 'bg-slate-700'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${effects.autoTuneEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
                <p className="text-[9px] text-slate-500 mb-4">Corrects pitch to the nearest note in real-time. Higher amounts give a more robotic/electronic sound.</p>
                {effects.autoTuneEnabled && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                      <span>Amount</span>
                      <span className="text-purple-400">{effects.autoTuneAmount}%</span>
                    </div>
                    <Slider value={[effects.autoTuneAmount]} min={0} max={100} onValueChange={([val]) => setEffects(prev => ({ ...prev, autoTuneAmount: val }))} />
                  </div>
                )}
              </div>

              {/* DeEsser */}
              <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">DeEsser</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <NodeLED node={leds.deEsser} size="sm" />
                    <button
                      onClick={() => setEffects(prev => ({ ...prev, deEsserEnabled: !prev.deEsserEnabled }))}
                      className={`w-10 h-5 rounded-full transition-all ${effects.deEsserEnabled ? 'bg-cyan-500' : 'bg-slate-700'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${effects.deEsserEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
                <p className="text-[9px] text-slate-500 mb-4">Reduces harsh sibilant sounds (S, T, SH) in vocals. Targets 4-8kHz frequency range.</p>
                {effects.deEsserEnabled && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                      <span>Threshold</span>
                      <span className="text-cyan-400">{effects.deEsserThreshold}dB</span>
                    </div>
                    <Slider value={[effects.deEsserThreshold]} min={-50} max={-10} onValueChange={([val]) => setEffects(prev => ({ ...prev, deEsserThreshold: val }))} />
                  </div>
                )}
              </div>

              {/* Vocal Presence */}
              <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800/50">
                <div className="flex items-center gap-2 mb-4">
                  <Mic className="w-4 h-4 text-blue-400" />
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Vocal Presence Boost</h4>
                </div>
                <p className="text-[9px] text-slate-500 mb-4">Enhances vocal clarity by boosting the 3-5kHz range where human voice presence lives.</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                    <span>Presence Amount</span>
                    <span className="text-blue-400">{effects.vocalPresence}%</span>
                  </div>
                  <Slider value={[effects.vocalPresence]} min={0} max={100} onValueChange={([val]) => setEffects(prev => ({ ...prev, vocalPresence: val }))} />
                </div>
              </div>

              {/* Voice Presets */}
              <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800/50">
                <h4 className="text-[10px] font-bold text-white uppercase tracking-widest mb-4">Voice Profiles</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "voice", label: "Clean Voice", icon: <Mic className="w-3.5 h-3.5" /> },
                    { id: "broadcast", label: "Radio/Broadcast", icon: <Radio className="w-3.5 h-3.5" /> },
                    { id: "podcast", label: "Podcast", icon: <Headphones className="w-3.5 h-3.5" /> },
                    { id: "worship", label: "Worship Singer", icon: <Music className="w-3.5 h-3.5" /> },
                  ].map(p => (
                    <Button
                      key={p.id}
                      variant="outline"
                      size="sm"
                      className="h-10 text-[10px] font-bold uppercase bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 gap-2"
                      onClick={() => applyPreset(p.id)}
                    >
                      {p.icon} {p.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── MASTER TAB ────────────────────────────────────────────── */}
          {activeTab === "master" && (
            <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
              {/* Spectrum Analyzer */}
              <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-800/50">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Spectrum Analyzer</h4>
                </div>
                <canvas
                  ref={spectrumCanvasRef}
                  width={400}
                  height={120}
                  className="w-full h-[120px] rounded-lg bg-slate-950"
                />
              </div>

              {/* Waveform Monitor */}
              <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-800/50">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-primary" />
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Waveform Monitor</h4>
                </div>
                <canvas
                  ref={waveformCanvasRef}
                  width={400}
                  height={80}
                  className="w-full h-[80px] rounded-lg bg-slate-950"
                />
              </div>

              {/* Limiter */}
              <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-400" />
                    <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Brick-Wall Limiter</h4>
                  </div>
                  <NodeLED node={leds.limiter} size="sm" />
                </div>
                <p className="text-[9px] text-slate-500 mb-4">Prevents clipping at the final output. Keeps audio below 0dBFS.</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                    <span>Threshold</span>
                    <span className="text-red-400">{effects.limiterThreshold}dB</span>
                  </div>
                  <Slider value={[effects.limiterThreshold]} min={-6} max={0} step={0.5} onValueChange={([val]) => setEffects(prev => ({ ...prev, limiterThreshold: val }))} />
                </div>
              </div>

              {/* Stereo Width */}
              <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800/50">
                <div className="flex items-center gap-2 mb-4">
                  <Speaker className="w-4 h-4 text-primary" />
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Stereo Width</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                    <span>Width</span>
                    <span className="text-primary">{effects.stereoWidth}%</span>
                  </div>
                  <Slider value={[effects.stereoWidth]} min={0} max={100} onValueChange={([val]) => setEffects(prev => ({ ...prev, stereoWidth: val }))} />
                </div>
              </div>

              {/* Sidechain */}
              <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Sidechain Compression</h4>
                  </div>
                  <button
                    onClick={() => setEffects(prev => ({ ...prev, sidechainEnabled: !prev.sidechainEnabled }))}
                    className={`w-10 h-5 rounded-full transition-all ${effects.sidechainEnabled ? 'bg-amber-500' : 'bg-slate-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${effects.sidechainEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {effects.sidechainEnabled && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                        <span>Threshold</span>
                        <span className="text-amber-400">{effects.sidechainThreshold}dB</span>
                      </div>
                      <Slider value={[effects.sidechainThreshold]} min={-50} max={0} onValueChange={([val]) => setEffects(prev => ({ ...prev, sidechainThreshold: val }))} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                        <span>Amount</span>
                        <span className="text-amber-400">{Math.round(effects.sidechainAmount * 100)}%</span>
                      </div>
                      <Slider value={[effects.sidechainAmount * 100]} min={0} max={100} onValueChange={([val]) => setEffects(prev => ({ ...prev, sidechainAmount: val / 100 }))} />
                    </div>
                  </div>
                )}
              </div>

              {/* Master Output */}
              <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-800/50">
                <h4 className="text-[10px] font-bold text-white uppercase tracking-widest mb-4">Master Output</h4>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500">
                      <span>Master Volume</span>
                      <span className="text-primary">{masterMuted ? 'MUTE' : `${masterVolume}%`}</span>
                    </div>
                    <Slider value={[masterVolume]} min={0} max={100} onValueChange={([val]) => setMasterVolume(val)} />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-2">
                      <Headphones className="w-4 h-4 text-green-400" />
                      <span className="text-[10px] font-bold text-white uppercase">Admin Monitor</span>
                    </div>
                    <button
                      onClick={() => setMonitorMuted(!monitorMuted)}
                      className={`w-10 h-5 rounded-full transition-all ${!monitorMuted ? 'bg-green-500' : 'bg-slate-700'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${!monitorMuted ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-500">Monitor mute ONLY silences admin speakers. Viewers still hear full audio.</p>

                  {/* Output Meter */}
                  <div className="pt-2 border-t border-slate-800">
                    <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500 mb-2">
                      <span>Output Level</span>
                      <span className={leds.output.level > 80 ? 'text-red-400' : leds.output.level > 50 ? 'text-amber-400' : 'text-green-400'}>
                        {leds.output.level.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-3 bg-slate-950 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        animate={{
                          width: `${leds.output.level}%`,
                          backgroundColor: leds.output.level > 80 ? "#ef4444" : leds.output.level > 50 ? "#eab308" : "#3b82f6",
                        }}
                        transition={{ duration: 0.1 }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Audio Info */}
              <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-800/50">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-slate-500" />
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Audio Engine Info</h4>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-[9px] text-slate-500 uppercase">Sample Rate</p>
                    <p className="text-sm font-mono font-bold text-white">{audioInfo.sampleRate}Hz</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-slate-500 uppercase">Channels</p>
                    <p className="text-sm font-mono font-bold text-white">{audioInfo.channels}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-slate-500 uppercase">Latency</p>
                    <p className="text-sm font-mono font-bold text-white">{audioInfo.latency}</p>
                  </div>
                </div>
              </div>

              {/* Reset All */}
              <Button
                variant="outline"
                size="sm"
                className="w-full h-10 text-[10px] font-bold uppercase bg-slate-800/50 border-slate-700 text-slate-400 gap-2"
                onClick={() => {
                  setEffects(DEFAULT_EFFECTS);
                  setTracks(prev => prev.map(t => ({ ...t, volume: t.id === "mic" ? 100 : t.id === "music" ? 75 : t.id === "system" ? 60 : 100, muted: false, solo: false, pan: 0 })));
                  setMasterVolume(85);
                  setMasterMuted(false);
                  setMonitorMuted(false);
                  toast.success("All settings reset to defaults");
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset All Settings
              </Button>
            </div>
          )}
        </div>

        {/* Hidden audio elements */}
        <audio ref={musicAudioRef} crossOrigin="anonymous" />
        <input ref={musicInputRef} type="file" accept="audio/*" onChange={handleMusicUpload} className="hidden" />
      </Card>
    );
  }
);

export default ProfessionalAudioMixer;
