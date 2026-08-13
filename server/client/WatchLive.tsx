import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Radio, Users, Clock, Share2, Heart, MessageCircle, Play, Volume2, VolumeX, Send, Info, Film, MonitorPlay, AlertCircle, Shield, Zap, ExternalLink } from 'lucide-react';
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
  const [showStats, setShowStats] = useState(false);

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
            initial={{ opacity: 0, x: 20, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.8 }}
            className="flex items-center gap-2 bg-red-600/90 backdrop-blur-md px-4 py-2 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)] border border-red-400/30"
          >
            <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_8px_#fff]" />
            <span className="text-white font-black text-[10px] tracking-[0.2em] uppercase italic">LIVE NOW</span>
          </motion.div>
        );
      case 'pre-stream':
        return (
          <motion.div
            key="prestream-badge"
            initial={{ opacity: 0, x: 20, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.8 }}
            className="flex items-center gap-2 bg-amber-500/90 backdrop-blur-md px-4 py-2 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.5)] border border-amber-300/30"
          >
            <MonitorPlay className="w-3.5 h-3.5 text-white animate-bounce" />
            <span className="text-white font-black text-[10px] tracking-[0.2em] uppercase italic">SHOWING MEDIA</span>
          </motion.div>
        );
      case 'offline':
      default:
        return (
          <motion.div
            key="offline-badge"
            initial={{ opacity: 0, x: 20, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.8 }}
            className="flex items-center gap-2 bg-slate-700/90 backdrop-blur-md px-4 py-2 rounded-full border border-slate-500/30"
          >
            <div className="w-2 h-2 bg-slate-400 rounded-full" />
            <span className="text-slate-300 font-black text-[10px] tracking-[0.2em] uppercase italic">OFFLINE</span>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen text-foreground bg-void selection:bg-primary selection:text-white">
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
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }} className="mb-10 group">
          <div className="relative rounded-3xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-all duration-500 hover:border-primary/20">
            {/* Stream Video Player */}
            {(isLive || broadcastMode === 'pre-stream') && remoteStream ? (
              <video
                key={remoteStream.id}
                ref={videoRef}
                autoPlay
                playsInline
                muted={muted}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.01]"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-void to-void flex flex-col items-center justify-center orbit-grid">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full animate-pulse" />
                  <Play className="w-24 h-24 text-primary/80 mb-6 relative z-10 animate-pulse" />
                </div>
                <p className="text-white text-2xl font-black mb-2 tracking-tight">
                  {broadcastMode === 'pre-stream' ? 'INITIALIZING MEDIA...' : 'OFFLINE'}
                </p>
                <p className="text-slate-400 text-center max-w-md px-6 text-sm font-medium leading-relaxed">
                  {broadcastMode === 'pre-stream'
                    ? 'The broadcast is being prepared. Please stay tuned as we start shortly.'
                    : 'We are not broadcasting right now. Join us during our scheduled services or explore our archive below.'}
                </p>
              </div>
            )}

            {/* Professional Broadcast Overlays */}
            {(isLive || broadcastMode === 'pre-stream') && (
              <>
                {/* Logo & Watermark */}
                <div className="absolute top-8 left-8 z-20 flex items-center gap-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    className="w-14 h-14 bg-white/10 backdrop-blur-xl rounded-2xl p-2.5 border border-white/20 shadow-2xl flex items-center justify-center overflow-hidden"
                  >
                    <img src="/logo/logo.png" alt="Logo" className="w-full h-full object-contain filter drop-shadow-lg" />
                  </motion.div>
                  <div className="hidden sm:block">
                    <h4 className="text-white font-black text-lg leading-none tracking-tighter drop-shadow-lg uppercase italic">N.I.C.A. KIBUGU</h4>
                    <p className="text-primary font-bold text-[9px] uppercase tracking-[0.3em] mt-1 drop-shadow-md">High Definition Stream</p>
                  </div>
                </div>

                {/* Status & Viewers Overlay */}
                <div className="absolute top-8 right-8 z-20 flex flex-col items-end gap-3">
                  <AnimatePresence mode="wait">
                    {getModeBadge()}
                  </AnimatePresence>
                  
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-black/40 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-3 shadow-xl"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-primary animate-pulse" />
                      <span className="text-white text-[11px] font-black tracking-wider">{meta.viewers.toLocaleString()}</span>
                    </div>
                    <div className="w-px h-3 bg-white/20" />
                    <button
                      onClick={() => setShowStats(!showStats)}
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      <Zap className={`w-3.5 h-3.5 ${showStats ? 'text-yellow-400' : ''}`} />
                    </button>
                  </motion.div>
                </div>

                {/* Professional Lower-Third */}
                <AnimatePresence>
                  {(isLive || broadcastMode === 'pre-stream') && (
                    <motion.div
                      initial={{ opacity: 0, x: -50 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="absolute bottom-20 left-8 z-20 max-w-[80%] pointer-events-none"
                    >
                      <div className="relative">
                        {/* The Accent Bar */}
                        <div className="absolute -left-2 top-0 bottom-0 w-1.5 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary),0.6)]" />
                        
                        <div className="bg-gradient-to-r from-black/80 via-black/40 to-transparent backdrop-blur-md px-6 py-4 rounded-r-3xl border-l-0 border border-white/10">
                          <motion.h3
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-white text-2xl font-black tracking-tight drop-shadow-2xl uppercase italic"
                          >
                            {streamTitle}
                          </motion.h3>
                          <motion.p
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-primary/90 text-xs font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-2"
                          >
                            <Shield className="w-3 h-3" />
                            Live from Nginda Parish
                          </motion.p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* News Ticker Bar */}
                <div className="absolute bottom-0 left-0 right-0 z-20 overflow-hidden h-12 bg-black/60 backdrop-blur-2xl border-t border-white/5 flex items-center">
                  <div className="bg-primary px-6 h-full flex items-center z-30 shadow-[10px_0_20px_rgba(0,0,0,0.3)]">
                    <span className="text-white font-black text-xs tracking-widest uppercase italic whitespace-nowrap">NEWS FEED</span>
                  </div>
                  <div className="relative flex-1 overflow-hidden h-full flex items-center">
                    <motion.div
                      animate={{ x: ["0%", "-100%"] }}
                      transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                      className="whitespace-nowrap flex items-center gap-24 pl-12"
                    >
                      {[
                        `WELCOME TO N.I.C.A. KIBUGU ONLINE • CURRENT SESSION: ${streamTitle.toUpperCase()}`,
                        "JOIN US EVERY SUNDAY FROM 9:00 AM FOR PRAISE AND WORSHIP",
                        "GOD BLESS YOU AS YOU WORSHIP WITH US TODAY FROM ACROSS THE GLOBE",
                        "SEND YOUR PRAYER REQUESTS VIA THE LINK BELOW • STAY BLESSED",
                        "FOLLOW US ON SOCIAL MEDIA FOR DAILY INSPIRATION AND UPDATES"
                      ].map((text, i) => (
                        <span key={i} className="text-white/80 text-[11px] font-bold tracking-[0.15em] uppercase italic flex items-center gap-4">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                          {text}
                        </span>
                      ))}
                    </motion.div>
                  </div>
                </div>

                {/* Control Overlays */}
                <div className="absolute bottom-16 right-8 z-30 flex items-center gap-3">
                   <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setMuted(m => !m)}
                    className="bg-black/40 backdrop-blur-xl p-3.5 rounded-2xl hover:bg-black/60 transition-all border border-white/10 text-white shadow-2xl"
                  >
                    {muted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-primary" />}
                  </motion.button>
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Info Column */}
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="lg:col-span-8 space-y-8">
            <div className="bg-slate-900/40 backdrop-blur-md rounded-[2rem] p-8 border border-white/5 relative overflow-hidden group">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-[100px] transition-all duration-700 group-hover:bg-primary/20" />
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1 bg-primary/20 text-primary text-[10px] font-black tracking-widest uppercase rounded-full border border-primary/20">Featured Session</span>
                    <span className="text-slate-500 text-[10px] font-bold tracking-widest uppercase">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <h2 className="text-4xl font-black text-white tracking-tight leading-tight italic uppercase">{streamTitle}</h2>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-white font-black text-xl leading-none italic">{meta.viewers.toLocaleString()}</p>
                    <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest mt-1">Live Viewers</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center border border-white/5">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </div>

              <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-3xl font-medium">
                {streamDescription}
              </p>

              <div className="flex flex-wrap gap-4">
                <Button className="bg-primary hover:bg-primary/90 text-white gap-3 px-8 py-7 h-auto text-lg font-black italic uppercase rounded-2xl shadow-[0_10px_20px_rgba(var(--primary),0.3)] transition-all hover:-translate-y-1 active:translate-y-0">
                  <Heart className="w-6 h-6 fill-current" />
                  Support Us
                </Button>
                <Button variant="outline" onClick={handleShare} className="bg-white/5 border-white/10 hover:bg-white/10 gap-3 px-8 py-7 h-auto text-lg font-black italic uppercase rounded-2xl transition-all hover:-translate-y-1">
                  <Share2 className="w-6 h-6" />
                  Share Live
                </Button>
                <Link href="/prayer">
                  <Button variant="ghost" className="text-slate-400 hover:text-white hover:bg-white/5 gap-3 px-8 py-7 h-auto text-lg font-black italic uppercase rounded-2xl">
                    <MessageCircle className="w-6 h-6" />
                    Prayer
                  </Button>
                </Link>
              </div>
            </div>

            {/* Upcoming Services Section */}
            <div>
              <div className="flex items-center justify-between mb-8 px-2">
                <div>
                  <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">Broadcast Schedule</h3>
                  <p className="text-slate-500 text-sm font-medium">Never miss a powerful moment of worship</p>
                </div>
                <Button variant="link" className="text-primary font-bold uppercase tracking-widest text-xs">View Full Calendar</Button>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  {
                    title: 'Sunday Morning',
                    time: '9:00 AM',
                    type: 'Main Service',
                    icon: <Zap className="w-5 h-5 text-amber-400" />
                  },
                  {
                    title: 'Midweek Prayer',
                    time: '7:00 PM',
                    type: 'Intercession',
                    icon: <Shield className="w-5 h-5 text-blue-400" />
                  },
                  {
                    title: 'Youth Night',
                    time: '6:00 PM',
                    type: 'Fellowship',
                    icon: <Heart className="w-5 h-5 text-red-400" />
                  }
                ].map((item, i) => (
                  <div key={i} className="bg-slate-900/40 p-6 rounded-3xl border border-white/5 hover:border-primary/30 transition-all group">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      {item.icon}
                    </div>
                    <p className="text-primary text-[10px] font-black uppercase tracking-widest mb-1">{item.type}</p>
                    <h4 className="text-white font-black text-lg italic uppercase mb-2">{item.title}</h4>
                    <p className="text-slate-500 text-xs font-bold flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      Every Week • {item.time}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Sidebar / Chat Column */}
          <motion.div variants={{ hidden: { opacity: 0, x: 20 }, visible: { opacity: 1, x: 0 } }} className="lg:col-span-4 space-y-6">
            {/* Live Chat Panel */}
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] flex flex-col h-[650px] border border-white/10 shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <MessageCircle className="w-6 h-6 text-primary" />
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900" />
                  </div>
                  <h3 className="font-black text-white italic uppercase tracking-tight">Community Chat</h3>
                </div>
                <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                  connectionState === 'connected' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {connectionState === 'connected' ? 'ONLINE' : 'OFFLINE'}
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-primary/20 transition-all">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6 opacity-30">
                    <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-6">
                      <MessageCircle className="w-10 h-10" />
                    </div>
                    <p className="text-sm font-bold uppercase tracking-widest">Start the conversation</p>
                    <p className="text-xs mt-2 font-medium">Welcome our brothers and sisters to the service!</p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      key={idx}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-black tracking-widest uppercase italic ${msg.role === 'admin' ? 'text-primary' : 'text-slate-400'}`}>
                          {msg.user}
                        </span>
                        <span className="text-[9px] text-slate-600 font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={`p-4 rounded-2xl border ${
                        msg.role === 'admin' ? 'bg-primary/10 border-primary/20 text-white' : 'bg-white/5 border-white/5 text-slate-300'
                      }`}>
                        <p className="text-sm font-medium leading-relaxed">{msg.message}</p>
                      </div>
                    </motion.div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-6 border-t border-white/5 bg-white/5">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                    placeholder="Type a message..."
                    className="w-full bg-slate-950/50 border border-white/10 rounded-2xl pl-5 pr-14 py-4 text-sm font-medium text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                  <Button
                    size="icon"
                    onClick={handleSendChat}
                    className="absolute right-2 bg-primary hover:bg-primary/90 text-white w-10 h-10 rounded-xl shadow-lg shadow-primary/20"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Quick Links / Resources */}
            <div className="bg-gradient-to-br from-primary/20 to-slate-900/40 p-8 rounded-[2.5rem] border border-primary/20 relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-xl font-black text-white italic uppercase tracking-tight mb-6">Resources</h3>
                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-between bg-white/5 border-white/10 text-white font-bold italic uppercase text-xs h-12 rounded-xl group">
                    Daily Scripture
                    <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-primary transition-colors" />
                  </Button>
                  <Button variant="outline" className="w-full justify-between bg-white/5 border-white/10 text-white font-bold italic uppercase text-xs h-12 rounded-xl group">
                    Church Newsletter
                    <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-primary transition-colors" />
                  </Button>
                  <Button variant="outline" className="w-full justify-between bg-white/5 border-white/10 text-white font-bold italic uppercase text-xs h-12 rounded-xl group">
                    Submit Testimony
                    <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-primary transition-colors" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      <style>{`
        .orbit-grid {
          background-image: radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0);
          background-size: 40px 40px;
        }
        .selection\\:bg-primary ::selection {
          background-color: rgb(var(--primary));
          color: white;
        }
        .scrollbar-thin::-webkit-scrollbar { width: 5px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: rgba(var(--primary), 0.2); }
        
        @keyframes shine {
          0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
          100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
        }
        
        .shine-effect::after {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 200%; height: 200%;
          background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
          animation: shine 3s infinite;
        }
        
        .glass-panel {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  );
}
