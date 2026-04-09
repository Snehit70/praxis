import { Outlet, Link, useLocation } from "react-router-dom";
import { BookOpen, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { useEffect, useState } from "react";

export default function RootLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    logger.info('RootLayout mounted');
    return () => {
      logger.debug('RootLayout unmounted');
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleMenuClick = () => {
    setMobileMenuOpen((current) => !current);
  };

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/exam/quiz1", label: "Quiz 1" },
    { to: "/exam/quiz2", label: "Quiz 2" },
    { to: "/exam/end-term", label: "End Term" },
    { to: "/exam/oppe", label: "OPPE" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 md:px-8">
          <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Praxis</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <Button variant="ghost" size="icon" className="md:hidden" onClick={handleMenuClick} aria-label="Toggle menu">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-border bg-background md:hidden">
            <nav className="container mx-auto flex flex-col px-4 py-2">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 md:px-8 md:py-10">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-border py-5">
        <div className="container mx-auto px-4 md:px-8">
          <p className="text-sm text-muted-foreground">
            Praxis — IITM BS exam paper archive
          </p>
        </div>
      </footer>
    </div>
  );
}
