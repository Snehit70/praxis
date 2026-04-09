import { useParams, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, ArrowRight, ArrowLeft, Calendar, HelpCircle, Award, Clock } from 'lucide-react';
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
    logger.error('Invalid exam or course slug', { examId, courseId });
    return (
      <div className="text-center py-20 space-y-4">
        <FileText className="h-16 w-16 text-muted-foreground mx-auto" />
        <h2 className="text-2xl font-bold">Invalid Course</h2>
        <p className="text-muted-foreground">
          The course or exam does not exist.
        </p>
        <Button asChild>
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    logger.debug('Loading course and papers...', { examId, courseId });
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading papers...</p>
        </div>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="text-center py-20 space-y-4">
        <FileText className="h-16 w-16 text-muted-foreground mx-auto" />
        <h2 className="text-2xl font-bold">Unable to Load Papers</h2>
        <p className="text-muted-foreground">
          The local paper archive for this course could not be read.
        </p>
        <Button asChild>
          <Link to={`/exam/${examId}`}>Back to {examName}</Link>
        </Button>
      </div>
    );
  }

  if (!course) {
    logger.error('Course not found', { courseId });
    return (
      <div className="text-center py-20 space-y-4">
        <FileText className="h-16 w-16 text-muted-foreground mx-auto" />
        <h2 className="text-2xl font-bold">Course Not Found</h2>
        <p className="text-muted-foreground">
          The course "{courseId}" does not exist.
        </p>
        <Button asChild>
          <Link to={`/exam/${examId}`}>Back to {examName}</Link>
        </Button>
      </div>
    );
  }

  if (papers.length === 0) {
    logger.warn('No papers found for course', { examId, courseId });
    return (
      <div className="text-center py-20 space-y-4">
        <FileText className="h-16 w-16 text-muted-foreground mx-auto" />
        <h2 className="text-2xl font-bold">No Papers Found</h2>
        <p className="text-muted-foreground">
          No papers available for {course.course_name} in {examName}.
        </p>
        <Button asChild>
          <Link to={`/exam/${examId}`}>Back to {examName}</Link>
        </Button>
      </div>
    );
  }

  logger.info('Papers loaded successfully', { examId, courseId, count: papers.length });

  return (
    <div className="space-y-8">
      <section className="rounded-[1.75rem] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,245,242,0.86))] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)] md:p-8">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-2 rounded-full px-3">
          <Link to={`/exam/${examId}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to {examName}
          </Link>
        </Button>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link to={`/exam/${examId}`} className="hover:text-primary transition-colors">
              {examName}
            </Link>
            <span>/</span>
            <span className="text-foreground">{displayCourseName}</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Archive by year</p>
          <h2 className="text-4xl font-semibold tracking-tight">{displayCourseName}</h2>
          <p className="text-muted-foreground">
            {course.course_code !== course.course_name && `${course.course_code} • `}
            {papers.length} {papers.length === 1 ? 'paper' : 'papers'} available
          </p>
        </div>
      </div>
      </section>

      <div className="space-y-8">
        {sortedYears.map((year) => (
          <div key={year} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
                <Calendar className="h-4 w-4" />
              </div>
              <h3 className="font-display text-2xl font-semibold">{year}</h3>
              <span className="text-sm text-muted-foreground">
                {papersByYear[year]?.length ?? 0} {(papersByYear[year]?.length ?? 0) === 1 ? 'paper' : 'papers'}
              </span>
            </div>

            <div className="grid gap-4 pl-2 md:grid-cols-2 lg:grid-cols-3">
              {(papersByYear[year] ?? []).map((paper) => {
                const formattedName = formatPaperName(paper.paperName, paper.year);
                const totalMarks = paper.calculatedTotalMarks || 0;

                return (
                  <Card
                    key={paper._id}
                    className="group cursor-pointer border-border/80 bg-card/95 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_16px_36px_rgba(0,0,0,0.07)]"
                  >
                    <Link to={`/paper/${paper.uuid}?course=${courseId}&exam=${examId}`}>
                      <CardHeader className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
                            <FileText className="h-4 w-4" />
                          </div>
                          {paper.isNew === 1 && (
                            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-primary">
                              New
                            </span>
                          )}
                        </div>

                        <div className="space-y-1">
                          <CardTitle className="flex items-center justify-between text-[1.15rem] group-hover:text-primary transition-colors">
                            <span className="line-clamp-2">{formattedName}</span>
                            <ArrowRight className="h-4 w-4 flex-shrink-0 ml-2 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                          </CardTitle>
                          <CardDescription>{paper.paperDescription}</CardDescription>
                        </div>

                        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <HelpCircle className="h-3 w-3" />
                            <span>{paper.questionCount} questions</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Award className="h-3 w-3" />
                            <span>{totalMarks} marks</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{paper.duration} min</span>
                          </div>
                        </div>
                      </CardHeader>
                    </Link>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
