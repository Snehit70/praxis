import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'bun:test';
import { collectImportRows } from './import-db';

let tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs) {
    rmSync(tempDir, { recursive: true, force: true });
  }
  tempDirs = [];
});

function writeJson(filePath: string, value: unknown) {
  writeFileSync(filePath, JSON.stringify(value, null, 2));
}

test('collectImportRows reads canonical offline dataset rows without Postgres', () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'praxis-import-'));
  tempDirs.push(dataDir);

  const examDir = path.join(dataDir, 'Quiz 1');
  const courseDir = path.join(examDir, 'CT');
  mkdirSync(courseDir, { recursive: true });

  writeJson(path.join(examDir, 'metadata.json'), {
    exam: {
      exam_name: 'Quiz 1',
      uuid: 'exam-uuid',
    },
    courses: [
      {
        course_name: 'Computational Thinking',
        course_code: 'CT',
        program_id: 1,
        uuid: 'course-uuid',
      },
    ],
  });

  writeJson(path.join(courseDir, 'index.json'), [
    { uuid: 'paper-uuid' },
    { uuid: 'missing-paper' },
  ]);

  writeJson(path.join(courseDir, 'paper-uuid.json'), {
    uuid: 'paper-uuid',
    group_id: 31,
    total_score: '2',
    duration: 60,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    question_paper_name: '2026 Feb 3 CT',
    question_paper_description: 'Fixture paper',
    year: 2026,
    is_new: 1,
    exam: {
      exam_name: 'Quiz 1',
      uuid: 'exam-uuid',
    },
    course: {
      course_name: 'Computational Thinking',
      course_code: 'CT',
      program_id: 1,
      uuid: 'course-uuid',
    },
    questions: [
      {
        uuid: 'instruction',
        question_number: 1,
        question_type: 'MCQ',
        total_mark: '0',
        hash: 'hash-instruction',
        question_text_1: 'Please cross check the HALL TICKET registered by you.',
        is_markdown: 0,
        have_answers: 1,
        question_num_long: 1,
        options: [],
      },
      {
        uuid: 'question-uuid',
        question_number: 2,
        question_type: 'MCQ',
        total_mark: '2',
        hash: 'hash-question',
        question_text_1: 'What is 1 + 1?',
        is_markdown: 0,
        have_answers: 1,
        question_num_long: 2,
        options: [
          {
            option_text: '2',
            option_image: null,
            score: '2',
            is_correct: 1,
            option_number: 1,
          },
        ],
      },
    ],
  });

  const rows = collectImportRows(dataDir);

  expect(rows.exams).toHaveLength(1);
  expect(rows.courses).toHaveLength(1);
  expect(rows.paperVariants).toHaveLength(1);
  expect(rows.questions).toHaveLength(1);
  expect(rows.options).toHaveLength(1);
  expect(rows.questions[0]).toMatchObject({
    id: 'exam-uuid:course-uuid:paper-uuid:question-uuid',
    source_uuid: 'question-uuid',
    total_mark_value: 2,
  });
  expect(rows.options[0]).toMatchObject({
    id: 'exam-uuid:course-uuid:paper-uuid:question-uuid:0',
    option_position: 0,
  });
  expect(rows.skippedPaperPaths).toEqual([
    path.relative(process.cwd(), path.join(courseDir, 'missing-paper.json')),
  ]);
  expect(rows.skippedCourseResolutionCount).toBe(0);
});
