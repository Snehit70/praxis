import type { QuestionType, QuizQuestion } from '@/lib/dataTransforms';

export type SelectedAnswers = Record<string, string | string[]>;

/**
 * The two modes a user chooses on entering a paper variant (see CONTEXT.md):
 * a Timed Run (clock + auto-submit) or an Open Run (untimed, free review).
 * `null` means the choice hasn't been made yet — the cover plate is showing.
 */
export type RunMode = 'timed' | 'open';

export interface QuestionWithChildren extends QuizQuestion {
  subQuestions?: QuizQuestion[];
}

export interface SavedPracticeRunSession {
  selectedAnswers: SelectedAnswers;
  showResults: boolean;
  timerRunning: boolean;
  remainingSeconds: number | null;
  timerEndsAt: number | null;
  /** Question uuids the user flagged to revisit. Absent in older saves. */
  flaggedIds: string[];
  /**
   * Which mode the user picked on the cover plate. `null` (or absent in older
   * saves) means the cover plate hasn't been resolved yet for this session.
   */
  runMode: RunMode | null;
  /** Epoch ms when the run started; times open runs. Absent in older saves. */
  startedAt?: number | null;
  /** Seconds the sitting took, fixed at hand-in. */
  timeUsedSeconds?: number | null;
  /** Server id of this sitting's stored attempt, once handed in and saved. */
  attemptId?: string | null;
}

export interface PracticeRunStats {
  totalQuestions: number;
  answered: number;
  correct: number;
  /** Gradable questions answered but graded wrong (only counted post-reveal). */
  incorrect: number;
  /** Gradable questions left unanswered (only counted post-reveal). */
  skipped: number;
  gradableTotal: number;
  totalMarks: number;
  scoredMarks: number;
  manualEvalCount: number;
}

export type PracticeRunPageState = 'none' | 'partial' | 'done';

/**
 * Per-page status used by the navigator *after submission*. Distinct from
 * `PracticeRunPageState` (which tracks answer progress during the run):
 *  - `correct`     — all gradable parts answered correctly
 *  - `incorrect`   — at least one gradable part answered wrong
 *  - `unanswered`  — a gradable part was left blank (and none wrong)
 *  - `manual`      — only manual-eval parts (SA/OPPE); can't be auto-graded
 */
export type PracticeRunReviewState = 'correct' | 'incorrect' | 'unanswered' | 'manual';

export const PAPER_SESSION_STORAGE_PREFIX = 'praxis.paper-session';

export function getPracticeRunStorageKey(
  paperId: string,
  courseId?: string | null,
  examId?: string | null,
) {
  return [PAPER_SESSION_STORAGE_PREFIX, paperId, courseId ?? 'none', examId ?? 'none'].join(':');
}

export function parseSavedPracticeRunSession(
  saved: string | null,
  durationMinutes: number,
  now = Date.now(),
): SavedPracticeRunSession | null {
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as Partial<SavedPracticeRunSession>;
    const durationSeconds = durationMinutes > 0 ? durationMinutes * 60 : null;
    const timerEndsAt = typeof parsed.timerEndsAt === 'number' ? parsed.timerEndsAt : null;
    const running = parsed.timerRunning === true && timerEndsAt !== null;
    const remainingSeconds = running
      ? Math.max(0, Math.ceil((timerEndsAt - now) / 1000))
      : typeof parsed.remainingSeconds === 'number'
      ? Math.max(0, parsed.remainingSeconds)
      : durationSeconds;
    const expiredWhileAway = running && remainingSeconds === 0;
    const runMode: RunMode | null =
      parsed.runMode === 'timed' || parsed.runMode === 'open' ? parsed.runMode : null;

    return {
      selectedAnswers: parsed.selectedAnswers ?? {},
      showResults: parsed.showResults === true || expiredWhileAway,
      timerRunning: running && remainingSeconds !== null && remainingSeconds > 0,
      remainingSeconds,
      timerEndsAt: running && remainingSeconds !== null && remainingSeconds > 0 ? timerEndsAt : null,
      flaggedIds: Array.isArray(parsed.flaggedIds)
        ? parsed.flaggedIds.filter((id): id is string => typeof id === 'string')
        : [],
      runMode,
      ...(typeof parsed.startedAt === 'number' ? { startedAt: parsed.startedAt } : {}),
      ...(typeof parsed.timeUsedSeconds === 'number' ? { timeUsedSeconds: parsed.timeUsedSeconds } : {}),
      ...(typeof parsed.attemptId === 'string' ? { attemptId: parsed.attemptId } : {}),
    };
  } catch {
    return null;
  }
}

export function readPracticeRunSession(
  storageKey: string,
  durationMinutes: number,
): SavedPracticeRunSession | null {
  if (typeof window === 'undefined') return null;
  return parseSavedPracticeRunSession(
    window.localStorage.getItem(storageKey),
    durationMinutes,
  );
}

export function writePracticeRunSession(
  storageKey: string,
  session: SavedPracticeRunSession,
) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

export function clearPracticeRunSession(storageKey: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey);
}

