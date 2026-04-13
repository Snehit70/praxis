import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileSearch, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getSearchResults,
  type SearchCourseResult,
  type SearchPaperResult,
} from '@/lib/api';
import { getDisplayCourseName } from '@/lib/courseMapping';
import { logger } from '@/lib/logger';
import { formatPaperName } from '@/lib/paperUtils';

function SearchSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </h2>
        <span className="text-sm text-muted-foreground">{count}</span>
      </div>
      {children}
    </section>
  );
}

function CourseResultCard({ course }: { course: SearchCourseResult }) {
  return (
    <Link
      to={`/exam/${course.examSlug}/course/${course.uuid}`}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground group-hover:text-primary transition-colors">
          {getDisplayCourseName(course.courseName)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {course.examName} · {course.courseCode} · {course.paperCount} papers
        </p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </Link>
  );
}

function PaperResultCard({ paper }: { paper: SearchPaperResult }) {
  return (
    <Link
      to={`/paper/${paper.uuid}?course=${encodeURIComponent(paper.courseUuid)}&exam=${encodeURIComponent(paper.examSlug)}`}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
          {formatPaperName(paper.paperName, paper.year)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
          {paper.examName} · {getDisplayCourseName(paper.courseName)}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {paper.questionCount} questions · {paper.calculatedTotalMarks} marks · {paper.duration} min
        </p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </Link>
  );
}

function SearchSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2].map((section) => (
        <div key={section} className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <div className="grid gap-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="rounded-xl border border-border bg-card p-4">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q')?.trim() ?? '';
  const [draftQuery, setDraftQuery] = useState(query);
  const [courses, setCourses] = useState<SearchCourseResult[]>([]);
  const [papers, setPapers] = useState<SearchPaperResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  useEffect(() => {
    let active = true;

    if (!query) {
      setCourses([]);
      setPapers([]);
      setLoadFailed(false);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setLoadFailed(false);

    getSearchResults(query)
      .then((results) => {
        if (!active) return;
        setCourses(results.courses);
        setPapers(results.papers);
      })
      .catch((error) => {
        logger.error('Failed to load search results', error);
        if (!active) return;
        setLoadFailed(true);
        setCourses([]);
        setPapers([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query]);

  const totalResults = useMemo(() => courses.length + papers.length, [courses.length, papers.length]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = draftQuery.trim();
    navigate(nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : '/search');
  };

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-muted-foreground">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </Button>

        <div className="space-y-3">
          <p className="text-sm font-medium text-primary">Global search</p>
          <h1 className="text-3xl font-bold tracking-tight">Find courses and papers</h1>
          <p className="text-muted-foreground">
            Search across exam types, courses, and paper titles from one place.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Search for a course, code, or paper..."
            className="w-full rounded-xl border border-border bg-card py-3.5 pl-12 pr-28 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2">
            Search
          </Button>
        </form>

        {query && !loading && !loadFailed && (
          <p className="text-sm text-muted-foreground">
            {totalResults} result{totalResults === 1 ? '' : 's'} for "{query}"
          </p>
        )}
      </header>

      {!query ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <FileSearch className="mx-auto h-12 w-12 text-muted-foreground/70" />
          <h2 className="mt-4 text-xl font-semibold">Start with a keyword</h2>
          <p className="mt-2 text-muted-foreground">
            Try a course name like Computational Thinking, a code like CT, or a paper title.
          </p>
        </div>
      ) : loading ? (
        <SearchSkeleton />
      ) : loadFailed ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-6 py-12 text-center">
          <h2 className="text-xl font-semibold">Unable to load results</h2>
          <p className="mt-2 text-muted-foreground">Please try your search again.</p>
        </div>
      ) : totalResults === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <FileSearch className="mx-auto h-12 w-12 text-muted-foreground/70" />
          <h2 className="mt-4 text-xl font-semibold">No matches found</h2>
          <p className="mt-2 text-muted-foreground">
            Try a broader course name, exam term, or paper title.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          <SearchSection title="Courses" count={courses.length}>
            {courses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No course matches.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {courses.map((course) => (
                  <CourseResultCard
                    key={`${course.examUuid}:${course.uuid}`}
                    course={course}
                  />
                ))}
              </div>
            )}
          </SearchSection>

          <SearchSection title="Papers" count={papers.length}>
            {papers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No paper matches.</p>
            ) : (
              <div className="grid gap-3">
                {papers.map((paper) => (
                  <PaperResultCard
                    key={`${paper.examUuid}:${paper.courseUuid}:${paper.uuid}`}
                    paper={paper}
                  />
                ))}
              </div>
            )}
          </SearchSection>
        </div>
      )}
    </div>
  );
}
