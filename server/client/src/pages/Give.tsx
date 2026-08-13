import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'wouter';
import { ChevronLeft, Heart, Zap, Users, BookOpen } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
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

export default function Give() {
  const [showDonationForm, setShowDonationForm] = useState(false);
  const [, setLocation] = useLocation();
  const [donationData, setDonationData] = useState({
    donorName: '',
    email: '',
    phone: '',
    amount: 0,
    currency: 'KES' as 'KES' | 'USD',
    method: 'mpesa' as 'mpesa' | 'paypal' | 'bank' | 'inperson',
    purpose: '',
  });

  const capturePaypal = trpc.donation.capturePaypal.useMutation({
    onSuccess: (result) => {
      toast[result.status === 'completed' ? 'success' : 'info'](result.status === 'completed' ? 'PayPal donation completed. Thank you!' : 'PayPal payment is still pending.');
      setLocation('/give');
    },
    onError: (error) => toast.error(error.message || 'PayPal capture failed'),
  });

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const payment = query.get('payment');
    const orderId = query.get('token');
    const donationId = query.get('donationId');
    if (payment === 'paypal-success' && orderId && donationId) capturePaypal.mutate({ orderId, donationId });
    if (payment === 'paypal-cancelled') toast.info('PayPal payment cancelled. No donation was completed.');
  }, []);

  const submitDonation = trpc.donation.submit.useMutation({
    onSuccess: (result) => {
      if (result.approvalUrl) {
        window.location.assign(result.approvalUrl);
        return;
      }
      toast.success(result.message || 'Donation initiated. Follow the instructions on your phone.');
      setDonationData({ donorName: '', email: '', phone: '', amount: 0, currency: 'KES', method: 'mpesa', purpose: '' });
      setShowDonationForm(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to process donation');
    },
  });

  const handleDonationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitDonation.mutate(donationData);
  };

  return (
    <div className="min-h-screen text-foreground">
      <Navigation />
      {/* Header */}
      <div className="relative pt-24 pb-12 px-4 orbit-grid border-b border-border overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-end pr-4 lg:pr-16 pointer-events-none opacity-80">
          <RadiantCore className="w-72 h-72 lg:w-96 lg:h-96 hidden md:block" />
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
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-4">
              <span className="text-glow">
                Support Our Ministry
              </span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
              Your generous giving enables N.I.C.A. Kibugu Parish to continue our mission of spiritual growth and community transformation.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Impact of Giving */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="label-eyebrow mb-3">Where It Goes</p>
            <h2 className="text-2xl sm:text-4xl font-bold mb-4">How Your Gift Makes a Difference</h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Every contribution directly supports our community initiatives and spiritual programs.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6"
          >
            {[
              {
                icon: BookOpen,
                amount: 'KES 5,000',
                title: 'Student Support',
                desc: 'Supports one student for one month of school fees',
              },
              {
                icon: Heart,
                amount: 'KES 10,000',
                title: 'Healthcare Ministry',
                desc: 'Provides medical assistance to one family',
              },
              {
                icon: Users,
                amount: 'KES 15,000',
                title: 'Community Outreach',
                desc: 'Funds one community health screening event',
              },
              {
                icon: Zap,
                amount: 'KES 20,000',
                title: 'Skills Training',
                desc: 'Supports agricultural training for 10 farmers',
              },
            ].map((item, idx) => (
              <motion.div key={idx} variants={itemVariants}>
                <Card className="p-6 glass-panel tilt-card border-0">
                  <item.icon className="w-10 h-10 text-ember mb-4" />
                  <p className="text-sm font-mono font-semibold text-ember mb-2">{item.amount}</p>
                  <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Giving Methods */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="label-eyebrow mb-3">Choose What Works</p>
            <h2 className="text-4xl font-bold mb-4">Ways to Give</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose the giving method that works best for you.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 gap-8"
          >
            {[
              {
                title: 'Online Giving',
                description: 'Securely donate online using your credit card or mobile money.',
                methods: ['Credit Card', 'Debit Card', 'Mobile Money (M-Pesa)'],
              },
              {
                title: 'Bank Transfer',
                description: 'Transfer funds directly to our church bank account.',
                methods: ['Bank Name: Kenya Commercial Bank', 'Account: NICA Kibugu Parish', 'Branch: Embu'],
              },
              {
                title: 'In-Person Giving',
                description: 'Give during our Sunday worship services or special events.',
                methods: ['Sunday Offering', 'Monthly Giving', 'Special Projects'],
              },
              {
                title: 'Pledges & Sponsorships',
                description: 'Commit to supporting specific ministry projects or students.',
                methods: ['Student Sponsorship', 'Project Support', 'Monthly Pledge'],
              },
            ].map((method, idx) => (
              <motion.div key={idx} variants={itemVariants}>
                <Card className="p-8 glass-panel border-0">
                  <h3 className="text-2xl font-bold mb-3">{method.title}</h3>
                  <p className="text-muted-foreground mb-6">{method.description}</p>
                  <ul className="space-y-2">
                    {method.methods.map((m, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full bg-ember"></span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Giving CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <p className="label-eyebrow mb-3">Your Generosity Matters</p>
            <h2 className="text-4xl font-bold mb-6">Ready to Give?</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Your generosity transforms lives and strengthens our community. Thank you for your support!
            </p>
            <Button size="lg" className="bg-ember hover:bg-ember/90 text-ember-foreground font-semibold mb-6" onClick={() => setShowDonationForm(!showDonationForm)}>
              {showDonationForm ? 'Cancel' : 'Give Now'}
            </Button>
            {showDonationForm && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 max-w-2xl mx-auto"
              >
                <Card className="p-8 glass-panel border-0">
                  <h3 className="text-2xl font-bold mb-6">Make a Donation</h3>
                  <form onSubmit={handleDonationSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="donor-name" className="block text-sm font-medium mb-2">Full Name</label>
                        <input
                          id="donor-name"
                          type="text"
                          placeholder="Your name"
                          value={donationData.donorName}
                          onChange={(e) => setDonationData({ ...donationData, donorName: e.target.value })}
                          required
                          aria-required="true"
                          className="w-full px-4 py-2 rounded-lg bg-input/40 border border-border focus:border-ember focus:outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label htmlFor="donor-email" className="block text-sm font-medium mb-2">Email</label>
                        <input
                          id="donor-email"
                          type="email"
                          placeholder="your@email.com"
                          value={donationData.email}
                          onChange={(e) => setDonationData({ ...donationData, email: e.target.value })}
                          required
                          aria-required="true"
                          className="w-full px-4 py-2 rounded-lg bg-input/40 border border-border focus:border-ember focus:outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label htmlFor="donor-phone" className="block text-sm font-medium mb-2">M-Pesa Phone {donationData.method === 'mpesa' ? '(required)' : '(optional)'}</label>
                        <input id="donor-phone" type="tel" placeholder="0712345678" value={donationData.phone} required={donationData.method === 'mpesa'} onChange={(e) => setDonationData({ ...donationData, phone: e.target.value })} className="w-full px-4 py-2 rounded-lg bg-input/40 border border-border focus:border-ember focus:outline-none transition-colors" />
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="donation-amount" className="block text-sm font-medium mb-2">Amount ({donationData.currency})</label>
                        <input
                          id="donation-amount"
                          type="number"
                          placeholder="5000"
                          value={donationData.amount || ''}
                          onChange={(e) => setDonationData({ ...donationData, amount: parseInt(e.target.value) || 0 })}
                          required
                          aria-required="true"
                          className="w-full px-4 py-2 rounded-lg bg-input/40 border border-border focus:border-ember focus:outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label htmlFor="donation-currency" className="block text-sm font-medium mb-2">Currency</label>
                        <select id="donation-currency" value={donationData.currency} onChange={(e) => setDonationData({ ...donationData, currency: e.target.value as 'KES' | 'USD' })} className="w-full px-4 py-2 rounded-lg bg-input/40 border border-border focus:border-ember focus:outline-none transition-colors">
                          <option value="KES">KES</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="payment-method" className="block text-sm font-medium mb-2">Payment Method</label>
                        <select
                          id="payment-method"
                          value={donationData.method}
                          onChange={(e) => setDonationData({ ...donationData, method: e.target.value as 'mpesa' | 'paypal' | 'bank' | 'inperson' })}
                          aria-required="true"
                          className="w-full px-4 py-2 rounded-lg bg-input/40 border border-border focus:border-ember focus:outline-none transition-colors"
                        >
                          <option value="mpesa">M-Pesa</option>
                          <option value="paypal">PayPal</option>
                          <option value="bank">Bank Transfer</option>
                          <option value="inperson">In Person</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="donation-purpose" className="block text-sm font-medium mb-2">Purpose (Optional)</label>
                      <input
                        id="donation-purpose"
                        type="text"
                        placeholder="e.g., Student Support, Healthcare Ministry"
                        value={donationData.purpose}
                        onChange={(e) => setDonationData({ ...donationData, purpose: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg bg-input/40 border border-border focus:border-ember focus:outline-none transition-colors"
                      />
                    </div>
                    <Button type="submit" size="lg" className="w-full bg-ember hover:bg-ember/90 text-ember-foreground font-semibold" disabled={submitDonation.isPending}>
                      {submitDonation.isPending ? 'Processing...' : donationData.method === 'paypal' ? 'Continue to PayPal' : donationData.method === 'mpesa' ? 'Send M-Pesa Prompt' : 'Record Donation'}
                    </Button>
                  </form>
                </Card>
              </motion.div>
            )}
            <p className="text-sm text-muted-foreground">
              All donations are tax-deductible. We are a registered non-profit organization.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Transparency */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto glass-panel p-10 md:p-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <p className="label-eyebrow mb-3">Stewarding What's Given</p>
            <h2 className="text-3xl font-bold mb-4">Financial Transparency</h2>
            <p className="text-lg text-muted-foreground mb-8">
              We are committed to responsible stewardship of all donations. Our financial reports are available upon request.
            </p>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-ember/50 text-ember hover:bg-ember/10">
                Request Financial Report
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
