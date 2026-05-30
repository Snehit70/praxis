import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, BookOpen } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Editorial single-screen hero.
 *
 * Full-bleed clover background; an in-image top row (plain text, no bar);
 * headline + actions on the left, a feathered feature image on the right that
 * meshes into the background; the three program stages in a row below.
 *
 * Asset filenames contain spaces / apostrophes / unicode, which break plain ES
 * imports — so we resolve them through Vite's glob and look them up by name.
 */
const assetUrls = import.meta.glob("../assets/*", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const asset = (name: string): string => {
  const hit = Object.entries(assetUrls).find(([path]) => path.endsWith("/" + name));
  return hit?.[1] ?? "";
};

const IMG = {
  // Full-bleed background — a serene blue flower field at sunset, almost no
  // characters, so the feature image and text read cleanly on top of it.
  bg: asset("hero-flower-field.jpeg"),
  // Feature image on the right — Himmel; his soft sunlit-green bokeh shares the
  // field's tones, so it melts into the background.
  feature: asset("𝖧𝗂𝗆𝗆𝖾𝗅.jpeg"),
  // Stage portraits.
  frieren: asset("Frieren.jpeg"),
  fern: asset("Fern.jpeg"),
  himmel: asset("Himmel.jpeg"),
};

const stages = [
  { src: IMG.frieren, name: "Foundation", blurb: "Where it begins" },
  { src: IMG.fern, name: "Diploma", blurb: "Deeper still" },
  { src: IMG.himmel, name: "Degree", blurb: "The last stretch" },
];

export default function LandingPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Signed-in users have no use for the marketing hero — send them straight to
  // their dashboard. (Wait until Clerk has resolved to avoid a flicker.)
  if (isLoaded && isSignedIn) {
    return <Navigate to="/home" replace />;
  }

  // Staggered entrance: shared transition, offset by index.
  const enter = (i: number) => ({
    style: { transitionDelay: `${i * 110}ms` },
    className: cn(
      "transition-all duration-700 ease-out motion-reduce:transition-none",
      shown
        ? "translate-y-0 opacity-100"
        : "translate-y-4 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100",
    ),
  });

  return (
    <section className="relative isolate flex min-h-[100svh] w-full flex-col overflow-hidden text-white">
      {/* Background image + directional scrim (darker left for text legibility) */}
      <img
        src={IMG.bg}
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        className="animate-kenburns absolute inset-0 -z-10 h-full w-full object-cover object-center"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/45 to-black/20"
      />
      {/* Top scrim: keeps the nav legible over the brighter right side of the image */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-28 bg-gradient-to-b from-black/55 to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-gradient-to-t from-black/70 to-transparent"
      />

      {/* Top row — plain text, no bar / no boundary */}
      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12">
        <Link
          to="/"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <BookOpen className="size-5" />
          <span className="text-lg font-semibold tracking-tight">Praxis</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          {/* Signed-in users are redirected to the dashboard, so this header is
              effectively the signed-out marketing nav: browsing requires sign-in. */}
          <SignInButton mode="modal">
            <button type="button" className="text-white/80 transition-colors hover:text-white">
              Papers
            </button>
          </SignInButton>
          <SignInButton mode="modal">
            <button type="button" className="text-white/80 transition-colors hover:text-white">
              Archive
            </button>
          </SignInButton>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button
                type="button"
                className="font-medium text-white underline-offset-4 hover:underline"
              >
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
        </nav>
      </header>

      {/* Hero content — text pinned far left, feature image far right */}
      <div className="relative z-10 flex flex-1 items-center">
        <div className="flex w-full items-center justify-between gap-10 px-6 md:px-12 lg:px-20">
          {/* Left: copy + actions */}
          <div className="max-w-xl shrink-0">
            <p
              {...enter(0)}
              className={cn(
                enter(0).className,
                "mb-5 text-xs font-semibold uppercase tracking-[0.25em] text-white/80 drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]",
              )}
            >
              IITM BS · Exam Paper Archive
            </p>
            <h1
              {...enter(1)}
              className={cn(
                enter(1).className,
                "font-display text-balance text-5xl font-normal leading-[1.02] tracking-tight drop-shadow-[0_2px_16px_rgba(0,0,0,0.55)] sm:text-6xl md:text-7xl",
              )}
            >
              The exam is one day.{" "}
              <em className="italic text-white/95">The practice is the journey.</em>
            </h1>
            <p
              {...enter(2)}
              className={cn(
                enter(2).className,
                "mt-6 max-w-md text-pretty text-base leading-relaxed text-white/80 md:text-lg",
              )}
            >
              Every past paper of the IITM BS degree, gathered in one calm place.
              Sit them, review them, and arrive at the exam already ready.
            </p>
            <div
              {...enter(3)}
              className={cn(enter(3).className, "mt-8 flex flex-wrap items-center gap-3")}
            >
              {/* Everything past the front door needs an account, so the
                  primary action funnels into sign-in. */}
              <SignInButton mode="modal">
                <Button
                  type="button"
                  size="lg"
                  className="group shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 hover:brightness-110"
                >
                  Start practising
                  <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </Button>
              </SignInButton>
            </div>
          </div>

          {/* Right: feature image, large, heavily feathered so it melts into the field */}
          <div {...enter(2)} className={cn(enter(2).className, "hidden shrink-0 md:block md:-mr-6 lg:-mr-12")}>
            <img
              src={IMG.feature}
              alt=""
              aria-hidden="true"
              className="ml-auto aspect-square w-[34rem] object-cover object-center lg:w-[46rem] xl:w-[52rem]"
              style={{
                WebkitMaskImage:
                  "radial-gradient(ellipse 82% 90% at 55% 48%, #000 28%, transparent 76%)",
                maskImage:
                  "radial-gradient(ellipse 82% 90% at 55% 48%, #000 28%, transparent 76%)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Stage portraits — in a row below */}
      <div
        {...enter(4)}
        className={cn(enter(4).className, "relative z-10 px-6 pb-10 md:px-12")}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-4">
          <span className="text-xs uppercase tracking-[0.2em] text-white/60">
            Papers for every stage
          </span>
          {stages.map((s) => (
            <div key={s.name} className="flex items-center gap-3">
              <img
                src={s.src}
                alt={s.name}
                className="size-10 rounded-full border-2 border-white/30 object-cover object-top shadow-lg"
              />
              <div className="leading-tight">
                <div className="text-sm font-semibold">{s.name}</div>
                <div className="text-xs text-white/60">{s.blurb}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
