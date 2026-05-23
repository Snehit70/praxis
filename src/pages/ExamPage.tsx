import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BookOpen, ArrowRight, ArrowLeft, Search, X, FileText } from 'lucide-react';
import { logger } from '@/lib/logger';
import { getExamUuidFromSlug, getExamNameFromSlug } from '@/lib/examMapping';
import { useEffect, useState, useMemo } from 'react';
import {
  deduplicateCourses,
  groupDeduplicatedCoursesByLevel,
  getLevelColor,
  LEVEL_ORDER,
  type CourseLevel,
  type DeduplicatedCourse,
} from '@/lib/courseMapping';
import { getExamCourses, type CourseSummary } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

const LEVEL_INFO: Record<CourseLevel, { label: string; accent: string }> = {
  'Foundation': { label: 'Foundation Level', accent: 'border-l-blue-500' },
  'Diploma in Programming': { label: 'Diploma in Programming', accent: 'border-l-purple-500' },
  'Diploma in Data Science': { label: 'Diploma in Data Science', accent: 'border-l-orange-500' },
  'Degree': { label: 'Degree Level', accent: 'border-l-emerald-500' },
  'Other': { label: 'Other Courses', accent: 'border-l-gray-500' },
};

function CourseCard({ course, examId }: { course: DeduplicatedCourse; examId: string }) {
  const search = course.uuids.length > 1
    ? `?aliases=${encodeURIComponent(course.uuids.join(','))}`
    : '';

  return (
    <Link
      to={`/exam/${examId}/course/${course.primaryUuid}${search}`}
      className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors flex-shrink-0">
        <FileText className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
          {course.displayName}
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">
          {course.paperCount} {course.paperCount === 1 ? 'paper' : 'papers'}
        </p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </Link>
  );
}

function LevelSection({
  level,
  courses,
  examId
}: {
  level: CourseLevel;
  courses: DeduplicatedCourse[];
  examId: string;
}) {
  const info = LEVEL_INFO[level];
  const levelColor = getLevelColor(level);

  return (
    <section className={`border-l-4 ${info.accent} pl-4 md:pl-6`}>
      <div className="mb-4">
        <h2 className={`text-lg font-semibold ${levelColor}`}>
          {info.label}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {courses.length} {courses.length === 1 ? 'course' : 'courses'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <CourseCard key={course.primaryUuid} course={course} examId={examId} />
        ))}
      </div>
    </section>
  );
}

function LoadingSkeleton({ examName }: { examName: string | null }) {
  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-muted-foreground">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </Button>
        <div>
          <p className="text-sm font-medium text-primary">{examName}</p>
          <h1 className="text-3xl font-bold tracking-tight mt-1">Courses</h1>
        </div>
      </header>

      <div className="space-y-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border-l-4 border-l-muted pl-4 md:pl-6">
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-24 mb-4" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExamPage() {
  const { examId } = useParams();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') ?? '';
  const examUuid = examId ? getExamUuidFromSlug(examId) : null;
  const examName = examId ? getExamNameFromSlug(examId) : null;
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  useEffect(() => {
    logger.info('ExamPage mounted', { examId, examUuid, examName });
    return () => {
      logger.debug('ExamPage unmounted');
    };
  }, [examId, examUuid, examName]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    if (!examUuid) {
      setLoading(false);
      return () => {
        active = false;
        controller.abort();
      };
    }

    setLoading(true);
    setLoadFailed(false);

    getExamCourses(examUuid, { signal: controller.signal })
      .then((data) => {
        if (active) setCourses(data);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        logger.error('Failed to load courses', error);
        if (active) {
          setLoadFailed(true);
          setCourses([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [examUuid]);

  const deduplicatedCourses = useMemo(() => deduplicateCourses(courses), [courses]);

  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return deduplicatedCourses;
    const query = searchQuery.toLowerCase();
    return deduplicatedCourses.filter(
      (course) =>
        course.displayName.toLowerCase().includes(query) ||
        course.originalNames.some((name) => name.toLowerCase().includes(query))
    );
  }, [deduplicatedCourses, searchQuery]);

  const groupedCourses = useMemo(
    () => groupDeduplicatedCoursesByLevel(filteredCourses),
    [filteredCourses]
  );

  const totalPaperCount = useMemo(
    () => deduplicatedCourses.reduce((sum, c) => sum + c.paperCount, 0),
    [deduplicatedCourses]
  );

  // Error states
  if (!examUuid) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Invalid exam</h2>
        <p className="text-muted-foreground mt-1 mb-4">"{examId}" is not a valid exam type.</p>
        <Button asChild variant="outline">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return <LoadingSkeleton examName={examName} />;
  }

  if (loadFailed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <BookOpen className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold">Unable to load courses</h2>
        <p className="text-muted-foreground mt-1 mb-4">
          Could not load courses for {examName}. Please try again.
        </p>
        <Button asChild variant="outline">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
          <BookOpen className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">No courses found</h2>
        <p className="text-muted-foreground mt-1 mb-4">
          No courses available for {examName}.
        </p>
        <Button asChild variant="outline">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-muted-foreground">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </Button>

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">{examName}</p>
            <h1 className="text-3xl font-bold tracking-tight mt-1">Courses</h1>
            <p className="text-muted-foreground mt-1">
              {deduplicatedCourses.length} courses · {totalPaperCount.toLocaleString()} papers
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search courses..."
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

      {/* Course List */}
      {searchQuery && filteredCourses.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Search className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No courses match "{searchQuery}"</p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-2 text-primary hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {LEVEL_ORDER.map((level) => {
            const levelCourses = groupedCourses[level];
            if (levelCourses.length === 0) return null;
            return (
              <LevelSection
                key={level}
                level={level}
                courses={levelCourses}
                examId={examId!}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
