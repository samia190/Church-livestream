import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Radio, Users, Clock, Share2, Heart, MessageCircle, Play, Volume2, VolumeX, Send, Info, Film, MonitorPlay, AlertCircle } from 'lucide-react';
import { Link } from 'wouter';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { useViewer } from '@/hooks/useViewer';
import { toast } from 'sonner';

export default function WatchLive() {
  const { remoteStream, meta, chatMessages, sendChatMessage, connectionState } = useViewer();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput, "Viewer");
    setChatInput("");
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const isLive = meta.isLive;
  const broadcastMode = meta.broadcastMode;
  const streamTitle = meta.title || 'Sunday Morning Worship';
  const streamDescription = meta.description || 'Join us for our main worship service';

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    } catch {
      toast.info(window.location.href);
    }
  };

  // Determine what badge to show
  const getModeBadge = () => {
    switch (broadcastMode) {
      case 'live':
        return (
          <motion.div
            key="live-badge"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex items-center gap-2 bg-red-600 px-4 py-2 rounded-full shadow-lg"
          >
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-white font-bold text-xs tracking-wider uppercase">Live Now</span>
          </motion.div>
        );
      case 'pre-stream':
        return (
          <motion.div
            key="prestream-badge"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex items-center gap-2 bg-amber-600 px-4 py-2 rounded-full shadow-lg"
          >
            <MonitorPlay className="w-3 h-3 text-white" />
            <span className="text-white font-bold text-xs tracking-wider uppercase">Showing Media</span>
          </motion.div>
        );
      case 'offline':
      default:
        return (
          <motion.div
            key="offline-badge"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex items-center gap-2 bg-gray-600 px-4 py-2 rounded-full shadow-lg"
          >
            <div className="w-2 h-2 bg-white rounded-full" />
            <span className="text-white font-bold text-xs tracking-wider uppercase">Offline</span>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen text-foreground bg-void">
      <Navigation />

      {/* Live Stream Section */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
        }}
        className="max-w-7xl mx-auto px-4 pt-24 pb-12"
      >
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }} className="mb-8">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-primary/20 shadow-2xl group">
            {/* Stream Video Player */}
            {(isLive || broadcastMode === 'pre-stream') && remoteStream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={muted}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-void to-void flex flex-col items-center justify-center orbit-grid">
                <Play className="w-24 h-24 text-primary/60 mb-4 animate-pulse" />
                <p className="text-foreground text-xl font-semibold mb-2">
                  {broadcastMode === 'pre-stream' ? 'Connecting to pre-stream...' : 'No Live Stream Right Now'}
                </p>
                <p className="text-muted-foreground text-center px-4">
                  {broadcastMode === 'pre-stream'
                    ? 'Media is being prepared — you\'ll see it shortly'
                    : 'Check back during a scheduled service, or watch a recent sermon below'}
                </p>
              </div>
            )}

            {/* Professional Overlays */}
            {(isLive || broadcastMode === 'pre-stream') && (
              <>
                {/* Church Logo at Top Left */}
                <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl p-2 border border-white/20 shadow-lg">
                    <img src="/logo/logo.png" alt="Church Logo" className="w-full h-full object-contain" />
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-white font-bold text-sm drop-shadow-md">N.I.C.A. KIBUGU</p>
                    <p className="text-white/70 text-[10px] uppercase tracking-widest drop-shadow-sm">Official Stream</p>
                  </div>
                </div>

                {/* Mode Indicator at Top Right */}
                <div className="absolute top-6 right-6 z-20 flex flex-col items-end gap-2">
                  <AnimatePresence mode="wait">
                    {getModeBadge()}
                  </AnimatePresence>
                  
                  <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-md border border-white/10 flex items-center gap-2">
                    <Users className="w-3 h-3 text-ember" />
                    <span className="text-white text-[10px] font-mono">{meta.viewers.toLocaleString()} Watching</span>
                  </div>
                </div>

                {/* Moving Ticker at Bottom */}
                <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent pt-12 pb-4 px-6">
                  <div className="relative overflow-hidden h-6 flex items-center">
                    <motion.div
                      animate={{ x: ["100%", "-100%"] }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      className="whitespace-nowrap flex items-center gap-12"
                    >
                      <span className="text-white/90 text-sm font-medium flex items-center gap-2">
                        <Info className="w-4 h-4 text-ember" />
                        Welcome to N.I.C.A. Kibugu Online Service
                      </span>
                      <span className="text-white/90 text-sm font-medium">
                        Current Session: {streamTitle}
                      </span>
                      <span className="text-white/90 text-sm font-medium">
                        Follow us on social media for more updates
                      </span>
                      <span className="text-white/90 text-sm font-medium">
                        God bless you as you join us today!
                      </span>
                    </motion.div>
                  </div>
                </div>

                {/* Mute toggle */}
                <button
                  onClick={() => setMuted(m => !m)}
                  className="absolute bottom-16 right-6 z-30 bg-black/40 backdrop-blur-md p-3 rounded-full hover:bg-black/60 transition-colors border border-white/10"
                  aria-label={muted ? 'Unmute' : 'Mute'}
                >
                  {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
                </button>
              </>
            )}
          </div>
        </motion.div>

        {/* Stream Info & Chat */}
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }} className="grid lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2">
            <div className="glass-panel p-8 mb-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
              <h2 className="text-3xl font-bold mb-4 text-foreground drop-shadow-sm">{streamTitle}</h2>
              <p className="text-muted-foreground mb-8 text-lg leading-relaxed">{streamDescription}</p>

              <div className="flex flex-wrap gap-4">
                <Button className="bg-ember hover:bg-ember/90 text-ember-foreground gap-2 px-6 py-6 h-auto text-lg font-bold shadow-lg shadow-ember/20">
                  <Heart className="w-5 h-5" />
                  Like
                </Button>
                <Button variant="outline" className="border-primary/50 hover:bg-primary/10 gap-2 px-6 py-6 h-auto text-lg font-semibold" onClick={handleShare}>
                  <Share2 className="w-5 h-5" />
                  Share
                </Button>
                <Link href="/prayer">
                  <Button variant="outline" className="border-primary/50 hover:bg-primary/10 gap-2 px-6 py-6 h-auto text-lg font-semibold">
                    <MessageCircle className="w-5 h-5" />
                    Prayer Request
                  </Button>
                </Link>
              </div>
            </div>

            {/* Stream Stats (Mobile/Tablet) */}
            <div className="lg:hidden grid grid-cols-2 gap-4 mb-8">
               <div className="glass-panel p-4 flex flex-col items-center justify-center text-center">
                 <p className="text-xs text-muted-foreground mb-1 font-mono uppercase tracking-wider">Status</p>
                 <p className={`text-xl font-black ${isLive ? 'text-signal' : broadcastMode === 'pre-stream' ? 'text-amber-500' : 'text-muted-foreground'}`}>
                   {broadcastMode === 'pre-stream' ? 'MEDIA' : broadcastMode.toUpperCase()}
                 </p>
               </div>
               <div className="glass-panel p-4 flex flex-col items-center justify-center text-center">
                 <p className="text-xs text-muted-foreground mb-1 font-mono uppercase tracking-wider">Viewers</p>
                 <p className="text-xl font-black text-ember">{meta.viewers.toLocaleString()}</p>
               </div>
            </div>
          </div>

          {/* Sidebar: Chat & Stats */}
          <div className="space-y-6">
            {/* Live Chat */}
            <div className="glass-panel flex flex-col h-[500px] border-primary/20">
              <div className="p-4 border-b border-primary/20 flex items-center justify-between bg-primary/5">
                <h3 className="font-bold flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-ember" />
                  Live Chat
                </h3>
                <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                  <div className={`w-2 h-2 rounded-full ${connectionState === 'connected' ? 'bg-signal' : 'bg-red-500'}`} />
                  {connectionState === 'connected' ? 'Connected' : 'Connecting...'}
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-primary/20">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                    <MessageCircle className="w-12 h-12 mb-2" />
                    <p className="text-sm">Welcome to the live chat!</p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xs font-bold ${msg.role === 'admin' ? 'text-ember' : 'text-primary'}`}>
                          {msg.user}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm bg-primary/5 p-2 rounded-lg border border-primary/10">
                        {msg.message}
                      </p>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 border-t border-primary/20 bg-primary/5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                    placeholder="Say something..."
                    className="flex-1 bg-void border border-primary/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                  />
                  <Button size="sm" onClick={handleSendChat} className="bg-primary hover:bg-primary/90">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Desktop Stats */}
            <div className="hidden lg:block glass-panel p-6 border-primary/20">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Radio className="w-4 h-4 text-ember" />
                Stream Stats
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg border border-primary/10">
                  <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Status</span>
                  <span className={`text-sm font-black ${
                    broadcastMode === 'live' ? 'text-signal' : 
                    broadcastMode === 'pre-stream' ? 'text-amber-500' : 'text-muted-foreground'
                  }`}>
                    {broadcastMode === 'pre-stream' ? 'MEDIA' : broadcastMode.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg border border-primary/10">
                  <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Viewers</span>
                  <span className="text-sm font-black text-ember">{meta.viewers.toLocaleString()}</span>
                </div>
                {(isLive || broadcastMode === 'pre-stream') && meta.startTime > 0 && (
                   <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg border border-primary/10">
                    <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Uptime</span>
                    <span className="text-sm font-black text-primary font-mono">
                      {Math.floor((Date.now() - meta.startTime) / 60000)}m
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Upcoming Services */}
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }} className="mb-12">
          <p className="label-eyebrow mb-2">Save the Date</p>
          <h3 className="text-2xl font-bold mb-6">Upcoming Services</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                id: 1,
                title: 'Sunday Morning Worship',
                date: 'Sunday, June 23, 2026',
                time: '9:00 AM - 11:00 AM',
                description: 'Join us for our main worship service with praise, worship, and preaching.',
                thumbnail: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663779111251/22XNoSU8LuRfCuqftFgkdg/prayer-service-congregation-Q84LZ6m6F67AnXSBo3UuYP.webp',
              },
              {
                id: 2,
                title: 'Midweek Prayer Meeting',
                date: 'Wednesday, June 26, 2026',
                time: '7:00 PM - 8:30 PM',
                description: 'Evening prayer and intercession service for the church and community.',
                thumbnail: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663779111251/22XNoSU8LuRfCuqftFgkdg/prayer-service-congregation-Q84LZ6m6F67AnXSBo3UuYP.webp',
              },
              {
                id: 3,
                title: 'Youth Fellowship',
                date: 'Friday, June 28, 2026',
                time: '6:00 PM - 8:00 PM',
                description: 'Special youth gathering with worship, teaching, and fellowship.',
                thumbnail: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663779111251/22XNoSU8LuRfCuqftFgkdg/prayer-service-congregation-Q84LZ6m6F67AnXSBo3UuYP.webp',
              },
            ].map((service) => (
              <motion.div
                key={service.id}
                className="tilt-card glass-panel overflow-hidden cursor-pointer group"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <div className="aspect-video relative overflow-hidden">
                  <img src={service.thumbnail} alt={service.title} loading="lazy" className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 flex items-center justify-center bg-void/30 group-hover:bg-void/10 transition-colors">
                    <Play className="w-12 h-12 text-white/50 group-hover:text-white transition-colors" />
                  </div>
                </div>
                <div className="p-6">
                  <h4 className="font-bold text-xl mb-2 group-hover:text-primary transition-colors">{service.title}</h4>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
                    <Clock className="w-4 h-4" />
                    {service.date} • {service.time}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{service.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.section>
    </div>
  );
}
