import { useParams, Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw, Trophy, Timer, Play, Pause, ChevronLeft, ChevronRight, ChevronsRight, Flag, BookOpen, LayoutGrid, Maximize2, Undo2, Calculator, Eraser, Eye, EyeOff, AArrowDown, AArrowUp, Hourglass, ListChecks, Lock, CircleAlert } from 'lucide-react';
import type React from 'react';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatPaperName } from '@/lib/paperUtils';
import { getExamSlugFromUuid, getExamUuidFromSlug, getExamDurationMinutes } from '@/lib/examMapping';
import { getDisplayCourseName } from '@/lib/courseMapping';
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
  focusPracticeRunQuestions,
  gradePracticeRun,
  isEssayQuestion,
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
import { StatePanel } from '@/components/ui/state-panel';
import { SaveButton } from '@/components/SaveButton';
import { DownloadPdfButton } from '@/components/DownloadPdfButton';
import { BOOKMARKS_ENABLED } from '@/lib/featureFlags';
import { useAuth } from '@clerk/clerk-react';
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
import { HallBackdrop, PaperLoadingSkeleton, PaperReportSkeleton } from '@/components/skeletons/route-skeletons';
import { appendRunEvent, diffRunSnapshots, type NavVia, type RunEvent, type RunSnapshot } from '@/lib/runActivity';
import { analyseAttempt, attemptPatterns, buildAttemptInsightsMarkdown, insightsFileName, type InsightsInput } from '@/lib/attemptInsights';
import { AttemptInsights } from '@/components/exam/AttemptInsights';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
/** Low-time alerts, each fired once as the clock crosses it. */
type LowTimeWarning = '10min' | '5min' | '1min';
const LOW_TIME_LABEL: Record<LowTimeWarning, string> = {
  '10min': '10 minutes left',
  '5min': '5 minutes left',
  '1min': '1 minute left',
};
const TEXT_SCALES = [0.9, 1, 1.12, 1.25, 1.4];
const TEXT_SCALE_KEY = 'praxis.exam.textScale';
// Stored per-paper `duration` values are placeholders, so the timed attempt is
// driven by the exam type instead (see getExamDurationMinutes): 60m for the
// quizzes, 90m for the End Term.

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
  alerting = false,
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
  /** A low-time alert just fired: flash the clock once. */
  alerting?: boolean;
}) {
  // Amber under the last 5 minutes, red (and a stronger pulse) under the last
  // minute — both flush the clock and pulse.
  const warn = !expired && running && remainingSeconds !== null && remainingSeconds <= 300 && remainingSeconds > 60;
  const urgent = !expired && running && remainingSeconds !== null && remainingSeconds <= 60 && remainingSeconds > 0;
  const lastFive = remainingSeconds !== null && remainingSeconds <= 300;
  const concealed = hidden && !lastFive && !expired;
  const totalSeconds = Math.max(durationMinutes * 60, 1);
  const remainingFraction =
    remainingSeconds === null ? 1 : Math.min(1, Math.max(0, remainingSeconds / totalSeconds));
  return (
    <div
      data-urgent={urgent || expired}
      data-warn={warn}
      data-alert={alerting}
      title={
        expired
          ? 'Time is up — answers were submitted automatically.'
          : running
          ? 'Timer is running (survives a refresh).'
          : 'Start to simulate the real exam clock.'
      }
      className={cn(
        'exam-clock flex shrink-0 items-center gap-1.5 rounded-xl border py-1 pl-3 pr-1.5 shadow-[0_6px_24px_-12px_rgb(0_0_0/0.6)] backdrop-blur-sm sm:gap-2',
        expired
          ? 'border-destructive/40 bg-destructive/10'
          : urgent
          ? 'border-red-500/40 bg-red-500/10'
          : warn
          ? 'border-amber-500/40 bg-amber-500/10'
          : 'border-[rgb(var(--ex-accent)/0.3)] bg-[#121a30]/85',
      )}
    >
      <Timer
        className={cn('h-4 w-4 shrink-0', expired || urgent ? 'text-red-400' : warn ? 'text-amber-400' : 'text-[rgb(var(--ex-accent))]')}
        aria-hidden="true"
      />
      {/* The clock is the one thing to read at a glance mid-sitting: large
          tabular digits, with a bar underneath that drains as time runs out. */}
      <div className="flex min-w-[5.5rem] flex-col gap-1 sm:min-w-[7rem]">
        {concealed ? (
          <span className="text-sm leading-7 text-muted-foreground">Timer hidden</span>
        ) : (
          <span className="flex items-baseline gap-1.5 leading-none">
            <span
              role="timer"
              aria-label={`${formatRemainingTime(remainingSeconds)} remaining`}
              className={cn(
                'text-[1.375rem] font-semibold tabular-nums tracking-tight sm:text-2xl',
                (expired || urgent) && 'text-red-300',
                warn && 'text-amber-300',
              )}
            >
              {formatRemainingTime(remainingSeconds)}
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">of {durationMinutes}m</span>
          </span>
        )}
        <span className="h-[3px] overflow-hidden rounded-full bg-white/10" aria-hidden="true">
          <span
            className={cn(
              'block h-full rounded-full transition-[width] duration-1000 ease-linear',
              expired || urgent ? 'bg-red-400' : warn ? 'bg-amber-400' : 'bg-[rgb(var(--ex-accent))]',
            )}
            style={{ width: `${remainingFraction * 100}%` }}
          />
        </span>
      </div>
      <span className="mx-0.5 h-6 w-px bg-white/10" aria-hidden="true" />
      {onToggleHidden && !lastFive && !expired && (
        <button
          type="button"
          onClick={onToggleHidden}
          aria-label={hidden ? 'Show timer' : 'Hide timer'}
          title={hidden ? 'Show timer' : 'Hide timer (it reappears at 5 minutes)'}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
        >
          {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      )}
      <button
        type="button"
        onClick={running ? onPause : onStart}
        aria-label={running ? 'Pause timer' : expired ? 'Restart timer' : 'Start timer'}
        title={running ? 'Pause' : 'Start'}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
      >
        {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={onReset}
        aria-label="Reset timer"
        title="Reset"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
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
    <div className={`exam-verdict rounded-2xl border p-5 ring-1 ring-inset ring-[rgb(var(--ex-line)/0.16)] sm:p-6 ${bgColor}`}>
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
                zoomable && !inOption && 'cursor-zoom-in transition-shadow hover:ring-[rgb(var(--ex-accent))]/60',
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
          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-black/75 text-white opacity-70 shadow transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 group-hover/fig:opacity-100"
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}

/** Source papers often restate an earlier fragment at the start of a later one
 *  ("Consider Table 1…" then "Consider Table 1… Based on the above…"). Show
 *  each sentence once: drop a fragment that repeats an earlier one, or strip
 *  the repeated lead-in. */
function dedupeLeadingRepeat(text: string, earlier: string[]): string {
  const squash = (value: string) => value.replace(/\s+/g, ' ').trim();
  let current = squash(text);
  for (const prior of earlier) {
    const lead = squash(prior);
    if (lead.length < 20) continue;
    if (current === lead) return '';
    if (current.startsWith(lead)) current = current.slice(lead.length).trim();
  }
  return current === squash(text) ? text : current;
}

/** Whether a short answer gets the numeric field and keypad. Alphanumeric keys
 *  ("thick", "A,B,E") need letters; everything else is numeric. */
function takesNumericInput(question: QuizQuestion): boolean {
  const responseType = question.responseType?.toLowerCase() ?? '';
  const answerType = question.answerType?.toLowerCase() ?? '';
  const numericHint =
    responseType.includes('number') ||
    responseType.includes('numeric') ||
    answerType.includes('number') ||
    answerType.includes('numeric') ||
    question.valueStart !== undefined ||
    question.valueEnd !== undefined;
  return responseType !== 'alphanumeric' && (question.questionType === 'SA' || numericHint);
}

/** Plain-language answer format for the sheet head: what to do, not a code. */
function answerFormatLabel(question: QuizQuestion, numeric: boolean): string {
  if (isEssayQuestion(question)) return 'Written answer';
  switch (question.questionType) {
    case 'MSQ':
      // The options carry "Select all that apply" themselves.
      return 'Multiple answers';
    case 'SA':
      return numeric ? 'Numeric answer' : 'Short answer';
    case 'OPPE':
      return 'Programming answer';
    case 'COMPREHENSION':
      return 'Passage';
    default:
      return 'Single answer';
  }
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
  const seen: string[] = [];
  for (let i = 0; i < max; i++) {
    const text = dedupeLeadingRepeat(texts[i]?.trim() ?? '', seen);
    if (text) {
      seen.push(text);
      parts.push(<StemText key={`t-${i}`} text={text} />);
    }
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
    'w-full flex items-start gap-3 py-3 pl-4 rounded-lg border-2 transition-all text-left cursor-pointer ';
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
      'border-[rgb(var(--ex-line)/0.18)] bg-black/15 hover:border-[color-mix(in_srgb,var(--lvl,#62aef0)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--lvl,#62aef0)_8%,transparent)] active:bg-black/25';
    indicatorClass += 'bg-muted text-muted-foreground group-hover:text-foreground';
  }

  const button = (
    <button
      type="button"
      data-exam-option
      onClick={onClick}
      disabled={showResults}
      aria-pressed={!showResults ? isSelected : undefined}
      aria-label={`Option ${label}${isSelected ? ', selected' : ''}${eliminated && !showResults ? ', crossed out' : ''}${showResults ? isCorrect ? ', correct' : isSelected ? ', incorrect' : '' : ''}`}
      className={cn('group', containerClass, onToggleEliminate && !showResults ? 'pr-14' : 'pr-4')}
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
  // The cross-out control sits inside the card's right edge (a sibling, not a
  // nested button), so options use the column's full width. At rest that spot
  // shows the option's number key.
  return (
    <div className="group/opt relative">
      {button}
      {optionIndex < 6 && !eliminated && (
        <kbd
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded border border-white/10 px-1.5 py-px font-sans text-[10px] tabular-nums text-muted-foreground/60 transition-opacity group-focus-within/opt:opacity-0 group-hover/opt:opacity-0 [@media(hover:none)]:hidden"
        >
          {optionIndex + 1}
        </kbd>
      )}
      <button
        type="button"
        onClick={onToggleEliminate}
        aria-pressed={eliminated}
        aria-label={eliminated ? `Restore option ${label}` : `Cross out option ${label}`}
        title={eliminated ? 'Restore option' : 'Cross out (rule this option out)'}
        className={cn(
          'absolute right-2 top-1/2 flex h-8 w-9 -translate-y-1/2 items-center justify-center rounded-md border text-xs font-semibold transition-all focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
          eliminated
            ? 'border-white/15 text-foreground/80 hover:bg-white/10'
            : 'border-transparent text-muted-foreground opacity-0 hover:border-white/10 hover:bg-white/5 hover:text-foreground group-hover/opt:opacity-100 [@media(hover:none)]:opacity-60',
        )}
      >
        {/* A plain line-through on one small letter reads as another glyph
            (C looks like "e"), so cross it with a diagonal slash instead. */}
        {eliminated ? (
          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <span aria-hidden="true" className="relative inline-flex h-5 w-5 items-center justify-center text-[13px]">
            {label}
            <span className="absolute left-0 top-1/2 h-[1.5px] w-full -translate-y-1/2 -rotate-45 rounded-full bg-current" />
          </span>
        )}
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
    'rounded-md border border-[rgb(var(--ex-line)/0.2)] bg-black/25 py-1.5 text-sm font-medium text-foreground backdrop-blur-sm transition-colors hover:border-[color-mix(in_srgb,var(--lvl,#62aef0)_50%,transparent)] hover:bg-[color-mix(in_srgb,var(--lvl,#62aef0)_12%,transparent)] active:bg-black/40';

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
  checkOnDemand = false,
  onChange,
}: {
  question: QuizQuestion;
  value: string;
  numeric: boolean;
  disabled: boolean;
  showResults: boolean;
  checkOnDemand?: boolean;
  onChange: (next: string) => void;
}) {
  const key = describeShortAnswerKey(question);
  const essay = isEssayQuestion(question);
  const answered = value.trim() !== '';
  const correct = showResults && key !== null && isPracticeRunQuestionCorrect(question, value);
  const inputClass = cn(
    'w-full rounded-md border bg-black/25 px-3 py-2 text-sm text-foreground outline-none backdrop-blur-sm focus:border-[color-mix(in_srgb,var(--lvl,#62aef0)_55%,transparent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--lvl,#62aef0)_40%,transparent)]',
    showResults && key !== null && answered
      ? correct
        ? 'border-emerald-500/60 bg-emerald-500/10'
        : 'border-red-500/60 bg-red-500/10'
      : 'border-[rgb(var(--ex-line)/0.22)]',
  );

  // Review of a skipped question: no empty input reading "No answer given"
  // (it looked like the key was missing) — lead with the key. The verdict
  // banner / review bar above already says it was skipped.
  if (showResults && !answered) {
    return (
      <div className="space-y-2 px-1">
        {key !== null ? (
          <p className="text-base">
            <span className="text-muted-foreground">Correct answer: </span>
            <span className="font-semibold tabular-nums text-emerald-400">{key}</span>
          </p>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            {essay
              ? 'Essay question: there is no single correct answer, so it isn’t auto-graded.'
              : 'Not auto-graded: check it against your notes or the answer PDF.'}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 px-1">
      {essay ? (
        <textarea
          aria-label="Essay answer"
          value={value}
          disabled={disabled}
          rows={5}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Write your answer"
          className={cn(inputClass, 'resize-y leading-relaxed')}
        />
      ) : (
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
          className={inputClass}
        />
      )}
      {numeric && !essay && !disabled && <NumericKeypad value={value} onChange={onChange} />}
      {showResults ? (
        key !== null ? (
          // Right/wrong is the verdict's job (and the input's colour); this
          // line only gives the key to compare against.
          <p className="text-sm text-muted-foreground">
            Accepted answer:{' '}
            <span className={cn('font-medium tabular-nums', correct ? 'text-emerald-300' : 'text-foreground')}>{key}</span>
          </p>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            {essay
              ? 'Essay question: there is no single correct answer, so it isn’t auto-graded. Compare your answer with your notes.'
              : 'Not auto-graded: check it against your notes or the answer PDF.'}
          </p>
        )
      ) : (
        <p className="text-xs text-muted-foreground">
          {key !== null
            ? checkOnDemand
              ? 'Type an answer and press Check, or Show answer to skip it.'
              : 'Checked against the answer key when you hand in.'
            : essay
              ? 'Essay question: written answer, not auto-graded.'
              : 'Not auto-graded.'}
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
  /** Practice runs check each answer on demand instead of at hand-in. */
  checkOnDemand?: boolean;
}

interface ExamPage {
  question: QuestionWithChildren;
  /** The answerable question on this page — what flags key on. */
  id: string;
  passage?: PassagePart;
}

// Question | answer split on wide screens: the question column's share of the
// sheet, draggable and remembered per device like the reading size.
const SPLIT_KEY = 'praxis.exam.split';
const SPLIT_DEFAULT = 1.2 / 2.2;
const SPLIT_MIN = 0.3;
const SPLIT_MAX = 0.72;
const SPLIT_STEP = 0.02;
const clampSplit = (value: number) => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, value));

function readSplit(): number {
  try {
    const saved = Number(window.localStorage.getItem(SPLIT_KEY));
    return saved >= SPLIT_MIN && saved <= SPLIT_MAX ? saved : SPLIT_DEFAULT;
  } catch {
    return SPLIT_DEFAULT;
  }
}

function saveSplit(value: number) {
  try {
    window.localStorage.setItem(SPLIT_KEY, String(value));
  } catch {
    // Storage blocked: the split still works for this page view.
  }
}

/**
 * The draggable seam between the question and answer columns. Drag it, use
 * ← → / Home / End while it has focus, or double-click to reset.
 */
function SplitHandle({
  split,
  onChange,
  containerRef,
}: {
  split: number;
  onChange: (value: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [dragging, setDragging] = useState(false);
  const ratioAt = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    return rect && rect.width > 0 ? clampSplit((clientX - rect.left) / rect.width) : split;
  };
  const set = (value: number) => {
    const next = clampSplit(value);
    onChange(next);
    saveSplit(next);
  };
  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    set(ratioAt(event.clientX));
  };
  const percent = Math.round(split * 100);

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label="Resize the question and answer columns"
      aria-valuemin={Math.round(SPLIT_MIN * 100)}
      aria-valuemax={Math.round(SPLIT_MAX * 100)}
      aria-valuenow={percent}
      aria-valuetext={`Question column ${percent}% wide`}
      title="Drag to resize · double-click to reset"
      data-dragging={dragging || undefined}
      style={{ left: `${split * 100}%` }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (dragging) onChange(ratioAt(event.clientX));
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => set(SPLIT_DEFAULT)}
      onKeyDown={(event) => {
        const next =
          event.key === 'ArrowLeft'
            ? split - SPLIT_STEP
            : event.key === 'ArrowRight'
            ? split + SPLIT_STEP
            : event.key === 'Home'
            ? SPLIT_MIN
            : event.key === 'End'
            ? SPLIT_MAX
            : null;
        if (next === null) return;
        // Keep ← → from also turning the page.
        event.preventDefault();
        event.stopPropagation();
        set(next);
      }}
      className="group absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 cursor-col-resize touch-none select-none outline-none lg:block"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-transparent transition-colors group-hover:bg-[rgb(var(--ex-accent)/0.55)] group-focus-visible:bg-[rgb(var(--ex-accent))] group-data-[dragging]:bg-[rgb(var(--ex-accent))]"
      />
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-10 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--ex-line)/0.4)] transition-colors group-hover:bg-[rgb(var(--ex-accent))] group-focus-visible:bg-[rgb(var(--ex-accent))] group-data-[dragging]:bg-[rgb(var(--ex-accent))]"
      />
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
  part,
  passage,
  tools,
  verdict,
  headAction,
}: {
  question: QuestionWithChildren;
  index: number;
  passage?: PassagePart;
  tools?: QuestionTools;
  /** Practice Run result for this page, shown at the top of the answer column. */
  verdict?: React.ReactNode;
  /** Page-level control at the end of the sheet head (the flag). */
  headAction?: React.ReactNode;
  selectedAnswers: SelectedAnswers;
  showResults: boolean;
  onSelectAnswer: (questionId: string, optionIndex: string, questionType: QuestionType) => void;
  onShortAnswerChange: (questionId: string, answer: string) => void;
  /** A passage page's sub-question rendered as the answer column: its stem
   *  above its options, beside the passage. */
  part?: 'answer';
}) {
  const selectedAnswer = selectedAnswers[question.uuid];
  // Comprehension passages can be collapsed to reclaim room for the sub-questions.
  const [passageOpen, setPassageOpen] = useState(true);
  const [split, setSplit] = useState(readSplit);
  const splitRef = useRef<HTMLDivElement>(null);
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

  const isMultiSelect = question.questionType === 'MSQ';
  const isComprehension = question.questionType === 'COMPREHENSION';
  const isShortAnswer = question.questionType === 'SA' || question.questionType === 'OPPE';
  const isNumericInput = takesNumericInput(question);
  const hasOptions = question.options.length > 0;
  const hasAnswer = Array.isArray(selectedAnswer)
    ? selectedAnswer.length > 0
    : typeof selectedAnswer === 'string' && selectedAnswer !== '';
  const selectedCount = Array.isArray(selectedAnswer) ? selectedAnswer.length : 0;
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
      checkOnDemand={tools?.checkOnDemand}
      onChange={(next) => onShortAnswerChange(question.uuid, next)}
    />
  ) : (
    <div className="space-y-2.5">
      {/* The head names the format too, but this is where the choice is made. */}
      {isMultiSelect && hasOptions && !showResults && (
        <p className="flex items-center gap-2 px-1 pb-0.5 text-sm text-[rgb(var(--ex-accent-soft))]">
          <ListChecks className="h-4 w-4 shrink-0 text-[rgb(var(--ex-accent))]" aria-hidden="true" />
          <span className="font-medium">Select all that apply</span>
          <span className="tabular-nums text-white/55" aria-live="polite">
            · {selectedCount} selected
          </span>
        </p>
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

  const formatLabel = answerFormatLabel(question, isNumericInput);

  // Answer column body: a passage part's own stem, then the response.
  const answerColumn = (
    <div className="space-y-5">
      <div className="space-y-5" style={scaleStyle}>
        {part === 'answer' && (
          // A passage's question reads right above its options; the passage
          // stays on the left as reference.
          <div className="text-[16px] leading-[1.72] sm:text-[17px]">
            <QuestionMedia texts={questionTexts} images={questionImages} altPrefix="Question image" />
          </div>
        )}
        {answerArea}
      </div>
      {clearButton && <div className="flex justify-end">{clearButton}</div>}
    </div>
  );

  if (part === 'answer') return answerColumn;

  const passageBody = (
    <QuestionMedia
      texts={questionTexts}
      images={questionImages}
      altPrefix={`Question ${index + 1} image`}
    />
  );

  const subQuestions = question.subQuestions ?? [];
  // A passage page carries exactly one sub-question: the passage stays on the
  // left and the sub-question (stem and response) takes the answer column.
  const splitSub = passage && subQuestions.length === 1 ? subQuestions[0] : null;
  const subProps = {
    tools,
    selectedAnswers,
    showResults,
    onSelectAnswer,
    onShortAnswerChange,
  };

  // What the sheet head announces: the answerable question's format and weight.
  // (A passage with no question of its own has nothing to announce.)
  const headQuestion = splitSub ?? (isComprehension ? null : question);
  const headMarks = headQuestion ? parseFloat(headQuestion.totalMark) || 0 : 0;
  const headLabel = splitSub
    ? answerFormatLabel(splitSub, takesNumericInput(splitSub))
    : headQuestion
    ? formatLabel
    : null;
  const columnClass = 'exam-scroll px-5 py-5 sm:px-8 sm:py-7 lg:min-h-0 lg:overflow-y-auto lg:px-6 xl:px-8';

  return (
    // One sheet body: a head naming the question, then question | answer,
    // each column scrolling on its own so the response stays in view.
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[rgb(var(--ex-line)/0.14)] px-5 py-3.5 sm:px-8">
        <h2 className="flex items-baseline gap-2 font-display text-[1.65rem] font-normal leading-none tracking-tight">
          {isComprehension && !passage ? 'Passage' : 'Question'}
          <span className="tabular-nums text-[rgb(var(--ex-accent))]">{index + 1}</span>
        </h2>
        {passage && (
          // Which passage this question belongs to, and where in it: one quiet line.
          <span className="flex items-center gap-2 border-l border-[rgb(var(--ex-line)/0.22)] pl-4 text-sm text-white/60">
            <BookOpen className="h-4 w-4 text-[rgb(var(--ex-accent-soft))]" aria-hidden="true" />
            <span className="text-[rgb(var(--ex-accent-soft))]">Passage {passage.number}</span>
            {passage.parts > 1 && (
              <span className="tabular-nums">
                · Part {passage.part + 1} of {passage.parts}
              </span>
            )}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {headLabel && <span className="text-sm text-white/75">{headLabel}</span>}
          {headMarks > 0 && (
            <span className="rounded-md border border-[rgb(var(--ex-accent)/0.35)] bg-[rgb(var(--ex-accent)/0.1)] px-2.5 py-1 text-sm font-semibold tabular-nums text-[rgb(var(--ex-accent-soft))]">
              {formatScore(headMarks)} {headMarks === 1 ? 'mark' : 'marks'}
            </span>
          )}
          {headAction}
        </div>
      </div>

      <div
        ref={splitRef}
        className="relative grid min-h-0 flex-1 lg:grid-cols-[minmax(0,var(--ex-split))_minmax(0,var(--ex-rest))]"
        style={{ '--ex-split': `${split}fr`, '--ex-rest': `${1 - split}fr` } as React.CSSProperties}
      >
        <SplitHandle split={split} onChange={setSplit} containerRef={splitRef} />
        <section aria-label={isComprehension ? 'Passage' : 'Question'} className={columnClass}>
          {isComprehension ? (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2 lg:hidden">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Passage</p>
                <button
                  type="button"
                  onClick={() => setPassageOpen((open) => !open)}
                  aria-expanded={passageOpen}
                  className="rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {passageOpen ? 'Hide' : 'Show'}
                </button>
              </div>
              <div
                className={cn(
                  'exam-measure space-y-3 text-[16px] leading-[1.72] sm:text-[17px] lg:block',
                  passageOpen ? 'max-h-[45vh] overflow-y-auto pr-1 lg:max-h-none lg:overflow-visible lg:pr-0' : 'hidden',
                )}
                style={scaleStyle}
              >
                {passageBody}
              </div>
            </div>
          ) : (
            <div className="exam-measure space-y-3 text-[17px] leading-[1.72] sm:text-[18px]" style={scaleStyle}>
              {passageBody}
            </div>
          )}
        </section>

        <section
          key={splitSub?.uuid ?? question.uuid}
          aria-label="Your answer"
          className={cn(
            columnClass,
            'border-t border-[rgb(var(--ex-line)/0.14)] bg-black/[0.12] lg:border-l lg:border-t-0',
          )}
        >
          {/* Mounted with the page and filled on Check, so screen readers announce it. */}
          <div aria-live="polite">{verdict && <VerdictSlot>{verdict}</VerdictSlot>}</div>
          {/* Pages split every passage to one question each, so a passage
              page always has its question here. */}
          {!isComprehension ? (
            answerColumn
          ) : splitSub ? (
            <QuestionCard key={splitSub.uuid} question={splitSub} index={-1} part="answer" {...subProps} />
          ) : null}
        </section>
      </div>
    </div>
  );
}

/** One figure in the hand-in summary: a big number over a small key. */
function HandInStat({
  label,
  value,
  swatch,
  icon,
}: {
  label: string;
  value: number;
  swatch?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col-reverse gap-1.5 px-4 py-3">
      <dt className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
        {swatch && <span aria-hidden="true" className={cn('h-3 w-3 shrink-0 rounded-[3px] border', swatch)} />}
        {icon}
        {label}
      </dt>
      <dd className="font-display text-[1.75rem] leading-none tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * Right-rail navigator: the run's progress, a grid of question numbers that
 * reflects answered / partly answered / untouched (or checked, or graded) state,
 * and a key with live counts. It owns the progress readout, so the exam bar
 * doesn't repeat it on wide screens.
 */
type NavCellKind = 'done' | 'partial' | 'none' | PracticeRunReviewState;

// One look per state, shared by the grid cells and the key so they always match.
const NAV_CELL_CLASS: Record<NavCellKind, string> = {
  done:
    'border-transparent bg-[color-mix(in_srgb,var(--lvl,#62aef0)_62%,transparent)] text-white',
  partial:
    'border-amber-400/55 bg-[linear-gradient(to_top,rgb(245_158_11/0.38)_50%,transparent_50%)] text-amber-100',
  none: 'border-[rgb(var(--ex-line)/0.22)] bg-black/25 text-white/60',
  correct: 'border-transparent bg-emerald-500/55 text-white',
  incorrect: 'border-transparent bg-red-500/55 text-white',
  unanswered: 'border-[rgb(var(--ex-line)/0.22)] bg-black/25 text-white/55',
  manual: 'border-[rgb(var(--ex-line)/0.45)] bg-[rgb(var(--ex-line)/0.16)] text-[rgb(var(--ex-accent))]',
};

const NAV_CELL_LABEL: Record<NavCellKind, string> = {
  done: 'Answered',
  partial: 'Partly answered',
  none: 'Not answered',
  correct: 'Correct',
  incorrect: 'Incorrect',
  unanswered: 'Skipped',
  manual: 'Needs manual review',
};

/** The amber corner fold that marks a flagged question. */
function FlagFold({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute right-0 top-0 h-0 w-0 border-l-[11px] border-t-[11px] border-l-transparent border-t-amber-400',
        className,
      )}
    />
  );
}

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
  onJumpNextUnanswered,
  unansweredCount = 0,
  checkedStates = null,
  bare = false,
}: {
  states: PracticeRunPageState[];
  /** When set (post-submission), cells colour by correctness instead of progress. */
  reviewStates?: PracticeRunReviewState[] | null;
  /** Practice Run: outcome for each page already checked, null for the rest. */
  checkedStates?: Array<PracticeRunReviewState | null> | null;
  flagged: boolean[];
  flaggedCount: number;
  incorrectCount?: number;
  currentIndex: number;
  onJump: (index: number) => void;
  onJumpNextFlagged: () => void;
  onJumpNextIncorrect?: () => void;
  onJumpNextUnanswered?: () => void;
  unansweredCount?: number;
  /** Inside the exam sheet: no panel chrome of its own. */
  bare?: boolean;
}) {
  const reviewMode = !!reviewStates;
  const practiceMode = !reviewMode && !!checkedStates;
  const total = states.length;

  const kinds: NavCellKind[] = states.map(
    (state, index) => reviewStates?.[index] ?? checkedStates?.[index] ?? state,
  );
  const count = (kind: NavCellKind) => kinds.filter((value) => value === kind).length;

  // The headline number and what it counts, per mode.
  let headline: number;
  let headlineOf: number;
  let headlineLabel: string;
  let aside: string | null = null;
  if (reviewMode) {
    headline = count('correct');
    headlineOf = kinds.filter((kind) => kind !== 'manual').length;
    headlineLabel = 'correct';
  } else if (practiceMode) {
    headline = checkedStates!.filter((state) => state !== null).length;
    headlineOf = total;
    headlineLabel = 'checked';
    aside = headline > 0 ? `${count('correct')} correct` : null;
  } else {
    headline = count('done');
    headlineOf = total;
    headlineLabel = 'answered';
  }

  // Progress bar segments, in the same colours as the cells.
  const segments: Array<{ kind: NavCellKind; value: number }> = reviewMode
    ? [
        { kind: 'correct', value: count('correct') },
        { kind: 'incorrect', value: count('incorrect') },
      ]
    : practiceMode
    ? [
        { kind: 'correct', value: count('correct') },
        { kind: 'incorrect', value: count('incorrect') },
        { kind: 'done', value: count('done') },
        { kind: 'partial', value: count('partial') },
      ]
    : [
        { kind: 'done', value: count('done') },
        { kind: 'partial', value: count('partial') },
      ];
  const segmentFill: Partial<Record<NavCellKind, string>> = {
    done: 'bg-[color-mix(in_srgb,var(--lvl,#62aef0)_75%,transparent)]',
    partial: 'bg-amber-400/70',
    correct: 'bg-emerald-400/80',
    incorrect: 'bg-red-400/80',
  };

  // The key lists only states that can appear in this mode, each with its count.
  // Partial and manual only show up when some question is in that state.
  const keyKinds = (
    reviewMode
      ? (['correct', 'incorrect', 'unanswered', 'manual'] as NavCellKind[])
      : practiceMode
      ? (['correct', 'incorrect', 'done', 'partial', 'none'] as NavCellKind[])
      : (['done', 'partial', 'none'] as NavCellKind[])
  ).filter((kind) => (kind === 'partial' || kind === 'manual' ? count(kind) > 0 : true));
  const keyLabel: Partial<Record<NavCellKind, string>> = {
    done: practiceMode ? 'To check' : 'Answered',
    partial: 'Partly',
    none: 'Not yet',
    manual: 'Manual',
  };

  return (
    <div className={cn('relative', !bare && 'exam-panel exam-tome rounded-2xl p-4 backdrop-blur-sm')}>
      <div className="mb-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {reviewMode ? 'Review' : 'Questions'}
        </h2>
        <p className="mt-1 flex items-baseline gap-1.5 tabular-nums">
          <span className="font-display text-[2rem] leading-none">{headline}</span>
          <span className="text-sm text-muted-foreground">
            of {headlineOf} {headlineLabel}
          </span>
          {aside && <span className="ml-auto text-[13px] text-emerald-300/90">{aside}</span>}
        </p>
        <div
          className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-white/[0.07]"
          role="progressbar"
          aria-label={`${headline} of ${headlineOf} ${headlineLabel}`}
          aria-valuemin={0}
          aria-valuemax={headlineOf}
          aria-valuenow={headline}
        >
          {segments.map(({ kind, value }) =>
            value > 0 ? (
              <span
                key={kind}
                className={cn('h-full transition-[width] duration-300', segmentFill[kind])}
                style={{ width: `${(value / Math.max(total, 1)) * 100}%` }}
              />
            ) : null,
          )}
        </div>
      </div>

      {/* p-1 keeps the current cell's ring clear of the scroll container's edge. */}
      <div className="-m-1 grid grid-cols-5 gap-2 p-1">
        {kinds.map((kind, index) => {
          const isCurrent = index === currentIndex;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onJump(index)}
              aria-current={isCurrent ? 'true' : undefined}
              aria-label={`Go to question ${index + 1}, ${NAV_CELL_LABEL[kind].toLowerCase()}${flagged[index] ? ', flagged' : ''}`}
              className={cn(
                'relative flex h-10 w-full items-center justify-center overflow-hidden rounded-md border text-sm font-medium tabular-nums transition-[filter,border-color] hover:brightness-125',
                NAV_CELL_CLASS[kind],
                isCurrent &&
                  'ring-2 ring-[rgb(var(--ex-accent-soft))] ring-offset-2 ring-offset-[#0c1222]',
              )}
            >
              {index + 1}
              {flagged[index] && <FlagFold />}
            </button>
          );
        })}
      </div>

      {(reviewMode && incorrectCount > 0 && onJumpNextIncorrect) ||
      (!reviewMode && unansweredCount > 0 && onJumpNextUnanswered) ||
      flaggedCount > 0 ? (
        <div className="mt-4 space-y-2">
          {reviewMode && incorrectCount > 0 && onJumpNextIncorrect && (
            <button
              type="button"
              onClick={onJumpNextIncorrect}
              className="flex h-9 w-full items-center justify-between rounded-md border border-red-500/35 bg-red-500/10 px-3 text-[13px] font-medium text-red-200 transition-colors hover:bg-red-500/20"
            >
              <span className="inline-flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Next incorrect
              </span>
              <span className="tabular-nums text-red-200/70">{incorrectCount}</span>
            </button>
          )}
          {!reviewMode && unansweredCount > 0 && onJumpNextUnanswered && (
            <button
              type="button"
              onClick={onJumpNextUnanswered}
              className="flex h-9 w-full items-center justify-between rounded-md border border-[rgb(var(--ex-line)/0.25)] bg-black/20 px-3 text-[13px] font-medium text-foreground/90 transition-colors hover:bg-white/5"
            >
              <span className="inline-flex items-center gap-1.5">
                <ChevronsRight className="h-3.5 w-3.5" aria-hidden="true" />
                Next unanswered
              </span>
              <span className="tabular-nums text-muted-foreground">{unansweredCount}</span>
            </button>
          )}
          {flaggedCount > 0 && (
            <button
              type="button"
              onClick={onJumpNextFlagged}
              className="flex h-9 w-full items-center justify-between rounded-md border border-amber-500/35 bg-amber-500/10 px-3 text-[13px] font-medium text-amber-200 transition-colors hover:bg-amber-500/20"
            >
              <span className="inline-flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5 fill-amber-400/80" aria-hidden="true" />
                Next flagged
              </span>
              <span className="tabular-nums text-amber-200/70">{flaggedCount}</span>
            </button>
          )}
        </div>
      ) : null}

      {/* Key: a miniature of each cell look, with how many questions are in it. */}
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-[rgb(var(--ex-line)/0.12)] pt-4 text-[13px]">
        {keyKinds.map((kind) => (
          <div key={kind} className="flex items-center gap-2">
            <span aria-hidden="true" className={cn('h-4 w-4 shrink-0 rounded-[4px] border', NAV_CELL_CLASS[kind])} />
            <dt className="text-muted-foreground">{keyLabel[kind] ?? NAV_CELL_LABEL[kind]}</dt>
            <dd className="ml-auto tabular-nums text-foreground/85">{count(kind)}</dd>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="relative h-4 w-4 shrink-0 overflow-hidden rounded-[4px] border border-[rgb(var(--ex-line)/0.22)] bg-black/25">
            <FlagFold className="border-l-[7px] border-t-[7px]" />
          </span>
          <dt className="text-muted-foreground">Flagged</dt>
          <dd className="ml-auto tabular-nums text-foreground/85">{flaggedCount}</dd>
        </div>
      </dl>
    </div>
  );
}

/** Holds the Practice verdict and brings it into view when it appears. */
function VerdictSlot({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, []);
  return (
    <div ref={ref} className="mb-5 scroll-mt-4">
      {children}
    </div>
  );
}

/** A single stat on the cover (questions / marks / duration). */
function CoverStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5 px-5 first:pl-0">
      <span className="font-display text-3xl font-normal tabular-nums leading-none">{value}</span>
      <span className="text-[11px] uppercase tracking-[0.14em] text-white/70">{label}</span>
    </div>
  );
}

type RuleLine = { icon: typeof Timer; text: string };

/** What each run mode promises, shown under the picker before the user commits. */
function runModeOptions(durationMinutes: number): Array<{
  mode: RunMode;
  label: string;
  hint: string;
  icon: typeof Timer;
  begin: string;
  rules: RuleLine[];
}> {
  return [
    {
      mode: 'timed',
      label: 'Timed',
      hint: `${durationMinutes} min`,
      icon: Timer,
      begin: 'Begin timed run',
      rules: [
        { icon: Hourglass, text: `Clock starts when you begin: ${durationMinutes} minutes` },
        { icon: Timer, text: 'Auto-submits when time runs out' },
        { icon: Pause, text: 'Pause any time; progress autosaves' },
      ],
    },
    {
      mode: 'open',
      label: 'Open',
      hint: 'No clock',
      icon: BookOpen,
      begin: 'Begin open run',
      rules: [
        { icon: BookOpen, text: 'No clock; take as long as you need' },
        { icon: CheckCircle2, text: 'Results appear when you hand in' },
        { icon: Flag, text: 'Flag questions to come back to' },
      ],
    },
    {
      mode: 'practice',
      label: 'Practice',
      hint: 'Per question',
      icon: ListChecks,
      begin: 'Begin practice',
      rules: [
        { icon: ListChecks, text: 'Check each answer and see its result right away' },
        { icon: Lock, text: 'An answer locks once you check it' },
        { icon: Trophy, text: 'Your total score shows when you hand in' },
      ],
    },
  ];
}

/** "Improvement Set 4 - February 2025" → title "Improvement Set 4", date "February 2025". */
function splitPaperName(name: string): { title: string; date: string | null } {
  const at = name.lastIndexOf(' - ');
  if (at > 0) return { title: name.slice(0, at), date: name.slice(at + 3) };
  return { title: name.replace(/^-\s*/, ''), date: null };
}

function formatAgo(iso: string, now = Date.now()): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'a month ago' : `${months} months ago`;
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** The user's past runs on this paper: count, best, recency, and a tiny trend. */
function CoverHistory({ attempts }: { attempts: AttemptSummary[] }) {
  const last = attempts[attempts.length - 1];
  if (!last) return null;
  const best = attempts.reduce((top, a) => (a.score > top.score ? a : top), last);
  const recent = attempts.slice(-6);
  return (
    <div className="mt-6 flex items-center gap-3.5 text-sm text-white/75">
      <span className="flex h-6 items-end gap-1" aria-hidden="true">
        {recent.map((a, i) => (
          <span
            key={a.id}
            className={cn(
              'w-1.5 rounded-sm',
              i === recent.length - 1 ? 'bg-[rgb(var(--ex-accent))]' : 'bg-[rgb(var(--ex-accent)/0.45)]',
            )}
            style={{ height: `${Math.max(18, a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0)}%` }}
          />
        ))}
      </span>
      <span>
        Your runs: <span className="text-white">{attempts.length}</span>
        <span className="px-1.5 text-white/35">·</span>
        Best <span className="tabular-nums text-white">{formatScore(best.score)}/{formatScore(best.maxScore)}</span>
        <span className="px-1.5 text-white/35">·</span>
        Last run {formatAgo(last.submittedAt)}
      </span>
    </div>
  );
}

/**
 * Cover: the threshold shown on entering a paper variant. Art on one side; on
 * the other, what the paper is, the user's history with it, and the choice of
 * how to sit it: Timed, Open, or Practice (checked one question at a time).
 */
function RunCoverPlate({
  examName,
  paperName,
  courseName,
  totalQuestions,
  totalMarks,
  durationMinutes,
  paperUuid,
  courseUuid,
  examUuid,
  attempts,
  onBegin,
  onBack,
}: {
  examName: string;
  paperName: string;
  courseName: string;
  totalQuestions: number;
  totalMarks: number;
  durationMinutes: number;
  paperUuid: string;
  courseUuid: string;
  examUuid: string;
  attempts: AttemptSummary[] | null;
  onBegin: (mode: RunMode) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<RunMode>('timed');
  const options = runModeOptions(durationMinutes);
  const selected = options.find((option) => option.mode === mode) ?? options[0]!;
  const { title, date } = splitPaperName(paperName);

  return (
    <div
      className="relative isolate flex min-h-[calc(100vh-14rem)] w-full flex-col"
      style={{ ['--ring' as string]: 'rgb(var(--ex-accent))' }}
    >
      <HallBackdrop />

      <div className="flex flex-1 items-center justify-center py-2">
        <div className="w-full max-w-4xl">
          <button
            type="button"
            onClick={onBack}
            className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-sm text-white/80 transition-colors [text-shadow:0_1px_8px_rgba(0,0,0,0.6)] hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to papers
          </button>

          <div className="exam-tome exam-cover exam-q-enter relative isolate grid w-full overflow-hidden rounded-2xl border border-[rgb(var(--ex-line)/0.24)] backdrop-blur-sm lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
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

            <div className="relative z-10 flex flex-col px-6 py-8 sm:px-10 sm:py-9">
              {courseName && (
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[rgb(var(--ex-accent))]">
                  {courseName}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {[examName, date].filter(Boolean).map((chip) => (
                  <span
                    key={chip}
                    className="rounded-md border border-[rgb(var(--ex-line)/0.2)] bg-[rgb(var(--ex-line)/0.08)] px-2.5 py-1 text-xs text-[rgb(var(--ex-accent-soft))]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <h1 className="mt-3 font-display text-4xl font-normal leading-tight tracking-tight sm:text-5xl">
                {title}
              </h1>

              <div className="mt-6 flex items-stretch divide-x divide-[rgb(var(--ex-line)/0.18)]">
                <CoverStat value={String(totalQuestions)} label={totalQuestions === 1 ? 'question' : 'questions'} />
                {totalMarks > 0 && <CoverStat value={String(totalMarks)} label="marks" />}
                <CoverStat value={`${durationMinutes}m`} label="duration" />
              </div>

              {attempts && attempts.length > 0 && <CoverHistory attempts={attempts} />}

              <fieldset className="mt-7">
                <legend className="sr-only">How do you want to sit this paper?</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {options.map((option) => {
                    const active = option.mode === mode;
                    const Icon = option.icon;
                    return (
                      <label
                        key={option.mode}
                        className={cn(
                          'relative flex cursor-pointer flex-col gap-1 rounded-xl border px-3.5 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[rgb(var(--ex-accent))]',
                          active
                            ? 'border-[rgb(var(--ex-accent)/0.75)] bg-[rgb(var(--ex-line)/0.14)] text-white'
                            : 'border-[rgb(var(--ex-line)/0.22)] bg-black/20 text-white/80 hover:border-[rgb(var(--ex-line)/0.4)] hover:bg-black/30',
                        )}
                      >
                        <input
                          type="radio"
                          name="run-mode"
                          value={option.mode}
                          checked={active}
                          onChange={() => setMode(option.mode)}
                          className="sr-only"
                        />
                        <span className="flex items-center gap-2 font-medium">
                          <Icon
                            className={cn('h-4 w-4 shrink-0', active ? 'text-[rgb(var(--ex-accent))]' : 'text-white/55')}
                            aria-hidden="true"
                          />
                          {option.label}
                        </span>
                        <span className="text-xs text-white/60">{option.hint}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <ul key={selected.mode} className="exam-q-enter mt-4 space-y-2 text-sm text-white/80" aria-live="polite">
                {selected.rules.map(({ icon: RuleIcon, text }) => (
                  <li key={text} className="flex items-center gap-2.5">
                    <RuleIcon className="h-4 w-4 shrink-0 text-[rgb(var(--ex-accent-soft))]/80" aria-hidden="true" />
                    {text}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => onBegin(selected.mode)}
                className="exam-cover-cta group mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(var(--ex-accent-soft))] px-5 py-3.5 font-medium text-[rgb(var(--ex-ink))] shadow-[0_10px_30px_-10px_rgba(120,180,240,0.55)] transition-colors hover:bg-white"
              >
                {selected.begin}
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>

              <div className="mt-5 flex flex-wrap items-start gap-x-6 gap-y-3 border-t border-[rgb(var(--ex-line)/0.12)] pt-4">
                <DownloadPdfButton paperUuid={paperUuid} courseUuid={courseUuid} examUuid={examUuid} variant="link" label="Question paper (PDF)" />
                <DownloadPdfButton paperUuid={paperUuid} courseUuid={courseUuid} examUuid={examUuid} answers variant="link" hint="Reveals answers" />
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
    </div>
  );
}

/** Practice Run: the verdict for the question just checked, above its card. */
const KBD_CLASS =
  'inline-flex min-w-[1.6rem] items-center justify-center rounded-md border border-white/15 border-b-white/25 bg-white/[0.06] px-1.5 py-0.5 font-sans text-xs font-medium text-foreground/90 shadow-[inset_0_-1px_0_rgb(255_255_255/0.08)]';

/** Everything the keyboard can do on the sheet, opened with `?`. */
function ShortcutsDialog({
  open,
  onOpenChange,
  practice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practice: boolean;
}) {
  const rows: Array<{ keys: string[]; label: string }> = [
    { keys: ['←', '→'], label: 'Previous or next question' },
    { keys: ['1', '–', '6'], label: 'Pick option A to F (toggles on multi-answer questions)' },
    { keys: ['F'], label: 'Flag or unflag for review' },
    ...(practice ? [{ keys: ['Enter'], label: 'Check your answer, then Enter again for the next one' }] : []),
    { keys: ['?'], label: 'Show or hide this list' },
    { keys: ['Esc'], label: 'Close a dialog' },
  ];
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      labelledBy="exam-shortcuts-title"
      className="border-transparent bg-[#0f1529] sm:max-w-md"
    >
      <div className="p-5 sm:p-6">
        <h2 id="exam-shortcuts-title" className="font-display text-xl font-normal tracking-tight">
          Keyboard shortcuts
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          They work anywhere on the sheet, except letters and numbers while you type an answer.
        </p>
        <dl className="mt-4 divide-y divide-white/[0.06]">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-sm text-foreground/90">{row.label}</dt>
              <dd className="flex shrink-0 items-center gap-1">
                {row.keys.map((key, i) =>
                  key === '–' ? (
                    <span key={i} className="text-xs text-muted-foreground">
                      to
                    </span>
                  ) : (
                    <kbd key={i} className={KBD_CLASS}>
                      {key}
                    </kbd>
                  ),
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Dialog>
  );
}

function PracticeVerdict({
  outcome,
  marksAwarded,
  maxMarks,
}: {
  outcome: PracticeRunReviewState;
  marksAwarded: number;
  maxMarks: number;
}) {
  const meta: Record<PracticeRunReviewState, { label: string; detail: string; className: string; icon: typeof Timer }> = {
    correct: {
      label: 'Correct',
      detail: 'Nicely done.',
      className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
      icon: CheckCircle2,
    },
    incorrect: {
      label: 'Not quite',
      detail: 'The correct answer is marked below.',
      className: 'border-red-500/40 bg-red-500/10 text-red-300',
      icon: XCircle,
    },
    unanswered: {
      label: 'Answer shown',
      detail: 'You skipped this one; the key is marked below.',
      className: 'border-[rgb(var(--ex-line)/0.3)] bg-black/30 text-white/85',
      icon: Eye,
    },
    manual: {
      label: 'Compare with the key',
      detail: "This one can't be auto-graded.",
      className: 'border-[rgb(var(--ex-line)/0.4)] bg-[rgb(var(--ex-line)/0.12)] text-[rgb(var(--ex-accent))]',
      icon: BookOpen,
    },
  };
  const { label, detail, className, icon: Icon } = meta[outcome];
  return (
    <div role="status" className={cn('exam-q-enter flex items-center gap-3 rounded-xl border px-4 py-2.5', className)}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="ml-2 text-white/70">{detail}</span>
      </p>
      {maxMarks > 0 && (
        <span className="shrink-0 text-sm font-medium tabular-nums">
          {formatScore(marksAwarded)}/{formatScore(maxMarks)}
          <span className="ml-1 text-xs font-normal text-white/60">marks</span>
        </span>
      )}
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
  // Practice Run: pages already checked — answer locked, verdict shown.
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  // null while the cover plate is up; set once the user picks Timed/Open Run.
  const [runMode, setRunMode] = useState<RunMode | null>(null);
  // A retry of last run's missed questions: only these pages are in play.
  const [focusIds, setFocusIds] = useState<string[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
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
  const [lowTimeWarning, setLowTimeWarning] = useState<LowTimeWarning | null>(null);
  // One-shot guards so each low-time warning fires exactly once per run.
  const warned10Ref = useRef(false);
  const warned5Ref = useRef(false);
  const warned1Ref = useRef(false);
  const warningTimeoutRef = useRef<number | null>(null);
  const { getToken, isSignedIn } = useAuth();
  // After hand-in: the report, or stepping through questions under a filter.
  const [resultsView, setResultsView] = useState<'report' | 'insights' | 'review'>('report');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  // Attempt record: when the sitting began, how long it took, and the stored
  // server copy once saved. Retries append, so `attempts` is the history.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [timeUsed, setTimeUsed] = useState<number | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<AttemptSaveState>('idle');
  const [saveNonce, setSaveNonce] = useState(0);
  const [attempts, setAttempts] = useState<AttemptSummary[] | null>(null);
  // Past runs shown on the cover plate, fetched while it is up.
  const [coverAttempts, setCoverAttempts] = useState<{ paperId: string; list: AttemptSummary[] } | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [compare, setCompare] = useState<AttemptDetail | null>(null);
  const savingRef = useRef(false);
  // The sitting's activity log (visits, answers, flags, focus) for the
  // insights report. Recorded only while a run is live.
  const [activity, setActivity] = useState<RunEvent[]>([]);
  // How the next page change happened; call sites set it just before moving.
  const navViaRef = useRef<NavVia>('other');
  // The next time a run goes live, log 'start' (a fresh run) not 'resume'.
  const freshRunRef = useRef(false);
  const liveRef = useRef(false);
  // The last session written to storage, so a hide can add to it synchronously.
  const savedSessionRef = useRef<{ key: string; payload: SavedPracticeRunSession } | null>(null);
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
          setCheckedIds(new Set(savedSession?.checkedIds ?? []));
          setFocusIds(savedSession?.focusIds ?? null);
          setStartedAt(savedSession?.startedAt ?? null);
          setTimeUsed(savedSession?.timeUsedSeconds ?? null);
          setAttemptId(savedSession?.attemptId ?? null);
          setActivity(savedSession?.activity ?? []);
          freshRunRef.current = false;
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
          warned10Ref.current = restoredSeconds <= 600;
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
      // At the deadline the run is over even while "time's up" is still on
      // screen, so a reload in that beat lands on the results, not a dead clock.
      showResults: showResults || (runMode === 'timed' && timeExpired),
      timerRunning,
      remainingSeconds,
      timerEndsAt,
      flaggedIds: Array.from(flaggedIds),
      runMode,
      checkedIds: Array.from(checkedIds),
      startedAt,
      timeUsedSeconds: timeUsed,
      attemptId,
      focusIds,
      activity,
    };

    writePracticeRunSession(storageKey, payload);
    savedSessionRef.current = { key: storageKey, payload };
  }, [paper, remainingSeconds, selectedAnswers, showResults, storageKey, timerEndsAt, timerRunning, flaggedIds, runMode, checkedIds, startedAt, timeUsed, attemptId, focusIds, activity, timeExpired]);

  useEffect(() => {
    if (!paper || !timerRunning || showResults || timerEndsAt === null) {
      return;
    }

    const flashWarning = (which: LowTimeWarning) => {
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
        warned10Ref.current = true;
        flashWarning('1min');
      } else if (nextRemaining <= 300 && nextRemaining > 60 && !warned5Ref.current) {
        warned5Ref.current = true;
        warned10Ref.current = true;
        flashWarning('5min');
      } else if (nextRemaining <= 600 && nextRemaining > 300 && !warned10Ref.current) {
        warned10Ref.current = true;
        flashWarning('10min');
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

  const displayPaperName = useMemo(() => {
    if (!paper?.paperName) return '';
    return formatPaperName(paper.paperName, paper.year ?? undefined);
  }, [paper?.paperName, paper?.year]);

  const allGroupedQuestions = useMemo(() => groupPracticeRunQuestions(questions), [questions]);
  // A missed-questions retry narrows the paper; if none of its ids survive
  // (the paper changed under a saved session), fall back to the whole paper.
  const groupedQuestions = useMemo(() => {
    if (!focusIds) return allGroupedQuestions;
    const focused = focusPracticeRunQuestions(allGroupedQuestions, new Set(focusIds));
    return focused.length > 0 ? focused : allGroupedQuestions;
  }, [allGroupedQuestions, focusIds]);

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
    // A retry of a few missed questions isn't a sitting of the paper: the
    // server grades the whole paper, so storing it would log a false low score.
    if (focusIds) return;
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
  }, [showResults, paper, runMode, isSignedIn, attemptId, canMeasureTime, timeUsed, selectedAnswers, flaggedIds, timeExpired, getToken, saveNonce, focusIds]);

  // The cover plate shows the user's past runs on this paper.
  useEffect(() => {
    if (runMode !== null || !isSignedIn || !paper?._id) return;
    let active = true;
    const paperId = paper._id;
    getAttempts(paperId, getToken)
      .then((list) => {
        if (active) setCoverAttempts({ paperId, list });
      })
      .catch((error) => logger.error('Failed to load attempts for cover', error));
    return () => {
      active = false;
    };
  }, [runMode, isSignedIn, paper?._id, getToken]);

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
  // Pages a retry would cover: graded wrong, or gradable and left blank.
  const missedPageIds = useMemo(
    () =>
      pages.flatMap((page, index) =>
        reviewStates[index] === 'incorrect' || reviewStates[index] === 'unanswered' ? [page.id] : [],
      ),
    [pages, reviewStates],
  );

  // Review steps only through pages matching the filter; otherwise every page.
  const reviewing = showResults && resultsView === 'review';
  // Everything but the report fits one screen on wide displays.
  const fitsScreen = !(showResults && resultsView !== 'review');
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
      // The view swaps instantly; a smooth scroll after it reads as a lurch.
      window.scrollTo({ top: 0, behavior: 'instant' });
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
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const showInsights = () => {
    setResultsView('insights');
    window.scrollTo({ top: 0, behavior: 'instant' });
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
  const answeredCount = pageCount - blankCount - partialCount;

  const toggleFlag = useCallback((uuid: string) => {
    setFlaggedIds((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  }, []);

  // Activity recorder: compares each render's run state with the last and logs
  // what changed. A run going live logs 'start' or 'resume'; hand-in logs
  // 'submit'. Nothing is logged on the cover plate, while loading, or in review.
  const snapshotRef = useRef<RunSnapshot | null>(null);
  useEffect(() => {
    const live = !loading && !!paper && runMode !== null && !showResults && pages.length > 0;
    const snapshot: RunSnapshot = {
      pageIds: pages.map((page) => page.id),
      index: Math.max(0, Math.min(currentIndex, pages.length - 1)),
      answers: selectedAnswers,
      flagged: flaggedIds,
      checked: checkedIds,
      eliminated,
      calcOpen,
      handInOpen: confirmOpen,
      clockRunning: runMode === 'timed' && !timeExpired ? timerRunning : null,
    };
    const prev = snapshotRef.current;
    snapshotRef.current = snapshot;
    const wasLive = liveRef.current;
    liveRef.current = live;
    const via = navViaRef.current;
    navViaRef.current = 'other';
    const t = Date.now();
    const page = snapshot.pageIds[snapshot.index] ?? '';

    if (live && !wasLive) {
      const fresh = freshRunRef.current;
      freshRunRef.current = false;
      setActivity((log) =>
        appendRunEvent(log, fresh ? { t, type: 'start', mode: runMode!, page } : { t, type: 'resume', page }),
      );
      return;
    }
    if (!live && wasLive && showResults) {
      setActivity((log) => appendRunEvent(log, { t, type: 'submit', auto: timeExpired }));
      return;
    }
    if (!live || !prev) return;
    const events = diffRunSnapshots(prev, snapshot, t, via);
    if (events.length > 0) setActivity((log) => events.reduce(appendRunEvent, log));
  }, [loading, paper, runMode, showResults, pages, currentIndex, selectedAnswers, flaggedIds, checkedIds, eliminated, calcOpen, confirmOpen, timerRunning, timeExpired]);

  // Leaving the tab pauses the per-question clock in the report.
  useEffect(() => {
    const onVisibility = () => {
      if (!liveRef.current) return;
      const event: RunEvent = { t: Date.now(), type: document.hidden ? 'hidden' : 'visible' };
      setActivity((log) => appendRunEvent(log, event));
      // Hiding is also what closing the tab looks like, and the page may not
      // render again. Save the boundary now so a later resume or an expiry
      // while closed doesn't credit the closed stretch to the last question.
      const saved = savedSessionRef.current;
      if (document.hidden && saved) {
        const payload = { ...saved.payload, activity: appendRunEvent(saved.payload.activity ?? [], event) };
        savedSessionRef.current = { key: saved.key, payload };
        try {
          writePracticeRunSession(saved.key, payload);
        } catch (error) {
          logger.warn('Could not save the run before the page hid', { error: String(error) });
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const goNextFlagged = useCallback(() => {
    const total = flaggedPages.length;
    for (let step = 1; step <= total; step++) {
      const idx = (currentIndex + step) % total;
      if (flaggedPages[idx]) {
        navViaRef.current = 'next-flagged';
        goTo(idx);
        return;
      }
    }
  }, [flaggedPages, currentIndex, goTo]);

  // Next page still open: not fully answered and (in Practice) not yet checked.
  const unansweredCount = useMemo(
    () =>
      pageStates.filter(
        (state, index) => index !== currentIndex && state !== 'done' && !checkedIds.has(pages[index]?.id ?? ''),
      ).length,
    [pageStates, checkedIds, pages, currentIndex],
  );
  const goNextUnanswered = useCallback(() => {
    const total = pageStates.length;
    for (let step = 1; step < total; step++) {
      const idx = (currentIndex + step) % total;
      if (pageStates[idx] !== 'done' && !checkedIds.has(pages[idx]?.id ?? '')) {
        navViaRef.current = 'next-unanswered';
        goTo(idx);
        return;
      }
    }
  }, [pageStates, checkedIds, pages, currentIndex, goTo]);

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
      navViaRef.current = 'arrow-key';
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
      if (checkedIds.has(question.uuid)) return;
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
  }, [currentIndex, pages, showResults, checkedIds]);

  // `?` opens the shortcut list (not while typing, or over another dialog).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '?' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (confirmOpen || navOpen) return;
      event.preventDefault();
      setShortcutsOpen((open) => !open);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmOpen, navOpen]);

  // Practice run: Enter checks an answered question, and Enter again moves on.
  // Works from the page, from a short-answer box, and from the Next button
  // (which holds focus after a Check) so the forward key never skips a check.
  useEffect(() => {
    if (runMode !== 'practice' || showResults) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.isComposing) return;
      if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
      if (confirmOpen || navOpen || shortcutsOpen) return;
      const target = event.target as HTMLElement | null;
      const onForward = !!target?.closest('[data-exam-forward]');
      const inAnswerBox = target instanceof HTMLInputElement && target.type === 'text';
      // A clicked option keeps focus; Enter there would toggle it back off, so
      // it checks instead (Space still toggles). Enter on an option not yet
      // chosen keeps its native press, so a multi-select can't lock half-done.
      const onOption = target?.closest('[data-exam-option]')?.getAttribute('aria-pressed') === 'true';
      // Other controls (links, the calculator, textareas) keep their Enter.
      if (
        !onForward &&
        !inAnswerBox &&
        !onOption &&
        target &&
        target !== document.body &&
        target.closest('button, a, input, textarea, select, [contenteditable="true"], [role="dialog"]')
      ) {
        return;
      }
      const index = Math.min(currentIndex, pages.length - 1);
      const page = pages[index];
      if (!page) return;
      const answered = pageStates[index] !== undefined && pageStates[index] !== 'none';
      if (!checkedIds.has(page.id)) {
        // Unanswered: leave Next's own Enter alone, and never reveal by accident.
        if (!answered) return;
        event.preventDefault();
        setCheckedIds((prev) => new Set(prev).add(page.id));
        requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-exam-forward]')?.focus());
        return;
      }
      if (onForward) return; // the button's own click moves on
      event.preventDefault();
      if (onOption) return; // a locked option: don't toggle, don't jump
      navViaRef.current = 'enter-key';
      goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [runMode, showResults, confirmOpen, navOpen, shortcutsOpen, currentIndex, pages, pageStates, checkedIds, goNext]);

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
    navViaRef.current = 'hand-in-sheet';
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
    if (showResults || checkedIds.has(questionId)) return;

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
    if (showResults || checkedIds.has(questionId)) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleClearAnswer = (questionId: string) => {
    if (showResults || checkedIds.has(questionId)) return;
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
      warned10Ref.current = false;
      warned5Ref.current = false;
      warned1Ref.current = false;
      return;
    }

    setTimeExpired(false);
    setTimerEndsAt(Date.now() + nextRemaining * 1000);
    setTimerRunning(true);
    // Arm whichever warnings are still ahead of where the clock resumes.
    warned10Ref.current = nextRemaining <= 600;
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
    warned10Ref.current = false;
    warned5Ref.current = false;
    warned1Ref.current = false;
  };

  // Cover-plate choice: begin a Timed Run with the clock already ticking, so a
  // timed attempt can never be silently un-started.
  const handleBeginTimed = () => {
    if (!paper) return;
    setActivity([]);
    freshRunRef.current = true;
    setRunMode('timed');
    setFocusIds(null);
    setCheckedIds(new Set());
    setStartedAt(Date.now());
    setSelectedAnswers({});
    setShowResults(false);
    setCurrentIndex(0);
    setTimeExpired(false);
    setLowTimeWarning(null);
    setRemainingSeconds(durationMinutes * 60);
    setTimerEndsAt(Date.now() + durationMinutes * 60 * 1000);
    setTimerRunning(true);
    warned10Ref.current = false;
    warned5Ref.current = false;
    warned1Ref.current = false;
  };

  // Cover-plate choice: an Open Run (no clock, results at hand-in) or a
  // Practice Run (no clock, each question checked on its own).
  const handleBeginUntimed = (mode: 'open' | 'practice') => {
    if (!paper) return;
    setActivity([]);
    freshRunRef.current = true;
    setRunMode(mode);
    setFocusIds(null);
    setCheckedIds(new Set());
    setStartedAt(Date.now());
    setTimerRunning(false);
    setTimerEndsAt(null);
    setRemainingSeconds(null);
    setTimeExpired(false);
    setLowTimeWarning(null);
  };

  const handleBeginRun = (mode: RunMode) => {
    if (mode === 'timed') handleBeginTimed();
    else handleBeginUntimed(mode);
  };

  // Practice Run: lock the current page's answer and reveal its verdict.
  const handleCheckCurrent = (pageId: string) => {
    if (showResults || runMode !== 'practice') return;
    setCheckedIds((prev) => new Set(prev).add(pageId));
    // The Check button unmounts; hand focus to the forward button beside it.
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-exam-forward]')?.focus());
  };

  // Clears a finished run back to a blank sheet; callers pick what comes next.
  const resetRun = () => {
    setSelectedAnswers({});
    setFlaggedIds(new Set());
    setCheckedIds(new Set());
    setEliminated({});
    setShowResults(false);
    setTimerRunning(false);
    setTimerEndsAt(null);
    setRemainingSeconds(paper ? durationMinutes * 60 : null);
    setTimeExpired(false);
    setLowTimeWarning(null);
    setAutoSubmitting(false);
    warned10Ref.current = false;
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
    setActivity([]);
    if (storageKey) clearPracticeRunSession(storageKey);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTryAgain = () => {
    resetRun();
    setFocusIds(null);
    // Return to the cover plate so the user re-picks the run mode.
    setRunMode(null);
    setCoverAttempts(null);
  };

  // Straight into a Practice run of just the pages this run got wrong or
  // skipped, checked one at a time.
  const handleRetryMissed = () => {
    if (missedPageIds.length === 0) return;
    const ids = missedPageIds;
    resetRun();
    freshRunRef.current = true;
    setFocusIds(ids);
    setRunMode('practice');
    setStartedAt(Date.now());
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
    if (storageKey && readPracticeRunSession(storageKey, 0)?.showResults) {
      return <PaperReportSkeleton onBack={goBack} />;
    }
    return <PaperLoadingSkeleton onBack={goBack} />;
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

  // The cover plate gates entry: pick Timed, Open, or Practice.
  if (runMode === null) {
    return (
      <RunCoverPlate
        examName={paper.examName}
        paperName={displayPaperName}
        courseName={displayCourseName}
        totalQuestions={stats.totalQuestions}
        totalMarks={stats.totalMarks}
        durationMinutes={durationMinutes}
        paperUuid={paper.uuid}
        courseUuid={paper.courseUuid}
        examUuid={paper.examUuid}
        attempts={coverAttempts?.paperId === paper._id ? coverAttempts.list : null}
        onBegin={handleBeginRun}
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
  // "Analyse with AI": the sitting as a Markdown report, built on demand.
  const insightsInput = (generatedAt: number): InsightsInput => {
    const name = displayPaperName || paper?.paperName || 'Exam paper';
    return {
      paper: { name, course: displayCourseName, exam: paper?.examName ?? '', year: paper?.year ?? null },
      mode: runMode ?? 'open',
      focusRun: focusIds !== null,
      durationMinutes,
      startedAt,
      timeUsedSeconds: timeUsed,
      timeExpired,
      pages: pages.map((page) => ({
        id: page.id,
        question: page.passage ? page.question.subQuestions?.[0] ?? page.question : page.question,
        passage: page.passage
          ? { number: page.passage.number, part: page.passage.part, parts: page.passage.parts }
          : null,
        passageQuestion: page.passage ? page.question : null,
      })),
      answers: selectedAnswers,
      flaggedIds: Array.from(flaggedIds),
      checkedIds: Array.from(checkedIds),
      events: activity,
      generatedAt,
    };
  };
  // Analysed only while the Insights page is open.
  const insightsView = (() => {
    if (!showResults || resultsView !== 'insights') return null;
    const input = insightsInput(Date.now());
    const analysis = analyseAttempt(input);
    return { analysis, patterns: attemptPatterns(analysis, input) };
  })();
  const buildInsights = () => {
    const input = insightsInput(Date.now());
    return { markdown: buildAttemptInsightsMarkdown(input), fileName: insightsFileName(input.paper.name, input.generatedAt) };
  };
  const currentGrade = currentPage ? graded.find((row) => row.questionUuid === currentPage.id) : undefined;
  const isPractice = runMode === 'practice';
  const currentChecked = isPractice && !showResults && !!currentPage && checkedIds.has(currentPage.id);
  const pageRevealed = showResults || currentChecked;
  const checkedStates =
    isPractice && !showResults ? pages.map((page, index) => (checkedIds.has(page.id) ? reviewStates[index] ?? null : null)) : null;
  const checkedCount = checkedStates ? checkedStates.filter((state) => state !== null).length : 0;
  const checkedCorrect = checkedStates ? checkedStates.filter((state) => state === 'correct').length : 0;
  const practiceGrade =
    currentChecked && currentQuestion
      ? gradePracticeRun([currentQuestion], selectedAnswers).reduce(
          (sum, row) => ({ awarded: sum.awarded + row.marksAwarded, max: sum.max + row.maxMarks }),
          { awarded: 0, max: 0 },
        )
      : null;
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
    checkOnDemand: isPractice,
  };
  // Pager controls, shared by the desktop rail and the phone pager.
  const prevButton = (
    <Button variant="outline" onClick={() => { navViaRef.current = 'prev'; goPrev(); }} disabled={prevIndex < 0} aria-label="Previous question" className="h-10 gap-1.5 px-3 sm:min-w-[7.5rem] sm:px-4">
      <ChevronLeft className="h-4 w-4" />
      <span className="hidden sm:inline">Previous</span>
    </Button>
  );
  const nextButton =
    isLastPage && !showResults ? (
      <Button
        onClick={handleSubmit}
        disabled={stats.answered === 0 || summoning}
        data-exam-forward
        className={cn('h-10 gap-1.5 px-4', allAnswered ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-[rgb(var(--ex-primary))] text-[rgb(var(--ex-ink))] hover:bg-white')}
      >
        {summoning ? (
          'Summoning…'
        ) : (
          <>
            <span className="sm:hidden">Submit</span>
            <span className="hidden sm:inline">{submitLabel}</span>
          </>
        )}
      </Button>
    ) : nextIndex >= 0 ? (
      <Button onClick={() => { navViaRef.current = 'next'; goNext(); }} data-exam-forward aria-label="Next question" className="h-10 gap-1.5 bg-[rgb(var(--ex-primary))] px-3 text-[rgb(var(--ex-ink))] hover:bg-white sm:min-w-[7.5rem] sm:px-4">
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="h-4 w-4" />
      </Button>
    ) : (
      <Button variant="outline" onClick={showReport} aria-label="Back to report" className="h-10 gap-1.5 px-4">
        <span className="hidden sm:inline">Back to</span> report
      </Button>
    );
  // Number keys pick options 1–6; the hint shows only the ones this question has.
  const keyedQuestion =
    currentQuestion?.questionType === 'COMPREHENSION' ? currentQuestion.subQuestions?.[0] : currentQuestion;
  const answerKeyCount = Math.min(6, keyedQuestion?.options.length ?? 0);
  const currentAnswered = pageStates[safeIndex] !== undefined && pageStates[safeIndex] !== 'none';
  const checkButton =
    isPractice && !showResults && currentPage && !currentChecked ? (
      <Button
        variant={currentAnswered ? 'default' : 'outline'}
        onClick={() => handleCheckCurrent(currentPage.id)}
        className={cn('h-10 gap-1.5 px-3 sm:px-4', currentAnswered && 'bg-[rgb(var(--ex-primary))] text-[rgb(var(--ex-ink))] hover:bg-white')}
        title={currentAnswered ? 'Check this answer (locks it)' : 'Reveal the answer without attempting'}
        aria-label={currentAnswered ? 'Check this answer' : 'Show answer'}
      >
        {currentAnswered ? (
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">{currentAnswered ? 'Check' : 'Show answer'}</span>
      </Button>
    ) : null;
  // Flag: in the sheet head on wide screens, in the foot on phones where the
  // head row has no room for it.
  const renderFlag = (placement: 'head' | 'foot') => !showResults && currentPage && (
    <button
      type="button"
      onClick={() => toggleFlag(currentPage.id)}
      aria-pressed={currentFlagged}
      aria-label="Flag for review"
      title="Flag for review (F)"
      className={cn(
        'items-center gap-1.5 rounded-md border transition-colors',
        placement === 'head' ? 'hidden h-8 px-2.5 text-[13px] lg:inline-flex' : 'inline-flex h-10 px-3 text-sm lg:hidden',
        currentFlagged
          ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
          : 'border-[rgb(var(--ex-line)/0.22)] text-muted-foreground hover:border-amber-500/40 hover:text-foreground',
      )}
    >
      <Flag className={cn('h-4 w-4', currentFlagged && 'fill-amber-400/80')} aria-hidden="true" />
      <span className={placement === 'head' ? undefined : 'hidden sm:inline'}>{currentFlagged ? 'Flagged' : 'Flag'}</span>
    </button>
  );
  // Whole minutes left on a timed run's clock, for the hand-in summary.
  const clockMinutesLeft =
    runMode === 'timed' && remainingSeconds !== null && !timeExpired && remainingSeconds >= 60
      ? Math.floor(remainingSeconds / 60)
      : null;
  const toolButton =
    'inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-35';

  return (
    <ImageZoomProvider>
    <div
      className={cn(
        'ex-theme relative isolate w-full lg:-mb-6',
        // On wide screens the sitting fills exactly one screen under the 2.5rem
        // site header: a flex column whose sheet takes whatever the exam bar
        // (and, in review, the filter bar) leaves, so no height is hardcoded.
        // The report is a normal scrolling page.
        fitsScreen && 'lg:-mt-10 lg:flex lg:h-[calc(100dvh-3.5rem)] lg:flex-col',
      )}
      // The level colour stays a small label accent; selections and progress
      // keep the calm default blue so a red course never reads as "wrong".
      style={{ ['--ring' as string]: 'rgb(var(--ex-accent))' }}
    >
      {/* Page backdrop — the exam hall, dimmed and softened so the question
          and navigator stay legible through a long sitting. */}
      <HallBackdrop dim />

      {/* Exam bar — everything the sitting needs at a glance, pinned under the
          site header: where you are, how far along, the clock, and Submit. */}
      <header className={cn('sticky top-10 z-40 -mx-4 -mt-8 mb-3 shrink-0 border-b border-[rgb(var(--ex-line)/0.16)] bg-[#0d1325]/85 backdrop-blur-md md:-mx-5 md:-mt-10', fitsScreen && 'lg:mt-0')}>
        <div className="px-4 md:px-5">
        <div className="relative mx-auto flex max-w-[1880px] items-center gap-2 py-2.5 sm:gap-3">
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
          {/* Where you are: orientation, not a focal point, so it stays quiet
              and leaves the centre of the bar to the clock. */}
          <div className={cn('min-w-0 flex-1', hasTimer && !showResults && 'lg:max-w-[calc(50%-12rem)]')}>
            <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-white/55">
              {focusIds && (
                <span className="text-[rgb(var(--ex-accent))]">
                  {pageCount} missed {pageCount === 1 ? 'question' : 'questions'} ·{' '}
                </span>
              )}
              {displayCourseName || paper.examName}
              {displayCourseName && <span className="hidden sm:inline"> · {paper.examName}</span>}
            </p>
            <h1 className="truncate font-display text-lg font-normal leading-tight tracking-tight text-white/95 sm:text-xl" title={displayPaperName}>
              {displayPaperName}
            </h1>
          </div>
          {/* The capped title leaves room; this keeps the tools pinned right. */}
          {hasTimer && !showResults && <div aria-hidden="true" className="hidden flex-1 lg:block" />}

          {!showResults && (
            <div className="hidden shrink-0 flex-col items-end justify-center leading-tight md:flex">
              {isPractice ? (
                <span className="text-sm font-medium tabular-nums lg:hidden">
                  {checkedCount}
                  <span className="text-muted-foreground">/{pageCount} checked</span>
                  {checkedCount > 0 && <span className="text-emerald-300/90"> · {checkedCorrect} correct</span>}
                </span>
              ) : (
                <span className="text-sm font-medium tabular-nums lg:hidden">
                  {stats.answered}
                  <span className="text-muted-foreground">/{stats.totalQuestions} answered</span>
                </span>
              )}
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
                    className="ml-1.5 inline-flex items-center gap-1 text-amber-400/90 transition-colors hover:text-amber-300 lg:hidden"
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
          <div className="exam-panel hidden shrink-0 items-center rounded-lg bg-[#121a30]/75 p-0.5 sm:flex">
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

          {/* Low-time alert: hangs just under the bar, centred like the clock,
              and is announced. The live region stays mounted so it's heard. */}
          <div
            role="status"
            className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2"
          >
            {lowTimeWarning && !showResults && (
              <span
                key={lowTimeWarning}
                className={cn(
                  'exam-lowtime inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-sm font-semibold shadow-[0_8px_24px_-10px_rgb(0_0_0/0.7)] backdrop-blur-md',
                  lowTimeWarning === '1min'
                    ? 'border-red-500/50 bg-[#2a1216]/90 text-red-300'
                    : 'border-amber-500/50 bg-[#2a2010]/90 text-amber-300',
                )}
              >
                <Timer className="h-4 w-4" aria-hidden="true" />
                {LOW_TIME_LABEL[lowTimeWarning]}
              </span>
            )}
          </div>
          {hasTimer && !showResults && (
            <div className="shrink-0 lg:absolute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2">
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
              alerting={lowTimeWarning !== null}
            />
            </div>
          )}
          {showResults ? (
            <div className="flex shrink-0 items-center gap-2">
              <div className="exam-panel flex rounded-lg bg-[#121a30]/75 p-0.5" role="tablist" aria-label="Results view">
                {(['report', 'review'] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    role="tab"
                    aria-selected={view === 'review' ? resultsView === 'review' : resultsView !== 'review'}
                    onClick={() => (view === 'report' ? showReport() : openReview(reviewFilter, currentPage?.id))}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                      (view === 'review' ? resultsView === 'review' : resultsView !== 'review')
                        ? 'bg-[rgb(var(--ex-primary))] text-[rgb(var(--ex-ink))]'
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
            </div>
          ) : (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={stats.answered === 0 || summoning}
              title={stats.answered === 0 ? 'Answer at least one question to submit' : undefined}
              className={cn(
                'shrink-0',
                allAnswered ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-[rgb(var(--ex-primary))] text-[rgb(var(--ex-ink))] hover:bg-white',
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
            missedCount={missedPageIds.length}
            onRetryMissed={handleRetryMissed}
            focusRun={focusIds !== null}
            onBuildInsights={buildInsights}
            onOpenInsights={showInsights}
          />
        </div>
      ) : insightsView ? (
        <div className="mx-auto max-w-[1180px] pb-10">
          <AttemptInsights
            analysis={insightsView.analysis}
            patterns={insightsView.patterns}
            runMode={runMode}
            durationMinutes={durationMinutes}
            onBack={showReport}
            onBuildReport={buildInsights}
            onOpenQuestion={(id) => openReview('all', id)}
          />
        </div>
      ) : (
      <div className="mx-auto w-full max-w-[1880px] lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        {reviewing && currentPage && (
          <div className="mb-3 shrink-0">
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
              onTryAgain={handleTryAgain}
            />
          </div>
        )}

        {/* The exam sheet: question | answer | navigator in one framed card,
            with the pager along its foot, right under the options. */}
        <div className="exam-tome relative isolate overflow-clip rounded-2xl border border-[rgb(var(--ex-line)/0.24)] backdrop-blur-sm lg:grid lg:min-h-[26rem] lg:flex-1 lg:grid-cols-[minmax(0,1fr)_16.5rem] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="relative z-10 flex min-h-0 min-w-0 flex-col">
            {currentPage && currentQuestion && (
              // Parts of one passage share a key, so the passage (and its scroll)
              // stays put while only the question beside it changes.
              <div key={currentPage.passage?.uuid ?? currentPage.id} className="exam-q-enter flex min-h-0 flex-1 flex-col">
                <QuestionCard
                  question={currentQuestion}
                  index={safeIndex}
                  passage={currentPage.passage}
                  tools={questionTools}
                  selectedAnswers={selectedAnswers}
                  showResults={pageRevealed}
                  onSelectAnswer={handleOptionSelect}
                  onShortAnswerChange={handleShortAnswerChange}
                  headAction={renderFlag('head')}
                  verdict={
                    currentChecked && practiceGrade ? (
                      <PracticeVerdict
                        key={currentPage.id}
                        outcome={reviewStates[safeIndex] ?? 'unanswered'}
                        marksAwarded={practiceGrade.awarded}
                        maxMarks={practiceGrade.max}
                      />
                    ) : null
                  }
                />
              </div>
            )}

            {/* Sheet foot: Previous · (phone list and flag) · (Check) · Next. Pinned to
                the bottom of the screen on phones. */}
            <div className="sticky bottom-0 z-20 flex items-center gap-2 border-t border-[rgb(var(--ex-line)/0.16)] bg-[#10172d]/95 px-5 py-2.5 backdrop-blur sm:gap-3 sm:px-8 lg:static lg:bg-black/25">
              {prevButton}
              <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setNavOpen(true)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[rgb(var(--ex-line)/0.22)] px-2.5 text-sm tabular-nums text-foreground transition-colors hover:bg-white/5 lg:hidden"
                  aria-label={`Question ${safeIndex + 1} of ${pageCount}. Open question list`}
                >
                  <LayoutGrid className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {safeIndex + 1}
                  <span className="text-muted-foreground">/ {pageCount}</span>
                </button>
                {/* Wide screens: the rail and the sheet head already say where you are. */}
                {renderFlag('foot')}
              </div>
              {checkButton}
              {nextButton}
            </div>
          </div>

          {/* Rail: the whole paper at a glance, cut from the sheet by a rule. */}
          <aside aria-label="Questions" className="relative z-10 hidden min-h-0 flex-col border-l border-[rgb(var(--ex-line)/0.16)] bg-black/[0.18] lg:flex">
            <div className="exam-scroll min-h-0 flex-1 overflow-y-auto p-4">
              <QuestionNavigator
                bare
                states={pageStates}
                reviewStates={showResults ? reviewStates : null}
                checkedStates={checkedStates}
                flagged={flaggedPages}
                flaggedCount={flaggedCount}
                incorrectCount={incorrectCount}
                unansweredCount={showResults ? 0 : unansweredCount}
                currentIndex={safeIndex}
                onJump={(index) => {
                  navViaRef.current = 'question-grid';
                  goTo(index);
                }}
                onJumpNextFlagged={goNextFlagged}
                onJumpNextIncorrect={goNextIncorrect}
                onJumpNextUnanswered={goNextUnanswered}
              />
            </div>
            <div className="shrink-0 space-y-3 border-t border-[rgb(var(--ex-line)/0.14)] px-4 py-3">
              <p className="flex flex-wrap items-center gap-x-1 gap-y-1.5 text-xs text-muted-foreground/85">
                <kbd className="rounded border border-border px-1 py-px font-sans text-[11px]">←</kbd>
                <kbd className="rounded border border-border px-1 py-px font-sans text-[11px]">→</kbd>
                <span className="mr-1.5">move</span>
                {!showResults && (
                  <>
                    <kbd className="rounded border border-border px-1 py-px font-sans text-[11px]">F</kbd>
                    <span className="mr-1.5">flag</span>
                    {answerKeyCount > 0 && !currentChecked && (
                      <>
                        <kbd className="rounded border border-border px-1 py-px font-sans text-[11px]">
                          {answerKeyCount === 1 ? '1' : `1–${answerKeyCount}`}
                        </kbd>
                        <span className="mr-1.5">answer</span>
                      </>
                    )}
                    {isPractice && (
                      <>
                        <kbd className="rounded border border-border px-1 py-px font-sans text-[11px]">Enter</kbd>
                        <span className="mr-1.5">{currentChecked ? 'next' : 'check'}</span>
                      </>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setShortcutsOpen(true)}
                  className="ml-auto inline-flex items-center gap-1 rounded px-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Show all keyboard shortcuts"
                >
                  <kbd className="rounded border border-border px-1 py-px font-sans text-[11px]">?</kbd>
                  all
                </button>
              </p>
              {/* Mid timed run the paper is on screen already; downloading waits for the report. */}
              {!(runMode === 'timed' && !showResults) && (
                <div className="flex flex-wrap items-center gap-2">
                  <DownloadPdfButton
                    paperUuid={paper.uuid}
                    courseUuid={paper.courseUuid}
                    examUuid={paper.examUuid}
                  />
                  {BOOKMARKS_ENABLED && <SaveButton paperId={paper._id} />}
                </div>
              )}
            </div>
          </aside>

          <div className="tcard-frame" aria-hidden="true" />
          <span className="tcard-corner tcard-corner-tl" aria-hidden="true" />
          <span className="tcard-corner tcard-corner-tr" aria-hidden="true" />
          <span className="tcard-corner tcard-corner-bl" aria-hidden="true" />
          <span className="tcard-corner tcard-corner-br" aria-hidden="true" />
        </div>
      </div>
      )}

      {/* Floating calculator, parked over the rail so the question stays in view. */}
      {calcOpen && (
        <div className="fixed bottom-24 right-4 z-50 sm:bottom-auto sm:top-[7.5rem] md:right-8">
          <ExamCalculator onClose={() => setCalcOpen(false)} />
        </div>
      )}

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} practice={isPractice && !showResults} />

      {/* Phone/tablet question list — the rail as a bottom sheet. */}
      <Dialog open={navOpen} onOpenChange={setNavOpen} labelledBy="exam-nav-title" className="sm:max-w-md">
        <div className="overflow-y-auto p-3">
          <span id="exam-nav-title" className="sr-only">Question list</span>
          <QuestionNavigator
            states={pageStates}
            reviewStates={showResults ? reviewStates : null}
            checkedStates={checkedStates}
            flagged={flaggedPages}
            flaggedCount={flaggedCount}
            incorrectCount={incorrectCount}
            currentIndex={safeIndex}
            onJump={(index) => {
              setNavOpen(false);
              navViaRef.current = 'question-grid';
              goTo(index);
            }}
            onJumpNextFlagged={() => {
              setNavOpen(false);
              goNextFlagged();
            }}
            unansweredCount={showResults ? 0 : unansweredCount}
            onJumpNextUnanswered={() => {
              setNavOpen(false);
              goNextUnanswered();
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
        className="border-transparent bg-[#0f1529] sm:max-w-[31rem]"
      >
        {/* Frieren and Fern at the exam hall's door at day's end; fades into the panel. */}
        {/* Everything above the actions scrolls, so Hand in stays reachable on short phones. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative h-40 shrink-0 overflow-hidden sm:h-44 [@media(max-height:640px)]:h-24" aria-hidden="true">
          <img src={handInHall} alt="" className="h-full w-full object-cover object-[50%_55%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f1529]/30 via-transparent to-[#0f1529]" />
        </div>
        <div className="relative -mt-8 px-6 pb-2 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgb(var(--ex-accent))]/80">End of paper</p>
          <h2 id="submit-confirm-title" className="mt-1.5 font-display text-[1.75rem] font-normal leading-tight tracking-tight">
            Hand in your paper?
          </h2>

          {/* Where the paper stands, in big numbers. */}
          <dl className="mt-5 flex divide-x divide-white/[0.08] overflow-hidden rounded-xl border border-white/[0.08] bg-black/25">
            <HandInStat label="Answered" value={answeredCount} swatch={NAV_CELL_CLASS.done} />
            {partialCount > 0 && <HandInStat label="Partly" value={partialCount} swatch={NAV_CELL_CLASS.partial} />}
            <HandInStat label="Blank" value={blankCount} swatch={NAV_CELL_CLASS.none} />
            {flaggedCount > 0 && (
              <HandInStat
                label="Flagged"
                value={flaggedCount}
                icon={<Flag className="h-3 w-3 fill-amber-400/80 text-amber-400" aria-hidden="true" />}
              />
            )}
            {clockMinutesLeft !== null && <HandInStat label="Min left" value={clockMinutesLeft} />}
          </dl>

          {/* One line on what's unfinished, with a way straight to it. */}
          {firstIncompleteIndex >= 0 && (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3.5 py-2.5 text-sm">
              <CircleAlert className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
              <p className="min-w-0 flex-1 text-amber-50/90">
                {blankCount > 0
                  ? `${blankCount} ${blankCount === 1 ? 'question is' : 'questions are'} blank and will score nothing.`
                  : `${partialCount} ${partialCount === 1 ? 'question is' : 'questions are'} only partly answered.`}
              </p>
              <button
                type="button"
                onClick={handleConfirmReviewUnanswered}
                className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-amber-200 transition-colors hover:bg-amber-500/15"
              >
                Go to Q{firstIncompleteIndex + 1} →
              </button>
            </div>
          )}

          {/* The answer sheet, in the same cells as the question rail. */}
          <div className="mt-5">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Answer sheet</p>
              <p className="text-xs text-muted-foreground">Select a question to go back</p>
            </div>
            <ol className="-m-1 grid max-h-[13rem] grid-cols-10 gap-1.5 overflow-y-auto p-1" aria-label="Answer sheet">
              {pageStates.map((state, index) => (
                <li key={pages[index]?.id ?? index}>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmOpen(false);
                      navViaRef.current = 'hand-in-sheet';
                      goTo(index);
                    }}
                    aria-label={`Question ${index + 1}: ${NAV_CELL_LABEL[state].toLowerCase()}${flaggedPages[index] ? ', flagged' : ''}`}
                    className={cn(
                      'relative flex h-9 w-full items-center justify-center overflow-hidden rounded-md border text-[13px] font-medium tabular-nums transition-[filter] hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ex-accent))]/70',
                      NAV_CELL_CLASS[state],
                      index === safeIndex && 'ring-2 ring-[rgb(var(--ex-accent-soft))] ring-offset-1 ring-offset-[#0f1529]',
                    )}
                  >
                    {index + 1}
                    {flaggedPages[index] && <FlagFold className="border-l-[8px] border-t-[8px]" />}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
        </div>

          <div className="relative mx-6 mb-6 mt-4 flex shrink-0 flex-col gap-4 border-t border-white/[0.06] pt-5 sm:mx-8 sm:flex-row sm:items-center">
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground sm:mr-auto">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Answers lock once handed in.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {/* Safe default focus: a stray Enter returns to the paper. */}
              <Button variant="ghost" data-autofocus onClick={() => setConfirmOpen(false)}>
                Back to paper
              </Button>
              <Button
                onClick={handleConfirmSubmit}
                className="bg-[rgb(var(--ex-primary))] px-5 font-semibold text-[rgb(var(--ex-ink))] hover:bg-white"
              >
                Hand in paper
              </Button>
            </div>
          </div>

        {/* Same frame as the question card: the paper's own edge. */}
        <div className="tcard-frame rounded-[19px] [--lvl:rgb(var(--ex-accent))]" aria-hidden="true" />
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
