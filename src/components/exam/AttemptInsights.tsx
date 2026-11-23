import type React from 'react';
import { useId, useMemo, useState } from 'react';
import { Activity, ArrowLeft, ArrowLeftRight, Clock3, Compass, Gauge, History, Lightbulb, Route, Shuffle, TimerReset } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalyseWithAI, type InsightsReport } from '@/components/exam/InsightsCard';
import {
  VIA_LABEL,
  formatSeconds,
  type InsightsAnalysis,
  type QuestionInsight,
} from '@/lib/attemptInsights';
import type { PracticeRunReviewState, RunMode } from '@/lib/practiceRun';

/*
 * Outcome is a status encoding, and green/red can't be told apart under
 * red-green colour blindness. So colour is never the only cue: wrong answers
 * also carry a hatch, skipped ones a dashed outline, and every mark names its
 * outcome in the tooltip and the legend.
 */
const FILL: Record<PracticeRunReviewState, string> = {
  correct: '#34d399',
  incorrect: '#fb7185',
  manual: '#7dd3fc',
  unanswered: 'rgba(148,163,184,0.28)',
};
const WORD: Record<PracticeRunReviewState, string> = {
  correct: 'Right',
  incorrect: 'Wrong',
  manual: 'Self-check',
  unanswered: 'Skipped',
};
const SURFACE = '#121a30';
const GRID = 'rgba(255,255,255,0.07)';
const ACCENT = 'rgb(var(--ex-accent))';

const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
};

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/** A rect with only its data end rounded, anchored flat to the baseline. */
function barPath(x: number, y: number, w: number, h: number, r = 3) {
  if (h <= 0 || w <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function Hatch({ id }: { id: string }) {
  return (
    <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="5" height="5" fill={FILL.incorrect} />
      <line x1="0" y1="0" x2="0" y2="5" stroke={SURFACE} strokeOpacity="0.55" strokeWidth="1.6" />
    </pattern>
  );
}

const fillFor = (outcome: PracticeRunReviewState, hatchId: string) =>
  outcome === 'incorrect' ? `url(#${hatchId})` : FILL[outcome];

function Swatch({ outcome }: { outcome: PracticeRunReviewState }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]',
        outcome === 'unanswered' && 'border border-dashed border-slate-400/70',
      )}
      style={
        outcome === 'incorrect'
          ? { background: `repeating-linear-gradient(45deg, ${FILL.incorrect} 0 3px, rgba(18,26,48,0.55) 3px 4.5px)` }
          : outcome === 'unanswered'
          ? undefined
          : { background: FILL[outcome] }
      }
    />
  );
}

function Legend({ items }: { items: Array<{ outcome: PracticeRunReviewState; note?: string }> }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map(({ outcome, note }) => (
        <li key={outcome} className="inline-flex items-center gap-1.5">
          <Swatch outcome={outcome} />
          {WORD[outcome]}
          {note && <span className="tabular-nums text-foreground/80">{note}</span>}
        </li>
      ))}
    </ul>
  );
}

