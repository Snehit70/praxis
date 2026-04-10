import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw, Trophy } from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { formatPaperName } from '@/lib/paperUtils';
import { getExamSlugFromUuid, getExamUuidFromSlug } from '@/lib/examMapping';
import { getDisplayCourseName } from '@/lib/courseMapping';
import { logger } from '@/lib/logger';
import { getQuestionImageUrl, getOptionImageUrl } from '@/lib/imageUtils';
import {
  getPaperByUuid,
  getQuestionsByPaperUuid,
  type PaperDetails,
} from '@/lib/api';
import type { QuestionType, QuizQuestion } from '@/lib/dataTransforms';
import { Skeleton } from '@/components/ui/skeleton';

interface QuestionWithChildren extends QuizQuestion {
  subQuestions?: QuizQuestion[];
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

function LoadingSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 px-4 sm:px-0">
      <Skeleton className="h-4 w-24" />
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="flex gap-3 sm:gap-4">
              <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="space-y-2 pt-2">
                  {[1, 2, 3, 4].map((j) => (
                    <Skeleton key={j} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressBar({ answered, total }: { answered: number; total: number }) {
  const percentage = total > 0 ? (answered / total) * 100 : 0;
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full bg-primary transition-all duration-500 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

function StickyProgress({
  answered,
  total,
  visible,
}: {
  answered: number;
  total: number;
  visible: boolean;
}) {
  const percentage = total > 0 ? (answered / total) * 100 : 0;
  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="bg-background/95 backdrop-blur border-b border-border px-4 py-2 flex items-center gap-3">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {answered}/{total}
        </span>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs font-medium text-primary whitespace-nowrap">
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  );
}

function ResultsSummary({
  stats,
  onTryAgain,
}: {
  stats: { correct: number; total: number; scoredMarks: number; totalMarks: number };
  onTryAgain: () => void;
}) {
  const percentage = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const isGood = percentage >= 70;
  const isOkay = percentage >= 40 && percentage < 70;
  const scoreColor = isGood
    ? 'text-green-500'
    : isOkay
    ? 'text-yellow-500'
    : 'text-red-500';
  const bgColor = isGood
    ? 'bg-green-500/10 border-green-500/20'
    : isOkay
    ? 'bg-yellow-500/10 border-yellow-500/20'
    : 'bg-red-500/10 border-red-500/20';

  return (
    <div className={`rounded-xl border ${bgColor} p-5 sm:p-6`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="flex items-center gap-4 flex-1">
          <div className={`flex-shrink-0 w-14 h-14 rounded-full ${isGood ? 'bg-green-500/15' : isOkay ? 'bg-yellow-500/15' : 'bg-red-500/15'} flex items-center justify-center`}>
            <Trophy className={`h-7 w-7 ${scoreColor}`} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-0.5">Your score</p>
            <p className={`text-3xl font-bold leading-none ${scoreColor}`}>
              {stats.scoredMarks}
              <span className="text-lg font-normal text-muted-foreground ml-1">
                / {stats.totalMarks}
              </span>
            </p>
            <p className="text-sm text-muted-foreground mt-1.5">
              {stats.correct} of {stats.total} correct &middot; {percentage}%
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={onTryAgain} className="gap-2 sm:self-center">
          <RotateCcw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    </div>
  );
}

function QuestionTypeBadge({ type }: { type: string }) {
  if (type === 'MSQ') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
        MSQ
      </span>
    );
  }
  if (type === 'COMPREHENSION') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
        Passage
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-muted text-muted-foreground border border-border">
      MCQ
    </span>
  );
}

function OptionButton({
  option,
  optionIndex,
  isSelected,
  isCorrect,
  showResults,
  isMultiSelect,
  onClick,
}: {
  option: { optionText?: string | null; optionImage?: string | null };
  optionIndex: number;
  isSelected: boolean;
  isCorrect: boolean;
  showResults: boolean;
  isMultiSelect: boolean;
  onClick: () => void;
}) {
  const label = OPTION_LABELS[optionIndex] ?? String(optionIndex + 1);

  let containerClass =
    'w-full flex items-start gap-3 px-4 py-3 rounded-lg border-2 transition-all text-left cursor-pointer ';
  let indicatorClass =
    'flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold transition-colors ';

  if (showResults) {
    if (isCorrect) {
      containerClass += 'border-green-500 bg-green-500/10';
      indicatorClass += 'bg-green-500 text-white';
    } else if (isSelected) {
      containerClass += 'border-red-500 bg-red-500/10';
      indicatorClass += 'bg-red-500 text-white';
    } else {
      containerClass += 'border-border opacity-50';
      indicatorClass += 'bg-muted text-muted-foreground';
    }
  } else if (isSelected) {
    containerClass += 'border-primary bg-primary/5';
    indicatorClass += 'bg-primary text-primary-foreground';
  } else {
    containerClass +=
      'border-border hover:border-primary/40 hover:bg-muted/40 active:bg-muted/60';
    indicatorClass += 'bg-muted text-muted-foreground group-hover:text-foreground';
  }

  return (
    <button
      onClick={onClick}
      disabled={showResults}
      className={`group ${containerClass}`}
    >
      <div className={`mt-0.5 ${indicatorClass}`}>
        {showResults ? (
          isCorrect ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : isSelected ? (
            <XCircle className="h-4 w-4" />
          ) : (
            <span>{label}</span>
          )
        ) : (
          <span>{label}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {option.optionText && (
          <span
            className="text-sm text-foreground leading-relaxed"
            dangerouslySetInnerHTML={{ __html: option.optionText }}
          />
        )}
        {option.optionImage && (
          <img
            src={getOptionImageUrl(option.optionImage)}
            alt={`Option ${label}`}
            className="mt-2 max-w-full rounded border border-border"
            loading="lazy"
          />
        )}
      </div>
    </button>
  );
}

function QuestionCard({
  question,
  index,
  selectedAnswers,
  showResults,
  onSelectAnswer,
  isSubQuestion = false,
}: {
  question: QuestionWithChildren;
  index: number;
  selectedAnswers: Record<string, string | string[]>;
  showResults: boolean;
  onSelectAnswer: (questionId: string, optionIndex: string, questionType: QuestionType) => void;
  isSubQuestion?: boolean;
}) {
  const selectedAnswer = selectedAnswers[question.uuid];
  const questionTexts = [
    question.questionText1,
    question.questionText2,
    question.questionText3,
    question.questionText4,
    question.questionText5,
  ].filter(Boolean);

  const questionImages = [
    getQuestionImageUrl(question.questionImage1),
    getQuestionImageUrl(question.questionImage2),
    getQuestionImageUrl(question.questionImage3),
    getQuestionImageUrl(question.questionImage4),
    getQuestionImageUrl(question.questionImage5),
    getQuestionImageUrl(question.questionImage6),
    getQuestionImageUrl(question.questionImage7),
    getQuestionImageUrl(question.questionImage8),
    getQuestionImageUrl(question.questionImage9),
    getQuestionImageUrl(question.questionImage10),
  ].filter(Boolean);

  const marks = parseFloat(question.totalMark) || 0;
  const isMultiSelect = question.questionType === 'MSQ';
  const isComprehension = question.questionType === 'COMPREHENSION';

  if (isSubQuestion) {
    return (
      <div className="rounded-lg border border-border bg-card/50 p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center bg-muted text-muted-foreground text-xs font-bold">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <QuestionTypeBadge type={question.questionType} />
                  {marks > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {marks} {marks === 1 ? 'mark' : 'marks'}
                    </span>
                  )}
                </div>
                {questionTexts.map((text, textIndex) => (
                  <div
                    key={textIndex}
                    className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: text ?? '' }}
                  />
                ))}
                {questionImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {questionImages.map((image, imageIndex) => (
                      <img
                        key={imageIndex}
                        src={image}
                        alt={`Question ${index + 1} image ${imageIndex + 1}`}
                        className="max-w-full max-h-48 rounded border border-border object-contain"
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            {!isComprehension && (
              <div className="space-y-2">
                {isMultiSelect && (
                  <p className="text-xs text-muted-foreground">Select all that apply</p>
                )}
                {question.options.map((option, optionIndex) => {
                  const optionId = String(optionIndex);
                  const isSelected = isMultiSelect
                    ? ((selectedAnswer as string[]) || []).includes(optionId)
                    : selectedAnswer === optionId;
                  const isCorrect = option.isCorrect === 1;

                  return (
                    <OptionButton
                      key={optionIndex}
                      option={option}
                      optionIndex={optionIndex}
                      isSelected={isSelected}
                      isCorrect={isCorrect}
                      showResults={showResults}
                      isMultiSelect={isMultiSelect}
                      onClick={() => onSelectAnswer(question.uuid, optionId, question.questionType)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex gap-3 sm:gap-4">
        {/* Question number */}
        <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-muted text-muted-foreground text-sm font-bold">
          {index + 1}
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          {/* Header row: type badge + marks */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <QuestionTypeBadge type={question.questionType} />
            {marks > 0 && (
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {marks} {marks === 1 ? 'mark' : 'marks'}
              </span>
            )}
          </div>

          {/* Question text + images */}
          <div className="space-y-3">
            {questionTexts.map((text, textIndex) => (
              <div
                key={textIndex}
                className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: text ?? '' }}
              />
            ))}

            {questionImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {questionImages.map((image, imageIndex) => (
                  <img
                    key={imageIndex}
                    src={image}
                    alt={`Question ${index + 1} image ${imageIndex + 1}`}
                    className="max-w-full max-h-64 rounded-lg border border-border object-contain"
                    loading="lazy"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Options */}
          {!isComprehension && (
            <div className="space-y-2">
              {isMultiSelect && (
                <p className="text-xs text-muted-foreground italic">Select all that apply</p>
              )}
              {question.options.map((option, optionIndex) => {
                const optionId = String(optionIndex);
                const isSelected = isMultiSelect
                  ? ((selectedAnswer as string[]) || []).includes(optionId)
                  : selectedAnswer === optionId;
                const isCorrect = option.isCorrect === 1;

                return (
                  <OptionButton
                    key={optionIndex}
                    option={option}
                    optionIndex={optionIndex}
                    isSelected={isSelected}
                    isCorrect={isCorrect}
                    showResults={showResults}
                    isMultiSelect={isMultiSelect}
                    onClick={() => onSelectAnswer(question.uuid, optionId, question.questionType)}
                  />
                );
              })}
            </div>
          )}

          {/* Comprehension sub-questions */}
          {isComprehension && question.subQuestions && question.subQuestions.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Questions based on the above passage
              </p>
              {question.subQuestions.map((subQuestion, subIndex) => (
                <QuestionCard
                  key={subQuestion.uuid}
                  question={subQuestion}
                  index={subIndex}
                  selectedAnswers={selectedAnswers}
                  showResults={showResults}
                  onSelectAnswer={onSelectAnswer}
                  isSubQuestion
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PaperPage() {
  const { paperId } = useParams();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('course');
  const examId = searchParams.get('exam');
  const examUuidFromSearch = examId ? getExamUuidFromSlug(examId) : null;
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string | string[]>>({});
  const [showResults, setShowResults] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [paper, setPaper] = useState<PaperDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;

    if (!paperId) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setLoadFailed(false);
    setSelectedAnswers({});
    setShowResults(false);

    Promise.all([
      getPaperByUuid(paperId, courseId, examUuidFromSearch),
      getQuestionsByPaperUuid(paperId, courseId, examUuidFromSearch),
    ])
      .then(([paperData, questionData]) => {
        if (active) {
          setPaper(paperData);
          setQuestions(questionData);
        }
      })
      .catch((error) => {
        logger.error('Failed to load paper data', error);
        if (active) {
          setLoadFailed(true);
          setPaper(null);
          setQuestions([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [paperId, courseId, examUuidFromSearch]);

  // Sticky progress bar on scroll
  useEffect(() => {
    if (showResults) {
      setStickyVisible(false);
      return;
    }
    const handleScroll = () => {
      if (!headerRef.current) return;
      const { bottom } = headerRef.current.getBoundingClientRect();
      setStickyVisible(bottom < 0);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showResults]);

  const examSlug = useMemo(() => {
    if (!paper?.examUuid) return null;
    return getExamSlugFromUuid(paper.examUuid);
  }, [paper?.examUuid]);

  const displayCourseName = useMemo(() => {
    if (!paper?.courseName) return '';
    return getDisplayCourseName(paper.courseName);
  }, [paper?.courseName]);

  const displayPaperName = useMemo(() => {
    if (!paper?.paperName) return '';
    return formatPaperName(paper.paperName, paper.year);
  }, [paper?.paperName, paper?.year]);

  const groupedQuestions = useMemo(() => {
    const parentMap = new Map<string, QuestionWithChildren>();
    const topLevel: QuestionWithChildren[] = [];

    for (const question of questions) {
      if (question.questionType === 'COMPREHENSION' || !question.parentQuestionUuid) {
        parentMap.set(question.uuid, { ...question, subQuestions: [] });
      }
    }

    for (const question of questions) {
      if (!question.parentQuestionUuid) continue;
      const parent = parentMap.get(question.parentQuestionUuid);
      if (parent) parent.subQuestions!.push(question);
    }

    for (const question of questions) {
      if (!question.parentQuestionUuid) {
        topLevel.push(parentMap.get(question.uuid) ?? question);
      }
    }

    return topLevel;
  }, [questions]);

  const stats = useMemo(() => {
    const allQuestionIds = new Set<string>();

    for (const question of groupedQuestions) {
      if (question.questionType !== 'COMPREHENSION') {
        allQuestionIds.add(question.uuid);
      }
      if (question.subQuestions) {
        question.subQuestions.forEach((sq) => allQuestionIds.add(sq.uuid));
      }
    }

    const answered = Object.keys(selectedAnswers).filter((id) => allQuestionIds.has(id)).length;
    let correct = 0;
    let totalMarks = 0;
    let scoredMarks = 0;

    const countQuestion = (question: QuizQuestion) => {
      const marks = parseFloat(question.totalMark) || 0;
      totalMarks += marks;

      if (!showResults || !selectedAnswers[question.uuid]) return;

      const correctIndices = question.options
        .map((option, index) => (option.isCorrect === 1 ? String(index) : null))
        .filter((value): value is string => value !== null);

      const selected = selectedAnswers[question.uuid];

      if (question.questionType === 'MCQ') {
        if (correctIndices.includes(selected as string)) {
          correct++;
          scoredMarks += marks;
        }
      } else if (question.questionType === 'MSQ') {
        const selectedEntries = selected as string[];
        const isCorrect =
          correctIndices.length === selectedEntries.length &&
          correctIndices.every((v) => selectedEntries.includes(v));
        if (isCorrect) {
          correct++;
          scoredMarks += marks;
        }
      }
    };

    for (const question of groupedQuestions) {
      if (question.questionType !== 'COMPREHENSION') countQuestion(question);
      if (question.subQuestions) {
        for (const subQuestion of question.subQuestions) countQuestion(subQuestion);
      }
    }

    return { total: allQuestionIds.size, answered, correct, totalMarks, scoredMarks };
  }, [groupedQuestions, selectedAnswers, showResults]);

  const handleOptionSelect = (
    questionId: string,
    optionIndex: string,
    questionType: QuestionType
  ) => {
    if (showResults) return;

    setSelectedAnswers((prev) => {
      if (questionType === 'MSQ') {
        const current = (prev[questionId] as string[]) || [];
        if (current.includes(optionIndex)) {
          return { ...prev, [questionId]: current.filter((id) => id !== optionIndex) };
        }
        return { ...prev, [questionId]: [...current, optionIndex] };
      }
      return { ...prev, [questionId]: optionIndex };
    });
  };

  const handleTryAgain = () => {
    setSelectedAnswers({});
    setShowResults(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Error states
  if (!paperId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <h2 className="text-xl font-semibold">Invalid paper</h2>
        <p className="text-muted-foreground mt-1 mb-4">Paper ID not provided.</p>
        <Button asChild variant="outline">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (loadFailed || !paper) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <h2 className="text-xl font-semibold">Unable to load paper</h2>
        <p className="text-muted-foreground mt-1 mb-4">Could not load this paper.</p>
        <Button asChild variant="outline">
          <Link to={examSlug ? `/exam/${examSlug}` : '/'}>Go back</Link>
        </Button>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 px-4 sm:px-0">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-muted-foreground">
          <Link to={examSlug ? `/exam/${examSlug}/course/${paper.courseUuid}` : '/'}>
            <ArrowLeft className="h-4 w-4" />
            {displayCourseName}
          </Link>
        </Button>
        <div className="flex flex-col items-center py-16 text-center">
          <h2 className="text-xl font-semibold">No questions available</h2>
          <p className="text-muted-foreground mt-1">
            Questions for this paper haven't been loaded yet.
          </p>
        </div>
      </div>
    );
  }

  const allAnswered = stats.answered === stats.total;

  return (
    <>
      {/* Sticky progress bar */}
      <StickyProgress
        answered={stats.answered}
        total={stats.total}
        visible={stickyVisible && !showResults}
      />

      <div className="max-w-3xl mx-auto space-y-6 px-4 sm:px-0">
        {/* Header */}
        <header ref={headerRef} className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="gap-1.5 -ml-2 text-muted-foreground"
          >
            <Link to={examSlug ? `/exam/${examSlug}/course/${paper.courseUuid}` : '/'}>
              <ArrowLeft className="h-4 w-4" />
              {displayCourseName}
            </Link>
          </Button>

          <div>
            <p className="text-sm font-medium text-primary">{paper.examName}</p>
            <h1 className="text-2xl font-bold tracking-tight mt-1">{displayPaperName}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {stats.total} questions &middot; {stats.totalMarks} marks
            </p>
          </div>

          {/* Progress */}
          {!showResults && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {stats.answered} / {stats.total} answered
                </span>
              </div>
              <ProgressBar answered={stats.answered} total={stats.total} />
            </div>
          )}
        </header>

        {/* Results Summary */}
        {showResults && <ResultsSummary stats={stats} onTryAgain={handleTryAgain} />}

        {/* Questions */}
        <div className="space-y-4">
          {groupedQuestions.map((question, index) => (
            <QuestionCard
              key={question.uuid}
              question={question}
              index={index}
              selectedAnswers={selectedAnswers}
              showResults={showResults}
              onSelectAnswer={handleOptionSelect}
            />
          ))}
        </div>

        {/* Submit Button */}
        {!showResults && (
          <div className="sticky bottom-4 flex justify-center pt-4 pb-2">
            <Button
              size="lg"
              onClick={() => setShowResults(true)}
              disabled={stats.answered === 0}
              className={`shadow-lg gap-2 transition-all ${
                allAnswered
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : ''
              }`}
            >
              {allAnswered
                ? 'Submit answers'
                : `Submit (${stats.answered}/${stats.total} answered)`}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
