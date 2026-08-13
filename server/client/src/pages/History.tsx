import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { ChevronLeft, BookOpen, Users, MapPin, Award } from 'lucide-react';
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

export default function History() {
  return (
    <div className="min-h-screen text-foreground">
      <Navigation />
      {/* Header */}
      <div className="pt-24 pb-12 px-4 orbit-grid border-b border-border">
        <div className="max-w-4xl mx-auto">
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
            <p className="label-eyebrow mb-3">Since the Independence Era</p>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-4">
              <span className="text-glow">
                Our History & Heritage
              </span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
              Rooted in the Mau Mau era, the National Independence Church of Africa carries a legacy of spiritual leadership and community transformation.
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
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663779111251/22XNoSU8LuRfCuqftFgkdg/history-mau-mau-heritage-SzSLme4mBZ8R29GAEgp2D9.webp"
          alt="Mau Mau Era Heritage"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent"></div>
      </motion.div>

      {/* Main Content */}
      <section className="py-12 sm:py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="space-y-12"
          >
            {/* Executive Summary */}
            <motion.div variants={itemVariants}>
              <h2 className="text-3xl font-bold mb-6">Historical Significance</h2>
              <Card className="p-8 glass-panel border-0">
                <p className="text-lg text-foreground leading-relaxed mb-4">
                  Kibugu Parish stands as one of the most historically significant NICA parishes in Kenya. Established during the Mau Mau era, it represents the earliest wave of African independent churches that emerged from the independence movement.
                </p>
                <p className="text-lg text-foreground leading-relaxed">
                  The parish was selected by academic researchers as a representative case study due to its unique historical importance within NICA's founding narrative and its role in establishing African spiritual leadership.
                </p>
              </Card>
            </motion.div>

            {/* Key Milestones */}
            <motion.div variants={itemVariants}>
              <h2 className="text-3xl font-bold mb-6">Key Historical Milestones</h2>
              <div className="space-y-4">
                {[
                  {
                    year: 'Mau Mau Era',
                    title: 'First NICA Parish Established',
                    desc: 'Kibugu Parish was among the earliest NICA parishes established by Africans in Embu during the Mau Mau period, reflecting the movement for African independence and indigenous church leadership.',
                  },
                  {
                    year: 'Post-Separation',
                    title: 'Embu as NICA Headquarters',
                    desc: 'Following the separation from AIPC, Embu became the first administrative center of NICA. Bishop Willie Nyaga was ordained as the first NICA bishop by Rt. Rev. Maina at Gichene.',
                  },
                  {
                    year: 'Expansion',
                    title: 'National Growth',
                    desc: 'As NICA expanded nationally, the headquarters relocated to Nairobi. However, Kibugu Parish remained a cornerstone of the movement in Embu County.',
                  },
                  {
                    year: 'Present',
                    title: 'Continued Ministry',
                    desc: 'Today, Kibugu Parish continues its mission of spiritual leadership and community transformation, serving approximately 2,700 members across 8 parishes in Embu North Sub-County.',
                  },
                ].map((milestone, idx) => (
                  <motion.div
                    key={idx}
                    whileHover={{ x: 8 }}
                    className="relative pl-8 pb-8 border-l-2 border-ember/40 last:pb-0"
                  >
                    <div className="absolute -left-[7px] top-0 w-3.5 h-3.5 rounded-full bg-ember glow-ring"></div>
                    <div className="glass-panel border-0 rounded-lg p-6">
                      <p className="label-eyebrow text-ember mb-1">{milestone.year}</p>
                      <h3 className="text-xl font-bold mb-2">{milestone.title}</h3>
                      <p className="text-muted-foreground">{milestone.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* AIPC-NICA Connection */}
            <motion.div variants={itemVariants}>
              <h2 className="text-3xl font-bold mb-6">The AIPC-NICA Connection</h2>
              <Card className="p-8 glass-panel border-0">
                <p className="text-lg text-foreground leading-relaxed mb-4">
                  NICA emerged from the broader African independent church movement that sought African leadership, indigenous worship, self-governance, and freedom from missionary control. The African Independent Pentecostal Church (AIPC) was among the most organized African independent churches in colonial Kenya.
                </p>
                <p className="text-lg text-foreground leading-relaxed mb-4">
                  Kibugu Parish carries this legacy of independence and community-led education, maintaining the values that defined the original movement.
                </p>
                <div className="grid md:grid-cols-2 gap-4 mt-6">
                  {[
                    { icon: Users, label: 'African Leadership', value: 'Self-governed parishes' },
                    { icon: BookOpen, label: 'Indigenous Education', value: 'Community schools' },
                    { icon: Award, label: 'Spiritual Independence', value: 'African worship traditions' },
                    { icon: MapPin, label: 'Local Roots', value: 'Community-centered ministry' },
                  ].map((item, idx) => (
                    <div key={idx} className="bg-void/40 border border-border/40 rounded-lg p-4 flex items-start gap-4">
                      <item.icon className="w-6 h-6 text-ember flex-shrink-0 mt-1" />
                      <div>
                        <p className="font-bold text-sm">{item.label}</p>
                        <p className="text-sm text-muted-foreground">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Geographic Context */}
            <motion.div variants={itemVariants}>
              <h2 className="text-3xl font-bold mb-6">Geographic & Economic Context</h2>
              <Card className="p-8 glass-panel border-0">
                <p className="text-lg text-foreground leading-relaxed mb-4">
                  Kibugu is located on the eastern slopes of Mount Kenya within Embu County, characterized by fertile volcanic soils and a mixed farming economy. The region is known for coffee cultivation, dairy farming, banana farming, and tea production.
                </p>
                <p className="text-lg text-foreground leading-relaxed">
                  Agriculture remains the primary economic activity for many church members, shaping the community's needs and the church's ministry focus on economic empowerment and agricultural development.
                </p>
              </Card>
            </motion.div>

            {/* NICA Presence */}
            <motion.div variants={itemVariants}>
              <h2 className="text-3xl font-bold mb-6">NICA Presence in Embu</h2>
              <Card className="p-8 glass-panel border-0">
                <p className="text-lg text-foreground leading-relaxed mb-6">
                  Research identified approximately 8 NICA parishes in Embu North Sub-County, collectively serving approximately 2,700 members:
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    'Mwamba Imara',
                    'Manyatta',
                    'Kavutiri',
                    'Kibugu',
                    'Kirigi',
                    'Gicherori',
                    'Kiriari',
                    'Kairuri',
                  ].map((parish, idx) => (
                    <div key={idx} className="bg-void/40 border border-border/40 rounded-lg p-4 flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-ember"></div>
                      <p className="font-medium">{parish}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* First Bishop */}
            <motion.div variants={itemVariants}>
              <h2 className="text-3xl font-bold mb-6">First NICA Bishop</h2>
              <Card className="p-8 glass-panel border-0">
                <p className="text-lg text-foreground leading-relaxed mb-4">
                  <span className="font-bold">Bishop Willie Nyaga</span> was ordained as the first NICA bishop following the separation from AIPC. The ordination was conducted by Rt. Rev. Maina at Gichene in Embu.
                </p>
                <p className="text-lg text-foreground leading-relaxed">
                  This historic ordination connected Kibugu directly to NICA's founding story and established the parish as a center of spiritual authority and leadership in the movement.
                </p>
              </Card>
            </motion.div>

            {/* Legacy */}
            <motion.div variants={itemVariants}>
              <h2 className="text-3xl font-bold mb-6">Our Continuing Legacy</h2>
              <Card className="p-8 glass-panel border-0">
                <p className="text-lg text-foreground leading-relaxed mb-4">
                  Kibugu Parish preserves and continues the legacy of the Mau Mau era independence movement through:
                </p>
                <ul className="space-y-3 text-foreground">
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold mt-1">✓</span>
                    <span><span className="font-bold">Education Support:</span> Sponsoring students, supporting school fees, and nurturing youth talent</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold mt-1">✓</span>
                    <span><span className="font-bold">Healthcare Ministry:</span> Hospital visitation, prayer support, and medical bill assistance</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold mt-1">✓</span>
                    <span><span className="font-bold">Social Support:</span> Assisting vulnerable families and providing pastoral care</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold mt-1">✓</span>
                    <span><span className="font-bold">Economic Empowerment:</span> Modern farming seminars and skills development initiatives</span>
                  </li>
                </ul>
              </Card>
            </motion.div>
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
            <p className="label-eyebrow mb-3">Carry the Legacy Forward</p>
            <h2 className="text-3xl font-bold mb-4">Join Our Community</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Be part of our continuing mission of spiritual growth and community transformation.
            </p>
            <Link href="/events">
              <Button size="lg" className="bg-ember hover:bg-ember/90 text-ember-foreground font-semibold">
                Attend a Service
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
