import type { RunMode } from '@/lib/practiceRun';

/** How the user arrived at a question. */
export type NavVia =
  | 'next'
  | 'prev'
  | 'arrow-key'
  | 'enter-key'
  | 'question-grid'
  | 'next-unanswered'
  | 'next-flagged'
  | 'hand-in-sheet'
  | 'other';

/**
 * One thing that happened during a sitting. `t` is epoch ms. `page` is the page
 * id: the question uuid, or the sub-question uuid on a passage page, which is
 * also the key its answer is stored under.
 */
export type RunEvent =
  | { t: number; type: 'start'; mode: RunMode; page: string }
  | { t: number; type: 'resume'; page: string }
  | { t: number; type: 'visit'; page: string; via: NavVia }
  | { t: number; type: 'answer'; page: string; value: string | string[] }
  | { t: number; type: 'clear'; page: string }
  | { t: number; type: 'flag'; page: string; on: boolean }
  | { t: number; type: 'check'; page: string }
  | { t: number; type: 'strike'; page: string; option: string; on: boolean }
  | { t: number; type: 'calculator'; on: boolean }
  | { t: number; type: 'handin-open' }
  | { t: number; type: 'clock'; running: boolean }
  | { t: number; type: 'hidden' }
  | { t: number; type: 'visible' }
  | { t: number; type: 'submit'; auto: boolean };

/** Caps the stored log so a long sitting can't bloat localStorage. */
export const RUN_EVENT_LIMIT = 5000;
/** Keystrokes in one short-answer box within this window merge into one event. */
const TYPING_MERGE_MS = 3000;

const NAV_VIA = new Set<NavVia>([
  'next',
  'prev',
  'arrow-key',
  'enter-key',
  'question-grid',
  'next-unanswered',
  'next-flagged',
  'hand-in-sheet',
  'other',
]);

/**
 * Appends one event. Typing in a short-answer box would log every keystroke,
 * so a text answer to the same question that extends or trims the last one
 * within a few seconds replaces it. A switch between options is kept.
 */
export function appendRunEvent(log: RunEvent[], event: RunEvent): RunEvent[] {
  const last = log[log.length - 1];
  if (
    event.type === 'answer' &&
    typeof event.value === 'string' &&
    last?.type === 'answer' &&
    typeof last.value === 'string' &&
    last.page === event.page &&
    event.t - last.t <= TYPING_MERGE_MS &&
    // Typing grows or trims the text; switching single-choice options ("0" → "2") doesn't.
    (event.value.startsWith(last.value) || last.value.startsWith(event.value))
  ) {
    return [...log.slice(0, -1), event];
  }
  if (log.length >= RUN_EVENT_LIMIT) return log;
  return [...log, event];
}

const isString = (value: unknown): value is string => typeof value === 'string';
const isAnswerValue = (value: unknown): value is string | string[] =>
  isString(value) || (Array.isArray(value) && value.every(isString));

/** Keeps only well-formed events from a saved log; anything else is dropped. */
export function parseRunEvents(value: unknown): RunEvent[] {
  if (!Array.isArray(value)) return [];
  const events: RunEvent[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as Record<string, unknown>;
    if (typeof e.t !== 'number' || !Number.isFinite(e.t)) continue;
    const t = e.t;
    switch (e.type) {
      case 'start':
        if ((e.mode === 'timed' || e.mode === 'open' || e.mode === 'practice') && isString(e.page)) {
          events.push({ t, type: 'start', mode: e.mode, page: e.page });
        }
        break;
      case 'resume':
        if (isString(e.page)) events.push({ t, type: 'resume', page: e.page });
        break;
      case 'visit':
        if (isString(e.page)) {
          const via = NAV_VIA.has(e.via as NavVia) ? (e.via as NavVia) : 'other';
          events.push({ t, type: 'visit', page: e.page, via });
        }
        break;
      case 'answer':
        if (isString(e.page) && isAnswerValue(e.value)) {
          events.push({ t, type: 'answer', page: e.page, value: e.value });
        }
        break;
      case 'clear':
        if (isString(e.page)) events.push({ t, type: 'clear', page: e.page });
        break;
      case 'flag':
        if (isString(e.page) && typeof e.on === 'boolean') events.push({ t, type: 'flag', page: e.page, on: e.on });
        break;
      case 'check':
        if (isString(e.page)) events.push({ t, type: 'check', page: e.page });
        break;
      case 'strike':
        if (isString(e.page) && isString(e.option) && typeof e.on === 'boolean') {
          events.push({ t, type: 'strike', page: e.page, option: e.option, on: e.on });
        }
        break;
      case 'calculator':
        if (typeof e.on === 'boolean') events.push({ t, type: 'calculator', on: e.on });
        break;
      case 'handin-open':
        events.push({ t, type: 'handin-open' });
        break;
      case 'clock':
        if (typeof e.running === 'boolean') events.push({ t, type: 'clock', running: e.running });
        break;
      case 'hidden':
      case 'visible':
        events.push({ t, type: e.type });
        break;
      case 'submit':
        events.push({ t, type: 'submit', auto: e.auto === true });
        break;
      default:
        break;
    }
    if (events.length >= RUN_EVENT_LIMIT) break;
  }
  return events;
}

