import { useState, useEffect, useRef } from 'react';
import { Volume2, Mic, MicOff, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';

interface AudioTrack {
  id: string;
  name: string;
  volume: number;
  muted: boolean;
  level: number; // 0-100 for visual meter
  source?: MediaStreamAudioSourceNode;
}

interface AudioMixerEnhancedProps {
  mediaStream?: MediaStream | null;
  onVolumeChange?: (trackId: string, volume: number) => void;
  onMuteChange?: (trackId: string, muted: boolean) => void;
}

export default function AudioMixerEnhanced({ mediaStream, onVolumeChange, onMuteChange }: AudioMixerEnhancedProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const dataArrayRef = useRef<Uint8Array | null>(null) as any;
  
  const [tracks, setTracks] = useState<AudioTrack[]>([
    { id: 'mic', name: 'Microphone', volume: 80, muted: false, level: 65 },
    { id: 'music', name: 'Background Music', volume: 40, muted: false, level: 35 },
    { id: 'system', name: 'System Audio', volume: 60, muted: false, level: 50 },
  ]);

  const [masterVolume, setMasterVolume] = useState(85);
  const [masterMuted, setMasterMuted] = useState(false);
  const [audioStats, setAudioStats] = useState({
    sampleRate: 48000,
    bitrate: 128,
    channels: 2,
    latency: 'Low',
  });

  // Initialize Web Audio API
  useEffect(() => {
    if (!mediaStream) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;

    // Create analyser for level metering
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;
    dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

    // Create source from media stream
    const source = audioContext.createMediaStreamSource(mediaStream);
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    // Update audio stats
    setAudioStats({
      sampleRate: audioContext.sampleRate,
      bitrate: 128,
      channels: mediaStream.getAudioTracks()[0]?.getSettings().channelCount || 2,
      latency: 'Low',
    });

    // Start level metering animation loop
    const updateLevels = () => {
      if (!analyserRef.current || !dataArrayRef.current) return;
      
      if (dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        const data = Array.from(dataArrayRef.current as any) as number[];
        const average = data.reduce((a, b) => a + b, 0) / data.length;
        const level = Math.min(100, (average / 255) * 100);

        setTracks(prev => prev.map(track => ({
          ...track,
          level: track.id === 'mic' ? level : track.level,
        })));
      }

      requestAnimationFrame(updateLevels);
    };

    updateLevels();

    return () => {
      source.disconnect();
      analyser.disconnect();
      audioContext.close();
    };
  }, [mediaStream]);

  const updateTrack = (id: string, updates: Partial<AudioTrack>) => {
    setTracks(tracks.map(track =>
      track.id === id ? { ...track, ...updates } : track
    ));

    const updatedTrack = tracks.find(t => t.id === id);
    if (updatedTrack) {
      if ('volume' in updates && onVolumeChange) {
        onVolumeChange(id, updates.volume || 0);
      }
      if ('muted' in updates && onMuteChange) {
        onMuteChange(id, updates.muted || false);
      }
    }
  };

  const toggleTrackMute = (id: string) => {
    const track = tracks.find(t => t.id === id);
    updateTrack(id, { muted: !track?.muted });
  };

  const handleMasterVolumeChange = (value: number) => {
    setMasterVolume(value);
    if (audioContextRef.current) {
      // Apply master volume to all tracks
      gainNodesRef.current.forEach(gainNode => {
        gainNode.gain.value = value / 100;
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Master Volume Control */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-900/20 to-slate-900/20 rounded-xl p-6 border border-purple-500/20"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Volume2 className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-white">Master Volume</h3>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-purple-300">{masterVolume}%</div>
            <p className="text-xs text-gray-400">Overall Level</p>
          </div>
        </div>

        <div className="space-y-4">
          <Slider
            value={[masterVolume]}
            onValueChange={(value) => handleMasterVolumeChange(value[0])}
            max={100}
            step={1}
            className="w-full"
          />

          {/* Master Level Meter */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                animate={{ width: `${masterVolume}%` }}
                className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
              />
            </div>
            <Button
              size="sm"
              variant={masterMuted ? 'destructive' : 'outline'}
              onClick={() => setMasterMuted(!masterMuted)}
              className="gap-2"
            >
              {masterMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Individual Track Controls */}
      <div className="space-y-3">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-purple-400" />
          Audio Tracks
        </h3>

        {tracks.map((track, index) => (
          <motion.div
            key={track.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gradient-to-br from-slate-900/40 to-slate-900/20 rounded-lg p-4 border border-purple-500/10 hover:border-purple-500/30 transition"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 flex-1">
                <Button
                  size="sm"
                  variant={track.muted ? 'destructive' : 'outline'}
                  onClick={() => toggleTrackMute(track.id)}
                  className="gap-2"
                >
                  {track.muted ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </Button>
                <div className="flex-1">
                  <p className="font-semibold text-white text-sm">{track.name}</p>
                  <p className="text-xs text-gray-400">{track.volume}%</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-purple-300">{track.volume}%</div>
              </div>
            </div>

            {/* Volume Slider */}
            <Slider
              value={[track.volume]}
              onValueChange={(value) => updateTrack(track.id, { volume: value[0] })}
              max={100}
              step={1}
              disabled={track.muted}
              className="mb-3"
            />

            {/* Level Meter - Real-time from audio analysis */}
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                animate={{ width: `${track.muted ? 0 : track.level}%` }}
                className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                transition={{ duration: 0.2 }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Audio Settings */}
      <Card className="bg-gradient-to-br from-purple-900/20 to-slate-900/20 border-purple-500/20 p-4">
        <h4 className="font-semibold text-white mb-3 text-sm">Audio Settings</h4>
        <div className="space-y-2 text-sm text-gray-300">
          <div className="flex justify-between">
            <span>Sample Rate:</span>
            <span className="text-purple-300 font-semibold">{audioStats.sampleRate / 1000} kHz</span>
          </div>
          <div className="flex justify-between">
            <span>Bitrate:</span>
            <span className="text-purple-300 font-semibold">{audioStats.bitrate} kbps</span>
          </div>
          <div className="flex justify-between">
            <span>Channels:</span>
            <span className="text-purple-300 font-semibold">{audioStats.channels === 1 ? 'Mono' : 'Stereo'}</span>
          </div>
          <div className="flex justify-between">
            <span>Latency:</span>
            <span className="text-purple-300 font-semibold">{audioStats.latency}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