function Tip({ left, top, children }: { left: number; top: number; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-[rgb(var(--ex-line)/0.3)] bg-[#0d1325]/95 px-2.5 py-1.5 text-xs shadow-xl"
      style={{ left: `${Math.min(92, Math.max(8, left))}%`, top: `${top}%`, marginTop: -10 }}
    >
      {children}
    </div>
  );
}

function Panel({ title, Icon, aside, children, className }: {
  title: string;
  Icon: typeof Clock3;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('exam-panel min-w-0 rounded-2xl bg-[#121a30]/85 p-4 backdrop-blur-sm sm:p-5', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <h2 className="flex items-center gap-2 font-display text-lg font-normal tracking-tight">
          <Icon className="h-4 w-4 text-[rgb(var(--ex-accent))]" aria-hidden="true" />
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="exam-panel rounded-xl bg-[#121a30]/85 px-3.5 py-3 backdrop-blur-sm">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums tracking-tight">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

/* ── Time on each question ───────────────────────────────────────────── */

function TimePerQuestion({ questions, budget, onOpen }: {
  questions: QuestionInsight[];
  /** Even share of the exam clock per question, for timed runs. */
  budget: number | null;
  onOpen: (id: string) => void;
}) {
  const hatchId = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const width = 720;
  const height = 230;
  const pad = { top: 18, right: 12, bottom: 26, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const n = questions.length;
  const slot = innerW / Math.max(1, n);
  const barW = Math.max(2, slot - Math.min(6, Math.max(2, slot * 0.28)));
  const max = Math.max(1, budget ?? 0, ...questions.map((q) => q.timeSeconds));
  const seen = questions.filter((q) => q.timeSeconds > 0);
  const avg = seen.length ? seen.reduce((sum, q) => sum + q.timeSeconds, 0) / seen.length : 0;
  const y = (seconds: number) => pad.top + innerH * (1 - seconds / max);
  const labelEvery = n > 40 ? 5 : n > 24 ? 2 : 1;
  const hovered = hover !== null ? questions[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`Time per question. Average ${formatSeconds(avg)}. Longest Q${
          questions.reduce((a, b) => (b.timeSeconds > a.timeSeconds ? b : a), questions[0]!).q
        }.`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <Hatch id={hatchId} />
        </defs>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.left} x2={width - pad.right} y1={y(max * f)} y2={y(max * f)} stroke={GRID} />
            <text x={pad.left - 8} y={y(max * f) + 3.5} textAnchor="end" className="fill-muted-foreground text-[10px]">
              {formatSeconds(max * f)}
            </text>
          </g>
        ))}
        {questions.map((q, i) => {
          const x = pad.left + i * slot + (slot - barW) / 2;
          const h = Math.max(0, innerH * (q.timeSeconds / max));
          return (
            <g key={q.id} opacity={hover === null || hover === i ? 1 : 0.45}>
              {q.outcome === 'unanswered' ? (
                h > 0 && (
                  <path
                    d={barPath(x + 0.5, y(q.timeSeconds) + 0.5, barW - 1, h - 0.5)}
                    fill={FILL.unanswered}
                    stroke="rgba(148,163,184,0.7)"
                    strokeDasharray="3 2"
                  />
                )
              ) : (
                <path d={barPath(x, y(q.timeSeconds), barW, h)} fill={fillFor(q.outcome, hatchId)} />
              )}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                  {q.q}
                </text>
              )}
              <rect
                x={pad.left + i * slot}
                y={pad.top}
                width={slot}
                height={innerH + 14}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHover(i)}
                onClick={() => onOpen(q.id)}
              >
                <title>{`Review Q${q.q}`}</title>
              </rect>
            </g>
          );
        })}
        {avg > 0 && (
          <g pointerEvents="none">
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(avg)}
              y2={y(avg)}
              stroke="rgba(226,232,240,0.55)"
              strokeDasharray="4 4"
            />
            <text x={width - pad.right} y={y(avg) - 5} textAnchor="end" className="fill-foreground/70 text-[10px]">
              average {formatSeconds(avg)}
            </text>
          </g>
        )}
        {budget !== null && budget > 0 && (
          <g pointerEvents="none">
            <line x1={pad.left} x2={width - pad.right} y1={y(budget)} y2={y(budget)} stroke="#fbbf24" strokeOpacity="0.7" strokeDasharray="1 3" strokeLinecap="round" strokeWidth="1.5" />
            <text x={pad.left + 4} y={y(budget) - 5} className="fill-amber-200/80 text-[10px]">
              budget {formatSeconds(budget)} a question
            </text>
          </g>
        )}
      </svg>
      {hovered && hover !== null && (
        <Tip left={((pad.left + (hover + 0.5) * slot) / width) * 100} top={(y(hovered.timeSeconds) / height) * 100}>
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <Swatch outcome={hovered.outcome} /> Q{hovered.q} · {WORD[hovered.outcome]}
          </p>
          <p className="tabular-nums text-muted-foreground">
            {formatSeconds(hovered.timeSeconds)} on screen · {hovered.visits} {hovered.visits === 1 ? 'visit' : 'visits'}
          </p>
          {hovered.answerChanges > 0 && (
            <p className="tabular-nums text-muted-foreground">
              Changed {hovered.answerChanges} {hovered.answerChanges === 1 ? 'time' : 'times'}
            </p>
          )}
          <p className="text-[rgb(var(--ex-accent-soft))]">Click to review</p>
        </Tip>
      )}
    </div>
  );
}

/* ── Journey through the paper ───────────────────────────────────────── */

