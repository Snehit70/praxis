import { Outlet, Link, useLocation } from "react-router-dom";
import { UserRound } from "lucide-react";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { AccountButton } from "@/components/auth/AccountButton";
import { SignInTrigger } from "@/components/auth/AuthDialog";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { useEffect } from "react";
import { BOOKMARKS_ENABLED } from "@/lib/featureFlags";
import { PraxisBrand } from "@/components/PraxisBrand";
import navStrip from "@/assets/nav-meteors.webp";
import footerField from "@/assets/footer-field.webp";
import dayScene from "@/assets/profile-day.webp";
import { cn } from "@/lib/utils";

export default function RootLayout() {
  // The landing and dashboard routes are self-contained, full-bleed heroes: each
  // renders its own in-image top row (Praxis + account) and manages its own
  // layout, so we drop the global chrome (header, footer, centered container)
  // there. Every other route keeps it.
  const { pathname } = useLocation();
  const bare = pathname === "/" || pathname === "/home";
  // The exam-taking page uses a question + navigator layout that should span
  // the full viewport width rather than the narrower centered reading column.
  const fullBleed = pathname.startsWith("/paper/");
  // Profile keeps the global header but draws its own edge-to-edge banner.
  const flush = pathname === "/profile";
  // Course and paper pages draw their own fixed scene, so the header turns to
  // glass over it and the footer drops its painted field, like the profile.
  const glass = flush || fullBleed || pathname.includes("/course/");

  useEffect(() => {
    logger.info("RootLayout mounted");
    return () => {
      logger.debug("RootLayout unmounted");
    };
  }, []);

  return (
    <div className="relative isolate flex min-h-screen flex-col bg-background text-foreground">
      {/* Flush pages sit inside one continuous scene: open daytime sky from
          behind the header down to the party, horizon and field under the footer. */}
      {flush && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <img
            src={dayScene}
            alt=""
            className="h-full w-full object-cover object-bottom"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-transparent" />
        </div>
      )}
      {!bare && (
        <header
          className={cn(
            "sticky top-0 z-50 overflow-hidden",
            glass
              ? "bg-black/20 backdrop-blur-md"
              : "border-b border-white/10 bg-background",
          )}
        >
          {/* Painted strip: the Era Meteor Shower over a nemophila field, shown
              near full strength; only the logo and account ends get a soft scrim.
              Scene pages draw their own backdrop behind the header, so they skip it. */}
          {!glass && (
            <>
              <img
                src={navStrip}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[50%_32%]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/45 via-transparent to-black/45"
              />
            </>
          )}
          <div className="container relative mx-auto flex h-14 items-center px-4 md:px-8">
            <Link
              to="/"
              className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
            >
              <PraxisBrand className="text-[#f1ead9]" />
            </Link>
            <nav className="ml-auto flex items-center gap-4">
              <SignedIn>
                {BOOKMARKS_ENABLED && (
                  <Link
                    to="/saved"
                    className="text-sm font-medium text-white/90 transition-colors hover:text-white"
                  >
                    Saved papers
                  </Link>
                )}
                {/* No self-link while already on the profile. */}
                {pathname !== "/profile" && (
                  <Link
                    to="/profile"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-white/90 transition-colors hover:text-white"
                  >
                    <UserRound className="h-4 w-4" />
                    Profile
                  </Link>
                )}
                <AccountButton />
              </SignedIn>
              <SignedOut>
                <SignInTrigger>
                  <Button size="sm" variant="outline">
                    Sign in
                  </Button>
                </SignInTrigger>
              </SignedOut>
            </nav>
          </div>
        </header>
      )}

      <main className="flex-1">
        {bare || flush ? (
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
        <footer className="relative isolate overflow-hidden">
          {/* The road ends in a flower field at dusk, rising out of the page.
              Scene pages already end on their own ground. */}
          {!glass && (
            <>
              <img
                src={footerField}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover object-[50%_72%] opacity-75 [mask-image:linear-gradient(to_bottom,transparent,#000_65%)]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-background/70 via-transparent to-transparent"
              />
            </>
          )}
          <div
            className={cn(
              "container mx-auto px-4 pb-6 md:px-8",
              glass ? "pt-8" : "pt-36 md:pt-48",
            )}
          >
            <p className="text-sm text-white/80 [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
              Praxis · IITM BS exam paper archive
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
