import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  Clock,
  Hourglass,
  ListChecks,
  Loader2,
  LogIn,
  Minus,
  PenLine,
  RotateCcw,
  Target,
  Timer,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SignInTrigger } from '@/components/auth/AuthDialog';
import { cn } from '@/lib/utils';
import type { AttemptDetail, AttemptSummary } from '@/lib/api';
import type { GradedQuestion, PracticeRunReviewState, PracticeRunStats, RunMode } from '@/lib/practiceRun';

export type ReviewFilter = 'all' | 'incorrect' | 'unanswered' | 'correct';
export type AttemptSaveState = 'idle' | 'saving' | 'saved' | 'error';

/** How a question moved between the compared attempt and this one. */
export type QuestionShift = 'fixed' | 'slipped' | 'still-wrong' | null;

function getQuestionShift(
  now: PracticeRunReviewState | undefined,
  before: PracticeRunReviewState | undefined,
): QuestionShift {
  if (!now || !before || now === 'manual' || before === 'manual') return null;
  if (now === 'correct' && before !== 'correct') return 'fixed';
  if (now !== 'correct' && before === 'correct') return 'slipped';
  if (now === 'incorrect' && before === 'incorrect') return 'still-wrong';
  return null;
}

const OUTCOME_META: Record<
  PracticeRunReviewState,
  { label: string; text: string; cell: string; Icon: typeof CheckCircle2 }
> = {
  correct: {
    label: 'Correct',
    text: 'text-emerald-300',
    cell: 'border-emerald-400/45 bg-emerald-500/20 text-emerald-100',
    Icon: CheckCircle2,
  },
  incorrect: {
    label: 'Incorrect',
    text: 'text-rose-300',
    cell: 'border-rose-400/45 bg-rose-500/20 text-rose-100',
    Icon: XCircle,
  },
  unanswered: {
    label: 'Skipped',
    text: 'text-slate-300',
    cell: 'border-dashed border-slate-400/40 bg-white/[0.03] text-slate-300',
    Icon: CircleDashed,
  },
  manual: {
    label: 'Self-check',
    text: 'text-sky-200',
    cell: 'border-sky-300/30 bg-sky-400/10 text-sky-100',
    Icon: PenLine,
  },
};

