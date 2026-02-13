import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowRight, BookOpen, Brain, GraduationCap, Target } from "lucide-react";
import { Link } from "react-router-dom";

export default function HomePage() {
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
        
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button size="lg" className="h-12 px-8 text-base" asChild>
            <Link to="/practice">
              Start Practicing
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild>
            <Link to="/courses">Browse Courses</Link>
          </Button>
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
