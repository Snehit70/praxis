import type { QuizQuestion } from '@/lib/dataTransforms';
import {
  describeShortAnswerKey,
  hasMeaningfulAnswer,
  isManualEvalQuestion,
  isPracticeRunQuestionCorrect,
  type PracticeRunReviewState,
  type RunMode,
  type SelectedAnswers,
} from '@/lib/practiceRun';
import type { NavVia, RunEvent } from '@/lib/runActivity';

/**
 * Turns one sitting (answers, grades and the activity log) into a Markdown
 * report written for a person to hand to an AI model: tables to read first and
 * the full data as JSON at the end. Pure, so the same input always gives the
 * same file.
 */

export const INSIGHTS_SCHEMA = 'praxis.attempt-insights/v1';

export interface InsightsPage {
  /** Page id: the question uuid, or the sub-question uuid inside a passage. */
  id: string;
  /** The answerable question on the page (the sub-question for a passage). */
  question: QuizQuestion;
  passage?: { number: number; part: number; parts: number } | null;
  /** The passage itself (its shared text), for passage pages. */
  passageQuestion?: QuizQuestion | null;
}

export interface InsightsInput {
  paper: { name: string; course: string; exam: string; year?: number | null };
  mode: RunMode;
  /** A retry of only the questions missed last time. */
  focusRun: boolean;
  durationMinutes: number | null;
  startedAt: number | null;
  timeUsedSeconds: number | null;
  timeExpired: boolean;
  pages: InsightsPage[];
  answers: SelectedAnswers;
  flaggedIds: string[];
  checkedIds: string[];
  events: RunEvent[];
  generatedAt: number;
}

export type Verdict = 'correct' | 'incorrect' | 'blank' | 'ungraded';

export interface QuestionInsight {
  q: number;
  id: string;
  type: QuizQuestion['questionType'];
  marks: number;
  marksAwarded: number;
  passage: { number: number; part: number; parts: number } | null;
  prompt: string;
  options: string[];
  correctAnswer: string | null;
  finalAnswer: string | null;
  outcome: PracticeRunReviewState;
  timeSeconds: number;
  visits: number;
  /** Seconds into the sitting the question was first on screen. */
  firstSeenAt: number | null;
  /** Seconds spent on this question before its first answer. */
  timeToFirstAnswer: number | null;
  /** Answers entered after the first (a different value each time). */
  answerChanges: number;
  /** Every distinct answer in order, each graded where it can be. */
  answerTrail: Array<{ at: number; answer: string | null; verdict: Verdict }>;
  /** Left without an answer on first visit, answered later. */
  skippedThenReturned: boolean;
  flaggedAtEnd: boolean;
  timesFlagged: number;
  struckOptions: number;
  checked: boolean;
}

const OPTION_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const VIA_LABEL: Record<NavVia, string> = {
  next: 'Next button',
  prev: 'Previous button',
  'arrow-key': 'Arrow keys',
  'enter-key': 'Enter key (practice)',
  'question-grid': 'Question grid',
  'next-unanswered': 'Next unanswered',
  'next-flagged': 'Next flagged',
  'hand-in-sheet': 'Hand-in answer sheet',
  other: 'Other',
};
const TYPE_LABEL: Record<string, string> = {
  MCQ: 'single choice',
  MSQ: 'multiple choice',
  SA: 'short answer',
  OPPE: 'programming',
  COMPREHENSION: 'passage',
};
const MODE_LABEL: Record<RunMode, string> = {
  timed: 'Timed run (exam clock, auto hand-in at 0:00)',
  open: 'Open run (untimed, graded at hand-in)',
  practice: 'Practice run (untimed, each answer checked on demand)',
};

/** HTML or Markdown question text to one plain line. */
export function toPlainText(value: string | undefined, max = 220): string {
  if (!value) return '';
  const text = value
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '[image]')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function questionPrompt(question: QuizQuestion): string {
  const text = [
    question.questionText1,
    question.questionText2,
    question.questionText3,
    question.questionText4,
    question.questionText5,
  ]
    .filter(Boolean)
    .join(' ');
  const plain = toPlainText(text);
  const hasImage = Boolean(question.questionImage1);
  if (!plain) return hasImage ? '[image only]' : '';
  return hasImage ? `${plain} [has image]` : plain;
}

function optionLabel(index: number) {
  return OPTION_LETTERS[index] ?? String(index + 1);
}

/** An answer in words: "B", "A, C", or the typed text. */
export function describeAnswer(question: QuizQuestion, value: string | string[] | undefined): string | null {
  if (!hasMeaningfulAnswer(value)) return null;
  if (Array.isArray(value)) {
    return [...value]
      .map(Number)
      .sort((a, b) => a - b)
      .map(optionLabel)
      .join(', ');
  }
  if (question.questionType === 'SA' || question.options.length === 0) return value!.trim();
  const index = Number(value);
  return Number.isInteger(index) ? optionLabel(index) : value!;
}

