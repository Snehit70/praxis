import { useParams, Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw, Trophy, Timer, Play, Pause, ChevronLeft, ChevronRight, Flag, BookOpen, FileText, ListChecks } from 'lucide-react';
import type React from 'react';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatPaperName } from '@/lib/paperUtils';
import { getExamSlugFromUuid, getExamUuidFromSlug, getExamDurationMinutes } from '@/lib/examMapping';
import { getDisplayCourseName, getCourseLevel } from '@/lib/courseMapping';
import { LEVEL_META } from '@/lib/courseCatalogue';
import { ArcaneSigil } from '@/components/ArcaneSigil';
import { logger } from '@/lib/logger';
import { getQuestionImageUrl, getOptionImageUrl, imageSourceFallbacks } from '@/lib/imageUtils';
import { splitMarkupImages } from '@/lib/markupImages';
import {
  getPaperByUuid,
  getQuestionsByPaperUuid,
  recordView,
  type PaperDetails,
} from '@/lib/api';
import type { QuestionType, QuizQuestion } from '@/lib/dataTransforms';
import {
  calculatePracticeRunStats,
  clearPracticeRunSession,
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
import { Skeleton } from '@/components/ui/skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { SaveButton } from '@/components/SaveButton';
import { DownloadPdfButton } from '@/components/DownloadPdfButton';
import { useAuth } from '@clerk/clerk-react';
import pageBg from '@/assets/Sousou no Frieren - Ep. 11_ Winter in the Northern Lands - 00_22.png';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
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
  // Amber under the last 5 minutes, red (and a stronger pulse) under the last
  // minute — both flush the clock and pulse.
  const warn = !expired && running && remainingSeconds !== null && remainingSeconds <= 300 && remainingSeconds > 60;
  const urgent = !expired && running && remainingSeconds !== null && remainingSeconds <= 60 && remainingSeconds > 0;
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
        expired ? 'border-destructive/40 bg-destructive/10' : 'bg-[#1c1812]/70',
      )}
    >
      <Timer
        className={cn('h-4 w-4', expired || urgent ? 'text-red-400' : warn ? 'text-amber-400' : '')}
        style={expired || urgent || warn ? undefined : { color: 'var(--lvl, var(--primary))' }}
        aria-hidden="true"
      />
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
function FlowImage({ src, alt }: { src: string; alt: string }) {
  const [block, setBlock] = useState(false);
  const [srcIndex, setSrcIndex] = useState(0);
  const candidates = imageSourceFallbacks(src);
  const current = candidates[Math.min(srcIndex, candidates.length - 1)] ?? src;
  return (
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
      className={
        block
          ? 'my-3 block max-h-72 max-w-full rounded-md object-contain p-1 invert mix-blend-screen'
          : 'mx-[0.15em] inline-block h-[1.3em] w-auto max-w-full align-middle invert mix-blend-screen'
      }
    />
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
}: {
  option: { optionText?: string | null; optionImage?: string | null };
  optionIndex: number;
  isSelected: boolean;
  isCorrect: boolean;
  showResults: boolean;
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

      <div className="flex-1 min-w-0 text-[15px]">
        {hasOptionText && <RichText text={optionText} compact />}
        {hasOptionImage && (
          <FlowImage src={getOptionImageUrl(option.optionImage ?? undefined) ?? ''} alt={`Option ${label}`} />
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
    'rounded-md border border-[rgba(214,178,110,0.2)] bg-black/25 py-2.5 text-base font-medium text-foreground backdrop-blur-sm transition-colors hover:border-[color-mix(in_srgb,var(--lvl,#62aef0)_50%,transparent)] hover:bg-[color-mix(in_srgb,var(--lvl,#62aef0)_12%,transparent)] active:bg-black/40';

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
        className="w-full rounded-md border border-[rgba(214,178,110,0.22)] bg-black/25 px-3 py-2 text-sm text-foreground outline-none backdrop-blur-sm focus:border-[color-mix(in_srgb,var(--lvl,#62aef0)_55%,transparent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--lvl,#62aef0)_40%,transparent)]"
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
  isFlagged = false,
  onToggleFlag,
}: {
  question: QuestionWithChildren;
  index: number;
  selectedAnswers: SelectedAnswers;
  showResults: boolean;
  onSelectAnswer: (questionId: string, optionIndex: string, questionType: QuestionType) => void;
  onShortAnswerChange: (questionId: string, answer: string) => void;
  isSubQuestion?: boolean;
  isFlagged?: boolean;
  onToggleFlag?: () => void;
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
                <QuestionMedia
                  texts={questionTexts}
                  images={questionImages}
                  altPrefix={`Question ${index + 1} image`}
                />
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
          {/* Header row: type badge + marks + flag */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <QuestionTypeBadge type={question.questionType} />
            <div className="flex items-center gap-2">
              {marks > 0 && (
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {marks} {marks === 1 ? 'mark' : 'marks'}
                </span>
              )}
              {onToggleFlag && !showResults && (
                <button
                  type="button"
                  onClick={onToggleFlag}
                  aria-pressed={isFlagged}
                  title="Flag for review (f)"
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
                    isFlagged
                      ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                      : 'border-border text-muted-foreground hover:border-amber-500/40 hover:text-foreground',
                  )}
                >
                  <Flag className={cn('h-3.5 w-3.5', isFlagged && 'fill-amber-400/80')} aria-hidden="true" />
                  {isFlagged ? 'Flagged' : 'Flag'}
                </button>
              )}
            </div>
          </div>

          {/* Heraldic crest rule under the type/marks band */}
          <div className="exam-crest-rule" aria-hidden="true" />

          {/* Question text / comprehension passage — passage pins on wide
              screens while its sub-questions scroll, and can be collapsed. */}
          {isComprehension ? (
            <div className="exam-passage rounded-lg lg:sticky lg:top-24 lg:z-20">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Passage
                </p>
                <button
                  type="button"
                  onClick={() => setPassageOpen((open) => !open)}
                  aria-expanded={passageOpen}
                  className="rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {passageOpen ? 'Hide passage' : 'Show passage'}
                </button>
              </div>
              {passageOpen && (
                <div className="exam-measure space-y-3 text-[15.5px] leading-[1.72] sm:text-[16.5px] lg:max-h-[42vh] lg:overflow-y-auto lg:pr-1">
                  <QuestionMedia
                    texts={questionTexts}
                    images={questionImages}
                    altPrefix={`Question ${index + 1} image`}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="exam-measure space-y-3 text-[15.5px] leading-[1.72] sm:text-[16.5px]">
              <QuestionMedia
                texts={questionTexts}
                images={questionImages}
                altPrefix={`Question ${index + 1} image`}
              />
            </div>
          )}

          {/* Options */}
          {!isComprehension && (
            <div className="space-y-2">
              <RunicDivider className="!mb-3" />
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
            <div className="space-y-3 pt-2">
              <RunicDivider className="!mb-1" label="questions on the passage" />
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
    <div className="exam-panel exam-tome sticky top-20 isolate overflow-hidden rounded-2xl p-4 backdrop-blur-sm">
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

/** A single stat cell on the cover plate (questions / marks / duration). */
function CoverStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-3">
      <span className="text-muted-foreground/70" aria-hidden="true">{icon}</span>
      <span className="font-display text-xl font-normal tabular-nums leading-none">{value}</span>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Cover plate: the threshold shown on entering a paper variant. Opening the
 * tome, the user chooses to *sit* it (Timed Run) or simply *read* it (Open Run).
 * Doubles as the showcase for the runic ornament language.
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
  // Deterministic per-paper sigil variation, same family across the deck.
  const seed = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < paperName.length; i++) hash = (hash * 31 + paperName.charCodeAt(i)) >>> 0;
    return hash;
  }, [paperName]);

  return (
    <div
      className="relative isolate flex min-h-[70vh] w-full items-center justify-center px-4 py-8"
      style={{
        ...(levelColor ? { ['--lvl' as string]: levelColor } : {}),
        ['--ring' as string]: levelColor ?? '#d6b26e',
      }}
    >
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <img src={pageBg} alt="" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/88 via-background/92 to-background/96" />
      </div>

      <button
        type="button"
        onClick={onBack}
        className="absolute left-0 top-0 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>

      <div className="exam-tome exam-cover relative isolate w-full max-w-xl overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--lvl,#62aef0)_30%,rgba(214,178,110,0.2))] px-6 py-8 text-center backdrop-blur-sm sm:px-10 sm:py-10 exam-q-enter">
        {/* Sigil crest */}
        <div className="mx-auto mb-5 h-24 w-24">
          <ArcaneSigil seed={seed} />
        </div>

        {courseName && (
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em]" style={{ color: levelColor ?? undefined }}>
            {courseName}
          </p>
        )}
        <p className="text-sm text-muted-foreground">{examName}</p>
        <h1 className="mt-1 font-display text-2xl font-normal leading-tight tracking-tight sm:text-3xl">
          {paperName}
        </h1>

        <RunicDivider className="my-6" />

        <div className="flex items-stretch justify-center divide-x divide-[rgba(214,178,110,0.18)]">
          <CoverStat icon={<ListChecks className="h-4 w-4" />} value={String(totalQuestions)} label={totalQuestions === 1 ? 'question' : 'questions'} />
          {totalMarks > 0 && (
            <CoverStat icon={<FileText className="h-4 w-4" />} value={String(totalMarks)} label="marks" />
          )}
          <CoverStat icon={<Timer className="h-4 w-4" />} value={`${durationMinutes}m`} label="duration" />
        </div>

        <RunicDivider className="my-6" label="choose your run" />

        <div className="space-y-3">
          <button
            type="button"
            onClick={onBeginTimed}
            className="exam-cover-cta group flex w-full items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--lvl,#62aef0)_55%,transparent)] bg-[color-mix(in_srgb,var(--lvl,#62aef0)_14%,transparent)] px-5 py-3.5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--lvl,#62aef0)_22%,transparent)]"
          >
            <span className="flex items-center gap-3">
              <Timer className="h-5 w-5 shrink-0" style={{ color: levelColor ?? undefined }} aria-hidden="true" />
              <span>
                <span className="block font-medium">Begin Timed Run</span>
                <span className="block text-xs text-muted-foreground">{durationMinutes}-minute clock · auto-submits at 0:00</span>
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onBeginOpen}
            className="group flex w-full items-center justify-between gap-3 rounded-xl border border-[rgba(214,178,110,0.22)] bg-black/15 px-5 py-3.5 text-left transition-colors hover:border-[rgba(214,178,110,0.4)] hover:bg-black/25"
          >
            <span className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                <span className="block font-medium">Open Run</span>
                <span className="block text-xs text-muted-foreground">No clock · read and review freely</span>
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <DownloadPdfButton paperUuid={paperUuid} courseUuid={courseUuid} examUuid={examUuid} />
          <DownloadPdfButton
            paperUuid={paperUuid}
            courseUuid={courseUuid}
            examUuid={examUuid}
            answers
          />
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground/70">
          Your progress autosaves and survives a refresh, either way.
        </p>

        <div className="tcard-frame" aria-hidden="true" />
        <span className="tcard-corner tcard-corner-tl" aria-hidden="true" />
        <span className="tcard-corner tcard-corner-tr" aria-hidden="true" />
        <span className="tcard-corner tcard-corner-bl" aria-hidden="true" />
        <span className="tcard-corner tcard-corner-br" aria-hidden="true" />
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
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [lowTimeWarning, setLowTimeWarning] = useState<'5min' | '1min' | null>(null);
  // One-shot guards so each low-time warning fires exactly once per run.
  const warned5Ref = useRef(false);
  const warned1Ref = useRef(false);
  const warningTimeoutRef = useRef<number | null>(null);
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

    const payload: SavedPracticeRunSession = {
      selectedAnswers,
      showResults,
      timerRunning,
      remainingSeconds,
      timerEndsAt,
      flaggedIds: Array.from(flaggedIds),
      runMode,
    };

    writePracticeRunSession(storageKey, payload);
  }, [paper, remainingSeconds, selectedAnswers, showResults, storageKey, timerEndsAt, timerRunning, flaggedIds, runMode]);

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
  const pageStates = useMemo<PracticeRunPageState[]>(
    () => getPracticeRunPageStates(groupedQuestions, selectedAnswers),
    [groupedQuestions, selectedAnswers],
  );

  // Post-submission correctness per page — only meaningful (and rendered) once
  // results are revealed; recolours the navigator from progress to outcome.
  const reviewStates = useMemo<PracticeRunReviewState[]>(
    () => getPracticeRunReviewStates(groupedQuestions, selectedAnswers),
    [groupedQuestions, selectedAnswers],
  );
  const incorrectCount = useMemo(
    () => reviewStates.filter((state) => state === 'incorrect').length,
    [reviewStates],
  );

  // Flagged-for-review overlay, aligned to the navigator pages.
  const flaggedPages = useMemo(
    () => groupedQuestions.map((question) => flaggedIds.has(question.uuid)),
    [groupedQuestions, flaggedIds],
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
      const question = groupedQuestions[Math.min(currentIndex, groupedQuestions.length - 1)];
      if (!question) return;
      event.preventDefault();
      toggleFlag(question.uuid);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, groupedQuestions, toggleFlag, showResults]);

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
    setTimerRunning(false);
    setTimerEndsAt(null);
    setRemainingSeconds(null);
    setTimeExpired(false);
    setLowTimeWarning(null);
  };

  const handleTryAgain = () => {
    setSelectedAnswers({});
    setFlaggedIds(new Set());
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
      style={{
        ...(levelColor ? { ['--lvl' as string]: levelColor } : {}),
        // Warm the focus ring within the exam (app default is blue).
        ['--ring' as string]: levelColor ?? '#d6b26e',
      }}
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
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <DownloadPdfButton
              paperUuid={paper.uuid}
              courseUuid={paper.courseUuid}
              examUuid={paper.examUuid}
            />
            {showResults && (
              <DownloadPdfButton
                paperUuid={paper.uuid}
                courseUuid={paper.courseUuid}
                examUuid={paper.examUuid}
                answers
              />
            )}
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
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span
                  className="inline-flex items-center gap-1"
                  title="Your answers and timer autosave and survive a refresh."
                >
                  <CheckCircle2 className="h-3 w-3 text-emerald-400/80" aria-hidden="true" />
                  Saved
                </span>
                <span className="text-muted-foreground/40" aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {Math.max(0, stats.totalQuestions - stats.answered)} left
                </span>
                {partialCount > 0 && (
                  <span className="tabular-nums text-amber-500/90">{partialCount} partial</span>
                )}
                {flaggedCount > 0 && (
                  <button
                    type="button"
                    onClick={goNextFlagged}
                    className="inline-flex items-center gap-1 text-amber-400/90 transition-colors hover:text-amber-300"
                    title="Jump to next flagged question"
                  >
                    <Flag className="h-3 w-3 fill-amber-400/70" aria-hidden="true" />
                    {flaggedCount} flagged
                  </button>
                )}
              </div>
            </div>
            {lowTimeWarning && (
              <span
                key={lowTimeWarning}
                role="status"
                className={cn(
                  'exam-lowtime hidden shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold sm:inline-flex',
                  lowTimeWarning === '1min'
                    ? 'border-red-500/40 bg-red-500/10 text-red-400'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-400',
                )}
              >
                <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                {lowTimeWarning === '1min' ? '1 minute left' : '5 minutes left'}
              </span>
            )}
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
      {showResults && (
        <ResultsSummary
          stats={stats}
          onTryAgain={handleTryAgain}
          onReviewIncorrect={incorrectCount > 0 ? goNextIncorrect : undefined}
          timeExpired={timeExpired}
        />
      )}

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
            isFlagged={flaggedIds.has(currentQuestion.uuid)}
            onToggleFlag={() => toggleFlag(currentQuestion.uuid)}
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

            <div className="flex flex-col items-center leading-tight">
              <span className="text-sm tabular-nums text-muted-foreground">
                Question {safeIndex + 1} of {pageCount}
              </span>
              <span className="hidden items-center gap-1 text-[10px] text-muted-foreground/60 sm:flex">
                <kbd className="rounded border border-border px-1 py-px font-sans text-[9px]">←</kbd>
                <kbd className="rounded border border-border px-1 py-px font-sans text-[9px]">→</kbd>
                to move
              </span>
            </div>

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
        </aside>
      </div>

      {/* Submit confirmation — adaptive copy + a jump to the first gap. */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen} labelledBy="submit-confirm-title">
        <div className="p-5 sm:p-6">
          <h2 id="submit-confirm-title" className="font-display text-xl font-normal tracking-tight">
            {allAnswered ? 'Submit all answers?' : 'Submit your test?'}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {allAnswered ? (
              <>All {stats.totalQuestions} answered. Your answers lock after submitting.</>
            ) : (
              <>
                {stats.totalQuestions - stats.answered} unanswered
                {partialCount > 0 && ` · ${partialCount} partial`}. You can't change answers
                after submitting.
              </>
            )}
          </p>
          {flaggedCount > 0 && (
            <p className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-medium text-amber-400">
              <Flag className="h-3.5 w-3.5 fill-amber-400/70" aria-hidden="true" />
              {flaggedCount} {flaggedCount === 1 ? 'question is' : 'questions are'} still flagged for review.
            </p>
          )}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {!allAnswered && firstIncompleteIndex >= 0 && (
              <Button variant="outline" onClick={handleConfirmReviewUnanswered}>
                Review unanswered
              </Button>
            )}
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              {allAnswered ? 'Keep reviewing' : 'Keep going'}
            </Button>
            <Button
              onClick={handleConfirmSubmit}
              className={cn('gap-1', allAnswered && 'bg-green-600 text-white hover:bg-green-700')}
            >
              {allAnswered ? 'Submit' : 'Submit anyway'}
            </Button>
          </div>
        </div>
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
  );
}
