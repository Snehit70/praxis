import { useParams, Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw, Trophy, Timer, Play, Pause, ChevronLeft, ChevronRight, Flag, BookOpen, LayoutGrid, Maximize2, Undo2, Calculator, Eraser, Eye, EyeOff, AArrowDown, AArrowUp } from 'lucide-react';
import type React from 'react';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatPaperName } from '@/lib/paperUtils';
import { getExamSlugFromUuid, getExamUuidFromSlug, getExamDurationMinutes } from '@/lib/examMapping';
import { getDisplayCourseName, getCourseLevel } from '@/lib/courseMapping';
import { LEVEL_META } from '@/lib/courseCatalogue';
import { ArcaneSigil } from '@/components/ArcaneSigil';
import { PaperVerification } from '@/components/PaperVerification';
import { logger } from '@/lib/logger';
import { getQuestionImageUrl, getOptionImageUrl, imageSourceFallbacks } from '@/lib/imageUtils';
import { splitMarkupImages } from '@/lib/markupImages';
import {
  getPaperByUuid,
  ApiRequestError,
  VerificationRequiredError,
  getAttempt,
  getAttempts,
  getQuestionsByPaperUuid,
  recordView,
  submitAttempt,
  type AttemptDetail,
  type AttemptSummary,
  type PaperDetails,
} from '@/lib/api';
import type { QuestionType, QuizQuestion } from '@/lib/dataTransforms';
import {
  calculatePracticeRunStats,
  clearPracticeRunSession,
  describeShortAnswerKey,
  gradePracticeRun,
  isPracticeRunQuestionCorrect,
  getPracticeRunPageStates,
  getPracticeRunReviewStates,
  getPracticeRunStorageKey,
  groupPracticeRunQuestions,
  readPracticeRunSession,
  selectPracticeRunOption,
  writePracticeRunSession,
  type PracticeRunPageState,
  type PracticeRunReviewState,
  type QuestionWithChildren,
  type RunMode,
  type SavedPracticeRunSession,
  type SelectedAnswers,
} from '@/lib/practiceRun';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { SaveButton } from '@/components/SaveButton';
import { DownloadPdfButton } from '@/components/DownloadPdfButton';
import { BOOKMARKS_ENABLED } from '@/lib/featureFlags';
import { useAuth } from '@clerk/clerk-react';
import examHall from '@/assets/exam-hall.webp';
import handInHall from '@/assets/hand-in-hall.webp';
import coverArt from '@/assets/paper-cover.webp';
import { ImageZoomProvider, useImageZoom } from '@/components/exam/ImageLightbox';
import { ExamCalculator } from '@/components/exam/ExamCalculator';
import {
  AttemptReport,
  ReviewBar,
  type AttemptSaveState,
  type ReviewFilter,
} from '@/components/exam/AttemptReport';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
const TEXT_SCALES = [0.9, 1, 1.12, 1.25, 1.4];
const TEXT_SCALE_KEY = 'praxis.exam.textScale';
// Stored per-paper `duration` values are placeholders, so the timed attempt is
// driven by the exam type instead (see getExamDurationMinutes): 60m for the
// quizzes, 90m for the End Term.

/**
 * The Mage Association hall from the course page, carried into the paper so
 * the walk in feels continuous. `dim` softens it further while a run is open.
 */
function HallBackdrop({ dim = false }: { dim?: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <img
        src={examHall}
        alt=""
        fetchPriority="high"
        className={cn('h-full w-full object-cover object-[65%_30%]', dim && 'scale-105 blur-[3px]')}
      />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/45 to-transparent" />
      <div className={cn('absolute inset-0', dim ? 'bg-[#0d0f14]/72' : 'bg-[#0d0f14]/35')} />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent from-40% to-[#0d0f14]/80" />
    </div>
  );
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function formatRemainingTime(totalSeconds: number | null) {
  if (totalSeconds === null) return '--:--';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Stand-in for the cover briefing (the page a paper opens on): the same hall,
 * the same two-page tome, with the briefing and the run choice still blank.
 */
function LoadingSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <SkeletonRegion label="Loading paper" tone="glass" className="relative isolate flex min-h-[calc(100vh-14rem)] w-full flex-col">
      <HallBackdrop />
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-sm text-white/75 transition-colors [text-shadow:0_1px_8px_rgba(0,0,0,0.6)] hover:bg-white/10 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to papers
      </button>
      <div className="flex flex-1 items-center justify-center py-6">
        <div className="exam-tome relative isolate grid w-full max-w-4xl overflow-hidden rounded-2xl border border-[rgba(214,178,110,0.24)] backdrop-blur-sm lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div aria-hidden="true" className="hidden min-h-[26rem] bg-black/25 lg:block" />
          <div className="relative z-10 flex flex-col px-6 py-8 sm:px-10 sm:py-10">
            <Skeleton className="h-3 w-40 rounded-full" />
            <Skeleton className="mt-2.5 h-3.5 w-28 rounded-full" />
            <Skeleton className="mt-3 h-10 w-4/5 rounded-lg sm:h-12" />
            <div className="mt-7 flex gap-8">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-8 w-10 rounded-md" />
                  <Skeleton className="h-3 w-16 rounded-full" />
                </div>
              ))}
            </div>
            <div className="mt-8 space-y-3">
              <Skeleton className="h-[74px] w-full rounded-xl" />
              <Skeleton className="h-[74px] w-full rounded-xl" />
            </div>
            <div className="mt-5 flex gap-2">
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="h-9 w-36 rounded-lg" />
            </div>
          </div>
          <div className="tcard-frame" aria-hidden="true" />
          <span className="tcard-corner tcard-corner-tl" aria-hidden="true" />
          <span className="tcard-corner tcard-corner-tr" aria-hidden="true" />
          <span className="tcard-corner tcard-corner-bl" aria-hidden="true" />
          <span className="tcard-corner tcard-corner-br" aria-hidden="true" />
        </div>
      </div>
    </SkeletonRegion>
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
  hidden = false,
  onToggleHidden,
}: {
  durationMinutes: number;
  remainingSeconds: number | null;
  running: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  expired: boolean;
  /** The taker chose to hide the countdown; it comes back on its own in the last 5 minutes. */
  hidden?: boolean;
  onToggleHidden?: () => void;
}) {
  // Amber under the last 5 minutes, red (and a stronger pulse) under the last
  // minute — both flush the clock and pulse.
  const warn = !expired && running && remainingSeconds !== null && remainingSeconds <= 300 && remainingSeconds > 60;
  const urgent = !expired && running && remainingSeconds !== null && remainingSeconds <= 60 && remainingSeconds > 0;
  const lastFive = remainingSeconds !== null && remainingSeconds <= 300;
  const concealed = hidden && !lastFive && !expired;
  return (
    <div
      data-urgent={urgent || expired}
      data-warn={warn}
      title={
        expired
          ? 'Time is up — answers were submitted automatically.'
          : running
          ? 'Timer is running (survives a refresh).'
          : 'Start to simulate the real exam clock.'
      }
      className={cn(
        'exam-clock exam-panel flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 backdrop-blur-sm',
        expired ? 'border-destructive/40 bg-destructive/10' : 'bg-[#14161b]/75',
      )}
    >
      <Timer
        className={cn('h-4 w-4', expired || urgent ? 'text-red-400' : warn ? 'text-amber-400' : '')}
        style={expired || urgent || warn ? undefined : { color: 'var(--lvl, var(--primary))' }}
        aria-hidden="true"
      />
      {concealed ? (
        <span className="text-sm text-muted-foreground">Timer hidden</span>
      ) : (
        <>
          <span
            className={cn(
              'text-base font-semibold tabular-nums',
              (expired || urgent) && 'text-red-400',
              warn && 'text-amber-400',
            )}
          >
            {formatRemainingTime(remainingSeconds)}
          </span>
          <span className="hidden text-xs text-muted-foreground sm:inline">/ {durationMinutes}m</span>
        </>
      )}
      {onToggleHidden && !lastFive && !expired && (
        <button
          type="button"
          onClick={onToggleHidden}
          aria-label={hidden ? 'Show timer' : 'Hide timer'}
          title={hidden ? 'Show timer' : 'Hide timer (it reappears at 5 minutes)'}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      )}
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

export function ResultsSummary({
  stats,
  onTryAgain,
  onReviewIncorrect,
  timeExpired = false,
}: {
  stats: {
    correct: number;
    incorrect: number;
    skipped: number;
    gradableTotal: number;
    scoredMarks: number;
    totalMarks: number;
    manualEvalCount: number;
  };
  onTryAgain: () => void;
  onReviewIncorrect?: () => void;
  timeExpired?: boolean;
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

  const hasBreakdown = stats.gradableTotal > 0;

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
            {timeExpired && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-amber-500">
                <Timer className="h-3.5 w-3.5" />
                Auto-submitted &middot; time expired
              </p>
            )}
            {stats.manualEvalCount > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {stats.manualEvalCount} response{stats.manualEvalCount === 1 ? '' : 's'} require manual evaluation.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:self-center">
          {stats.incorrect > 0 && onReviewIncorrect && (
            <Button
              variant="outline"
              onClick={onReviewIncorrect}
              className="gap-2 border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-red-200"
            >
              <XCircle className="h-4 w-4" />
              Review incorrect
            </Button>
          )}
          <Button variant="outline" onClick={onTryAgain} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>

      {/* Breakdown strip — the three auto-graded outcomes at a glance. */}
      {hasBreakdown && (
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center sm:gap-3">
          <div className="rounded-lg bg-emerald-500/10 px-2 py-2.5">
            <p className="inline-flex items-center justify-center gap-1.5 text-xl font-bold tabular-nums text-emerald-400">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {stats.correct}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Correct</p>
          </div>
          <div className="rounded-lg bg-red-500/10 px-2 py-2.5">
            <p className="inline-flex items-center justify-center gap-1.5 text-xl font-bold tabular-nums text-red-400">
              <XCircle className="h-4 w-4" aria-hidden="true" />
              {stats.incorrect}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Incorrect</p>
          </div>
          <div className="rounded-lg bg-white/5 px-2 py-2.5">
            <p className="text-xl font-bold tabular-nums text-muted-foreground">{stats.skipped}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Skipped</p>
          </div>
        </div>
      )}
    </div>
  );
}

const QUESTION_TYPE_META: Record<string, { label: string; accent: string }> = {
  MSQ: { label: 'MSQ', accent: '#a78bfa' },
  COMPREHENSION: { label: 'Passage', accent: '#62aef0' },
  SA: { label: 'Short Answer', accent: '#f0b462' },
  OPPE: { label: 'OPPE', accent: '#2dd4bf' },
  MCQ: { label: 'MCQ', accent: '#d6b26e' },
};

/** A single, theme-aligned chip: a quiet gold-tinted pill that carries the
 *  question type's semantic colour as a soft accent (no loud default pills). */
function QuestionTypeBadge({ type }: { type: string }) {
  const meta = QUESTION_TYPE_META[type] ?? { label: 'MCQ', accent: '#d6b26e' };
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{
        color: `color-mix(in srgb, ${meta.accent} 90%, white)`,
        backgroundColor: `color-mix(in srgb, ${meta.accent} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${meta.accent} 36%, transparent)`,
      }}
    >
      {meta.label}
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
  const imageParts = splitMarkupImages(text);
  if (imageParts.some((part) => part.kind === 'image')) {
    return (
      <div className={compact ? 'my-0 leading-relaxed' : 'my-2 leading-relaxed'}>
        {imageParts.map((part, index) =>
          part.kind === 'image' ? (
            <FlowImage key={`img-${index}`} src={part.src} alt="" />
          ) : (
            <InlineText key={`t-${index}`} text={part.text} />
          ),
        )}
      </div>
    );
  }

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

/** Inline text fragment (no block <p>) — used when text and inline math images
 *  are interleaved into one flowing line. */
function InlineText({ text }: { text: string }) {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  return <>{renderInlineMarkdown(normalizeMarkup(trimmed))}</>;
}

/**
 * Many source stems jam an enumerated list into one paragraph as literal bullet
 * glyphs ("summary: ● 70% … ● 40% … ● Among…"). Split a fragment into its
 * lead-in and list items, but only when there are genuinely ≥2 bullets — so a
 * lone stray glyph never reflows ordinary prose.
 */
function splitStemBullets(text: string): { lead: string; items: string[] } | null {
  if (!/[●•▪‣◦]/.test(text)) return null;
  const parts = text.split(/[●•▪‣◦]+/);
  const lead = (parts[0] ?? '').trim();
  const items = parts.slice(1).map((part) => part.trim()).filter(Boolean);
  if (items.length < 2) return null;
  return { lead, items };
}

/** A stem text fragment: renders an embedded bullet list as real lines when
 *  detected, otherwise flows inline (so interleaved math images still work). */
function StemText({ text }: { text: string }) {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  const imageParts = splitMarkupImages(trimmed);
  if (imageParts.some((part) => part.kind === 'image')) {
    return (
      <>
        {imageParts.map((part, index) =>
          part.kind === 'image' ? (
            <FlowImage key={`img-${index}`} src={part.src} alt="" />
          ) : (
            <InlineText key={`t-${index}`} text={part.text} />
          ),
        )}
      </>
    );
  }
  const list = splitStemBullets(trimmed);
  if (!list) return <InlineText text={trimmed} />;
  return (
    <>
      {list.lead && <span className="block">{renderInlineMarkdown(normalizeMarkup(list.lead))}</span>}
      <ul className="exam-stem-list">
        {list.items.map((item, index) => (
          <li key={index}>{renderInlineMarkdown(normalizeMarkup(item))}</li>
        ))}
      </ul>
    </>
  );
}

/**
 * An image that belongs to a question/option. The source stores math as small
 * pre-rendered PNGs (~31px tall) meant to sit *inline* with the text; larger
 * PNGs are real figures/diagrams. We start inline and, on load, promote tall
 * images to a centered block. This is what reconnects "edge-length [2]
 * centered…" into a readable sentence.
 */
function FlowImage({ src, alt, inOption = false }: { src: string; alt: string; inOption?: boolean }) {
  const [block, setBlock] = useState(false);
  const [srcIndex, setSrcIndex] = useState(0);
  const openZoom = useImageZoom();
  const candidates = imageSourceFallbacks(src);
  const current = candidates[Math.min(srcIndex, candidates.length - 1)] ?? src;
  const zoomable = block && openZoom !== null;
  const open = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    event.preventDefault();
    openZoom?.(current, alt);
  };
  return (
    // The wrapper is always rendered so promoting to a block doesn't remount the img.
    <span className={block ? 'group/fig relative my-3 block w-fit max-w-full' : 'inline'}>
      <img
        src={current}
        alt={alt}
        loading="lazy"
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalHeight > 44) setBlock(true);
        }}
        onError={(e) => {
          if (srcIndex + 1 < candidates.length) {
            setSrcIndex(srcIndex + 1);
            return;
          }
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
        // Inside an option a click on the figure picks the option; elsewhere it enlarges.
        onClick={zoomable && !inOption ? open : undefined}
        // Figures can be photos or coloured charts, which inverting turns into
        // negatives, so they sit untouched on a white sheet. Only the small
        // black-on-white math glyphs are inverted to read on the dark page.
        className={
          block
            ? cn(
                'block max-h-80 max-w-full rounded-lg bg-white object-contain p-1.5 shadow-md shadow-black/40 ring-1 ring-white/10',
                zoomable && !inOption && 'cursor-zoom-in transition-shadow hover:ring-[#d6b26e]/60',
              )
            : 'mx-[0.15em] inline-block h-[1.3em] w-auto max-w-full align-middle invert mix-blend-screen'
        }
      />
      {zoomable && (
        <span
          role="button"
          tabIndex={0}
          aria-label={`Enlarge ${alt}`}
          title="Enlarge"
          onClick={open}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') open(event);
          }}
          className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-1 text-[11px] font-medium text-white opacity-70 shadow transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 group-hover/fig:opacity-100"
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Enlarge</span>
        </span>
      )}
    </span>
  );
}