function correctAnswer(question: QuizQuestion): string | null {
  if (question.questionType === 'SA') return describeShortAnswerKey(question);
  const letters = question.options.flatMap((option, index) => (option.isCorrect === 1 ? [optionLabel(index)] : []));
  return letters.length > 0 ? letters.join(', ') : null;
}

function verdictFor(question: QuizQuestion, value: string | string[] | undefined): Verdict {
  if (!hasMeaningfulAnswer(value)) return 'blank';
  if (isManualEvalQuestion(question)) return 'ungraded';
  return isPracticeRunQuestionCorrect(question, value) ? 'correct' : 'incorrect';
}

function outcomeFor(question: QuizQuestion, value: string | string[] | undefined): PracticeRunReviewState {
  if (isManualEvalQuestion(question)) return 'manual';
  if (!hasMeaningfulAnswer(value)) return 'unanswered';
  return isPracticeRunQuestionCorrect(question, value) ? 'correct' : 'incorrect';
}

const plural = (count: number, word: string, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;

const round1 = (value: number) => Math.round(value * 10) / 10;
const sameAnswer = (a: string | string[] | undefined, b: string | string[] | undefined) =>
  JSON.stringify(Array.isArray(a) ? [...a].sort() : a ?? null) === JSON.stringify(Array.isArray(b) ? [...b].sort() : b ?? null);

function quantile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (index - lo);
}

export function formatSeconds(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return '—';
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  return h > 0 ? `${h}h ${m}m ${rest}s` : `${m}m ${rest}s`;
}

const cell = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? '—' : String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');

const OUTCOME_WORD: Record<PracticeRunReviewState, string> = {
  correct: 'correct',
  incorrect: 'wrong',
  unanswered: 'skipped',
  manual: 'self-check',
};

export interface InsightsAnalysis {
  questions: QuestionInsight[];
  recorded: boolean;
  activeSeconds: number;
  awaySeconds: number;
  tabSwitches: number;
  resumes: number;
  closedSeconds: number;
  calculatorOpens: number;
  handInOpens: number;
  clockPauses: number;
  submittedAuto: boolean | null;
  navigation: {
    moves: number;
    byVia: Partial<Record<NavVia, number>>;
    forwardSteps: number;
    backwardSteps: number;
    jumpsForward: number;
    jumpsBack: number;
    path: Array<{ q: number; seconds: number; via: NavVia | 'start' | 'resume' }>;
  };
  /** Questions answered in each quarter of the sitting's active time. */
  paceByQuarter: Array<{ quarter: number; answered: number; correct: number }>;
  /** Stretches of active time on one question, in active seconds from the start. */
  journey: Array<{ q: number; from: number; to: number }>;
  /** When each question first got an answer, in active seconds, with its final outcome. */
  firstAnswers: Array<{ q: number; at: number; outcome: PracticeRunReviewState }>;
  timeline: Array<Record<string, unknown>>;
}