function JourneyMap({ analysis, onOpen }: { analysis: InsightsAnalysis; onOpen: (id: string) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const { journey, questions, firstAnswers } = analysis;
  const width = 560;
  const height = 260;
  const pad = { top: 12, right: 14, bottom: 26, left: 38 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const n = Math.max(1, questions.length);
  const end = Math.max(1, journey[journey.length - 1]?.to ?? analysis.activeSeconds);
  const x = (s: number) => pad.left + innerW * (s / end);
  const y = (q: number) => pad.top + (n === 1 ? innerH / 2 : ((q - 1) / (n - 1)) * innerH);
  const outcomeOf = (q: number) => questions[q - 1]?.outcome ?? 'unanswered';
  const yTicks = Array.from(new Set([1, Math.ceil(n / 2), n]));
  const hovered = hover !== null ? journey[hover] : null;

  const onMove = (event: React.MouseEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const t = ((event.clientX - box.left) / box.width) * end;
    const index = journey.findIndex((stretch) => t >= stretch.from && t <= stretch.to);
    setHover(index >= 0 ? index : null);
  };

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`Path through the paper over time: ${journey.length} stretches on questions.`}
        onMouseLeave={() => setHover(null)}
      >
        {yTicks.map((q) => (
          <g key={q}>
            <line x1={pad.left} x2={width - pad.right} y1={y(q)} y2={y(q)} stroke={GRID} />
            <text x={pad.left - 8} y={y(q) + 3.5} textAnchor="end" className="fill-muted-foreground text-[10px]">
              Q{q}
            </text>
          </g>
        ))}
        {[0, 0.5, 1].map((f) => (
          <text
            key={f}
            x={x(end * f)}
            y={height - 8}
            textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}
            className="fill-muted-foreground text-[10px]"
          >
            {clock(end * f)}
          </text>
        ))}
        {/* Connectors: each move between questions. */}
        <path
          d={journey
            .map((stretch, i) => `${i === 0 ? 'M' : 'L'}${x(stretch.from).toFixed(1)},${y(stretch.q).toFixed(1)}H${x(stretch.to).toFixed(1)}`)
            .join('')}
          fill="none"
          stroke="rgba(226,232,240,0.22)"
          strokeWidth="1"
        />
        {journey.map((stretch, i) => (
          <line
            key={i}
            x1={x(stretch.from)}
            x2={Math.max(x(stretch.to), x(stretch.from) + 2)}
            y1={y(stretch.q)}
            y2={y(stretch.q)}
            stroke={outcomeOf(stretch.q) === 'unanswered' ? 'rgba(148,163,184,0.75)' : FILL[outcomeOf(stretch.q)]}
            strokeWidth={hover === i ? 7 : 5}
            strokeLinecap="round"
            strokeDasharray={outcomeOf(stretch.q) === 'incorrect' ? '6 3' : outcomeOf(stretch.q) === 'unanswered' ? '2 3' : undefined}
          />
        ))}
        {firstAnswers.map((moment) => (
          <circle
            key={moment.q}
            cx={x(Math.min(moment.at, end))}
            cy={y(moment.q)}
            r="3.5"
            fill="#e2e8f0"
            stroke={SURFACE}
            strokeWidth="2"
            pointerEvents="none"
          />
        ))}
        {hovered && (
          <line
            x1={x((hovered.from + hovered.to) / 2)}
            x2={x((hovered.from + hovered.to) / 2)}
            y1={pad.top}
            y2={pad.top + innerH}
            stroke="rgba(226,232,240,0.25)"
            pointerEvents="none"
          />
        )}
        <rect
          x={pad.left}
          y={pad.top - 6}
          width={innerW}
          height={innerH + 12}
          fill="transparent"
          className={cn(hovered && 'cursor-pointer')}
          onMouseMove={onMove}
          onClick={() => {
            const id = hovered ? questions[hovered.q - 1]?.id : undefined;
            if (id) onOpen(id);
          }}
        />
      </svg>
      {hovered && (
        <Tip left={(x((hovered.from + hovered.to) / 2) / width) * 100} top={(y(hovered.q) / height) * 100}>
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <Swatch outcome={outcomeOf(hovered.q)} /> Q{hovered.q} · {WORD[outcomeOf(hovered.q)]}
          </p>
          <p className="tabular-nums text-muted-foreground">
            {clock(hovered.from)}–{clock(hovered.to)} · {formatSeconds(hovered.to - hovered.from)}
          </p>
        </Tip>
      )}
    </div>
  );
}

/* ── Pace ────────────────────────────────────────────────────────────── */

