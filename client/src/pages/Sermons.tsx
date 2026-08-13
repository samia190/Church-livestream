import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { ChevronLeft, Play, Download, Calendar, User, BookOpen, Video, Headphones, CheckCircle2 } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8 },
  },
};

export default function Sermons() {
  const { isAuthenticated } = useAuth();
  const { data: publishedSermons = [], isLoading } = trpc.sermons.getPublished.useQuery();
  const saveJournal = trpc.journal.create.useMutation({ onSuccess: () => toast.success('Reflection saved privately in your Faith Journal') });
  const [selectedSermonId, setSelectedSermonId] = useState<string | null>(null);
  const [reflection, setReflection] = useState('');
  const fallbackSermons = [
    { title: 'Faith in Times of Uncertainty', preacher: 'Bishop Samuel Mwangi', date: 'June 16, 2026', duration: '45 min', category: 'Faith', description: 'A message about trusting God during challenging times and maintaining spiritual strength.', hasAudio: true, hasVideo: true },
    { title: 'The Power of Prayer', preacher: 'Rev. John Kimani', date: 'June 9, 2026', duration: '38 min', category: 'Prayer', description: 'Exploring the transformative power of prayer and how to develop a deeper prayer life.', hasAudio: true, hasVideo: true },
    { title: 'Community Service as Ministry', preacher: 'Rev. Grace Njoki', date: 'June 2, 2026', duration: '42 min', category: 'Service', description: 'Understanding how community outreach reflects our faith and serves as a ministry.', hasAudio: true, hasVideo: false },
  ];
  const sermons: any[] = (publishedSermons as any[]).length > 0 ? (publishedSermons as any[]) : fallbackSermons;
  const openStudy = (sermon: any, index: number) => { setSelectedSermonId(String(sermon._id ?? index)); setReflection(''); };
  const selectedSermon = sermons.find((sermon, index) => String(sermon._id ?? index) === selectedSermonId);

  return (
    <div className="min-h-screen text-foreground">
      <Navigation />
      {/* Header */}
      <div className="pt-24 pb-12 px-4 orbit-grid border-b border-border">
        <div className="max-w-6xl mx-auto">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-6">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-4">
              <span className="text-glow">
                Sermons & Media
              </span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
              Access our library of inspiring sermons, teachings, and spiritual content from our church leaders.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Hero Image */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="relative w-full h-48 sm:h-72 md:h-96 overflow-hidden"
      >
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663779111251/22XNoSU8LuRfCuqftFgkdg/sermons-media-broadcast-PLiweoLYZSD9HWrE5QubbG.webp"
          alt="Sermons and Media"
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent"></div>
      </motion.div>

      {/* Sermons Grid */}
      <section className="py-12 sm:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid sm:grid-cols-2 gap-4 sm:gap-6"
          >
            {isLoading ? <Card className="p-8 text-center text-muted-foreground sm:col-span-2">Loading the sermon library…</Card> : sermons.map((sermon, idx) => (
              <motion.div key={String(sermon._id ?? idx)} variants={itemVariants}>
                <Card className="overflow-hidden glass-panel tilt-card border-0 transition-all h-full flex flex-col">
                  <div className="h-1.5 bg-gradient-to-r from-ember to-primary"></div>
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-ember/15 text-ember">{sermon.category ?? 'Teaching'}</span>
                      <div className="flex gap-2">
                        {(sermon.videoUrl || sermon.hasVideo) && (sermon.videoUrl ? <a href={sermon.videoUrl} target="_blank" rel="noreferrer" aria-label={`Watch ${sermon.title}`} className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center"><Video className="w-4 h-4 text-primary" /></a> : <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center"><Play className="w-4 h-4 text-primary" /></div>)}
                        {(sermon.audioUrl || sermon.hasAudio) && (sermon.audioUrl ? <a href={sermon.audioUrl} target="_blank" rel="noreferrer" aria-label={`Listen to ${sermon.title}`} className="w-8 h-8 rounded-full bg-signal/15 flex items-center justify-center"><Headphones className="w-4 h-4 text-signal" /></a> : <div className="w-8 h-8 rounded-full bg-signal/15 flex items-center justify-center"><Download className="w-4 h-4 text-signal" /></div>)}
                      </div>
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-foreground">{sermon.title}</h3>
                    <p className="text-muted-foreground mb-4 flex-1">{sermon.description ?? 'A message to receive slowly, test prayerfully, and live faithfully.'}</p>
                    <div className="space-y-2 text-sm text-muted-foreground border-t border-border pt-4">
                      <div className="flex items-center gap-2"><User className="w-4 h-4 text-primary" /><span>{sermon.speaker ?? sermon.preacher ?? 'NICA Kibugu teaching team'}</span></div>
                      <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /><span>{sermon.sermonDate ? new Date(sermon.sermonDate).toLocaleDateString() : sermon.date}{typeof sermon.duration === 'number' ? ` · ${sermon.duration} min` : sermon.duration ? ` · ${sermon.duration}` : ''}</span></div>
                    </div>
                    <Button variant="outline" className="mt-5 gap-2" onClick={() => openStudy(sermon, idx)}><BookOpen className="w-4 h-4" />Open study guide</Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {selectedSermon && <section className="px-4 pb-16"><div className="max-w-4xl mx-auto"><Card className="p-6 md:p-8 glass-panel border-0"><div className="flex items-start gap-3 mb-5"><BookOpen className="w-7 h-7 text-ember shrink-0" /><div><p className="label-eyebrow mb-2">Receive · Reflect · Respond</p><h2 className="text-2xl font-bold">Study guide: {selectedSermon.title}</h2><p className="text-muted-foreground mt-2">Use this guide to move from consuming a message to practicing one faithful next step.</p></div></div><div className="grid md:grid-cols-3 gap-4 mb-6"><div className="rounded-xl border border-border p-4"><p className="font-semibold mb-2">Notice</p><p className="text-sm text-muted-foreground">What Scripture, truth, or challenge stayed with you?</p></div><div className="rounded-xl border border-border p-4"><p className="font-semibold mb-2">Pray</p><p className="text-sm text-muted-foreground">Where are you inviting Christ to meet you honestly?</p></div><div className="rounded-xl border border-border p-4"><p className="font-semibold mb-2">Practice</p><p className="text-sm text-muted-foreground">What loving action can you take within the next seven days?</p></div></div><textarea value={reflection} onChange={event => setReflection(event.target.value)} maxLength={12000} rows={6} placeholder="Write a private reflection…" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" aria-label="Private sermon reflection" /><div className="flex flex-wrap items-center gap-3 mt-4"><Button disabled={!reflection.trim() || !isAuthenticated || saveJournal.isPending} onClick={() => saveJournal.mutate({ title: `Sermon reflection: ${selectedSermon.title}`, content: reflection.trim(), mood: 'seeking' })} className="gap-2 bg-ember hover:bg-ember/90 text-ember-foreground"><CheckCircle2 className="w-4 h-4" />{isAuthenticated ? 'Save privately to Faith Journal' : 'Sign in to save privately'}</Button><Button variant="ghost" onClick={() => setSelectedSermonId(null)}>Close guide</Button></div></Card></div></section>}

      {/* CTA */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center glass-panel p-10 md:p-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <p className="label-eyebrow mb-3">Never Miss a Message</p>
            <h2 className="text-3xl font-bold mb-4">Subscribe to Our Channel</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Get notified when new sermons and spiritual content are available.
            </p>
            <Button size="lg" className="bg-ember hover:bg-ember/90 text-ember-foreground font-semibold">
              Subscribe Now
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
