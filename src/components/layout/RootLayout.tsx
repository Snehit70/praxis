import { Outlet, Link, useLocation } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { useEffect } from "react";

export default function RootLayout() {
  // The landing route is a self-contained, full-bleed hero: it renders its own
  // in-image top row and fills the viewport, so we drop the chrome (header,
  // footer, centered container) there. Every other route keeps it.
  const { pathname } = useLocation();
  const onLanding = pathname === "/";
  // The exam-taking page uses a question + navigator layout that should span
  // the full viewport width rather than the narrower centered reading column.
  const fullBleed = pathname.startsWith("/paper/");

  useEffect(() => {
    logger.info("RootLayout mounted");
    return () => {
      logger.debug("RootLayout unmounted");
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {!onLanding && (
        <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="container mx-auto flex h-14 items-center px-4 md:px-8">
            <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">Praxis</span>
            </Link>
            <nav className="ml-auto flex items-center gap-4">
              <SignedIn>
                <Link
                  to="/saved"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Saved
                </Link>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <Button size="sm" variant="outline">Sign in</Button>
                </SignInButton>
              </SignedOut>
            </nav>
          </div>
        </header>
      )}

      <main className="flex-1">
        {onLanding ? (
          <Outlet />
        ) : (
          <div
            className={
              fullBleed
                ? "w-full px-4 py-8 md:px-8 md:py-10"
                : "container mx-auto px-4 py-8 md:px-8 md:py-10"
            }
          >
            <Outlet />
          </div>
        )}
      </main>

      {!onLanding && (
        <footer className="border-t border-border py-5">
          <div className="container mx-auto px-4 md:px-8">
            <p className="text-sm text-muted-foreground">
              Praxis — IITM BS exam paper archive
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
