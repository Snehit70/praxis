import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowRight, BookOpen, Brain, Target, FileText, Code, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";
import { logger } from "@/lib/logger";
import { useEffect } from "react";

export default function HomePage() {
  useEffect(() => {
    logger.info('HomePage mounted');
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
    <div className="space-y-12">
      <section className="text-center py-20 space-y-6">
        <div className="inline-flex items-center justify-center p-1.5 mb-4 rounded-full bg-muted/50 backdrop-blur-sm border border-border/50">
          <span className="px-3 py-0.5 text-sm font-medium text-muted-foreground flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/50 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            New questions added weekly
          </span>
        </div>
        
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-6xl max-w-4xl mx-auto">
          Master Your Exams with <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-pink-500">
            Intelligent Practice
          </span>
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Access thousands of past year questions, get instant feedback, and track your progress with our advanced analytics platform.
        </p>
      </section>

      <section className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Choose Your Exam</h2>
          <p className="text-muted-foreground">Select an exam type to start practicing</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {exams.map((exam) => {
            const Icon = exam.icon;
            return (
              <Card
                key={exam.slug}
                className="bg-card/50 backdrop-blur border-muted/50 hover:border-primary/50 transition-all cursor-pointer group hover:shadow-lg"
              >
                <Link to={`/exam/${exam.slug}`}>
                  <CardHeader className="space-y-4">
                    <div className={`h-14 w-14 rounded-xl bg-gradient-to-br ${exam.color} flex items-center justify-center text-white group-hover:scale-110 transition-transform`}>
                      <Icon className="h-7 w-7" />
                    </div>
                    <div className="space-y-2">
                      <CardTitle className="group-hover:text-primary transition-colors flex items-center justify-between">
                        {exam.name}
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </CardTitle>
                      <CardDescription className="text-sm leading-relaxed">
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

      <section className="grid md:grid-cols-3 gap-6 py-12">
        <Card className="bg-card/50 backdrop-blur border-muted/50 hover:border-primary/20 transition-colors">
          <CardHeader>
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
              <BookOpen className="h-6 w-6" />
            </div>
            <CardTitle>Comprehensive Question Bank</CardTitle>
            <CardDescription>
              Access a vast repository of questions from previous years across all your courses.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-muted/50 hover:border-primary/20 transition-colors">
          <CardHeader>
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
              <Brain className="h-6 w-6" />
            </div>
            <CardTitle>Smart Analytics</CardTitle>
            <CardDescription>
              Track your performance, identify weak areas, and get personalized recommendations.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-muted/50 hover:border-primary/20 transition-colors">
          <CardHeader>
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
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