/** Walks the activity log and attributes time, visits and answer changes. */
export function analyseAttempt(input: InsightsInput): InsightsAnalysis {
  const pageIndex = new Map(input.pages.map((page, index) => [page.id, index]));
  const flagged = new Set(input.flaggedIds);
  const checked = new Set(input.checkedIds);
  const events = [...input.events].sort((a, b) => a.t - b.t);
  const origin = events[0]?.t ?? input.startedAt ?? input.generatedAt;
  const at = (t: number) => round1((t - origin) / 1000);

  const time = new Map<string, number>();
  const visits = new Map<string, number>();
  const firstSeen = new Map<string, number>();
  const timeBeforeAnswer = new Map<string, number>();
  const trail = new Map<string, Array<{ at: number; value: string | string[] | undefined }>>();
  const flagCount = new Map<string, number>();
  const struck = new Map<string, Set<string>>();
  const leftBlankOnFirstVisit = new Set<string>();
  const firstAnswerActive = new Map<string, number>();

  let current: string | null = null;
  let since: number | null = null;
  let hiddenAt: number | null = null;
  let lastEndAt: number | null = null;
  let active = 0;
  let away = 0;
  let closed = 0;
  let tabSwitches = 0;
  let resumes = 0;
  let calculatorOpens = 0;
  let handInOpens = 0;
  let clockPauses = 0;
  let submittedAuto: boolean | null = null;
  const byVia: Partial<Record<NavVia, number>> = {};
  let forwardSteps = 0;
  let backwardSteps = 0;
  let jumpsForward = 0;
  let jumpsBack = 0;
  const path: InsightsAnalysis['navigation']['path'] = [];
  const answerMoments: Array<{ active: number; id: string }> = [];
  const journey: Array<{ q: number; from: number; to: number }> = [];

  const credit = (until: number) => {
    if (current === null || since === null) return;
    const seconds = Math.max(0, (until - since) / 1000);
    const q = pageIndex.get(current)! + 1;
    const last = journey[journey.length - 1];
    if (last && last.q === q && Math.abs(last.to - active) < 1e-6) last.to = active + seconds;
    else if (seconds > 0) journey.push({ q, from: active, to: active + seconds });
    time.set(current, (time.get(current) ?? 0) + seconds);
    active += seconds;
    if (path.length > 0) path[path.length - 1]!.seconds += seconds;
    if (!firstAnswerActive.has(current)) {
      timeBeforeAnswer.set(current, (timeBeforeAnswer.get(current) ?? 0) + seconds);
    }
    since = until;
  };
  const enter = (page: string, t: number, via: NavVia | 'start' | 'resume') => {
    if (!pageIndex.has(page)) {
      current = null;
      return;
    }
    if (current !== null && current !== page && !firstAnswerActive.has(current) && visits.get(current) === 1) {
      leftBlankOnFirstVisit.add(current);
    }
    current = page;
    since = t;
    visits.set(page, (visits.get(page) ?? 0) + 1);
    if (!firstSeen.has(page)) firstSeen.set(page, at(t));
    path.push({ q: pageIndex.get(page)! + 1, seconds: 0, via });
  };

  let prevT: number | null = null;
  for (const event of events) {
    switch (event.type) {
      case 'start':
        enter(event.page, event.t, 'start');
        break;
      case 'resume': {
        // A reload with no hidden boundary saved: stop at the last recorded
        // action instead of crediting the closed stretch to that question.
        credit(hiddenAt ?? prevT ?? event.t);
        const gapFrom = hiddenAt ?? lastEndAt ?? prevT;
        if (gapFrom !== null) closed += Math.max(0, (event.t - gapFrom) / 1000);
        hiddenAt = null;
        resumes += 1;
        if (current === event.page) since = event.t;
        else enter(event.page, event.t, 'resume');
        break;
      }
      case 'visit': {
        credit(event.t);
        const from = current !== null ? pageIndex.get(current) : undefined;
        const to = pageIndex.get(event.page);
        if (from !== undefined && to !== undefined && from !== to) {
          byVia[event.via] = (byVia[event.via] ?? 0) + 1;
          if (to === from + 1) forwardSteps += 1;
          else if (to === from - 1) backwardSteps += 1;
          else if (to > from) jumpsForward += 1;
          else jumpsBack += 1;
        }
        enter(event.page, event.t, event.via);
        if (hiddenAt !== null) since = null;
        break;
      }
      case 'answer':
      case 'clear': {
        if (!pageIndex.has(event.page)) break;
        credit(event.t);
        const value = event.type === 'answer' ? event.value : undefined;
        const list = trail.get(event.page) ?? [];
        if (list.length === 0 || !sameAnswer(list[list.length - 1]!.value, value)) {
          list.push({ at: at(event.t), value });
          trail.set(event.page, list);
        }
        if (event.type === 'answer' && !firstAnswerActive.has(event.page)) {
          firstAnswerActive.set(event.page, active);
          answerMoments.push({ active, id: event.page });
        }
        break;
      }
      case 'flag':
        if (event.on) flagCount.set(event.page, (flagCount.get(event.page) ?? 0) + 1);
        break;
      case 'strike': {
        if (!event.on) break;
        const set = struck.get(event.page) ?? new Set<string>();
        set.add(event.option);
        struck.set(event.page, set);
        break;
      }
      case 'calculator':
        if (event.on) calculatorOpens += 1;
        break;
      case 'handin-open':
        handInOpens += 1;
        break;
      case 'clock':
        if (!event.running) clockPauses += 1;
        break;
      case 'hidden':
        credit(event.t);
        since = null;
        hiddenAt = event.t;
        tabSwitches += 1;
        break;
      case 'visible':
        if (hiddenAt !== null) away += Math.max(0, (event.t - hiddenAt) / 1000);
        hiddenAt = null;
        if (current !== null) since = event.t;
        break;
      case 'submit':
        credit(event.t);
        current = null;
        since = null;
        submittedAuto = event.auto;
        lastEndAt = event.t;
        break;
      case 'check':
        break;
    }
    prevT = event.t;
  }

  const questions: QuestionInsight[] = input.pages.map((page, index) => {
    const question = page.question;
    const finalValue = input.answers[page.id];
    const outcome = outcomeFor(question, finalValue);
    const marks = parseFloat(question.totalMark) || 0;
    const answers = trail.get(page.id) ?? [];
    const entered = answers.filter((step) => hasMeaningfulAnswer(step.value)).length;
    const firstAnswer = firstAnswerActive.has(page.id) ? timeBeforeAnswer.get(page.id) ?? 0 : null;
    return {
      q: index + 1,
      id: page.id,
      type: question.questionType,
      marks: outcome === 'manual' ? 0 : marks,
      marksAwarded: outcome === 'correct' ? marks : 0,
      passage: page.passage ?? null,
      prompt: questionPrompt(question),
      options: question.options.map(
        (option, i) => `${optionLabel(i)}. ${toPlainText(option.optionText, 120) || (option.optionImage ? '[image]' : '')}`,
      ),
      correctAnswer: correctAnswer(question),
      finalAnswer: describeAnswer(question, finalValue),
      outcome,
      timeSeconds: round1(time.get(page.id) ?? 0),
      visits: visits.get(page.id) ?? 0,
      firstSeenAt: firstSeen.get(page.id) ?? null,
      timeToFirstAnswer: firstAnswer === null ? null : round1(firstAnswer),
      answerChanges: Math.max(0, entered - 1),
      answerTrail: answers.map((step) => ({
        at: step.at,
        answer: describeAnswer(question, step.value),
        verdict: verdictFor(question, step.value),
      })),
      skippedThenReturned: leftBlankOnFirstVisit.has(page.id) && firstAnswerActive.has(page.id),
      flaggedAtEnd: flagged.has(page.id),
      timesFlagged: flagCount.get(page.id) ?? 0,
      struckOptions: struck.get(page.id)?.size ?? 0,
      checked: checked.has(page.id),
    };
  });

  const outcomeById = new Map(questions.map((row) => [row.id, row.outcome]));
  const paceByQuarter = [1, 2, 3, 4].map((quarter) => {
    const lo = (active * (quarter - 1)) / 4;
    const hi = (active * quarter) / 4;
    const inRange = answerMoments.filter((m) => m.active >= lo && (quarter === 4 ? m.active <= hi : m.active < hi));
    return {
      quarter,
      answered: inRange.length,
      correct: inRange.filter((m) => outcomeById.get(m.id) === 'correct').length,
    };
  });

  const timeline = events.map((event) => {
    const { t, type, ...rest } = event;
    const row: Record<string, unknown> = { at: at(t), type };
    if ('page' in rest) {
      const index = pageIndex.get(rest.page);
      row.q = index === undefined ? null : index + 1;
      delete (rest as { page?: string }).page;
    }
    if (type === 'answer' && 'value' in rest) {
      const index = pageIndex.get(event.page as string);
      const question = index === undefined ? null : input.pages[index]!.question;
      row.answer = question ? describeAnswer(question, rest.value as string | string[]) : rest.value;
      delete (rest as { value?: unknown }).value;
    }
    if (type === 'strike' && 'option' in rest) {
      row.option = optionLabel(Number(rest.option));
      delete (rest as { option?: string }).option;
    }
    return { ...row, ...rest };
  });

  return {
    questions,
    recorded: events.length > 0,
    activeSeconds: round1(active),
    awaySeconds: round1(away),
    tabSwitches,
    resumes,
    closedSeconds: round1(closed),
    calculatorOpens,
    handInOpens,
    clockPauses,
    submittedAuto,
    navigation: {
      moves: forwardSteps + backwardSteps + jumpsForward + jumpsBack,
      byVia,
      forwardSteps,
      backwardSteps,
      jumpsForward,
      jumpsBack,
      path: path.map((step) => ({ ...step, seconds: round1(step.seconds) })),
    },
    paceByQuarter,
    journey: journey.map((stretch) => ({ q: stretch.q, from: round1(stretch.from), to: round1(stretch.to) })),
    firstAnswers: answerMoments.map((m) => ({
      q: pageIndex.get(m.id)! + 1,
      at: round1(m.active),
      outcome: outcomeById.get(m.id) ?? 'unanswered',
    })),
    timeline,
  };
}

