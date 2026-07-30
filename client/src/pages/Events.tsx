import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { ChevronLeft, Calendar, MapPin, Clock, Users } from 'lucide-react';
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

export default function Events() {
  const events = [
    {
      title: 'Sunday Worship Service',
      date: 'Every Sunday',
      time: '10:00 AM - 12:30 PM',
      location: 'Kibugu Parish Church',
      category: 'Worship',
      description: 'Join us for our main weekly worship service featuring prayer, praise, and biblical teaching.',
      attendees: '500+',
    },
    {
      title: 'Wednesday Prayer Meeting',
      date: 'Every Wednesday',
      time: '7:00 PM - 8:30 PM',
      location: 'Church Hall',
      category: 'Prayer',
      description: 'Midweek prayer gathering for spiritual renewal and intercession for our community.',
      attendees: '150+',
    },
    {
      title: 'Youth Fellowship',
      date: 'Every Saturday',
      time: '3:00 PM - 5:00 PM',
      location: 'Community Center',
      category: 'Youth',
      description: 'Dynamic gathering for young people featuring worship, teaching, and fellowship activities.',
      attendees: '200+',
    },
    {
      title: 'Womens Empowerment Program',
      date: 'First Saturday Monthly',
      time: '9:00 AM - 12:00 PM',
      location: 'Parish Office',
      category: 'Community',
      description: 'Skills training and spiritual development for women in our parish and surrounding areas.',
      attendees: '100+',
    },
    {
      title: 'Mens Fellowship Breakfast',
      date: 'First Sunday Monthly',
      time: '7:00 AM - 9:00 AM',
      location: 'Church Grounds',
      category: 'Fellowship',
      description: 'Monthly gathering for men featuring breakfast, fellowship, and spiritual encouragement.',
      attendees: '80+',
    },
    {
      title: 'Community Health Outreach',
      date: 'Third Saturday Monthly',
      time: '8:00 AM - 2:00 PM',
      location: 'Kibugu Market',
      category: 'Outreach',
      description: 'Free health screening and medical consultations for community members.',
      attendees: '300+',
    },
  ];

  return (
    <div className="min-h-screen text-foreground">
      <Navigation />
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
                Events & Services
              </span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
              Join us for worship, prayer, fellowship, and community service throughout the year.
            </p>
          </motion.div>
        </div>
      </div>

      <section className="py-12 sm:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
          >
            {events.map((event, idx) => (
              <motion.div key={idx} variants={itemVariants}>
                <Card className="overflow-hidden glass-panel tilt-card border-0 transition-all hover:shadow-lg h-full flex flex-col">
                  <div className="h-1.5 bg-gradient-to-r from-ember to-primary"></div>
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="mb-4">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-ember/15 text-ember">
                        {event.category}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mb-4 text-foreground">{event.title}</h3>
                    <p className="text-muted-foreground mb-6 flex-1">{event.description}</p>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span>{event.date}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Clock className="w-4 h-4 text-primary" />
                        <span>{event.time}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span>{event.location}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Users className="w-4 h-4 text-primary" />
                        <span>{event.attendees} expected</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center glass-panel p-10 md:p-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <p className="label-eyebrow mb-3">First Time Coming?</p>
            <h2 className="text-3xl font-bold mb-4">Plan Your Visit</h2>
            <p className="text-lg text-muted-foreground mb-8">
              We welcome you to join us for any of our services and events. All are invited!
            </p>
            <Link href="/contact">
              <Button size="lg" className="bg-ember hover:bg-ember/90 text-ember-foreground font-semibold">
                Get Directions
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
