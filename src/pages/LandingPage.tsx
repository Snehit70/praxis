import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, BookOpen } from "lucide-react";
import { SignedIn, SignedOut, UserButton, useAuth } from "@clerk/clerk-react";
import { SignInTrigger } from "@/components/auth/AuthDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Cinematic, layered-parallax hero.
 *
 * Four depth planes — flower field (back), headline (mid), a cut-out Himmel
 * (front, overlapping the headline's right edge), and sparse light motes
 * (frontmost) — each translated by a depth-scaled amount. Motion is driven by a
 * single rAF loop combining a smoothed pointer offset with a slow ambient
 * drift, so the scene feels alive on touch / before the mouse moves, and the
 * whole thing is disabled under prefers-reduced-motion.
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
  // Back plane: the serene blue flower field at sunset.
  bg: asset("hero-flower-field.jpeg"),
  // Front plane: Himmel, matted to alpha (birefnet) and exported as webp.
  himmel: asset("himmel-hero.webp"),
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

// Sparse, frontmost light motes. Fixed config (module-level) so positions are
// stable across renders. Kept deliberately few so the scene reads calm.
const motes = [
  { left: "14%", top: "30%", size: 7, dur: 13, delay: 0, op: 0.5 },
  { left: "22%", top: "62%", size: 5, dur: 16, delay: 2.5, op: 0.4 },
  { left: "34%", top: "44%", size: 9, dur: 18, delay: 5, op: 0.55 },
  { left: "44%", top: "72%", size: 6, dur: 14, delay: 1.2, op: 0.45 },
  { left: "57%", top: "26%", size: 8, dur: 17, delay: 3.8, op: 0.5 },
  { left: "66%", top: "58%", size: 5, dur: 15, delay: 6.5, op: 0.4 },
  { left: "73%", top: "38%", size: 10, dur: 19, delay: 2, op: 0.5 },
  { left: "84%", top: "66%", size: 6, dur: 16, delay: 4.5, op: 0.45 },
  { left: "90%", top: "30%", size: 7, dur: 14, delay: 7, op: 0.42 },
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
  if (isLoaded && isSignedIn) {
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
      className="relative isolate flex min-h-[100svh] w-full flex-col overflow-hidden text-white [perspective:1000px]"
    >
      {/* ── Back plane: flower field, oversized so parallax never reveals edges ── */}
      <img
        src={IMG.bg}
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        style={plane(8, "scale(1.14)")}
        className="absolute inset-0 -z-30 h-full w-full object-cover object-center brightness-[0.88] saturate-[0.9] will-change-transform"
      />

      {/* Directional scrims (own plane, no parallax) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-gradient-to-r from-black/85 via-black/50 to-black/20"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-20 h-1/2 bg-gradient-to-b from-black/70 via-black/25 to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-20 h-2/5 bg-gradient-to-t from-black/75 to-transparent"
      />

      {/* ── Front plane: Himmel cut-out, anchored bottom-right, overlapping the
           headline's right edge. Soft left/bottom mask melts the original crop. ── */}
      <img
        src={IMG.himmel}
        alt=""
        aria-hidden="true"
        style={{
          ...plane(26, "translateX(-6%)"),
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, #000 16%), linear-gradient(to top, transparent 0%, #000 10%)",
          maskImage:
            "linear-gradient(to right, transparent 0%, #000 16%), linear-gradient(to top, transparent 0%, #000 10%)",
          WebkitMaskComposite: "source-in",
          maskComposite: "intersect",
        }}
        className="pointer-events-none absolute -z-10 bottom-0 right-0 hidden h-[88vh] max-h-[960px] w-auto object-contain object-bottom drop-shadow-[0_8px_40px_rgba(0,0,0,0.45)] will-change-transform md:block lg:h-[96vh]"
      />

      {/* ── Frontmost plane: sparse drifting light motes ── */}
      {!reduced && (
        <div
          aria-hidden="true"
          style={plane(40)}
          className="pointer-events-none absolute inset-0 z-[5] hidden md:block"
        >
          {motes.map((m, i) => (
            <span
              key={i}
              className="praxis-mote absolute rounded-full bg-white blur-[1px]"
              style={
                {
                  left: m.left,
                  top: m.top,
                  width: m.size,
                  height: m.size,
                  "--mote-opacity": m.op,
                  animation: `praxis-mote ${m.dur}s ease-in-out ${m.delay}s infinite`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      {/* ── Top row — plain text, no bar / no boundary ── */}
      <header className="relative z-20 flex items-center justify-between px-6 py-6 md:px-12">
        <Link
          to="/"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <BookOpen className="size-5" />
          <span className="text-lg font-semibold tracking-tight">Praxis</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm [text-shadow:0_1px_10px_rgba(0,0,0,0.85)]">
          {/* Signed-in users are redirected to the dashboard, so this header is
              effectively the signed-out marketing nav: browsing requires sign-in. */}
          <SignInTrigger>
            <button type="button" className="text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline">
              Papers
            </button>
          </SignInTrigger>
          <SignInTrigger>
            <button type="button" className="text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline">
              Archive
            </button>
          </SignInTrigger>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <SignInTrigger>
              <button
                type="button"
                className="font-medium text-white underline-offset-4 hover:underline"
              >
                Sign in
              </button>
            </SignInTrigger>
          </SignedOut>
        </nav>
      </header>

      {/* ── Mid plane: headline + actions, pinned left ── */}
      <div className="relative z-[2] flex flex-1 items-center" style={plane(13)}>
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
                  className="group h-11 gap-2.5 rounded-xl border border-white/25 bg-white/10 px-7 text-[0.95rem] text-white shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/20"
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
