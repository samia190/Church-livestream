import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/watch-live', label: 'Watch Live' },
    { href: '/history', label: 'History' },
    { href: '/leadership', label: 'Leadership' },
    { href: '/sermons', label: 'Sermons' },
    { href: '/events', label: 'Events' },
    { href: '/community', label: 'Community' },
    { href: '/contact', label: 'Contact' },
    { href: '/prayer', label: 'Prayer' },
    { href: '/admin', label: 'Admin' },
  ];

  const menuVariants = {
    hidden: { opacity: 0, x: -300 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.3 },
    },
    exit: {
      opacity: 0,
      x: -300,
      transition: { duration: 0.2 },
    },
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  return (
    <>
      {/* Navigation Bar */}
      <nav className="fixed top-0 w-full z-50 bg-background/70 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex justify-between items-center">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <Link href="/" className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full glow-ring flex items-center justify-center overflow-hidden bg-card">
                <img src="/manus-storage/nica-logo_37f1174c.png" alt="NICA Logo" className="w-9 h-9 object-contain" />
              </div>
              <div>
                <h1 className="text-sm font-display font-semibold text-foreground tracking-tight">N.I.C.A. Kibugu</h1>
                <p className="label-eyebrow text-[0.6rem]">Nginda Parish</p>
              </div>
            </Link>
          </motion.div>

          {/* Desktop Navigation */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="hidden lg:flex items-center gap-7"
          >
            {navLinks.map((link) => {
              const isActive = location === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative text-sm font-medium transition-colors py-1 ${
                    link.label === 'Admin'
                      ? 'text-signal hover:text-signal/80'
                      : isActive
                        ? 'text-ember'
                        : 'text-foreground/80 hover:text-foreground'
                  }`}
                >
                  {link.label}
                  {isActive && link.label !== 'Admin' && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute left-0 right-0 -bottom-1 h-[2px] rounded-full bg-gradient-to-r from-ember to-primary"
                    />
                  )}
                </Link>
              );
            })}
          </motion.div>

          {/* Right Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex items-center gap-3"
          >
            <Link href="/give">
              <Button size="sm" className="bg-ember hover:bg-ember/90 text-ember-foreground hidden sm:inline-flex font-semibold">
                Give
              </Button>
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden p-2 hover:bg-accent/20 rounded-md transition-colors"
              aria-label="Toggle menu"
            >
              {isOpen ? (
                <X className="w-6 h-6 text-foreground" />
              ) : (
                <Menu className="w-6 h-6 text-foreground" />
              )}
            </button>
          </motion.div>
        </div>
      </nav>

      {/* Mobile Side Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay */}
            <motion.div
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-void/70 backdrop-blur-sm z-40 lg:hidden"
              transition={{ duration: 0.3 }}
            />

            {/* Side Menu */}
            <motion.div
              variants={menuVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed left-0 top-0 h-full w-72 glass-panel border-r border-border z-40 lg:hidden overflow-y-auto rounded-none"
            >
              {/* Menu Header */}
              <div className="p-6 border-b border-border flex justify-between items-center">
                <h2 className="text-lg font-display font-semibold text-foreground">Menu</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-accent/20 rounded-md transition-colors"
                >
                  <X className="w-5 h-5 text-foreground" />
                </button>
              </div>

              {/* Menu Items */}
              <div className="p-6 space-y-1">
                {navLinks.map((link) => {
                  const isActive = location === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      className={`block px-4 py-3 rounded-md transition-colors ${
                        link.label === 'Admin'
                          ? 'bg-signal/15 text-signal font-semibold'
                          : isActive
                            ? 'bg-primary/15 text-ember font-semibold'
                            : 'text-foreground hover:bg-accent/15'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>

              {/* Mobile Give Button */}
              <div className="p-6 border-t border-border">
                <Link href="/give" onClick={() => setIsOpen(false)}>
                  <Button className="w-full bg-ember hover:bg-ember/90 text-ember-foreground font-semibold">
                    Give Now
                  </Button>
                </Link>
              </div>

              {/* Footer Info */}
              <div className="p-6 border-t border-border text-xs text-muted-foreground space-y-2 font-mono">
                <p>National Independence Church of Africa</p>
                <p>Kibugu, Nginda Parish</p>
                <p>+254 700 000 000</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
