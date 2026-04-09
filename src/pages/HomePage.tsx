import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowRight, BookOpen, Brain, Target, FileText, Code, GraduationCap } from "lucide-react";
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
      description: 'Mid-term assessment covering first half of the course',
      icon: FileText,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      slug: 'quiz2',
      name: 'Quiz 2',
      description: 'Mid-term assessment covering second half of the course',
      icon: FileText,
      color: 'from-purple-500 to-pink-500',
    },
    {
      slug: 'end-term',
      name: 'End Term Quiz',
      description: 'Comprehensive final exam covering entire course',
      icon: GraduationCap,
      color: 'from-orange-500 to-red-500',
    },
    {
      slug: 'oppe',
      name: 'OPPE',
      description: 'Online Programming Practical Exam',
      icon: Code,
      color: 'from-green-500 to-emerald-500',
    },
  ];

  return (
    <div className="space-y-14">
      <section className="relative overflow-hidden rounded-[2rem] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(246,245,242,0.92))] px-6 py-16 shadow-[0_12px_40px_rgba(0,0,0,0.05)] md:px-10 md:py-20">
        <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(0,117,222,0.12),transparent_60%)]" />
        <div className="relative text-center space-y-7">
          <div className="inline-flex items-center justify-center rounded-full border border-border bg-white/90 p-1.5 shadow-sm">
          <span className="flex items-center gap-2 px-3 py-0.5 text-sm font-medium text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/50 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Local-first practice archive
          </span>
        </div>
        
        <h1 className="mx-auto max-w-5xl text-5xl font-bold leading-[0.95] tracking-[-0.05em] text-foreground md:text-7xl">
          A calmer way to rehearse
          <br className="hidden md:block" />
          <span className="text-primary">
            every IITM exam.
          </span>
        </h1>
        
        <p className="mx-auto max-w-3xl text-lg leading-8 text-muted-foreground md:text-[1.25rem]">
          Browse the full paper archive by exam, course, and year, then practice inside a quiet interface designed for long reading sessions instead of dashboard noise.
        </p>

        <div className="grid gap-3 pt-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-white/90 px-4 py-4 text-left shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Coverage</p>
            <p className="mt-1 font-display text-3xl text-foreground">{stats?.examCount ?? 4}</p>
            <p className="text-sm text-muted-foreground">exam tracks</p>
          </div>
          <div className="rounded-2xl border border-border bg-white/90 px-4 py-4 text-left shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Catalog</p>
            <p className="mt-1 font-display text-3xl text-foreground">{stats?.courseCount ?? 0}+</p>
            <p className="text-sm text-muted-foreground">course variants</p>
          </div>
          <div className="rounded-2xl border border-border bg-white/90 px-4 py-4 text-left shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Archive</p>
            <p className="mt-1 font-display text-3xl text-foreground">{stats?.paperVariantCount ?? 0}+</p>
            <p className="text-sm text-muted-foreground">course-paper views</p>
          </div>
        </div>
        </div>
      </section>

      <section id="exam-grid" className="scroll-mt-24 space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Exam Index</p>
          <h2 className="text-4xl font-semibold tracking-tight">Choose your paper lane</h2>
          <p className="text-muted-foreground">Start from the exam first, then narrow down to course and year.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {exams.map((exam) => {
            const Icon = exam.icon;
            return (
              <Card
                key={exam.slug}
                className="group cursor-pointer overflow-hidden border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,245,242,0.85))] transition-all hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_18px_45px_rgba(0,0,0,0.08)]"
              >
                <Link to={`/exam/${exam.slug}`}>
                  <CardHeader className="space-y-6">
                    <div className="flex items-start justify-between">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${exam.color} text-white transition-transform group-hover:scale-105`}>
                      <Icon className="h-7 w-7" />
                      </div>
                      <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-foreground">
                        {exam.name}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <CardTitle className="flex items-center justify-between text-[1.55rem] transition-colors group-hover:text-primary">
                        <span>{exam.name}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
                      </CardTitle>
                      <CardDescription className="text-sm leading-6">
                        {exam.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Link>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 py-6 md:grid-cols-3">
        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary">
              <BookOpen className="h-6 w-6" />
            </div>
            <CardTitle>Comprehensive Question Bank</CardTitle>
            <CardDescription>
              Access a vast repository of questions from previous years across all your courses.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary">
              <Brain className="h-6 w-6" />
            </div>
            <CardTitle>Smart Analytics</CardTitle>
            <CardDescription>
              Track your performance, identify weak areas, and get personalized recommendations.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary">
              <Target className="h-6 w-6" />
            </div>
            <CardTitle>Exam Simulations</CardTitle>
            <CardDescription>
              Practice in timed conditions that mimic the real exam environment.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    </div>
  );
}
