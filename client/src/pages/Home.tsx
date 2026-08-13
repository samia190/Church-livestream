import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronRight, MapPin, Clock, Users, Heart, BookOpen, Music, Handshake } from 'lucide-react';
import { Link } from 'wouter';
import Navigation from '@/components/Navigation';
import RadiantCore from '@/components/three/RadiantCore';

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

const floatingVariants = {
  animate: {
    x: [
      0, 0, 0, 0,
      -150, -75, 0,
      75, 150, 75, 0
    ],
    y: [
      150, 75, 0, -150,
      0, 0, 0,
      0, 0, 0, 150
    ],
    rotate: [0, 3, 0, -3, 0],
    scale: [1, 1, 1, 1, 1],
    transition: {
      duration: 14,
      ease: "easeInOut" as const,
      repeat: Infinity,
    },
  },
};

export default function Home() {
  return (
    <div className="min-h-screen text-foreground overflow-hidden">
      {/* Navigation with Side Menu */}
      <Navigation />

      {/* Hero Section */}
      <section className="relative w-full h-screen flex items-center justify-center pt-20 sm:pt-16 overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663779111251/22XNoSU8LuRfCuqftFgkdg/prayer-service-congregation-Q84LZ6m6F67AnXSBo3UuYP.webp"
            alt="Prayer Service Background"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent"></div>
        </div>

        {/* Ambient orbit-grid texture */}
        <div className="absolute inset-0 z-0 orbit-grid opacity-40"></div>

        {/* Radiant Core — the site's signature 3D element */}
        <div className="absolute inset-0 z-[1] hidden lg:flex items-center justify-end pr-4 lg:pr-20 pointer-events-none">
          <RadiantCore className="w-[26rem] h-[26rem] lg:w-[34rem] lg:h-[34rem] opacity-90" />
        </div>

        {/* Content */}
        <motion.div
          className="relative z-10 max-w-4xl mx-auto px-4 text-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Logo Animation */}
          <motion.div
            variants={floatingVariants}
            animate="animate"
            className="mb-8"
          >
            <div className="w-28 h-28 sm:w-36 sm:h-36 mx-auto rounded-full bg-gradient-to-br from-ember via-primary to-ember p-[3px] glow-ring flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-card/95 flex items-center justify-center overflow-hidden">
                <img src="/logo/logo.png" alt="NICA Logo" className="w-28 h-28 sm:w-36 sm:h-36 object-contain" />
              </div>
            </div>
          </motion.div>

          {/* Eyebrow */}
          <motion.p variants={itemVariants} className="label-eyebrow mb-4">
            Rooted in the Independence Era &middot; Embu County, Kenya
          </motion.p>

          {/* Main Heading */}
          <motion.h1
            variants={itemVariants}
            className="text-3xl sm:text-5xl md:text-7xl font-bold mb-4 sm:mb-6 leading-tight"
          >
            <span className="text-glow">
              National Independence Church of Africa
            </span>
            <br />
            <span className="text-3xl md:text-5xl text-foreground">N.I.C.A. Kibugu, Nginda Parish</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto"
          >
            Blending spiritual heritage with modern faith. Celebrating our Mau Mau era roots and continuing our mission of community transformation.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link href="/events">
              <Button size="lg" className="bg-ember hover:bg-ember/90 text-ember-foreground text-lg px-8 font-semibold">
                Join Us for Service
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/history">
              <Button size="lg" variant="outline" className="text-lg px-8 border-primary/50 hover:bg-primary/10">
                Learn Our History
              </Button>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            variants={itemVariants}
            className="mt-16 grid grid-cols-3 gap-4 max-w-md mx-auto"
          >
            {[
              { icon: Users, label: 'Community', value: '2,700+' },
              { icon: BookOpen, label: 'Parishes', value: '8' },
              { icon: Heart, label: 'Years', value: 'Since Mau Mau' },
            ].map((stat, idx) => (
              <motion.div
                key={idx}
                className="glass-panel tilt-card p-4"
              >
                <stat.icon className="w-6 h-6 text-ember mx-auto mb-2" />
                <p className="label-eyebrow text-[0.6rem] mb-1">{stat.label}</p>
                <p className="text-lg font-display font-bold text-foreground">{stat.value}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-6 h-10 border-2 border-primary rounded-full flex justify-center">
            <motion.div
              className="w-1 h-2 bg-primary rounded-full mt-2"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            ></motion.div>
          </div>
        </motion.div>
      </section>

      {/* Featured Sections */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="label-eyebrow mb-3">What We Stand For</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Our Mission & Ministry</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Rooted in the independence movement, committed to spiritual growth and community transformation.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {[
              {
                icon: BookOpen,
                title: 'History & Heritage',
                desc: 'Explore our Mau Mau era roots and spiritual legacy',
                link: '/history',
              },
              {
                icon: Users,
                title: 'Leadership',
                desc: 'Meet our dedicated clergy and church leaders',
                link: '/leadership',
              },
              {
                icon: Music,
                title: 'Sermons & Media',
                desc: 'Access our sermon library and spiritual content',
                link: '/sermons',
              },
              {
                icon: Handshake,
                title: 'Community Projects',
                desc: 'Discover our education and healthcare initiatives',
                link: '/community',
              },
            ].map((item, idx) => (
              <motion.div key={idx} variants={itemVariants} className="tilt-card h-full">
                <Link href={item.link}>
                  <Card className="h-full p-6 cursor-pointer glass-panel border-0">
                    <item.icon className="w-12 h-12 text-ember mb-4" />
                    <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                    <div className="mt-4 flex items-center text-primary text-sm font-medium">
                      Learn More <ChevronRight className="w-4 h-4 ml-1" />
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Events Preview */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="label-eyebrow mb-3">Gather With Us</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Upcoming Events</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Join us for worship, prayer, and community gatherings.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-6 mb-8"
          >
            {[
              {
                title: 'Sunday Service',
                time: 'Every Sunday, 10:00 AM',
                location: 'Kibugu Parish Church',
                icon: Clock,
              },
              {
                title: 'Prayer Meeting',
                time: 'Wednesday, 7:00 PM',
                location: 'Church Hall',
                icon: Heart,
              },
              {
                title: 'Youth Fellowship',
                time: 'Saturday, 3:00 PM',
                location: 'Community Center',
                icon: Users,
              },
            ].map((event, idx) => (
              <motion.div key={idx} variants={itemVariants} className="tilt-card">
                <Card className="p-6 glass-panel border-0">
                  <event.icon className="w-10 h-10 text-ember mb-4" />
                  <h3 className="text-lg font-bold mb-2">{event.title}</h3>
                  <div className="space-y-2 text-sm text-muted-foreground font-mono">
                    <p className="flex items-center gap-2">
                      <Clock className="w-4 h-4" /> {event.time}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> {event.location}
                    </p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <Link href="/events">
              <Button size="lg" variant="outline">
                View All Events
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Prayer & Giving CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center glass-panel p-10 md:p-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <p className="label-eyebrow mb-3">We're Praying With You</p>
            <h2 className="text-4xl font-bold mb-6">Share Your Prayer Needs</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Our church family is here to pray with you and support your spiritual journey.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/prayer">
                <Button size="lg" className="bg-primary hover:bg-primary/90">
                  Submit Prayer Request
                </Button>
              </Link>
              <Link href="/give">
                <Button size="lg" variant="outline" className="border-ember/50 text-ember hover:bg-ember/10">
                  Support Our Ministry
                </Button>
              </Link>
              <Link href="/journey">
                <Button size="lg" variant="outline" className="border-primary/50 hover:bg-primary/10">
                  Begin Your Journey
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="glass-panel border-x-0 border-b-0 rounded-none py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="grid md:grid-cols-4 gap-8 mb-8"
          >
            <div>
              <h3 className="font-bold mb-4">About NICA</h3>
              <p className="text-sm text-muted-foreground">
                National Independence Church of Africa - Kibugu Parish, Nginda
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/history" className="text-muted-foreground hover:text-ember">History</Link></li>
                <li><Link href="/events" className="text-muted-foreground hover:text-ember">Events</Link></li>
                <li><Link href="/sermons" className="text-muted-foreground hover:text-ember">Sermons</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Contact</h3>
              <p className="text-sm text-muted-foreground">Kibugu, Nginda Parish</p>
              <p className="text-sm text-muted-foreground">Embu County, Kenya</p>
            </div>
            <div>
              <h3 className="font-bold mb-4">Service Times</h3>
              <p className="text-sm text-muted-foreground">Sunday: 10:00 AM</p>
              <p className="text-sm text-muted-foreground">Wednesday: 7:00 PM</p>
            </div>
          </motion.div>

          <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2026 National Independence Church of Africa - Kibugu Parish. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
