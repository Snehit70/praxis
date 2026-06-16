import { useParams, Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Search, X, FileText, Play, Layers, Clock, ListChecks, Trophy, Sparkles } from 'lucide-react';
import { logger } from '@/lib/logger';
import { getExamUuidFromSlug, getExamNameFromSlug, getExamDurationMinutes } from '@/lib/examMapping';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getDisplayCourseName, getCourseLevel } from '@/lib/courseMapping';
import { formatPaperName } from '@/lib/paperUtils';
import {
  getCourseByUuid,
  getPaperBundlesByExamAndCourseUuids,
  type CourseRecord,
  type PaperBundle,
  type PaperSummary,
} from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { cn } from '@/lib/utils';
import { ArcaneSigil } from '@/components/ArcaneSigil';
import { LEVEL_META } from '@/lib/courseCatalogue';
import pageBg from '@/assets/Sousou no Frieren - Ep. 18_ First-Class Mage Exam - 11_07.png';
import cardBg from '@/assets/frieren-card-bg.png';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Cheap deterministic hash of a string → seeds the per-card arcane sigil. */
function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Rarity = age. The newest year in the set reads freshly-forged; each year
 * older gains weathering. Returns the patina strength (0–0.62) and whether this
 * is the freshest tier (drives the gold "forged" treatment on the year badge).
 */
function ageOf(year: number | null, newestYear: number): { patina: number; fresh: boolean } {
  if (year === null) return { patina: 0.45, fresh: false };
  const step = Math.max(0, newestYear - year);
  return { patina: Math.min(step * 0.1, 0.4), fresh: step === 0 };
}

const EXAM_TABS = [
  { slug: 'quiz1', label: 'Quiz 1' },
  { slug: 'quiz2', label: 'Quiz 2' },
  { slug: 'end-term', label: 'End Term' },
];

