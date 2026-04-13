import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  getQuestionStats,
  transformRawQuestions,
  type RawPaperFile,
} from '@/lib/dataTransforms';

function readPaperFixture(path: string): RawPaperFile {
  return JSON.parse(readFileSync(path, 'utf8')) as RawPaperFile;
}

test('transformRawQuestions filters instructional zero-mark prompts', () => {
  const paper = readPaperFixture('data/Quiz 1/CT/a3d88545-398.json');
  const questions = transformRawQuestions(paper.questions);

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
  const paper = readPaperFixture('data/Quiz 1/CT/a21ea62e-1aa0-4a13-b6a5-0237e8a10895.json');
  const questions = transformRawQuestions(paper.questions);

  const comprehension = questions.find((question) => question.questionType === 'COMPREHENSION');
  const childQuestion = questions.find((question) => question.parentQuestionUuid === comprehension?.uuid);

  expect(comprehension).toBeDefined();
  expect(childQuestion).toBeDefined();
  expect(childQuestion?.questionType).toBe('MCQ');
});
