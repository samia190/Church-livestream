import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { Video, Camera, Radio, Settings, Play, Square } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";

export default function LiveStream() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [isLive, setIsLive] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState('main');

  // Redirect if not admin
  if (user && user.role !== 'admin') {
    setLocation('/');
    return null;
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  const cameras = [
    { id: 'main', name: 'Main Camera', status: 'online' },
    { id: 'side', name: 'Side Camera', status: 'online' },
    { id: 'phone', name: 'Phone Camera', status: 'offline' },
  ];

  const platforms = [
    { id: 'youtube', name: 'YouTube Live', icon: '▶️', connected: true },
    { id: 'facebook', name: 'Facebook Live', icon: 'f', connected: true },
    { id: 'instagram', name: 'Instagram Live', icon: '📷', connected: false },
    { id: 'tiktok', name: 'TikTok Live', icon: '♪', connected: true },
  ];

  return (
    <DashboardLayout>
      <motion.div
        className="space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Live Streaming Control</h1>
            <p className="text-muted-foreground mt-2">Manage cameras and broadcast to multiple platforms</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsLive(!isLive)}
            className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${
              isLive
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isLive ? (
              <>
                <Square className="w-4 h-4" />
                Stop Stream
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Go Live
              </>
            )}
          </motion.button>
        </motion.div>

        {/* Live Status */}
        {isLive && (
          <motion.div
            variants={itemVariants}
            className="bg-gradient-to-r from-red-600/20 to-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-center gap-3"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-3 h-3 bg-red-600 rounded-full"
            />
            <div>
              <p className="text-red-400 font-semibold">🔴 LIVE NOW</p>
              <p className="text-sm text-red-300">Streaming to 4 platforms • 1,234 viewers</p>
            </div>
          </motion.div>
        )}

        {/* Main Video Preview */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 bg-black border-primary/20">
            <div className="aspect-video bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg flex items-center justify-center border border-primary/30">
              <div className="text-center">
                <Video className="w-16 h-16 text-primary/50 mx-auto mb-4" />
                <p className="text-muted-foreground">Video Preview</p>
                <p className="text-sm text-muted-foreground mt-1">Camera: {selectedCamera}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Tabs */}
        <motion.div variants={itemVariants}>
          <Tabs defaultValue="cameras" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="cameras">Cameras</TabsTrigger>
              <TabsTrigger value="platforms">Platforms</TabsTrigger>
              <TabsTrigger value="chat">Live Chat</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* Cameras Tab */}
            <TabsContent value="cameras" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cameras.map((camera) => (
                  <motion.div
                    key={camera.id}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setSelectedCamera(camera.id)}
                  >
                    <Card
                      className={`p-4 cursor-pointer transition-all ${
                        selectedCamera === camera.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Camera className="w-5 h-5 text-primary" />
                          <div>
                            <p className="font-semibold text-foreground">{camera.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {camera.status === 'online' ? '🟢 Online' : '🔴 Offline'}
                            </p>
                          </div>
                        </div>
                        {selectedCamera === camera.id && (
                          <div className="w-3 h-3 bg-primary rounded-full" />
                        )}
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
              <Button className="w-full bg-primary hover:bg-primary/90">
                <Camera className="w-4 h-4 mr-2" />
                Add New Camera
              </Button>
            </TabsContent>

            {/* Platforms Tab */}
            <TabsContent value="platforms" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {platforms.map((platform) => (
                  <Card key={platform.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{platform.icon}</span>
                        <div>
                          <p className="font-semibold text-foreground">{platform.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {platform.connected ? '✅ Connected' : '❌ Not Connected'}
                          </p>
                        </div>
                      </div>
                      {platform.connected && isLive && (
                        <motion.div
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="w-3 h-3 bg-green-500 rounded-full"
                        />
                      )}
                    </div>
                  </Card>
                ))}
              </div>
              <Button className="w-full bg-primary hover:bg-primary/90">
                <Radio className="w-4 h-4 mr-2" />
                Connect New Platform
              </Button>
            </TabsContent>

            {/* Live Chat Tab */}
            <TabsContent value="chat" className="space-y-4 mt-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Live Chat</h3>
                <div className="bg-background rounded-lg p-4 h-64 overflow-y-auto mb-4 border border-border">
                  <div className="space-y-3">
                    <div className="text-sm">
                      <p className="font-semibold text-primary">John Doe</p>
                      <p className="text-muted-foreground">Praise God! Wonderful service 🙏</p>
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold text-primary">Jane Smith</p>
                      <p className="text-muted-foreground">Amen! God bless N.I.C.A. ✨</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-foreground"
                    disabled={!isLive}
                  />
                  <Button disabled={!isLive}>Send</Button>
                </div>
              </Card>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4 mt-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Stream Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Stream Title</label>
                    <input
                      type="text"
                      defaultValue="Sunday Service - N.I.C.A. Kibugu"
                      className="w-full mt-2 px-3 py-2 bg-background border border-border rounded-md text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Stream Description</label>
                    <textarea
                      defaultValue="Join us for our Sunday worship service at N.I.C.A. Kibugu, Nginda Parish"
                      className="w-full mt-2 px-3 py-2 bg-background border border-border rounded-md text-foreground h-24"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Video Quality</label>
                    <select className="w-full mt-2 px-3 py-2 bg-background border border-border rounded-md text-foreground">
                      <option>1080p 60fps</option>
                      <option>1080p 30fps</option>
                      <option>720p 60fps</option>
                      <option>720p 30fps</option>
                    </select>
                  </div>
                  <Button className="w-full bg-primary hover:bg-primary/90">
                    <Settings className="w-4 h-4 mr-2" />
                    Save Settings
                  </Button>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
