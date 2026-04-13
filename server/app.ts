import type { DbClient } from './db';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });
}

function notFound(message: string) {
  return json({ error: message }, 404);
}

export function createApiFetchHandler(sql: DbClient) {
  function getCourseUuids(searchParams: URLSearchParams, fallbackCourseUuid: string) {
    const requested = searchParams
      .get('courseUuids')
      ?.split(',')
      .map((value) => decodeURIComponent(value.trim()))
      .filter(Boolean) ?? [];

    return Array.from(new Set(requested.length > 0 ? requested : [fallbackCourseUuid]));
  }

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

      if (request.method !== 'GET') {
        return json({ error: 'Method not allowed' }, 405);
      }

      if (url.pathname === '/api/health') {
        return json({ ok: true });
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
          }>
        >`
          SELECT
            question_id AS "questionId",
            option_text AS "optionText",
            option_image AS "optionImage",
            score,
            is_correct AS "isCorrect",
            option_number AS "optionNumber"
          FROM options
          WHERE question_id IN ${sql(questionRows.map((question) => question.id))}
          ORDER BY option_number ASC NULLS LAST
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
