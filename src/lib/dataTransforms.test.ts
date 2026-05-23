import { expect, test } from 'bun:test';
import {
  getQuestionStats,
  transformRawQuestions,
  type RawQuestion,
} from '@/lib/dataTransforms';

function question(overrides: Partial<RawQuestion>): RawQuestion {
  return {
    uuid: 'question-uuid',
    question_number: 1,
    question_type: 'MCQ',
    total_mark: '1',
    hash: 'hash',
    question_text_1: 'Question text',
    is_markdown: 0,
    have_answers: 1,
    question_num_long: 1,
    options: [
      {
        option_text: 'Option A',
        score: '1',
        is_correct: 1,
        option_number: 1,
      },
    ],
    ...overrides,
  };
}

test('transformRawQuestions filters instructional zero-mark prompts', () => {
  const questions = transformRawQuestions([
    question({
      uuid: 'hall-ticket-prompt',
      question_number: 1,
      total_mark: '0',
      question_text_1: 'Please cross check the HALL TICKET registered by you.',
      options: [],
    }),
    question({
      uuid: 'useful-data-prompt',
      question_number: 2,
      total_mark: '0',
      question_text_1: 'Useful data',
      options: [
        {
          option_text: 'Useful Data has been mentioned above',
          score: '0',
          is_correct: 0,
          option_number: 1,
        },
      ],
    }),
    question({
      uuid: 'answerable-question',
      question_number: 3,
      total_mark: '2',
      question_text_1: 'What is 1 + 1?',
      options: [
        {
          option_text: '2',
          score: '2',
          is_correct: 1,
          option_number: 1,
        },
      ],
    }),
  ]);

  expect(questions.some((question) => question.questionText1?.includes('HALL TICKET'))).toBe(false);
  expect(
    questions.some((question) =>
      question.options.some((option) => option.optionText.includes('Useful Data has been mentioned')),
    ),
  ).toBe(false);

  const stats = getQuestionStats(questions);
  expect(stats.answerableCount).toBeGreaterThan(0);
  expect(stats.totalMarks).toBeGreaterThan(0);
});

test('transformRawQuestions preserves comprehension parent linkage', () => {
  const comprehensionUuid = 'comprehension-parent';
  const questions = transformRawQuestions([
    question({
      uuid: comprehensionUuid,
      question_number: 1,
      question_type: 'COMPREHENSION',
      total_mark: '0',
      question_text_1: 'Read the passage.',
      options: [],
    }),
    question({
      uuid: 'child-question',
      question_number: 2,
      question_type: 'MCQ',
      total_mark: '1',
      parent_question: { uuid: comprehensionUuid },
      question_text_1: 'Question based on passage.',
    }),
  ]);

  const comprehension = questions.find((question) => question.questionType === 'COMPREHENSION');
  const childQuestion = questions.find((question) => question.parentQuestionUuid === comprehension?.uuid);

  expect(comprehension).toBeDefined();
  expect(childQuestion).toBeDefined();
  expect(childQuestion?.questionType).toBe('MCQ');
});
