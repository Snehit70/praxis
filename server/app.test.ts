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
      year: 2024,
      questionCount: 1,
      calculatedTotalMarks: 4,
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
