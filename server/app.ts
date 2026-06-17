import { createClerkClient } from '@clerk/backend';
import type { DbClient } from './db';
import {
  buildPaperBundles,
  getCourseUuids,
  getSearchPattern,
} from './paperCatalogue';
import { isSupportedExamSlug } from '../src/lib/examMapping';

const allowedOrigin = process.env.API_ALLOWED_ORIGIN?.trim() || '*';
const cacheableApiResponse = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

// Auth: a Clerk client is only created when a secret key is configured, so the
// public API keeps working (and tests keep passing) without Clerk credentials.
// When absent, the authenticated /api/me/* routes return 401.
const clerkSecretKey = process.env.CLERK_SECRET_KEY?.trim();
// authenticateRequest() validates the publishable key too, not just the secret.
// createClerkClient auto-reads CLERK_PUBLISHABLE_KEY; this app only sets the
// VITE_-prefixed var (shared .env, loaded wholesale by Bun), so pass it through.
const clerkPublishableKey = (
  process.env.CLERK_PUBLISHABLE_KEY ?? process.env.VITE_CLERK_PUBLISHABLE_KEY
)?.trim();
const clerk = clerkSecretKey
  ? createClerkClient({ secretKey: clerkSecretKey, publishableKey: clerkPublishableKey })
  : null;
const authorizedParties = allowedOrigin === '*' ? undefined : [allowedOrigin];

function corsHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json',
    'access-control-allow-origin': allowedOrigin,
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
  };
}

function json(data: unknown, status = 200) {
  const headers = corsHeaders();
  if (status === 200) {
    headers['cache-control'] = cacheableApiResponse;
  }

  return new Response(JSON.stringify(data), { status, headers });
}

// Per-user responses must never land in a shared/CDN cache.
function jsonPrivate(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), 'cache-control': 'private, no-store' },
  });
}

function notFound(message: string) {
  return json({ error: message }, 404);
}

/**
 * Resolve the Clerk user id for a request, or null if unauthenticated / Clerk
 * is not configured. Verifies the session token from the Authorization header.
 */
async function getUserId(request: Request): Promise<string | null> {
  if (!clerk) return null;
  try {
    const requestState = await clerk.authenticateRequest(
      request,
      authorizedParties ? { authorizedParties } : {},
    );
    return requestState.toAuth()?.userId ?? null;
  } catch (error) {
    console.error('Clerk authentication failed', error);
    return null;
  }
}

export interface ApiHandlerOptions {
  /** Override session resolution (used in tests). Defaults to Clerk verification. */
  resolveUserId?: (request: Request) => Promise<string | null>;
}

