import { Outlet, Link, useLocation } from "react-router-dom";
import { UserRound } from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { SignInTrigger } from "@/components/auth/AuthDialog";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { useEffect } from "react";
import { BOOKMARKS_ENABLED } from "@/lib/featureFlags";
import { PraxisBrand } from "@/components/PraxisBrand";

export default function RootLayout() {
  // The landing and dashboard routes are self-contained, full-bleed heroes: each
  // renders its own in-image top row (Praxis + account) and manages its own
  // layout, so we drop the global chrome (header, footer, centered container)
  // there. Every other route keeps it.
  const { pathname } = useLocation();
  const bare = pathname === "/" || pathname === "/home";
  // The exam-taking page uses a question + navigator layout that should span
  // the full viewport width rather than the narrower centered reading column.
  const fullBleed = pathname.startsWith("/paper/") || pathname.includes("/course/");

  useEffect(() => {
    logger.info("RootLayout mounted");
    return () => {
      logger.debug("RootLayout unmounted");
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {!bare && (
        <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="container mx-auto flex h-14 items-center px-4 md:px-8">
            <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              <PraxisBrand nameClassName="text-foreground" />
            </Link>
            <nav className="ml-auto flex items-center gap-4">
              <SignedIn>
                {BOOKMARKS_ENABLED && (
                  <Link
                    to="/saved"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Saved papers
                  </Link>
                )}
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <UserRound className="h-4 w-4" />
                  Profile
                </Link>
                <UserButton afterSignOutUrl="/" userProfileMode="navigation" userProfileUrl="/profile" />
              </SignedIn>
              <SignedOut>
                <SignInTrigger>
                  <Button size="sm" variant="outline">Sign in</Button>
                </SignInTrigger>
              </SignedOut>
            </nav>
          </div>
        </header>
      )}

      <main className="flex-1">
        {bare ? (
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

      {!bare && (
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
