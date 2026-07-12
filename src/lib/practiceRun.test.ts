import { expect, test } from 'bun:test';
import {
  calculatePracticeRunStats,
  getPracticeRunPageStates,
  getPracticeRunReviewStates,
  groupPracticeRunQuestions,
  isPracticeRunQuestionCorrect,
  parseSavedPracticeRunSession,
  selectPracticeRunOption,
  type SelectedAnswers,
} from '@/lib/practiceRun';
import type { QuizQuestion } from '@/lib/dataTransforms';

function quizQuestion(overrides: Partial<QuizQuestion>): QuizQuestion {
  return {
    uuid: 'question-uuid',
    questionNumber: 1,
    questionType: 'MCQ',
    totalMark: '1',
    hash: 'hash',
    isMarkdown: 0,
    haveAnswers: 1,
    questionNumLong: 1,
    options: [
      {
        optionText: 'Correct',
        score: '1',
        isCorrect: 1,
        optionNumber: 1,
      },
      {
        optionText: 'Incorrect',
        score: '0',
        isCorrect: 0,
        optionNumber: 2,
      },
    ],
    ...overrides,
  };
}

test('groupPracticeRunQuestions nests child questions under comprehension parents', () => {
  const grouped = groupPracticeRunQuestions([
    quizQuestion({
      uuid: 'passage',
      questionNumber: 1,
      questionType: 'COMPREHENSION',
      totalMark: '0',
      options: [],
    }),
    quizQuestion({
      uuid: 'child',
      questionNumber: 2,
      parentQuestionUuid: 'passage',
    }),
  ]);

  expect(grouped).toHaveLength(1);
  expect(grouped[0]?.uuid).toBe('passage');
  expect(grouped[0]?.subQuestions?.map((question) => question.uuid)).toEqual(['child']);
});

test('calculatePracticeRunStats scores MCQ and MSQ answers after reveal', () => {
  const grouped = groupPracticeRunQuestions([
    quizQuestion({ uuid: 'mcq', totalMark: '2' }),
    quizQuestion({
      uuid: 'msq',
      questionNumber: 2,
      questionType: 'MSQ',
      totalMark: '3',
      options: [
        { optionText: 'A', score: '1', isCorrect: 1, optionNumber: 1 },
        { optionText: 'B', score: '1', isCorrect: 1, optionNumber: 2 },
        { optionText: 'C', score: '0', isCorrect: 0, optionNumber: 3 },
      ],
    }),
    quizQuestion({
      uuid: 'sa',
      questionNumber: 3,
      questionType: 'SA',
      totalMark: '4',
      options: [],
    }),
  ]);
  const selectedAnswers: SelectedAnswers = {
    mcq: '0',
    msq: ['0', '1'],
    sa: '42',
  };

  expect(calculatePracticeRunStats(grouped, selectedAnswers, true)).toEqual({
    totalQuestions: 3,
    answered: 3,
    correct: 2,
    incorrect: 0,
    skipped: 0,
    gradableTotal: 2,
    totalMarks: 5,
    scoredMarks: 5,
    manualEvalCount: 1,
  });
});

test('calculatePracticeRunStats tallies incorrect and skipped gradable answers', () => {
  const grouped = groupPracticeRunQuestions([
    quizQuestion({ uuid: 'right' }),
    quizQuestion({ uuid: 'wrong', questionNumber: 2 }),
    quizQuestion({ uuid: 'blank', questionNumber: 3 }),
  ]);

  const stats = calculatePracticeRunStats(grouped, { right: '0', wrong: '1' }, true);

  expect(stats.correct).toBe(1);
  expect(stats.incorrect).toBe(1);
  expect(stats.skipped).toBe(1);
  expect(stats.gradableTotal).toBe(3);
});

test('getPracticeRunPageStates reports partial comprehension progress', () => {
  const grouped = groupPracticeRunQuestions([
    quizQuestion({
      uuid: 'passage',
      questionType: 'COMPREHENSION',
      totalMark: '0',
      options: [],
    }),
    quizQuestion({ uuid: 'child-1', questionNumber: 2, parentQuestionUuid: 'passage' }),
    quizQuestion({ uuid: 'child-2', questionNumber: 3, parentQuestionUuid: 'passage' }),
    quizQuestion({ uuid: 'standalone', questionNumber: 4 }),
  ]);

  expect(getPracticeRunPageStates(grouped, { 'child-1': '0', standalone: '0' })).toEqual([
    'partial',
    'done',
  ]);
});

