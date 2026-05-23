import { ArrowRight, FileText, Code, GraduationCap, Search, BookOpen, Clock, Award } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";
import { useEffect, useState } from "react";
import { getDatasetStats, type DatasetStats } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomePage() {
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    logger.info('HomePage mounted');
    const controller = new AbortController();

    getDatasetStats({ signal: controller.signal })
      .then((data) => {
        setStats(data);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        logger.error('Failed to load dataset stats', error);
      });

    return () => {
      controller.abort();
      logger.debug('HomePage unmounted');
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const exams = [
    {
      slug: 'quiz1',
      name: 'Quiz 1',
      description: 'Mid-term assessment covering the first half of each course',
      icon: FileText,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      slug: 'quiz2',
      name: 'Quiz 2',
      description: 'Mid-term assessment covering the second half of each course',
      icon: FileText,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    {
      slug: 'end-term',
      name: 'End Term',
      description: 'Comprehensive final exam covering the entire course syllabus',
      icon: GraduationCap,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      slug: 'oppe',
      name: 'OPPE',
      description: 'Online Programming Practical Exam with hands-on coding questions',
      icon: Code,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
    },
  ];

  const features = [
    {
      icon: BookOpen,
      title: "Browse by course",
      description: "Find papers organized by course and program level",
    },
    {
      icon: Clock,
      title: "Practice anytime",
      description: "Access questions with instant answer feedback",
    },
    {
      icon: Award,
      title: "Track progress",
      description: "See your score and review correct answers",
    },
  ];

  return (
    <div className="space-y-16 pb-8">
      {/* Hero Section */}
      <section className="pt-8 md:pt-12">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            IITM BS exam archive
          </h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            Practice with{' '}
            <span className="text-foreground font-medium">
              {stats?.paperVariantCount?.toLocaleString() ?? '3,800+'}
            </span>{' '}
            past papers from{' '}
            <span className="text-foreground font-medium">
              {stats?.courseCount ? `${stats.courseCount}+` : '120+'}
            </span>{' '}
            courses. Browse by exam type, filter by year, and test yourself with real questions.
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mt-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search for a course..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-border bg-card py-4 pl-12 pr-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Exam Types Grid */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Browse by exam type
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {exams.map((exam) => {
            const Icon = exam.icon;
            return (
              <Link
                key={exam.slug}
                to={`/exam/${exam.slug}`}
                className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${exam.bgColor} ${exam.color} transition-colors`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                        {exam.name}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                        {exam.description}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Stats Section */}
      <section className="rounded-xl border border-border bg-card/50 p-8">
        <div className="grid gap-8 sm:grid-cols-3">
          <div className="text-center sm:text-left">
            {stats ? (
              <p className="text-3xl font-bold text-foreground tabular-nums">
                {stats.paperVariantCount?.toLocaleString()}
              </p>
            ) : (
              <Skeleton className="h-9 w-24 mb-1" />
            )}
            <p className="mt-1 text-sm text-muted-foreground">Past papers</p>
          </div>
          <div className="text-center sm:text-left">
            {stats ? (
              <p className="text-3xl font-bold text-foreground tabular-nums">
                {stats.questionCount?.toLocaleString()}
              </p>
            ) : (
              <Skeleton className="h-9 w-32 mb-1" />
            )}
            <p className="mt-1 text-sm text-muted-foreground">Practice questions</p>
          </div>
          <div className="text-center sm:text-left">
            {stats ? (
              <p className="text-3xl font-bold text-foreground tabular-nums">
                {stats.courseCount}
              </p>
            ) : (
              <Skeleton className="h-9 w-16 mb-1" />
            )}
            <p className="mt-1 text-sm text-muted-foreground">Courses covered</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          How it works
        </h2>

        <div className="grid gap-6 sm:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-medium text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Programs Section */}
      <section className="rounded-xl border border-border bg-card/50 p-8">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6">
          Programs covered
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { name: 'Foundation', courses: '8 courses', desc: 'Math, Stats, Programming, English' },
            { name: 'Diploma in Programming', courses: '6 courses', desc: 'DBMS, PDSA, App Dev, Java' },
            { name: 'Diploma in Data Science', courses: '7 courses', desc: 'ML, Analytics, Data Management' },
            { name: 'Degree Level', courses: '40+ electives', desc: 'Advanced topics & specializations' },
          ].map((program) => (
            <div key={program.name} className="space-y-1">
              <p className="font-medium text-foreground">{program.name}</p>
              <p className="text-sm text-muted-foreground">{program.courses}</p>
              <p className="text-xs text-muted-foreground/70">{program.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
