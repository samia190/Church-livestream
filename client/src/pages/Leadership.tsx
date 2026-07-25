import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { ChevronLeft } from 'lucide-react';
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

export default function Leadership() {
  const leaders = [
    {
      name: 'Bishop Samuel Mwangi',
      title: 'Diocesan Bishop',
      bio: 'Leading the spiritual vision and pastoral care of Kibugu Parish with decades of ministry experience.',
      specialty: 'Spiritual Leadership',
    },
    {
      name: 'Rev. John Kimani',
      title: 'Senior Pastor',
      bio: 'Dedicated to preaching the Gospel and shepherding the congregation with compassion and wisdom.',
      specialty: 'Pastoral Care',
    },
    {
      name: 'Rev. Grace Njoki',
      title: 'Associate Pastor',
      bio: 'Committed to women ministry and community outreach programs across the parish.',
      specialty: 'Womens Ministry',
    },
    {
      name: 'Rev. Peter Omondi',
      title: 'Youth Pastor',
      bio: 'Empowering young people through spiritual formation and leadership development.',
      specialty: 'Youth Development',
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
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              <span className="text-glow">
                Church Leadership
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Meet the dedicated clergy and leaders serving N.I.C.A. Kibugu Parish with spiritual commitment and pastoral excellence.
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
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663779111251/22XNoSU8LuRfCuqftFgkdg/leadership-clergy-modern-JYAjC2yN36TTrjyN29GPjq.webp"
          alt="Church Leadership"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent"></div>
      </motion.div>

      {/* Leadership Grid */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 gap-8"
          >
            {leaders.map((leader, idx) => (
              <motion.div key={idx} variants={itemVariants}>
                <Card className="overflow-hidden glass-panel tilt-card border-0 h-full">
                  <div className="h-64 bg-gradient-to-br from-ember/20 to-primary/20 flex items-center justify-center">
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-ember to-primary flex items-center justify-center text-white text-4xl font-display font-bold glow-ring">
                      {leader.name.charAt(0)}
                    </div>
                  </div>
                  <div className="p-8">
                    <h3 className="text-2xl font-bold mb-2">{leader.name}</h3>
                    <p className="text-primary font-semibold mb-4">{leader.title}</p>
                    <p className="text-foreground mb-4 leading-relaxed">{leader.bio}</p>
                    <div className="pt-4 border-t border-border">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">Specialty:</span> {leader.specialty}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Ministry Departments */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="label-eyebrow mb-3">How We Serve</p>
            <h2 className="text-4xl font-bold mb-4">Ministry Departments</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our church is organized into various ministry departments, each serving specific community needs.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {[
              {
                title: 'Pastoral Care',
                desc: 'Hospital visitation, prayer support, and spiritual counseling for members in need.',
              },
              {
                title: 'Education Ministry',
                desc: 'Supporting student sponsorship, school fees, and youth talent development programs.',
              },
              {
                title: 'Healthcare Support',
                desc: 'Medical bill assistance and community health awareness initiatives.',
              },
              {
                title: 'Womens Fellowship',
                desc: 'Empowerment programs, community solidarity, and spiritual growth for women.',
              },
              {
                title: 'Youth Ministry',
                desc: 'Leadership development, spiritual formation, and youth engagement activities.',
              },
              {
                title: 'Community Outreach',
                desc: 'Economic empowerment, agricultural development, and social welfare initiatives.',
              },
            ].map((dept, idx) => (
              <motion.div key={idx} variants={itemVariants}>
                <Card className="p-6 glass-panel tilt-card border-0">
                  <h3 className="text-lg font-bold mb-3 text-primary">{dept.title}</h3>
                  <p className="text-muted-foreground">{dept.desc}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center glass-panel p-10 md:p-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <p className="label-eyebrow mb-3">We're Here For You</p>
            <h2 className="text-3xl font-bold mb-4">Connect With Our Leadership</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Have questions or need pastoral support? Contact us today.
            </p>
            <Link href="/contact">
              <Button size="lg" className="bg-ember hover:bg-ember/90 text-ember-foreground font-semibold">
                Get in Touch
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
