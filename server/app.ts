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

interface ParsedBundleDate {
  year: number;
  month: number;
  day: number;
  score: number;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function parseBundleDate(text: string | null | undefined): ParsedBundleDate | null {
  if (!text) return null;
  const normalized = text.replaceAll(',', ' ').replaceAll(':', ' ').trim();
  if (!normalized) return null;

  const patterns: Array<RegExp> = [
    // 2025 Aug3 or 2025 Aug 3
    /\b(20\d{2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{1,2})?\b/i,
    // 03 Aug 2025 or 03 Aug 25
    /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{2}|\d{4})\b/i,
    // Aug 3 2025 or Aug3 2025 or Aug 3 25
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{1,2})\s+(\d{2}|\d{4})\b/i,
    // Aug 2025 or Aug25
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{2}|\d{4})\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    let year = 0;
    let month = 0;
    let day = 1;
    let score = 0;

    if (pattern === patterns[0]) {
      year = Number.parseInt(match[1] ?? '0', 10);
      month = MONTHS[match[2]?.slice(0, 3).toLowerCase() ?? ''] ?? 0;
      day = match[3] ? Number.parseInt(match[3], 10) : 1;
      score = 6;
    } else if (pattern === patterns[1]) {
      day = Number.parseInt(match[1] ?? '1', 10);
      month = MONTHS[match[2]?.slice(0, 3).toLowerCase() ?? ''] ?? 0;
      year = Number.parseInt(match[3] ?? '0', 10);
      score = 6;
    } else if (pattern === patterns[2]) {
      month = MONTHS[match[1]?.slice(0, 3).toLowerCase() ?? ''] ?? 0;
      day = Number.parseInt(match[2] ?? '1', 10);
      year = Number.parseInt(match[3] ?? '0', 10);
      score = 6;
    } else {
      month = MONTHS[match[1]?.slice(0, 3).toLowerCase() ?? ''] ?? 0;
      year = Number.parseInt(match[2] ?? '0', 10);
      day = 1;
      score = 4;
    }

    if (year > 0 && year < 100) year += 2000;
    if (!year || !month || day < 1 || day > 31) continue;
    return { year, month, day, score };
  }

  return null;
}

function compareParsedBundleDate(left: ParsedBundleDate | null, right: ParsedBundleDate | null) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  if (left.score !== right.score) return right.score - left.score;
  const leftTime = Date.UTC(left.year, left.month - 1, left.day);
  const rightTime = Date.UTC(right.year, right.month - 1, right.day);
  return rightTime - leftTime;
}

function inferTerm(month: number): number | null {
  if (month >= 2 && month <= 5) return 1;
  if (month >= 6 && month <= 9) return 2;
  if (month >= 10 || month === 1) return 3;
  return null;
}

function formatDateLabel(date: ParsedBundleDate) {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
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

  function getSearchPattern(searchParams: URLSearchParams) {
    const query = searchParams.get('q')?.trim() ?? '';
    const escapedQuery = query.replaceAll(/[%_]/g, '\\$&');
    return {
      query,
      pattern: `%${escapedQuery}%`,
      prefixPattern: `${escapedQuery}%`,
    };
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

        return json({ courses, papers });
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

        const grouped = new Map<
          number,
          {
            groupId: number;
            bundleLabel: string;
            dateLabel: string;
            termLabel: string | null;
            sortTime: number;
            papers: typeof rows;
          }
        >();

        for (const row of rows) {
          const bucket = grouped.get(row.groupId) ?? {
            groupId: row.groupId,
            bundleLabel: row.groupId === 1 ? 'Others' : `QP Bundle ${row.groupId}`,
            dateLabel: row.groupId === 1 ? 'Others' : 'Unknown',
            termLabel: null,
            sortTime: 0,
            papers: [],
          };

          bucket.papers.push(row);
          grouped.set(row.groupId, bucket);
        }

        const bundles: Array<{
          groupId: number;
          bundleLabel: string;
          dateLabel: string;
          termLabel: string | null;
          sortTime: number;
          variantCount: number;
          papers: typeof rows;
        }> = Array.from(grouped.values()).map((bundle) => {
          if (bundle.groupId === 1) {
            return {
              groupId: bundle.groupId,
              bundleLabel: bundle.bundleLabel,
              dateLabel: bundle.dateLabel,
              termLabel: null,
              sortTime: -1,
              variantCount: bundle.papers.length,
              papers: bundle.papers,
            };
          }

          let bestDate: ParsedBundleDate | null = null;
          for (const paper of bundle.papers) {
            const fromName = parseBundleDate(paper.paperName);
            const fromDescription = parseBundleDate(paper.paperDescription);
            const candidate = compareParsedBundleDate(fromName, fromDescription) <= 0 ? fromName : fromDescription;
            if (compareParsedBundleDate(candidate, bestDate) < 0) {
              bestDate = candidate;
            }
          }

          const term = bestDate ? inferTerm(bestDate.month) : null;
          const termLabel = bestDate && term ? `Term ${term} ${bestDate.year}` : null;
          const fallbackCreatedAt = bundle.papers.reduce((latest, paper) => {
            const time = paper.createdAt ? Date.parse(paper.createdAt) : 0;
            return time > latest ? time : latest;
          }, 0);

          return {
            groupId: bundle.groupId,
            bundleLabel: bundle.bundleLabel,
            dateLabel: bestDate ? formatDateLabel(bestDate) : bundle.dateLabel,
            termLabel,
            sortTime: bestDate
              ? Date.UTC(bestDate.year, bestDate.month - 1, bestDate.day)
              : fallbackCreatedAt,
            variantCount: bundle.papers.length,
            papers: bundle.papers.sort((a, b) => {
              const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
              const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
              return bTime - aTime;
            }),
          };
        });

        const sortedBundles = bundles
          .sort((a, b) => {
            if (a.groupId === 1 && b.groupId !== 1) return 1;
            if (b.groupId === 1 && a.groupId !== 1) return -1;
            if (a.sortTime !== b.sortTime) return b.sortTime - a.sortTime;
            return b.groupId - a.groupId;
          })
          .map((bundle) => ({
            groupId: bundle.groupId,
            bundleLabel: bundle.bundleLabel,
            dateLabel: bundle.dateLabel,
            termLabel: bundle.termLabel,
            variantCount: bundle.variantCount,
            papers: bundle.papers,
          }));

        return json(sortedBundles);
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
