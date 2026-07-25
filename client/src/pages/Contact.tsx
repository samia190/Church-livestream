import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'wouter';
import { ChevronLeft, MapPin, Phone, Mail, Clock } from 'lucide-react';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
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

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });

  const submitContact = trpc.contact.submit.useMutation({
    onSuccess: () => {
      toast.success('Message sent successfully!');
      setFormData({ name: '', email: '', phone: '', message: '' });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send message');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitContact.mutate(formData);
  };

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
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              <span className="text-glow">
                Contact Us
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Get in touch with N.I.C.A. Kibugu Parish. We would love to hear from you.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Contact Information */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 gap-8 mb-16"
          >
            {[
              {
                icon: MapPin,
                title: 'Location',
                content: 'Kibugu, Nginda Parish\nEmbu County, Kenya',
              },
              {
                icon: Phone,
                title: 'Phone',
                content: '+254 (0) 712 345 678\n+254 (0) 734 567 890',
              },
              {
                icon: Mail,
                title: 'Email',
                content: 'info@nicakibugu.org\npastor@nicakibugu.org',
              },
              {
                icon: Clock,
                title: 'Service Times',
                content: 'Sunday: 10:00 AM\nWednesday: 7:00 PM',
              },
            ].map((item, idx) => (
              <motion.div key={idx} variants={itemVariants} className="tilt-card">
                <Card className="p-8 glass-panel border-0">
                  <item.icon className="w-12 h-12 text-ember mb-4" />
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground whitespace-pre-line">{item.content}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto"
          >
            <Card className="p-8 glass-panel border-0">
              <h2 className="text-2xl font-bold mb-6">Send us a Message</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="contact-name" className="block text-sm font-medium mb-2">Name</label>
                    <Input
                      id="contact-name"
                      type="text"
                      placeholder="Your name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      aria-required="true"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="block text-sm font-medium mb-2">Email</label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      aria-required="true"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="contact-phone" className="block text-sm font-medium mb-2">Phone</label>
                  <Input
                    id="contact-phone"
                    type="tel"
                    placeholder="+254 712 345 678"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="contact-message" className="block text-sm font-medium mb-2">Message</label>
                  <Textarea
                    id="contact-message"
                    placeholder="Your message..."
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                    aria-required="true"
                  />
                </div>
                <Button type="submit" size="lg" className="w-full bg-ember hover:bg-ember/90 text-ember-foreground font-semibold" disabled={submitContact.isPending}>
                  {submitContact.isPending ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Map Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="label-eyebrow mb-3">Come See Us</p>
            <h2 className="text-4xl font-bold mb-4">Find Us</h2>
            <p className="text-lg text-muted-foreground">
              Located in the heart of Kibugu, Nginda Parish, Embu County
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="rounded-xl overflow-hidden glass-panel h-96"
          >
            <div className="w-full h-full orbit-grid flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-ember/15 flex items-center justify-center mx-auto mb-4 glow-ring">
                  <MapPin className="w-8 h-8 text-ember" />
                </div>
                <p className="text-lg font-semibold">Kibugu, Nginda Parish</p>
                <p className="text-muted-foreground">Embu County, Kenya</p>
              </div>
            </div>
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
            <p className="label-eyebrow mb-3">All Are Welcome</p>
            <h2 className="text-3xl font-bold mb-4">Visit Us Soon</h2>
            <p className="text-lg text-muted-foreground mb-8">
              We welcome you to join us for worship, prayer, and fellowship.
            </p>
            <Link href="/events">
              <Button size="lg" className="bg-ember hover:bg-ember/90 text-ember-foreground font-semibold">
                View Our Events
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
