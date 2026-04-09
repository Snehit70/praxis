import { ArrowRight, FileText, Code, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";
import { logger } from "@/lib/logger";
import { useEffect, useState } from "react";
import { getDatasetStats, type DatasetStats } from "@/lib/api";

export default function HomePage() {
  const [stats, setStats] = useState<DatasetStats | null>(null);

  useEffect(() => {
    logger.info('HomePage mounted');

    getDatasetStats()
      .then((data) => {
        setStats(data);
      })
      .catch((error) => {
        logger.error('Failed to load dataset stats', error);
      });

    return () => {
      logger.debug('HomePage unmounted');
    };
  }, []);

  const exams = [
    {
      slug: 'quiz1',
      name: 'Quiz 1',
      description: 'Mid-term assessment, first half of the course',
      icon: FileText,
    },
    {
      slug: 'quiz2',
      name: 'Quiz 2',
      description: 'Mid-term assessment, second half of the course',
      icon: FileText,
    },
    {
      slug: 'end-term',
      name: 'End Term',
      description: 'Final exam covering the full course',
      icon: GraduationCap,
    },
    {
      slug: 'oppe',
      name: 'OPPE',
      description: 'Online Programming Practical Exam',
      icon: Code,
    },
  ];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="space-y-6 py-6">
        <h1 className="text-4xl font-bold tracking-[-0.03em] md:text-5xl">
          IITM BS exam archive
        </h1>
        <p className="max-w-xl text-muted-foreground leading-7">
          Browse past papers by exam type, course, and year. Practice with questions from the full archive.
        </p>

        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{stats?.paperVariantCount ?? '—'}+</span>{' '}
            papers
          </span>
          <span>
            <span className="font-semibold text-foreground">{stats?.courseCount ?? '—'}+</span>{' '}
            courses
          </span>
          <span>
            <span className="font-semibold text-foreground">{stats?.examCount ?? 4}</span>{' '}
            exam types
          </span>
        </div>
      </section>

      {/* Exam grid */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Choose exam type
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {exams.map((exam) => {
            const Icon = exam.icon;
            return (
              <Link
                key={exam.slug}
                to={`/exam/${exam.slug}`}
                className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-card/80"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground group-hover:text-primary transition-colors">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{exam.name}</p>
                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">{exam.description}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-2" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
