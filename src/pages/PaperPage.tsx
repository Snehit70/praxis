import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, CheckCircle2, XCircle, Circle, HelpCircle, Award } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
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

interface QuestionWithChildren extends QuizQuestion {
  subQuestions?: QuizQuestion[];
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
        logger.error('Failed to load local paper data', error);
        if (active) {
          setLoadFailed(true);
          setPaper(null);
          setQuestions([]);
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
  }, [paperId, courseId, examUuidFromSearch]);

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
      if (parent) {
        parent.subQuestions!.push(question);
      }
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

  const handleOptionSelect = (questionId: string, optionIndex: string, questionType: QuestionType) => {
    if (showResults) return;

    setSelectedAnswers((previous) => {
      if (questionType === 'MSQ') {
        const current = (previous[questionId] as string[]) || [];
        if (current.includes(optionIndex)) {
          return { ...previous, [questionId]: current.filter((id) => id !== optionIndex) };
        }
        return { ...previous, [questionId]: [...current, optionIndex] };
      }
      return { ...previous, [questionId]: optionIndex };
    });
  };

  if (!paperId) {
    return (
      <div className="text-center py-20 space-y-4">
        <h2 className="text-xl font-semibold">Invalid paper</h2>
        <Button asChild variant="outline"><Link to="/">Go home</Link></Button>
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
        <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-semibold">Unable to load paper</h2>
        <p className="text-sm text-muted-foreground">Could not read the archive for "{paperId}".</p>
        <Button asChild variant="outline">
          <Link to={examSlug ? `/exam/${examSlug}` : '/'}>Go back</Link>
        </Button>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="text-center py-20 space-y-4">
        <h2 className="text-xl font-semibold">Paper not found</h2>
        <Button asChild variant="outline"><Link to="/">Go home</Link></Button>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-muted-foreground">
          <Link to={examSlug ? `/exam/${examSlug}/course/${paper.courseUuid}` : '/'}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="text-center py-16 space-y-3">
          <h2 className="text-xl font-semibold">No questions available</h2>
          <p className="text-sm text-muted-foreground">Questions for this paper haven't been loaded yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-muted-foreground">
          <Link to={examSlug ? `/exam/${examSlug}/course/${paper.courseUuid}` : '/'}>
            <ArrowLeft className="h-4 w-4" />
            {displayCourseName}
          </Link>
        </Button>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{displayPaperName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {displayCourseName} · {paper.examName}
            </p>
          </div>

          <div className="flex items-center gap-3 text-sm flex-shrink-0">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <HelpCircle className="h-3.5 w-3.5" />
              <span>{stats.answered}/{stats.total}</span>
            </div>
            {showResults && (
              <div className="flex items-center gap-1.5 text-primary">
                <Award className="h-3.5 w-3.5" />
                <span>{stats.scoredMarks}/{stats.totalMarks} marks</span>
              </div>
            )}
          </div>
        </div>
      </div>

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

      {/* Sticky action bar */}
      <div className="sticky bottom-4 flex justify-center gap-3 pt-4">
        {!showResults ? (
          <Button
            size="lg"
            onClick={() => setShowResults(true)}
            disabled={stats.answered === 0}
          >
            Submit ({stats.answered}/{stats.total})
          </Button>
        ) : (
          <Button
            size="lg"
            variant="outline"
            onClick={() => { setSelectedAnswers({}); setShowResults(false); }}
          >
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  selectedAnswers,
  showResults,
  onSelectAnswer,
}: {
  question: QuestionWithChildren;
  index: number;
  selectedAnswers: Record<string, string | string[]>;
  showResults: boolean;
  onSelectAnswer: (questionId: string, optionIndex: string, questionType: QuestionType) => void;
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

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-3">
          {/* Question number */}
          <div className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center bg-muted text-muted-foreground text-xs font-semibold mt-0.5">
            {index + 1}
          </div>

          <div className="flex-1 space-y-3 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1 min-w-0">
                {questionTexts.map((text, textIndex) => (
                  <div
                    key={textIndex}
                    className="prose prose-sm dark:prose-invert max-w-none text-foreground"
                    dangerouslySetInnerHTML={{ __html: text ?? '' }}
                  />
                ))}

                {questionImages.map((image, imageIndex) => (
                  <img
                    key={imageIndex}
                    src={image}
                    alt={`Question ${index + 1} image ${imageIndex + 1}`}
                    className="max-w-full rounded border border-border"
                  />
                ))}
              </div>

              {marks > 0 && (
                <span className="flex-shrink-0 text-xs text-muted-foreground tabular-nums">
                  {marks}m
                </span>
              )}
            </div>

            {/* Options */}
            {!isComprehension && (
              <div className="space-y-1.5">
                {isMultiSelect && (
                  <p className="text-xs text-muted-foreground mb-2">Select all that apply</p>
                )}
                {question.options.map((option, optionIndex) => {
                  const optionId = String(optionIndex);
                  const isSelected = isMultiSelect
                    ? ((selectedAnswer as string[]) || []).includes(optionId)
                    : selectedAnswer === optionId;
                  const isCorrect = option.isCorrect === 1;

                  let optionClass = 'border-border hover:border-primary/40';
                  if (showResults) {
                    if (isCorrect) optionClass = 'border-green-600 bg-green-500/10';
                    else if (isSelected) optionClass = 'border-red-500 bg-red-500/10';
                  } else if (isSelected) {
                    optionClass = 'border-primary bg-primary/8';
                  }

                  return (
                    <button
                      key={optionIndex}
                      onClick={() => onSelectAnswer(question.uuid, optionId, question.questionType)}
                      disabled={showResults}
                      className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded border transition-colors text-left ${optionClass}`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {showResults ? (
                          isCorrect ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : isSelected ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground" />
                          )
                        ) : isSelected ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {option.optionText && (
                          <span
                            className="text-sm text-foreground"
                            dangerouslySetInnerHTML={{ __html: option.optionText }}
                          />
                        )}
                        {option.optionImage && (
                          <img
                            src={getOptionImageUrl(option.optionImage)}
                            alt="Option"
                            className="mt-2 max-w-full rounded border border-border"
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Comprehension sub-questions */}
            {isComprehension && question.subQuestions && question.subQuestions.length > 0 && (
              <div className="ml-2 pl-4 border-l border-border space-y-3 mt-4">
                {question.subQuestions.map((subQuestion, subIndex) => (
                  <QuestionCard
                    key={subQuestion.uuid}
                    question={subQuestion}
                    index={subIndex}
                    selectedAnswers={selectedAnswers}
                    showResults={showResults}
                    onSelectAnswer={onSelectAnswer}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
