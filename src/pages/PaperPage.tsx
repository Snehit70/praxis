import { useParams, Link } from 'react-router-dom';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, FileText, CheckCircle2, Circle, HelpCircle, Award } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { formatPaperName } from '@/lib/paperUtils';
import { getExamSlugFromUuid } from '@/lib/examMapping';
import { getDisplayCourseName } from '@/lib/courseMapping';
import { logger } from '@/lib/logger';

type QuestionType = 'MCQ' | 'MSQ' | 'SA' | 'COMPREHENSION' | 'OPPE';

interface Option {
  optionText: string;
  optionImage?: string;
  isCorrect: number;
  optionNumber?: number;
}

interface Question {
  uuid: string;
  questionNumber: number;
  questionType: QuestionType;
  totalMark: string;
  hash: string;
  questionText1?: string;
  questionText2?: string;
  questionText3?: string;
  questionText4?: string;
  questionText5?: string;
  questionImage1?: string;
  questionImage2?: string;
  questionImage3?: string;
  options: Option[];
}

export default function PaperPage() {
  const { paperId } = useParams();
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string | string[]>>({});
  const [showResults, setShowResults] = useState(false);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [paper, setPaper] = useState<any | null>(undefined); // undefined = loading, null = not found
  
  const getQuestionsAction = useAction(api.dynamo.getQuestionsByPaper);
  const getPaperAction = useAction(api.dynamo.getPaperByUuid);

  useEffect(() => {
    if (paperId) {
      setPaper(undefined);
      setQuestions(null);
      
      getPaperAction({ paperUuid: paperId })
        .then((data) => {
          setPaper(data || null);
        })
        .catch((err) => {
          logger.error('Failed to load paper metadata', err);
          setPaper(null);
        });

      getQuestionsAction({ paperUuid: paperId })
        .then((data) => {
          setQuestions(data as Question[]);
        })
        .catch((err) => {
          logger.error('Failed to load questions', err);
          setQuestions([]);
        });
    }
  }, [paperId]);

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

  const stats = useMemo(() => {
    if (!questions) return { total: 0, answered: 0, correct: 0, totalMarks: 0, scoredMarks: 0 };
    
    const total = questions.length;
    const answered = Object.keys(selectedAnswers).length;
    
    let correct = 0;
    let totalMarks = 0;
    let scoredMarks = 0;

    for (const q of questions) {
      const mark = parseFloat(q.totalMark) || 0;
      totalMarks += mark;

      if (showResults && selectedAnswers[q.uuid]) {
        const correctIndices = q.options
          .map((o, idx) => o.isCorrect === 1 ? String(idx) : null)
          .filter(Boolean) as string[];
          
        const selected = selectedAnswers[q.uuid];
        
        if (q.questionType === 'MCQ') {
          if (correctIndices.includes(selected as string)) {
            correct++;
            scoredMarks += mark;
          }
        } else if (q.questionType === 'MSQ') {
          const selectedArr = selected as string[];
          const isCorrect = correctIndices.length === selectedArr.length && 
            correctIndices.every(id => selectedArr.includes(id));
          if (isCorrect) {
            correct++;
            scoredMarks += mark;
          }
        }
      }
    }

    return { total, answered, correct, totalMarks, scoredMarks };
  }, [questions, selectedAnswers, showResults]);

  const handleOptionSelect = (questionId: string, optionIndex: string, questionType: QuestionType) => {
    if (showResults) return;

    setSelectedAnswers(prev => {
      if (questionType === 'MSQ') {
        const current = (prev[questionId] as string[]) || [];
        if (current.includes(optionIndex)) {
          return { ...prev, [questionId]: current.filter(id => id !== optionIndex) };
        }
        return { ...prev, [questionId]: [...current, optionIndex] };
      }
      return { ...prev, [questionId]: optionIndex };
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

  if (paper === undefined || questions === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading paper...</p>
        </div>
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
          <Link to={examSlug && paper.courseUuid ? `/exam/${examSlug}/course/${paper.courseUuid}` : '/'}>
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
          <Link to={examSlug && paper.courseUuid ? `/exam/${examSlug}/course/${paper.courseUuid}` : '/'}>
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
        {(questions as Question[]).map((question, index) => (
          <QuestionCard
            key={question.uuid}
            question={question}
            index={index}
            selectedAnswer={selectedAnswers[question.uuid]}
            showResults={showResults}
            onSelect={(optionIndex) => handleOptionSelect(question.uuid, optionIndex, question.questionType)}
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
  selectedAnswer, 
  showResults, 
  onSelect 
}: { 
  question: Question;
  index: number;
  selectedAnswer: string | string[] | undefined;
  showResults: boolean;
  onSelect: (optionIndex: string) => void;
}) {
  const questionTexts = [
    question.questionText1,
    question.questionText2,
    question.questionText3,
    question.questionText4,
    question.questionText5,
  ].filter(Boolean);

  const questionImages = [
    question.questionImage1,
    question.questionImage2,
    question.questionImage3,
  ].filter(Boolean);

  const marks = parseFloat(question.totalMark) || 0;
  const isMultiSelect = question.questionType === 'MSQ';

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
                {questionTexts.map((text, i) => (
                  <div 
                    key={i} 
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: text || '' }}
                  />
                ))}
                
                {questionImages.map((img, i) => (
                  <img 
                    key={i} 
                    src={img} 
                    alt={`Question ${index + 1} image ${i + 1}`}
                    className="max-w-full rounded-lg border"
                  />
                ))}
              </div>
              
              <div className="flex-shrink-0 text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                {marks} {marks === 1 ? 'mark' : 'marks'}
              </div>
            </div>

            {isMultiSelect && (
              <p className="text-xs text-muted-foreground">Select all that apply</p>
            )}

            <div className="space-y-2">
              {question.options.map((option, optIndex) => {
                const optionId = String(optIndex);
                const isSelected = isMultiSelect 
                  ? (selectedAnswer as string[] || []).includes(optionId)
                  : selectedAnswer === optionId;
                const isCorrect = option.isCorrect === 1;
                
                let optionStyle = 'border-border hover:border-primary/50 hover:bg-muted/50';
                if (showResults) {
                  if (isCorrect) {
                    optionStyle = 'border-green-500 bg-green-50 dark:bg-green-950/30';
                  } else if (isSelected && !isCorrect) {
                    optionStyle = 'border-red-500 bg-red-50 dark:bg-red-950/30';
                  }
                } else if (isSelected) {
                  optionStyle = 'border-primary bg-primary/5';
                }

                return (
                  <button
                    key={optIndex}
                    onClick={() => onSelect(optionId)}
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
                          src={option.optionImage} 
                          alt="Option"
                          className="mt-2 max-w-full rounded border"
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