/** The parts of a live run the recorder compares between renders. */
export interface RunSnapshot {
  /** Page ids in paper order; `index` points into it. */
  pageIds: string[];
  index: number;
  answers: Record<string, string | string[]>;
  flagged: ReadonlySet<string>;
  checked: ReadonlySet<string>;
  eliminated: Record<string, string[]>;
  calcOpen: boolean;
  handInOpen: boolean;
  /** Whether the exam clock is running; null for an untimed run. */
  clockRunning: boolean | null;
}

const meaningful = (value: string | string[] | undefined) =>
  value !== undefined && (Array.isArray(value) ? value.length > 0 : value.trim().length > 0);
const sameValue = (a: string | string[] | undefined, b: string | string[] | undefined) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Events that explain how `prev` became `next`. */
export function diffRunSnapshots(prev: RunSnapshot, next: RunSnapshot, t: number, via: NavVia): RunEvent[] {
  const events: RunEvent[] = [];
  const known = new Set(next.pageIds);
  const pageAt = next.pageIds[next.index];

  if (prev.index !== next.index && pageAt) events.push({ t, type: 'visit', page: pageAt, via });

  const keys = new Set([...Object.keys(prev.answers), ...Object.keys(next.answers)]);
  keys.forEach((page) => {
    if (!known.has(page)) return;
    const before = prev.answers[page];
    const after = next.answers[page];
    if (sameValue(before, after)) return;
    if (meaningful(after)) events.push({ t, type: 'answer', page, value: after! });
    else if (meaningful(before)) events.push({ t, type: 'clear', page });
  });

  next.flagged.forEach((page) => {
    if (!prev.flagged.has(page) && known.has(page)) events.push({ t, type: 'flag', page, on: true });
  });
  prev.flagged.forEach((page) => {
    if (!next.flagged.has(page) && known.has(page)) events.push({ t, type: 'flag', page, on: false });
  });
  next.checked.forEach((page) => {
    if (!prev.checked.has(page) && known.has(page)) events.push({ t, type: 'check', page });
  });

  const struckKeys = new Set([...Object.keys(prev.eliminated), ...Object.keys(next.eliminated)]);
  struckKeys.forEach((page) => {
    if (!known.has(page)) return;
    const before = new Set(prev.eliminated[page] ?? []);
    const after = new Set(next.eliminated[page] ?? []);
    after.forEach((option) => {
      if (!before.has(option)) events.push({ t, type: 'strike', page, option, on: true });
    });
    before.forEach((option) => {
      if (!after.has(option)) events.push({ t, type: 'strike', page, option, on: false });
    });
  });

  if (prev.calcOpen !== next.calcOpen) events.push({ t, type: 'calculator', on: next.calcOpen });
  if (!prev.handInOpen && next.handInOpen) events.push({ t, type: 'handin-open' });
  if (prev.clockRunning !== null && next.clockRunning !== null && prev.clockRunning !== next.clockRunning) {
    events.push({ t, type: 'clock', running: next.clockRunning });
  }
  return events;
}
