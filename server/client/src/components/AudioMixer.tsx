import { useState } from 'react';
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
}

export default function AudioMixer() {
  const [tracks, setTracks] = useState<AudioTrack[]>([
    { id: 'mic', name: 'Microphone', volume: 80, muted: false, level: 65 },
    { id: 'music', name: 'Background Music', volume: 40, muted: false, level: 35 },
    { id: 'system', name: 'System Audio', volume: 60, muted: false, level: 50 },
  ]);

  const [masterVolume, setMasterVolume] = useState(85);
  const [masterMuted, setMasterMuted] = useState(false);

  const updateTrack = (id: string, updates: Partial<AudioTrack>) => {
    setTracks(tracks.map(track =>
      track.id === id ? { ...track, ...updates } : track
    ));
  };

  const toggleTrackMute = (id: string) => {
    updateTrack(id, { muted: !tracks.find(t => t.id === id)?.muted });
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
            onValueChange={(value) => setMasterVolume(value[0])}
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

            {/* Level Meter */}
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
            <span className="text-purple-300 font-semibold">48 kHz</span>
          </div>
          <div className="flex justify-between">
            <span>Bitrate:</span>
            <span className="text-purple-300 font-semibold">128 kbps</span>
          </div>
          <div className="flex justify-between">
            <span>Channels:</span>
            <span className="text-purple-300 font-semibold">Stereo</span>
          </div>
          <div className="flex justify-between">
            <span>Latency:</span>
            <span className="text-purple-300 font-semibold">Low</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
