import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Radio, Users, Clock, Share2, Heart, MessageCircle, Play, Volume2, VolumeX, Send, Info, Film, MonitorPlay, AlertCircle, Shield, Zap, ExternalLink, RefreshCw } from 'lucide-react';
import { Link } from 'wouter';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { useViewer } from '@/hooks/useViewer';
import { useLiveKitViewer } from '@/hooks/useLiveKit';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import MobileOptimizedVideo from '@/components/MobileOptimizedVideo';

export default function WatchLive() {
  const liveKitUrlConfigured = Boolean(import.meta.env.VITE_LIVEKIT_URL);
  const viewerIdentityRef = useRef(crypto.randomUUID());
  const liveKitViewer = useLiveKitViewer();
  const liveKitStatus = trpc.streaming.liveKitStatus.useQuery(undefined, { enabled: liveKitUrlConfigured, retry: false });
  const liveKitConfigured = liveKitUrlConfigured && liveKitStatus.data?.enabled === true;
  const liveKitPending = liveKitUrlConfigured && liveKitStatus.isLoading;
  const legacyViewer = useViewer({ enabled: !liveKitUrlConfigured || (!liveKitPending && !liveKitConfigured) });
  const liveKitToken = trpc.streaming.liveKitViewerToken.useQuery({ identity: viewerIdentityRef.current }, { enabled: liveKitConfigured, retry: false, refetchInterval: 120_000 });
  const liveKitData = liveKitToken.data;
  const liveKitAccess = liveKitData?.enabled === true && liveKitData.isLive === true ? liveKitData : null;
  const liveKitActive = liveKitConfigured && Boolean(liveKitAccess);

  useEffect(() => {
    if (!liveKitConfigured) return;
    if (!liveKitActive || !liveKitAccess?.serverUrl || !liveKitAccess.token) {
      liveKitViewer.disconnect();
      return;
    }
    void liveKitViewer.connect(liveKitAccess.serverUrl, liveKitAccess.token).catch(() => undefined);
    return () => liveKitViewer.disconnect();
  }, [liveKitConfigured, liveKitActive, liveKitAccess?.serverUrl, liveKitAccess?.token, liveKitViewer.connect, liveKitViewer.disconnect]);

  const remoteStream = liveKitActive ? liveKitViewer.remoteStream : legacyViewer.remoteStream;
  const meta = liveKitActive ? {
    ...legacyViewer.meta,
    sessionId: liveKitAccess?.roomName ?? null,
    isLive: liveKitViewer.isLive,
    title: liveKitAccess?.title ?? legacyViewer.meta.title,
    description: liveKitAccess?.description ?? legacyViewer.meta.description,
    viewers: liveKitViewer.viewerCount,
    broadcastMode: "live" as const,
    startTime: legacyViewer.meta.startTime || Date.now(),
  } : legacyViewer.meta;
  const chatMessages = liveKitActive ? liveKitViewer.chatMessages : legacyViewer.chatMessages;
  const sendChatMessage = liveKitActive ? liveKitViewer.sendChatMessage : legacyViewer.sendChatMessage;
  const connectionState = liveKitUrlConfigured ? (liveKitPending || liveKitToken.isLoading ? "connecting" : liveKitViewer.connected ? "connected" : "disconnected") : legacyViewer.connectionState;
  const reconnect = liveKitAccess?.serverUrl && liveKitAccess.token ? () => { void liveKitViewer.connect(liveKitAccess.serverUrl, liveKitAccess.token); } : legacyViewer.reconnect;
  const networkInfo = legacyViewer.networkInfo;
  const [muted, setMuted] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [showStats, setShowStats] = useState(false);
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput, "Viewer");
    setChatInput("");
  };

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

  const getModeBadge = () => {
    switch (broadcastMode) {
      case 'live':
        return (
          <motion.div
            key="live-badge"
            initial={{ opacity: 0, x: 20, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.8 }}
            className="flex items-center gap-1.5 sm:gap-2 bg-red-600/90 backdrop-blur-md px-2.5 py-1 sm:px-4 sm:py-2 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)] border border-red-400/30"
          >
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse shadow-[0_0_8px_#fff]" />
            <span className="text-white font-black text-[8px] sm:text-[10px] tracking-[0.2em] uppercase italic">LIVE NOW</span>
          </motion.div>
        );
      case 'pre-stream':
        return (
          <motion.div
            key="prestream-badge"
            initial={{ opacity: 0, x: 20, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.8 }}
            className="flex items-center gap-1.5 sm:gap-2 bg-amber-500/90 backdrop-blur-md px-2.5 py-1 sm:px-4 sm:py-2 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.5)] border border-amber-300/30"
          >
            <MonitorPlay className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white animate-bounce" />
            <span className="text-white font-black text-[8px] sm:text-[10px] tracking-[0.2em] uppercase italic">SHOWING MEDIA</span>
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
            className="flex items-center gap-1.5 sm:gap-2 bg-slate-700/90 backdrop-blur-md px-2.5 py-1 sm:px-4 sm:py-2 rounded-full border border-slate-500/30"
          >
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-slate-400 rounded-full" />
            <span className="text-slate-300 font-black text-[8px] sm:text-[10px] tracking-[0.2em] uppercase italic">OFFLINE</span>
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
        className="max-w-7xl mx-auto px-3 sm:px-4 pt-[72px] sm:pt-24 pb-12"
      >
        {/* Mobile: Chat Toggle Button */}
        <div className="lg:hidden flex items-center justify-between mb-3 gap-3">
          <div className="flex items-center gap-2">
            {networkInfo.quality !== 'good' && networkInfo.quality !== 'excellent' && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-full">
                <Zap className="w-3 h-3 text-amber-400" />
                <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">
                  {networkInfo.quality}
                </span>
              </span>
            )}
            <span className="text-xs text-slate-400 font-medium">
              {meta.viewers.toLocaleString()} watching
            </span>
          </div>
          <button
            onClick={() => setShowChatOnMobile(!showChatOnMobile)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs font-medium text-slate-300"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Chat
            {chatMessages.length > 0 && (
              <span className="bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {chatMessages.length}
              </span>
            )}
          </button>
        </div>

        {/* Video Player - Mobile Optimized */}
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }} className="mb-6 sm:mb-10">
          <MobileOptimizedVideo
            stream={remoteStream}
            isLive={isLive}
            broadcastMode={broadcastMode}
            connectionState={connectionState}
            networkQuality={networkInfo.quality}
            onReconnect={reconnect}
            onStartAudio={liveKitActive ? liveKitViewer.startAudio : undefined}
            audioPlaybackBlocked={liveKitActive ? liveKitViewer.needsAudioStart : false}
          />
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-12 gap-4 sm:gap-8 items-start">
          {/* Info Column */}
          <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="lg:col-span-8 space-y-6 sm:space-y-8">
            <div className="bg-slate-900/40 backdrop-blur-md rounded-xl sm:rounded-[2rem] p-4 sm:p-8 border border-white/5 relative overflow-hidden group">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-[100px] transition-all duration-700 group-hover:bg-primary/20" />
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
                <div>
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-primary/20 text-primary text-[8px] sm:text-[10px] font-black tracking-widest uppercase rounded-full border border-primary/20">Featured Session</span>
                    <span className="text-slate-500 text-[8px] sm:text-[10px] font-bold tracking-widest uppercase">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight italic uppercase">{streamTitle}</h2>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-white font-black text-xl leading-none italic">{meta.viewers.toLocaleString()}</p>
                    <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest mt-1">Live Viewers</p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-slate-800 flex items-center justify-center border border-white/5">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                </div>
              </div>

              <p className="text-slate-400 text-base sm:text-lg leading-relaxed mb-6 sm:mb-10 max-w-3xl font-medium">
                {streamDescription}
              </p>

              <div className="flex flex-wrap gap-2 sm:gap-4">
                <Button className="bg-primary hover:bg-primary/90 text-white gap-2 sm:gap-3 px-4 sm:px-8 py-3 sm:py-7 h-auto text-sm sm:text-lg font-black italic uppercase rounded-xl sm:rounded-2xl shadow-[0_10px_20px_rgba(var(--primary),0.3)] transition-all hover:-translate-y-1 active:translate-y-0">
                  <Heart className="w-4 h-4 sm:w-6 sm:h-6 fill-current" />
                  <span className="hidden xs:inline">Support Us</span>
                  <span className="xs:hidden">Give</span>
                </Button>
                <Button variant="outline" onClick={handleShare} className="bg-white/5 border-white/10 hover:bg-white/10 gap-2 sm:gap-3 px-4 sm:px-8 py-3 sm:py-7 h-auto text-sm sm:text-lg font-black italic uppercase rounded-xl sm:rounded-2xl transition-all hover:-translate-y-1">
                  <Share2 className="w-4 h-4 sm:w-6 sm:h-6" />
                  <span className="hidden xs:inline">Share Live</span>
                  <span className="xs:hidden">Share</span>
                </Button>
                <Link href="/prayer">
                  <Button variant="ghost" className="text-slate-400 hover:text-white hover:bg-white/5 gap-2 sm:gap-3 px-4 sm:px-8 py-3 sm:py-7 h-auto text-sm sm:text-lg font-black italic uppercase rounded-xl sm:rounded-2xl">
                    <MessageCircle className="w-4 h-4 sm:w-6 sm:h-6" />
                    <span className="hidden xs:inline">Prayer</span>
                  </Button>
                </Link>
              </div>
            </div>

            {/* Upcoming Services Section */}
            <div>
              <div className="flex items-center justify-between mb-4 sm:mb-8 px-2">
                <div>
                  <h3 className="text-lg sm:text-2xl font-black text-white italic uppercase tracking-tight">Broadcast Schedule</h3>
                  <p className="text-slate-500 text-xs sm:text-sm font-medium">Never miss a powerful moment of worship</p>
                </div>
                <Button variant="link" className="text-primary font-bold uppercase tracking-widest text-[10px] sm:text-xs">View Full Calendar</Button>
              </div>
              
              <div className="grid sm:grid-cols-3 gap-3 sm:gap-6">
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
                  <div key={i} className="bg-slate-900/40 p-4 sm:p-6 rounded-xl sm:rounded-3xl border border-white/5 hover:border-primary/30 transition-all group">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                      {item.icon}
                    </div>
                    <p className="text-primary text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-1">{item.type}</p>
                    <h4 className="text-white font-black text-base sm:text-lg italic uppercase mb-2">{item.title}</h4>
                    <p className="text-slate-500 text-[10px] sm:text-xs font-bold flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      Every Week • {item.time}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Sidebar / Chat Column - Desktop */}
          <motion.div variants={{ hidden: { opacity: 0, x: 20 }, visible: { opacity: 1, x: 0 } }} className="hidden lg:block lg:col-span-4 space-y-6">
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

          {/* Mobile Chat Drawer */}
          <AnimatePresence>
            {showChatOnMobile && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="lg:hidden fixed inset-0 z-50 flex flex-col"
              >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-void/90 backdrop-blur-sm" onClick={() => setShowChatOnMobile(false)} />
                
                {/* Chat Panel */}
                <div className="relative mt-auto mb-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl max-h-[70vh] flex flex-col overflow-hidden">
                  {/* Drag Handle */}
                  <div className="flex items-center justify-center pt-3 pb-2">
                    <div className="w-10 h-1 rounded-full bg-slate-600" />
                  </div>
                  
                  {/* Header */}
                  <div className="px-4 pb-3 flex items-center justify-between border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-primary" />
                      <h3 className="font-black text-white text-sm italic uppercase tracking-tight">Community Chat</h3>
                    </div>
                    <button
                      onClick={() => setShowChatOnMobile(false)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-white"
                    >
                      <span className="text-lg">&times;</span>
                    </button>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                    {chatMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center text-center py-8 opacity-30">
                        <MessageCircle className="w-10 h-10 mb-4" />
                        <p className="text-xs font-bold uppercase tracking-widest">Start the conversation</p>
                      </div>
                    ) : (
                      chatMessages.map((msg, idx) => (
                        <div key={idx} className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className={`text-[9px] font-black tracking-widest uppercase italic ${msg.role === 'admin' ? 'text-primary' : 'text-slate-400'}`}>
                              {msg.user}
                            </span>
                            <span className="text-[8px] text-slate-600 font-mono">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className={`p-3 rounded-xl text-sm border ${
                            msg.role === 'admin' ? 'bg-primary/10 border-primary/20 text-white' : 'bg-white/5 border-white/5 text-slate-300'
                          }`}>
                            <p className="text-sm font-medium leading-relaxed">{msg.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t border-white/5 bg-white/5">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                        placeholder="Type a message..."
                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm font-medium text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50 transition-all"
                      />
                      <Button
                        size="icon"
                        onClick={handleSendChat}
                        className="absolute right-1.5 bg-primary hover:bg-primary/90 text-white w-8 h-8 rounded-lg"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
