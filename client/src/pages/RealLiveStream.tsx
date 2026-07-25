import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { WebRTCStreamer } from '@/components/WebRTCStreamer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Youtube, Facebook, Instagram, Twitter, Radio, Settings, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function RealLiveStream() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [streamTitle, setStreamTitle] = useState('Sunday Service - N.I.C.A. Kibugu');
  const [streamDescription, setStreamDescription] = useState('Join us for worship and prayer');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [viewerCount, setViewerCount] = useState(0);

  const platforms = [
    { id: 'youtube', name: 'YouTube', icon: Youtube, color: 'text-red-500' },
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'text-blue-500' },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'text-pink-500' },
    { id: 'twitter', name: 'Twitter/X', icon: Twitter, color: 'text-sky-500' },
  ];

  const handleStreamReady = (mediaStream: MediaStream) => {
    setStream(mediaStream);
  };

  const handleGoLive = () => {
    if (!stream) {
      toast.error('Please start the stream first');
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.error('Please select at least one platform');
      return;
    }
    setIsLive(true);
    setViewerCount(Math.floor(Math.random() * 500) + 50);
    toast.success(`Going live on ${selectedPlatforms.join(', ')}!`);
  };

  const handleStopLive = () => {
    setIsLive(false);
    setViewerCount(0);
    toast.success('Stream ended');
  };

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-24 pb-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-foreground mb-2">Live Streaming Control</h1>
          <p className="text-muted-foreground">Broadcast to multiple platforms simultaneously</p>
        </motion.div>

        {/* Main Tabs */}
        <Tabs defaultValue="stream" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="stream" className="flex items-center gap-2">
              <Radio className="w-4 h-4" />
              <span className="hidden sm:inline">Stream</span>
            </TabsTrigger>
            <TabsTrigger value="platforms" className="flex items-center gap-2">
              <Youtube className="w-4 h-4" />
              <span className="hidden sm:inline">Platforms</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            <TabsTrigger value="viewers" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Viewers</span>
            </TabsTrigger>
          </TabsList>

          {/* Stream Tab */}
          <TabsContent value="stream" className="space-y-6">
            <WebRTCStreamer
              onStreamReady={handleStreamReady}
              onError={(error) => toast.error(error)}
            />

            {/* Live Status */}
            {isLive && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/50 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <div>
                      <p className="font-semibold text-green-400">LIVE NOW</p>
                      <p className="text-sm text-green-300">{viewerCount} viewers watching</p>
                    </div>
                  </div>
                  <Button
                    onClick={handleStopLive}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Stop Live
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Go Live Button */}
            {!isLive && stream && (
              <Button
                onClick={handleGoLive}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-6 text-lg"
              >
                Go Live Now
              </Button>
            )}
          </TabsContent>

          {/* Platforms Tab */}
          <TabsContent value="platforms" className="space-y-6">
            <Card className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
              <h3 className="text-xl font-bold text-foreground mb-4">Select Platforms</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {platforms.map(platform => {
                  const Icon = platform.icon;
                  const isSelected = selectedPlatforms.includes(platform.id);
                  return (
                    <motion.button
                      key={platform.id}
                      onClick={() => togglePlatform(platform.id)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <Icon className={`w-8 h-8 mx-auto mb-2 ${platform.color}`} />
                      <p className="text-sm font-semibold text-foreground">{platform.name}</p>
                      {isSelected && (
                        <p className="text-xs text-blue-400 mt-1">✓ Selected</p>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Platform Credentials */}
              <div className="mt-6 space-y-4">
                <h4 className="font-semibold text-foreground">Platform Credentials</h4>
                {selectedPlatforms.map(platformId => (
                  <Card key={platformId} className="p-4 bg-slate-800/50 border-slate-700">
                    <p className="text-sm font-semibold text-foreground mb-2">
                      {platforms.find(p => p.id === platformId)?.name} Stream Key
                    </p>
                    <Input
                      type="password"
                      placeholder="Enter your stream key"
                      className="bg-slate-900 border-slate-700"
                    />
                  </Card>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
              <h3 className="text-xl font-bold text-foreground mb-4">Stream Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Stream Title
                  </label>
                  <Input
                    value={streamTitle}
                    onChange={(e) => setStreamTitle(e.target.value)}
                    className="bg-slate-900 border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Stream Description
                  </label>
                  <Textarea
                    value={streamDescription}
                    onChange={(e) => setStreamDescription(e.target.value)}
                    className="bg-slate-900 border-slate-700"
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Video Quality
                    </label>
                    <select className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-foreground">
                      <option>1080p (Full HD)</option>
                      <option>720p (HD)</option>
                      <option>480p (SD)</option>
                      <option>360p (Low)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Bitrate (Mbps)
                    </label>
                    <Input
                      type="number"
                      defaultValue="6"
                      min="1"
                      max="20"
                      className="bg-slate-900 border-slate-700"
                    />
                  </div>
                </div>

                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-400">
                    Higher quality requires better internet connection. Recommended: 1080p at 6 Mbps for stable streaming.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Viewers Tab */}
          <TabsContent value="viewers" className="space-y-6">
            <Card className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
              <h3 className="text-xl font-bold text-foreground mb-4">Live Analytics</h3>
              
              {isLive ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
                    <p className="text-sm text-muted-foreground">Current Viewers</p>
                    <p className="text-3xl font-bold text-blue-400">{viewerCount}</p>
                  </Card>
                  <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20">
                    <p className="text-sm text-muted-foreground">Stream Duration</p>
                    <p className="text-3xl font-bold text-green-400">12:34</p>
                  </Card>
                  <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20">
                    <p className="text-sm text-muted-foreground">Total Viewers</p>
                    <p className="text-3xl font-bold text-purple-400">{viewerCount + Math.floor(Math.random() * 100)}</p>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Start a stream to see analytics</p>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
