import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { ChevronLeft, Play, Download, Calendar, User } from 'lucide-react';
import Navigation from '@/components/Navigation';

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
  const sermons = [
    {
      title: 'Faith in Times of Uncertainty',
      preacher: 'Bishop Samuel Mwangi',
      date: 'June 16, 2026',
      duration: '45 min',
      category: 'Faith',
      description: 'A powerful message about trusting God during challenging times and maintaining spiritual strength.',
      hasAudio: true,
      hasVideo: true,
    },
    {
      title: 'The Power of Prayer',
      preacher: 'Rev. John Kimani',
      date: 'June 9, 2026',
      duration: '38 min',
      category: 'Prayer',
      description: 'Exploring the transformative power of prayer and how to develop a deeper prayer life.',
      hasAudio: true,
      hasVideo: true,
    },
    {
      title: 'Community Service as Ministry',
      preacher: 'Rev. Grace Njoki',
      date: 'June 2, 2026',
      duration: '42 min',
      category: 'Service',
      description: 'Understanding how community outreach reflects our faith and serves as a ministry.',
      hasAudio: true,
      hasVideo: false,
    },
    {
      title: 'Youth Leadership in the Church',
      preacher: 'Rev. Peter Omondi',
      date: 'May 26, 2026',
      duration: '35 min',
      category: 'Youth',
      description: 'Empowering young people to take leadership roles in the church and community.',
      hasAudio: true,
      hasVideo: true,
    },
    {
      title: 'Spiritual Renewal and Growth',
      preacher: 'Bishop Samuel Mwangi',
      date: 'May 19, 2026',
      duration: '48 min',
      category: 'Spiritual Growth',
      description: 'A message about personal spiritual development and continuous growth in faith.',
      hasAudio: true,
      hasVideo: true,
    },
    {
      title: 'Living Out Our Faith Daily',
      preacher: 'Rev. John Kimani',
      date: 'May 12, 2026',
      duration: '40 min',
      category: 'Faith',
      description: 'Practical ways to apply biblical principles to everyday life and decisions.',
      hasAudio: true,
      hasVideo: false,
    },
  ];

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
            {sermons.map((sermon, idx) => (
              <motion.div key={idx} variants={itemVariants}>
                <Card className="overflow-hidden glass-panel tilt-card border-0 transition-all h-full flex flex-col">
                  <div className="h-1.5 bg-gradient-to-r from-ember to-primary"></div>
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="mb-4 flex items-start justify-between">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-ember/15 text-ember">
                        {sermon.category}
                      </span>
                      <div className="flex gap-2">
                        {sermon.hasVideo && (
                          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                            <Play className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        {sermon.hasAudio && (
                          <div className="w-8 h-8 rounded-full bg-signal/15 flex items-center justify-center">
                            <Download className="w-4 h-4 text-signal" />
                          </div>
                        )}
                      </div>
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-foreground">{sermon.title}</h3>
                    <p className="text-muted-foreground mb-4 flex-1">{sermon.description}</p>
                    <div className="space-y-2 text-sm text-muted-foreground border-t border-border pt-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-primary" />
                        <span>{sermon.preacher}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span>{sermon.date} - {sermon.duration}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

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