function statsLine(values: number[]) {
  if (values.length === 0) return '—';
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  return `mean ${formatSeconds(mean)}, median ${formatSeconds(quantile(sorted, 0.5))}, n=${sorted.length}`;
}

/** Plain-language patterns worth a closer look; facts, not judgements. */
export function attemptPatterns(a: InsightsAnalysis, input: InsightsInput): string[] {
  const notes: string[] = [];
  const qs = a.questions;
  const gradedQs = qs.filter((q) => q.outcome !== 'manual');
  const answered = gradedQs.filter((q) => q.outcome === 'correct' || q.outcome === 'incorrect');

  if (a.recorded && a.activeSeconds > 0) {
    const sorted = [...qs].sort((x, y) => y.timeSeconds - x.timeSeconds);
    const top = sorted.slice(0, Math.max(1, Math.ceil(qs.length * 0.2)));
    const share = top.reduce((sum, q) => sum + q.timeSeconds, 0) / a.activeSeconds;
    if (qs.length >= 5 && share >= 0.4) {
      notes.push(
        `${Math.round(share * 100)}% of active time went to ${top.length} question${top.length === 1 ? '' : 's'} (${top.map((q) => `Q${q.q}`).join(', ')}).`,
      );
    }
    const quick = answered.filter((q) => q.timeSeconds < 15);
    const quickWrong = quick.filter((q) => q.outcome === 'incorrect');
    if (quickWrong.length >= 2) {
      notes.push(
        `${quickWrong.length} of ${quick.length} answers given in under 15 seconds were wrong (${quickWrong.map((q) => `Q${q.q}`).join(', ')}), which can point to guessing or misreading.`,
      );
    }
    const correctTimes = answered.filter((q) => q.outcome === 'correct').map((q) => q.timeSeconds);
    const wrongTimes = answered.filter((q) => q.outcome === 'incorrect').map((q) => q.timeSeconds);
    if (correctTimes.length >= 2 && wrongTimes.length >= 2) {
      const median = (v: number[]) => quantile([...v].sort((x, y) => x - y), 0.5);
      const c = median(correctTimes);
      const w = median(wrongTimes);
      if (w > c * 1.5) notes.push(`Wrong answers took longer than right ones (median ${formatSeconds(w)} vs ${formatSeconds(c)}): the misses were questions that caused struggle, not careless slips.`);
      else if (w < c * 0.67) notes.push(`Wrong answers were quicker than right ones (median ${formatSeconds(w)} vs ${formatSeconds(c)}): the misses look rushed.`);
    }
    const toWrong = qs.filter((q) => {
      const t = q.answerTrail.filter((s) => s.verdict !== 'blank');
      return t.length > 1 && t.some((s) => s.verdict === 'correct') && t[t.length - 1]!.verdict === 'incorrect';
    });
    if (toWrong.length > 0) {
      notes.push(`Changed a right answer to a wrong one on ${toWrong.map((q) => `Q${q.q}`).join(', ')}.`);
    }
    const toRight = qs.filter((q) => {
      const t = q.answerTrail.filter((s) => s.verdict !== 'blank');
      return t.length > 1 && t[0]!.verdict === 'incorrect' && t[t.length - 1]!.verdict === 'correct';
    });
    if (toRight.length > 0) {
      notes.push(`Corrected a wrong first answer on ${toRight.map((q) => `Q${q.q}`).join(', ')}.`);
    }
    const never = qs.filter((q) => q.visits === 0);
    if (never.length > 0) notes.push(`${never.length} question${never.length === 1 ? ' was' : 's were'} never opened (${never.map((q) => `Q${q.q}`).join(', ')}).`);
    const seenBlank = qs.filter((q) => q.visits > 0 && q.outcome === 'unanswered');
    if (seenBlank.length > 0) notes.push(`${seenBlank.length} question${seenBlank.length === 1 ? ' was' : 's were'} opened but left blank (${seenBlank.map((q) => `Q${q.q} after ${formatSeconds(q.timeSeconds)}`).join(', ')}).`);
    const flaggedLeft = qs.filter((q) => q.flaggedAtEnd);
    if (flaggedLeft.length > 0) {
      const right = flaggedLeft.filter((q) => q.outcome === 'correct').length;
      notes.push(`${flaggedLeft.length} question${flaggedLeft.length === 1 ? ' was' : 's were'} still flagged at hand-in; ${right} of them turned out correct.`);
    }
    const lastQuarter = a.paceByQuarter[3];
    const firstHalf = a.paceByQuarter.slice(0, 2).reduce((s, p) => s + p.answered, 0);
    if (lastQuarter && firstHalf > 0 && lastQuarter.answered > firstHalf) {
      notes.push(`More questions were first answered in the last quarter of the sitting (${lastQuarter.answered}) than in the whole first half (${firstHalf}): a late rush.`);
    }
    if (a.tabSwitches >= 3) notes.push(`Left the tab ${a.tabSwitches} times, away ${formatSeconds(a.awaySeconds)} in total.`);
    if (a.submittedAuto) notes.push('The clock ran out: the paper was handed in automatically.');
  }

  const byType = new Map<string, { right: number; total: number }>();
  gradedQs.forEach((q) => {
    const entry = byType.get(q.type) ?? { right: 0, total: 0 };
    entry.total += 1;
    if (q.outcome === 'correct') entry.right += 1;
    byType.set(q.type, entry);
  });
  if (byType.size > 1) {
    const ranked = [...byType].filter(([, v]) => v.total >= 2).sort(([, x], [, y]) => x.right / x.total - y.right / y.total);
    const weakest = ranked[0];
    if (weakest && weakest[1].right / weakest[1].total < 0.5) {
      notes.push(`Weakest question type: ${TYPE_LABEL[weakest[0]] ?? weakest[0]} (${weakest[1].right}/${weakest[1].total} correct).`);
    }
  }
  if (input.mode === 'practice' && input.checkedIds.length > 0) {
    notes.push(`Practice run: ${input.checkedIds.length} answer${input.checkedIds.length === 1 ? ' was' : 's were'} checked one by one, so later answers may have been informed by earlier feedback.`);
  }
  return notes;
}

