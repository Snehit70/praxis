import { expect, test } from 'bun:test';
import type { QuizQuestion } from '@/lib/dataTransforms';
import {
  analyseAttempt,
  buildAttemptInsightsMarkdown,
  insightsFileName,
  lastSitting,
  toPlainText,
  type InsightsInput,
} from '@/lib/attemptInsights';
import { appendRunEvent, diffRunSnapshots, parseRunEvents, type RunEvent, type RunSnapshot } from '@/lib/runActivity';
import { parseSavedPracticeRunSession } from '@/lib/practiceRun';

function mcq(uuid: string, correctIndex = 0): QuizQuestion {
  return {
    uuid,
    questionNumber: 1,
    questionType: 'MCQ',
    totalMark: '2',
    hash: uuid,
    isMarkdown: 0,
    haveAnswers: 1,
    questionNumLong: 1,
    questionText1: `<p>What is <b>${uuid}</b>?</p>`,
    options: ['Alpha', 'Beta', 'Gamma'].map((text, index) => ({
      optionText: text,
      score: index === correctIndex ? '2' : '0',
      isCorrect: index === correctIndex ? 1 : 0,
    })),
  };
}

const T0 = 1_700_000_000_000;
const s = (seconds: number) => T0 + seconds * 1000;

function input(events: RunEvent[], answers: InsightsInput['answers']): InsightsInput {
  return {
    paper: { name: 'Quiz 1', course: 'Maths 1', exam: 'Quiz 1', year: 2025 },
    mode: 'open',
    focusRun: false,
    durationMinutes: 60,
    startedAt: T0,
    timeUsedSeconds: 200,
    timeExpired: false,
    pages: [{ id: 'q1', question: mcq('q1') }, { id: 'q2', question: mcq('q2', 1) }, { id: 'q3', question: mcq('q3', 1) }],
    answers,
    flaggedIds: ['q2'],
    checkedIds: [],
    events,
    generatedAt: s(300),
  };
}

const sitting: RunEvent[] = [
  { t: s(0), type: 'start', mode: 'open', page: 'q1' },
  { t: s(20), type: 'answer', page: 'q1', value: '0' },
  { t: s(30), type: 'visit', page: 'q2', via: 'next' },
  { t: s(35), type: 'flag', page: 'q2', on: true },
  { t: s(40), type: 'visit', page: 'q3', via: 'next' },
  { t: s(50), type: 'hidden' },
  { t: s(110), type: 'visible' },
  { t: s(115), type: 'answer', page: 'q3', value: '1' },
  { t: s(120), type: 'visit', page: 'q1', via: 'question-grid' },
  { t: s(130), type: 'answer', page: 'q1', value: '2' },
  { t: s(140), type: 'submit', auto: false },
];

test('time is credited to the question on screen and pauses while the tab is hidden', () => {
  const a = analyseAttempt(input(sitting, { q1: '2', q3: '1' }));
  const [q1, q2, q3] = a.questions;
  expect(q1!.timeSeconds).toBe(50); // 0–30 and 120–140
  expect(q2!.timeSeconds).toBe(10);
  expect(q3!.timeSeconds).toBe(20); // 40–50 and 110–120; the minute away is not counted
  expect(a.activeSeconds).toBe(80);
  expect(a.awaySeconds).toBe(60);
  expect(a.tabSwitches).toBe(1);
  expect(q1!.visits).toBe(2);
  expect(q3!.timeToFirstAnswer).toBe(15);
});

test('navigation separates steps from jumps and counts how the user moved', () => {
  const nav = analyseAttempt(input(sitting, {})).navigation;
  expect(nav.forwardSteps).toBe(2);
  expect(nav.jumpsBack).toBe(1);
  expect(nav.byVia).toEqual({ next: 2, 'question-grid': 1 });
  expect(nav.path.map((step) => step.q)).toEqual([1, 2, 3, 1]);
});

test('answer trails grade each change, so right-to-wrong shows up', () => {
  const a = analyseAttempt(input(sitting, { q1: '2', q3: '1' }));
  const q1 = a.questions[0]!;
  expect(q1.answerChanges).toBe(1);
  expect(q1.answerTrail.map((step) => [step.answer, step.verdict])).toEqual([
    ['A', 'correct'],
    ['C', 'incorrect'],
  ]);
  expect(q1.outcome).toBe('incorrect');
  expect(a.questions[1]!.outcome).toBe('unanswered');
  expect(a.questions[1]!.flaggedAtEnd).toBe(true);
});

test('the Markdown report has the tables, the patterns and parseable JSON', () => {
  const md = buildAttemptInsightsMarkdown(input(sitting, { q1: '2', q3: '1' }));
  expect(md).toContain('# Praxis attempt report: Maths 1 · Quiz 1');
  expect(md).toContain('## 2. Question by question');
  expect(md).toContain('| 1 | single choice | 0/2 | wrong | C | A | 50s | 2 | 20s | 1 |  |');
  expect(md).toContain('Changed a right answer to a wrong one on Q1.');
  expect(md).toContain('Q1 (30s) → Q2 (10s) → Q3 (20s) → Q1 (20s)');
  const json = md.slice(md.indexOf('```json') + 7, md.lastIndexOf('```'));
  const data = JSON.parse(json);
  expect(data.schema).toBe('praxis.attempt-insights/v1');
  expect(data.summary).toMatchObject({ correct: 1, incorrect: 1, skipped: 1, marks: 2, maxMarks: 6 });
  expect(data.timeline[1]).toEqual({ at: 20, type: 'answer', q: 1, answer: 'A' });
});

test('a sitting without an activity log still reports results', () => {
  const md = buildAttemptInsightsMarkdown(input([], { q1: '0' }));
  expect(md).toContain('Activity was not recorded');
  expect(md).not.toContain('## 3. Time');
  expect(md).toContain('| 1 | single choice | 2/2 | correct | A | A | — |');
});