export function hasMeaningfulAnswer(value: string | string[] | undefined) {
  if (value === undefined) return false;
  return Array.isArray(value) ? value.length > 0 : value.trim().length > 0;
}

export function groupPracticeRunQuestions(questions: QuizQuestion[]): QuestionWithChildren[] {
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
}

const normalizeTyped = (value: string) => value.trim().replace(/\s+/g, '').toLowerCase();

const parseNumber = (value: string) => {
  const parsed = Number(value.trim().replace(/,/g, ''));
  return value.trim() !== '' && Number.isFinite(parsed) ? parsed : null;
};

/**
 * The accepted answers for a short-answer question, from the paper's key:
 * `Equal` (one value), `Range` (an inclusive numeric interval) or `Set` (a JSON
 * list of accepted values, otherwise one exact string such as "36,28,30").
 * `null` when the paper has no usable key — essays and OPPE stay manual.
 */
export function getShortAnswerKey(
  question: QuizQuestion,
): { kind: 'equal' | 'set'; values: string[]; numeric: boolean } | { kind: 'range'; min: number; max: number } | null {
  if (question.questionType !== 'SA') return null;
  const start = question.valueStart?.trim();
  if (!start) return null;
  const numeric = question.responseType === 'Numeric';

  if (question.answerType === 'Range') {
    const min = parseNumber(start);
    const max = parseNumber(question.valueEnd ?? '');
    if (min === null || max === null) return null;
    return { kind: 'range', min: Math.min(min, max), max: Math.max(min, max) };
  }
  if (question.answerType === 'Equal') return { kind: 'equal', values: [start], numeric };
  if (question.answerType === 'Set') {
    if (start.startsWith('[')) {
      try {
        const list = JSON.parse(start) as unknown;
        if (Array.isArray(list)) {
          const values = list.map(String).filter((value) => value.trim() !== '');
          if (values.length > 0) return { kind: 'set', values, numeric };
        }
      } catch {
        // Not JSON — fall through to an exact match on the raw text.
      }
    }
    return { kind: 'set', values: [start], numeric };
  }
  return null;
}

/** The key in words for the review screen: "0.54 – 0.64", "8 or 8000", "thick". */
export function describeShortAnswerKey(question: QuizQuestion): string | null {
  const key = getShortAnswerKey(question);
  if (!key) return null;
  if (key.kind === 'range') return `${key.min} – ${key.max}`;
  return key.values.join(' or ');
}

/** Manual-eval: OPPE, and short answers the key can't grade. */
export function isManualEvalQuestion(question: QuizQuestion) {
  if (question.questionType === 'OPPE') return true;
  return question.questionType === 'SA' && getShortAnswerKey(question) === null;
}

function isShortAnswerCorrect(question: QuizQuestion, response: string) {
  const key = getShortAnswerKey(question);
  if (!key) return false;
  if (key.kind === 'range') {
    const value = parseNumber(response);
    return value !== null && value >= key.min - 1e-9 && value <= key.max + 1e-9;
  }
  return key.values.some((accepted) => {
    const a = parseNumber(accepted);
    const b = parseNumber(response);
    // Numeric keys compare as numbers so "0.50" matches "0.5".
    if (a !== null && b !== null && (key.numeric || !/,/.test(accepted))) {
      return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));
    }
    return normalizeTyped(accepted) === normalizeTyped(response);
  });
}

/**
 * Whether a question's answer is fully correct: MCQ/MSQ against the option
 * key, SA against the short-answer key. Manual-eval questions and empty
 * answers are never "correct" here — callers decide how to treat those.
 * Shared by the score tally, the review states and the server's grader so
 * they can never drift.
 */
export function isPracticeRunQuestionCorrect(
  question: QuizQuestion,
  selected: string | string[] | undefined,
): boolean {
  if (!hasMeaningfulAnswer(selected)) return false;
  if (question.questionType === 'SA') {
    return typeof selected === 'string' && isShortAnswerCorrect(question, selected);
  }

  const correctIndices = question.options
    .map((option, index) => (option.isCorrect === 1 ? String(index) : null))
    .filter((value): value is string => value !== null);

  if (question.questionType === 'MCQ') {
    return correctIndices.includes(selected as string);
  }
  if (question.questionType === 'MSQ') {
    const selectedEntries = selected as string[];
    return (
      correctIndices.length === selectedEntries.length &&
      correctIndices.every((value) => selectedEntries.includes(value))
    );
  }
  return false;
}

