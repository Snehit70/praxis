import { useParams, Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw, Trophy, Timer, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
import type React from 'react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { formatPaperName } from '@/lib/paperUtils';
import { getExamSlugFromUuid, getExamUuidFromSlug, getExamDurationMinutes } from '@/lib/examMapping';
import { getDisplayCourseName, getCourseLevel } from '@/lib/courseMapping';
import { LEVEL_META } from '@/lib/courseCatalogue';
import { ArcaneSigil } from '@/components/ArcaneSigil';
import { logger } from '@/lib/logger';
import { getQuestionImageUrl, getOptionImageUrl } from '@/lib/imageUtils';
import {
  getPaperByUuid,
  getQuestionsByPaperUuid,
  recordView,
  type PaperDetails,
} from '@/lib/api';
import type { QuestionType, QuizQuestion } from '@/lib/dataTransforms';
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { SaveButton } from '@/components/SaveButton';
import { useAuth } from '@clerk/clerk-react';
import pageBg from '@/assets/Sousou no Frieren - Ep. 11_ Winter in the Northern Lands - 00_22.png';

interface QuestionWithChildren extends QuizQuestion {
  subQuestions?: QuizQuestion[];
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
const PAPER_SESSION_STORAGE_PREFIX = 'praxis.paper-session';
// Stored per-paper `duration` values are placeholders, so the timed attempt is
// driven by the exam type instead (see getExamDurationMinutes): 60m for the
// quizzes, 90m for the End Term.

interface SavedPaperSession {
  selectedAnswers: Record<string, string | string[]>;
  showResults: boolean;
  timerRunning: boolean;
  remainingSeconds: number | null;
  timerEndsAt: number | null;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    <div className="max-w-3xl mx-auto space-y-6 px-4 sm:px-0" role="status" aria-live="polite" aria-label="Loading paper">
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
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/30 ring-1 ring-inset ring-[rgba(214,178,110,0.14)]">
      <div
        className="h-full rounded-full bg-[color-mix(in_srgb,var(--lvl,#62aef0)_80%,white_10%)] transition-all duration-500 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

/**
 * Compact timer that sits inline on the right of the progress line. Shows the
 * remaining time with start/pause + reset controls, and turns destructive when
 * the clock runs out.
 */
function CompactTimer({
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
  // Urgent under the last 5 minutes — the clock flushes red and pulses.
  const urgent = !expired && running && remainingSeconds !== null && remainingSeconds <= 300 && remainingSeconds > 0;
  return (
    <div
      data-urgent={urgent}
      title={
        expired
          ? 'Time is up — answers were submitted automatically.'
          : running
          ? 'Timer is running (survives a refresh).'
          : 'Start to simulate the real exam clock.'
      }
      className={cn(
        'exam-clock exam-panel flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 backdrop-blur-sm',
        expired ? 'border-destructive/40 bg-destructive/10' : 'bg-[#1c1812]/70',
      )}
    >
      <Timer
        className={cn('h-4 w-4', expired || urgent ? 'text-red-400' : '')}
        style={expired || urgent ? undefined : { color: 'var(--lvl, var(--primary))' }}
        aria-hidden="true"
      />
      <span className={cn('text-base font-semibold tabular-nums', (expired || urgent) && 'text-red-400')}>
        {formatRemainingTime(remainingSeconds)}
      </span>
      <span className="hidden text-xs text-muted-foreground sm:inline">/ {durationMinutes}m</span>
      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
      <button
        type="button"
        onClick={running ? onPause : onStart}
        aria-label={running ? 'Pause timer' : expired ? 'Restart timer' : 'Start timer'}
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={onReset}
        aria-label="Reset timer"
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
    </div>
  );
}

function ResultsSummary({
  stats,
  onTryAgain,
}: {
  stats: {
    correct: number;
    gradableTotal: number;
    scoredMarks: number;
    totalMarks: number;
    manualEvalCount: number;
  };
  onTryAgain: () => void;
}) {
  const percentage =
    stats.gradableTotal > 0 ? Math.round((stats.correct / stats.gradableTotal) * 100) : 0;
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
    <div className={`exam-verdict rounded-2xl border p-5 ring-1 ring-inset ring-[rgba(214,178,110,0.16)] sm:p-6 ${bgColor}`}>
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
                  / {stats.gradableTotal} correct
                </span>
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-1.5">
              {stats.correct} of {stats.gradableTotal} auto-graded correct &middot; {percentage}%
            </p>
            {stats.manualEvalCount > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {stats.manualEvalCount} response{stats.manualEvalCount === 1 ? '' : 's'} require manual evaluation.
              </p>
            )}
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
    containerClass +=
      'border-[color-mix(in_srgb,var(--lvl,#62aef0)_70%,transparent)] bg-[color-mix(in_srgb,var(--lvl,#62aef0)_12%,transparent)] shadow-[inset_0_0_24px_-12px_color-mix(in_srgb,var(--lvl,#62aef0)_80%,transparent)]';
    indicatorClass += 'bg-[var(--lvl,#62aef0)] text-white';
  } else {
    containerClass +=
      'border-[rgba(214,178,110,0.18)] bg-black/15 hover:border-[color-mix(in_srgb,var(--lvl,#62aef0)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--lvl,#62aef0)_8%,transparent)] active:bg-black/25';
    indicatorClass += 'bg-muted text-muted-foreground group-hover:text-foreground';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={showResults}
      aria-pressed={!showResults ? isSelected : undefined}
      aria-label={`Option ${label}${isSelected ? ', selected' : ''}${showResults ? isCorrect ? ', correct' : isSelected ? ', incorrect' : '' : ''}`}
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

/** Keep only a single optional leading minus, digits, and one decimal point. */
function sanitizeNumeric(raw: string): string {
  let cleaned = raw.replace(/[^0-9.-]/g, '');
  const negative = cleaned.startsWith('-');
  cleaned = cleaned.replace(/-/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  }
  return (negative ? '-' : '') + cleaned;
}

const KEYPAD_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '-', '0', '.'];

/** On-screen numeric keypad for numeric short-answer questions. */
function NumericKeypad({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const press = (key: string) => {
    let next = value;
    if (key === '-') {
      next = value.startsWith('-') ? value.slice(1) : `-${value}`;
    } else if (key === '.') {
      next = value.includes('.') ? value : `${value}.`;
    } else {
      next = value + key;
    }
    onChange(sanitizeNumeric(next));
  };

  const keyClass =
    'rounded-md border border-border bg-card/70 py-2.5 text-base font-medium text-foreground backdrop-blur-sm transition-colors hover:border-primary/40 hover:bg-muted active:bg-muted/70';

  return (
    <div className="max-w-[260px]">
      <div className="grid grid-cols-3 gap-2">
        {KEYPAD_KEYS.map((key) => (
          <button key={key} type="button" onClick={() => press(key)} aria-label={`Type ${key}`} className={keyClass}>
            {key}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange(value.slice(0, -1))}
          aria-label="Backspace"
          className={keyClass}
        >
          ⌫
        </button>
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear answer"
          className={keyClass}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

/** Short-answer input. Numeric questions are restricted to numeric input and
 *  get an on-screen keypad; non-numeric (e.g. OPPE) keep a free-text field. */
function ShortAnswerField({
  value,
  numeric,
  disabled,
  onChange,
}: {
  value: string;
  numeric: boolean;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-3 px-1">
      <input
        aria-label={numeric ? 'Numeric answer' : 'Short answer'}
        type="text"
        inputMode={numeric ? 'decimal' : 'text'}
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(numeric ? sanitizeNumeric(event.target.value) : event.target.value)
        }
        placeholder={numeric ? 'Enter numeric answer' : 'Enter your answer'}
        className="w-full rounded-md border border-border bg-background/70 px-3 py-2 text-sm text-foreground outline-none backdrop-blur-sm focus:ring-2 focus:ring-primary/40"
      />
      {numeric && !disabled && <NumericKeypad value={value} onChange={onChange} />}
      <p className="text-xs italic text-muted-foreground">
        Manual-evaluation answer type. Your response is saved locally.
      </p>
    </div>
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
  // SHORT ANSWER (SA) is always treated as numeric-only per product direction;
  // other short-answer types (e.g. OPPE) stay numeric only when detected.
  const isNumericInput = question.questionType === 'SA' || isNumericShortAnswer;
  const hasOptions = question.options.length > 0;

  if (isSubQuestion) {
    return (
      <div className="rounded-lg border border-[rgba(214,178,110,0.16)] bg-black/20 p-4">
        <div className="flex gap-3">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--lvl,#62aef0)_40%,transparent)] bg-[color-mix(in_srgb,var(--lvl,#62aef0)_14%,transparent)] text-xs font-bold text-[color-mix(in_srgb,var(--lvl,#62aef0)_92%,white)]">
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
                  <ShortAnswerField
                    value={typeof selectedAnswer === 'string' ? selectedAnswer : ''}
                    numeric={isNumericInput}
                    disabled={showResults}
                    onChange={(next) => onShortAnswerChange(question.uuid, next)}
                  />
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
    <div className="exam-tome relative isolate overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--lvl,#62aef0)_30%,rgba(214,178,110,0.2))] p-5 backdrop-blur-sm sm:p-6">
      <div className="relative z-10 flex gap-3 sm:gap-4">
        {/* Question number */}
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--lvl,#62aef0)_45%,transparent)] bg-[color-mix(in_srgb,var(--lvl,#62aef0)_16%,transparent)] text-sm font-bold text-[color-mix(in_srgb,var(--lvl,#62aef0)_92%,white)]">
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
                <ShortAnswerField
                  value={typeof selectedAnswer === 'string' ? selectedAnswer : ''}
                  numeric={isNumericInput}
                  disabled={showResults}
                  onChange={(next) => onShortAnswerChange(question.uuid, next)}
                />
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

      {/* Ornate frame + corner brackets — the deck language, kept calm (no foil). */}
      <div className="tcard-frame" aria-hidden="true" />
      <span className="tcard-corner tcard-corner-tl" aria-hidden="true" />
      <span className="tcard-corner tcard-corner-tr" aria-hidden="true" />
      <span className="tcard-corner tcard-corner-bl" aria-hidden="true" />
      <span className="tcard-corner tcard-corner-br" aria-hidden="true" />
    </div>
  );
}

type PageState = 'none' | 'partial' | 'done';

/**
 * Right-rail navigator: a grid of question numbers that reflects answered /
 * partially-answered / untouched state and lets the user jump to any question.
 * Uses the horizontal space the single-question layout frees up.
 */
function QuestionNavigator({
  states,
  currentIndex,
  onJump,
}: {
  states: PageState[];
  currentIndex: number;
  onJump: (index: number) => void;
}) {
  const done = states.filter((state) => state === 'done').length;
  return (
    <div className="exam-panel exam-tome sticky top-20 isolate overflow-hidden rounded-2xl p-4 backdrop-blur-sm">
      {/* Faint summoning sigil watermark — ties the rail to the deck. */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 opacity-[0.06]">
        <ArcaneSigil />
      </div>
      <div className="relative z-10 mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-normal tracking-tight">Questions</h2>
        <span className="text-xs tabular-nums text-muted-foreground">{done}/{states.length} done</span>
      </div>
      <div className="relative z-10 grid grid-cols-5 gap-2">
        {states.map((state, index) => {
          const isCurrent = index === currentIndex;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onJump(index)}
              aria-current={isCurrent ? 'true' : undefined}
              aria-label={`Go to question ${index + 1}${
                state === 'done' ? ', answered' : state === 'partial' ? ', partly answered' : ''
              }`}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium transition-colors',
                state === 'done' &&
                  'border-[color-mix(in_srgb,var(--lvl,#62aef0)_50%,transparent)] bg-[color-mix(in_srgb,var(--lvl,#62aef0)_18%,transparent)] text-[color-mix(in_srgb,var(--lvl,#62aef0)_92%,white)]',
                state === 'partial' && 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                state === 'none' &&
                  'border-[rgba(214,178,110,0.16)] bg-black/20 text-muted-foreground hover:border-[color-mix(in_srgb,var(--lvl,#62aef0)_45%,transparent)] hover:text-foreground',
                isCurrent && 'ring-2 ring-[#d6b26e] ring-offset-1 ring-offset-background',
              )}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
      <div className="relative z-10 mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-[color-mix(in_srgb,var(--lvl,#62aef0)_55%,transparent)]" aria-hidden="true" />
          Answered
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500/40" aria-hidden="true" />
          Partial
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm border border-border" aria-hidden="true" />
          Unanswered
        </span>
      </div>
    </div>
  );
}

export default function PaperPage() {
  const { paperId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
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
  const [summoning, setSummoning] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [paper, setPaper] = useState<PaperDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const { getToken, isSignedIn } = useAuth();

  // Record a view in the signed-in user's history once the paper resolves.
  useEffect(() => {
    if (!isSignedIn || !paper?._id) return;
    recordView(paper._id, getToken).catch((error) =>
      logger.error('Failed to record paper view', error),
    );
  }, [getToken, isSignedIn, paper?._id]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    if (!paperId) {
      setLoading(false);
      return () => {
        active = false;
        controller.abort();
      };
    }

    setLoading(true);
    setLoadFailed(false);
    setSelectedAnswers({});
    setShowResults(false);
    setCurrentIndex(0);

    Promise.all([
      getPaperByUuid(paperId, courseId, examUuidFromSearch, { signal: controller.signal }),
      getQuestionsByPaperUuid(paperId, courseId, examUuidFromSearch, { signal: controller.signal }),
    ])
      .then(([paperData, questionData]) => {
        if (active) {
          // Derive the clock from the freshly-fetched paper's exam type — the
          // `durationMinutes` from render scope is still stale here (paper was
          // null when this effect's closure was created).
          const initDuration = getExamDurationMinutes(getExamSlugFromUuid(paperData.examUuid));
          const initSeconds = initDuration * 60;
          const savedSession = storageKey
            ? readPaperSession(storageKey, initDuration)
            : null;

          setPaper(paperData);
          setQuestions(questionData);
          setSelectedAnswers(savedSession?.selectedAnswers ?? {});
          setShowResults(savedSession?.showResults ?? false);
          setTimerRunning(savedSession?.timerRunning ?? false);
          setRemainingSeconds(savedSession?.remainingSeconds ?? initSeconds);
          setTimerEndsAt(savedSession?.timerEndsAt ?? null);
          setTimeExpired((savedSession?.remainingSeconds ?? initSeconds) === 0);
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
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
      controller.abort();
    };
  }, [paperId, courseId, examUuidFromSearch, storageKey, retryNonce]);

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

  const durationMinutes = useMemo(() => getExamDurationMinutes(examSlug), [examSlug]);

  const displayCourseName = useMemo(() => {
    if (!paper?.courseName) return '';
    return getDisplayCourseName(paper.courseName);
  }, [paper?.courseName]);

  // Course-level accent — carries the deck's per-level colour into the exam so
  // the page reads as the "inside" of the card the user summoned.
  const levelColor = useMemo(() => {
    if (!paper?.courseName) return null;
    return LEVEL_META[getCourseLevel(paper.courseName)]?.color ?? null;
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
    const hasMeaningfulAnswer = (value: string | string[] | undefined) => {
      if (value === undefined) return false;
      if (Array.isArray(value)) return value.length > 0;
      return value.trim().length > 0;
    };

    const allQuestionIds = new Set<string>();
    let manualEvalCount = 0;
    let gradableTotal = 0;

    for (const question of groupedQuestions) {
      if (question.questionType !== 'COMPREHENSION') {
        allQuestionIds.add(question.uuid);
        if (question.questionType === 'SA' || question.questionType === 'OPPE') {
          manualEvalCount++;
        } else {
          gradableTotal++;
        }
      }
      if (question.subQuestions) {
        question.subQuestions.forEach((sq) => {
          allQuestionIds.add(sq.uuid);
          if (sq.questionType === 'SA' || sq.questionType === 'OPPE') {
            manualEvalCount++;
          } else {
            gradableTotal++;
          }
        });
      }
    }

    const answered = Object.keys(selectedAnswers).filter((id) => {
      if (!allQuestionIds.has(id)) return false;
      return hasMeaningfulAnswer(selectedAnswers[id]);
    }).length;
    let correct = 0;
    let totalMarks = 0;
    let scoredMarks = 0;

    const countQuestion = (question: QuizQuestion) => {
      const isManualEval = question.questionType === 'SA' || question.questionType === 'OPPE';
      if (isManualEval) return;

      const marks = parseFloat(question.totalMark) || 0;
      totalMarks += marks;

      if (!showResults || !hasMeaningfulAnswer(selectedAnswers[question.uuid])) return;

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

    return {
      totalQuestions: allQuestionIds.size,
      answered,
      correct,
      gradableTotal,
      totalMarks,
      scoredMarks,
      manualEvalCount,
    };
  }, [groupedQuestions, selectedAnswers, showResults]);

  const pageCount = groupedQuestions.length;

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : i));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i < pageCount - 1 ? i + 1 : i));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pageCount]);

  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(0, Math.min(index, pageCount - 1)));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [pageCount],
  );

  // Per-page answered state for the navigator (done / partial / none).
  const pageStates = useMemo<PageState[]>(() => {
    const meaningful = (value: string | string[] | undefined) => {
      if (value === undefined) return false;
      return Array.isArray(value) ? value.length > 0 : value.trim().length > 0;
    };
    return groupedQuestions.map((question) => {
      const ids =
        question.questionType === 'COMPREHENSION'
          ? (question.subQuestions ?? []).map((sub) => sub.uuid)
          : [question.uuid];
      if (ids.length === 0) return 'none';
      const answered = ids.filter((id) => meaningful(selectedAnswers[id])).length;
      if (answered === 0) return 'none';
      return answered === ids.length ? 'done' : 'partial';
    });
  }, [groupedQuestions, selectedAnswers]);

  // Keyboard paging with ← / → — ignored while typing into a short-answer field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (event.key === 'ArrowLeft') goPrev();
      else if (event.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext]);

  // Pop back to the page we came from (the course page in the normal flow)
  // rather than pushing a fresh course entry — pushing created a Paper ⇄ Course
  // loop with the course page's own history-pop back button. Fall back to the
  // course page only on a fresh/deep-linked load with no history to pop.
  const goBack = () => {
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate(examSlug && paper ? `/exam/${examSlug}/course/${paper.courseUuid}` : '/');
    }
  };

  const reveal = () => {
    setShowResults(true);
    setTimerRunning(false);
    setTimerEndsAt(null);
    setCurrentIndex(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = () => {
    // The climactic moment: a brief "summon" charge, then reveal the verdict.
    // Reduced motion (or an already-summoning click) reveals immediately.
    if (summoning) return;
    if (prefersReducedMotion()) {
      reveal();
      return;
    }
    setSummoning(true);
    window.setTimeout(() => {
      setSummoning(false);
      reveal();
    }, 620);
  };

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

    const nextRemaining = remainingSeconds ?? durationMinutes * 60;
    if (nextRemaining <= 0) {
      setRemainingSeconds(durationMinutes * 60);
      setTimeExpired(false);
      setShowResults(false);
      setSelectedAnswers({});
      setTimerEndsAt(Date.now() + durationMinutes * 60 * 1000);
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
    setRemainingSeconds(durationMinutes * 60);
    setTimeExpired(false);
  };

  const handleTryAgain = () => {
    setSelectedAnswers({});
    setShowResults(false);
    setTimerRunning(false);
    setTimerEndsAt(null);
    setRemainingSeconds(paper ? durationMinutes * 60 : null);
    setTimeExpired(false);
    setCurrentIndex(0);
    if (storageKey) clearPaperSession(storageKey);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Error states
  if (!paperId) {
    return (
      <StatePanel
        compact
        title="Invalid paper"
        description="Paper ID not provided."
        actions={(
          <Button asChild variant="outline">
            <Link to="/">Go home</Link>
          </Button>
        )}
        announce
      />
    );
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (loadFailed || !paper) {
    return (
      <StatePanel
        compact
        tone="error"
        title="Unable to load paper"
        description="Could not load this paper."
        actions={(
          <>
            <Button variant="default" onClick={() => setRetryNonce((value) => value + 1)}>
              Retry
            </Button>
            <Button asChild variant="outline">
              <Link to={examSlug ? `/exam/${examSlug}` : '/'}>Go back</Link>
            </Button>
          </>
        )}
        announce
      />
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 px-4 sm:px-0">
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-1.5 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          {displayCourseName || 'Back'}
        </Button>
        <StatePanel
          compact
          title="No questions available"
          description="Questions for this paper haven't been loaded yet."
          announce
        />
      </div>
    );
  }

  const allAnswered = stats.answered === stats.totalQuestions;
  const hasTimer = paper.duration > 0;
  const safeIndex = Math.min(currentIndex, pageCount - 1);
  const currentQuestion = groupedQuestions[safeIndex];
  const isLastPage = safeIndex >= pageCount - 1;
  const submitLabel = allAnswered
    ? 'Submit answers'
    : stats.answered > 0
    ? `Submit (${stats.answered}/${stats.totalQuestions})`
    : 'Answer to submit';

  return (
    <div
      className="relative isolate w-full space-y-5 pb-24"
      style={levelColor ? ({ ['--lvl' as string]: levelColor }) : undefined}
    >
      {/* Page backdrop — a still, dimmed winter scene held behind the exam so
          the question and navigator stay legible. isolate + -z-10 keeps it
          above the app background but below the content. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <img src={pageBg} alt="" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/90 to-background/95" />
      </div>

      {/* Compact header — one row: back · exam · paper · meta .......... save */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Button variant="ghost" size="sm" onClick={goBack} className="-ml-2 shrink-0 gap-1.5 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex min-w-0 items-baseline gap-2">
            <span
              className="shrink-0 text-sm font-medium"
              style={{ color: levelColor ?? undefined }}
            >
              {paper.examName}
            </span>
            <span className="text-muted-foreground" aria-hidden="true">·</span>
            <h1 className="truncate font-display text-xl font-normal tracking-tight" title={displayPaperName}>
              {displayPaperName}
            </h1>
          </div>
          <span className="hidden text-sm text-muted-foreground md:inline">
            {stats.totalQuestions} {stats.totalQuestions === 1 ? 'question' : 'questions'}
            {stats.totalMarks > 0 && ` · ${stats.totalMarks} marks`}
          </span>
          <div className="ml-auto shrink-0">
            <SaveButton paperId={paper._id} />
          </div>
        </div>

        {/* Progress + compact timer on one line */}
        {!showResults && (
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {stats.answered} / {stats.totalQuestions} answered
                </span>
              </div>
              <ProgressBar answered={stats.answered} total={stats.totalQuestions} />
            </div>
            {hasTimer && (
              <CompactTimer
                durationMinutes={durationMinutes}
                remainingSeconds={remainingSeconds}
                running={timerRunning}
                onStart={handleTimerStart}
                onPause={handleTimerPause}
                onReset={handleTimerReset}
                expired={timeExpired}
              />
            )}
          </div>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
      {/* Results summary shown above the question while reviewing */}
      {showResults && <ResultsSummary stats={stats} onTryAgain={handleTryAgain} />}

      {/* One question per page */}
      {currentQuestion && (
        <div key={currentQuestion.uuid} className="exam-q-enter min-h-[55vh]">
          <QuestionCard
            question={currentQuestion}
            index={safeIndex}
            selectedAnswers={selectedAnswers}
            showResults={showResults}
            onSelectAnswer={handleOptionSelect}
            onShortAnswerChange={handleShortAnswerChange}
          />
        </div>
      )}

      {/* Sticky pager — Prev · "Question X of N" · Next/Submit. ← / → also page. */}
      <div className="sticky bottom-4 z-30">
        <div className="exam-panel rounded-xl bg-[#1c1812]/90 px-4 py-3 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={goPrev}
              disabled={safeIndex === 0}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>

            <span className="text-sm tabular-nums text-muted-foreground">
              Question {safeIndex + 1} of {pageCount}
            </span>

            <div className="flex items-center gap-2">
              {!showResults && !isLastPage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={stats.answered === 0 || summoning}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {summoning ? 'Summoning…' : 'Submit'}
                </Button>
              )}
              {isLastPage && !showResults ? (
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={stats.answered === 0 || summoning}
                  className={cn(
                    'gap-1',
                    allAnswered
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  {summoning ? 'Summoning…' : submitLabel}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : !isLastPage ? (
                <Button size="sm" onClick={goNext} className="gap-1">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <span className="px-2 text-xs text-muted-foreground">End of review</span>
              )}
            </div>
          </div>
        </div>
      </div>
        </div>

        <aside className="hidden lg:block">
          <QuestionNavigator states={pageStates} currentIndex={safeIndex} onJump={goTo} />
        </aside>
      </div>
    </div>
  );
}