export function createApiFetchHandler(sql: DbClient, options: ApiHandlerOptions = {}) {
  const resolveUserId = options.resolveUserId ?? getUserId;
  async function resolvePaperVariantId(
    paperUuid: string,
    courseUuid: string | null,
    examUuid: string | null,
  ) {
    const rows = await sql<
      Array<{
        id: string;
      }>
    >`
      SELECT id
      FROM paper_variants
      WHERE source_uuid = ${paperUuid}
        ${courseUuid ? sql`AND course_uuid = ${courseUuid}` : sql``}
        ${examUuid ? sql`AND exam_uuid = ${examUuid}` : sql``}
      ORDER BY year DESC, created_at DESC NULLS LAST
      LIMIT 1
    `;

    return rows[0]?.id ?? null;
  }

  return async function fetch(request: Request) {
    try {
      const url = new URL(request.url);

      if (request.method === 'OPTIONS') {
        return json({ ok: true });
      }

      // Authenticated, per-user routes. Handled before the GET-only guard
      // because they use POST/DELETE for writes.
      if (url.pathname.startsWith('/api/me/')) {
        const userId = await resolveUserId(request);
        if (!userId) {
          return jsonPrivate({ error: 'Unauthorized' }, 401);
        }

        // Lazily mirror the Clerk user so saved/history rows have an owner.
        await sql`
          INSERT INTO users (clerk_user_id) VALUES (${userId})
          ON CONFLICT (clerk_user_id) DO NOTHING
        `;

        if (url.pathname === '/api/me/saved') {
          if (request.method === 'GET') {
            const rows = await sql<
              Array<{
                id: string;
                uuid: string;
                paperName: string;
                examUuid: string;
                examName: string;
                courseUuid: string;
                courseName: string;
                year: number | null;
                savedAt: string | null;
              }>
            >`
              SELECT
                p.id AS "id",
                p.source_uuid AS "uuid",
                p.paper_name AS "paperName",
                p.exam_uuid AS "examUuid",
                e.exam_name AS "examName",
                p.course_uuid AS "courseUuid",
                c.course_name AS "courseName",
                p.year,
                s.created_at::text AS "savedAt"
              FROM saved_papers s
              JOIN paper_variants p ON p.id = s.paper_id
              JOIN exams e ON e.source_uuid = p.exam_uuid
              JOIN courses c ON c.source_uuid = p.course_uuid
              WHERE s.clerk_user_id = ${userId}
              ORDER BY s.created_at DESC
            `;
            return jsonPrivate(rows);
          }

          if (request.method === 'POST') {
            const body = (await request.json().catch(() => null)) as { paperId?: string } | null;
            const paperId = body?.paperId?.trim();
            if (!paperId) {
              return jsonPrivate({ error: 'paperId is required' }, 400);
            }
            const [paper] = await sql<Array<{ id: string }>>`
              SELECT id FROM paper_variants WHERE id = ${paperId} LIMIT 1
            `;
            if (!paper) {
              return jsonPrivate({ error: 'Paper not found' }, 404);
            }
            await sql`
              INSERT INTO saved_papers (clerk_user_id, paper_id)
              VALUES (${userId}, ${paperId})
              ON CONFLICT (clerk_user_id, paper_id) DO NOTHING
            `;
            return jsonPrivate({ ok: true, paperId });
          }

          return jsonPrivate({ error: 'Method not allowed' }, 405);
        }

        const savedItemMatch = url.pathname.match(/^\/api\/me\/saved\/([^/]+)$/);
        if (savedItemMatch && request.method === 'DELETE') {
          const paperId = decodeURIComponent(savedItemMatch[1] ?? '');
          await sql`
            DELETE FROM saved_papers
            WHERE clerk_user_id = ${userId} AND paper_id = ${paperId}
          `;
          return jsonPrivate({ ok: true, paperId });
        }

        if (url.pathname === '/api/me/history') {
          if (request.method === 'GET') {
            const rows = await sql<
              Array<{
                id: string;
                uuid: string;
                paperName: string;
                examUuid: string;
                examName: string;
                courseUuid: string;
                courseName: string;
                year: number | null;
                viewedAt: string | null;
              }>
            >`
              SELECT DISTINCT ON (v.paper_id)
                p.id AS "id",
                p.source_uuid AS "uuid",
                p.paper_name AS "paperName",
                p.exam_uuid AS "examUuid",
                e.exam_name AS "examName",
                p.course_uuid AS "courseUuid",
                c.course_name AS "courseName",
                p.year,
                v.viewed_at::text AS "viewedAt"
              FROM paper_views v
              JOIN paper_variants p ON p.id = v.paper_id
              JOIN exams e ON e.source_uuid = p.exam_uuid
              JOIN courses c ON c.source_uuid = p.course_uuid
              WHERE v.clerk_user_id = ${userId}
              ORDER BY v.paper_id, v.viewed_at DESC
            `;
            // Re-sort by recency (DISTINCT ON forces paper_id ordering above).
            rows.sort((a, b) => (b.viewedAt ?? '').localeCompare(a.viewedAt ?? ''));
            return jsonPrivate(rows.slice(0, 50));
          }

          if (request.method === 'POST') {
            const body = (await request.json().catch(() => null)) as { paperId?: string } | null;
            const paperId = body?.paperId?.trim();
            if (!paperId) {
              return jsonPrivate({ error: 'paperId is required' }, 400);
            }
            const [paper] = await sql<Array<{ id: string }>>`
              SELECT id FROM paper_variants WHERE id = ${paperId} LIMIT 1
            `;
            if (!paper) {
              return jsonPrivate({ error: 'Paper not found' }, 404);
            }
            await sql`
              INSERT INTO paper_views (clerk_user_id, paper_id)
              VALUES (${userId}, ${paperId})
            `;
            return jsonPrivate({ ok: true, paperId });
          }

          return jsonPrivate({ error: 'Method not allowed' }, 405);
        }

        // Courses the user is taking this term, plus their program level.
        if (url.pathname === '/api/me/courses') {
          if (request.method === 'GET') {
            const [profile] = await sql<Array<{ level: string | null }>>`
              SELECT level FROM users WHERE clerk_user_id = ${userId} LIMIT 1
            `;
            const rows = await sql<Array<{ courseKey: string }>>`
              SELECT course_key AS "courseKey"
              FROM user_courses
              WHERE clerk_user_id = ${userId}
              ORDER BY created_at ASC, course_key ASC
            `;
            return jsonPrivate({
              level: profile?.level ?? null,
              courseKeys: rows.map((row) => row.courseKey),
            });
          }

          if (request.method === 'POST') {
            const body = (await request.json().catch(() => null)) as {
              courseKeys?: unknown;
              level?: unknown;
            } | null;

            const courseKeys = Array.isArray(body?.courseKeys)
              ? Array.from(
                  new Set(
                    body!.courseKeys
                      .filter((key): key is string => typeof key === 'string')
                      .map((key) => key.trim())
                      .filter(Boolean),
                  ),
                )
              : [];

            const level =
              typeof body?.level === 'string' && body.level.trim() ? body.level.trim() : null;

            await sql`UPDATE users SET level = ${level} WHERE clerk_user_id = ${userId}`;

            // Replace the whole set so the client can save the selector as one unit.
            await sql`DELETE FROM user_courses WHERE clerk_user_id = ${userId}`;
            if (courseKeys.length > 0) {
              const values = courseKeys.map((key) => ({
                clerk_user_id: userId,
                course_key: key,
              }));
              await sql`
                INSERT INTO user_courses ${sql(values, 'clerk_user_id', 'course_key')}
                ON CONFLICT (clerk_user_id, course_key) DO NOTHING
              `;
            }

            return jsonPrivate({ ok: true, level, courseKeys });
          }

          return jsonPrivate({ error: 'Method not allowed' }, 405);
        }

        return jsonPrivate({ error: 'Route not found' }, 404);
      }

      if (request.method !== 'GET') {
        return json({ error: 'Method not allowed' }, 405);
      }

      if (url.pathname === '/api/health') {
        return json({ ok: true });
      }

      if (url.pathname === '/api/health/db') {
        const [row] = await sql<Array<{ ok: number }>>`SELECT 1 AS ok`;
        return json({ ok: row?.ok === 1 });
      }

      if (url.pathname === '/api/stats') {
        const [stats] = await sql<
          Array<{
            examCount: number;
            courseCount: number;
            paperVariantCount: number;
            questionCount: number;
          }>
        >`
          SELECT
            (SELECT COUNT(*)::int FROM exams) AS "examCount",
            (SELECT COUNT(*)::int FROM courses) AS "courseCount",
            (SELECT COUNT(*)::int FROM paper_variants) AS "paperVariantCount",
            (SELECT COUNT(*)::int FROM questions) AS "questionCount"
        `;

        return json(stats);
      }

      // Full course catalogue (across every exam type) for the dashboard's
      // course selector / archives. One row per source course that has papers,
      // with its total paper count and the set of exam slugs it appears in.
      if (url.pathname === '/api/courses') {
        const rows = await sql<
          Array<{
            uuid: string;
            courseName: string;
            courseCode: string;
            programId: number;
            paperCount: number;
            examSlugs: string[];
          }>
        >`
          SELECT
            c.source_uuid AS "uuid",
            c.course_name AS "courseName",
            c.course_code AS "courseCode",
            c.program_id AS "programId",
            COUNT(p.id)::int AS "paperCount",
            COALESCE(ARRAY_AGG(DISTINCT e.exam_slug), '{}') AS "examSlugs"
          FROM courses c
          JOIN paper_variants p ON p.course_uuid = c.source_uuid
          JOIN exams e ON e.source_uuid = p.exam_uuid
          GROUP BY c.source_uuid, c.course_name, c.course_code, c.program_id
          ORDER BY c.course_name ASC
        `;

        return json(rows);
      }

      if (url.pathname === '/api/search') {
        const { query, pattern, prefixPattern } = getSearchPattern(url.searchParams);

        if (!query) {
          return json({ courses: [], papers: [] });
        }

        const courses = await sql<
          Array<{
            uuid: string;
            courseName: string;
            courseCode: string;
            examUuid: string;
            examName: string;
            examSlug: string;
            paperCount: number;
          }>
        >`
          SELECT
            c.source_uuid AS "uuid",
            c.course_name AS "courseName",
            c.course_code AS "courseCode",
            e.source_uuid AS "examUuid",
            e.exam_name AS "examName",
            e.exam_slug AS "examSlug",
            COUNT(*)::int AS "paperCount"
          FROM paper_variants p
          JOIN courses c ON c.source_uuid = p.course_uuid
          JOIN exams e ON e.source_uuid = p.exam_uuid
          WHERE c.course_name ILIKE ${pattern} ESCAPE '\\'
             OR c.course_code ILIKE ${pattern} ESCAPE '\\'
             OR c.canonical_name ILIKE ${pattern} ESCAPE '\\'
          GROUP BY c.source_uuid, c.course_name, c.course_code, e.source_uuid, e.exam_name, e.exam_slug
          ORDER BY
            CASE
              WHEN LOWER(c.course_code) = LOWER(${query}) THEN 0
              WHEN LOWER(c.course_name) = LOWER(${query}) THEN 1
              WHEN LOWER(c.course_name) LIKE LOWER(${prefixPattern}) ESCAPE '\\' THEN 2
              ELSE 3
            END,
            COUNT(*) DESC,
            c.course_name ASC,
            e.exam_name ASC
          LIMIT 24
        `;

        const papers = await sql<
          Array<{
            uuid: string;
            paperName: string;
            paperDescription: string;
            year: number;
            duration: number;
            totalScore: string;
            isNew: number;
            examUuid: string;
            examName: string;
            examSlug: string;
            courseUuid: string;
            courseName: string;
            questionCount: number;
            calculatedTotalMarks: number;
          }>
        >`
          SELECT
            p.source_uuid AS "uuid",
            p.paper_name AS "paperName",
            p.paper_description AS "paperDescription",
            p.year,
            p.duration,
            p.total_score AS "totalScore",
            p.is_new AS "isNew",
            e.source_uuid AS "examUuid",
            e.exam_name AS "examName",
            e.exam_slug AS "examSlug",
            c.source_uuid AS "courseUuid",
            c.course_name AS "courseName",
            COUNT(*) FILTER (WHERE q.question_type <> 'COMPREHENSION')::int AS "questionCount",
            COALESCE(ROUND(SUM(CASE WHEN q.question_type <> 'COMPREHENSION' THEN q.total_mark_value ELSE 0 END)), 0)::int AS "calculatedTotalMarks"
          FROM paper_variants p
          JOIN exams e ON e.source_uuid = p.exam_uuid
          JOIN courses c ON c.source_uuid = p.course_uuid
          LEFT JOIN questions q ON q.paper_variant_id = p.id
          WHERE p.paper_name ILIKE ${pattern} ESCAPE '\\'
             OR p.paper_description ILIKE ${pattern} ESCAPE '\\'
             OR c.course_name ILIKE ${pattern} ESCAPE '\\'
             OR c.course_code ILIKE ${pattern} ESCAPE '\\'
          GROUP BY p.id, e.source_uuid, e.exam_name, e.exam_slug, c.source_uuid, c.course_name
          ORDER BY
            CASE
              WHEN LOWER(p.paper_name) = LOWER(${query}) THEN 0
              WHEN LOWER(p.paper_name) LIKE LOWER(${prefixPattern}) ESCAPE '\\' THEN 1
              WHEN LOWER(c.course_name) = LOWER(${query}) THEN 2
              ELSE 3
            END,
            p.year DESC,
            p.created_at DESC NULLS LAST
          LIMIT 24
        `;

        return json({
          courses: courses.filter((course) => isSupportedExamSlug(course.examSlug)),
          papers: papers.filter((paper) => isSupportedExamSlug(paper.examSlug)),
        });
      }

      const examCoursesMatch = url.pathname.match(/^\/api\/exams\/([^/]+)\/courses$/);
      if (examCoursesMatch) {
        const examUuid = decodeURIComponent(examCoursesMatch[1] ?? '');
        const rows = await sql<
          Array<{
            _id: string;
            uuid: string;
            courseName: string;
            courseCode: string;
            paperCount: number;
          }>
        >`
          SELECT
            c.source_uuid AS "_id",
            c.source_uuid AS "uuid",
            c.course_name AS "courseName",
            c.course_code AS "courseCode",
            COUNT(*)::int AS "paperCount"
          FROM paper_variants p
          JOIN courses c ON c.source_uuid = p.course_uuid
          WHERE p.exam_uuid = ${examUuid}
          GROUP BY c.source_uuid, c.course_name, c.course_code
          ORDER BY c.course_name ASC
        `;

        return json(rows);
      }

      const courseMatch = url.pathname.match(/^\/api\/exams\/([^/]+)\/courses\/([^/]+)$/);
      if (courseMatch) {
        const courseUuid = decodeURIComponent(courseMatch[2] ?? '');
        const [course] = await sql<
          Array<{
            uuid: string;
            course_name: string;
            course_code: string;
            program_id: number;
            label: string | null;
          }>
        >`
          SELECT
            source_uuid AS "uuid",
            course_name,
            course_code,
            program_id,
            label
          FROM courses
          WHERE source_uuid = ${courseUuid}
          LIMIT 1
        `;

        if (!course) {
          return notFound('Course not found');
        }

        return json(course);
      }

      const papersMatch = url.pathname.match(/^\/api\/exams\/([^/]+)\/courses\/([^/]+)\/papers$/);
      if (papersMatch) {
        const examUuid = decodeURIComponent(papersMatch[1] ?? '');
        const courseUuid = decodeURIComponent(papersMatch[2] ?? '');
        const courseUuids = getCourseUuids(url.searchParams, courseUuid);
        const rows = await sql<
          Array<{
            _id: string;
            uuid: string;
            courseUuid: string;
            paperName: string;
            paperDescription: string;
            year: number;
            duration: number;
            totalScore: string;
            isNew: number;
            createdAt: string | null;
            updatedAt: string | null;
            questionCount: number;
            calculatedTotalMarks: number;
          }>
        >`
          SELECT
            p.id AS "_id",
            p.source_uuid AS "uuid",
            p.course_uuid AS "courseUuid",
            p.paper_name AS "paperName",
            p.paper_description AS "paperDescription",
            p.year,
            p.duration,
            p.total_score AS "totalScore",
            p.is_new AS "isNew",
            p.created_at::text AS "createdAt",
            p.updated_at::text AS "updatedAt",
            COUNT(*) FILTER (WHERE q.question_type <> 'COMPREHENSION')::int AS "questionCount",
            COALESCE(ROUND(SUM(CASE WHEN q.question_type <> 'COMPREHENSION' THEN q.total_mark_value ELSE 0 END)), 0)::int AS "calculatedTotalMarks"
          FROM paper_variants p
          LEFT JOIN questions q ON q.paper_variant_id = p.id
          WHERE p.exam_uuid = ${examUuid} AND p.course_uuid IN ${sql(courseUuids)}
          GROUP BY p.id
          ORDER BY p.year DESC, p.created_at DESC NULLS LAST
        `;

        return json(rows);
      }

      const bundlesMatch = url.pathname.match(/^\/api\/exams\/([^/]+)\/courses\/([^/]+)\/bundles$/);
      if (bundlesMatch) {
        const examUuid = decodeURIComponent(bundlesMatch[1] ?? '');
        const courseUuid = decodeURIComponent(bundlesMatch[2] ?? '');
        const courseUuids = getCourseUuids(url.searchParams, courseUuid);

        const rows = await sql<
          Array<{
            _id: string;
            uuid: string;
            courseUuid: string;
            groupId: number;
            paperName: string;
            paperDescription: string;
            year: number | null;
            duration: number;
            totalScore: string;
            isNew: number;
            createdAt: string | null;
            updatedAt: string | null;
            questionCount: number;
            calculatedTotalMarks: number;
          }>
        >`
          SELECT
            p.id AS "_id",
            p.source_uuid AS "uuid",
            p.course_uuid AS "courseUuid",
            p.group_id AS "groupId",
            p.paper_name AS "paperName",
            p.paper_description AS "paperDescription",
            p.year,
            p.duration,
            p.total_score AS "totalScore",
            p.is_new AS "isNew",
            p.created_at::text AS "createdAt",
            p.updated_at::text AS "updatedAt",
            COUNT(*) FILTER (WHERE q.question_type <> 'COMPREHENSION')::int AS "questionCount",
            COALESCE(ROUND(SUM(CASE WHEN q.question_type <> 'COMPREHENSION' THEN q.total_mark_value ELSE 0 END)), 0)::int AS "calculatedTotalMarks"
          FROM paper_variants p
          LEFT JOIN questions q ON q.paper_variant_id = p.id
          WHERE p.exam_uuid = ${examUuid} AND p.course_uuid IN ${sql(courseUuids)}
          GROUP BY p.id
          ORDER BY p.created_at DESC NULLS LAST, p.id DESC
        `;

        return json(buildPaperBundles(rows));
      }

      const paperMatch = url.pathname.match(/^\/api\/papers\/([^/]+)$/);
      if (paperMatch) {
        const paperUuid = decodeURIComponent(paperMatch[1] ?? '');
        const courseUuid = url.searchParams.get('courseUuid');
        const examUuid = url.searchParams.get('examUuid');

        const [paper] = await sql<
          Array<{
            _id: string;
            uuid: string;
            paperName: string;
            paperDescription: string;
            year: number;
            duration: number;
            totalScore: string;
            isNew: number;
            createdAt: string | null;
            updatedAt: string | null;
            examName: string;
            examUuid: string;
            courseName: string;
            courseUuid: string;
          }>
        >`
          SELECT
            p.id AS "_id",
            p.source_uuid AS "uuid",
            p.paper_name AS "paperName",
            p.paper_description AS "paperDescription",
            p.year,
            p.duration,
            p.total_score AS "totalScore",
            p.is_new AS "isNew",
            p.created_at::text AS "createdAt",
            p.updated_at::text AS "updatedAt",
            e.exam_name AS "examName",
            p.exam_uuid AS "examUuid",
            c.course_name AS "courseName",
            p.course_uuid AS "courseUuid"
          FROM paper_variants p
          JOIN exams e ON e.source_uuid = p.exam_uuid
          JOIN courses c ON c.source_uuid = p.course_uuid
          WHERE p.source_uuid = ${paperUuid}
            ${courseUuid ? sql`AND p.course_uuid = ${courseUuid}` : sql``}
            ${examUuid ? sql`AND p.exam_uuid = ${examUuid}` : sql``}
          ORDER BY p.year DESC, p.created_at DESC NULLS LAST
          LIMIT 1
        `;

        if (!paper) {
          return notFound('Paper not found');
        }

        return json(paper);
      }

      const questionMatch = url.pathname.match(/^\/api\/papers\/([^/]+)\/questions$/);
      if (questionMatch) {
        const paperUuid = decodeURIComponent(questionMatch[1] ?? '');
        const courseUuid = url.searchParams.get('courseUuid');
        const examUuid = url.searchParams.get('examUuid');
        const variantId = await resolvePaperVariantId(paperUuid, courseUuid, examUuid);

        if (!variantId) {
          return notFound('Paper questions not found');
        }

        const questionRows = await sql<
          Array<{
            id: string;
            uuid: string;
            questionNumber: number;
            questionType: string;
            totalMark: string;
            hash: string;
            questionText1: string | null;
            questionText2: string | null;
            questionText3: string | null;
            questionText4: string | null;
            questionText5: string | null;
            questionImage1: string | null;
            questionImage2: string | null;
            questionImage3: string | null;
            questionImage4: string | null;
            questionImage5: string | null;
            questionImage6: string | null;
            questionImage7: string | null;
            questionImage8: string | null;
            questionImage9: string | null;
            questionImage10: string | null;
            answerType: string | null;
            responseType: string | null;
            valueStart: string | null;
            valueEnd: string | null;
            parentQuestionUuid: string | null;
            isMarkdown: number;
            haveAnswers: number;
            questionNumLong: number;
          }>
        >`
          SELECT
            id,
            source_uuid AS "uuid",
            question_number AS "questionNumber",
            question_type AS "questionType",
            total_mark AS "totalMark",
            hash,
            question_text_1 AS "questionText1",
            question_text_2 AS "questionText2",
            question_text_3 AS "questionText3",
            question_text_4 AS "questionText4",
            question_text_5 AS "questionText5",
            question_image_1 AS "questionImage1",
            question_image_2 AS "questionImage2",
            question_image_3 AS "questionImage3",
            question_image_4 AS "questionImage4",
            question_image_5 AS "questionImage5",
            question_image_6 AS "questionImage6",
            question_image_7 AS "questionImage7",
            question_image_8 AS "questionImage8",
            question_image_9 AS "questionImage9",
            question_image_10 AS "questionImage10",
            answer_type AS "answerType",
            response_type AS "responseType",
            value_start AS "valueStart",
            value_end AS "valueEnd",
            parent_question_uuid AS "parentQuestionUuid",
            is_markdown AS "isMarkdown",
            have_answers AS "haveAnswers",
            question_num_long AS "questionNumLong"
          FROM questions
          WHERE paper_variant_id = ${variantId}
          ORDER BY question_number ASC, question_num_long ASC
        `;

        if (questionRows.length === 0) {
          return json([]);
        }

        const optionRows = await sql<
          Array<{
            questionId: string;
            optionText: string;
            optionImage: string | null;
            score: string;
            isCorrect: number;
            optionNumber: number | null;
            optionPosition: number;
          }>
        >`
          SELECT
            question_id AS "questionId",
            option_text AS "optionText",
            option_image AS "optionImage",
            score,
            is_correct AS "isCorrect",
            option_number AS "optionNumber",
            option_position AS "optionPosition"
          FROM options
          WHERE question_id IN ${sql(questionRows.map((question) => question.id))}
          ORDER BY option_number ASC NULLS LAST, option_position ASC
        `;

        const optionsByQuestionId = new Map<string, Array<(typeof optionRows)[number]>>();
        for (const optionRow of optionRows) {
          const current = optionsByQuestionId.get(optionRow.questionId) ?? [];
          current.push(optionRow);
          optionsByQuestionId.set(optionRow.questionId, current);
        }

        return json(
          questionRows.map((question) => ({
            uuid: question.uuid,
            questionNumber: question.questionNumber,
            questionType: question.questionType,
            totalMark: question.totalMark,
            hash: question.hash,
            questionText1: question.questionText1 ?? undefined,
            questionText2: question.questionText2 ?? undefined,
            questionText3: question.questionText3 ?? undefined,
            questionText4: question.questionText4 ?? undefined,
            questionText5: question.questionText5 ?? undefined,
            questionImage1: question.questionImage1 ?? undefined,
            questionImage2: question.questionImage2 ?? undefined,
            questionImage3: question.questionImage3 ?? undefined,
            questionImage4: question.questionImage4 ?? undefined,
            questionImage5: question.questionImage5 ?? undefined,
            questionImage6: question.questionImage6 ?? undefined,
            questionImage7: question.questionImage7 ?? undefined,
            questionImage8: question.questionImage8 ?? undefined,
            questionImage9: question.questionImage9 ?? undefined,
            questionImage10: question.questionImage10 ?? undefined,
            answerType: question.answerType ?? undefined,
            responseType: question.responseType ?? undefined,
            valueStart: question.valueStart ?? undefined,
            valueEnd: question.valueEnd ?? undefined,
            parentQuestionUuid: question.parentQuestionUuid ?? undefined,
            isMarkdown: question.isMarkdown,
            haveAnswers: question.haveAnswers,
            questionNumLong: Number(question.questionNumLong),
            options: (optionsByQuestionId.get(question.id) ?? []).map((option) => ({
              optionText: option.optionText,
              optionImage: option.optionImage ?? undefined,
              score: option.score,
              isCorrect: option.isCorrect,
              optionNumber:
                option.optionNumber === null ? undefined : Number(option.optionNumber),
            })),
          })),
        );
      }

      return notFound('Route not found');
    } catch (error) {
      console.error('API request failed', error);
      return json({ error: 'Internal server error' }, 500);
    }
  };
}
