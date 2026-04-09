import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, FileText, CheckCircle2, Circle, HelpCircle, Award } from 'lucide-react';
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
    if (!paper?.examUuid) {
      return null;
    }

    return getExamSlugFromUuid(paper.examUuid);
  }, [paper?.examUuid]);

  const displayCourseName = useMemo(() => {
    if (!paper?.courseName) {
      return '';
    }

    return getDisplayCourseName(paper.courseName);
  }, [paper?.courseName]);

  const displayPaperName = useMemo(() => {
    if (!paper?.paperName) {
      return '';
    }

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
      if (!question.parentQuestionUuid) {
        continue;
      }

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
        question.subQuestions.forEach((subQuestion) => allQuestionIds.add(subQuestion.uuid));
      }
    }

    const answered = Object.keys(selectedAnswers).filter((id) => allQuestionIds.has(id)).length;

    let correct = 0;
    let totalMarks = 0;
    let scoredMarks = 0;

    const countQuestion = (question: QuizQuestion) => {
      const marks = parseFloat(question.totalMark) || 0;
      totalMarks += marks;

      if (!showResults || !selectedAnswers[question.uuid]) {
        return;
      }

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
          correctIndices.every((value) => selectedEntries.includes(value));

        if (isCorrect) {
          correct++;
          scoredMarks += marks;
        }
      }
    };

    for (const question of groupedQuestions) {
      if (question.questionType !== 'COMPREHENSION') {
        countQuestion(question);
      }

      if (question.subQuestions) {
        for (const subQuestion of question.subQuestions) {
          countQuestion(subQuestion);
        }
      }
    }

    return {
      total: allQuestionIds.size,
      answered,
      correct,
      totalMarks,
      scoredMarks,
    };
  }, [groupedQuestions, selectedAnswers, showResults]);

  const handleOptionSelect = (questionId: string, optionIndex: string, questionType: QuestionType) => {
    if (showResults) {
      return;
    }

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

  const handleSubmit = () => {
    setShowResults(true);
  };

  const handleReset = () => {
    setSelectedAnswers({});
    setShowResults(false);
  };

  if (!paperId) {
    return (
      <div className="text-center py-20 space-y-4">
        <FileText className="h-16 w-16 text-muted-foreground mx-auto" />
        <h2 className="text-2xl font-bold">Invalid Paper</h2>
        <Button asChild>
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading paper...</p>
        </div>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="text-center py-20 space-y-4">
        <FileText className="h-16 w-16 text-muted-foreground mx-auto" />
        <h2 className="text-2xl font-bold">Unable to Load Paper</h2>
        <p className="text-muted-foreground">The local paper archive could not be read for "{paperId}".</p>
        <Button asChild>
          <Link to={examSlug ? `/exam/${examSlug}` : '/'}>Go Back</Link>
        </Button>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="text-center py-20 space-y-4">
        <FileText className="h-16 w-16 text-muted-foreground mx-auto" />
        <h2 className="text-2xl font-bold">Paper Not Found</h2>
        <p className="text-muted-foreground">The paper "{paperId}" does not exist.</p>
        <Button asChild>
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild className="gap-2 -ml-2">
          <Link to={examSlug ? `/exam/${examSlug}/course/${paper.courseUuid}` : '/'}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>

        <div className="text-center py-20 space-y-4">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto" />
          <h2 className="text-2xl font-bold">No Questions Available</h2>
          <p className="text-muted-foreground">Questions for this paper haven't been loaded yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-2 -ml-2">
          <Link to={examSlug ? `/exam/${examSlug}/course/${paper.courseUuid}` : '/'}>
            <ArrowLeft className="h-4 w-4" />
            Back to {displayCourseName}
          </Link>
        </Button>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{displayPaperName}</h1>
            <p className="text-muted-foreground mt-1">
              {displayCourseName} • {paper.examName}
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              <span>{stats.answered}/{stats.total} answered</span>
            </div>
            {showResults && (
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-lg">
                <Award className="h-4 w-4" />
                <span>{stats.scoredMarks}/{stats.totalMarks} marks</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
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

      <div className="sticky bottom-4 flex justify-center gap-4">
        {!showResults ? (
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={stats.answered === 0}
            className="shadow-lg"
          >
            Submit ({stats.answered}/{stats.total} answered)
          </Button>
        ) : (
          <Button
            size="lg"
            variant="outline"
            onClick={handleReset}
            className="shadow-lg"
          >
            Try Again
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
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
            {index + 1}
          </div>

          <div className="flex-1 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                {questionTexts.map((text, textIndex) => (
                  <div
                    key={textIndex}
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: text ?? '' }}
                  />
                ))}

                {questionImages.map((image, imageIndex) => (
                  <img
                    key={imageIndex}
                    src={image}
                    alt={`Question ${index + 1} image ${imageIndex + 1}`}
                    className="max-w-full rounded-lg border"
                  />
                ))}
              </div>

              {marks > 0 && (
                <div className="flex-shrink-0 text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                  {marks} {marks === 1 ? 'mark' : 'marks'}
                </div>
              )}
            </div>

            {!isComprehension && (
              <>
                {isMultiSelect && (
                  <p className="text-xs text-muted-foreground">Select all that apply</p>
                )}

                <div className="space-y-2">
                  {question.options.map((option, optionIndex) => {
                    const optionId = String(optionIndex);
                    const isSelected = isMultiSelect
                      ? ((selectedAnswer as string[]) || []).includes(optionId)
                      : selectedAnswer === optionId;
                    const isCorrect = option.isCorrect === 1;

                    let optionStyle = 'border-border hover:border-primary/50 hover:bg-muted/50';
                    if (showResults) {
                      if (isCorrect) {
                        optionStyle = 'border-green-500 bg-green-50';
                      } else if (isSelected) {
                        optionStyle = 'border-red-500 bg-red-50';
                      }
                    } else if (isSelected) {
                      optionStyle = 'border-primary bg-primary/5';
                    }

                    return (
                      <button
                        key={optionIndex}
                        onClick={() => onSelectAnswer(question.uuid, optionId, question.questionType)}
                        disabled={showResults}
                        className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${optionStyle}`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {showResults ? (
                            isCorrect ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : isSelected ? (
                              <Circle className="h-5 w-5 text-red-600" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground" />
                            )
                          ) : isSelected ? (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1">
                          {option.optionText && (
                            <span
                              className="text-sm"
                              dangerouslySetInnerHTML={{ __html: option.optionText }}
                            />
                          )}
                          {option.optionImage && (
                            <img
                              src={getOptionImageUrl(option.optionImage)}
                              alt="Option"
                              className="mt-2 max-w-full rounded border"
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {isComprehension && question.subQuestions && question.subQuestions.length > 0 && (
              <div className="ml-4 pl-4 border-l-2 border-primary/20 space-y-4">
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
      </CardContent>
    </Card>
  );
}
