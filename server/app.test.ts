import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createApiFetchHandler } from './app';
import {
  createApiTestContext,
  seedAliasCourseFixture,
  type ApiTestContext,
} from './testHelpers';

/** Build a handler over the current test DB that authenticates as `userId`. */
function authedHandler(userId: string) {
  return createApiFetchHandler(context.database.sql, { resolveUserId: async () => userId });
}

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
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    );
  });

  test('does not cache error responses', async () => {
    const response = await context.get('/api/not-real');

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBeNull();
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

  test('filters unsupported exam slugs out of search results', async () => {
    await context.database.sql`
      INSERT INTO exams (source_uuid, exam_name, exam_slug)
      VALUES ('exam-oppe', 'OPPE', 'oppe')
    `;

    await context.database.sql`
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
        'variant-oppe',
        'paper-oppe',
        'exam-oppe',
        'course-1',
        2,
        '0',
        45,
        'Computational Thinking OPPE 2025',
        'Unsupported exam fixture paper',
        2025,
        0,
        'fixtures/paper-oppe.json'
      )
    `;

    const { response, json } = await context.getJson<{
      courses: Array<{ examSlug: string }>;
      papers: Array<{ examSlug: string }>;
    }>('/api/search?q=computational');

    expect(response.status).toBe(200);
    expect(json.courses.map((course) => course.examSlug)).toEqual(['quiz1']);
    expect(json.papers.every((paper) => paper.examSlug !== 'oppe')).toBe(true);
  });

  test('keeps supported search matches when unsupported exams would otherwise fill the window', async () => {
    await context.database.sql`
      INSERT INTO exams (source_uuid, exam_name, exam_slug)
      VALUES ('exam-oppe-many', 'OPPE', 'oppe')
    `;

    for (let i = 0; i < 30; i++) {
      const year = 1900 + i;
      await context.database.sql`
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
          ${`variant-oppe-many-${i}`},
          ${`paper-oppe-many-${i}`},
          'exam-oppe-many',
          'course-1',
          10 + ${i},
          '1',
          45,
          'Computational Thinking OPPE filler',
          'Unsupported exam filler paper',
          ${year},
          0,
          ${`fixtures/paper-oppe-many-${i}.json`}
        )
      `;
    }

    const { response, json } = await context.getJson<{
      courses: Array<{ examSlug: string }>;
      papers: Array<{ examSlug: string; uuid: string }>;
    }>('/api/search?q=computational');

    expect(response.status).toBe(200);
    expect(json.courses.map((course) => course.examSlug)).toEqual(['quiz1']);
    expect(json.papers.some((paper) => paper.uuid === 'paper-2025')).toBe(true);
    expect(json.papers.every((paper) => paper.examSlug !== 'oppe')).toBe(true);
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

describe('Praxis API authenticated routes', () => {
  test('rejects paper PDF without a verified user', async () => {
    const response = await context.fetchHandler(
      new Request('http://local.test/api/papers/paper-2025/pdf?courseUuid=course-1&examUuid=exam-1'),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  test('returns a private PDF attachment for a signed-in user', async () => {
    const payload = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const handler = createApiFetchHandler(context.database.sql, {
      resolveUserId: async () => 'user_pdf_1',
      printHtmlToPdf: async (html) => {
        expect(html).toContain('Praxis reconstruction');
        expect(html).toContain('Computational Thinking');
        return payload;
      },
    });

    const response = await handler(
      new Request('http://local.test/api/papers/paper-2025/pdf?courseUuid=course-1&examUuid=exam-1'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-disposition')).toContain('Computational-Thinking-Quiz-1.pdf');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(payload);
  });

  test('rejects /api/me requests without a verified user', async () => {
    const response = await context.fetchHandler(new Request('http://local.test/api/me/saved'));

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  test('saves, lists, and removes a paper for the signed-in user', async () => {
    const handler = authedHandler('user_test_1');
    const base = 'http://local.test/api/me/saved';

    const add = await handler(
      new Request(base, { method: 'POST', body: JSON.stringify({ paperId: 'variant-2025' }) }),
    );
    expect(add.status).toBe(200);
    expect(await add.json()).toMatchObject({ ok: true, paperId: 'variant-2025' });

    const listed = await handler(new Request(base));
    const listedJson = (await listed.json()) as Array<{ id: string; uuid: string }>;
    expect(listed.headers.get('cache-control')).toBe('private, no-store');
    expect(listedJson).toHaveLength(1);
    expect(listedJson[0]).toMatchObject({ id: 'variant-2025', uuid: 'paper-2025' });

    const removed = await handler(new Request(`${base}/variant-2025`, { method: 'DELETE' }));
    expect(removed.status).toBe(200);

    const empty = await handler(new Request(base));
    expect(await empty.json()).toEqual([]);
  });

  test('rejects saving an unknown paper id', async () => {
    const handler = authedHandler('user_test_2');
    const response = await handler(
      new Request('http://local.test/api/me/saved', {
        method: 'POST',
        body: JSON.stringify({ paperId: 'does-not-exist' }),
      }),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Paper not found' });
  });

  test('records and lists view history', async () => {
    const handler = authedHandler('user_test_3');
    const record = await handler(
      new Request('http://local.test/api/me/history', {
        method: 'POST',
        body: JSON.stringify({ paperId: 'variant-2024' }),
      }),
    );
    expect(record.status).toBe(200);

    const history = await handler(new Request('http://local.test/api/me/history'));
    const historyJson = (await history.json()) as Array<{ id: string; uuid: string }>;
    expect(historyJson).toHaveLength(1);
    expect(historyJson[0]).toMatchObject({ id: 'variant-2024', uuid: 'paper-2024' });
  });

  test('saves and lists the user course selection with level', async () => {
    const handler = authedHandler('user_test_courses');
    const base = 'http://local.test/api/me/courses';

    const empty = await handler(new Request(base));
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ level: null, courseKeys: [] });

    const saved = await handler(
      new Request(base, {
        method: 'POST',
        body: JSON.stringify({
          level: 'Foundation',
          courseKeys: ['Computational Thinking', 'Computational Thinking', 'Statistics I'],
        }),
      }),
    );
    expect(saved.status).toBe(200);

    const listed = await handler(new Request(base));
    const json = (await listed.json()) as { level: string | null; courseKeys: string[] };
    expect(json.level).toBe('Foundation');
    // De-duplicated, both kept.
    expect([...json.courseKeys].sort()).toEqual(['Computational Thinking', 'Statistics I']);

    // A second save replaces the whole set rather than appending.
    await handler(
      new Request(base, {
        method: 'POST',
        body: JSON.stringify({ level: 'Diploma in Programming', courseKeys: ['Statistics I'] }),
      }),
    );
    const replaced = await handler(new Request(base));
    const replacedJson = (await replaced.json()) as { level: string | null; courseKeys: string[] };
    expect(replacedJson.level).toBe('Diploma in Programming');
    expect(replacedJson.courseKeys).toEqual(['Statistics I']);
  });
});

describe('Praxis API course catalogue', () => {
  test('lists every course across exams with paper counts and exam slugs', async () => {
    const { response, json } = await context.getJson<
      Array<{ uuid: string; courseName: string; paperCount: number; examSlugs: string[] }>
    >('/api/courses');

    expect(response.status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0]).toMatchObject({
      uuid: 'course-1',
      courseName: 'Computational Thinking',
      courseCode: 'CT',
      paperCount: 2,
    });
    expect(json[0]?.examSlugs).toEqual(['quiz1']);
  });

  test('drops courses that only have unsupported exam slugs from the catalogue feed', async () => {
    await context.database.sql`
      INSERT INTO exams (source_uuid, exam_name, exam_slug)
      VALUES ('exam-oppe-course', 'OPPE', 'oppe')
    `;
    await context.database.sql`
      INSERT INTO courses (source_uuid, course_name, course_code, program_id, label, canonical_name)
      VALUES ('course-oppe', 'Only OPPE Course', 'OPPE', 1, 'Foundation', 'Only OPPE Course')
    `;
    await context.database.sql`
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
        'variant-oppe-course',
        'paper-oppe-course',
        'exam-oppe-course',
        'course-oppe',
        7,
        '1',
        45,
        'Only OPPE Course Paper',
        'Unsupported-only course fixture paper',
        2025,
        0,
        'fixtures/paper-oppe-course.json'
      )
    `;

    const { response, json } = await context.getJson<
      Array<{ uuid: string; courseName: string; paperCount: number; examSlugs: string[] }>
    >('/api/courses');

    expect(response.status).toBe(200);
    expect(json.find((course) => course.uuid === 'course-oppe')).toBeUndefined();
  });
});