function PaceChart({ analysis, budgetSeconds }: { analysis: InsightsAnalysis; budgetSeconds: number | null }) {
  const [hoverT, setHoverT] = useState<number | null>(null);
  const total = analysis.questions.length;
  const moments = [...analysis.firstAnswers].sort((a, b) => a.at - b.at);
  const end = Math.max(1, budgetSeconds ?? 0, analysis.activeSeconds);
  const evenEnd = budgetSeconds ?? analysis.activeSeconds;
  const width = 560;
  const height = 260;
  const pad = { top: 14, right: 14, bottom: 26, left: 34 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (s: number) => pad.left + innerW * (s / end);
  const y = (count: number) => pad.top + innerH * (1 - count / Math.max(1, total));
  const answeredBy = (t: number) => moments.filter((m) => m.at <= t).length;
  const evenBy = (t: number) => (evenEnd > 0 ? Math.min(total, (t / evenEnd) * total) : 0);

  let d = `M${x(0)},${y(0)}`;
  let count = 0;
  for (const m of moments) {
    d += `H${x(m.at).toFixed(1)}V${y(++count).toFixed(1)}`;
  }
  d += `H${x(analysis.activeSeconds).toFixed(1)}`;

  const onMove = (event: React.MouseEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setHoverT(Math.max(0, Math.min(end, ((event.clientX - box.left) / box.width) * end)));
  };

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-4 rounded bg-[rgb(var(--ex-accent))]" />
          Questions answered
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-4 border-t border-dashed border-slate-300/70" />
          {budgetSeconds ? 'Even pace for the exam clock' : 'Even pace over your time'}
        </li>
      </ul>
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label={`Questions answered over time: ${moments.length} of ${total}.`}
          onMouseLeave={() => setHoverT(null)}
        >
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={pad.left} x2={width - pad.right} y1={y(total * f)} y2={y(total * f)} stroke={GRID} />
              <text x={pad.left - 8} y={y(total * f) + 3.5} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {Math.round(total * f)}
              </text>
              <text
                x={x(end * f)}
                y={height - 8}
                textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}
                className="fill-muted-foreground text-[10px]"
              >
                {clock(end * f)}
              </text>
            </g>
          ))}
          <line
            x1={x(0)}
            y1={y(0)}
            x2={x(evenEnd)}
            y2={y(total)}
            stroke="rgba(203,213,225,0.6)"
            strokeDasharray="4 4"
          />
          <path d={d} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" />
          {hoverT !== null && (
            <g pointerEvents="none">
              <line x1={x(hoverT)} x2={x(hoverT)} y1={pad.top} y2={pad.top + innerH} stroke="rgba(226,232,240,0.25)" />
              <circle cx={x(hoverT)} cy={y(answeredBy(hoverT))} r="4.5" fill={ACCENT} stroke={SURFACE} strokeWidth="2" />
            </g>
          )}
          <rect
            x={pad.left}
            y={pad.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onMouseMove={onMove}
          />
        </svg>
        {hoverT !== null && (
          <Tip left={(x(hoverT) / width) * 100} top={(y(answeredBy(hoverT)) / height) * 100}>
            <p className="font-medium text-foreground">At {clock(hoverT)}</p>
            <p className="tabular-nums text-muted-foreground">
              {answeredBy(hoverT)} answered · even pace {Math.floor(evenBy(hoverT))}
            </p>
          </Tip>
        )}
      </div>
    </div>
  );
}

/* ── Where the time went, by outcome ─────────────────────────────────── */

function TimeSplit({ questions }: { questions: QuestionInsight[] }) {
  const order: PracticeRunReviewState[] = ['correct', 'incorrect', 'manual', 'unanswered'];
  const totals = order
    .map((outcome) => ({
      outcome,
      seconds: questions.filter((q) => q.outcome === outcome).reduce((sum, q) => sum + q.timeSeconds, 0),
    }))
    .filter((row) => row.seconds > 0);
  const all = totals.reduce((sum, row) => sum + row.seconds, 0);
  const wrong = totals.find((row) => row.outcome === 'incorrect')?.seconds ?? 0;
  if (all <= 0) return <p className="text-sm text-muted-foreground">No time was logged on questions.</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground/90">
        <span className="font-display text-3xl tabular-nums tracking-tight">{Math.round((wrong / all) * 100)}%</span>
        <span className="ml-2 text-muted-foreground">of your time went to questions you got wrong.</span>
      </p>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label="Share of time by outcome">
        {totals.map((row) => (
          <span
            key={row.outcome}
            title={`${WORD[row.outcome]}: ${formatSeconds(row.seconds)}`}
            className={cn('h-full', row.outcome === 'unanswered' && 'border border-dashed border-slate-400/70')}
            style={{
              width: `${(row.seconds / all) * 100}%`,
              background:
                row.outcome === 'incorrect'
                  ? `repeating-linear-gradient(45deg, ${FILL.incorrect} 0 4px, rgba(18,26,48,0.5) 4px 6px)`
                  : FILL[row.outcome],
            }}
          />
        ))}
      </div>
      <Legend
        items={totals.map((row) => ({
          outcome: row.outcome,
          note: `${formatSeconds(row.seconds)} · ${Math.round((row.seconds / all) * 100)}%`,
        }))}
      />
    </div>
  );
}

