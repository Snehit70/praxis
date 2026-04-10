import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft, Search, X, Calendar } from 'lucide-react';
import { logger } from '@/lib/logger';
import { getExamUuidFromSlug, getExamNameFromSlug } from '@/lib/examMapping';
import { useEffect, useMemo, useState } from 'react';
import { getDisplayCourseName } from '@/lib/courseMapping';
import { formatPaperName } from '@/lib/paperUtils';
import {
  getCourseByUuid,
  getPapersByExamAndCourse,
  type CourseRecord,
  type PaperSummary,
} from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

function PaperCard({ paper, courseId, examId }: {
  paper: PaperSummary;
  courseId: string;
  examId: string;
}) {
  const formattedName = formatPaperName(paper.paperName, paper.year);
  const totalMarks = paper.calculatedTotalMarks || 0;

  return (
    <Link
      to={`/paper/${paper.uuid}?course=${courseId}&exam=${examId}`}
      className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
          {formattedName}
        </p>
        <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
          <span>{paper.questionCount} questions</span>
          {totalMarks > 0 && <span>{totalMarks} marks</span>}
          {paper.duration > 0 && <span>{paper.duration} min</span>}
        </div>
      </div>
      {paper.isNew === 1 && (
        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
          New
        </span>
      )}
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </Link>
  );
}

function YearSection({
  year,
  papers,
  courseId,
  examId
}: {
  year: number;
  papers: PaperSummary[];
  courseId: string;
  examId: string;
}) {
  return (
    <section className="border-l-4 border-l-primary/30 pl-4 md:pl-6">
      <div className="mb-4 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">{year}</h2>
        <span className="text-sm text-muted-foreground">
          · {papers.length} {papers.length === 1 ? 'paper' : 'papers'}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {papers.map((paper) => (
          <PaperCard
            key={paper._id}
            paper={paper}
            courseId={courseId}
            examId={examId}
          />
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

      <div className="space-y-8">
        {[1, 2].map((i) => (
          <div key={i} className="border-l-4 border-l-muted pl-4 md:pl-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="rounded-lg border border-border bg-card p-4">
                  <Skeleton className="h-5 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CoursePage() {
  const { examId, courseId } = useParams();
  const examUuid = examId ? getExamUuidFromSlug(examId) : null;
  const examName = examId ? getExamNameFromSlug(examId) : null;
  const [papers, setPapers] = useState<PaperSummary[]>([]);
  const [course, setCourse] = useState<CourseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState<number | null>(null);

  useEffect(() => {
    logger.info('CoursePage mounted', { examId, courseId, examUuid });
    return () => {
      logger.debug('CoursePage unmounted');
    };
  }, [examId, courseId, examUuid]);

  useEffect(() => {
    let active = true;

    if (!examUuid || !courseId) {
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    setLoadFailed(false);

    Promise.all([
      getCourseByUuid(examUuid, courseId),
      getPapersByExamAndCourse(examUuid, courseId),
    ])
      .then(([courseData, paperData]) => {
        if (active) {
          setCourse(courseData);
          setPapers(paperData);
        }
      })
      .catch((error) => {
        logger.error('Failed to load course data', error);
        if (active) {
          setLoadFailed(true);
          setCourse(null);
          setPapers([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [examUuid, courseId]);

  const filteredPapers = useMemo(() => {
    let result = papers;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (paper) =>
          paper.paperName.toLowerCase().includes(query) ||
          paper.paperDescription?.toLowerCase().includes(query) ||
          formatPaperName(paper.paperName, paper.year).toLowerCase().includes(query)
      );
    }

    if (yearFilter !== null) {
      result = result.filter((paper) => paper.year === yearFilter);
    }

    return result;
  }, [papers, searchQuery, yearFilter]);

  const papersByYear = useMemo(() => {
    const grouped: Record<number, PaperSummary[]> = {};
    for (const paper of filteredPapers) {
      if (!grouped[paper.year]) grouped[paper.year] = [];
      grouped[paper.year]!.push(paper);
    }
    return grouped;
  }, [filteredPapers]);

  const sortedYears = useMemo(() => {
    return Object.keys(papersByYear).map(Number).sort((a, b) => b - a);
  }, [papersByYear]);

  const allYears = useMemo(() => {
    const years = new Set(papers.map((p) => p.year));
    return Array.from(years).sort((a, b) => b - a);
  }, [papers]);

  const displayCourseName = useMemo(() => {
    if (!course) return '';
    return getDisplayCourseName(course.course_name);
  }, [course]);

  // Error states
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
        <h2 className="text-xl font-semibold">Unable to load papers</h2>
        <p className="text-muted-foreground mt-1 mb-4">
          Could not load papers for this course.
        </p>
        <Button asChild variant="outline">
          <Link to={`/exam/${examId}`}>Back to {examName}</Link>
        </Button>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-xl font-semibold">Course not found</h2>
        <Button asChild variant="outline">
          <Link to={`/exam/${examId}`}>Back to {examName}</Link>
        </Button>
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-xl font-semibold">No papers found</h2>
        <p className="text-muted-foreground mt-1 mb-4">
          No papers available for {displayCourseName} in {examName}.
        </p>
        <Button asChild variant="outline">
          <Link to={`/exam/${examId}`}>Back to {examName}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
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
              {papers.length} {papers.length === 1 ? 'paper' : 'papers'} available
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search papers..."
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

        {/* Year Filter */}
        {allYears.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground mr-1">Filter:</span>
            <button
              onClick={() => setYearFilter(null)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                yearFilter === null
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
              }`}
            >
              All years
            </button>
            {allYears.map((year) => (
              <button
                key={year}
                onClick={() => setYearFilter(yearFilter === year ? null : year)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                  yearFilter === year
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Paper List */}
      {filteredPapers.length === 0 && (searchQuery || yearFilter) ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Search className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">
            {searchQuery ? `No papers match "${searchQuery}"` : `No papers from ${yearFilter}`}
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setYearFilter(null);
            }}
            className="mt-2 text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {sortedYears.map((year) => (
            <YearSection
              key={year}
              year={year}
              papers={papersByYear[year] ?? []}
              courseId={courseId!}
              examId={examId!}
            />
          ))}
        </div>
      )}
    </div>
  );
}