/** Pill row to jump to the same course under a different exam type. */
function ExamTypeSwitcher({
  activeSlug,
  courseId,
  aliasSuffix,
}: {
  activeSlug: string;
  courseId: string;
  aliasSuffix: string;
}) {
  return (
    <div role="tablist" aria-label="Exam type" className="flex flex-wrap gap-2">
      {EXAM_TABS.map((tab) => {
        const active = tab.slug === activeSlug;
        return (
          <Link
            key={tab.slug}
            role="tab"
            aria-selected={active}
            to={`/exam/${tab.slug}/course/${courseId}${aliasSuffix}`}
            className={
              active
                ? 'rounded-md border border-primary bg-primary/10 px-3.5 py-1.5 text-sm font-medium text-foreground'
                : 'rounded-md border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground'
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

/** One stat in the card's stat block. */
function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-black/25 px-1 py-2 text-center">
      <span className="text-muted-foreground/80">{icon}</span>
      <span className="font-display text-lg leading-none text-foreground">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</span>
    </div>
  );
}

/**
 * A summonable paper — a portrait trading card. Art is a per-paper arcane sigil
 * (seeded from the uuid) over the level colour, aged by year (patina). Clicking
 * anywhere charges the card for ~0.7s (a summoning flourish) before opening the
 * test; under reduced motion it routes instantly.
 */
function PaperVariantCard({
  paper,
  courseId,
  examId,
  levelColor,
  newestYear,
  variantCount,
  variantIndex,
  dealIndex,
  motion,
}: {
  paper: PaperSummary;
  courseId: string;
  examId: string;
  levelColor: string;
  newestYear: number;
  variantCount: number;
  variantIndex: number;
  dealIndex: number;
  motion: boolean;
}) {
  const navigate = useNavigate();
  const [charging, setCharging] = useState(false);
  const to = `/paper/${paper.uuid}?course=${courseId}&exam=${examId}`;
  const { patina, fresh } = ageOf(paper.year, newestYear);
  const seed = useMemo(() => hashString(paper.uuid), [paper.uuid]);

  const activate = (e: React.MouseEvent) => {
    // Let modified clicks / middle-click open normally (new tab etc.).
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (charging) return;
    if (!motion) {
      navigate(to);
      return;
    }
    setCharging(true);
    window.setTimeout(() => navigate(to), 700);
  };

  const track = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty('--gy', `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <div
      className={cn('tcard-wrap group relative', motion && 'paper-deal')}
      data-charging={charging}
      style={{ ['--lvl' as string]: levelColor, animationDelay: `${dealIndex * 70}ms` }}
    >
      <a
        href={to}
        onClick={activate}
        onPointerMove={track}
        className="tcard relative isolate flex aspect-[3/4] flex-col overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--lvl)_55%,transparent)] bg-gradient-to-b from-[#35302a] via-[#241f19] to-[#15120c] p-4 text-left shadow-[inset_0_0_30px_-10px_color-mix(in_srgb,var(--lvl)_55%,transparent),inset_0_0_0_1px_rgba(214,178,110,0.14)]"
      >
        {/* Dimmed Frieren portrait — the bottom texture layer. Kept faint so the
            sigil/element glow read as the focal art and the per-level tint wins. */}
        <img
          src={cardBg}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-top opacity-[0.18] mix-blend-luminosity"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#15120c]/70 via-[#15120c]/55 to-[#15120c]/85"
        />
        {/* Element glow + seeded arcane sigil — the card's art, no two alike. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,color-mix(in_srgb,var(--lvl)_26%,transparent),transparent_62%)]"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <ArcaneSigil seed={seed} className="opacity-40" />
        </div>
        {/* Age patina — weathers older papers; newest stays clear. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#6b4f2a] via-transparent to-[#1a120a] mix-blend-overlay"
          style={{ opacity: patina }}
        />
        <div className="tcard-foil" aria-hidden="true" />
        <div className="tcard-glare" aria-hidden="true" />

        {/* Top row — CODE + year/rarity badge */}
        <div className="relative z-10 flex items-start justify-between gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
            CODE: {paper.uuid}
          </span>
          {paper.year !== null && (
            <span
              className={cn(
                'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                fresh
                  ? 'border-amber-300/60 bg-amber-300/15 text-amber-200'
                  : 'border-foreground/15 bg-black/30 text-muted-foreground',
              )}
            >
              {paper.year}
            </span>
          )}
        </div>

        {/* Title + descriptor */}
        <div className="relative z-10 mt-3">
          {variantCount > 1 && (
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[color-mix(in_srgb,var(--lvl)_85%,white)]">
              Set {variantIndex + 1} of {variantCount}
            </p>
          )}
          <h3 className="font-display text-xl font-normal leading-snug tracking-tight text-foreground">
            {formatPaperName(paper.paperName, paper.year ?? undefined)}
          </h3>
          {paper.isNew === 1 && (
            <span className="paper-new mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
              <Sparkles className="h-3 w-3" /> New
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* Stat block */}
        <div className="relative z-10 mt-3 grid grid-cols-3 gap-1.5">
          <Stat icon={<ListChecks className="h-3.5 w-3.5" />} value={`${paper.questionCount}`} label="Questions" />
          <Stat icon={<Clock className="h-3.5 w-3.5" />} value={`${getExamDurationMinutes(examId)}m`} label="Duration" />
          <Stat icon={<Trophy className="h-3.5 w-3.5" />} value={`${paper.calculatedTotalMarks || paper.totalScore || '—'}`} label="Marks" />
        </div>

        <Button className="relative z-10 mt-3 w-full gap-2" variant="outline">
          <Play className="h-4 w-4" />
          {charging ? 'Summoning…' : 'Take Test'}
        </Button>

        {/* Ornate frame, corner brackets and summon overlays (reused from deck). */}
        <div className="tcard-frame" aria-hidden="true" />
        <span className="tcard-corner tcard-corner-tl" aria-hidden="true" />
        <span className="tcard-corner tcard-corner-tr" aria-hidden="true" />
        <span className="tcard-corner tcard-corner-bl" aria-hidden="true" />
        <span className="tcard-corner tcard-corner-br" aria-hidden="true" />
        <div className="charge-ring" aria-hidden="true" />
        <div className="charge-flare" aria-hidden="true" />
        <div className="summon-burst" aria-hidden="true" />
      </a>
    </div>
  );
}

function BundleCard({
  bundle,
  courseId,
  examId,
  levelColor,
  newestYear,
}: {
  bundle: PaperBundle;
  courseId: string;
  examId: string;
  levelColor: string;
  newestYear: number;
}) {
  const motion = !prefersReducedMotion();
  const [revealed, setRevealed] = useState(!motion);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!motion) return;
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [motion]);

  return (
    <section ref={sectionRef} data-revealed={revealed} className="space-y-4">
      <div className="flex items-end justify-between gap-4 border-b border-[color-mix(in_srgb,var(--lvl,#d6b26e)_30%,transparent)] pb-2">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <h2 className="font-display text-2xl font-normal tracking-tight text-foreground">{bundle.bundleLabel}</h2>
          <span className="text-sm text-muted-foreground">
            {bundle.dateLabel}
            {bundle.termLabel ? ` · ${bundle.termLabel}` : ''}
          </span>
        </div>
        <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {bundle.variantCount}-card set
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {bundle.papers.map((paper, i) => (
          <PaperVariantCard
            key={paper._id}
            paper={paper}
            courseId={courseId}
            examId={examId}
            levelColor={levelColor}
            newestYear={newestYear}
            variantCount={bundle.variantCount}
            variantIndex={i}
            dealIndex={i}
            motion={motion}
          />
        ))}
      </div>
    </section>
  );
}

function LoadingSkeleton({ examId, examName }: { examId: string; examName: string | null }) {
  return (
    <div className="space-y-8" role="status" aria-live="polite" aria-label="Loading paper bundles">
      <header className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-muted-foreground">
          <Link to={`/exam/${examId}`}>
            <ArrowLeft className="h-4 w-4" />
            {examName}
          </Link>
        </Button>
        <div>
          <Skeleton className="h-4 w-48 mb-2" />
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
      </header>
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CoursePage() {
  const { examId, courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Return to wherever the user actually came from (dashboard, search, exam
  // list). Fall back to the dashboard on a fresh/deep-linked load where there
  // is no in-app history to pop.
  const goBack = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate('/home');
  };
  const examUuid = examId ? getExamUuidFromSlug(examId) : null;
  const examName = examId ? getExamNameFromSlug(examId) : null;
  const [bundles, setBundles] = useState<PaperBundle[]>([]);
  const [course, setCourse] = useState<CourseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [retryNonce, setRetryNonce] = useState(0);

  const courseUuids = useMemo(() => {
    if (!courseId) return [];
    const aliases = searchParams
      .get('aliases')
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
    return Array.from(new Set([courseId, ...aliases]));
  }, [courseId, searchParams]);

  const aliasSuffix = useMemo(() => {
    const aliasParam = searchParams.get('aliases');
    return aliasParam ? `?aliases=${encodeURIComponent(aliasParam)}` : '';
  }, [searchParams]);

  useEffect(() => {
    logger.info('CoursePage mounted', { examId, courseId, examUuid });
    return () => logger.debug('CoursePage unmounted');
  }, [examId, courseId, examUuid]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    if (!examUuid || !courseId) {
      setLoading(false);
      return () => {
        active = false;
        controller.abort();
      };
    }

    setLoading(true);
    setLoadFailed(false);

    Promise.all([
      getCourseByUuid(examUuid, courseId, { signal: controller.signal }),
      getPaperBundlesByExamAndCourseUuids(examUuid, courseUuids, { signal: controller.signal }),
    ])
      .then(([courseData, bundleData]) => {
        if (!active) return;
        setCourse(courseData);
        setBundles(bundleData);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        logger.error('Failed to load bundle data', error);
        if (!active) return;
        setLoadFailed(true);
        setCourse(null);
        setBundles([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [courseId, courseUuids, examUuid, retryNonce]);

  const filteredBundles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return bundles;

    return bundles
      .map((bundle) => ({
        ...bundle,
        papers: bundle.papers.filter((paper) => {
          const formatted = formatPaperName(paper.paperName, paper.year ?? undefined).toLowerCase();
          return (
            bundle.bundleLabel.toLowerCase().includes(query) ||
            bundle.dateLabel.toLowerCase().includes(query) ||
            (bundle.termLabel?.toLowerCase().includes(query) ?? false) ||
            formatted.includes(query) ||
            paper.paperName.toLowerCase().includes(query) ||
            (paper.paperDescription?.toLowerCase().includes(query) ?? false)
          );
        }),
      }))
      .filter((bundle) => bundle.papers.length > 0);
  }, [bundles, searchQuery]);

  const totalPapers = useMemo(
    () => bundles.reduce((sum, bundle) => sum + bundle.papers.length, 0),
    [bundles],
  );

  const displayCourseName = useMemo(() => {
    if (!course) return '';
    return getDisplayCourseName(course.course_name);
  }, [course]);

  const levelMeta = useMemo(
    () => LEVEL_META[course ? getCourseLevel(course.course_name) : 'Other'],
    [course],
  );

  // Newest year across all papers — the freshly-forged tier; everything older
  // gains patina (see ageOf).
  const newestYear = useMemo(() => {
    const years = bundles.flatMap((b) => b.papers.map((p) => p.year).filter((y): y is number => y !== null));
    return years.length ? Math.max(...years) : new Date().getFullYear();
  }, [bundles]);

  if (!examUuid || !courseId) {
    return (
      <StatePanel
        compact
        title="Invalid course"
        description="Course not found."
        actions={(
          <Button asChild variant="outline">
            <Link to="/">Go home</Link>
          </Button>
        )}
        announce
      />
    );
  }

  if (loading) {
    return <LoadingSkeleton examId={examId!} examName={examName} />;
  }

  if (loadFailed) {
    return (
      <StatePanel
        compact
        tone="error"
        icon={(
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <FileText className="h-7 w-7 text-destructive" />
          </div>
        )}
        title="Unable to load bundles"
        description="Could not load papers for this course."
        actions={(
          <>
            <Button variant="default" onClick={() => setRetryNonce((value) => value + 1)}>
              Retry
            </Button>
            <Button asChild variant="outline">
              <Link to={`/exam/${examId}`}>Back to {examName}</Link>
            </Button>
          </>
        )}
        announce
      />
    );
  }

  if (!course || bundles.length === 0) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-muted-foreground">
          <Link to="/home">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </Button>
        {course && (
          <div className="space-y-3">
            <h1 className="font-display text-4xl font-normal tracking-tight">{displayCourseName}</h1>
            <ExamTypeSwitcher activeSlug={examId!} courseId={courseId!} aliasSuffix={aliasSuffix} />
          </div>
        )}
        <StatePanel
          compact
          icon={(
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <FileText className="h-7 w-7 text-muted-foreground" />
            </div>
          )}
          title="No papers found"
          description={`No papers available for this course in ${examName}. Try another exam type above.`}
          announce
        />
      </div>
    );
  }

  return (
    <div className="relative isolate mx-auto max-w-4xl space-y-8">
      {/* Page backdrop — the First-Class Mage Exam hall, held still behind the
          page and dimmed so the bundle list stays legible. `isolate` + `-z-10`
          keeps it above the app background but below the content. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <img src={pageBg} alt="" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/82 via-background/88 to-background/94" />
      </div>

      <header className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          className="gap-1.5 -ml-2 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3.5">
              <img
                src={levelMeta.image}
                alt=""
                aria-hidden="true"
                className={cn(
                  'hidden h-14 w-14 shrink-0 rounded-2xl object-cover object-top ring-2 ring-offset-2 ring-offset-background sm:block',
                  levelMeta.ring,
                )}
              />
              <div className="min-w-0">
                <p className={cn('mb-0.5 text-xs font-semibold uppercase tracking-[0.18em]', levelMeta.text)}>
                  {levelMeta.label}
                </p>
                <h1 className="font-display text-4xl font-normal leading-[1.05] tracking-tight text-foreground sm:text-5xl">
                  {displayCourseName}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {bundles.length} bundles · {totalPapers} papers
                  {courseUuids.length > 1 && ' · merged variants'}
                </p>
              </div>
            </div>
            <ExamTypeSwitcher activeSlug={examId!} courseId={courseId!} aliasSuffix={aliasSuffix} />
          </div>

          <div className="relative w-full md:w-72">
            <label htmlFor="bundle-search-input" className="sr-only">
              Filter bundles and papers
            </label>
            <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="bundle-search-input"
              type="text"
              placeholder="Search bundles or papers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              className="w-full rounded-lg border border-border bg-card/80 py-2.5 pl-10 pr-10 text-sm text-foreground backdrop-blur-sm placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear bundle search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {filteredBundles.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Layers aria-hidden="true" className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No bundles match "{searchQuery}"</p>
          <button type="button" onClick={() => setSearchQuery('')} className="mt-2 text-primary hover:underline">
            Clear search
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {filteredBundles.map((bundle) => (
            <BundleCard
              key={bundle.groupId}
              bundle={bundle}
              courseId={courseId!}
              examId={examId!}
              levelColor={levelMeta.color}
              newestYear={newestYear}
            />
          ))}
        </div>
      )}
    </div>
  );
}
