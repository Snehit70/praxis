import { Outlet, Link } from "react-router-dom";
import { BookOpen, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { useEffect } from "react";

export default function RootLayout() {
  useEffect(() => {
    logger.info('RootLayout mounted');
    return () => {
      logger.debug('RootLayout unmounted');
    };
  }, []);

  const handleNavClick = (destination: string) => {
    logger.info('Navigation clicked', { destination });
  };

  const handleSignInClick = () => {
    logger.info('Sign In button clicked');
  };

  const handleGetStartedClick = () => {
    logger.info('Get Started button clicked');
  };

  const handleMenuClick = () => {
    logger.info('Mobile menu button clicked');
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl tracking-tight hover:opacity-80 transition-opacity">
            <BookOpen className="h-6 w-6 text-primary" />
            <span>Praxis</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors" onClick={() => handleNavClick('home')}>Home</Link>
            <Link to="/exam/quiz1" className="hover:text-foreground transition-colors" onClick={() => handleNavClick('exams')}>Exams</Link>
            <Link to="/exam/quiz1" className="hover:text-foreground transition-colors" onClick={() => handleNavClick('practice')}>Practice</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={handleMenuClick}>
              <Menu className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="sm" className="hidden md:flex gap-2" onClick={handleSignInClick}>
              <User className="h-4 w-4" />
              <span>Sign In</span>
            </Button>
            <Button size="sm" onClick={handleGetStartedClick}>Get Started</Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 md:px-8 py-8">
          <Outlet />
        </div>
      </main>

      <footer className="border-t py-6 md:py-0">
        <div className="container mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4 md:h-24">
          <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built by <a href="#" className="font-medium underline underline-offset-4">Praxis Team</a>. 
            The source code is available on <a href="#" className="font-medium underline underline-offset-4">GitHub</a>.
          </p>
        </div>
      </footer>
    </div>
  );
}
