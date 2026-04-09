import { Outlet, Link } from "react-router-dom";
import { BookOpen, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { useEffect, useState } from "react";

export default function RootLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    logger.info('RootLayout mounted');
    return () => {
      logger.debug('RootLayout unmounted');
    };
  }, []);

  const handleNavClick = (destination: string) => {
    logger.info('Navigation clicked', { destination });
    setMobileMenuOpen(false);
  };

  const handleMenuClick = () => {
    logger.info('Mobile menu button clicked', { open: !mobileMenuOpen });
    setMobileMenuOpen((current) => !current);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="container mx-auto flex h-18 items-center justify-between px-4 md:px-8">
          <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <BookOpen className="h-5 w-5 text-primary" />
            </span>
            <span>Praxis</span>
            <span className="hidden rounded-full bg-accent px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-foreground sm:inline-flex">
              IITM Archive
            </span>
          </Link>
          
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <Link to="/" className="hover:text-foreground transition-colors" onClick={() => handleNavClick('home')}>Home</Link>
            <Link to="/exam/quiz1" className="hover:text-foreground transition-colors" onClick={() => handleNavClick('exams')}>Exams</Link>
            <Link to="/#exam-grid" className="hover:text-foreground transition-colors" onClick={() => handleNavClick('browse')}>Browse Papers</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={handleMenuClick} aria-label="Toggle menu">
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Button size="sm" asChild className="rounded-full px-5">
              <Link to="/exam/quiz1" onClick={() => handleNavClick('get-started')}>Get Started</Link>
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-border/80 bg-card/95 md:hidden">
            <nav className="container mx-auto flex flex-col gap-3 px-4 py-4 text-sm font-medium">
              <Link to="/" className="rounded-xl px-3 py-2 hover:bg-secondary hover:text-primary transition-colors" onClick={() => handleNavClick('home')}>Home</Link>
              <Link to="/exam/quiz1" className="rounded-xl px-3 py-2 hover:bg-secondary hover:text-primary transition-colors" onClick={() => handleNavClick('exams')}>Exams</Link>
              <Link to="/#exam-grid" className="rounded-xl px-3 py-2 hover:bg-secondary hover:text-primary transition-colors" onClick={() => handleNavClick('browse')}>Browse Papers</Link>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 md:px-8 md:py-10">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-border/80 bg-card/60 py-6 md:py-0">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:h-24 md:flex-row md:px-8">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Praxis helps IITM BS students practice across real quiz and exam paper archives, with local-first access for faster, more reliable study sessions.
          </p>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Based on [notion] in [DESIGN.md]
          </p>
        </div>
      </footer>
    </div>
  );
}