export function calculatePracticeRunStats(
  groupedQuestions: QuestionWithChildren[],
  selectedAnswers: SelectedAnswers,
  showResults: boolean,
): PracticeRunStats {
  const allQuestionIds = new Set<string>();
  let manualEvalCount = 0;
  let gradableTotal = 0;

  for (const question of groupedQuestions) {
    if (question.questionType !== 'COMPREHENSION') {
      allQuestionIds.add(question.uuid);
      if (isManualEvalQuestion(question)) {
        manualEvalCount++;
      } else {
        gradableTotal++;
      }
    }
    if (question.subQuestions) {
      question.subQuestions.forEach((subQuestion) => {
        allQuestionIds.add(subQuestion.uuid);
        if (isManualEvalQuestion(subQuestion)) {
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
  let incorrect = 0;
  let skipped = 0;
  let totalMarks = 0;
  let scoredMarks = 0;

  const countQuestion = (question: QuizQuestion) => {
    const isManualEval = isManualEvalQuestion(question);
    if (isManualEval) return;

    const marks = parseFloat(question.totalMark) || 0;
    totalMarks += marks;

    if (!showResults) return;

    if (!hasMeaningfulAnswer(selectedAnswers[question.uuid])) {
      skipped++;
      return;
    }

    if (isPracticeRunQuestionCorrect(question, selectedAnswers[question.uuid])) {
      correct++;
      scoredMarks += marks;
    } else {
      incorrect++;
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
    incorrect,
    skipped,
    gradableTotal,
    totalMarks,
    scoredMarks,
    manualEvalCount,
  };
}

/**
 * Review status per top-level (grouped) question, in page order — drives the
 * navigator's colouring after submission. A comprehension page aggregates its
 * gradable sub-questions; priority is incorrect → unanswered → correct →
 * manual, so a page surfaces the most "actionable" status (something to review)
 * first. Pages with only manual-eval parts read as `manual`.
 */
export function getPracticeRunReviewStates(
  groupedQuestions: QuestionWithChildren[],
  selectedAnswers: SelectedAnswers,
): PracticeRunReviewState[] {
  const stateFor = (question: QuizQuestion): PracticeRunReviewState => {
    if (isManualEvalQuestion(question)) return 'manual';
    if (!hasMeaningfulAnswer(selectedAnswers[question.uuid])) return 'unanswered';
    return isPracticeRunQuestionCorrect(question, selectedAnswers[question.uuid])
      ? 'correct'
      : 'incorrect';
  };

  return groupedQuestions.map((question) => {
    const parts =
      question.questionType === 'COMPREHENSION'
        ? question.subQuestions ?? []
        : [question];
    if (parts.length === 0) return 'manual';

    const states = parts.map(stateFor);
    if (states.includes('incorrect')) return 'incorrect';
    if (states.includes('unanswered')) return 'unanswered';
    if (states.includes('correct')) return 'correct';
    return 'manual';
  });
}

export interface GradedQuestion {
  questionUuid: string;
  questionType: QuestionType;
  outcome: PracticeRunReviewState;
  marksAwarded: number;
  maxMarks: number;
}

/**
 * Grade every answerable question (passage parts individually) in paper order.
 * This is the attempt record the server stores, so a stored score and the
 * on-screen verdict come from the same rules.
 */
export function gradePracticeRun(
  groupedQuestions: QuestionWithChildren[],
  selectedAnswers: SelectedAnswers,
): GradedQuestion[] {
  const grade = (question: QuizQuestion): GradedQuestion => {
    const maxMarks = parseFloat(question.totalMark) || 0;
    const selected = selectedAnswers[question.uuid];
    const outcome: PracticeRunReviewState = isManualEvalQuestion(question)
      ? 'manual'
      : !hasMeaningfulAnswer(selected)
      ? 'unanswered'
      : isPracticeRunQuestionCorrect(question, selected)
      ? 'correct'
      : 'incorrect';
    return {
      questionUuid: question.uuid,
      questionType: question.questionType,
      outcome,
      marksAwarded: outcome === 'correct' ? maxMarks : 0,
      maxMarks: outcome === 'manual' ? 0 : maxMarks,
    };
  };

  return groupedQuestions.flatMap((question) =>
    question.questionType === 'COMPREHENSION'
      ? (question.subQuestions ?? []).map(grade)
      : [grade(question)],
  );
}

export function getPracticeRunPageStates(
  groupedQuestions: QuestionWithChildren[],
  selectedAnswers: SelectedAnswers,
): PracticeRunPageState[] {
  return groupedQuestions.map((question) => {
    const ids =
      question.questionType === 'COMPREHENSION'
        ? (question.subQuestions ?? []).map((subQuestion) => subQuestion.uuid)
        : [question.uuid];
    if (ids.length === 0) return 'none';
    const answered = ids.filter((id) => hasMeaningfulAnswer(selectedAnswers[id])).length;
    if (answered === 0) return 'none';
    return answered === ids.length ? 'done' : 'partial';
  });
}

export function selectPracticeRunOption(
  selectedAnswers: SelectedAnswers,
  questionId: string,
  optionIndex: string,
  questionType: QuestionType,
): SelectedAnswers {
  if (questionType === 'MSQ') {
    const current = (selectedAnswers[questionId] as string[]) || [];
    if (current.includes(optionIndex)) {
      return { ...selectedAnswers, [questionId]: current.filter((id) => id !== optionIndex) };
    }
    return { ...selectedAnswers, [questionId]: [...current, optionIndex] };
  }

  return { ...selectedAnswers, [questionId]: optionIndex };
}
