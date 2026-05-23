import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw, Trophy, Timer, Play, Pause } from 'lucide-react';
import type React from 'react';
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
const PAPER_SESSION_STORAGE_PREFIX = 'praxis.paper-session';

interface SavedPaperSession {
  selectedAnswers: Record<string, string | string[]>;
  showResults: boolean;
  timerRunning: boolean;
  remainingSeconds: number | null;
  timerEndsAt: number | null;
}

function getPaperSessionKey(paperId: string, courseId?: string | null, examId?: string | null) {
  return [PAPER_SESSION_STORAGE_PREFIX, paperId, courseId ?? 'none', examId ?? 'none'].join(':');
}

function readPaperSession(storageKey: string, durationMinutes: number): SavedPaperSession | null {
  if (typeof window === 'undefined') return null;

  const saved = window.localStorage.getItem(storageKey);
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as Partial<SavedPaperSession>;
    const durationSeconds = durationMinutes > 0 ? durationMinutes * 60 : null;
    const timerEndsAt = typeof parsed.timerEndsAt === 'number' ? parsed.timerEndsAt : null;
    const running = parsed.timerRunning === true && timerEndsAt !== null;
    const remainingSeconds = running
      ? Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000))
      : typeof parsed.remainingSeconds === 'number'
      ? Math.max(0, parsed.remainingSeconds)
      : durationSeconds;
    const expiredWhileAway = running && remainingSeconds === 0;

    return {
      selectedAnswers: parsed.selectedAnswers ?? {},
      showResults: parsed.showResults === true || expiredWhileAway,
      timerRunning: running && remainingSeconds !== null && remainingSeconds > 0,
      remainingSeconds,
      timerEndsAt: running && remainingSeconds !== null && remainingSeconds > 0 ? timerEndsAt : null,
    };
  } catch {
    return null;
  }
}

function clearPaperSession(storageKey: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey);
}