/* ── Answer changes ──────────────────────────────────────────────────── */

function useAnswerShifts(questions: QuestionInsight[]) {
  return useMemo(() => {
    const gained: QuestionInsight[] = [];
    const lost: QuestionInsight[] = [];
    const churned: QuestionInsight[] = [];
    for (const q of questions) {
      const graded = q.answerTrail.filter((step) => step.verdict === 'correct' || step.verdict === 'incorrect');
      for (let i = 1; i < graded.length; i += 1) {
        const from = graded[i - 1]!.verdict;
        const to = graded[i]!.verdict;
        if (from === 'incorrect' && to === 'correct') gained.push(q);
        else if (from === 'correct' && to === 'incorrect') lost.push(q);
        else if (from === 'incorrect' && to === 'incorrect') churned.push(q);
      }
    }
    const uniq = (list: QuestionInsight[]) => Array.from(new Map(list.map((q) => [q.id, q])).values());
    return { gained: uniq(gained), lost: uniq(lost), churned: uniq(churned), total: gained.length + lost.length + churned.length };
  }, [questions]);
}

function ShiftRow({ label, list, outcome, onOpen }: {
  label: string;
  list: QuestionInsight[];
  outcome: PracticeRunReviewState;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 border-t border-white/[0.06] py-2.5 first:border-t-0 first:pt-0">
      <span className="mt-0.5 inline-flex w-[8.5rem] shrink-0 items-center gap-1.5 text-sm text-foreground/90">
        <Swatch outcome={outcome} />
        {label}
      </span>
      <span className="w-6 shrink-0 font-display text-lg leading-none tabular-nums">{list.length}</span>
      <span className="flex min-w-0 flex-wrap gap-1">
        {list.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => onOpen(q.id)}
            className="rounded-md border border-white/[0.1] px-1.5 py-0.5 text-xs tabular-nums text-foreground/80 transition-colors hover:border-white/30 hover:text-foreground"
          >
            Q{q.q}
          </button>
        ))}
      </span>
    </div>
  );
}

/* ── How the user moved ──────────────────────────────────────────────── */

