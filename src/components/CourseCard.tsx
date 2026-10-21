import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, FileText, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { courseHref, LEVEL_META, type CatalogueEntry } from '@/lib/courseCatalogue';

interface CourseCardProps {
  course: CatalogueEntry;
  enrolled?: boolean;
  /** When provided, renders an add/remove toggle (used in The World / archive).
   *  Companions tiles omit it and stay clean — enrollment is managed via the
   *  "Edit courses" selector there. */
  onToggleEnroll?: (course: CatalogueEntry) => void;
  /** Position within its grid — drives the staggered entrance cascade. */
  revealIndex?: number;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Deterministic art framing from the course key so same-level tiles (which share
 * one character portrait) don't look pixel-identical — each frames the character
 * a little differently. Biased toward the upper portion to keep faces in view.
 */
function cropFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const x = 28 + (h % 45); // 28%..72%
  const y = 8 + ((h >> 8) % 26); // 8%..33%
  return `${x}% ${y}%`;
}

export function CourseCard({ course, enrolled = false, onToggleEnroll, revealIndex = 0 }: CourseCardProps) {
  const meta = LEVEL_META[course.level];
  const ref = useRef<HTMLDivElement>(null);
  // Cap the cascade index so long lists don't wait on an ever-growing delay.
  const riseIndex = Math.min(revealIndex, 7);

  // Playful pointer parallax/tilt: write pointer offset to CSS vars the inner
  // plane (rotate) and the art layer (translate) read. Gated on reduced-motion.
  const handleMove = (event: React.MouseEvent) => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    el.style.setProperty('--rx', `${(0.5 - py) * 5}deg`);
    el.style.setProperty('--ry', `${(px - 0.5) * 7}deg`);
    el.style.setProperty('--mx', `${(px - 0.5) * 16}px`);
    el.style.setProperty('--my', `${(py - 0.5) * 12}px`);
  };

  const reset = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--mx', '0px');
    el.style.setProperty('--my', '0px');
  };

  const showCode = course.courseCode && course.courseCode !== course.displayName;
  // Drop the redundant "Diploma · " prefix in the kicker — context already implies it.
  const shortLabel = meta.label.replace(/^Diploma · /, '');

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ '--rise-i': riseIndex } as React.CSSProperties}
      className="praxis-rise group relative transition-transform duration-200 ease-out will-change-transform [perspective:1000px] motion-safe:hover:-translate-y-1"
    >
      <div
        className={cn(
          'squircle relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1220]/85 backdrop-blur-xl',
          'transition-[transform,box-shadow,border-color] duration-150 ease-out will-change-transform',
          '[transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))]',
          'group-hover:border-white/25 group-hover:shadow-2xl group-hover:shadow-black/50',
        )}
      >
        {/* Art band (parallax): the level character, framed per course. It only
            sets the mood; all the reading happens on the panel below. */}
        <div className="relative aspect-[16/7] overflow-hidden">
          <div
            className="absolute inset-0 will-change-transform"
            style={{ transform: 'translate3d(var(--mx,0px),var(--my,0px),0)' }}
          >
            <img
              src={meta.image}
              alt=""
              aria-hidden="true"
              loading="lazy"
              style={{ objectPosition: cropFor(course.key) }}
              className="h-full w-full scale-110 object-cover transition-transform duration-300 ease-out motion-safe:group-hover:scale-[1.18]"
            />
          </div>
          <div className={cn('absolute inset-0 bg-gradient-to-t to-transparent', meta.glow)} />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0d1220] to-transparent" />
        </div>

        {/* Specular sheen: sweeps across once on hover (light catching glass). */}
        <div aria-hidden="true" className="praxis-sheen pointer-events-none z-30" />

        {/* Stretched primary link: the whole tile opens the course. */}
        <Link
          to={courseHref(course)}
          aria-label={`Open ${course.displayName}`}
          className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        />

        {/* Reading panel: level, name, then papers + open cue. */}
        <div className="pointer-events-none relative z-20 -mt-3 flex flex-1 flex-col px-4 pb-4">
          <p className={cn('flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]', meta.text)}>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {shortLabel}
            {showCode ? <span className="text-white/45">· {course.courseCode}</span> : null}
          </p>
          <h3 className="mt-1.5 line-clamp-2 font-display text-[1.35rem] font-normal leading-tight tracking-tight text-white">
            {course.displayName}
          </h3>
          <div className="mt-auto flex items-center justify-between pt-3 text-sm">
            <span className="flex items-center gap-1.5 text-white/65">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              {course.paperCount} {course.paperCount === 1 ? 'paper' : 'papers'}
            </span>
            <span className="flex items-center gap-1 font-medium text-white/80 transition-colors group-hover:text-white">
              Open
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </div>
        </div>

        {/* Enrollment toggle — archive only; Companions tiles are clean. */}
        {onToggleEnroll && (
          <button
            type="button"
            onClick={() => onToggleEnroll(course)}
            aria-pressed={enrolled}
            aria-label={
              enrolled
                ? `Remove ${course.displayName} from your courses`
                : `Add ${course.displayName} to your courses`
            }
            title={enrolled ? 'Remove from my courses' : 'Add to my courses'}
            className={cn(
              'squircle absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-xl border backdrop-blur-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
              enrolled
                ? 'border-white/30 bg-primary/90 text-primary-foreground hover:bg-primary'
                : 'border-white/30 bg-black/40 text-white hover:bg-black/60',
            )}
          >
            {enrolled ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
