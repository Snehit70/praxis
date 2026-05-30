import { useParams, Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Search, X, FileText, Play, Layers } from 'lucide-react';
import { logger } from '@/lib/logger';
import { getExamUuidFromSlug, getExamNameFromSlug } from '@/lib/examMapping';
import { useEffect, useMemo, useState } from 'react';
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
import { LEVEL_META } from '@/lib/courseCatalogue';
import pageBg from '@/assets/Sousou no Frieren - Ep. 18_ First-Class Mage Exam - 11_07.png';
import variantBg from '@/assets/Stark-banner.jpeg';

const EXAM_TABS = [
  { slug: 'quiz1', label: 'Quiz 1' },
  { slug: 'quiz2', label: 'Quiz 2' },
  { slug: 'end-term', label: 'End Term' },
  { slug: 'oppe', label: 'OPPE' },
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

function PaperVariantCard({
  paper,
  courseId,
  examId,
}: {
  paper: PaperSummary;
  courseId: string;
  examId: string;
}) {
  return (
    <Link
      to={`/paper/${paper.uuid}?course=${courseId}&exam=${examId}`}
      className="group relative isolate flex flex-col overflow-hidden rounded-lg border border-border p-4 transition-colors hover:border-primary/50"
    >
      {/* Card backdrop — Stark banner, covered to fill the card and dimmed
          left-to-bottom so the code, title and button stay legible. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <img
          src={variantBg}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/85 to-card/55" />
      </div>

      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">CODE: {paper.uuid}</div>
      <p className="text-lg font-semibold text-foreground">{formatPaperName(paper.paperName, paper.year ?? undefined)}</p>
      <p className="mt-1 text-sm text-muted-foreground">{paper.paperDescription || 'No description'}</p>
      <Button className="mt-4 w-full gap-2 backdrop-blur-sm" variant="outline">
        <Play className="h-4 w-4" />
        Take Test
      </Button>
    </Link>
  );
}

function BundleCard({
  bundle,
  courseId,
  examId,
}: {
  bundle: PaperBundle;
  courseId: string;
  examId: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4 border-b border-border/70 pb-2">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <h2 className="font-display text-xl font-normal tracking-tight text-foreground">{bundle.bundleLabel}</h2>
          <span className="text-sm text-muted-foreground">
            {bundle.dateLabel}
            {bundle.termLabel ? ` · ${bundle.termLabel}` : ''}
          </span>
        </div>
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {bundle.variantCount} {bundle.variantCount === 1 ? 'variant' : 'variants'}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {bundle.papers.map((paper) => (
          <PaperVariantCard key={paper._id} paper={paper} courseId={courseId} examId={examId} />
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
    <div className="relative isolate space-y-8">
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
        <div className="space-y-8">
          {filteredBundles.map((bundle) => (
            <BundleCard key={bundle.groupId} bundle={bundle} courseId={courseId!} examId={examId!} />
          ))}
        </div>
      )}
    </div>
  );
}