const TYPE_LABELS: Record<string, string> = {
  MCQ: 'Single choice',
  MSQ: 'Multiple choice',
  SA: 'Short answer',
  OPPE: 'Programming',
};

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function formatDuration(totalSeconds: number | null | undefined) {
  if (totalSeconds === null || totalSeconds === undefined) return '—';
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (s < 60) return `${s}s`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function formatMarks(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function percentOf(score: number, max: number) {
  return max > 0 ? (score / max) * 100 : 0;
}

/** Eases a number up from 0 once, for the score reveal. */
function useCountUp(target: number, durationMs = 1100) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return value;
}

function ScoreRing({ percent }: { percent: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const shown = useCountUp(percent);
  const [drawn, setDrawn] = useState(prefersReducedMotion());
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const offset = circumference * (1 - (drawn ? Math.min(100, Math.max(0, percent)) : 0) / 100);

  return (
    <div className="relative h-36 w-36 shrink-0 sm:h-40 sm:w-40">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="url(#report-ring)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        />
        <defs>
          <linearGradient id="report-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f3dca6" />
            <stop offset="100%" stopColor="#c99a4b" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl tabular-nums leading-none text-[#f3e3bf]">
          {Math.round(shown)}
          <span className="text-xl text-[#d6b26e]">%</span>
        </span>
        <span className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">of marks</span>
      </div>
    </div>
  );
}

function DeltaChip({ delta, suffix, invert = false }: { delta: number; suffix: string; invert?: boolean }) {
  const rounded = Math.round(delta * 10) / 10;
  const good = invert ? rounded < 0 : rounded > 0;
  const flat = rounded === 0;
  const Icon = flat ? Minus : rounded > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums',
        flat
          ? 'border-white/15 text-muted-foreground'
          : good
          ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
          : 'border-rose-400/40 bg-rose-500/10 text-rose-300',
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {rounded > 0 ? '+' : ''}
      {formatMarks(rounded)}
      {suffix}
    </span>
  );
}

function Stat({
  label,
  value,
  hint,
  Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  Icon: typeof CheckCircle2;
  tone: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        <Icon className={cn('h-3.5 w-3.5', tone)} aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 font-display text-2xl tabular-nums leading-none text-foreground">{value}</p>
      {hint && <p className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Panel({ title, Icon, children, className, aside }: {
  title: string;
  Icon: typeof CheckCircle2;
  children: React.ReactNode;
  className?: string;
  aside?: React.ReactNode;
}) {
  return (
    <section className={cn('exam-panel rounded-2xl bg-[#14161b]/85 p-4 backdrop-blur-sm sm:p-5', className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-normal tracking-tight">
          <Icon className="h-4 w-4 text-[#d6b26e]" aria-hidden="true" />
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Score % per attempt. One series, so the title names it and no legend box. */
function AttemptTrend({
  attempts,
  currentId,
  compareId,
  onPick,
}: {
  attempts: AttemptSummary[];
  currentId: string | null;
  compareId: string | null;
  onPick: (id: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 560;
  const height = 180;
  const pad = { top: 16, right: 18, bottom: 26, left: 34 };
  // Points sit inset from the axis so the first one never covers a tick label.
  const inset = 22;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const points = attempts.map((attempt, i) => ({
    attempt,
    x: pad.left + inset + (attempts.length === 1 ? (innerW - inset * 2) / 2 : (i / (attempts.length - 1)) * (innerW - inset * 2)),
    y: pad.top + innerH * (1 - percentOf(attempt.score, attempt.maxScore) / 100),
    pct: percentOf(attempt.score, attempt.maxScore),
  }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const best = Math.max(...points.map((p) => p.pct));
  const hovered = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`Score per attempt: ${points.map((p) => `#${p.attempt.number} ${Math.round(p.pct)}%`).join(', ')}`}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 50, 100].map((tick) => {
          const y = pad.top + innerH * (1 - tick / 100);
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" />
              <text x={pad.left - 8} y={y + 3.5} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {tick}%
              </text>
            </g>
          );
        })}
        {points.length > 1 && (
          <path d={path} fill="none" stroke="#d6b26e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {points.map((p, i) => {
          const isCurrent = p.attempt.id === currentId;
          const isCompare = p.attempt.id === compareId;
          return (
            <g key={p.attempt.id}>
              <text x={p.x} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                #{p.attempt.number}
              </text>
              {isCompare && (
                <circle cx={p.x} cy={p.y} r="9" fill="none" stroke="#62aef0" strokeWidth="1.5" strokeDasharray="3 2" />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={isCurrent ? 6.5 : 4.5}
                fill={isCurrent ? '#f3dca6' : '#14161b'}
                stroke={isCurrent ? '#14161b' : '#d6b26e'}
                strokeWidth="2"
              />
              {/* Hit target larger than the mark. */}
              <rect
                x={p.x - Math.max(14, innerW / Math.max(1, points.length) / 2)}
                y={pad.top - 8}
                width={Math.max(28, innerW / Math.max(1, points.length))}
                height={innerH + 16}
                fill="transparent"
                className={cn(!isCurrent && 'cursor-pointer')}
                onMouseEnter={() => setHover(i)}
                onClick={() => !isCurrent && onPick(p.attempt.id)}
              >
                <title>{isCurrent ? 'This attempt' : `Compare with attempt #${p.attempt.number}`}</title>
              </rect>
              {p.pct === best && points.length > 1 && (
                <text x={p.x} y={p.y - 12} textAnchor="middle" className="fill-[#e7c98d] text-[10px] font-medium">
                  best
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-[rgba(214,178,110,0.3)] bg-[#0f1116]/95 px-2.5 py-1.5 text-xs shadow-xl"
          style={{ left: `${(hovered.x / width) * 100}%`, top: `${(hovered.y / height) * 100}%`, marginTop: -12 }}
        >
          <p className="font-medium text-foreground">
            Attempt #{hovered.attempt.number}
            {hovered.attempt.id === currentId && <span className="text-[#e7c98d]"> · this one</span>}
          </p>
          <p className="tabular-nums text-muted-foreground">
            {formatMarks(hovered.attempt.score)} / {formatMarks(hovered.attempt.maxScore)} · {Math.round(hovered.pct)}%
          </p>
          <p className="tabular-nums text-muted-foreground">
            {hovered.attempt.runMode === 'timed' ? 'Timed' : 'Open'} · {formatDuration(hovered.attempt.timeUsedSeconds)}
          </p>
        </div>
      )}
    </div>
  );
}

export interface AttemptReportProps {
  stats: PracticeRunStats;
  graded: GradedQuestion[];
  /** Paper position (1-based) per question uuid, for the answer-sheet labels. */
  labelFor: (uuid: string) => string;
  runMode: RunMode;
  timeUsedSeconds: number | null;
  timeExpired: boolean;
  signedIn: boolean;
  saveState: AttemptSaveState;
  onRetrySave: () => void;
  attempts: AttemptSummary[] | null;
  currentAttemptId: string | null;
  compare: AttemptDetail | null;
  compareId: string | null;
  onCompareChange: (id: string) => void;
  onReview: (filter: ReviewFilter, startUuid?: string) => void;
  onTryAgain: () => void;
}

export function AttemptReport({
  stats,
  graded,
  labelFor,
  runMode,
  timeUsedSeconds,
  timeExpired,
  signedIn,
  saveState,
  onRetrySave,
  attempts,
  currentAttemptId,
  compare,
  compareId,
  onCompareChange,
  onReview,
  onTryAgain,
}: AttemptReportProps) {
  const hasMarks = stats.totalMarks > 0;
  const scoreTarget = hasMarks ? stats.scoredMarks : stats.correct;
  const scoreMax = hasMarks ? stats.totalMarks : stats.gradableTotal;
  const score = useCountUp(scoreTarget);
  const percent = percentOf(scoreTarget, scoreMax);
  const attempted = stats.correct + stats.incorrect;
  const accuracy = attempted > 0 ? Math.round((stats.correct / attempted) * 100) : 0;

  const current = attempts?.find((a) => a.id === currentAttemptId) ?? null;
  const previous = useMemo(() => {
    if (!attempts || !current) return null;
    const idx = attempts.findIndex((a) => a.id === current.id);
    return idx > 0 ? attempts[idx - 1] ?? null : null;
  }, [attempts, current]);
  const bestBefore = useMemo(() => {
    if (!attempts || !current) return null;
    const others = attempts.filter((a) => a.id !== current.id && a.maxScore > 0);
    if (others.length === 0) return null;
    return Math.max(...others.map((a) => percentOf(a.score, a.maxScore)));
  }, [attempts, current]);

  const compareOutcomes = useMemo(() => {
    const map = new Map<string, PracticeRunReviewState>();
    compare?.answers.forEach((answer) => map.set(answer.questionUuid, answer.outcome));
    return map;
  }, [compare]);

  const shifts = useMemo(() => {
    const counts = { fixed: 0, slipped: 0, 'still-wrong': 0 };
    if (!compare) return null;
    graded.forEach((row) => {
      const shift = getQuestionShift(row.outcome, compareOutcomes.get(row.questionUuid));
      if (shift) counts[shift] += 1;
    });
    return counts;
  }, [compare, compareOutcomes, graded]);

  const byType = useMemo(() => {
    const rows = new Map<string, { correct: number; incorrect: number; unanswered: number; manual: number; total: number }>();
    graded.forEach((row) => {
      const entry = rows.get(row.questionType) ?? { correct: 0, incorrect: 0, unanswered: 0, manual: 0, total: 0 };
      entry[row.outcome] += 1;
      entry.total += 1;
      rows.set(row.questionType, entry);
    });
    const order = ['MCQ', 'MSQ', 'SA', 'OPPE'];
    return [...rows].sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
  }, [graded]);

  // Headline verdict — speaks to progress first, then to the score itself.
  const headline = (() => {
    if (current && previous && current.maxScore > 0) {
      const now = percentOf(current.score, current.maxScore);
      if (bestBefore !== null && now > bestBefore) return 'A new personal best.';
      const diff = current.score - previous.score;
      if (diff > 0) return `Up ${formatMarks(diff)} marks on attempt #${previous.number}.`;
      if (diff < 0) return `Down ${formatMarks(-diff)} marks on attempt #${previous.number}. Review what slipped.`;
      return `Level with attempt #${previous.number}.`;
    }
    if (percent >= 85) return 'Outstanding. Exam-ready on this paper.';
    if (percent >= 65) return 'Solid. A focused review takes this higher.';
    if (percent >= 40) return 'Halfway there. The mistakes are the lesson.';
    return 'A baseline to beat. Review, then try again.';
  })();

  const reviewCounts: Record<ReviewFilter, number> = {
    all: graded.length,
    incorrect: stats.incorrect,
    unanswered: stats.skipped,
    correct: stats.correct,
  };

  return (
    <div className="space-y-5">
      {/* Hero verdict */}
      <section
        className="exam-verdict exam-tome relative isolate overflow-hidden rounded-2xl border border-[rgba(214,178,110,0.3)] bg-[radial-gradient(120%_140%_at_85%_0%,rgba(214,178,110,0.16),transparent_55%),linear-gradient(to_bottom,rgba(24,26,32,0.95),rgba(15,16,20,0.97))] px-5 pb-5 pt-6 backdrop-blur-sm sm:px-8 sm:pb-7 sm:pt-8"
        style={{ ['--lvl' as string]: '#d6b26e' }}
      >
        <div className="tcard-frame" aria-hidden="true" />
        <span className="tcard-corner tcard-corner-tl" aria-hidden="true" />
        <span className="tcard-corner tcard-corner-tr" aria-hidden="true" />
        <span className="tcard-corner tcard-corner-bl" aria-hidden="true" />
        <span className="tcard-corner tcard-corner-br" aria-hidden="true" />

        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#d6b26e]">
              <span>{current ? `Attempt #${current.number}` : 'Paper handed in'}</span>
              <span className="text-white/25">·</span>
              <span className="text-muted-foreground">{runMode === 'timed' ? 'Timed run' : 'Open run'}</span>
              {timeUsedSeconds !== null && (
                <>
                  <span className="text-white/25">·</span>
                  <span className="text-muted-foreground tabular-nums">{formatDuration(timeUsedSeconds)}</span>
                </>
              )}
              {timeExpired && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 normal-case tracking-normal text-amber-300">
                  <Timer className="h-3 w-3" aria-hidden="true" />
                  Auto-submitted at time
                </span>
              )}
            </p>

            <p className="mt-3 flex items-baseline gap-2 font-display">
              <span className="text-6xl tabular-nums leading-none text-[#f6e7c4] drop-shadow-[0_0_24px_rgba(214,178,110,0.35)] sm:text-7xl">
                {formatMarks(Math.round(score * 10) / 10)}
              </span>
              <span className="text-2xl text-muted-foreground">
                / {formatMarks(scoreMax)} {hasMarks ? 'marks' : 'correct'}
              </span>
            </p>
            <p className="mt-3 text-lg text-foreground/90">{headline}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {current && previous ? (
                <>
                  <DeltaChip delta={current.score - previous.score} suffix=" marks" />
                  {current.timeUsedSeconds !== null && previous.timeUsedSeconds !== null && (
                    <DeltaChip
                      delta={(current.timeUsedSeconds - previous.timeUsedSeconds) / 60}
                      suffix=" min"
                      invert
                    />
                  )}
                  <span>vs attempt #{previous.number}</span>
                </>
              ) : current ? (
                <span>First attempt on record. Retry to start tracking improvement.</span>
              ) : null}
              <SaveNote
                signedIn={signedIn}
                saveState={saveState}
                onRetry={onRetrySave}
              />
            </div>
          </div>

          <ScoreRing percent={percent} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Correct" value={String(stats.correct)} Icon={CheckCircle2} tone="text-emerald-400" />
          <Stat label="Incorrect" value={String(stats.incorrect)} Icon={XCircle} tone="text-rose-400" />
          <Stat label="Skipped" value={String(stats.skipped)} Icon={CircleDashed} tone="text-slate-400" />
          <Stat
            label="Accuracy"
            value={`${accuracy}%`}
            hint={attempted > 0 ? `of ${attempted} attempted` : 'nothing attempted'}
            Icon={Target}
            tone="text-[#d6b26e]"
          />
          <Stat
            label="Time"
            value={formatDuration(timeUsedSeconds)}
            hint={
              timeUsedSeconds !== null && graded.length > 0
                ? `${formatDuration(timeUsedSeconds / graded.length)} per question`
                : undefined
            }
            Icon={Hourglass}
            tone="text-sky-300"
          />
          <Stat
            label="Self-check"
            value={String(stats.manualEvalCount)}
            hint={stats.manualEvalCount > 0 ? 'not auto-graded' : 'all auto-graded'}
            Icon={PenLine}
            tone="text-sky-200"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {stats.incorrect > 0 && (
            <Button
              onClick={() => onReview('incorrect')}
              className="gap-2 bg-[#d6b26e] text-[#1a1408] hover:bg-[#e7c98d]"
              data-autofocus
            >
              <XCircle className="h-4 w-4" />
              Review incorrect ({stats.incorrect})
            </Button>
          )}
          {stats.skipped > 0 && (
            <Button variant="outline" onClick={() => onReview('unanswered')} className="gap-2">
              <CircleDashed className="h-4 w-4" />
              Review skipped ({stats.skipped})
            </Button>
          )}
          <Button variant="outline" onClick={() => onReview('all')} className="gap-2">
            <ListChecks className="h-4 w-4" />
            Review all
          </Button>
          <Button variant="ghost" onClick={onTryAgain} className="gap-2 text-muted-foreground hover:text-foreground">
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
        </div>
      </section>

      {/* Answer sheet */}
      <Panel
        title="Answer sheet"
        Icon={ListChecks}
        aside={<p className="hidden text-xs text-muted-foreground sm:block">Tap a question to review it</p>}
      >
        <div className="grid grid-cols-[repeat(auto-fill,minmax(2.6rem,1fr))] gap-1.5">
          {graded.map((row, i) => {
            const meta = OUTCOME_META[row.outcome];
            const shift = compare ? getQuestionShift(row.outcome, compareOutcomes.get(row.questionUuid)) : null;
            return (
              <button
                key={row.questionUuid}
                type="button"
                onClick={() => onReview('all', row.questionUuid)}
                className={cn(
                  'report-cell relative flex h-10 items-center justify-center rounded-md border text-sm font-medium tabular-nums transition-transform hover:-translate-y-0.5 hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b26e]',
                  meta.cell,
                )}
                style={{ animationDelay: `${Math.min(i * 14, 700)}ms` }}
                title={`Q${labelFor(row.questionUuid)} · ${meta.label}${row.maxMarks > 0 ? ` · ${formatMarks(row.marksAwarded)}/${formatMarks(row.maxMarks)}` : ''}${shift === 'fixed' ? ' · fixed since compared attempt' : shift === 'slipped' ? ' · slipped since compared attempt' : ''}`}
              >
                {labelFor(row.questionUuid)}
                {shift === 'fixed' && (
                  <ArrowUpRight className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-[#14161b] text-emerald-300" aria-label="fixed" />
                )}
                {shift === 'slipped' && (
                  <ArrowDownRight className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-[#14161b] text-rose-300" aria-label="slipped" />
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {(['correct', 'incorrect', 'unanswered', 'manual'] as const).map((outcome) => {
            const meta = OUTCOME_META[outcome];
            return (
              <span key={outcome} className="inline-flex items-center gap-1.5">
                <meta.Icon className={cn('h-3.5 w-3.5', meta.text)} aria-hidden="true" />
                {meta.label}
              </span>
            );
          })}
          {compare && (
            <>
              <span className="inline-flex items-center gap-1">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                fixed since #{compare.number}
              </span>
              <span className="inline-flex items-center gap-1">
                <ArrowDownRight className="h-3.5 w-3.5 text-rose-300" aria-hidden="true" />
                slipped since #{compare.number}
              </span>
            </>
          )}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Progress across attempts */}
        <Panel
          title="Your attempts"
          Icon={TrendingUp}
          aside={
            attempts && attempts.length > 1 ? (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Compare with
                <select
                  value={compareId ?? ''}
                  onChange={(event) => onCompareChange(event.target.value)}
                  className="rounded-md border border-[rgba(214,178,110,0.25)] bg-[#0f1116] px-2 py-1 text-xs text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b26e]"
                >
                  {attempts
                    .filter((a) => a.id !== currentAttemptId)
                    .slice()
                    .reverse()
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        #{a.number} · {Math.round(percentOf(a.score, a.maxScore))}%
                      </option>
                    ))}
                </select>
              </label>
            ) : null
          }
        >
          {!signedIn ? (
            <EmptyNote
              Icon={LogIn}
              title="Sign in to track retries"
              body="Signed-in attempts are kept, so every retry shows what you fixed and what slipped."
              action={<SignInTrigger><Button size="sm" variant="outline">Sign in</Button></SignInTrigger>}
            />
          ) : attempts === null ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Loading your attempts…
            </div>
          ) : attempts.length < 2 ? (
            <EmptyNote
              Icon={TrendingUp}
              title="Your trend starts here"
              body="Retry this paper and each attempt lands on this chart, with a side-by-side of what changed."
              action={<Button size="sm" variant="outline" onClick={onTryAgain} className="gap-1.5"><RotateCcw className="h-3.5 w-3.5" />Try again</Button>}
            />
          ) : (
            <>
              <AttemptTrend
                attempts={attempts}
                currentId={currentAttemptId}
                compareId={compareId}
                onPick={onCompareChange}
              />
              {compare && shifts && (
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-3 text-center">
                  <ShiftTile label="Fixed" value={shifts.fixed} Icon={ArrowUpRight} tone="text-emerald-300" />
                  <ShiftTile label="Slipped" value={shifts.slipped} Icon={ArrowDownRight} tone="text-rose-300" />
                  <ShiftTile label="Still wrong" value={shifts['still-wrong']} Icon={XCircle} tone="text-amber-300" />
                </div>
              )}
              {compare && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Compared with attempt #{compare.number}: {formatMarks(compare.score)}/{formatMarks(compare.maxScore)} in{' '}
                  {formatDuration(compare.timeUsedSeconds)}
                </p>
              )}
            </>
          )}
        </Panel>

        {/* By question type */}
        <Panel title="By question type" Icon={Clock}>
          <div className="space-y-3.5">
            {byType.map(([type, row]) => (
              <div key={type}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-foreground">{TYPE_LABELS[type] ?? type}</span>
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {row.manual === row.total
                      ? `${row.total} self-check`
                      : `${row.correct} / ${row.total - row.manual} correct`}
                  </span>
                </div>
                <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-white/[0.05]">
                  {(['correct', 'incorrect', 'unanswered', 'manual'] as const).map((outcome) =>
                    row[outcome] > 0 ? (
                      <span
                        key={outcome}
                        className={cn(
                          'report-bar h-full first:rounded-l-full last:rounded-r-full',
                          outcome === 'correct' && 'bg-emerald-400/80',
                          outcome === 'incorrect' && 'bg-rose-400/80',
                          outcome === 'unanswered' && 'bg-slate-500/50',
                          outcome === 'manual' && 'bg-sky-300/40',
                        )}
                        style={{ width: `${(row[outcome] / row.total) * 100}%` }}
                        title={`${OUTCOME_META[outcome].label}: ${row[outcome]}`}
                      />
                    ) : null,
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {(['correct', 'incorrect', 'unanswered', 'manual'] as const).map((outcome) => (
              <span key={outcome} className="inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    outcome === 'correct' && 'bg-emerald-400/80',
                    outcome === 'incorrect' && 'bg-rose-400/80',
                    outcome === 'unanswered' && 'bg-slate-500/50',
                    outcome === 'manual' && 'bg-sky-300/40',
                  )}
                />
                {OUTCOME_META[outcome].label}
              </span>
            ))}
          </div>
          <p className="sr-only">
            Review counts: {reviewCounts.incorrect} incorrect, {reviewCounts.unanswered} skipped, {reviewCounts.correct} correct.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function ShiftTile({ label, value, Icon, tone }: { label: string; value: number; Icon: typeof CheckCircle2; tone: string }) {
  return (
    <div className="rounded-lg bg-black/20 px-2 py-2">
      <p className={cn('inline-flex items-center gap-1 font-display text-2xl tabular-nums', tone)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        {value}
      </p>
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyNote({ Icon, title, body, action }: {
  Icon: typeof CheckCircle2;
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
      <Icon className="h-6 w-6 text-[#d6b26e]/70" aria-hidden="true" />
      <p className="font-display text-base text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}

function SaveNote({ signedIn, saveState, onRetry }: {
  signedIn: boolean;
  saveState: AttemptSaveState;
  onRetry: () => void;
}) {
  if (!signedIn) {
    return (
      <SignInTrigger>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-[#e7c98d] underline-offset-2 hover:underline"
        >
          <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
          Sign in to save this attempt
        </button>
      </SignInTrigger>
    );
  }
  if (saveState === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Saving attempt…
      </span>
    );
  }
  if (saveState === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-rose-300" role="alert">
        Couldn&apos;t save this attempt.
        <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">
          Retry
        </button>
      </span>
    );
  }
  if (saveState === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs" role="status">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/80" aria-hidden="true" />
        Saved to your history
      </span>
    );
  }
  return null;
}

const FILTER_LABELS: Record<ReviewFilter, string> = {
  all: 'All',
  incorrect: 'Incorrect',
  unanswered: 'Skipped',
  correct: 'Correct',
};

/** Sits above the question while reviewing: filter, position, and verdict. */
export function ReviewBar({
  filter,
  counts,
  position,
  total,
  questionLabel,
  outcome,
  marksAwarded,
  maxMarks,
  compareOutcome,
  compareNumber,
  onFilter,
  onBackToReport,
}: {
  filter: ReviewFilter;
  counts: Record<ReviewFilter, number>;
  /** 0-based position in the filtered list, or -1 when off-filter. */
  position: number;
  total: number;
  questionLabel: string;
  outcome: PracticeRunReviewState | undefined;
  marksAwarded: number;
  maxMarks: number;
  compareOutcome?: PracticeRunReviewState;
  compareNumber?: number;
  onFilter: (filter: ReviewFilter) => void;
  onBackToReport: () => void;
}) {
  const meta = outcome ? OUTCOME_META[outcome] : null;
  const shift = getQuestionShift(outcome, compareOutcome);
  const compareMeta = compareOutcome ? OUTCOME_META[compareOutcome] : null;

  return (
    <div className="exam-panel exam-verdict rounded-2xl bg-[#14161b]/90 p-3 backdrop-blur-sm sm:p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBackToReport} className="gap-1.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Report
        </Button>
        <span className="h-5 w-px bg-white/10" aria-hidden="true" />
        <div role="tablist" aria-label="Review filter" className="flex flex-wrap gap-1">
          {(['incorrect', 'unanswered', 'correct', 'all'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              disabled={counts[key] === 0}
              onClick={() => onFilter(key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-35',
                filter === key
                  ? 'border-[#d6b26e]/70 bg-[#d6b26e]/15 text-[#f3dca6]'
                  : 'border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground',
              )}
            >
              {FILTER_LABELS[key]}
              <span className="tabular-nums opacity-70">{counts[key]}</span>
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {position >= 0
            ? `${FILTER_LABELS[filter]} · ${position + 1} of ${total}`
            : `Question ${questionLabel} · outside this filter`}
        </span>
      </div>

      {meta && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-white/[0.07] pt-2.5 text-sm">
          <span className={cn('inline-flex items-center gap-1.5 font-medium', meta.text)}>
            <meta.Icon className="h-4 w-4" aria-hidden="true" />
            {meta.label}
          </span>
          {maxMarks > 0 && (
            <span className="tabular-nums text-muted-foreground">
              {formatMarks(marksAwarded)} / {formatMarks(maxMarks)} marks
            </span>
          )}
          {compareMeta && compareNumber !== undefined && (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="text-white/20">·</span>
              Attempt #{compareNumber}:
              <span className={compareMeta.text}>{compareMeta.label}</span>
              {shift === 'fixed' && (
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-1.5 py-px text-[11px] text-emerald-300">fixed</span>
              )}
              {shift === 'slipped' && (
                <span className="rounded-full border border-rose-400/40 bg-rose-500/10 px-1.5 py-px text-[11px] text-rose-300">slipped</span>
              )}
              {shift === 'still-wrong' && (
                <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-1.5 py-px text-[11px] text-amber-300">wrong again</span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
