import { cn } from "@/lib/utils";
import { WORDMARK_PATH } from "@/components/praxisWordmark";

type PraxisBrandProps = {
  /** Size with a height class (width follows) and colour with a text class. */
  className?: string;
};

const ACCENT = "#7AA7E6";

/**
 * The Praxis mark and wordmark. The mark (public/praxis-mark.png) is a nemophila,
 * Frieren's flower-field spell, with a lowercase p cut through it; the wordmark
 * is italic serif "praxis" with its i-dot in the same nemophila blue.
 */
export function PraxisBrand({ className }: PraxisBrandProps) {
  return (
    <span className={cn("inline-flex h-10 shrink-0 items-center gap-2", className)}>
      <img src="/praxis-mark.png" alt="" aria-hidden="true" className="h-[70%] w-auto" />
      <svg viewBox="-10 -74 245 96" role="img" aria-label="Praxis" className="h-full w-auto overflow-visible">
        <path d={WORDMARK_PATH} fill="currentColor" />
        <path
          d="M192.8 -60.5Q190.9 -60.5 189.65 -61.85Q188.4 -63.2 188.4 -65.1Q188.4 -67.8 190.05 -69.4Q191.7 -71 193.8 -71Q195.8 -71 197.15 -69.75Q198.5 -68.5 198.5 -66.5Q198.5 -63.7 196.8 -62.1Q195.1 -60.5 192.8 -60.5Z"
          fill={ACCENT}
        />
      </svg>
    </span>
  );
}
