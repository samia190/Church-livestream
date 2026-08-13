import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Menu, X, Radio } from 'lucide-react';
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

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const menuVariants: Record<string, any> = {
    hidden: { opacity: 0, x: -300 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
    },
    exit: {
      opacity: 0,
      x: -300,
      transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
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
      <nav className="fixed top-0 left-0 right-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-border safe-area-top">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex justify-between items-center">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2 sm:gap-3"
          >
            <Link href="/" className="flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-11 sm:h-11 md:w-[30px] md:h-[30px] rounded-full glow-ring flex items-center justify-center overflow-hidden bg-card shrink-0">
                <img 
                  src="/logo/logo.png" 
                  alt="NICA Logo" 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src = "https://ui-avatars.com/api/?name=NICA&background=0a0714&color=f59e0b";
                  }}
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-sm font-display font-semibold text-foreground tracking-tight truncate">N.I.C.A. Kibugu</h1>
                <p className="label-eyebrow text-[0.5rem] sm:text-[0.6rem]">Nginda Parish</p>
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
            className="flex items-center gap-2 sm:gap-3"
          >
            {/* Quick Live Button - visible on all sizes */}
            <Link href="/watch-live" className="hidden md:block">
              <Button size="sm" variant="ghost" className="text-primary hover:text-primary/80 gap-1.5 font-semibold">
                <Radio className="w-3.5 h-3.5" />
                <span>Live</span>
              </Button>
            </Link>
            
            <Link href="/give">
              <Button size="sm" className="bg-ember hover:bg-ember/90 text-ember-foreground hidden sm:inline-flex font-semibold">
                Give
              </Button>
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden flex items-center justify-center w-10 h-10 hover:bg-accent/20 rounded-lg transition-colors -mr-1"
              aria-label="Toggle menu"
              aria-expanded={isOpen}
            >
              {isOpen ? (
                <X className="w-5 h-5 text-foreground" />
              ) : (
                <Menu className="w-5 h-5 text-foreground" />
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
            />

            {/* Side Menu */}
            <motion.div
              variants={menuVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed left-0 top-0 h-full w-[280px] sm:w-72 glass-panel border-r border-border z-50 lg:hidden overflow-y-auto rounded-none safe-area-left safe-area-bottom"
            >
              {/* Menu Header */}
              <div className="p-4 sm:p-6 border-b border-border flex justify-between items-center">
                <h2 className="text-base sm:text-lg font-display font-semibold text-foreground">Menu</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center w-9 h-9 hover:bg-accent/20 rounded-lg transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5 text-foreground" />
                </button>
              </div>

              {/* Menu Items */}
              <div className="p-3 sm:p-6 space-y-0.5 sm:space-y-1">
                {navLinks.map((link) => {
                  const isActive = location === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-lg transition-colors min-h-[44px] ${
                        link.label === 'Admin'
                          ? 'bg-signal/15 text-signal font-semibold'
                          : isActive
                            ? 'bg-primary/15 text-ember font-semibold'
                            : 'text-foreground hover:bg-accent/15'
                      }`}
                    >
                      <span className="text-sm font-medium">{link.label}</span>
                      {isActive && link.label !== 'Admin' && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-ember" />
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Mobile Give Button */}
              <div className="p-4 sm:p-6 border-t border-border">
                <Link href="/give" onClick={() => setIsOpen(false)}>
                  <Button className="w-full bg-ember hover:bg-ember/90 text-ember-foreground font-semibold h-12">
                    Give Now
                  </Button>
                </Link>
              </div>

              {/* Footer Info */}
              <div className="p-4 sm:p-6 border-t border-border text-xs text-muted-foreground space-y-1.5 font-mono">
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
