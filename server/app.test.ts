import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  createApiTestContext,
  seedAliasCourseFixture,
  type ApiTestContext,
} from './testHelpers';

let context: ApiTestContext;

beforeEach(async () => {
  context = await createApiTestContext();
});

afterEach(async () => {
  await context.dispose();
});

describe('Praxis API integration', () => {
  test('returns dataset stats from an isolated database', async () => {
    const { response, json } = await context.getJson('/api/stats');

    expect(response.status).toBe(200);
    expect(json).toEqual({
      examCount: 1,
      courseCount: 1,
      paperVariantCount: 2,
      questionCount: 4,
    });
  });

  test('sets public API response headers', async () => {
    const response = await context.get('/api/health');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });

  test('lists courses for an exam with paper counts', async () => {
    const { response, json } = await context.getJson<Array<Record<string, unknown>>>(
      '/api/exams/exam-1/courses',
    );

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
    const { response, json } = await context.getJson<{
      courses: Array<Record<string, unknown>>;
      papers: Array<Record<string, unknown>>;
    }>('/api/search?q=computational');

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
    const { response, json } = await context.getJson('/api/search?q=');

    expect(response.status).toBe(200);
    expect(json).toEqual({ courses: [], papers: [] });
  });

  test('lists papers ordered by most recent year and computes marks', async () => {
    const { response, json } = await context.getJson<Array<Record<string, unknown>>>(
      '/api/exams/exam-1/courses/course-1/papers',
    );

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
    await seedAliasCourseFixture(context.database.sql);

    const { response, json } = await context.getJson<Array<{ uuid: string; courseUuid: string }>>(
      '/api/exams/exam-1/courses/course-1/papers?courseUuids=course-1,course-2',
    );

    expect(response.status).toBe(200);
    expect(json).toHaveLength(3);
    expect(json.map((paper) => paper.uuid)).toEqual([
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

  test('groups paper bundles with variant counts', async () => {
    await seedAliasCourseFixture(context.database.sql);

    const { response, json } = await context.getJson<
      Array<{
        groupId: number;
        bundleLabel: string;
        variantCount: number;
        papers: Array<{ uuid: string }>;
      }>
    >('/api/exams/exam-1/courses/course-1/bundles?courseUuids=course-1,course-2');

    expect(response.status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0]).toMatchObject({
      groupId: 1,
      bundleLabel: 'Others',
      variantCount: 3,
    });
    expect(json[0]?.papers.map((paper) => paper.uuid)).toEqual([
      'paper-2025',
      'paper-2024',
      'paper-2023',
    ]);
  });

  test('returns paper details only for the requested exam and course context', async () => {
    const { response, json } = await context.getJson(
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

    const missing = await context.getJson(
      '/api/papers/paper-2025?courseUuid=course-1&examUuid=wrong-exam',
    );
    expect(missing.response.status).toBe(404);
    expect(missing.json).toEqual({ error: 'Paper not found' });
  });

  test('returns paper questions with ordered options and parent linkage', async () => {
    const { response, json } = await context.getJson<Array<Record<string, unknown>>>(
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
    expect(json[2]?.options).toEqual([
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
    const { response, json } = await context.getJson('/api/not-real');

    expect(response.status).toBe(404);
    expect(json).toEqual({ error: 'Route not found' });
  });
});