test('isPracticeRunQuestionCorrect grades MCQ and MSQ, ignoring blanks and manual types', () => {
  const mcq = quizQuestion({ uuid: 'mcq' });
  expect(isPracticeRunQuestionCorrect(mcq, '0')).toBe(true);
  expect(isPracticeRunQuestionCorrect(mcq, '1')).toBe(false);
  expect(isPracticeRunQuestionCorrect(mcq, undefined)).toBe(false);

  const msq = quizQuestion({
    uuid: 'msq',
    questionType: 'MSQ',
    options: [
      { optionText: 'A', score: '1', isCorrect: 1, optionNumber: 1 },
      { optionText: 'B', score: '1', isCorrect: 1, optionNumber: 2 },
      { optionText: 'C', score: '0', isCorrect: 0, optionNumber: 3 },
    ],
  });
  expect(isPracticeRunQuestionCorrect(msq, ['0', '1'])).toBe(true);
  expect(isPracticeRunQuestionCorrect(msq, ['0'])).toBe(false);
  expect(isPracticeRunQuestionCorrect(msq, ['0', '1', '2'])).toBe(false);

  const sa = quizQuestion({ uuid: 'sa', questionType: 'SA', options: [] });
  expect(isPracticeRunQuestionCorrect(sa, '42')).toBe(false);
});

test('getPracticeRunReviewStates colours pages and aggregates comprehension subs', () => {
  const grouped = groupPracticeRunQuestions([
    quizQuestion({ uuid: 'right' }),
    quizQuestion({ uuid: 'wrong', questionNumber: 2 }),
    quizQuestion({ uuid: 'blank', questionNumber: 3 }),
    quizQuestion({ uuid: 'sa', questionNumber: 4, questionType: 'SA', options: [] }),
    quizQuestion({ uuid: 'passage', questionNumber: 5, questionType: 'COMPREHENSION', totalMark: '0', options: [] }),
    quizQuestion({ uuid: 'sub-right', questionNumber: 6, parentQuestionUuid: 'passage' }),
    quizQuestion({ uuid: 'sub-wrong', questionNumber: 7, parentQuestionUuid: 'passage' }),
  ]);

  expect(
    getPracticeRunReviewStates(grouped, {
      right: '0',
      wrong: '1',
      sa: '42',
      'sub-right': '0',
      'sub-wrong': '1',
    }),
  ).toEqual(['correct', 'incorrect', 'unanswered', 'manual', 'incorrect']);
});

test('selectPracticeRunOption toggles MSQ choices and replaces MCQ choices', () => {
  const afterFirstMsq = selectPracticeRunOption({}, 'msq', '0', 'MSQ');
  const afterSecondMsq = selectPracticeRunOption(afterFirstMsq, 'msq', '1', 'MSQ');
  const afterToggle = selectPracticeRunOption(afterSecondMsq, 'msq', '0', 'MSQ');
  const afterMcq = selectPracticeRunOption(afterToggle, 'mcq', '2', 'MCQ');

  expect(afterFirstMsq).toEqual({ msq: ['0'] });
  expect(afterSecondMsq).toEqual({ msq: ['0', '1'] });
  expect(afterToggle).toEqual({ msq: ['1'] });
  expect(afterMcq).toEqual({ msq: ['1'], mcq: '2' });
});

test('parseSavedPracticeRunSession reveals results when a running timer expired while away', () => {
  const saved = JSON.stringify({
    selectedAnswers: { q1: '0' },
    showResults: false,
    timerRunning: true,
    remainingSeconds: 30,
    timerEndsAt: 1_000,
  });

  expect(parseSavedPracticeRunSession(saved, 60, 2_500)).toEqual({
    selectedAnswers: { q1: '0' },
    showResults: true,
    timerRunning: false,
    remainingSeconds: 0,
    timerEndsAt: null,
    flaggedIds: [],
    runMode: null,
  });
});
