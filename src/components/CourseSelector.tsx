import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { Dialog, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LEVEL_ORDER, type CourseLevel } from '@/lib/courseMapping';
import {
  LEVEL_META,
  SELECTABLE_LEVELS,
  type CatalogueEntry,
} from '@/lib/courseCatalogue';
import cardBg from '@/assets/Frieren wallpaper.jpeg';
import emptySearchArt from '@/assets/hero-flower-field.jpeg';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Deterministic crop from the course key so same-level art (which shares one
 * character portrait) frames a little differently — mirrors the dashboard
 * CourseCard. Biased toward the upper portion to keep faces in view.
 */
function cropFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const x = 28 + (h % 45); // 28%..72%
  const y = 8 + ((h >> 8) % 26); // 8%..33%
  return `${x}% ${y}%`;
}

interface CourseSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogue: CatalogueEntry[];
  initialLevel: string | null;
  initialCourseKeys: string[];
  saving: boolean;
  /** When true (first-time setup), the dialog can't be dismissed without saving. */
  mandatory?: boolean;
  onSave: (payload: { level: string | null; courseKeys: string[] }) => void;
}

type LevelFilter = CourseLevel | 'All';

export function CourseSelector({
  open,
  onOpenChange,
  catalogue,
  initialLevel,
  initialCourseKeys,
  saving,
  mandatory = false,
  onSave,
}: CourseSelectorProps) {
  const initialLevelTyped = (SELECTABLE_LEVELS as string[]).includes(initialLevel ?? '')
    ? (initialLevel as CourseLevel)
    : null;

  const [level, setLevel] = useState<CourseLevel | null>(initialLevelTyped);
  const [filter, setFilter] = useState<LevelFilter>(initialLevelTyped ?? 'All');
  const [selected, setSelected] = useState<Set<string>>(new Set(initialCourseKeys));
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  // The card-key currently playing its one-shot charge animation. Distinct from
  // `selected` (the persistent charged state) so flipping to an already-chosen
  // card glows but doesn't replay the ring race.
  const [chargingKey, setChargingKey] = useState<string | null>(null);

  // The deck: every course matching the active level filter + search, flattened
  // in level order — what you flip through one card at a time.
  const deck = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: CatalogueEntry[] = [];
    for (const lvl of LEVEL_ORDER) {
      for (const entry of catalogue) {
        if (entry.level !== lvl) continue;
        if (filter !== 'All' && entry.level !== filter) continue;
        if (
          q &&
          !entry.displayName.toLowerCase().includes(q) &&
          !entry.courseCode.toLowerCase().includes(q)
        ) {
          continue;
        }
        out.push(entry);
      }
    }
    return out;
  }, [catalogue, filter, query]);

  // Reset to the first card whenever the deck's contents change.
  useEffect(() => {
    setIndex(0);
  }, [filter, query]);

  const clampedIndex = deck.length ? Math.min(index, deck.length - 1) : 0;
  const current = deck[clampedIndex] ?? null;

  const go = (delta: number) =>
    setIndex((i) => Math.min(deck.length - 1, Math.max(0, i + delta)));

  // ←/→ flip the deck (unless you're typing in the search field).
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      event.preventDefault();
      go(event.key === 'ArrowRight' ? 1 : -1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deck.length]);

  const toggle = (key: string) => {
    const willCharge = !selected.has(key);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    if (willCharge) setChargingKey(key);
  };

  // Clear the one-shot charge trigger once its animation has played.
  useEffect(() => {
    if (!chargingKey) return;
    const t = window.setTimeout(() => setChargingKey(null), 900);
    return () => window.clearTimeout(t);
  }, [chargingKey]);

  const chosen = useMemo(
    () => catalogue.filter((entry) => selected.has(entry.key)),
    [catalogue, selected],
  );

  // Save is only meaningful when the chosen set differs from what we opened with.
  const dirty = useMemo(() => {
    if (selected.size !== initialCourseKeys.length) return true;
    for (const key of initialCourseKeys) if (!selected.has(key)) return true;
    return false;
  }, [selected, initialCourseKeys]);

  const handleSave = () => {
    onSave({ level, courseKeys: Array.from(selected) });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      dismissable={!mandatory}
      labelledBy="course-selector-title"
      className="animate-dialog-in bg-transparent sm:max-w-xl"
    >
      {/* Calmed meadow backdrop (blur + deep scrim) so the glass reads clean. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <img src={cardBg} alt="" className="h-full w-full scale-110 object-cover object-center blur-[3px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/72 via-background/82 to-background/92" />
      </div>

      {/* Compact header */}
      <div className="relative shrink-0 px-4 pb-3 pt-4 sm:px-5">
        {!mandatory && <DialogClose onClose={() => onOpenChange(false)} />}
        <h2
          id="course-selector-title"
          className="font-display text-2xl font-normal tracking-tight text-foreground sm:text-3xl"
        >
          Set your road this term
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Choose the paths you&apos;ll walk — they&apos;ll wait for you on the road.
        </p>
      </div>

      {/* Filter chips + search */}
      <div className="shrink-0 space-y-3 border-b border-white/10 px-4 pb-3 sm:px-5">
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={filter === 'All'} onClick={() => setFilter('All')}>
            All levels
          </FilterChip>
          {SELECTABLE_LEVELS.map((lvl) => (
            <FilterChip
              key={lvl}
              active={filter === lvl}
              accent={level === lvl}
              image={LEVEL_META[lvl].image}
              ring={LEVEL_META[lvl].ring}
              onClick={() => {
                setFilter(lvl);
                setLevel(lvl);
              }}
            >
              {LEVEL_META[lvl].label}
            </FilterChip>
          ))}
        </div>

        <div className="relative">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search every road…"
            autoComplete="off"
            aria-label="Search courses"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 pl-10 pr-9 text-sm text-foreground backdrop-blur-md placeholder:text-muted-foreground focus:border-primary/60 focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* The deck — one card at a time, arrows either side. */}
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden px-4 py-5 sm:px-5">
        {current ? (
          <>
            <div className="relative flex w-full items-center justify-center">
              <DeckArrow
                dir="prev"
                disabled={clampedIndex <= 0}
                onClick={() => go(-1)}
                className="absolute left-0 z-20"
              />
              <div className="flex items-center justify-center">
                <PeekCard entry={deck[clampedIndex - 1]} onClick={() => go(-1)} />
                <div className="relative z-10 -mx-7 sm:-mx-9">
                  <CourseCardFace
                    entry={current}
                    charged={selected.has(current.key)}
                    charging={chargingKey === current.key}
                    onToggle={toggle}
                  />
                </div>
                <PeekCard entry={deck[clampedIndex + 1]} onClick={() => go(1)} />
              </div>
              <DeckArrow
                dir="next"
                disabled={clampedIndex >= deck.length - 1}
                onClick={() => go(1)}
                className="absolute right-0 z-20"
              />
            </div>
            {/* Position pill */}
            <p className="text-xs font-medium text-muted-foreground">
              <span className="text-foreground">{clampedIndex + 1}</span> / {deck.length}
              <span className="mx-1.5 text-white/20">·</span>
              <span className={LEVEL_META[current.level].text}>{LEVEL_META[current.level].label}</span>
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="relative h-28 w-44 overflow-hidden rounded-xl border border-border">
              <img src={emptySearchArt} alt="" aria-hidden="true" className="h-full w-full object-cover object-center" />
              <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">No road by that name</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a broader name or code.</p>
          </div>
        )}
      </div>

      {/* Chosen tray — your hand. Tap a card to discharge it. */}
      {chosen.length > 0 && (
        <div className="shrink-0 border-t border-white/10 px-4 py-2.5 sm:px-5">
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            {chosen.map((entry) => {
              const meta = LEVEL_META[entry.level];
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => toggle(entry.key)}
                  title={`Discharge ${entry.displayName}`}
                  aria-label={`Discharge ${entry.displayName}`}
                  style={{ '--lvl': meta.color } as React.CSSProperties}
                  className="group relative h-12 w-9 shrink-0 overflow-hidden rounded-md border border-[color-mix(in_srgb,var(--lvl)_60%,transparent)] shadow-[0_0_12px_-4px_color-mix(in_srgb,var(--lvl)_70%,transparent)]"
                >
                  <img
                    src={meta.image}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    style={{ objectPosition: cropFor(entry.key) }}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/55" />
                  <X className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 bg-background/55 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md sm:px-5">
        <p className="text-sm text-muted-foreground">{selected.size} chosen</p>
        <div className="flex items-center gap-2">
          {!mandatory && (
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Not yet
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !dirty}>
            {saving ? 'Setting out…' : 'Set out'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** One portrait trading-card face — calm frosted glass with pointer tilt + glare. */
function CourseCardFace({
  entry,
  charged,
  charging,
  onToggle,
}: {
  entry: CatalogueEntry;
  charged: boolean;
  charging: boolean;
  onToggle: (key: string) => void;
}) {
  const meta = LEVEL_META[entry.level];
  const ref = useRef<HTMLDivElement>(null);
  const exams = entry.examSlugs.length;

  const onMove = (event: React.MouseEvent) => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const r = el.getBoundingClientRect();
    const px = (event.clientX - r.left) / r.width;
    const py = (event.clientY - r.top) / r.height;
    el.style.setProperty('--ry', `${(px - 0.5) * 12}deg`);
    el.style.setProperty('--rx', `${(0.5 - py) * 12}deg`);
    el.style.setProperty('--gx', `${px * 100}%`);
    el.style.setProperty('--gy', `${py * 100}%`);
  };

  const reset = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--gx', '50%');
    el.style.setProperty('--gy', '50%');
  };

  return (
    <button
      type="button"
      onClick={() => onToggle(entry.key)}
      onMouseMove={onMove}
      onMouseLeave={reset}
      aria-pressed={charged}
      data-charging={charging}
      className="tcard-wrap shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      <div
        ref={ref}
        data-charged={charged}
        style={{ '--lvl': meta.color } as React.CSSProperties}
        className="tcard relative flex h-[clamp(330px,50vh,420px)] w-[clamp(248px,66vw,300px)] flex-col overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04] text-left backdrop-blur-md"
      >
        {/* Art window */}
        <div className="relative h-[58%] overflow-hidden">
          <img
            src={meta.image}
            alt=""
            aria-hidden="true"
            style={{ objectPosition: cropFor(entry.key) }}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/10 to-transparent" />

          {/* Holographic foil — confined to the art (keeps stats legible). Faint
              on hover, blooms when charged; shimmer tracks the pointer. */}
          <span aria-hidden="true" className="tcard-foil" />

          {/* Type badge — the level (character + name) */}
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-black/35 py-0.5 pl-0.5 pr-2 backdrop-blur-md">
            <img
              src={meta.image}
              alt=""
              aria-hidden="true"
              className={cn('h-4 w-4 rounded-[3px] object-cover object-top ring-1', meta.ring)}
            />
            <span className={cn('text-[10px] font-semibold uppercase tracking-[0.12em]', meta.text)}>
              {meta.label.replace(/^Diploma · /, '')}
            </span>
          </span>

          {/* Headline stat — papers (HP-style) */}
          <span className="absolute right-2.5 top-2.5 flex items-baseline gap-1 rounded-md border border-white/15 bg-black/35 px-2 py-0.5 backdrop-blur-md">
            <span className="text-base font-bold leading-none text-white">{entry.paperCount}</span>
            <span className="text-[10px] uppercase tracking-wide text-white/70">papers</span>
          </span>
        </div>

        {/* Info panel */}
        <div className="relative flex flex-1 flex-col p-3.5">
          <h3 className="font-display text-xl font-normal leading-tight tracking-tight text-foreground line-clamp-2">
            {entry.displayName}
          </h3>
          <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-muted-foreground">
            {entry.courseCode && (
              <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-medium text-foreground/80">
                {entry.courseCode}
              </span>
            )}
            <span>{exams} {exams === 1 ? 'exam' : 'exams'}</span>
            <span className="ml-auto text-foreground/70">{charged ? 'Charged' : 'Tap to charge'}</span>
          </div>
        </div>

        {/* Glass glare reflection — follows the pointer on hover. */}
        <span aria-hidden="true" className="tcard-glare" />
        {/* Charge sequence — energy races the perimeter, a flare sweeps across. */}
        <span aria-hidden="true" className="charge-ring" />
        <span aria-hidden="true" className="charge-flare" />
      </div>
    </button>
  );
}

function DeckArrow({
  dir,
  disabled,
  onClick,
  className,
}: {
  dir: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'prev' ? 'Previous road' : 'Next road'}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-foreground backdrop-blur-md transition-colors hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:pointer-events-none disabled:opacity-25',
        className,
      )}
    >
      {dir === 'prev' ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
    </button>
  );
}

/** Faint neighbour preview tucked behind the hero card — clickable to flip. */
function PeekCard({ entry, onClick }: { entry?: CatalogueEntry; onClick: () => void }) {
  if (!entry) return null;
  const meta = LEVEL_META[entry.level];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-hidden="true"
      tabIndex={-1}
      className="hidden shrink-0 sm:block"
    >
      <div className="relative h-[clamp(260px,40vh,340px)] w-[clamp(140px,32vw,180px)] scale-95 overflow-hidden rounded-2xl border border-white/10 opacity-35 blur-[1.5px] saturate-50">
        <img
          src={meta.image}
          alt=""
          aria-hidden="true"
          loading="lazy"
          style={{ objectPosition: cropFor(entry.key) }}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-background/40" />
      </div>
    </button>
  );
}

function FilterChip({
  active,
  accent = false,
  image,
  ring,
  onClick,
  children,
}: {
  active: boolean;
  accent?: boolean;
  image?: string;
  ring?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border py-1 text-xs font-medium backdrop-blur-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
        image ? 'pl-1.5 pr-2.5' : 'px-3',
        active
          ? 'border-white/30 bg-white/[0.14] text-foreground'
          : 'border-white/10 bg-white/[0.05] text-muted-foreground hover:bg-white/[0.1] hover:text-foreground',
        accent && !active && cn('ring-1', ring ?? 'ring-white/20'),
      )}
    >
      {image && (
        <img
          src={image}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className={cn('h-4 w-4 rounded-[4px] object-cover object-top ring-1', ring ?? 'ring-border')}
        />
      )}
      {children}
    </button>
  );
}
