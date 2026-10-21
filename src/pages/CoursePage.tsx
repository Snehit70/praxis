import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
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
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { cn } from '@/lib/utils';
import { ArcaneSigil } from '@/components/ArcaneSigil';
import { LEVEL_META } from '@/lib/courseCatalogue';
import examHall from '@/assets/exam-hall.webp';
import cardBg from '@/assets/10273905393555527.jpeg';

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

/**
 * Page scene: the Mage Association hall on exam day, held still behind the page.
 * The hall and sky stay clear up top; scrims only darken where text sits.
 */
function ExamHallBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <img src={examHall} alt="" fetchPriority="high" className="h-full w-full object-cover object-[65%_30%]" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/45 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent from-30% via-background/55 via-55% to-background/85" />
    </div>
  );
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
    <div role="tablist" aria-label="Exam type" className="squircle inline-flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/35 p-1 backdrop-blur-md">
      {EXAM_TABS.map((tab) => {
        const active = tab.slug === activeSlug;
        return (
          <Link
            key={tab.slug}
            role="tab"
            aria-selected={active}
            replace
            to={`/exam/${tab.slug}/course/${courseId}${aliasSuffix}`}
            className={
              active
                ? 'rounded-lg bg-white/15 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm'
                : 'rounded-lg px-3.5 py-1.5 text-sm font-medium text-white/65 transition-colors hover:bg-white/5 hover:text-white'
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
    <div className="flex flex-col items-center gap-1 rounded-lg bg-black/40 px-1 py-2 text-center ring-1 ring-inset ring-white/[0.08] backdrop-blur-sm">
      <dt className="sr-only">{label}</dt>
      <dd className="flex items-center gap-1 text-base font-semibold leading-none tabular-nums text-white">
        <span className="text-white/45">{icon}</span>
        {value}
      </dd>
      <span aria-hidden="true" className="text-[10px] uppercase tracking-wider text-white/50">{label}</span>
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
        className="tcard relative isolate flex aspect-[5/7] flex-col overflow-hidden rounded-2xl border border-[rgba(214,178,110,0.45)] bg-[#15120c] transition-[border-color] group-hover:border-[rgba(214,178,110,0.8)] text-left shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7),inset_0_0_0_1px_rgba(214,178,110,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        {/* Card art: the party portrait, framed a little differently per paper so
            sets in one bundle don't look identical. */}
        <img
          src={cardBg}
          alt=""
          aria-hidden="true"
          loading="lazy"
          style={{ objectPosition: `50% ${15 + (seed % 30)}%` }}
          className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-110"
        />
        {/* Level tint over the art, then a solid fade so the lower half reads. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,transparent_35%,rgba(21,18,12,0.55)_90%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#15120c]/60 via-transparent via-25% to-[#15120c] to-[58%]"
        />
        {/* Seeded arcane sigil: a faint watermark, no two alike. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[6%] flex justify-center mix-blend-screen">
          <ArcaneSigil seed={seed} className="!w-[70%] !max-w-[240px] opacity-25" />
        </div>
        {/* Age patina: weathers older papers; newest stays clear. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#6b4f2a] via-transparent to-[#1a120a] mix-blend-overlay"
          style={{ opacity: patina }}
        />
        <div className="tcard-foil" aria-hidden="true" />
        <div className="tcard-glare" aria-hidden="true" />

        {/* Top row: set + year chips. */}
        <div className="relative z-10 flex items-start justify-between gap-2 p-4">
          {variantCount > 1 ? (
            <span className="rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--lvl)_75%,white)] backdrop-blur-sm">
              Set {variantIndex + 1} of {variantCount}
            </span>
          ) : <span />}
          {paper.year !== null && (
            <span
              className={cn(
                'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums backdrop-blur-sm',
                fresh
                  ? 'border-amber-300/60 bg-amber-300/15 text-amber-200'
                  : 'border-white/15 bg-black/45 text-white/75',
              )}
            >
              {paper.year}
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* Reading panel: name, the three facts that matter, then the action. */}
        <div className="relative z-10 px-4 pb-4">
          <h3 className="line-clamp-2 font-display text-[1.2rem] font-normal leading-snug tracking-tight text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
            {formatPaperName(paper.paperName, paper.year ?? undefined)}
          </h3>
          {paper.isNew === 1 && (
            <span className="paper-new mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
              <Sparkles className="h-3 w-3" /> New
            </span>
          )}

          <dl className="mt-3 grid grid-cols-3 gap-1.5">
            <Stat icon={<ListChecks className="h-3.5 w-3.5" />} value={`${paper.questionCount}`} label="Questions" />
            <Stat icon={<Clock className="h-3.5 w-3.5" />} value={`${getExamDurationMinutes(examId)}m`} label="Duration" />
            <Stat icon={<Trophy className="h-3.5 w-3.5" />} value={`${paper.calculatedTotalMarks || paper.totalScore || '—'}`} label="Marks" />
          </dl>

          <span className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[rgba(214,178,110,0.45)] bg-[rgba(214,178,110,0.12)] text-sm font-medium text-amber-50 transition-colors group-hover:bg-[rgba(214,178,110,0.24)]">
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            {charging ? 'Summoning…' : 'Take test'}
          </span>
        </div>

        {/* Ornate gold frame (not the level tint), corner brackets, summon overlays. */}
        <div
          className="tcard-frame"
          aria-hidden="true"
          style={{ borderColor: 'rgba(214,178,110,0.32)', boxShadow: 'inset 0 0 0 1px rgba(214,178,110,0.12)' }}
        />
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
      <div className="flex items-end justify-between gap-4 border-b border-white/15 pb-2 [text-shadow:0_1px_8px_rgba(0,0,0,0.55)]">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <h2 className="font-display text-2xl font-normal tracking-tight text-white">{bundle.bundleLabel}</h2>
          <span className="text-sm text-white/70">
            {bundle.dateLabel}
            {bundle.termLabel ? ` · ${bundle.termLabel}` : ''}
          </span>
        </div>
        <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-white/60">
          {bundle.variantCount} {bundle.variantCount === 1 ? 'set' : 'sets'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
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

/** A face-down paper card: same gold frame and proportions as the real deck. */
function PaperCardSkeleton() {
  return (
    <div className="relative flex aspect-[5/7] flex-col overflow-hidden rounded-2xl border border-[rgba(214,178,110,0.3)] bg-[#15120c]/80 p-4 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7),inset_0_0_0_1px_rgba(214,178,110,0.1)]">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <div className="flex-1" />
      <Skeleton className="h-5 w-4/5 rounded-md" />
      <Skeleton className="mt-2 h-5 w-1/2 rounded-md" />
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
      <Skeleton className="mt-3 h-9 w-full rounded-lg" />
    </div>
  );
}

/** Two bundle rows of face-down cards. */
function BundlesSkeleton() {
  return (
    <div className="space-y-12">
      {[4, 3].map((cards, section) => (
        <section key={section} className="space-y-4">
          <div className="flex items-end justify-between gap-4 border-b border-white/15 pb-2">
            <Skeleton className="h-7 w-48 rounded-md" />
            <Skeleton className="h-3 w-12 rounded-full" />
          </div>
          <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: cards }, (_, i) => (
              <PaperCardSkeleton key={i} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function LoadingSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <SkeletonRegion label="Loading paper bundles" tone="glass" className="relative isolate space-y-8">
      <ExamHallBackdrop />
      <header className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 -ml-2 text-white/75 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3.5">
              <Skeleton className="hidden h-14 w-14 shrink-0 rounded-2xl sm:block" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-24 rounded-full" />
                <Skeleton className="h-10 w-64 rounded-lg sm:h-12 sm:w-80" />
                <Skeleton className="h-3.5 w-40 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-11 w-56 rounded-xl" />
          </div>
          <Skeleton className="h-11 w-full rounded-xl md:w-72" />
        </div>
      </header>
      <BundlesSkeleton />
    </SkeletonRegion>
  );
}

export default function CoursePage() {
  const { examId, courseId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Return to wherever the user actually came from (dashboard, search, exam
  // list). Fall back to the dashboard on a fresh/deep-linked load where there
  // is no in-app history to pop.
  const goBack = () => {
    // Exam-tab switches use `replace`, so they never add a history entry. If a
    // real in-app entry sits behind us (history index > 0), step back to the
    // origin (dashboard, search, exam list); otherwise — a deep-link or fresh
    // load — fall back to the dashboard.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
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
        // Keep any previously-loaded course/bundles so the header and tabs stay
        // mounted; the list region renders the error. Only a first-ever load
        // (course still null) falls back to the full-page error panel.
        setLoadFailed(true);
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

  // First-ever load (nothing cached yet) shows the full skeleton. Once we have a
  // course, exam-type switches keep the chrome (backdrop, header, tabs) mounted
  // and only the list region below reloads — see the list switch in the return.
  if (loading && !course) {
    return <LoadingSkeleton onBack={goBack} />;
  }

  if (loadFailed && !course) {
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

  return (
    <div className="relative isolate space-y-8">
      {/* `isolate` + `-z-10` keeps the scene above the app background but
          below the content. */}
      <ExamHallBackdrop />

      <header className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          className="gap-1.5 -ml-2 text-white/75 hover:bg-white/10 hover:text-white"
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
                  'hidden h-14 w-14 shrink-0 rounded-2xl object-cover object-top ring-2 ring-offset-2 ring-offset-black/40 sm:block',
                  levelMeta.ring,
                )}
              />
              <div className="min-w-0 [text-shadow:0_1px_10px_rgba(0,0,0,0.55)]">
                <p className={cn('mb-0.5 text-xs font-semibold uppercase tracking-[0.18em]', levelMeta.text)}>
                  {levelMeta.label}
                </p>
                <h1 className="font-display text-4xl font-normal leading-[1.05] tracking-tight text-white sm:text-5xl">
                  {displayCourseName}
                </h1>
                <p className="mt-1 text-sm text-white/75">
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
            <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
            <input
              id="bundle-search-input"
              type="text"
              placeholder="Search bundles or papers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              className="squircle w-full rounded-xl border border-white/10 bg-black/35 py-2.5 pl-10 pr-10 text-sm text-white backdrop-blur-md placeholder:text-white/55 transition-all focus:border-white/30 focus:bg-black/50 focus:outline-none focus:ring-2 focus:ring-white/20"
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

      {/* List region — the only part that reloads on an exam-type switch. While
          a refetch is in flight we keep the previous cards visible but dimmed
          (stale-while-revalidate) rather than tearing the page down. */}
      {loadFailed ? (
        <StatePanel
          compact
          tone="error"
          icon={(
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <FileText className="h-7 w-7 text-destructive" />
            </div>
          )}
          title="Unable to load papers"
          description={`Could not load papers for ${examName}.`}
          actions={(
            <Button variant="default" onClick={() => setRetryNonce((value) => value + 1)}>
              Retry
            </Button>
          )}
          announce
        />
      ) : loading && bundles.length === 0 ? (
        <SkeletonRegion label="Loading papers" tone="glass">
          <BundlesSkeleton />
        </SkeletonRegion>
      ) : bundles.length === 0 ? (
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
      ) : filteredBundles.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Layers aria-hidden="true" className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No bundles match "{searchQuery}"</p>
          <button type="button" onClick={() => setSearchQuery('')} className="mt-2 text-primary hover:underline">
            Clear search
          </button>
        </div>
      ) : (
        <div
          className={cn('space-y-12 transition-opacity duration-300', loading && 'pointer-events-none opacity-40')}
          aria-busy={loading || undefined}
        >
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
