import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Search, X, FileText, Play, Layers } from 'lucide-react';
import { logger } from '@/lib/logger';
import { getExamUuidFromSlug, getExamNameFromSlug } from '@/lib/examMapping';
import { useEffect, useMemo, useState } from 'react';
import { getDisplayCourseName } from '@/lib/courseMapping';
import { formatPaperName } from '@/lib/paperUtils';
import {
  getCourseByUuid,
  getPaperBundlesByExamAndCourseUuids,
  type CourseRecord,
  type PaperBundle,
  type PaperSummary,
} from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

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
      className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
    >
      <div className="mb-2 text-xs font-medium text-muted-foreground">CODE: {paper.uuid}</div>
      <p className="text-lg font-semibold text-foreground">{formatPaperName(paper.paperName, paper.year ?? undefined)}</p>
      <p className="mt-1 text-sm text-muted-foreground">{paper.paperDescription || 'No description'}</p>
      <Button className="mt-4 w-full gap-2" variant="outline">
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
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-foreground">{bundle.bundleLabel}</p>
            <p className="text-sm text-muted-foreground">{bundle.dateLabel}</p>
            {bundle.termLabel && <p className="text-xs text-muted-foreground mt-1">{bundle.termLabel}</p>}
          </div>
          <div className="text-xs text-muted-foreground">
            {bundle.variantCount} {bundle.variantCount === 1 ? 'variant' : 'variants'}
          </div>
        </div>
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
    <div className="space-y-8">
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
  const [searchParams] = useSearchParams();
  const examUuid = examId ? getExamUuidFromSlug(examId) : null;
  const examName = examId ? getExamNameFromSlug(examId) : null;
  const [bundles, setBundles] = useState<PaperBundle[]>([]);
  const [course, setCourse] = useState<CourseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const courseUuids = useMemo(() => {
    if (!courseId) return [];
    const aliases = searchParams
      .get('aliases')
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
    return Array.from(new Set([courseId, ...aliases]));
  }, [courseId, searchParams]);

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
  }, [courseId, courseUuids, examUuid]);

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

  if (!examUuid || !courseId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-xl font-semibold">Invalid course</h2>
        <p className="text-muted-foreground mt-1 mb-4">Course not found.</p>
        <Button asChild variant="outline">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return <LoadingSkeleton examId={examId!} examName={examName} />;
  }

  if (loadFailed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <FileText className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold">Unable to load bundles</h2>
        <p className="text-muted-foreground mt-1 mb-4">Could not load papers for this course.</p>
        <Button asChild variant="outline">
          <Link to={`/exam/${examId}`}>Back to {examName}</Link>
        </Button>
      </div>
    );
  }

  if (!course || bundles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
          <FileText className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">No papers found</h2>
        <p className="text-muted-foreground mt-1 mb-4">No papers available for this course in {examName}.</p>
        <Button asChild variant="outline">
          <Link to={`/exam/${examId}`}>Back to {examName}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-muted-foreground">
          <Link to={`/exam/${examId}`}>
            <ArrowLeft className="h-4 w-4" />
            {examName}
          </Link>
        </Button>

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">{examName}</p>
            <h1 className="text-3xl font-bold tracking-tight mt-1">{displayCourseName}</h1>
            <p className="text-muted-foreground mt-1">
              {bundles.length} bundles · {totalPapers} papers
              {courseUuids.length > 1 && ' across merged course variants'}
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search bundles or papers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {filteredBundles.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Layers className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No bundles match "{searchQuery}"</p>
          <button onClick={() => setSearchQuery('')} className="mt-2 text-primary hover:underline">
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
