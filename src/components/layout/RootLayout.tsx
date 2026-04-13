import { Outlet, Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { logger } from "@/lib/logger";
import { useEffect } from "react";

export default function RootLayout() {
  useEffect(() => {
    logger.info('RootLayout mounted');
    return () => {
      logger.debug('RootLayout unmounted');
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex h-14 items-center px-4 md:px-8">
          <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Praxis</span>
          </Link>
        </div>
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