function formatRemainingTime(totalSeconds: number | null) {
  if (totalSeconds === null) return '--:--';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

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
      className={`fixed top-14 left-0 right-0 z-40 transition-transform duration-300 ${
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

function TimerPanel({
  durationMinutes,
  remainingSeconds,
  running,
  onStart,
  onPause,
  onReset,
  expired,
}: {
  durationMinutes: number;
  remainingSeconds: number | null;
  running: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  expired: boolean;
}) {
  const totalSeconds = durationMinutes * 60;
  const completion =
    totalSeconds > 0 && remainingSeconds !== null
      ? Math.min(100, Math.max(0, ((totalSeconds - remainingSeconds) / totalSeconds) * 100))
      : 0;

  return (
    <div className={`rounded-xl border p-4 ${expired ? 'border-destructive/40 bg-destructive/10' : 'border-border bg-card/70'}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Timer className={`h-4 w-4 ${expired ? 'text-destructive' : 'text-primary'}`} />
            Timed attempt
          </div>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold tabular-nums">{formatRemainingTime(remainingSeconds)}</span>
            <span className="pb-1 text-sm text-muted-foreground">of {durationMinutes} min</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {expired
              ? 'Time is up. Your answers were submitted automatically.'
              : running
              ? 'Timer is running and will continue even if you refresh.'
              : 'Start when you want to simulate the real exam clock.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={running ? onPause : onStart} variant={running ? 'outline' : 'default'}>
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? 'Pause' : expired ? 'Restart' : 'Start'}
          </Button>
          <Button onClick={onReset} variant="outline">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full transition-all duration-500 ${expired ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${completion}%` }} />
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
            {stats.totalMarks > 0 ? (
              <p className={`text-3xl font-bold leading-none ${scoreColor}`}>
                {stats.scoredMarks}
                <span className="text-lg font-normal text-muted-foreground ml-1">
                  / {stats.totalMarks} marks
                </span>
              </p>
            ) : (
              <p className={`text-3xl font-bold leading-none ${scoreColor}`}>
                {stats.correct}
                <span className="text-lg font-normal text-muted-foreground ml-1">
                  / {stats.total} correct
                </span>
              </p>
            )}
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
  if (type === 'SA') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
        Short Answer
      </span>
    );
  }
  if (type === 'OPPE') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
        OPPE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-muted text-muted-foreground border border-border">
      MCQ
    </span>
  );
}

function normalizeMarkup(text: string) {
  const normalized = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<\/?p>/gi, '')
    .replace(/<b>(.*?)<\/b>/gis, '**$1**')
    .replace(/<strong>(.*?)<\/strong>/gis, '**$1**')
    .replace(/<i>(.*?)<\/i>/gis, '*$1*')
    .replace(/<em>(.*?)<\/em>/gis, '*$1*')
    .replace(/<u>(.*?)<\/u>/gis, '__$1__');

  return decodeHtmlEntities(normalized);
}

function decodeHtmlEntities(text: string) {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    cent: '¢',
    copy: '©',
    deg: '°',
    divide: '÷',
    gt: '>',
    le: '≤',
    lt: '<',
    minus: '−',
    nbsp: ' ',
    plusmn: '±',
    quot: '"',
    reg: '®',
    times: '×',
  };

  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, value: string) => {
    const lowerValue = value.toLowerCase();
    if (lowerValue.startsWith('#x')) {
      return String.fromCodePoint(Number.parseInt(lowerValue.slice(2), 16));
    }
    if (lowerValue.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(lowerValue.slice(1), 10));
    }

    return namedEntities[lowerValue] ?? entity;
  });
}

function renderInlineMarkdown(text: string) {
  const nodes: React.ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('`')) {
      nodes.push(
        <code key={nodes.length} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={nodes.length}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('__')) {
      nodes.push(<span key={nodes.length} className="underline underline-offset-2">{token.slice(2, -2)}</span>);
    } else {
      nodes.push(<em key={nodes.length}>{token.slice(1, -1)}</em>);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function RichText({ text, compact = false }: { text: string; compact?: boolean }) {
  const normalized = normalizeMarkup(text);
  const nodes: React.ReactNode[] = [];
  const renderLines = (paragraph: string) =>
    paragraph.split('\n').flatMap((line, index) => {
      const rendered = renderInlineMarkdown(line);
      if (index === 0) return rendered;
      return [<br key={`br-${nodes.length}-${index}`} />, ...rendered];
    });

  const renderParagraphs = (value: string) => {
    const paragraphs = value
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);

    for (const paragraph of paragraphs) {
      nodes.push(
        <p key={`p-${nodes.length}`} className={compact ? 'my-0' : 'my-2'}>
          {renderLines(paragraph)}
        </p>,
      );
    }
  };

  const fencePattern = /```(?:\w+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = fencePattern.exec(normalized)) !== null) {
    renderParagraphs(normalized.slice(lastIndex, match.index));
    nodes.push(
      <pre
        key={`code-${nodes.length}`}
        className="my-3 overflow-x-auto rounded-md border border-border bg-muted/60 p-3 text-sm leading-relaxed"
      >
        <code className="font-mono whitespace-pre">{(match[1] ?? '').trimEnd()}</code>
      </pre>,
    );
    lastIndex = match.index + match[0].length;
  }

  renderParagraphs(normalized.slice(lastIndex));

  if (nodes.length === 0) return null;
  return <div className="max-w-none text-foreground leading-relaxed">{nodes}</div>;
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
  const optionText = option.optionText?.trim() ?? '';
  const hasOptionText = optionText.length > 0;
  const hasOptionImage = Boolean(option.optionImage);

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
        {hasOptionText && (
          <div className="text-sm">
            <RichText text={optionText} compact />
          </div>
        )}
        {hasOptionImage && (
          <img
            src={getOptionImageUrl(option.optionImage ?? undefined)}
            alt={`Option ${label}`}
            className="mt-2 max-w-full rounded border border-border"
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        {!hasOptionText && !hasOptionImage && (
          <span className="text-sm text-muted-foreground italic">
            Option content unavailable
          </span>
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
  onShortAnswerChange,
  isSubQuestion = false,
}: {
  question: QuestionWithChildren;
  index: number;
  selectedAnswers: Record<string, string | string[]>;
  showResults: boolean;
  onSelectAnswer: (questionId: string, optionIndex: string, questionType: QuestionType) => void;
  onShortAnswerChange: (questionId: string, answer: string) => void;
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
  const isShortAnswer = question.questionType === 'SA' || question.questionType === 'OPPE';
  const responseType = question.responseType?.toLowerCase() ?? '';
  const answerType = question.answerType?.toLowerCase() ?? '';
  const isNumericShortAnswer =
    responseType.includes('number') ||
    responseType.includes('numeric') ||
    answerType.includes('number') ||
    answerType.includes('numeric') ||
    question.valueStart !== undefined ||
    question.valueEnd !== undefined;
  const hasOptions = question.options.length > 0;

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
                  >
                    <RichText text={text ?? ''} />
                  </div>
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
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            {!isComprehension && (
              <div className="space-y-2">
                {isShortAnswer ? (
                  <div className="space-y-2 px-1">
                    <input
                      type={isNumericShortAnswer ? 'number' : 'text'}
                      value={typeof selectedAnswer === 'string' ? selectedAnswer : ''}
                      disabled={showResults}
                      onChange={(event) => onShortAnswerChange(question.uuid, event.target.value)}
                      placeholder={isNumericShortAnswer ? 'Enter numeric answer' : 'Enter your answer'}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <p className="text-xs text-muted-foreground italic">
                      Manual-evaluation answer type. Your response is saved locally.
                    </p>
                  </div>
                ) : (
                  <>
                    {isMultiSelect && (
                      <p className="text-xs text-muted-foreground">Select all that apply</p>
                    )}
                    {hasOptions && question.options.map((option, optionIndex) => {
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
                    {!hasOptions && (
                      <p className="text-xs text-muted-foreground italic px-1">
                        No options available for this question.
                      </p>
                    )}
                  </>
                )}
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
              >
                <RichText text={text ?? ''} />
              </div>
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
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Options */}
          {!isComprehension && (
            <div className="space-y-2">
              {isShortAnswer ? (
                <div className="space-y-2 px-1">
                  <input
                    type={isNumericShortAnswer ? 'number' : 'text'}
                    value={typeof selectedAnswer === 'string' ? selectedAnswer : ''}
                    disabled={showResults}
                    onChange={(event) => onShortAnswerChange(question.uuid, event.target.value)}
                    placeholder={isNumericShortAnswer ? 'Enter numeric answer' : 'Enter your answer'}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <p className="text-xs text-muted-foreground italic">
                    Manual-evaluation answer type. Your response is saved locally.
                  </p>
                </div>
              ) : (
                <>
                  {isMultiSelect && (
                    <p className="text-xs text-muted-foreground italic">Select all that apply</p>
                  )}
                  {hasOptions && question.options.map((option, optionIndex) => {
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
                  {!hasOptions && (
                    <p className="text-xs text-muted-foreground italic px-1">
                      No options available for this question.
                    </p>
                  )}
                </>
              )}
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
                  onShortAnswerChange={onShortAnswerChange}
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
  const storageKey = useMemo(
    () => (paperId ? getPaperSessionKey(paperId, courseId, examId) : null),
    [courseId, examId, paperId],
  );
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string | string[]>>({});
  const [showResults, setShowResults] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [paper, setPaper] = useState<PaperDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [timeExpired, setTimeExpired] = useState(false);
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
          const savedSession = storageKey
            ? readPaperSession(storageKey, paperData.duration)
            : null;

          setPaper(paperData);
          setQuestions(questionData);
          setSelectedAnswers(savedSession?.selectedAnswers ?? {});
          setShowResults(savedSession?.showResults ?? false);
          setTimerRunning(savedSession?.timerRunning ?? false);
          setRemainingSeconds(savedSession?.remainingSeconds ?? paperData.duration * 60);
          setTimerEndsAt(savedSession?.timerEndsAt ?? null);
          setTimeExpired((savedSession?.remainingSeconds ?? paperData.duration * 60) === 0);
        }
      })
      .catch((error) => {
        logger.error('Failed to load paper data', error);
        if (active) {
          setLoadFailed(true);
          setPaper(null);
          setQuestions([]);
          setTimerRunning(false);
          setRemainingSeconds(null);
          setTimerEndsAt(null);
          setTimeExpired(false);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [paperId, courseId, examUuidFromSearch, storageKey]);

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

  useEffect(() => {
    if (!paper || !storageKey) return;

    const payload: SavedPaperSession = {
      selectedAnswers,
      showResults,
      timerRunning,
      remainingSeconds,
      timerEndsAt,
    };

    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [paper, remainingSeconds, selectedAnswers, showResults, storageKey, timerEndsAt, timerRunning]);

  useEffect(() => {
    if (!paper || !timerRunning || showResults || timerEndsAt === null) {
      return;
    }

    const syncRemaining = () => {
      const nextRemaining = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
      setRemainingSeconds(nextRemaining);

      if (nextRemaining === 0) {
        setTimerRunning(false);
        setTimerEndsAt(null);
        setTimeExpired(true);
        setShowResults(true);
      }
    };

    syncRemaining();
    const interval = window.setInterval(syncRemaining, 1000);

    return () => window.clearInterval(interval);
  }, [paper, showResults, timerEndsAt, timerRunning]);

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
    return formatPaperName(paper.paperName, paper.year ?? undefined);
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

  const handleShortAnswerChange = (questionId: string, answer: string) => {
    if (showResults) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleTimerStart = () => {
    if (!paper) return;

    const nextRemaining = remainingSeconds ?? paper.duration * 60;
    if (nextRemaining <= 0) {
      setRemainingSeconds(paper.duration * 60);
      setTimeExpired(false);
      setShowResults(false);
      setSelectedAnswers({});
      setTimerEndsAt(Date.now() + paper.duration * 60 * 1000);
      setTimerRunning(true);
      return;
    }

    setTimeExpired(false);
    setTimerEndsAt(Date.now() + nextRemaining * 1000);
    setTimerRunning(true);
  };

  const handleTimerPause = () => {
    setTimerRunning(false);
    setTimerEndsAt(null);
  };

  const handleTimerReset = () => {
    if (!paper) return;
    setTimerRunning(false);
    setTimerEndsAt(null);
    setRemainingSeconds(paper.duration * 60);
    setTimeExpired(false);
  };

  const handleTryAgain = () => {
    setSelectedAnswers({});
    setShowResults(false);
    setTimerRunning(false);
    setTimerEndsAt(null);
    setRemainingSeconds(paper ? paper.duration * 60 : null);
    setTimeExpired(false);
    if (storageKey) clearPaperSession(storageKey);
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
            {displayCourseName || 'Back'}
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
  const hasTimer = paper.duration > 0;

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
            {displayCourseName || 'Back'}
          </Link>
        </Button>

        <div>
          <p className="text-sm font-medium text-primary">{paper.examName}</p>
            <h1 className="text-2xl font-bold tracking-tight mt-1">{displayPaperName}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {stats.total} {stats.total === 1 ? 'question' : 'questions'}
              {stats.totalMarks > 0 && <> &middot; {stats.totalMarks} marks</>}
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

          {hasTimer && (
            <TimerPanel
              durationMinutes={paper.duration}
              remainingSeconds={remainingSeconds}
              running={timerRunning}
              onStart={handleTimerStart}
              onPause={handleTimerPause}
              onReset={handleTimerReset}
              expired={timeExpired}
            />
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
              onShortAnswerChange={handleShortAnswerChange}
            />
          ))}
        </div>

        {/* Submit Button */}
        {!showResults && (
          <div className="sticky bottom-4 flex justify-center pt-4 pb-2">
            <div className="relative">
              {/* backdrop blur halo so the button doesn't hard-clip over questions */}
              <div className="absolute inset-0 -m-3 rounded-2xl bg-background/60 backdrop-blur-sm pointer-events-none" />
              <Button
                size="lg"
                onClick={() => {
                  setShowResults(true);
                  setTimerRunning(false);
                  setTimerEndsAt(null);
                }}
                disabled={stats.answered === 0}
                className={`relative shadow-lg gap-2 transition-all ${
                  allAnswered
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : stats.answered > 0
                    ? 'bg-primary/90 hover:bg-primary text-primary-foreground'
                    : ''
                }`}
              >
                {allAnswered
                  ? 'Submit answers'
                  : stats.answered > 0
                  ? `Submit (${stats.answered} / ${stats.total})`
                  : 'Answer a question to submit'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
