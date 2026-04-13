import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createApiFetchHandler } from './app';
import {
  createIsolatedTestDatabase,
  seedIntegrationFixture,
  type IsolatedTestDatabase,
} from './testHelpers';

let database: IsolatedTestDatabase;
let fetchHandler: ReturnType<typeof createApiFetchHandler>;

async function getJson(path: string) {
  const response = await fetchHandler(new Request(`http://local.test${path}`));
  return {
    response,
    json: await response.json(),
  };
}

beforeAll(async () => {
  database = await createIsolatedTestDatabase();
  await seedIntegrationFixture(database.sql);
  fetchHandler = createApiFetchHandler(database.sql);
});

afterAll(async () => {
  await database.dispose();
});

describe('Praxis API integration', () => {
  test('returns dataset stats from the isolated database', async () => {
    const { response, json } = await getJson('/api/stats');

    expect(response.status).toBe(200);
    expect(json).toEqual({
      examCount: 1,
      courseCount: 1,
      paperVariantCount: 2,
      questionCount: 4,
    });
  });

  test('lists courses for an exam with paper counts', async () => {
    const { response, json } = await getJson('/api/exams/exam-1/courses');

    expect(response.status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0]).toMatchObject({
      uuid: 'course-1',
      courseName: 'Computational Thinking',
      courseCode: 'CT',
      paperCount: 2,
    });
  });

  test('returns global search results for matching courses and papers', async () => {
    const { response, json } = await getJson('/api/search?q=computational');

    expect(response.status).toBe(200);
    expect(json.courses).toEqual([
      {
        uuid: 'course-1',
        courseName: 'Computational Thinking',
        courseCode: 'CT',
        examUuid: 'exam-1',
        examName: 'Quiz 1',
        examSlug: 'quiz1',
        paperCount: 2,
      },
    ]);
    expect(json.papers).toHaveLength(2);
    expect(json.papers[0]).toMatchObject({
      uuid: 'paper-2025',
      courseUuid: 'course-1',
      examUuid: 'exam-1',
      questionCount: 2,
      calculatedTotalMarks: 3,
    });
  });

  test('returns empty search results when query is blank', async () => {
    const { response, json } = await getJson('/api/search?q=');

    expect(response.status).toBe(200);
    expect(json).toEqual({ courses: [], papers: [] });
  });

  test('lists papers ordered by most recent year and computes marks', async () => {
    const { response, json } = await getJson('/api/exams/exam-1/courses/course-1/papers');

    expect(response.status).toBe(200);
    expect(json).toHaveLength(2);
    expect(json[0]).toMatchObject({
      uuid: 'paper-2025',
      year: 2025,
      questionCount: 2,
      calculatedTotalMarks: 3,
    });
    expect(json[1]).toMatchObject({
      uuid: 'paper-2024',
      courseUuid: 'course-1',
      year: 2024,
      questionCount: 1,
      calculatedTotalMarks: 4,
    });
  });

  test('lists merged papers when course aliases are provided', async () => {
    await database.sql`
      INSERT INTO courses (source_uuid, course_name, course_code, program_id, label, canonical_name)
      VALUES ('course-2', 'Computational Thinking (New)', 'CT', 1, 'Foundation', 'Computational Thinking')
    `;

    await database.sql`
      INSERT INTO paper_variants (
        id,
        source_uuid,
        exam_uuid,
        course_uuid,
        group_id,
        total_score,
        duration,
        paper_name,
        paper_description,
        year,
        is_new,
        source_path
      )
      VALUES (
        'variant-2023',
        'paper-2023',
        'exam-1',
        'course-2',
        1,
        '2',
        45,
        'Computational Thinking Quiz 1 2023',
        'Alias fixture paper',
        2023,
        0,
        'fixtures/paper-2023.json'
      )
    `;

    await database.sql`
      INSERT INTO questions (
        id,
        source_uuid,
        paper_variant_id,
        question_number,
        question_type,
        total_mark,
        total_mark_value,
        hash,
        question_text_1,
        parent_question_uuid,
        is_markdown,
        have_answers,
        question_num_long
      )
      VALUES (
        'variant-2023:q-alias',
        'q-alias',
        'variant-2023',
        1,
        'MCQ',
        '2',
        2,
        'hash-alias',
        'Alias question',
        NULL,
        0,
        1,
        1
      )
    `;

    const { response, json } = await getJson(
      '/api/exams/exam-1/courses/course-1/papers?courseUuids=course-1,course-2',
    );

    expect(response.status).toBe(200);
    expect(json).toHaveLength(3);
    expect(json.map((paper: { uuid: string }) => paper.uuid)).toEqual([
      'paper-2025',
      'paper-2024',
      'paper-2023',
    ]);
    expect(json[2]).toMatchObject({
      uuid: 'paper-2023',
      courseUuid: 'course-2',
      questionCount: 1,
      calculatedTotalMarks: 2,
    });
  });

  test('returns paper details only for the requested exam and course context', async () => {
    const { response, json } = await getJson(
      '/api/papers/paper-2025?courseUuid=course-1&examUuid=exam-1',
    );

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      uuid: 'paper-2025',
      examUuid: 'exam-1',
      examName: 'Quiz 1',
      courseUuid: 'course-1',
      courseName: 'Computational Thinking',
    });

    const missing = await getJson('/api/papers/paper-2025?courseUuid=course-1&examUuid=wrong-exam');
    expect(missing.response.status).toBe(404);
    expect(missing.json).toEqual({ error: 'Paper not found' });
  });

  test('returns paper questions with ordered options and parent linkage', async () => {
    const { response, json } = await getJson(
      '/api/papers/paper-2025/questions?courseUuid=course-1&examUuid=exam-1',
    );

    expect(response.status).toBe(200);
    expect(json).toHaveLength(3);
    expect(json[0]).toMatchObject({
      uuid: 'q-comp',
      questionType: 'COMPREHENSION',
    });
    expect(json[1]).toMatchObject({
      uuid: 'q-child',
      parentQuestionUuid: 'q-comp',
    });
    expect(json[2]).toMatchObject({
      uuid: 'q-main',
      questionType: 'MCQ',
    });
    expect(json[2].options).toEqual([
      {
        optionText: '2',
        score: '1',
        isCorrect: 1,
        optionNumber: 1,
      },
      {
        optionText: '3',
        score: '0',
        isCorrect: 0,
        optionNumber: 2,
      },
    ]);
  });

  test('returns not found for unknown routes', async () => {
    const { response, json } = await getJson('/api/not-real');

    expect(response.status).toBe(404);
    expect(json).toEqual({ error: 'Route not found' });
  });
});