function NavigationBars({ analysis }: { analysis: InsightsAnalysis }) {
  const nav = analysis.navigation;
  const rows = Object.entries(nav.byVia)
    .map(([via, count]) => ({ label: VIA_LABEL[via as keyof typeof VIA_LABEL] ?? via, count: count ?? 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...rows.map((row) => row.count));
  const moves = Math.max(1, nav.moves);
  const kinds = [
    { label: 'Step forward', value: nav.forwardSteps },
    { label: 'Step back', value: nav.backwardSteps },
    { label: 'Jump ahead', value: nav.jumpsForward },
    { label: 'Jump back', value: nav.jumpsBack },
  ];

  if (nav.moves === 0) return <p className="text-sm text-muted-foreground">You stayed on one question.</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kinds.map((kind) => (
          <div key={kind.label} className="rounded-lg border border-white/[0.07] bg-black/15 px-2.5 py-2">
            <p className="text-[11px] text-muted-foreground">{kind.label}</p>
            <p className="font-display text-xl tabular-nums">
              {kind.value}
              <span className="ml-1 text-xs text-muted-foreground">{Math.round((kind.value / moves) * 100)}%</span>
            </p>
          </div>
        ))}
      </div>
      <ul className="space-y-2" aria-label="Moves by method">
        {rows.map((row) => (
          <li key={row.label} className="grid grid-cols-[8.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm">
            <span className="truncate text-foreground/85">{row.label}</span>
            <span className="h-2 rounded-r-[4px] bg-[rgb(var(--ex-accent))]" style={{ width: `${(row.count / max) * 100}%` }} />
            <span className="text-right tabular-nums text-muted-foreground">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Speed vs accuracy ───────────────────────────────────────────────── */

function SpeedAccuracy({ questions }: { questions: QuestionInsight[] }) {
  const answered = questions
    .filter((q) => (q.outcome === 'correct' || q.outcome === 'incorrect') && q.timeSeconds > 0)
    .sort((a, b) => a.timeSeconds - b.timeSeconds);
  if (answered.length < 4) {
    return <p className="text-sm text-muted-foreground">Answer at least four questions to compare quick and slow ones.</p>;
  }
  const half = Math.floor(answered.length / 2);
  const groups = [
    { label: 'Quicker half', list: answered.slice(0, half) },
    { label: 'Slower half', list: answered.slice(answered.length - half) },
  ].map((group) => {
    const right = group.list.filter((q) => q.outcome === 'correct').length;
    return {
      ...group,
      right,
      pct: Math.round((right / group.list.length) * 100),
      span: `${formatSeconds(group.list[0]!.timeSeconds)}–${formatSeconds(group.list[group.list.length - 1]!.timeSeconds)}`,
    };
  });
  const [quick, slow] = groups as [(typeof groups)[0], (typeof groups)[0]];
  const gap = slow.pct - quick.pct;
  const verdict =
    Math.abs(gap) < 15
      ? 'Speed made little difference to accuracy.'
      : gap > 0
      ? 'You were more accurate when you took your time. The quick answers are worth slowing down on.'
      : 'Your quick answers were the accurate ones. Long stays on a question rarely paid off.';

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-foreground/90">
              {group.label} <span className="text-xs text-muted-foreground">· {group.span} each</span>
            </span>
            <span className="tabular-nums text-muted-foreground">
              <span className="font-display text-xl text-foreground">{group.pct}%</span> right ({group.right}/{group.list.length})
            </span>
          </div>
          <div className="h-2.5 w-full rounded-[4px] bg-white/[0.06]">
            <div className="h-full rounded-r-[4px] bg-[rgb(var(--ex-accent))]" style={{ width: `${Math.max(group.pct, 1)}%` }} />
          </div>
        </div>
      ))}
      <p className="text-sm leading-relaxed text-muted-foreground">{verdict}</p>
    </div>
  );
}

/* ── Focus and tools ─────────────────────────────────────────────────── */

/** Wall-clock stretches with the tab hidden, from the timeline. */
function awayStretches(analysis: InsightsAnalysis) {
  const rows = analysis.timeline as Array<{ at: number; type: string }>;
  const end = rows.length ? rows[rows.length - 1]!.at : 0;
  const stretches: Array<{ from: number; to: number }> = [];
  let hiddenAt: number | null = null;
  for (const row of rows) {
    if (row.type === 'hidden') hiddenAt = row.at;
    else if (hiddenAt !== null && (row.type === 'visible' || row.type === 'resume' || row.type === 'submit')) {
      stretches.push({ from: hiddenAt, to: row.at });
      hiddenAt = null;
    }
  }
  if (hiddenAt !== null) stretches.push({ from: hiddenAt, to: end });
  return { stretches, end };
}

function FocusAndTools({ analysis }: { analysis: InsightsAnalysis }) {
  const { stretches, end } = awayStretches(analysis);
  const span = Math.max(1, end);
  const awayShare = Math.round((analysis.awaySeconds / Math.max(1, analysis.activeSeconds + analysis.awaySeconds)) * 100);
  const struck = analysis.questions.reduce((sum, q) => sum + q.struckOptions, 0);
  const flagged = analysis.questions.filter((q) => q.timesFlagged > 0 || q.flaggedAtEnd).length;
  const tools = [
    { label: 'Calculator', value: analysis.calculatorOpens, unit: 'opened' },
    { label: 'Strike-out', value: struck, unit: struck === 1 ? 'option crossed off' : 'options crossed off' },
    { label: 'Flags', value: flagged, unit: flagged === 1 ? 'question flagged' : 'questions flagged' },
    { label: 'Answer sheet', value: analysis.handInOpens, unit: 'checked before hand-in' },
    { label: 'Clock pause', value: analysis.clockPauses, unit: 'paused' },
    { label: 'Resumed later', value: analysis.resumes, unit: analysis.resumes === 1 ? 'time' : 'times' },
  ];
  const used = tools.filter((tool) => tool.value > 0);
  const unused = tools.filter((tool) => tool.value === 0 && tool.label !== 'Resumed later' && tool.label !== 'Clock pause');

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8">
      <div>
        <p className="text-sm text-foreground/90">
          {analysis.tabSwitches === 0 ? (
            <>You stayed on the paper the whole time.</>
          ) : (
            <>
              <span className="font-display text-3xl tabular-nums tracking-tight">{formatSeconds(analysis.awaySeconds)}</span>
              <span className="ml-2 text-muted-foreground">
                away across {analysis.tabSwitches} {analysis.tabSwitches === 1 ? 'tab switch' : 'tab switches'} ({awayShare}% of
                the sitting)
              </span>
            </>
          )}
        </p>
        <div
          className="relative mt-3 h-6 w-full overflow-hidden rounded-[4px] bg-[rgb(var(--ex-accent)/0.28)]"
          role="img"
          aria-label={`Sitting timeline: ${stretches.length} stretch${stretches.length === 1 ? '' : 'es'} away from the tab.`}
        >
          {stretches.map((stretch, i) => (
            <span
              key={i}
              title={`Away ${clock(stretch.from)}–${clock(stretch.to)} (${formatSeconds(stretch.to - stretch.from)})`}
              className="absolute inset-y-0 border-x-2 border-[#121a30]"
              style={{
                left: `${(stretch.from / span) * 100}%`,
                width: `max(5px, ${((stretch.to - stretch.from) / span) * 100}%)`,
                background: 'repeating-linear-gradient(45deg, #fbbf24 0 3px, rgba(18,26,48,0.6) 3px 5px)',
              }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>0:00</span>
          <span>{clock(span)}</span>
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-[rgb(var(--ex-accent)/0.5)]" />
            On the paper
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{ background: 'repeating-linear-gradient(45deg, #fbbf24 0 2px, rgba(18,26,48,0.6) 2px 3.5px)' }}
            />
            Away from the tab
          </li>
        </ul>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Tools you used</p>
        {used.length === 0 ? (
          <p className="text-sm text-muted-foreground">None. Strike-out and flags help on long papers.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {used.map((tool) => (
              <li key={tool.label} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                <span className="text-foreground/90">{tool.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  <span className="font-display text-lg text-foreground">{tool.value}</span> {tool.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
        {unused.length > 0 && used.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Not used: {unused.map((tool) => tool.label.toLowerCase()).join(', ')}.</p>
        )}
      </div>
    </div>
  );
}

/* ── The page ────────────────────────────────────────────────────────── */

export interface AttemptInsightsProps {
  analysis: InsightsAnalysis;
  /** Plain-language patterns from `attemptPatterns`. */
  patterns: string[];
  runMode: RunMode | null;
  durationMinutes: number | null;
  onBack: () => void;
  onBuildReport: () => InsightsReport;
  onOpenQuestion: (id: string) => void;
}

export function AttemptInsights({
  analysis,
  patterns,
  runMode,
  durationMinutes,
  onBack,
  onBuildReport,
  onOpenQuestion,
}: AttemptInsightsProps) {
  const { questions } = analysis;
  const shifts = useAnswerShifts(questions);
  const seen = questions.filter((q) => q.timeSeconds > 0);
  const longest = seen.reduce<QuestionInsight | null>((a, b) => (!a || b.timeSeconds > a.timeSeconds ? b : a), null);
  const revisited = questions.filter((q) => q.visits > 1).length;
  const budgetSeconds = runMode === 'timed' && durationMinutes ? durationMinutes * 60 : null;
  const slowest = [...seen].sort((a, b) => b.timeSeconds - a.timeSeconds).slice(0, 3);
  const outcomesPresent = (['correct', 'incorrect', 'manual', 'unanswered'] as const).filter((o) =>
    questions.some((q) => q.outcome === o),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/[0.12] px-3 text-sm text-foreground/90 transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Report
          </button>
          <div>
            <h1 className="font-display text-2xl tracking-tight">Insights</h1>
            <p className="text-xs text-muted-foreground">How this sitting went, beyond the score</p>
          </div>
        </div>
        <AnalyseWithAI onBuild={onBuildReport} />
      </div>

      {patterns.length > 0 && (
        <section className="exam-panel rounded-2xl bg-[radial-gradient(70%_140%_at_0%_0%,rgb(var(--ex-accent)/0.12),transparent_60%),#121a30] p-4 backdrop-blur-sm sm:p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-normal tracking-tight">
            <Lightbulb className="h-4 w-4 text-[rgb(var(--ex-accent))]" aria-hidden="true" />
            What stands out
          </h2>
          <ul className="mt-3 grid gap-x-8 gap-y-2 md:grid-cols-2">
            {patterns.map((note) => (
              <li key={note} className="flex gap-2.5 text-sm leading-relaxed text-foreground/90">
                <span aria-hidden="true" className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--ex-accent))]" />
                {note}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!analysis.recorded ? (
        <section className="exam-panel rounded-2xl bg-[#121a30]/85 p-6 text-center backdrop-blur-sm">
          <History className="mx-auto h-6 w-6 text-[rgb(var(--ex-accent))]" aria-hidden="true" />
          <h2 className="mt-3 font-display text-xl tracking-tight">No behaviour recorded for this sitting</h2>
          <p className="mx-auto mt-2 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
            It began before Praxis logged time and movement, or on another device. Start a new run and this page fills
            with time per question, your path through the paper, pace and answer changes. Analyse with AI still sends
            your results and the answer key.
          </p>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
            <StatTile label="Time on questions" value={clock(analysis.activeSeconds)} detail={`${seen.length} of ${questions.length} opened`} />
            <StatTile label="Typical question" value={formatSeconds(median(seen.map((q) => q.timeSeconds)))} detail="median time" />
            <StatTile
              label="Longest"
              value={longest ? formatSeconds(longest.timeSeconds) : '—'}
              detail={longest ? `Q${longest.q} · ${WORD[longest.outcome].toLowerCase()}` : undefined}
            />
            <StatTile label="Revisited" value={String(revisited)} detail={revisited === 1 ? 'question' : 'questions'} />
            <StatTile
              label="Answers changed"
              value={String(shifts.total)}
              detail={shifts.total > 0 ? `${shifts.gained.length} fixed · ${shifts.lost.length} broke` : 'none'}
            />
          </div>

          <Panel
            title="Time on each question"
            Icon={Clock3}
            aside={<Legend items={outcomesPresent.map((outcome) => ({ outcome }))} />}
          >
            <TimePerQuestion
              questions={questions}
              budget={budgetSeconds && questions.length > 0 ? budgetSeconds / questions.length : null}
              onOpen={onOpenQuestion}
            />
            {slowest.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Slowest:{' '}
                {slowest.map((q, i) => (
                  <span key={q.id}>
                    {i > 0 && ', '}
                    <button type="button" onClick={() => onOpenQuestion(q.id)} className="text-foreground/85 underline-offset-2 hover:underline">
                      Q{q.q}
                    </button>{' '}
                    {formatSeconds(q.timeSeconds)} ({WORD[q.outcome].toLowerCase()})
                  </span>
                ))}
                . Click any bar to review that question.
              </p>
            )}
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Your path through the paper" Icon={Route}>
              <p className="-mt-1 mb-3 text-xs text-muted-foreground">
                Each line is time spent on a question; dots mark the first answer. A staircase is working in order; a
                line jumping up is going back.
              </p>
              <JourneyMap analysis={analysis} onOpen={onOpenQuestion} />
            </Panel>
            <Panel title="Pace" Icon={Activity}>
              <PaceChart analysis={analysis} budgetSeconds={budgetSeconds} />
              <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                {analysis.paceByQuarter.map((q) => (
                  <div key={q.quarter} className="rounded-lg border border-white/[0.07] bg-black/15 px-1 py-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Quarter {q.quarter}</p>
                    <p className="font-display text-lg tabular-nums">{q.answered}</p>
                    <p className="text-[10px] tabular-nums text-muted-foreground">answered · {q.correct} right</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Where the time went" Icon={TimerReset}>
              <TimeSplit questions={questions} />
            </Panel>
            <Panel title="Speed and accuracy" Icon={Gauge}>
              <SpeedAccuracy questions={questions} />
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Answer changes" Icon={ArrowLeftRight}>
              {shifts.total === 0 ? (
                <p className="text-sm text-muted-foreground">You didn't change any graded answers.</p>
              ) : (
                <div>
                  <ShiftRow label="Wrong → right" list={shifts.gained} outcome="correct" onOpen={onOpenQuestion} />
                  <ShiftRow label="Right → wrong" list={shifts.lost} outcome="incorrect" onOpen={onOpenQuestion} />
                  <ShiftRow label="Wrong → wrong" list={shifts.churned} outcome="unanswered" onOpen={onOpenQuestion} />
                </div>
              )}
            </Panel>
            <Panel title="How you moved" Icon={Compass}>
              <NavigationBars analysis={analysis} />
            </Panel>
          </div>

          <Panel title="Focus and tools" Icon={Shuffle}>
            <FocusAndTools analysis={analysis} />
          </Panel>
        </>
      )}
    </div>
  );
}
