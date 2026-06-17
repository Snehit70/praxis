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
}

export interface PracticeRunStats {
  totalQuestions: number;
  answered: number;
  correct: number;
  gradableTotal: number;
  totalMarks: number;
  scoredMarks: number;
  manualEvalCount: number;
}

export type PracticeRunPageState = 'none' | 'partial' | 'done';

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
      if (question.questionType === 'SA' || question.questionType === 'OPPE') {
        manualEvalCount++;
      } else {
        gradableTotal++;
      }
    }
    if (question.subQuestions) {
      question.subQuestions.forEach((subQuestion) => {
        allQuestionIds.add(subQuestion.uuid);
        if (subQuestion.questionType === 'SA' || subQuestion.questionType === 'OPPE') {
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
        correctIndices.every((value) => selectedEntries.includes(value));
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
