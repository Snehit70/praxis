import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, ArrowRight } from 'lucide-react';
import { logger } from '@/lib/logger';
import { getExamUuidFromSlug, getExamNameFromSlug } from '@/lib/examMapping';
import { useEffect } from 'react';

export default function ExamPage() {
  const { examId } = useParams();
  const examUuid = examId ? getExamUuidFromSlug(examId) : null;
  const examName = examId ? getExamNameFromSlug(examId) : null;

  useEffect(() => {
    logger.info('ExamPage mounted', { examId, examUuid, examName });
    return () => {
      logger.debug('ExamPage unmounted');
    };
  }, [examId, examUuid, examName]);

  const courses = useQuery(
    api.queries.getCoursesByExamUuid,
    examUuid ? { examUuid } : 'skip'
  );

  if (!examUuid) {
    logger.error('Invalid exam slug', { examId });
    return (
      <div className="text-center py-20 space-y-4">
        <BookOpen className="h-16 w-16 text-muted-foreground mx-auto" />
        <h2 className="text-2xl font-bold">Invalid Exam</h2>
        <p className="text-muted-foreground">
          The exam "{examId}" does not exist.
        </p>
        <Button asChild>
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    );
  }

  if (courses === undefined) {
    logger.debug('Loading courses...', { examId, examUuid });
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading courses...</p>
        </div>
      </div>
    );
  }

  if (courses === null || courses.length === 0) {
    logger.warn('No courses found for exam', { examId, examUuid });
    return (
      <div className="text-center py-20 space-y-4">
        <BookOpen className="h-16 w-16 text-muted-foreground mx-auto" />
        <h2 className="text-2xl font-bold">No Courses Found</h2>
        <p className="text-muted-foreground">
          No courses available for exam: {examName || examId}
        </p>
        <Button asChild>
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    );
  }

  logger.info('Courses loaded successfully', { examId, examUuid, count: courses.length });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{examName || examId}</h2>
        <p className="text-muted-foreground mt-2">
          Select a course to view available papers
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <Card
            key={course._id}
            className="hover:border-primary/50 transition-colors cursor-pointer group"
          >
            <Link to={`/course/${course.uuid}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="group-hover:text-primary transition-colors">
                      {course.courseName}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {course.courseCode}
                    </CardDescription>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  {course.paperCount} {course.paperCount === 1 ? 'paper' : 'papers'} available
                </div>
              </CardHeader>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
