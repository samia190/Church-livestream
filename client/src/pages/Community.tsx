import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { ChevronLeft, BookOpen, Heart, Users, Sprout } from 'lucide-react';
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

export default function Community() {
  const projects = [
    {
      icon: BookOpen,
      title: 'Education Support Program',
      description: 'Sponsoring students, supporting school fees, and nurturing youth talent through scholarships and mentorship.',
      impact: '150+ students supported',
      color: 'from-primary to-signal',
    },
    {
      icon: Heart,
      title: 'Healthcare Ministry',
      description: 'Hospital visitation, prayer support, and medical bill assistance for vulnerable community members.',
      impact: '500+ families assisted',
      color: 'from-ember to-primary',
    },
    {
      icon: Users,
      title: 'Social Welfare Support',
      description: 'Assisting vulnerable families with food, shelter, and pastoral care during difficult times.',
      impact: '200+ families supported',
      color: 'from-signal to-primary',
    },
    {
      icon: Sprout,
      title: 'Economic Empowerment',
      description: 'Modern farming seminars, skills development initiatives, and agricultural training programs.',
      impact: '300+ farmers trained',
      color: 'from-primary to-ember',
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
                Community Projects
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Discover how N.I.C.A. Kibugu Parish is transforming lives through education, healthcare, and economic empowerment.
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
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663779111251/22XNoSU8LuRfCuqftFgkdg/community-projects-education-aPchyA3UABxyLntQymxaeB.webp"
          alt="Community Projects"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent"></div>
      </motion.div>

      {/* Projects Grid */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 gap-8"
          >
            {projects.map((project, idx) => (
              <motion.div key={idx} variants={itemVariants}>
                <Card className="overflow-hidden glass-panel tilt-card border-0 h-full">
                  <div className={`h-32 bg-gradient-to-r ${project.color} opacity-20`}></div>
                  <div className="p-8 -mt-12 relative">
                    <div className={`w-16 h-16 rounded-lg bg-gradient-to-br ${project.color} flex items-center justify-center mb-6 shadow-lg glow-ring`}>
                      <project.icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">{project.title}</h3>
                    <p className="text-muted-foreground mb-6 leading-relaxed">{project.description}</p>
                    <div className="pt-6 border-t border-border">
                      <p className="text-sm font-semibold text-ember">{project.impact}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Impact Statistics */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="label-eyebrow mb-3">By The Numbers</p>
            <h2 className="text-4xl font-bold mb-4">Our Community Impact</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Through dedicated service and community partnership, we continue to make a measurable difference.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid md:grid-cols-4 gap-6"
          >
            {[
              { number: '2,700+', label: 'Community Members' },
              { number: '150+', label: 'Students Sponsored' },
              { number: '500+', label: 'Families Assisted' },
              { number: '300+', label: 'Farmers Trained' },
            ].map((stat, idx) => (
              <motion.div key={idx} variants={itemVariants} className="tilt-card">
                <Card className="p-8 glass-panel border-0 text-center">
                  <p className="text-4xl font-display font-bold text-ember mb-2">{stat.number}</p>
                  <p className="text-muted-foreground">{stat.label}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Get Involved */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto glass-panel p-10 md:p-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <p className="label-eyebrow mb-3">Every Contribution Matters</p>
            <h2 className="text-4xl font-bold mb-6">Get Involved</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Your support and involvement can make a real difference in our community. Whether through volunteering, donations, or prayer, every contribution matters.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/give">
                <Button size="lg" className="bg-ember hover:bg-ember/90 text-ember-foreground font-semibold">
                  Support Our Mission
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline" className="border-primary/50 hover:bg-primary/10">
                  Volunteer With Us
                </Button>
              </Link>
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
            <p className="label-eyebrow mb-3">Be Part of the Story</p>
            <h2 className="text-3xl font-bold mb-4">Join Our Mission</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Together, we can create lasting change in our community and beyond.
            </p>
            <Link href="/prayer">
              <Button size="lg" className="bg-ember hover:bg-ember/90 text-ember-foreground font-semibold">
                Submit a Prayer Request
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
