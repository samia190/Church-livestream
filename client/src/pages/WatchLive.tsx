import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Radio, Users, Clock, Share2, Heart, MessageCircle, Play, Volume2, VolumeX } from 'lucide-react';
import { Link } from 'wouter';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { useViewer } from '@/hooks/useViewer';
import { toast } from 'sonner';

export default function WatchLive() {
  const { remoteStream, meta } = useViewer();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const upcomingServices = [
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
  ];

  const recentSermons = [
    {
      id: 1,
      title: 'The Power of Faith',
      speaker: 'Bishop Samuel Kipchoge',
      date: 'June 16, 2026',
      duration: '45 min',
      thumbnail: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663779111251/22XNoSU8LuRfCuqftFgkdg/sermons-media-broadcast-Q84LZ6m6F67AnXSBo3UuYP.webp',
      views: 2340,
    },
    {
      id: 2,
      title: 'Building Strong Families',
      speaker: 'Pastor Grace Mwangi',
      date: 'June 9, 2026',
      duration: '38 min',
      thumbnail: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663779111251/22XNoSU8LuRfCuqftFgkdg/sermons-media-broadcast-Q84LZ6m6F67AnXSBo3UuYP.webp',
      views: 1890,
    },
    {
      id: 3,
      title: 'God\'s Love Never Fails',
      speaker: 'Bishop Samuel Kipchoge',
      date: 'June 2, 2026',
      duration: '42 min',
      thumbnail: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663779111251/22XNoSU8LuRfCuqftFgkdg/sermons-media-broadcast-Q84LZ6m6F67AnXSBo3UuYP.webp',
      views: 3120,
    },
    {
      id: 4,
      title: 'Living in Victory',
      speaker: 'Pastor David Kiplagat',
      date: 'May 26, 2026',
      duration: '40 min',
      thumbnail: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663779111251/22XNoSU8LuRfCuqftFgkdg/sermons-media-broadcast-Q84LZ6m6F67AnXSBo3UuYP.webp',
      views: 2560,
    },
  ];

  const isLive = meta.isLive;
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

  return (
    <div className="min-h-screen text-foreground">
      <Navigation />

      {/* Live Stream Section */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="max-w-7xl mx-auto px-4 pt-24 pb-12"
      >
        <motion.div variants={itemVariants} className="mb-8">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center glass-panel">
            {/* Live Stream Video Player */}
            {isLive && remoteStream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={muted}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-void to-void flex flex-col items-center justify-center orbit-grid">
                <Play className="w-24 h-24 text-primary/60 mb-4" />
                <p className="text-foreground text-xl font-semibold mb-2">
                  {isLive ? 'Connecting to stream...' : 'No Live Stream Right Now'}
                </p>
                <p className="text-muted-foreground">
                  {isLive
                    ? 'Setting up your connection to the broadcast'
                    : 'Check back during a scheduled service, or watch a recent sermon below'}
                </p>
              </div>
            )}

            {/* Live Indicator */}
            {isLive && (
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute top-4 right-4 flex items-center gap-2 bg-red-600 px-4 py-2 rounded-full"
              >
                <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                <span className="text-white font-bold text-sm">LIVE NOW</span>
              </motion.div>
            )}

            {/* Mute toggle */}
            {isLive && remoteStream && (
              <button
                onClick={() => setMuted(m => !m)}
                className="absolute bottom-4 right-4 bg-black/60 backdrop-blur p-3 rounded-full hover:bg-black/80 transition-colors"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
              </button>
            )}

            {/* Viewer Count */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur px-4 py-2 rounded-full">
              <Users className="w-4 h-4 text-ember" />
              <span className="text-white font-semibold">{meta.viewers.toLocaleString()} watching</span>
            </div>
          </div>
        </motion.div>

        {/* Stream Info */}
        <motion.div variants={itemVariants} className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="md:col-span-2">
            <h2 className="text-3xl font-bold mb-2">{streamTitle}</h2>
            <p className="text-muted-foreground mb-6">{streamDescription}</p>

            <div className="flex flex-wrap gap-3">
              <Button className="bg-ember hover:bg-ember/90 text-ember-foreground gap-2 font-semibold">
                <Heart className="w-4 h-4" />
                Like
              </Button>
              <Button variant="outline" className="border-primary/50 hover:bg-primary/10 gap-2" onClick={handleShare}>
                <Share2 className="w-4 h-4" />
                Share
              </Button>
              <Link href="/prayer">
                <Button variant="outline" className="border-primary/50 hover:bg-primary/10 gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Prayer Request
                </Button>
              </Link>
            </div>
          </div>

          {/* Stream Stats */}
          <motion.div variants={itemVariants} className="glass-panel p-6">
            <h3 className="font-bold mb-4">Stream Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <span className={`font-bold ${isLive ? 'text-signal' : 'text-muted-foreground'}`}>
                  {isLive ? 'LIVE' : 'Offline'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Watching Now</span>
                <span className="text-ember font-bold">{meta.viewers.toLocaleString()}</span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Upcoming Services */}
        <motion.div variants={itemVariants} className="mb-12">
          <p className="label-eyebrow mb-2">Save the Date</p>
          <h3 className="text-2xl font-bold mb-6">Upcoming Services</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {upcomingServices.map((service) => (
              <motion.div
                key={service.id}
                className="tilt-card glass-panel overflow-hidden cursor-pointer"
              >
                <div className="aspect-video relative overflow-hidden">
                  <img src={service.thumbnail} alt={service.title} className="w-full h-full object-cover opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center bg-void/30">
                    <Radio className="w-12 h-12 text-ember" />
                  </div>
                </div>
                <div className="p-4">
                  <h4 className="font-bold mb-2">{service.title}</h4>
                  <p className="text-sm text-muted-foreground mb-3">{service.description}</p>
                  <div className="space-y-2 text-sm text-muted-foreground font-mono">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-ember" />
                      <span>{service.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-ember" />
                      <span>{service.time}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent Sermons */}
        <motion.div variants={itemVariants}>
          <p className="label-eyebrow mb-2">Catch Up</p>
          <h3 className="text-2xl font-bold mb-6">Recent Sermons</h3>
          <div className="grid md:grid-cols-4 gap-6">
            {recentSermons.map((sermon) => (
              <motion.div
                key={sermon.id}
                className="tilt-card glass-panel overflow-hidden cursor-pointer"
              >
                <div className="aspect-video relative overflow-hidden group">
                  <img src={sermon.thumbnail} alt={sermon.title} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-void/30">
                    <Play className="w-12 h-12 text-ember" />
                  </div>
                  <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-xs text-white font-mono">{sermon.duration}</div>
                </div>
                <div className="p-4">
                  <h4 className="font-bold mb-1 line-clamp-2">{sermon.title}</h4>
                  <p className="text-sm text-ember mb-3">{sermon.speaker}</p>
                  <div className="flex justify-between items-center text-xs text-muted-foreground font-mono">
                    <span>{sermon.date}</span>
                    <span>{sermon.views.toLocaleString()} views</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.section>
    </div>
  );
}