/**
 * Interleaves question/option text fragments with their images in field order
 * (text_1, image_1, text_2, image_2, …) so inline math lands where it belongs.
 * Indices are kept aligned — empty slots are skipped, not compacted.
 */
function QuestionMedia({
  texts,
  images,
  altPrefix,
}: {
  texts: Array<string | null | undefined>;
  images: Array<string | undefined>;
  altPrefix: string;
}) {
  const max = Math.max(texts.length, images.length);
  const parts: React.ReactNode[] = [];
  for (let i = 0; i < max; i++) {
    const text = texts[i]?.trim();
    if (text) parts.push(<StemText key={`t-${i}`} text={text} />);
    const image = images[i];
    if (image) parts.push(<FlowImage key={`i-${i}`} src={image} alt={`${altPrefix} ${i + 1}`} />);
  }
  if (parts.length === 0) return null;
  return <div className="max-w-none leading-relaxed text-foreground">{parts}</div>;
}

export function OptionButton({
  option,
  optionIndex,
  isSelected,
  isCorrect,
  showResults,
  onClick,
  eliminated = false,
  onToggleEliminate,
}: {
  option: { optionText?: string | null; optionImage?: string | null };
  optionIndex: number;
  isSelected: boolean;
  isCorrect: boolean;
  showResults: boolean;
  onClick: () => void;
  /** Struck out by the test-taker as a likely wrong choice (pre-submit only). */
  eliminated?: boolean;
  onToggleEliminate?: () => void;
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
  } else if (eliminated && !isSelected) {
    containerClass += 'border-dashed border-white/10 bg-transparent opacity-45 hover:opacity-70';
    indicatorClass += 'bg-muted text-muted-foreground line-through';
  } else if (isSelected) {
    containerClass +=
      'border-[color-mix(in_srgb,var(--lvl,#62aef0)_70%,transparent)] bg-[color-mix(in_srgb,var(--lvl,#62aef0)_12%,transparent)] shadow-[inset_0_0_24px_-12px_color-mix(in_srgb,var(--lvl,#62aef0)_80%,transparent)]';
    indicatorClass += 'bg-[var(--lvl,#62aef0)] text-white';
  } else {
    containerClass +=
      'border-[rgba(214,178,110,0.18)] bg-black/15 hover:border-[color-mix(in_srgb,var(--lvl,#62aef0)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--lvl,#62aef0)_8%,transparent)] active:bg-black/25';
    indicatorClass += 'bg-muted text-muted-foreground group-hover:text-foreground';
  }

  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={showResults}
      aria-pressed={!showResults ? isSelected : undefined}
      aria-label={`Option ${label}${isSelected ? ', selected' : ''}${eliminated && !showResults ? ', crossed out' : ''}${showResults ? isCorrect ? ', correct' : isSelected ? ', incorrect' : '' : ''}`}
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

      <div className={cn('flex-1 min-w-0 text-[15px]', eliminated && !isSelected && !showResults && 'line-through decoration-white/50')}>
        {hasOptionText && <RichText text={optionText} compact />}
        {hasOptionImage && (
          <FlowImage src={getOptionImageUrl(option.optionImage ?? undefined) ?? ''} alt={`Option ${label}`} inOption />
        )}
        {!hasOptionText && !hasOptionImage && (
          <span className="text-sm text-muted-foreground italic">
            Option content unavailable
          </span>
        )}
      </div>
    </button>
  );

  if (!onToggleEliminate || showResults) return button;
  return (
    <div className="group/opt flex items-stretch gap-1.5">
      {button}
      <button
        type="button"
        onClick={onToggleEliminate}
        aria-pressed={eliminated}
        aria-label={eliminated ? `Restore option ${label}` : `Cross out option ${label}`}
        title={eliminated ? 'Restore option' : 'Cross out (rule this option out)'}
        className={cn(
          'flex w-9 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold transition-all focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
          eliminated
            ? 'border-white/15 text-foreground/80 hover:bg-white/10'
            : 'border-transparent text-muted-foreground opacity-0 hover:border-white/10 hover:bg-white/5 hover:text-foreground group-hover/opt:opacity-100 [@media(hover:none)]:opacity-60',
        )}
      >
        {eliminated ? <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> : <span className="line-through">{label}</span>}
      </button>
    </div>
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
    'rounded-md border border-[rgba(214,178,110,0.2)] bg-black/25 py-1.5 text-sm font-medium text-foreground backdrop-blur-sm transition-colors hover:border-[color-mix(in_srgb,var(--lvl,#62aef0)_50%,transparent)] hover:bg-[color-mix(in_srgb,var(--lvl,#62aef0)_12%,transparent)] active:bg-black/40';

  return (
    <div className="max-w-[210px]">
      <div className="grid grid-cols-3 gap-1.5">
        {KEYPAD_KEYS.map((key) => (
          <button key={key} type="button" onClick={() => press(key)} aria-label={`Type ${key}`} className={keyClass}>
            {key}
          </button>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
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
  question,
  value,
  numeric,
  disabled,
  showResults,
  onChange,
}: {
  question: QuizQuestion;
  value: string;
  numeric: boolean;
  disabled: boolean;
  showResults: boolean;
  onChange: (next: string) => void;
}) {
  const key = describeShortAnswerKey(question);
  const answered = value.trim() !== '';
  const correct = showResults && key !== null && isPracticeRunQuestionCorrect(question, value);

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
        placeholder={showResults ? 'No answer given' : numeric ? 'Enter numeric answer' : 'Enter your answer'}
        className={cn(
          'w-full rounded-md border bg-black/25 px-3 py-2 text-sm text-foreground outline-none backdrop-blur-sm focus:border-[color-mix(in_srgb,var(--lvl,#62aef0)_55%,transparent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--lvl,#62aef0)_40%,transparent)]',
          showResults && key !== null && answered
            ? correct
              ? 'border-emerald-500/60 bg-emerald-500/10'
              : 'border-red-500/60 bg-red-500/10'
            : 'border-[rgba(214,178,110,0.22)]',
        )}
      />
      {numeric && !disabled && <NumericKeypad value={value} onChange={onChange} />}
      {showResults ? (
        key !== null ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {answered && (
              <span className={cn('inline-flex items-center gap-1 font-medium', correct ? 'text-emerald-400' : 'text-red-400')}>
                {correct ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
                {correct ? 'Correct' : 'Incorrect'}
              </span>
            )}
            <span className="text-muted-foreground">
              Accepted answer: <span className="font-medium tabular-nums text-foreground">{key}</span>
            </span>
          </p>
        ) : (
          <p className="text-xs italic text-muted-foreground">Not auto-graded: check it against your notes or the answer PDF.</p>
        )
      ) : (
        <p className="text-xs text-muted-foreground">
          {key !== null ? 'Checked against the answer key when you hand in.' : 'Not auto-graded.'}
        </p>
      )}
    </div>
  );
}

interface PassagePart {
  uuid: string;
  /** 1-based passage ordinal within the paper. */
  number: number;
  /** 0-based position of this page's question within the passage. */
  part: number;
  parts: number;
}

/** Test-taking aids threaded from the page into each question. */
interface QuestionTools {
  /** Reading zoom for passage, stem and options (1 = default). */
  textScale: number;
  /** Options the taker struck out, per question uuid. */
  eliminated: Record<string, string[]>;
  onToggleEliminate: (questionId: string, optionId: string) => void;
  onClear: (questionId: string) => void;
}

interface ExamPage {
  question: QuestionWithChildren;
  /** The answerable question on this page — what flags key on. */
  id: string;
  passage?: PassagePart;
}

function QuestionCard({
  question,
  index,
  selectedAnswers,
  showResults,
  onSelectAnswer,
  onShortAnswerChange,
  isSubQuestion = false,
  isFlagged = false,
  passage,
  tools,
}: {
  question: QuestionWithChildren;
  index: number;
  passage?: PassagePart;
  tools?: QuestionTools;
  selectedAnswers: SelectedAnswers;
  showResults: boolean;
  onSelectAnswer: (questionId: string, optionIndex: string, questionType: QuestionType) => void;
  onShortAnswerChange: (questionId: string, answer: string) => void;
  isSubQuestion?: boolean;
  isFlagged?: boolean;
}) {
  const selectedAnswer = selectedAnswers[question.uuid];
  // Comprehension passages can be collapsed to reclaim room for the sub-questions.
  const [passageOpen, setPassageOpen] = useState(true);
  // Kept index-aligned (no filter): text_i and image_i interleave so inline
  // math images land between the right text fragments.
  const questionTexts = [
    question.questionText1,
    question.questionText2,
    question.questionText3,
    question.questionText4,
    question.questionText5,
  ];

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
  ];

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
  // Alphanumeric keys ("thick", "A,B,E") need letters; everything else gets
  // the numeric field and keypad.
  const isNumericInput = responseType !== 'alphanumeric' && (question.questionType === 'SA' || isNumericShortAnswer);
  const hasOptions = question.options.length > 0;
  const hasAnswer = Array.isArray(selectedAnswer)
    ? selectedAnswer.length > 0
    : typeof selectedAnswer === 'string' && selectedAnswer !== '';
  const struck = tools?.eliminated[question.uuid] ?? [];
  const scaleStyle = tools && tools.textScale !== 1 ? { zoom: tools.textScale } : undefined;

  // "Clear response", as in the real exam software: un-answers the question.
  const clearButton = !showResults && hasAnswer && !isComprehension && tools && (
    <button
      type="button"
      onClick={() => tools.onClear(question.uuid)}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
    >
      <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
      Clear response
    </button>
  );

  const answerArea = isShortAnswer ? (
    <ShortAnswerField
      question={question}
      value={typeof selectedAnswer === 'string' ? selectedAnswer : ''}
      numeric={isNumericInput}
      disabled={showResults}
      showResults={showResults}
      onChange={(next) => onShortAnswerChange(question.uuid, next)}
    />
  ) : (
    <div className="space-y-2">
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
            onClick={() => onSelectAnswer(question.uuid, optionId, question.questionType)}
            eliminated={struck.includes(optionId)}
            onToggleEliminate={tools ? () => tools.onToggleEliminate(question.uuid, optionId) : undefined}
          />
        );
      })}
      {!hasOptions && (
        <p className="text-xs text-muted-foreground italic px-1">
          No options available for this question.
        </p>
      )}
    </div>
  );

  if (isSubQuestion) {
    return (
      <div className="exam-q-enter rounded-lg border border-[rgba(214,178,110,0.16)] bg-black/20 p-4 xl:flex-1" style={scaleStyle}>
        <div className="flex gap-3">
          {index >= 0 && (
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--lvl,#62aef0)_40%,transparent)] bg-[color-mix(in_srgb,var(--lvl,#62aef0)_14%,transparent)] text-xs font-bold text-[color-mix(in_srgb,var(--lvl,#62aef0)_92%,white)]">
              {index + 1}
            </div>
          )}
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
                  {clearButton && <span className="ml-auto">{clearButton}</span>}
                </div>
                <QuestionMedia
                  texts={questionTexts}
                  images={questionImages}
                  altPrefix={`Question ${index + 1} image`}
                />
              </div>
            </div>
            {!isComprehension && answerArea}
          </div>
        </div>
      </div>
    );
  }

  const passageBody = (
    <QuestionMedia
      texts={questionTexts}
      images={questionImages}
      altPrefix={`Question ${index + 1} image`}
    />
  );

  return (
    // The card fills the space between the exam bar and the pager. On wide
    // screens a passage page is a fixed split view: passage and question each
    // scroll on their own, as in the real exam software.
    <div
      className={cn(
        'exam-tome relative isolate flex flex-col overflow-clip rounded-2xl border border-[rgba(214,178,110,0.24)] px-4 pb-5 pt-4 backdrop-blur-sm sm:px-6 sm:pb-6 sm:pt-5',
        'lg:min-h-[calc(100dvh-var(--exam-chrome))]',
        isComprehension && 'xl:h-[calc(100dvh-var(--exam-chrome))]',
      )}
    >
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-4">
        {/* Header: which question, its type and weight — the flag lives in the pager. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[rgba(214,178,110,0.14)] pb-3">
          <h2 className="font-display text-xl font-normal tracking-tight">
            {isComprehension && !passage ? 'Passage' : 'Question'}{' '}
            <span className="tabular-nums text-[#d6b26e]">{index + 1}</span>
          </h2>
          {!isComprehension && <QuestionTypeBadge type={question.questionType} />}
          {passage ? (
            <span className="text-xs text-muted-foreground">
              Passage {passage.number}
              {passage.parts > 1 && (
                <>
                  {' · '}
                  <span className="tabular-nums text-foreground/80">
                    part {passage.part + 1} of {passage.parts}
                  </span>
                </>
              )}
            </span>
          ) : (
            isComprehension && question.subQuestions && (
              <span className="text-xs text-muted-foreground">
                {question.subQuestions.length} {question.subQuestions.length === 1 ? 'question' : 'questions'}
              </span>
            )
          )}
          {marks > 0 && !passage && (
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {marks} {marks === 1 ? 'mark' : 'marks'}
            </span>
          )}
          <span className="ml-auto flex items-center gap-3">
            {clearButton}
            {isFlagged && !showResults && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-300">
                <Flag className="h-3.5 w-3.5 fill-amber-400/80" aria-hidden="true" />
                Flagged
              </span>
            )}
          </span>
        </div>

        {isComprehension ? (
          // Wide screens read like a real exam: the passage stays put on the
          // left while its questions scroll on the right.
          <div className="grid gap-5 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section
              aria-label="Passage"
              className="exam-passage rounded-xl p-4 xl:flex xl:min-h-0 xl:flex-col"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Read the passage
                </p>
                <button
                  type="button"
                  onClick={() => setPassageOpen((open) => !open)}
                  aria-expanded={passageOpen}
                  className="rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground xl:hidden"
                >
                  {passageOpen ? 'Hide' : 'Show'}
                </button>
              </div>
              <div
                className={cn(
                  'exam-scroll space-y-3 text-[15.5px] leading-[1.72] sm:text-[16px] xl:block xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-2',
                  passageOpen ? 'max-h-[45vh] overflow-y-auto pr-1 xl:max-h-none' : 'hidden',
                )}
                style={scaleStyle}
              >
                {passageBody}
              </div>
            </section>

            {question.subQuestions && question.subQuestions.length > 0 && (
              <div className="exam-scroll space-y-3 xl:flex xl:min-h-0 xl:flex-col xl:overflow-y-auto xl:pr-1">
                {question.subQuestions.map((subQuestion, subIndex) => (
                  <QuestionCard
                    key={subQuestion.uuid}
                    question={subQuestion}
                    // A split passage page has one question, already numbered in the header.
                    index={passage ? -1 : subIndex}
                    tools={tools}
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
        ) : (
          <>
            <div className="exam-measure space-y-4" style={scaleStyle}>
              <div className="space-y-3 text-[15.5px] leading-[1.72] sm:text-[16.5px]">{passageBody}</div>
              <div className="pt-1">{answerArea}</div>
            </div>
          </>
        )}
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

/**
 * Right-rail navigator: a grid of question numbers that reflects answered /
 * partially-answered / untouched state and lets the user jump to any question.
 * Uses the horizontal space the single-question layout frees up.
 */
export function QuestionNavigator({
  states,
  reviewStates,
  flagged,
  flaggedCount,
  incorrectCount = 0,
  currentIndex,
  onJump,
  onJumpNextFlagged,
  onJumpNextIncorrect,
}: {
  states: PracticeRunPageState[];
  /** When set (post-submission), cells colour by correctness instead of progress. */
  reviewStates?: PracticeRunReviewState[] | null;
  flagged: boolean[];
  flaggedCount: number;
  incorrectCount?: number;
  currentIndex: number;
  onJump: (index: number) => void;
  onJumpNextFlagged: () => void;
  onJumpNextIncorrect?: () => void;
}) {
  const reviewMode = !!reviewStates;
  const done = states.filter((state) => state === 'done').length;
  // In review the gradable denominator excludes manual-eval pages — "X / Y correct".
  const gradablePages = reviewStates
    ? reviewStates.filter((state) => state !== 'manual').length
    : 0;
  const correctPages = reviewStates
    ? reviewStates.filter((state) => state === 'correct').length
    : 0;

  const reviewLabel: Record<PracticeRunReviewState, string> = {
    correct: ', correct',
    incorrect: ', incorrect',
    unanswered: ', skipped',
    manual: ', needs manual review',
  };

  return (
    <div className="exam-panel exam-tome relative isolate overflow-hidden rounded-2xl p-4 backdrop-blur-sm">
      {/* Faint summoning sigil watermark — ties the rail to the deck. */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 opacity-[0.06]">
        <ArcaneSigil />
      </div>
      <div className="relative z-10 mb-2 flex items-center justify-between">
        <h2 className="font-display text-base font-normal tracking-tight">
          {reviewMode ? 'Review' : 'Questions'}
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {reviewMode ? `${correctPages}/${gradablePages} correct` : `${done}/${states.length} done`}
        </span>
      </div>
      <RunicDivider className="relative z-10 mb-3" />
      <div className="relative z-10 grid grid-cols-5 gap-2">
        {states.map((state, index) => {
          const isCurrent = index === currentIndex;
          const review = reviewStates?.[index];
          return (
            <button
              key={index}
              type="button"
              onClick={() => onJump(index)}
              aria-current={isCurrent ? 'true' : undefined}
              aria-label={`Go to question ${index + 1}${
                review
                  ? reviewLabel[review]
                  : state === 'done'
                  ? ', answered'
                  : state === 'partial'
                  ? ', partly answered'
                  : ''
              }${flagged[index] ? ', flagged' : ''}`}
              className={cn(
                'relative flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium transition-colors',
                // Review mode: colour by correctness.
                review === 'correct' && 'border-emerald-500/45 bg-emerald-500/15 text-emerald-300',
                review === 'incorrect' && 'border-red-500/45 bg-red-500/15 text-red-300',
                review === 'unanswered' && 'border-border bg-black/20 text-muted-foreground',
                review === 'manual' &&
                  'border-[rgba(214,178,110,0.4)] bg-[rgba(214,178,110,0.12)] text-[#d6b26e]',
                // Run mode: colour by answer progress.
                !reviewMode &&
                  state === 'done' &&
                  'border-[color-mix(in_srgb,var(--lvl,#62aef0)_50%,transparent)] bg-[color-mix(in_srgb,var(--lvl,#62aef0)_18%,transparent)] text-[color-mix(in_srgb,var(--lvl,#62aef0)_92%,white)]',
                !reviewMode &&
                  state === 'partial' &&
                  'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                !reviewMode &&
                  state === 'none' &&
                  'border-[rgba(214,178,110,0.16)] bg-black/20 text-muted-foreground hover:border-[color-mix(in_srgb,var(--lvl,#62aef0)_45%,transparent)] hover:text-foreground',
                isCurrent && 'ring-2 ring-[#d6b26e] ring-offset-1 ring-offset-background',
              )}
            >
              {index + 1}
              {flagged[index] && (
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 ring-2 ring-background"
                >
                  <Flag className="h-2 w-2 fill-black text-black" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {reviewMode && incorrectCount > 0 && onJumpNextIncorrect && (
        <button
          type="button"
          onClick={onJumpNextIncorrect}
          className="relative z-10 mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20"
        >
          <XCircle className="h-3 w-3" aria-hidden="true" />
          Next incorrect ({incorrectCount})
        </button>
      )}
      {flaggedCount > 0 && (
        <button
          type="button"
          onClick={onJumpNextFlagged}
          className="relative z-10 mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
        >
          <Flag className="h-3 w-3 fill-amber-400/80" aria-hidden="true" />
          Next flagged ({flaggedCount})
        </button>
      )}
      <div className="relative z-10 mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {reviewMode ? (
          <>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/45" aria-hidden="true" />
              Correct
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-500/45" aria-hidden="true" />
              Incorrect
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm border border-border" aria-hidden="true" />
              Skipped
            </span>
            {reviewStates?.includes('manual') && (
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-[rgba(214,178,110,0.4)]" aria-hidden="true" />
                Manual
              </span>
            )}
          </>
        ) : (
          <>
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
          </>
        )}
        <span className="flex items-center gap-1">
          <Flag className="h-2.5 w-2.5 fill-amber-400/80 text-amber-400" aria-hidden="true" />
          Flagged
        </span>
      </div>
    </div>
  );
}

/** Runic rule line with a centered diamond node — the structural divider that
 *  carries the ArcaneSigil grammar into the header crest and section breaks. */
function RunicDivider({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn('runic-divider', className)} role="presentation">
      <span className="runic-divider-line" aria-hidden="true" />
      {label ? (
        <span className="runic-divider-label">{label}</span>
      ) : (
        <span className="runic-divider-node" aria-hidden="true" />
      )}
      <span className="runic-divider-line" aria-hidden="true" />
    </div>
  );
}

/** A single stat on the cover (questions / marks / duration). */
function CoverStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5 px-5 first:pl-0">
      <span className="font-display text-3xl font-normal tabular-nums leading-none">{value}</span>
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Cover: the threshold shown on entering a paper variant. Art on one side; on
 * the other, what the paper is and the choice to *sit* it (Timed Run) or simply
 * *read* it (Open Run).
 */
function RunCoverPlate({
  examName,
  paperName,
  courseName,
  levelColor,
  totalQuestions,
  totalMarks,
  durationMinutes,
  paperUuid,
  courseUuid,
  examUuid,
  onBeginTimed,
  onBeginOpen,
  onBack,
}: {
  examName: string;
  paperName: string;
  courseName: string;
  levelColor: string | null;
  totalQuestions: number;
  totalMarks: number;
  durationMinutes: number;
  paperUuid: string;
  courseUuid: string;
  examUuid: string;
  onBeginTimed: () => void;
  onBeginOpen: () => void;
  onBack: () => void;
}) {
  return (
    <div
      className="relative isolate flex min-h-[calc(100vh-14rem)] w-full flex-col"
      style={{ ['--ring' as string]: '#d6b26e' }}
    >
      <HallBackdrop />

      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-sm text-white/75 transition-colors [text-shadow:0_1px_8px_rgba(0,0,0,0.6)] hover:bg-white/10 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to papers
      </button>

      <div className="flex flex-1 items-center justify-center py-6">
        <div className="exam-tome exam-cover exam-q-enter relative isolate grid w-full max-w-4xl overflow-hidden rounded-2xl border border-[rgba(214,178,110,0.24)] backdrop-blur-sm lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* Art panel: fades into the card on the reading side. */}
          <div aria-hidden="true" className="relative hidden min-h-[26rem] lg:block">
            <img
              src={coverArt}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-[50%_40%]"
            />
            <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[#0E1530]/90 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#0E1530]/70 to-transparent" />
          </div>

          <div className="relative z-10 flex flex-col px-6 py-8 sm:px-10 sm:py-10">
            {courseName && (
              <p className="text-xs font-medium uppercase tracking-[0.18em]" style={{ color: levelColor ?? undefined }}>
                {courseName}
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">{examName}</p>
            <h1 className="mt-1.5 font-display text-4xl font-normal leading-tight tracking-tight sm:text-5xl">
              {paperName}
            </h1>

            <div className="mt-7 flex items-stretch divide-x divide-[rgba(214,178,110,0.18)]">
              <CoverStat value={String(totalQuestions)} label={totalQuestions === 1 ? 'question' : 'questions'} />
              {totalMarks > 0 && <CoverStat value={String(totalMarks)} label="marks" />}
              <CoverStat value={`${durationMinutes}m`} label="duration" />
            </div>

            <div className="mt-8 space-y-3">
              <button
                type="button"
                onClick={onBeginTimed}
                className="exam-cover-cta group flex w-full items-center justify-between gap-3 rounded-xl border border-[rgba(214,178,110,0.5)] bg-[rgba(214,178,110,0.12)] px-5 py-4 text-left transition-colors hover:border-[rgba(214,178,110,0.8)] hover:bg-[rgba(214,178,110,0.2)]"
              >
                <span className="flex items-center gap-3.5">
                  <Timer className="h-5 w-5 shrink-0 text-[#e6c88a]" aria-hidden="true" />
                  <span>
                    <span className="block font-medium text-amber-50">Timed run</span>
                    <span className="block text-xs text-muted-foreground">{durationMinutes} minutes</span>
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#e6c88a] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onBeginOpen}
                className="group flex w-full items-center justify-between gap-3 rounded-xl border border-[rgba(214,178,110,0.22)] bg-black/20 px-5 py-4 text-left transition-colors hover:border-[rgba(214,178,110,0.4)] hover:bg-black/30"
              >
                <span className="flex items-center gap-3.5">
                  <BookOpen className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>
                    <span className="block font-medium">Open run</span>
                    <span className="block text-xs text-muted-foreground">No clock</span>
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <DownloadPdfButton paperUuid={paperUuid} courseUuid={courseUuid} examUuid={examUuid} />
              <DownloadPdfButton paperUuid={paperUuid} courseUuid={courseUuid} examUuid={examUuid} answers />
            </div>
          </div>

          <div className="tcard-frame" aria-hidden="true" />
          <span className="tcard-corner tcard-corner-tl" aria-hidden="true" />
          <span className="tcard-corner tcard-corner-tr" aria-hidden="true" />
          <span className="tcard-corner tcard-corner-bl" aria-hidden="true" />
          <span className="tcard-corner tcard-corner-br" aria-hidden="true" />
        </div>
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
    () => (paperId ? getPracticeRunStorageKey(paperId, courseId, examId) : null),
    [courseId, examId, paperId],
  );
  const [selectedAnswers, setSelectedAnswers] = useState<SelectedAnswers>({});
  const [showResults, setShowResults] = useState(false);
  const [summoning, setSummoning] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [paper, setPaper] = useState<PaperDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadError, setLoadError] = useState('Could not load this paper.');
  const [verification, setVerification] = useState<{ siteKey: string; binding: string } | null>(null);
  const verificationToken = useRef<{ paperId: string; token: string } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  // null while the cover plate is up; set once the user picks Timed/Open Run.
  const [runMode, setRunMode] = useState<RunMode | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  // Test-taking aids. Struck-out options live only for this sitting; the
  // reading size is a per-device preference.
  const [eliminated, setEliminated] = useState<Record<string, string[]>>({});
  const [calcOpen, setCalcOpen] = useState(false);
  const [timerHidden, setTimerHidden] = useState(false);
  const [textScale, setTextScale] = useState(() => {
    try {
      const saved = Number(window.localStorage.getItem(TEXT_SCALE_KEY));
      return TEXT_SCALES.includes(saved) ? saved : 1;
    } catch {
      return 1;
    }
  });
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [lowTimeWarning, setLowTimeWarning] = useState<'5min' | '1min' | null>(null);
  // One-shot guards so each low-time warning fires exactly once per run.
  const warned5Ref = useRef(false);
  const warned1Ref = useRef(false);
  const warningTimeoutRef = useRef<number | null>(null);
  const { getToken, isSignedIn } = useAuth();
  // After hand-in: the report, or stepping through questions under a filter.
  const [resultsView, setResultsView] = useState<'report' | 'review'>('report');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  // Attempt record: when the sitting began, how long it took, and the stored
  // server copy once saved. Retries append, so `attempts` is the history.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [timeUsed, setTimeUsed] = useState<number | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<AttemptSaveState>('idle');
  const [saveNonce, setSaveNonce] = useState(0);
  const [attempts, setAttempts] = useState<AttemptSummary[] | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [compare, setCompare] = useState<AttemptDetail | null>(null);
  const savingRef = useRef(false);
  // Bumped on Try again so a save still in flight can't attach to the new run.
  const runTokenRef = useRef(0);

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
    setVerification(null);
    setLoadError('Could not load this paper.');
    setSelectedAnswers({});
    setShowResults(false);
    setCurrentIndex(0);

    const turnstileToken = verificationToken.current?.paperId === paperId ? verificationToken.current.token : undefined;
    verificationToken.current = null;
    Promise.all([
      getPaperByUuid(paperId, courseId, examUuidFromSearch, { signal: controller.signal, getToken }),
      getQuestionsByPaperUuid(paperId, courseId, examUuidFromSearch, { signal: controller.signal, getToken, turnstileToken }),
    ])
      .then(([paperData, questionData]) => {
        if (active) {
          // Derive the clock from the freshly-fetched paper's exam type — the
          // `durationMinutes` from render scope is still stale here (paper was
          // null when this effect's closure was created).
          const initDuration = getExamDurationMinutes(getExamSlugFromUuid(paperData.examUuid));
          const initSeconds = initDuration * 60;
          const savedSession = storageKey
            ? readPracticeRunSession(storageKey, initDuration)
            : null;

          setPaper(paperData);
          setQuestions(questionData);
          setSelectedAnswers(savedSession?.selectedAnswers ?? {});
          setShowResults(savedSession?.showResults ?? false);
          setTimerRunning(savedSession?.timerRunning ?? false);
          setRemainingSeconds(savedSession?.remainingSeconds ?? initSeconds);
          setTimerEndsAt(savedSession?.timerEndsAt ?? null);
          setTimeExpired((savedSession?.remainingSeconds ?? initSeconds) === 0);
          setFlaggedIds(new Set(savedSession?.flaggedIds ?? []));
          setStartedAt(savedSession?.startedAt ?? null);
          setTimeUsed(savedSession?.timeUsedSeconds ?? null);
          setAttemptId(savedSession?.attemptId ?? null);
          setSaveState(savedSession?.attemptId ? 'saved' : 'idle');
          setResultsView('report');
          setAttempts(null);
          setCompareId(null);
          setCompare(null);
          savingRef.current = false;
          // Restore the chosen mode; a fresh paper (no save) shows the cover
          // plate. A finished/reviewing run skips the gate and goes straight in.
          setRunMode(savedSession?.runMode ?? (savedSession?.showResults ? 'open' : null));
          // If we restored into already-low time, suppress the (now stale)
          // crossing warnings so they don't fire spuriously on the next tick.
          const restoredSeconds = savedSession?.remainingSeconds ?? initSeconds;
          warned5Ref.current = restoredSeconds <= 300;
          warned1Ref.current = restoredSeconds <= 60;
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        logger.error('Failed to load paper data', error);
        if (active) {
          if (error instanceof VerificationRequiredError) {
            setVerification({ siteKey: error.siteKey, binding: error.binding });
          }
          setLoadFailed(true);
          setLoadError(error instanceof ApiRequestError ? error.message : 'Could not load this paper.');
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
  }, [paperId, courseId, examUuidFromSearch, storageKey, retryNonce, getToken]);

  useEffect(() => {
    if (!paper || !storageKey) return;

    const payload: SavedPracticeRunSession = {
      selectedAnswers,
      showResults,
      timerRunning,
      remainingSeconds,
      timerEndsAt,
      flaggedIds: Array.from(flaggedIds),
      runMode,
      startedAt,
      timeUsedSeconds: timeUsed,
      attemptId,
    };

    writePracticeRunSession(storageKey, payload);
  }, [paper, remainingSeconds, selectedAnswers, showResults, storageKey, timerEndsAt, timerRunning, flaggedIds, runMode, startedAt, timeUsed, attemptId]);

  useEffect(() => {
    if (!paper || !timerRunning || showResults || timerEndsAt === null) {
      return;
    }

    const flashWarning = (which: '5min' | '1min') => {
      setLowTimeWarning(which);
      if (warningTimeoutRef.current) window.clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = window.setTimeout(() => setLowTimeWarning(null), 4500);
    };

    const syncRemaining = () => {
      const nextRemaining = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
      setRemainingSeconds(nextRemaining);

      // Crossing low-time thresholds — each fires once (refs reset on start/reset).
      if (nextRemaining <= 60 && nextRemaining > 0 && !warned1Ref.current) {
        warned1Ref.current = true;
        warned5Ref.current = true;
        flashWarning('1min');
      } else if (nextRemaining <= 300 && nextRemaining > 60 && !warned5Ref.current) {
        warned5Ref.current = true;
        flashWarning('5min');
      }

      if (nextRemaining === 0) {
        setTimerRunning(false);
        setTimerEndsAt(null);
        setTimeExpired(true);
        setLowTimeWarning(null);
        // Don't snap silently to results — show a brief "time's up" beat first.
        if (prefersReducedMotion()) {
          setShowResults(true);
          setCurrentIndex(0);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          setAutoSubmitting(true);
          window.setTimeout(() => {
            setAutoSubmitting(false);
            setShowResults(true);
            setCurrentIndex(0);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }, 900);
        }
      }
    };

    syncRemaining();
    const interval = window.setInterval(syncRemaining, 1000);

    return () => window.clearInterval(interval);
  }, [paper, showResults, timerEndsAt, timerRunning]);

  useEffect(() => () => {
    if (warningTimeoutRef.current) window.clearTimeout(warningTimeoutRef.current);
  }, []);

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

  const groupedQuestions = useMemo(() => groupPracticeRunQuestions(questions), [questions]);

  const stats = useMemo(
    () => calculatePracticeRunStats(groupedQuestions, selectedAnswers, showResults),
    [groupedQuestions, selectedAnswers, showResults],
  );

  // Fix the sitting's length at hand-in: the clock's spend for a timed run,
  // wall time since the start for an open one (unknown for older saves).
  const canMeasureTime = runMode === 'timed' ? remainingSeconds !== null : startedAt !== null;
  useEffect(() => {
    if (!showResults || timeUsed !== null || !canMeasureTime) return;
    if (runMode === 'timed' && remainingSeconds !== null) {
      setTimeUsed(Math.max(0, durationMinutes * 60 - remainingSeconds));
    } else if (startedAt !== null) {
      setTimeUsed(Math.max(0, Math.round((Date.now() - startedAt) / 1000)));
    }
  }, [showResults, timeUsed, canMeasureTime, runMode, remainingSeconds, durationMinutes, startedAt]);

  // Store the hand-in for signed-in users. The server re-grades from the paper,
  // so the stored score never trusts the client.
  useEffect(() => {
    if (!showResults || !paper || !runMode || !isSignedIn || attemptId || savingRef.current) return;
    if (canMeasureTime && timeUsed === null) return;
    const token = runTokenRef.current;
    savingRef.current = true;
    setSaveState('saving');
    submitAttempt(
      {
        paperId: paper._id,
        runMode,
        answers: selectedAnswers,
        flaggedIds: Array.from(flaggedIds),
        timeUsedSeconds: timeUsed,
        timeExpired,
      },
      getToken,
    )
      .then((saved) => {
        if (token !== runTokenRef.current) return;
        setAttemptId(saved.id);
        setSaveState('saved');
      })
      .catch((error) => {
        logger.error('Failed to save attempt', error);
        if (token === runTokenRef.current) setSaveState('error');
      })
      .finally(() => {
        if (token === runTokenRef.current) savingRef.current = false;
      });
  }, [showResults, paper, runMode, isSignedIn, attemptId, canMeasureTime, timeUsed, selectedAnswers, flaggedIds, timeExpired, getToken, saveNonce]);

  // The user's history on this paper, refreshed once this attempt is stored.
  const saveFailed = saveState === 'error';
  useEffect(() => {
    if (!showResults || !isSignedIn || !paper?._id || (!attemptId && !saveFailed)) return;
    let active = true;
    getAttempts(paper._id, getToken)
      .then((list) => {
        if (!active) return;
        setAttempts(list);
        setCompareId((prev) => {
          if (prev && prev !== attemptId && list.some((a) => a.id === prev)) return prev;
          const index = attemptId ? list.findIndex((a) => a.id === attemptId) : list.length;
          return list[index - 1]?.id ?? null;
        });
      })
      .catch((error) => logger.error('Failed to load attempts', error));
    return () => {
      active = false;
    };
  }, [showResults, isSignedIn, paper?._id, attemptId, saveFailed, getToken]);

  useEffect(() => {
    if (!compareId || !isSignedIn) {
      setCompare(null);
      return;
    }
    let active = true;
    getAttempt(compareId, getToken)
      .then((detail) => {
        if (active) setCompare(detail);
      })
      .catch((error) => logger.error('Failed to load compared attempt', error));
    return () => {
      active = false;
    };
  }, [compareId, isSignedIn, getToken]);

  const graded = useMemo(
    () => (showResults ? gradePracticeRun(groupedQuestions, selectedAnswers) : []),
    [groupedQuestions, selectedAnswers, showResults],
  );

  // One page per answerable question: a passage with N sub-questions becomes N
  // pages that share the same passage, so nothing below the fold needs scrolling.
  const pages = useMemo<ExamPage[]>(() => {
    let passageNumber = 0;
    return groupedQuestions.flatMap((question) => {
      const subs = question.subQuestions ?? [];
      if (question.questionType !== 'COMPREHENSION' || subs.length === 0) {
        return [{ question, id: question.uuid }];
      }
      passageNumber += 1;
      return subs.map((sub, part) => ({
        question: { ...question, subQuestions: [sub] },
        id: sub.uuid,
        passage: { uuid: question.uuid, number: passageNumber, part, parts: subs.length },
      }));
    });
  }, [groupedQuestions]);
  const pageQuestions = useMemo(() => pages.map((page) => page.question), [pages]);

  const pageCount = pages.length;

  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(0, Math.min(index, pageCount - 1)));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [pageCount],
  );

  // Per-page answered state for the navigator (done / partial / none).
  const pageStates = useMemo<PracticeRunPageState[]>(
    () => getPracticeRunPageStates(pageQuestions, selectedAnswers),
    [pageQuestions, selectedAnswers],
  );

  // Post-submission correctness per page — only meaningful (and rendered) once
  // results are revealed; recolours the navigator from progress to outcome.
  const reviewStates = useMemo<PracticeRunReviewState[]>(
    () => getPracticeRunReviewStates(pageQuestions, selectedAnswers),
    [pageQuestions, selectedAnswers],
  );
  const incorrectCount = useMemo(
    () => reviewStates.filter((state) => state === 'incorrect').length,
    [reviewStates],
  );

  // Review steps only through pages matching the filter; otherwise every page.
  const reviewing = showResults && resultsView === 'review';
  const reviewIndices = useMemo(
    () =>
      reviewStates.flatMap((state, index) =>
        reviewFilter === 'all' || state === reviewFilter ? [index] : [],
      ),
    [reviewStates, reviewFilter],
  );
  const stepIndices = reviewing && reviewFilter !== 'all' ? reviewIndices : null;
  const prevIndex = stepIndices
    ? [...stepIndices].reverse().find((i) => i < currentIndex) ?? -1
    : currentIndex > 0
    ? currentIndex - 1
    : -1;
  const nextIndex = stepIndices
    ? stepIndices.find((i) => i > currentIndex) ?? -1
    : currentIndex < pageCount - 1
    ? currentIndex + 1
    : -1;

  const goPrev = useCallback(() => {
    if (prevIndex < 0) return;
    setCurrentIndex(prevIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [prevIndex]);

  const goNext = useCallback(() => {
    if (nextIndex < 0) return;
    setCurrentIndex(nextIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [nextIndex]);

  const openReview = useCallback(
    (filter: ReviewFilter, startUuid?: string) => {
      const start = startUuid
        ? pages.findIndex((page) => page.id === startUuid)
        : reviewStates.findIndex((state) => filter === 'all' || state === filter);
      setReviewFilter(filter);
      setResultsView('review');
      setCurrentIndex(Math.max(0, start));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [pages, reviewStates],
  );

  // Switching filters keeps the current question when it still matches.
  const changeReviewFilter = (filter: ReviewFilter) => {
    const state = reviewStates[currentIndex];
    if (filter === 'all' || state === filter) setReviewFilter(filter);
    else openReview(filter);
  };

  const showReport = () => {
    setResultsView('report');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Flagged-for-review overlay, aligned to the navigator pages.
  const flaggedPages = useMemo(
    () => pages.map((page) => flaggedIds.has(page.id)),
    [pages, flaggedIds],
  );
  const flaggedCount = useMemo(() => flaggedPages.filter(Boolean).length, [flaggedPages]);

  // First page that isn't fully answered — drives the confirm dialog's jump.
  const firstIncompleteIndex = useMemo(
    () => pageStates.findIndex((state) => state !== 'done'),
    [pageStates],
  );
  const partialCount = useMemo(
    () => pageStates.filter((state) => state === 'partial').length,
    [pageStates],
  );
  const blankCount = useMemo(
    () => pageStates.filter((state) => state === 'none').length,
    [pageStates],
  );

  const toggleFlag = useCallback((uuid: string) => {
    setFlaggedIds((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  }, []);

  const goNextFlagged = useCallback(() => {
    const total = flaggedPages.length;
    for (let step = 1; step <= total; step++) {
      const idx = (currentIndex + step) % total;
      if (flaggedPages[idx]) {
        goTo(idx);
        return;
      }
    }
  }, [flaggedPages, currentIndex, goTo]);

  // Cycle to the next incorrect page during review (wraps around like flagged).
  const goNextIncorrect = useCallback(() => {
    const total = reviewStates.length;
    for (let step = 1; step <= total; step++) {
      const idx = (currentIndex + step) % total;
      if (reviewStates[idx] === 'incorrect') {
        goTo(idx);
        return;
      }
    }
  }, [reviewStates, currentIndex, goTo]);

  // Keyboard paging with ← / →. Inside a short-answer field the caret moves
  // first; pressing the arrow again at the field's edge pages the question, so
  // editing and navigation coexist.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        const field = target as HTMLInputElement;
        const start = field.selectionStart;
        const end = field.selectionEnd;
        const len = field.value.length;
        const atStart = start === 0 && end === 0;
        const atEnd = start === len && end === len;
        if (event.key === 'ArrowLeft' && !atStart) return;
        if (event.key === 'ArrowRight' && !atEnd) return;
      } else if (target?.isContentEditable) {
        return;
      }
      if (event.key === 'ArrowLeft') goPrev();
      else goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext]);

  // `f` flags / unflags the current question (ignored while typing or reviewing).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'f' && event.key !== 'F') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (showResults) return;
      const page = pages[Math.min(currentIndex, pages.length - 1)];
      if (!page) return;
      event.preventDefault();
      toggleFlag(page.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, pages, toggleFlag, showResults]);

  // 1–6 pick options A–F on the current question (toggle for MSQ).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!/^[1-6]$/.test(event.key)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (showResults) return;
      const page = pages[Math.min(currentIndex, pages.length - 1)];
      const question =
        page?.question.questionType === 'COMPREHENSION' ? page.question.subQuestions?.[0] : page?.question;
      if (!question) return;
      const optionId = String(Number(event.key) - 1);
      if (Number(optionId) >= question.options.length) return;
      event.preventDefault();
      setSelectedAnswers((prev) => selectPracticeRunOption(prev, question.uuid, optionId, question.questionType));
      setEliminated((prev) =>
        prev[question.uuid]?.includes(optionId)
          ? { ...prev, [question.uuid]: (prev[question.uuid] ?? []).filter((id) => id !== optionId) }
          : prev,
      );
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, pages, showResults]);

  // Pop back to the page we came from (the course page in the normal flow)
  // rather than pushing a fresh course entry — pushing created a Paper ⇄ Course
  // loop with the course page's own history-pop back button. Fall back to the
  // course page only on a fresh/deep-linked load with no history to pop.
  const goBack = () => {
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate(examSlug && paper ? `/exam/${examSlug}/course/${paper.courseUuid}` : '/home');
    }
  };

  const reveal = () => {
    setResultsView('report');
    setShowResults(true);
    setTimerRunning(false);
    setTimerEndsAt(null);
    setCurrentIndex(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const performSubmit = () => {
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

  // Manual submit always confirms first (see the submit-confirm Dialog).
  const handleSubmit = () => setConfirmOpen(true);

  const handleConfirmReviewUnanswered = () => {
    setConfirmOpen(false);
    if (firstIncompleteIndex >= 0) goTo(firstIncompleteIndex);
  };

  const handleConfirmSubmit = () => {
    setConfirmOpen(false);
    performSubmit();
  };

  const handleOptionSelect = (
    questionId: string,
    optionIndex: string,
    questionType: QuestionType
  ) => {
    if (showResults) return;

    setSelectedAnswers((prev) =>
      selectPracticeRunOption(prev, questionId, optionIndex, questionType),
    );
    // Picking a struck-out option restores it.
    setEliminated((prev) =>
      prev[questionId]?.includes(optionIndex)
        ? { ...prev, [questionId]: (prev[questionId] ?? []).filter((id) => id !== optionIndex) }
        : prev,
    );
  };

  const handleShortAnswerChange = (questionId: string, answer: string) => {
    if (showResults) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleClearAnswer = (questionId: string) => {
    if (showResults) return;
    setSelectedAnswers((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  const handleToggleEliminate = (questionId: string, optionId: string) => {
    setEliminated((prev) => {
      const current = prev[questionId] ?? [];
      const nextIds = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      return { ...prev, [questionId]: nextIds };
    });
  };

  const stepTextScale = (direction: 1 | -1) => {
    setTextScale((current) => {
      const index = TEXT_SCALES.indexOf(current);
      const next = TEXT_SCALES[Math.max(0, Math.min(TEXT_SCALES.length - 1, index + direction))] ?? 1;
      try {
        window.localStorage.setItem(TEXT_SCALE_KEY, String(next));
      } catch {
        // Storage can be blocked; the size still applies for this visit.
      }
      return next;
    });
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
      warned5Ref.current = false;
      warned1Ref.current = false;
      return;
    }

    setTimeExpired(false);
    setTimerEndsAt(Date.now() + nextRemaining * 1000);
    setTimerRunning(true);
    // Arm whichever warnings are still ahead of where the clock resumes.
    warned5Ref.current = nextRemaining <= 300;
    warned1Ref.current = nextRemaining <= 60;
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
    setLowTimeWarning(null);
    warned5Ref.current = false;
    warned1Ref.current = false;
  };

  // Cover-plate choice: begin a Timed Run with the clock already ticking, so a
  // timed attempt can never be silently un-started.
  const handleBeginTimed = () => {
    if (!paper) return;
    setRunMode('timed');
    setStartedAt(Date.now());
    setSelectedAnswers({});
    setShowResults(false);
    setCurrentIndex(0);
    setTimeExpired(false);
    setLowTimeWarning(null);
    setRemainingSeconds(durationMinutes * 60);
    setTimerEndsAt(Date.now() + durationMinutes * 60 * 1000);
    setTimerRunning(true);
    warned5Ref.current = false;
    warned1Ref.current = false;
  };

  // Cover-plate choice: begin an Open Run — no clock, free reading and review.
  const handleBeginOpen = () => {
    if (!paper) return;
    setRunMode('open');
    setStartedAt(Date.now());
    setTimerRunning(false);
    setTimerEndsAt(null);
    setRemainingSeconds(null);
    setTimeExpired(false);
    setLowTimeWarning(null);
  };

  const handleTryAgain = () => {
    setSelectedAnswers({});
    setFlaggedIds(new Set());
    setEliminated({});
    setShowResults(false);
    setTimerRunning(false);
    setTimerEndsAt(null);
    setRemainingSeconds(paper ? durationMinutes * 60 : null);
    setTimeExpired(false);
    setLowTimeWarning(null);
    setAutoSubmitting(false);
    warned5Ref.current = false;
    warned1Ref.current = false;
    setCurrentIndex(0);
    runTokenRef.current += 1;
    savingRef.current = false;
    setAttemptId(null);
    setSaveState('idle');
    setTimeUsed(null);
    setStartedAt(null);
    setResultsView('report');
    setReviewFilter('all');
    setCompareId(null);
    // Return to the cover plate so the user re-picks Timed vs Open.
    setRunMode(null);
    if (storageKey) clearPracticeRunSession(storageKey);
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
            <Link to="/home">Go home</Link>
          </Button>
        )}
        announce
      />
    );
  }

  if (loading) {
    return <LoadingSkeleton onBack={goBack} />;
  }

  if (loadFailed || !paper) {
    if (verification && paperId) {
      return <PaperVerification {...verification} onVerified={(token) => {
        verificationToken.current = { paperId, token };
        setRetryNonce((value) => value + 1);
      }} onBack={goBack} />;
    }
    return (
      <StatePanel
        compact
        tone="error"
        title="Unable to load paper"
        description={loadError}
        actions={(
          <>
            <Button variant="default" onClick={() => setRetryNonce((value) => value + 1)}>
              Retry
            </Button>
            <Button asChild variant="outline">
              <Link to={examSlug ? `/exam/${examSlug}` : '/home'}>Go back</Link>
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

  // The cover plate gates entry: pick Timed Run (clock) or Open Run (review).
  if (runMode === null) {
    return (
      <RunCoverPlate
        examName={paper.examName}
        paperName={displayPaperName}
        courseName={displayCourseName}
        levelColor={levelColor}
        totalQuestions={stats.totalQuestions}
        totalMarks={stats.totalMarks}
        durationMinutes={durationMinutes}
        paperUuid={paper.uuid}
        courseUuid={paper.courseUuid}
        examUuid={paper.examUuid}
        onBeginTimed={handleBeginTimed}
        onBeginOpen={handleBeginOpen}
        onBack={goBack}
      />
    );
  }

  const allAnswered = stats.answered === stats.totalQuestions;
  const hasTimer = runMode === 'timed';
  const safeIndex = Math.min(currentIndex, pageCount - 1);
  const currentPage = pages[safeIndex];
  const currentQuestion = currentPage?.question;
  const currentFlagged = currentPage ? flaggedIds.has(currentPage.id) : false;
  const isLastPage = safeIndex >= pageCount - 1;
  const pageNumberById = new Map(pages.map((page, index) => [page.id, index + 1]));
  const labelFor = (uuid: string) => String(pageNumberById.get(uuid) ?? '?');
  const currentGrade = currentPage ? graded.find((row) => row.questionUuid === currentPage.id) : undefined;
  const compareOutcomes = new Map(compare?.answers.map((answer) => [answer.questionUuid, answer.outcome]) ?? []);
  const reviewCounts: Record<ReviewFilter, number> = {
    all: pageCount,
    incorrect: reviewStates.filter((state) => state === 'incorrect').length,
    unanswered: reviewStates.filter((state) => state === 'unanswered').length,
    correct: reviewStates.filter((state) => state === 'correct').length,
  };
  const submitLabel = allAnswered
    ? 'Submit answers'
    : stats.answered > 0
    ? `Submit (${stats.answered}/${stats.totalQuestions})`
    : 'Answer to submit';

  const questionTools: QuestionTools = {
    textScale,
    eliminated,
    onToggleEliminate: handleToggleEliminate,
    onClear: handleClearAnswer,
  };
  const toolButton =
    'inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-35';

  return (
    <ImageZoomProvider>
    <div
      className="relative isolate w-full lg:-mb-6"
      // The level colour stays a small label accent; selections and progress
      // keep the calm default blue so a red course never reads as "wrong".
      // --exam-chrome: site header + exam bar + pager + page padding, what the
      // question card leaves free so the whole exam fits one screen.
      // In review the filter bar above the card takes another ~6.5rem.
      style={{ ['--ring' as string]: '#d6b26e', ['--exam-chrome' as string]: reviewing ? '21.5rem' : '15rem' }}
    >
      {/* Page backdrop — the exam hall, dimmed and softened so the question
          and navigator stay legible through a long sitting. */}
      <HallBackdrop dim />

      {/* Exam bar — everything the sitting needs at a glance, pinned under the
          site header: where you are, how far along, the clock, and Submit. */}
      <header className="sticky top-14 z-40 -mx-4 -mt-8 mb-6 border-b border-[rgba(214,178,110,0.16)] bg-[#0f1116]/85 backdrop-blur-md md:-mx-8 md:-mt-10">
        <div className="px-4 md:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center gap-2 py-2.5 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            aria-label="Leave paper"
            title="Leave paper (your progress is saved)"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <span style={{ color: levelColor ?? undefined }}>{displayCourseName || paper.examName}</span>
              {displayCourseName && <span className="hidden sm:inline"> · {paper.examName}</span>}
            </p>
            <h1 className="truncate font-display text-base font-normal leading-tight tracking-tight sm:text-lg" title={displayPaperName}>
              {displayPaperName}
            </h1>
          </div>

          {!showResults && (
            <div className="hidden shrink-0 flex-col items-end leading-tight md:flex">
              <span className="text-sm font-medium tabular-nums">
                {stats.answered}
                <span className="text-muted-foreground">/{stats.totalQuestions} answered</span>
              </span>
              <span
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                title="Your answers and timer autosave and survive a refresh."
              >
                <CheckCircle2 className="h-3 w-3 text-emerald-400/80" aria-hidden="true" />
                Saved
                {flaggedCount > 0 && (
                  <button
                    type="button"
                    onClick={goNextFlagged}
                    className="ml-1.5 inline-flex items-center gap-1 text-amber-400/90 transition-colors hover:text-amber-300"
                    title="Jump to next flagged question"
                  >
                    <Flag className="h-3 w-3 fill-amber-400/70" aria-hidden="true" />
                    {flaggedCount} flagged
                  </button>
                )}
              </span>
            </div>
          )}

          {/* Reading size and calculator — the aids the real exam software offers. */}
          <div className="exam-panel hidden shrink-0 items-center rounded-lg bg-[#14161b]/75 p-0.5 sm:flex">
            <button
              type="button"
              onClick={() => stepTextScale(-1)}
              disabled={textScale === TEXT_SCALES[0]}
              className={toolButton}
              aria-label="Smaller text"
              title="Smaller text"
            >
              <AArrowDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => stepTextScale(1)}
              disabled={textScale === TEXT_SCALES[TEXT_SCALES.length - 1]}
              className={toolButton}
              aria-label="Larger text"
              title="Larger text"
            >
              <AArrowUp className="h-4 w-4" />
            </button>
            <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setCalcOpen((open) => !open)}
              aria-pressed={calcOpen}
              className={cn(toolButton, calcOpen && 'bg-white/10 text-foreground')}
              title="Calculator"
            >
              <Calculator className="h-4 w-4" />
              <span className="hidden text-xs xl:inline">Calculator</span>
            </button>
          </div>

          {lowTimeWarning && !showResults && (
            <span
              key={lowTimeWarning}
              role="status"
              className={cn(
                'exam-lowtime hidden shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold lg:inline-flex',
                lowTimeWarning === '1min'
                  ? 'border-red-500/40 bg-red-500/10 text-red-400'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-400',
              )}
            >
              <Timer className="h-3.5 w-3.5" aria-hidden="true" />
              {lowTimeWarning === '1min' ? '1 minute left' : '5 minutes left'}
            </span>
          )}
          {hasTimer && !showResults && (
            <CompactTimer
              durationMinutes={durationMinutes}
              remainingSeconds={remainingSeconds}
              running={timerRunning}
              onStart={handleTimerStart}
              onPause={handleTimerPause}
              onReset={handleTimerReset}
              expired={timeExpired}
              hidden={timerHidden}
              onToggleHidden={() => setTimerHidden((value) => !value)}
            />
          )}
          {showResults ? (
            <div className="flex shrink-0 items-center gap-2">
              <div className="exam-panel flex rounded-lg bg-[#14161b]/75 p-0.5" role="tablist" aria-label="Results view">
                {(['report', 'review'] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    role="tab"
                    aria-selected={resultsView === view}
                    onClick={() => (view === 'report' ? showReport() : openReview(reviewFilter, currentPage?.id))}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                      resultsView === view
                        ? 'bg-[#d6b26e]/15 text-[#f3dca6]'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {view}
                  </button>
                ))}
              </div>
              <span className="hidden sm:inline-flex">
                <DownloadPdfButton
                  paperUuid={paper.uuid}
                  courseUuid={paper.courseUuid}
                  examUuid={paper.examUuid}
                  answers
                />
              </span>
              <Button variant="outline" size="sm" onClick={handleTryAgain} className="gap-1.5">
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">Try again</span>
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={stats.answered === 0 || summoning}
              title={stats.answered === 0 ? 'Answer at least one question to submit' : undefined}
              className={cn(
                'shrink-0',
                allAnswered && 'bg-green-600 text-white hover:bg-green-700',
              )}
            >
              {summoning ? 'Summoning…' : 'Submit'}
            </Button>
          )}
        </div>
        </div>
        {/* Progress runs along the bar's bottom edge. */}
        {!showResults && (
          <div className="h-[3px] w-full bg-white/5" aria-hidden="true">
            <div
              className="h-full bg-[color-mix(in_srgb,var(--lvl,#62aef0)_80%,white_10%)] transition-[width] duration-500 ease-out"
              style={{ width: `${stats.totalQuestions > 0 ? (stats.answered / stats.totalQuestions) * 100 : 0}%` }}
            />
          </div>
        )}
      </header>

      {showResults && resultsView === 'report' ? (
        <div className="mx-auto max-w-[1180px] pb-10">
          <AttemptReport
            stats={stats}
            graded={graded}
            labelFor={labelFor}
            runMode={runMode}
            timeUsedSeconds={timeUsed}
            timeExpired={timeExpired}
            signedIn={!!isSignedIn}
            saveState={saveState}
            onRetrySave={() => setSaveNonce((n) => n + 1)}
            attempts={attempts}
            currentAttemptId={attemptId}
            compare={compare}
            compareId={compareId}
            onCompareChange={setCompareId}
            onReview={openReview}
            onTryAgain={handleTryAgain}
          />
        </div>
      ) : (
      <div className="mx-auto grid max-w-[1500px] gap-6 lg:grid-cols-[minmax(0,1fr)_288px] xl:grid-cols-[minmax(0,1fr)_312px]">
        <div className="min-w-0 space-y-5">
          {reviewing && currentPage && (
            <ReviewBar
              filter={reviewFilter}
              counts={reviewCounts}
              position={reviewIndices.indexOf(safeIndex)}
              total={reviewIndices.length}
              questionLabel={String(safeIndex + 1)}
              outcome={reviewStates[safeIndex]}
              marksAwarded={currentGrade?.marksAwarded ?? 0}
              maxMarks={currentGrade?.maxMarks ?? 0}
              compareOutcome={compareOutcomes.get(currentPage.id)}
              compareNumber={compare?.number}
              onFilter={changeReviewFilter}
              onBackToReport={showReport}
            />
          )}

          {/* One question per page */}
          {currentPage && currentQuestion && (
            // Parts of one passage share a key, so the passage (and its scroll)
            // stays put while only the question beside it changes.
            <div key={currentPage.passage?.uuid ?? currentPage.id} className="exam-q-enter">
              <QuestionCard
                question={currentQuestion}
                index={safeIndex}
                passage={currentPage.passage}
                tools={questionTools}
                selectedAnswers={selectedAnswers}
                showResults={showResults}
                onSelectAnswer={handleOptionSelect}
                onShortAnswerChange={handleShortAnswerChange}
                isFlagged={currentFlagged}
              />
            </div>
          )}

          {/* Sticky pager — Prev · position · Next (Submit on the last page). ← / → also page. */}
          <div className="sticky bottom-4 z-30">
            <div className="exam-panel flex items-center justify-between gap-2 rounded-xl bg-[#14161b]/95 px-3 py-2.5 shadow-[0_-12px_32px_-12px_rgba(0,0,0,0.7)] backdrop-blur sm:px-4">
              <Button
                variant="outline"
                size="sm"
                onClick={goPrev}
                disabled={prevIndex < 0}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>

              <div className="flex items-center gap-1.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setNavOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(214,178,110,0.22)] px-2.5 py-1.5 text-sm tabular-nums text-foreground transition-colors hover:bg-white/5 lg:hidden"
                  aria-label={`Question ${safeIndex + 1} of ${pageCount}. Open question list`}
                >
                  <LayoutGrid className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {safeIndex + 1}
                  <span className="text-muted-foreground">/ {pageCount}</span>
                </button>
                <span className="hidden flex-col items-center leading-tight lg:flex">
                  <span className="text-sm tabular-nums text-muted-foreground">
                    Question <span className="font-medium text-foreground">{safeIndex + 1}</span> of {pageCount}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                    <kbd className="rounded border border-border px-1 py-px font-sans text-[9px]">←</kbd>
                    <kbd className="rounded border border-border px-1 py-px font-sans text-[9px]">→</kbd>
                    move
                    {!showResults && (<>
                    <kbd className="ml-1 rounded border border-border px-1 py-px font-sans text-[9px]">F</kbd>
                    flag
                    <kbd className="ml-1 rounded border border-border px-1 py-px font-sans text-[9px]">1–4</kbd>
                    answer
                    </>)}
                  </span>
                </span>
                {!showResults && currentPage && (
                  <button
                    type="button"
                    onClick={() => toggleFlag(currentPage.id)}
                    aria-pressed={currentFlagged}
                    title="Flag for review (F)"
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors',
                      currentFlagged
                        ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                        : 'border-[rgba(214,178,110,0.22)] text-muted-foreground hover:border-amber-500/40 hover:text-foreground',
                    )}
                  >
                    <Flag
                      className={cn('h-4 w-4', currentFlagged && 'fill-amber-400/80')}
                      aria-hidden="true"
                    />
                    <span className="hidden sm:inline">
                      {currentFlagged ? 'Flagged' : 'Flag'}
                    </span>
                  </button>
                )}
              </div>

              {isLastPage && !showResults ? (
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={stats.answered === 0 || summoning}
                  className={cn('gap-1', allAnswered && 'bg-green-600 text-white hover:bg-green-700')}
                >
                  {summoning ? 'Summoning…' : submitLabel}
                </Button>
              ) : nextIndex >= 0 ? (
                <Button size="sm" onClick={goNext} className="gap-1">
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={showReport} className="gap-1">
                  <span className="hidden sm:inline">Back to</span> report
                </Button>
              )}
            </div>
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-[8.5rem] space-y-3">
            <QuestionNavigator
              states={pageStates}
              reviewStates={showResults ? reviewStates : null}
              flagged={flaggedPages}
              flaggedCount={flaggedCount}
              incorrectCount={incorrectCount}
              currentIndex={safeIndex}
              onJump={goTo}
              onJumpNextFlagged={goNextFlagged}
              onJumpNextIncorrect={goNextIncorrect}
            />
            <div className="flex flex-wrap items-center gap-2">
              <DownloadPdfButton
                paperUuid={paper.uuid}
                courseUuid={paper.courseUuid}
                examUuid={paper.examUuid}
              />
              {BOOKMARKS_ENABLED && <SaveButton paperId={paper._id} />}
            </div>
          </div>
        </aside>
      </div>
      )}

      {/* Floating calculator, parked over the rail so the question stays in view. */}
      {calcOpen && (
        <div className="fixed bottom-24 right-4 z-50 sm:bottom-auto sm:top-[8.5rem] md:right-8">
          <ExamCalculator onClose={() => setCalcOpen(false)} />
        </div>
      )}

      {/* Phone/tablet question list — the rail as a bottom sheet. */}
      <Dialog open={navOpen} onOpenChange={setNavOpen} labelledBy="exam-nav-title" className="sm:max-w-md">
        <div className="overflow-y-auto p-3">
          <span id="exam-nav-title" className="sr-only">Question list</span>
          <QuestionNavigator
            states={pageStates}
            reviewStates={showResults ? reviewStates : null}
            flagged={flaggedPages}
            flaggedCount={flaggedCount}
            incorrectCount={incorrectCount}
            currentIndex={safeIndex}
            onJump={(index) => {
              setNavOpen(false);
              goTo(index);
            }}
            onJumpNextFlagged={() => {
              setNavOpen(false);
              goNextFlagged();
            }}
            onJumpNextIncorrect={() => {
              setNavOpen(false);
              goNextIncorrect();
            }}
          />
        </div>
      </Dialog>

      {/* Hand-in sheet: the moment is handing over the answer sheet, so show the
          sheet itself — every question as a cell, blanks visible and one tap away. */}
      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        labelledBy="submit-confirm-title"
        className="border-transparent bg-[#111318] sm:max-w-[31rem]"
      >
        {/* Frieren and Fern at the exam hall's door at day's end; fades into the panel. */}
        <div className="relative h-40 shrink-0 overflow-hidden sm:h-44" aria-hidden="true">
          <img src={handInHall} alt="" className="h-full w-full object-cover object-[50%_55%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#111318]/30 via-transparent to-[#111318]" />
        </div>
        <div className="relative -mt-6 px-6 pb-6 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b26e]/80">End of paper</p>
          <h2 id="submit-confirm-title" className="mt-1.5 font-display text-[1.65rem] font-normal leading-tight tracking-tight">
            {blankCount === 0 ? 'Hand in your paper?' : `Hand in with ${blankCount} left blank?`}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {remainingSeconds !== null && !timeExpired && remainingSeconds >= 60 && (
              <>
                <span className="text-foreground/90">{Math.floor(remainingSeconds / 60)} min</span> still on the clock.{' '}
              </>
            )}
            Once handed in, answers can't change.
          </p>

          {/* The answer sheet. */}
          <div className="mt-6">
            <div className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-[#62aef0]" aria-hidden="true" />
                {pageCount - blankCount - partialCount} answered
              </span>
              {partialCount > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px] border border-[#d6b26e]/70 bg-[#d6b26e]/25" aria-hidden="true" />
                  {partialCount} partial
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px] border border-dashed border-white/35" aria-hidden="true" />
                {blankCount} blank
              </span>
              {flaggedCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-amber-300">
                  <Flag className="h-3 w-3 fill-amber-400/70" aria-hidden="true" />
                  {flaggedCount} flagged
                </span>
              )}
            </div>
            <ol className="grid grid-cols-10 gap-1.5" aria-label="Answer sheet">
              {pageStates.map((state, index) => (
                <li key={pages[index]?.id ?? index}>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmOpen(false);
                      goTo(index);
                    }}
                    aria-label={`Question ${index + 1}: ${state === 'done' ? 'answered' : state === 'partial' ? 'partly answered' : 'blank'}${flaggedPages[index] ? ', flagged' : ''}`}
                    className={cn(
                      'relative flex aspect-square w-full items-center justify-center rounded-[5px] text-[10px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b26e]/70',
                      state === 'done'
                        ? 'bg-[#62aef0]/85 text-[#0b1622] hover:bg-[#62aef0]'
                        : state === 'partial'
                        ? 'border border-[#d6b26e]/60 bg-[#d6b26e]/15 text-[#e7c98d] hover:bg-[#d6b26e]/25'
                        : 'border border-dashed border-white/20 text-muted-foreground hover:border-[#d6b26e]/60 hover:text-[#e7c98d]',
                      index === safeIndex && 'ring-1 ring-white/60 ring-offset-1 ring-offset-[#111318]',
                    )}
                  >
                    {index + 1}
                    {flaggedPages[index] && (
                      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 ring-2 ring-[#111318]" aria-hidden="true" />
                    )}
                  </button>
                </li>
              ))}
            </ol>
            <p className="mt-2.5 text-xs text-muted-foreground">
              Tap a square to go back to it.
              {firstIncompleteIndex >= 0 && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={handleConfirmReviewUnanswered}
                    className="font-medium text-[#e7c98d] underline-offset-4 hover:underline"
                  >
                    First blank: Q{firstIncompleteIndex + 1} →
                  </button>
                </>
              )}
            </p>
          </div>

          <div className="mt-7 flex flex-col-reverse gap-2 border-t border-white/[0.06] pt-5 sm:flex-row sm:justify-end">
            {/* Safe default focus: a stray Enter returns to the paper. */}
            <Button variant="ghost" data-autofocus onClick={() => setConfirmOpen(false)}>
              Back to paper
            </Button>
            <Button
              onClick={handleConfirmSubmit}
              className={cn(
                'px-5',
                blankCount === 0
                  ? 'bg-[#d6b26e] text-[#16130c] hover:bg-[#e2c084]'
                  : 'border border-[#d6b26e]/45 bg-[#d6b26e]/10 text-[#ecd3a0] hover:bg-[#d6b26e]/20',
              )}
            >
              Hand in paper
            </Button>
          </div>
        </div>

        {/* Same frame as the question card: the paper's own edge. */}
        <div className="tcard-frame rounded-[19px] [--lvl:#d6b26e]" aria-hidden="true" />
        <span className="tcard-corner tcard-corner-tl" aria-hidden="true" />
        <span className="tcard-corner tcard-corner-tr" aria-hidden="true" />
        <span className="tcard-corner tcard-corner-bl" aria-hidden="true" />
        <span className="tcard-corner tcard-corner-br" aria-hidden="true" />
      </Dialog>

      {/* Graceful auto-submit — a brief beat so 0:00 never feels like a glitch. */}
      {autoSubmitting && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="exam-verdict rounded-2xl border border-amber-500/30 bg-card px-7 py-6 text-center shadow-2xl">
            <Timer className="mx-auto h-8 w-8 text-amber-400" aria-hidden="true" />
            <p className="mt-2.5 font-display text-lg tracking-tight">Time's up</p>
            <p className="text-sm text-muted-foreground">Submitting your answers…</p>
          </div>
        </div>
      )}
    </div>
    </ImageZoomProvider>
  );
}