test('typing into one box merges into a single answer event', () => {
  let log: RunEvent[] = [];
  log = appendRunEvent(log, { t: s(0), type: 'answer', page: 'q1', value: '4' });
  log = appendRunEvent(log, { t: s(1), type: 'answer', page: 'q1', value: '42' });
  log = appendRunEvent(log, { t: s(10), type: 'answer', page: 'q1', value: '420' });
  expect(log.map((event) => (event.type === 'answer' ? event.value : null))).toEqual(['42', '420']);
});

test('snapshot diffs name every change between renders', () => {
  const base: RunSnapshot = {
    pageIds: ['q1', 'q2'],
    index: 0,
    answers: { q1: '0' },
    flagged: new Set(),
    checked: new Set(),
    eliminated: {},
    calcOpen: false,
    handInOpen: false,
    clockRunning: true,
  };
  const next: RunSnapshot = {
    ...base,
    index: 1,
    answers: { q2: ['0', '1'] },
    flagged: new Set(['q2']),
    eliminated: { q2: ['2'] },
    calcOpen: true,
    handInOpen: true,
    clockRunning: false,
  };
  const types = diffRunSnapshots(base, next, T0, 'arrow-key').map((event) => event.type);
  expect(types).toEqual(['visit', 'clear', 'answer', 'flag', 'strike', 'calculator', 'handin-open', 'clock']);
});

test('saved activity survives a reload and malformed events are dropped', () => {
  const saved = JSON.stringify({
    selectedAnswers: {},
    showResults: false,
    timerRunning: false,
    remainingSeconds: null,
    timerEndsAt: null,
    flaggedIds: [],
    runMode: 'open',
    activity: [...sitting.slice(0, 2), { t: 'later', type: 'visit' }, { t: 5, type: 'bogus' }],
  });
  const session = parseSavedPracticeRunSession(saved, 0);
  expect(session?.activity).toEqual(sitting.slice(0, 2));
  expect(parseRunEvents('nope')).toEqual([]);
});

test('helpers: plain text and file name', () => {
  expect(toPlainText('<p>A &amp; B</p><br/>![x](y.png)')).toBe('A & B [image]');
  expect(insightsFileName('Quiz 1 — Jan 2025', T0)).toBe('praxis-insights-quiz-1-jan-2025-2023-11-14.md');
});

test('journey stretches and first answers sit on the active-time axis', () => {
  const a = analyseAttempt(input(sitting, { q1: '2', q3: '1' }));
  expect(a.journey).toEqual([
    { q: 1, from: 0, to: 30 },
    { q: 2, from: 30, to: 40 },
    { q: 3, from: 40, to: 60 }, // the minute away doesn't split or stretch it
    { q: 1, from: 60, to: 80 },
  ]);
  expect(a.firstAnswers).toEqual([
    { q: 1, at: 20, outcome: 'incorrect' },
    { q: 3, at: 55, outcome: 'correct' },
  ]);
});

test('switching options quickly is kept as two answers', () => {
  let log: RunEvent[] = [];
  log = appendRunEvent(log, { t: s(10), type: 'answer', page: 'q1', value: '0' });
  log = appendRunEvent(log, { t: s(12), type: 'answer', page: 'q1', value: '2' });
  expect(log).toHaveLength(2);
  const a = analyseAttempt(input([{ t: s(0), type: 'start', mode: 'open', page: 'q1' }, ...log, { t: s(20), type: 'submit', auto: false }], { q1: '2' }));
  expect(a.questions[0]!.answerChanges).toBe(1);
  expect(a.questions[0]!.timeToFirstAnswer).toBe(10);
});

test('a resume without a hidden boundary stops at the last action', () => {
  const a = analyseAttempt(input([
    { t: s(0), type: 'start', mode: 'open', page: 'q1' },
    { t: s(10), type: 'answer', page: 'q1', value: '0' },
    { t: s(50), type: 'resume', page: 'q1' },
    { t: s(60), type: 'submit', auto: false },
  ], { q1: '0' }));
  expect(a.activeSeconds).toBe(20);
});

test('saved answers drop bad values, and a run that ended while closed gets its hand-in', () => {
  const saved = JSON.stringify({
    selectedAnswers: { q1: 123, q2: '1', q3: ['0', 2], q4: ['0'] },
    showResults: false,
    timerRunning: true,
    timerEndsAt: s(100),
    runMode: 'timed',
    activity: [{ t: s(0), type: 'start', mode: 'timed', page: 'q1' }, { t: s(40), type: 'hidden' }],
  });
  const session = parseSavedPracticeRunSession(saved, 60, s(500));
  expect(session?.selectedAnswers).toEqual({ q2: '1', q4: ['0'] });
  expect(session?.showResults).toBe(true);
  expect(session?.activity?.at(-1)).toEqual({ t: s(100), type: 'submit', auto: true });
});

test('a log carrying two sittings is read as the last one', () => {
  const second: RunEvent[] = [
    { t: s(300), type: 'resume', page: 'q1' },
    { t: s(310), type: 'answer', page: 'q1', value: '2' },
    { t: s(320), type: 'submit', auto: false },
  ];
  expect(lastSitting([...sitting, ...second])).toEqual(second);
  expect(lastSitting([...sitting, { t: s(150), type: 'hidden' }])).toEqual(sitting);
  const a = analyseAttempt(input([...sitting, ...second], { q1: '2' }));
  expect(a.questions[2]!.answerTrail).toEqual([]);
  expect(a.questions[0]!.answerTrail.map((step) => step.answer)).toEqual(['C']);
  expect(a.activeSeconds).toBe(20);
});
