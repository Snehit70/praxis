import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BookOpen, ArrowRight, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { logger } from '@/lib/logger';
import { getExamUuidFromSlug, getExamNameFromSlug } from '@/lib/examMapping';
import { useEffect, useState, useMemo } from 'react';
import {
  groupCoursesByLevel,
  getDisplayCourseName,
  getLevelDescription,
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
        <BookOpen className="h-12 w-12 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-semibold">Invalid exam</h2>
        <p className="text-sm text-muted-foreground">
          "{examId}" is not a valid exam.
        </p>
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
        <h2 className="text-xl font-semibold">Unable to load courses</h2>
        <p className="text-sm text-muted-foreground">
          Could not read the paper archive for {examName || examId}.
        </p>
        <Button asChild variant="outline">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <h2 className="text-xl font-semibold">No courses found</h2>
        <p className="text-sm text-muted-foreground">
          No courses available for {examName || examId}.
        </p>
        <Button asChild variant="outline">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-muted-foreground">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </Button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary mb-1">
            {examName}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Courses</h1>
          <p className="text-sm text-muted-foreground mt-1">{courses.length} courses available</p>
        </div>
      </div>

      <div className="space-y-4">
        {LEVEL_ORDER.map((level) => {
          const levelCourses = groupedCourses[level];
          if (levelCourses.length === 0) {
            return null;
          }

          const isExpanded = expandedLevels.has(level);

          return (
            <div key={level}>
              <button
                onClick={() => toggleLevel(level)}
                className="group flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-muted/50"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold group-hover:text-primary transition-colors">
                    {level}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {getLevelDescription(level)} · {levelCourses.length} courses
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="mt-2 grid gap-2 pl-4 md:grid-cols-2 lg:grid-cols-3">
                  {levelCourses.map((course) => (
                    <Link
                      key={course._id}
                      to={`/exam/${examId}/course/${course.uuid}`}
                      className="group flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/30 hover:bg-muted/40"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {getDisplayCourseName(course.courseName)}
                        </p>
                        {course.courseCode !== course.courseName && (
                          <p className="text-xs text-muted-foreground mt-0.5">{course.courseCode}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {course.paperCount} {course.paperCount === 1 ? 'paper' : 'papers'}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-3" />
                    </Link>
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
