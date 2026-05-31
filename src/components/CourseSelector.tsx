import { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
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
import selectorBanner from '@/assets/hero-party-clover.jpeg';
import emptySearchArt from '@/assets/hero-flower-field.jpeg';

/**
 * Deterministic crop from the course key so same-level thumbnails (which share
 * one character portrait) frame a little differently — mirrors the dashboard
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

  const visibleByLevel = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups = {} as Record<CourseLevel, CatalogueEntry[]>;
    for (const lvl of LEVEL_ORDER) groups[lvl] = [];
    for (const entry of catalogue) {
      if (filter !== 'All' && entry.level !== filter) continue;
      if (
        q &&
        !entry.displayName.toLowerCase().includes(q) &&
        !entry.courseCode.toLowerCase().includes(q)
      ) {
        continue;
      }
      groups[entry.level].push(entry);
    }
    return groups;
  }, [catalogue, filter, query]);

  const totalVisible = LEVEL_ORDER.reduce((sum, lvl) => sum + visibleByLevel[lvl].length, 0);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = () => {
    onSave({ level, courseKeys: Array.from(selected) });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      dismissable={!mandatory}
      labelledBy="course-selector-title"
      className="animate-dialog-in bg-transparent sm:max-w-2xl"
    >
      {/* Card backdrop — Frieren in the meadow, fills the whole card and is
          dimmed so every section stays legible while the image reads through. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        {/* Calmed hard (blur + scale to hide blur-edge, deep scrim) so the
            frosted glass tiles read clean rather than muddy over a busy photo. */}
        <img src={cardBg} alt="" className="h-full w-full scale-110 object-cover object-center blur-[3px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/65 via-background/80 to-background/90" />
      </div>

      {/* Banner — the clover-party hero, with the title overlaid. */}
      <div className="relative h-28 shrink-0 sm:h-36">
        <img
          src={selectorBanner}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
        {!mandatory && <DialogClose onClose={() => onOpenChange(false)} />}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
          <h2
            id="course-selector-title"
            className="font-display text-2xl font-normal tracking-tight text-foreground sm:text-3xl"
          >
            Your courses this term
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Pick the courses you&apos;re taking — they&apos;ll sit in My Courses for quick practice.
          </p>
        </div>
      </div>

      {/* Level chips */}
      <div className="shrink-0 border-b border-white/10 px-4 py-3 sm:px-5">
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

        <div className="relative mt-3">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search courses..."
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

      {/* Scrollable course list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {totalVisible === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <div className="relative h-28 w-44 overflow-hidden rounded-xl border border-border sm:h-32 sm:w-52">
              <img
                src={emptySearchArt}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">No courses match your search</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a broader course name or code.</p>
          </div>
        ) : (
          <div className="space-y-7">
            {LEVEL_ORDER.map((lvl) => {
              const entries = visibleByLevel[lvl];
              if (entries.length === 0) return null;
              const meta = LEVEL_META[lvl];
              const selectedInLevel = entries.reduce(
                (count, entry) => count + (selected.has(entry.key) ? 1 : 0),
                0,
              );
              return (
                <section key={lvl}>
                  {/* Level header — a character portrait gives each program a face. */}
                  <div className="mb-3 flex items-center gap-2.5">
                    <img
                      src={meta.image}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className={cn('h-8 w-8 rounded-lg object-cover object-top ring-2', meta.ring)}
                    />
                    <h3 className={cn('text-sm font-semibold tracking-tight', meta.text)}>
                      {meta.label}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {selectedInLevel > 0 ? `${selectedInLevel}/${entries.length} selected` : `${entries.length} courses`}
                    </span>
                  </div>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {entries.map((entry) => {
                      const isSelected = selected.has(entry.key);
                      return (
                        <li key={entry.key}>
                          <button
                            type="button"
                            onClick={() => toggle(entry.key)}
                            aria-pressed={isSelected}
                            data-selected={isSelected}
                            style={{ '--lvl': meta.color } as React.CSSProperties}
                            className={cn(
                              'selector-tile group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-left backdrop-blur-md',
                              'transition-[transform,box-shadow,border-color] duration-200 ease-out will-change-transform',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 motion-safe:hover:-translate-y-0.5',
                            )}
                          >
                            {/* Level-colour fill — wipes in on select, stays as a tint. */}
                            <span aria-hidden="true" className="selector-fill" />

                            {/* Character thumbnail, framed per course. */}
                            <span className="relative z-10 shrink-0">
                              <img
                                src={meta.image}
                                alt=""
                                aria-hidden="true"
                                loading="lazy"
                                style={{ objectPosition: cropFor(entry.key) }}
                                className={cn('h-11 w-11 rounded-lg object-cover ring-2', meta.ring)}
                              />
                            </span>

                            <span className="relative z-10 min-w-0">
                              <span className="block truncate text-sm font-medium text-foreground">
                                {entry.displayName}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {entry.courseCode ? `${entry.courseCode} · ` : ''}
                                {entry.paperCount} {entry.paperCount === 1 ? 'paper' : 'papers'}
                              </span>
                            </span>

                            {/* Check — stays primary so 'selected' is unmistakable. */}
                            <span
                              className={cn(
                                'relative z-10 ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                                isSelected
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-white/25 bg-white/5',
                              )}
                            >
                              {isSelected && <Check className="selector-check h-3.5 w-3.5" />}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 bg-background/55 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md sm:px-5">
        <p className="text-sm text-muted-foreground">
          {selected.size} {selected.size === 1 ? 'course' : 'courses'} selected
        </p>
        <div className="flex items-center gap-2">
          {!mandatory && (
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save courses'}
          </Button>
        </div>
      </div>
    </Dialog>
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
