import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileText, ArrowRight, ArrowLeft, HelpCircle, Award, Clock } from 'lucide-react';
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

export default function CoursePage() {
  const { examId, courseId } = useParams();
  const examUuid = examId ? getExamUuidFromSlug(examId) : null;
  const examName = examId ? getExamNameFromSlug(examId) : null;
  const [papers, setPapers] = useState<PaperSummary[]>([]);
  const [course, setCourse] = useState<CourseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

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
      return () => {
        active = false;
      };
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
        logger.error('Failed to load local course data', error);
        if (active) {
          setLoadFailed(true);
          setCourse(null);
          setPapers([]);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [examUuid, courseId]);

  const papersByYear = useMemo(() => {
    const grouped: Record<number, PaperSummary[]> = {};
    for (const paper of papers) {
      const year = paper.year;
      if (!grouped[year]) {
        grouped[year] = [];
      }
      grouped[year].push(paper);
    }
    return grouped;
  }, [papers]);

  const sortedYears = useMemo(() => {
    return Object.keys(papersByYear)
      .map(Number)
      .sort((left, right) => right - left);
  }, [papersByYear]);

  const displayCourseName = useMemo(() => {
    if (!course) {
      return '';
    }
    return getDisplayCourseName(course.course_name);
  }, [course]);

  if (!examUuid || !courseId) {
    return (
      <div className="text-center py-20 space-y-4">
        <h2 className="text-xl font-semibold">Invalid course</h2>
        <Button asChild variant="outline">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="text-center py-20 space-y-4">
        <h2 className="text-xl font-semibold">Unable to load papers</h2>
        <p className="text-sm text-muted-foreground">
          Could not read the paper archive for this course.
        </p>
        <Button asChild variant="outline">
          <Link to={`/exam/${examId}`}>Back to {examName}</Link>
        </Button>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-20 space-y-4">
        <h2 className="text-xl font-semibold">Course not found</h2>
        <Button asChild variant="outline">
          <Link to={`/exam/${examId}`}>Back to {examName}</Link>
        </Button>
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <h2 className="text-xl font-semibold">No papers found</h2>
        <p className="text-sm text-muted-foreground">
          No papers available for {course.course_name} in {examName}.
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
      <div className="space-y-3">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-muted-foreground">
          <Link to={`/exam/${examId}`}>
            <ArrowLeft className="h-4 w-4" />
            {examName}
          </Link>
        </Button>

        <div>
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <span>/</span>
            <Link to={`/exam/${examId}`} className="hover:text-foreground transition-colors">{examName}</Link>
            <span>/</span>
            <span className="text-foreground">{displayCourseName}</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight">{displayCourseName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {course.course_code !== course.course_name && `${course.course_code} · `}
            {papers.length} {papers.length === 1 ? 'paper' : 'papers'}
          </p>
        </div>
      </div>

      {/* Papers by year */}
      <div className="space-y-8">
        {sortedYears.map((year) => (
          <div key={year} className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-[0.1em]">
              {year}
              <span className="ml-2 text-xs font-normal normal-case tracking-normal">
                {papersByYear[year]?.length ?? 0} {(papersByYear[year]?.length ?? 0) === 1 ? 'paper' : 'papers'}
              </span>
            </h2>

            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {(papersByYear[year] ?? []).map((paper) => {
                const formattedName = formatPaperName(paper.paperName, paper.year);
                const totalMarks = paper.calculatedTotalMarks || 0;

                return (
                  <Link
                    key={paper._id}
                    to={`/paper/${paper.uuid}?course=${courseId}&exam=${examId}`}
                    className="group flex items-start justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/40"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                            {formattedName}
                          </p>
                          {paper.paperDescription && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{paper.paperDescription}</p>
                          )}
                          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <HelpCircle className="h-3 w-3" />
                              {paper.questionCount}q
                            </span>
                            {totalMarks > 0 && (
                              <span className="flex items-center gap-1">
                                <Award className="h-3 w-3" />
                                {totalMarks}m
                              </span>
                            )}
                            {paper.duration > 0 && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {paper.duration}min
                              </span>
                            )}
                            {paper.isNew === 1 && (
                              <span className="text-primary font-medium">New</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-3 mt-0.5" />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
