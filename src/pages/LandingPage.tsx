import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { SignInTrigger } from "@/components/auth/AuthDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PraxisBrand } from "@/components/PraxisBrand";
import { PageLoading } from "@/components/ui/page-loading";

/**
 * Hero: a single painted Frieren-style scene (Himmel + flower field at sunset)
 * with a gentle pointer/ambient parallax drift. The art keeps its left side calm
 * so the headline sits on it; scrims below guarantee text contrast.
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
  // Full hero scene (1672x941).
  hero: asset("hero-landing-v2.webp"),
  // Stage portraits.
  frieren: asset("Frieren.jpeg"),
  fern: asset("Fern.jpeg"),
  himmelStage: asset("Himmel.jpeg"),
};

const stages = [
  { src: IMG.frieren, name: "Foundation", blurb: "Where it begins" },
  { src: IMG.fern, name: "Diploma", blurb: "Deeper still" },
  { src: IMG.himmelStage, name: "Degree", blurb: "The last stretch" },
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export default function LandingPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(false);

  const rootRef = useRef<HTMLElement>(null);
  const target = useRef({ x: 0, y: 0 }); // pointer, normalised -1..1
  const cursorActive = useRef(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Single motion loop: smoothed pointer + slow ambient drift, written to CSS
  // custom properties that every layer reads. rAF naturally pauses on hidden
  // tabs; we bail entirely when the user prefers reduced motion.
  useEffect(() => {
    if (reduced) {
      rootRef.current?.style.setProperty("--px", "0");
      rootRef.current?.style.setProperty("--py", "0");
      return;
    }
    let raf = 0;
    const cur = { x: 0, y: 0 };
    const start = performance.now();
    const loop = (now: number) => {
      const t = (now - start) / 1000;
      cur.x += (target.current.x - cur.x) * 0.06;
      cur.y += (target.current.y - cur.y) * 0.06;
      const ax = Math.sin(t * 0.24) * 0.32;
      const ay = Math.cos(t * 0.18) * 0.22;
      const el = rootRef.current;
      if (el) {
        el.style.setProperty("--px", (cur.x + ax).toFixed(4));
        el.style.setProperty("--py", (cur.y + ay).toFixed(4));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  // Signed-in users have no use for the marketing hero — send them straight to
  // their dashboard. (Wait until Clerk has resolved to avoid a flicker.)
  if (!isLoaded) return <PageLoading label="Checking your session" />;
  if (isSignedIn) {
    return <Navigate to="/home" replace />;
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (reduced || e.pointerType !== "mouse") return;
    const r = rootRef.current?.getBoundingClientRect();
    if (!r) return;
    target.current.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    target.current.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    cursorActive.current = true;
  };

  // Depth helper: closer planes move more, opposite the cursor (diorama peek).
  const plane = (depth: number, extra = ""): React.CSSProperties => ({
    transform: `translate3d(calc(var(--px,0) * ${-depth}px), calc(var(--py,0) * ${-depth}px), 0) ${extra}`,
  });

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
    <section
      ref={rootRef}
      onPointerMove={onPointerMove}
      className="relative isolate flex min-h-[100svh] w-full flex-col overflow-hidden bg-[#0b0d1e] text-white [perspective:1000px]"
    >
      {/* ── Scene: one painted image. Desktop: full-bleed, anchored right, slightly
           oversized so parallax never reveals edges. Mobile: the whole 16:9 scene
           as a strip across the top (fading into the page) so Himmel and the
           castle stay in frame and the copy sits below on solid colour. ── */}
      <img
        src={IMG.hero}
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        style={plane(10, "scale(1.03)")}
        className="absolute inset-x-0 top-0 -z-30 h-auto w-full [mask-image:linear-gradient(to_bottom,#000_72%,transparent)] will-change-transform md:inset-0 md:h-full md:object-cover md:object-right md:[mask-image:none]"
      />

      {/* Scrims (own plane, no parallax): left for the headline, top for the
          nav, bottom for the stage row. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 hidden bg-gradient-to-r from-[#0b0d1e]/75 via-[#0b0d1e]/30 to-transparent md:block md:via-[#0b0d1e]/15"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-20 h-1/4 bg-gradient-to-b from-[#0b0d1e]/50 to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-20 h-1/3 bg-gradient-to-t from-[#0b0d1e]/70 to-transparent"
      />

      {/* ── Top row — logo only; every route past the front door needs an
           account, so "Start practising" below is the single entry point ── */}
      <header className="relative z-20 flex items-center px-6 py-5 md:px-12 md:py-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <PraxisBrand className="h-12 text-[#f1ead9]" />
        </Link>
      </header>

      {/* ── Mid plane: headline + actions, pinned left ── */}
      <div className="relative z-[2] flex flex-1 items-end pb-4 pt-[48vw] md:pb-8 md:pt-0" style={plane(13)}>
        <div className="w-full px-6 md:px-12 lg:px-20">
          <div className="max-w-xl">
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
                  primary action funnels into sign-in. Bespoke frosted-glass
                  treatment so it reads crafted against the cinematic scene
                  rather than a default-blue chip. */}
              <SignInTrigger>
                <Button
                  type="button"
                  size="lg"
                  className="squircle group h-11 gap-2.5 rounded-2xl border border-white/25 bg-white/10 px-7 text-[0.95rem] text-white shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/20"
                >
                  Start practising
                  <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </Button>
              </SignInTrigger>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stage portraits — in a row below ── */}
      <div
        {...enter(4)}
        className={cn(enter(4).className, "relative z-[2] px-6 pb-10 md:px-12")}
      >
        <div className="flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-4">
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
