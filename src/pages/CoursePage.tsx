import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, ArrowRight, ArrowLeft, Calendar, HelpCircle, Award, Clock } from 'lucide-react';
import { logger } from '@/lib/logger';
import { getExamUuidFromSlug, getExamNameFromSlug } from '@/lib/examMapping';
import { useEffect, useMemo } from 'react';
import { getDisplayCourseName } from '@/lib/courseMapping';
import { formatPaperName } from '@/lib/paperUtils';

export default function CoursePage() {
  const { examId, courseId } = useParams();
  const examUuid = examId ? getExamUuidFromSlug(examId) : null;
  const examName = examId ? getExamNameFromSlug(examId) : null;

  useEffect(() => {
    logger.info('CoursePage mounted', { examId, courseId, examUuid });
    return () => {
      logger.debug('CoursePage unmounted');
    };
  }, [examId, courseId, examUuid]);

  const course = useQuery(
    api.queries.getCourseByUuid,
    courseId ? { courseUuid: courseId } : 'skip'
  );

  const papers = useQuery(
    api.queries.getPapersByExamAndCourse,
    examUuid && courseId ? { examUuid, courseUuid: courseId } : 'skip'
  );

  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS (React rules of hooks)
  const papersByYear = useMemo(() => {
    if (!papers || papers.length === 0) return {};
    const grouped: Record<number, typeof papers> = {};
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
      .sort((a, b) => b - a);
  }, [papersByYear]);

  const displayCourseName = useMemo(() => {
    if (!course) return '';
    return getDisplayCourseName(course.courseName);
  }, [course]);

  // Early returns AFTER all hooks
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

  if (course === undefined || papers === undefined) {
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

  if (papers === null || papers.length === 0) {
    logger.warn('No papers found for course', { examId, courseId });
    return (
      <div className="text-center py-20 space-y-4">
        <FileText className="h-16 w-16 text-muted-foreground mx-auto" />
        <h2 className="text-2xl font-bold">No Papers Found</h2>
        <p className="text-muted-foreground">
          No papers available for {course.courseName} in {examName}.
        </p>
        <Button asChild>
          <Link to={`/exam/${examId}`}>Back to {examName}</Link>
        </Button>
      </div>
    );
  }

  logger.info('Papers loaded successfully', { examId, courseId, count: papers.length });

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-2 -ml-2">
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
          <h2 className="text-3xl font-bold tracking-tight">{displayCourseName}</h2>
          <p className="text-muted-foreground">
            {course.courseCode !== course.courseName && `${course.courseCode} • `}
            {papers.length} {papers.length === 1 ? 'paper' : 'papers'} available
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {sortedYears.map((year) => (
          <div key={year} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Calendar className="h-4 w-4" />
              </div>
              <h3 className="text-xl font-semibold">{year}</h3>
              <span className="text-sm text-muted-foreground">
                {papersByYear[year]?.length ?? 0} {(papersByYear[year]?.length ?? 0) === 1 ? 'paper' : 'papers'}
              </span>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 pl-4">
              {(papersByYear[year] ?? []).map((paper) => {
                const formattedName = formatPaperName(paper.paperName, paper.year);
                const hasQuestions = paper.questionCount > 0;
                const totalMarks = paper.calculatedTotalMarks || 0;
                
                return (
                  <Card
                    key={paper._id}
                    className="hover:border-primary/50 transition-colors cursor-pointer group"
                  >
                    <Link to={`/paper/${paper.uuid}`}>
                      <CardHeader className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <FileText className="h-4 w-4" />
                          </div>
                          {paper.isNew === 1 && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                              New
                            </span>
                          )}
                        </div>
                        
                        <div className="space-y-1">
                          <CardTitle className="text-base group-hover:text-primary transition-colors flex items-center justify-between">
                            <span className="line-clamp-2">{formattedName}</span>
                            <ArrowRight className="h-4 w-4 flex-shrink-0 ml-2 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                          </CardTitle>
                        </div>

                        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                          {hasQuestions && (
                            <>
                              <div className="flex items-center gap-1">
                                <HelpCircle className="h-3 w-3" />
                                <span>{paper.questionCount} questions</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Award className="h-3 w-3" />
                                <span>{totalMarks} marks</span>
                              </div>
                            </>
                          )}
                          {!hasQuestions && (
                            <span className="text-muted-foreground/60">No questions loaded</span>
                          )}
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