/** The Markdown file itself. */
export function buildAttemptInsightsMarkdown(input: InsightsInput): string {
  const a = analyseAttempt(input);
  const qs = a.questions;
  const gradable = qs.filter((q) => q.outcome !== 'manual');
  const correct = gradable.filter((q) => q.outcome === 'correct').length;
  const wrong = gradable.filter((q) => q.outcome === 'incorrect').length;
  const skipped = gradable.filter((q) => q.outcome === 'unanswered').length;
  const manual = qs.length - gradable.length;
  const maxMarks = qs.reduce((sum, q) => sum + q.marks, 0);
  const scored = qs.reduce((sum, q) => sum + q.marksAwarded, 0);
  const attempted = correct + wrong;
  const generated = new Date(input.generatedAt).toISOString();
  const started = input.startedAt ? new Date(input.startedAt).toISOString() : null;
  const title = [input.paper.course, input.paper.name].filter(Boolean).join(' · ');

  const lines: string[] = [];
  const push = (...rows: string[]) => lines.push(...rows);

  push(
    `# Praxis attempt report: ${title || 'Exam paper'}`,
    '',
    '> **For the AI reading this:** this file records one sitting of a past exam paper on Praxis, an exam-practice site for the IITM BS degree. It covers what the student answered, how long each question took, how they moved around the paper and when they changed answers. Find patterns in their exam technique and knowledge gaps, name the specific questions involved, and give concrete advice for the next attempt. Times are in seconds of active, on-screen time unless noted. Section 9 has every number as JSON.',
    '',
    '**Questions you could ask the AI:**',
    '',
    '- Where did my time go, and was it well spent?',
    '- Which mistakes look like knowledge gaps, and which look like rushing or second-guessing?',
    '- How should I change the order I work through the paper?',
    '- Give me a study plan for the topics behind my wrong answers.',
    '',
    '## 1. Overview',
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Paper | ${cell(input.paper.name)} |`,
    `| Course | ${cell(input.paper.course)} |`,
    `| Exam | ${cell(input.paper.exam)} |`,
    `| Mode | ${MODE_LABEL[input.mode]}${input.focusRun ? ', retry of previously missed questions only' : ''} |`,
    `| Exam duration | ${input.durationMinutes ? `${input.durationMinutes} min` : '—'} |`,
    `| Started | ${cell(started)} |`,
    `| Time used | ${formatSeconds(input.timeUsedSeconds)}${input.timeExpired ? ' (clock ran out)' : ''} |`,
    `| Active time on questions | ${a.recorded ? formatSeconds(a.activeSeconds) : 'not recorded'} |`,
    `| Score | ${maxMarks > 0 ? `${round1(scored)} / ${round1(maxMarks)} marks (${Math.round((scored / maxMarks) * 100)}%)` : `${correct} / ${gradable.length} correct`} |`,
    `| Questions | ${qs.length}: ${correct} correct, ${wrong} wrong, ${skipped} skipped${manual > 0 ? `, ${manual} self-check (not auto-graded)` : ''} |`,
    `| Accuracy on attempted | ${attempted > 0 ? `${Math.round((correct / attempted) * 100)}% (${correct}/${attempted})` : '—'} |`,
    `| Report generated | ${generated} |`,
    '',
  );

  if (!a.recorded) {
    push(
      '> Activity was not recorded for this sitting (it began before Praxis logged behaviour, or on another device), so time, navigation and answer-change data are missing. Results are complete.',
      '',
    );
  }

  push(
    '## 2. Question by question',
    '',
    '| Q | Type | Marks | Result | Your answer | Correct answer | Time | Visits | Time to first answer | Changes | Flagged |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...qs.map((q) =>
      `| ${q.q}${q.passage ? ` (passage ${q.passage.number}.${q.passage.part + 1})` : ''} | ${TYPE_LABEL[q.type] ?? q.type} | ${round1(q.marksAwarded)}/${round1(q.marks)} | ${OUTCOME_WORD[q.outcome]} | ${cell(q.finalAnswer)} | ${cell(q.correctAnswer)} | ${a.recorded ? formatSeconds(q.timeSeconds) : '—'} | ${a.recorded ? q.visits : '—'} | ${a.recorded ? formatSeconds(q.timeToFirstAnswer) : '—'} | ${a.recorded ? q.answerChanges : '—'} | ${q.flaggedAtEnd ? 'yes' : q.timesFlagged > 0 ? 'cleared' : ''} |`,
    ),
    '',
  );

  if (a.recorded) {
    const times = qs.filter((q) => q.visits > 0).map((q) => q.timeSeconds);
    const sorted = [...times].sort((x, y) => x - y);
    const byOutcome = (outcome: PracticeRunReviewState) => qs.filter((q) => q.outcome === outcome && q.visits > 0).map((q) => q.timeSeconds);
    const types = [...new Set(qs.map((q) => q.type))];
    const longest = [...qs].sort((x, y) => y.timeSeconds - x.timeSeconds).slice(0, 5);
    const shortest = [...qs].filter((q) => q.finalAnswer !== null).sort((x, y) => x.timeSeconds - y.timeSeconds).slice(0, 5);

    push(
      '## 3. Time',
      '',
      `- Per question: ${statsLine(times)}, 90th percentile ${formatSeconds(quantile(sorted, 0.9))}.`,
      `- Correct: ${statsLine(byOutcome('correct'))}.`,
      `- Wrong: ${statsLine(byOutcome('incorrect'))}.`,
      `- Skipped: ${statsLine(byOutcome('unanswered'))}.`,
      ...types.map((type) => `- ${TYPE_LABEL[type] ?? type}: ${statsLine(qs.filter((q) => q.type === type && q.visits > 0).map((q) => q.timeSeconds))}.`),
      `- Longest: ${longest.map((q) => `Q${q.q} ${formatSeconds(q.timeSeconds)} (${OUTCOME_WORD[q.outcome]})`).join(', ')}.`,
      `- Quickest answered: ${shortest.map((q) => `Q${q.q} ${formatSeconds(q.timeSeconds)} (${OUTCOME_WORD[q.outcome]})`).join(', ') || '—'}.`,
      '',
      'First answers by quarter of the active time:',
      '',
      '| Quarter | First answers | Of those correct |',
      '| --- | --- | --- |',
      ...a.paceByQuarter.map((p) => `| ${p.quarter} | ${p.answered} | ${p.answered > 0 ? p.correct : '—'} |`),
      '',
    );

    const nav = a.navigation;
    const revisited = qs.filter((q) => q.visits > 1);
    const skippedThenBack = qs.filter((q) => q.skippedThenReturned);
    const order = [...qs].filter((q) => q.firstSeenAt !== null).sort((x, y) => x.firstSeenAt! - y.firstSeenAt!);
    const inOrder = order.every((q, i) => i === 0 || q.q > order[i - 1]!.q);
    const pathText = nav.path.slice(0, 400).map((step) => `Q${step.q} (${formatSeconds(step.seconds)})`).join(' → ');
    push(
      '## 4. Navigation',
      '',
      `- ${plural(nav.moves, 'move')} between questions: ${nav.forwardSteps} to the next one, ${nav.backwardSteps} to the previous one, ${plural(nav.jumpsForward, 'jump')} ahead, ${plural(nav.jumpsBack, 'jump')} back.`,
      `- How they moved: ${Object.entries(nav.byVia).sort(([, x], [, y]) => (y ?? 0) - (x ?? 0)).map(([via, count]) => `${VIA_LABEL[via as NavVia]} ${count}`).join(', ') || '—'}.`,
      `- First opened the questions ${inOrder ? 'in paper order' : 'out of paper order'}. ${qs.filter((q) => q.visits === 0).length} never opened.`,
      `- Revisited ${plural(revisited.length, 'question')}${revisited.length > 0 ? `: ${revisited.map((q) => `Q${q.q}×${q.visits}`).join(', ')}` : ''}.`,
      `- Left blank on first visit and answered later: ${skippedThenBack.map((q) => `Q${q.q}`).join(', ') || 'none'}.`,
      '',
      'Path through the paper (time on each stop):',
      '',
      `${pathText || '—'}${nav.path.length > 400 ? ` … (${nav.path.length - 400} more stops in the JSON)` : ''}`,
      '',
    );

    const changed = qs.filter((q) => q.answerChanges > 0);
    const graded = (q: QuestionInsight) => q.answerTrail.filter((s) => s.verdict !== 'blank');
    const wrongToRight = changed.filter((q) => graded(q)[0]?.verdict === 'incorrect' && graded(q).at(-1)?.verdict === 'correct');
    const rightToWrong = changed.filter((q) => graded(q)[0]?.verdict === 'correct' && graded(q).at(-1)?.verdict === 'incorrect');
    const wrongToWrong = changed.filter((q) => graded(q)[0]?.verdict === 'incorrect' && graded(q).at(-1)?.verdict === 'incorrect');
    push(
      '## 5. Answer changes',
      '',
      `- ${plural(changed.reduce((sum, q) => sum + q.answerChanges, 0), 'change')} across ${plural(changed.length, 'question')}.`,
      `- Wrong → right: ${wrongToRight.length}. Right → wrong: ${rightToWrong.length}. Wrong → still wrong: ${wrongToWrong.length}.`,
      `- Answers cleared: ${qs.reduce((sum, q) => sum + q.answerTrail.filter((s) => s.answer === null).length, 0)}.`,
      '',
      ...(changed.length > 0
        ? [
            ...changed.map(
              (q) => `- Q${q.q}: ${q.answerTrail.map((s) => `${s.answer ?? '(cleared)'}${s.verdict === 'correct' ? ' ✓' : s.verdict === 'incorrect' ? ' ✗' : ''}`).join(' → ')}`,
            ),
            '',
          ]
        : []),
    );

    const struckTotal = qs.reduce((sum, q) => sum + q.struckOptions, 0);
    const flagSets = qs.reduce((sum, q) => sum + q.timesFlagged, 0);
    push(
      '## 6. Focus and tools',
      '',
      `- Left the tab or window ${a.tabSwitches} time${a.tabSwitches === 1 ? '' : 's'}, away ${formatSeconds(a.awaySeconds)} in total.`,
      `- Closed and came back ${a.resumes} time${a.resumes === 1 ? '' : 's'}${a.closedSeconds > 0 ? ` (${formatSeconds(a.closedSeconds)} away)` : ''}.`,
      `- Flags set ${flagSets} time${flagSets === 1 ? '' : 's'}; ${qs.filter((q) => q.flaggedAtEnd).length} still flagged at hand-in.`,
      `- Struck out ${struckTotal} option${struckTotal === 1 ? '' : 's'} on ${qs.filter((q) => q.struckOptions > 0).length} question${qs.filter((q) => q.struckOptions > 0).length === 1 ? '' : 's'}.`,
      `- Calculator opened ${a.calculatorOpens} time${a.calculatorOpens === 1 ? '' : 's'}.`,
      `- Hand-in sheet opened ${a.handInOpens} time${a.handInOpens === 1 ? '' : 's'}.`,
      ...(input.mode === 'timed' ? [`- Clock paused ${a.clockPauses} time${a.clockPauses === 1 ? '' : 's'}.`] : []),
      `- Handed in: ${a.submittedAuto === null ? '—' : a.submittedAuto ? 'automatically when the clock ran out' : 'by the student'}.`,
      '',
    );
  }

  const notes = attemptPatterns(a, input);
  push('## 7. Patterns spotted', '', ...(notes.length > 0 ? notes.map((note) => `- ${note}`) : ['- Nothing stood out.']), '');

  push(
    '## 8. Questions in full',
    '',
    'Question text is shortened. Images are not included.',
    '',
    ...qs.flatMap((q, index) => {
      const page = input.pages[index];
      const passageIntro =
        page?.passage && page.passage.part === 0 && page.passageQuestion
          ? [`**Passage ${page.passage.number}** (Q${q.q}–Q${q.q + page.passage.parts - 1}): ${toPlainText(
              [page.passageQuestion.questionText1, page.passageQuestion.questionText2].filter(Boolean).join(' '),
              600,
            ) || '—'}`, '']
          : [];
      return [
        ...passageIntro,
        `**Q${q.q}** · ${TYPE_LABEL[q.type] ?? q.type} · ${OUTCOME_WORD[q.outcome]} · ${round1(q.marksAwarded)}/${round1(q.marks)} marks`,
        '',
        q.prompt || '—',
        '',
        ...(q.options.length > 0 ? [`- Options: ${q.options.join(' | ')}`] : []),
        `- Answered: ${q.finalAnswer ?? '—'}`,
        `- Correct: ${q.correctAnswer ?? '—'}`,
        '',
      ];
    }),
  );

  const data = {
    schema: INSIGHTS_SCHEMA,
    generatedAt: generated,
    paper: input.paper,
    run: {
      mode: input.mode,
      focusRun: input.focusRun,
      durationMinutes: input.durationMinutes,
      startedAt: started,
      timeUsedSeconds: input.timeUsedSeconds,
      timeExpired: input.timeExpired,
      activityRecorded: a.recorded,
    },
    summary: {
      questions: qs.length,
      correct,
      incorrect: wrong,
      skipped,
      selfCheck: manual,
      marks: round1(scored),
      maxMarks: round1(maxMarks),
      activeSeconds: a.activeSeconds,
      awaySeconds: a.awaySeconds,
      tabSwitches: a.tabSwitches,
      resumes: a.resumes,
      calculatorOpens: a.calculatorOpens,
      handInSheetOpens: a.handInOpens,
      clockPauses: a.clockPauses,
      submittedAutomatically: a.submittedAuto,
    },
    navigation: a.navigation,
    paceByQuarter: a.paceByQuarter,
    questions: qs,
    timeline: a.timeline,
  };

  push(
    '## 9. Raw data (JSON)',
    '',
    `Schema \`${INSIGHTS_SCHEMA}\`. \`at\` is seconds since the first event; \`q\` is the question number above.`,
    '',
    '```json',
    JSON.stringify(data, null, 2),
    '```',
    '',
  );

  return lines.join('\n');
}

/** "praxis-insights-ct-quiz-1-2026-11-23.md" */
export function insightsFileName(paperName: string, generatedAt: number) {
  const slug = paperName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const date = new Date(generatedAt).toISOString().slice(0, 10);
  return `praxis-insights-${slug || 'paper'}-${date}.md`;
}
