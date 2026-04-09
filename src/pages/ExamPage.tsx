import { useParams, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, ArrowRight, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { logger } from '@/lib/logger';
import { getExamUuidFromSlug, getExamNameFromSlug } from '@/lib/examMapping';
import { useEffect, useState, useMemo } from 'react';
import {
  groupCoursesByLevel,
  getDisplayCourseName,
  getLevelDescription,
  getLevelColor,
  LEVEL_ORDER,
  type CourseLevel,
} from '@/lib/courseMapping';
import { getExamCourses, type CourseSummary } from '@/lib/api';

export default function ExamPage() {
  const { examId } = useParams();
  const examUuid = examId ? getExamUuidFromSlug(examId) : null;
  const examName = examId ? getExamNameFromSlug(examId) : null;
  const [expandedLevels, setExpandedLevels] = useState<Set<CourseLevel>>(
    new Set(['Foundation', 'Diploma in Programming', 'Diploma in Data Science', 'Degree']),
  );
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    logger.info('ExamPage mounted', { examId, examUuid, examName });
    return () => {
      logger.debug('ExamPage unmounted');
    };
  }, [examId, examUuid, examName]);

  useEffect(() => {
    let active = true;

    if (!examUuid) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setLoadFailed(false);

    getExamCourses(examUuid)
      .then((data) => {
        if (active) {
          setCourses(data);
        }
      })
      .catch((error) => {
        logger.error('Failed to load local courses', error);
        if (active) {
          setLoadFailed(true);
          setCourses([]);
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
  }, [examUuid]);

  const groupedCourses = useMemo(() => groupCoursesByLevel(courses), [courses]);

  const toggleLevel = (level: CourseLevel) => {
    setExpandedLevels((previous) => {
      const next = new Set(previous);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

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

  if (loading) {
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

  if (loadFailed) {
    return (
      <div className="text-center py-20 space-y-4">
        <BookOpen className="h-16 w-16 text-muted-foreground mx-auto" />
        <h2 className="text-2xl font-bold">Unable to Load Courses</h2>
        <p className="text-muted-foreground">
          The local paper archive could not be read for {examName || examId}.
        </p>
        <Button asChild>
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    );
  }

  if (courses.length === 0) {
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
    <div className="space-y-8">
      <section className="rounded-[1.75rem] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,245,242,0.86))] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)] md:p-8">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-2 rounded-full px-3">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Back to Exams
          </Link>
        </Button>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Browse by course</p>
          <h2 className="mt-2 text-4xl font-semibold tracking-tight">{examName || examId}</h2>
          <p className="text-muted-foreground mt-2">
            Select a course to view available papers • {courses.length} courses
          </p>
        </div>
      </div>
      </section>

      <div className="space-y-6">
        {LEVEL_ORDER.map((level) => {
          const levelCourses = groupedCourses[level];
          if (levelCourses.length === 0) {
            return null;
          }

          const isExpanded = expandedLevels.has(level);
          const levelColor = getLevelColor(level);

          return (
            <div key={level} className="space-y-4">
              <button
                onClick={() => toggleLevel(level)}
                className="group flex w-full items-center gap-3 rounded-[1.25rem] border border-border/80 bg-card/90 p-4 text-left transition-all hover:border-primary/25 hover:bg-white"
              >
                <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${levelColor} flex items-center justify-center text-white flex-shrink-0`}>
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-xl font-semibold group-hover:text-primary transition-colors">
                    {level}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {getLevelDescription(level)} • {levelCourses.length} courses available
                  </p>
                </div>
              </button>

              {isExpanded && (
                <div className="grid gap-4 pl-2 md:grid-cols-2 lg:grid-cols-3">
                  {levelCourses.map((course) => (
                    <Card
                      key={course._id}
                      className="group cursor-pointer border-border/80 bg-card/95 transition-all hover:-translate-y-1 hover:border-primary/30"
                    >
                      <Link to={`/exam/${examId}/course/${course.uuid}`}>
                        <CardHeader className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-[1.15rem] group-hover:text-primary transition-colors line-clamp-2">
                                {getDisplayCourseName(course.courseName)}
                              </CardTitle>
                              {course.courseCode !== course.courseName && (
                                <CardDescription className="mt-1 text-xs">
                                  {course.courseCode}
                                </CardDescription>
                              )}
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0 ml-2" />
                          </div>
                          <div className="mt-3 text-xs text-muted-foreground">
                            {course.paperCount} {course.paperCount === 1 ? 'paper' : 'papers'}
                          </div>
                        </CardHeader>
                      </Link>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
