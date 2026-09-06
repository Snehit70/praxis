import type { DbClient } from './db';
import type { QuizQuestion } from '../src/lib/dataTransforms';

export async function loadQuizQuestions(
  sql: DbClient,
  variantId: string,
): Promise<QuizQuestion[]> {
  const questionRows = await sql<
    Array<{
      id: string;
      uuid: string;
      questionNumber: number;
      questionType: QuizQuestion['questionType'];
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

  if (questionRows.length === 0) return [];

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

  return questionRows.map((question) => ({
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
      optionImage: option.optionImage || undefined,
      score: option.score,
      isCorrect: option.isCorrect,
      optionNumber: option.optionNumber === null ? undefined : Number(option.optionNumber),
    })),
  }));
}
