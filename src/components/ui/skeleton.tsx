import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";

/**
 * `muted` sits on the plain app surface; `glass` sits on the illustrated
 * scenes (dashboard, course hall, profile, paper cover) where a grey block
 * would read as a hole punched in the picture.
 */
type SkeletonTone = "muted" | "glass";

const ToneContext = createContext<SkeletonTone>("muted");

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
  tone?: SkeletonTone;
}

/**
 * One placeholder block. Every block runs the same sweep on the same clock
 * (see `.skeleton` in index.css), so a page's skeleton shimmers in unison
 * instead of each bar pulsing on its own beat.
 */
export function Skeleton({ className, style, tone }: SkeletonProps) {
  const inherited = useContext(ToneContext);
  return (
    <div
      aria-hidden="true"
      data-tone={tone ?? inherited}
      style={style}
      className={cn("skeleton rounded-lg", className)}
    />
  );
}

interface SkeletonRegionProps {
  /** Announced to screen readers while the region is loading. */
  label: string;
  tone?: SkeletonTone;
  className?: string;
  children: React.ReactNode;
}

/** Live status wrapper for a loading region; sets the tone for its blocks. */
export function SkeletonRegion({ label, tone = "muted", className, children }: SkeletonRegionProps) {
  return (
    <ToneContext.Provider value={tone}>
      <div role="status" aria-live="polite" aria-busy="true" className={className}>
        <span className="sr-only">{label}</span>
        {children}
      </div>
    </ToneContext.Provider>
  );
}
