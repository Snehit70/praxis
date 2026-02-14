import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, ArrowRight, Calendar, Clock, Award } from 'lucide-react';
import { logger } from '@/lib/logger';
import { getExamUuidFromSlug, getExamNameFromSlug } from '@/lib/examMapping';
import { useEffect } from 'react';

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
          <span className="text-foreground">{course.courseName}</span>
        </div>
        <h2 className="text-3xl font-bold tracking-tight">{course.courseName}</h2>
        <p className="text-muted-foreground">
          {course.courseCode} • {papers.length} {papers.length === 1 ? 'paper' : 'papers'} available
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {papers.map((paper) => (
          <Card
            key={paper._id}
            className="hover:border-primary/50 transition-colors cursor-pointer group"
          >
            <Link to={`/paper/${paper.uuid}`}>
              <CardHeader>
                <div className="flex items-start justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  {paper.isNew === 1 && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                      New
                    </span>
                  )}
                </div>
                
                <div className="space-y-2">
                  <CardTitle className="group-hover:text-primary transition-colors flex items-center justify-between">
                    <span className="line-clamp-2">{paper.paperName}</span>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 ml-2 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </CardTitle>
                  
                  {paper.paperDescription && (
                    <CardDescription className="text-sm line-clamp-2">
                      {paper.paperDescription}
                    </CardDescription>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{paper.year}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{paper.duration} min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Award className="h-3.5 w-3.5" />
                    <span>{paper.totalScore} marks</span>
                  </div>
                </div>
              </CardHeader>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
