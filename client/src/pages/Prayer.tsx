import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'wouter';
import { ChevronLeft, Heart } from 'lucide-react';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';
import RadiantCore from '@/components/three/RadiantCore';

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8 },
  },
};

export default function Prayer() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    prayerRequest: '',
    isPublic: false,
  });

  const submitPrayer = trpc.prayer.submit.useMutation({
    onSuccess: () => {
      toast.success('Prayer request submitted successfully!');
      setFormData({ name: '', email: '', prayerRequest: '', isPublic: false });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to submit prayer request');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitPrayer.mutate(formData);
  };

  return (
    <div className="min-h-screen text-foreground">
      <Navigation />
      {/* Header */}
      <div className="relative pt-24 pb-12 px-4 orbit-grid border-b border-border overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-end pr-4 lg:pr-16 pointer-events-none opacity-70">
          <RadiantCore className="w-64 h-64 lg:w-80 lg:h-80 hidden md:block" />
        </div>
        <div className="relative max-w-4xl mx-auto">
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
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              <span className="text-glow">
                Prayer Requests
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Share your prayer needs with our church family. We are here to pray with you and support your spiritual journey.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Hero Image */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="relative w-full h-96 overflow-hidden"
      >
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663779111251/22XNoSU8LuRfCuqftFgkdg/prayer-spiritual-light-Enpn5DqjWo6qMu8rHNsRtu.webp"
          alt="Prayer and Spiritual Light"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent"></div>
      </motion.div>

      {/* Prayer Request Form */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <Card className="p-8 glass-panel border-0">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-ember/15 flex items-center justify-center glow-ring">
                  <Heart className="w-5 h-5 text-ember" />
                </div>
                <h2 className="text-2xl font-bold">Submit Your Prayer Request</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="prayer-name" className="block text-sm font-medium mb-2">Your Name</label>
                  <Input
                    id="prayer-name"
                    type="text"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    aria-required="true"
                  />
                </div>

                <div>
                  <label htmlFor="prayer-email" className="block text-sm font-medium mb-2">Email Address</label>
                  <Input
                    id="prayer-email"
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    aria-required="true"
                  />
                </div>

                <div>
                  <label htmlFor="prayer-request" className="block text-sm font-medium mb-2">Your Prayer Request</label>
                  <Textarea
                    id="prayer-request"
                    placeholder="Share your prayer needs, concerns, or requests. Be as specific as you feel comfortable."
                    rows={6}
                    value={formData.prayerRequest}
                    onChange={(e) => setFormData({ ...formData, prayerRequest: e.target.value })}
                    required
                    aria-required="true"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={formData.isPublic}
                    onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                    className="w-4 h-4 rounded border-border"
                  />
                  <label htmlFor="isPublic" className="text-sm text-muted-foreground">
                    I would like my prayer request to be shared with the church prayer team
                  </label>
                </div>

                <Button type="submit" size="lg" className="w-full bg-primary hover:bg-primary/90" disabled={submitPrayer.isPending}>
                  {submitPrayer.isPending ? 'Submitting...' : 'Submit Prayer Request'}
                </Button>
              </form>

              <p className="text-xs text-muted-foreground mt-6 text-center">
                Your privacy is important to us. Prayer requests are handled with confidentiality and care.
              </p>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Prayer Information */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="label-eyebrow mb-3">How We Pray Together</p>
            <h2 className="text-4xl font-bold mb-4">Prayer Ministry</h2>
            <p className="text-lg text-muted-foreground">
              Our church family is committed to interceding for one another and our community.
            </p>
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.1,
                  delayChildren: 0.2,
                },
              },
            }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 gap-6"
          >
            {[
              {
                title: 'Weekly Prayer Meetings',
                description: 'Join us every Wednesday at 7:00 PM for focused prayer and intercession.',
              },
              {
                title: 'Prayer Chain',
                description: 'Our prayer chain ensures urgent requests receive immediate intercession.',
              },
              {
                title: 'Pastoral Prayer Support',
                description: 'Our pastors are available for prayer counseling and spiritual guidance.',
              },
              {
                title: 'Prayer for Healing',
                description: 'We believe in the power of prayer for physical, emotional, and spiritual healing.',
              },
            ].map((item, idx) => (
              <motion.div key={idx} variants={itemVariants} className="tilt-card">
                <Card className="p-6 glass-panel border-0">
                  <h3 className="text-lg font-bold mb-3 text-ember">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
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
            <p className="label-eyebrow mb-3">Urgent Need?</p>
            <h2 className="text-3xl font-bold mb-4">Need Immediate Prayer Support?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Contact our pastoral team directly for urgent prayer needs.
            </p>
            <Link href="/contact">
              <Button size="lg" className="bg-ember hover:bg-ember/90 text-ember-foreground font-semibold">
                Contact Our Pastors
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
