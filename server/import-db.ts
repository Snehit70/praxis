import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createDbClient } from './db';
import { ensureSchema, resetSchema } from './schema';
import { getCanonicalCourseName } from '../src/lib/courseMapping';
import { shouldIncludeQuestion, type RawExamMetadata, type RawPaperFile } from '../src/lib/dataTransforms';
import { EXAM_UUID_TO_SLUG } from '../src/lib/examMapping';

interface ExamRow {
  source_uuid: string;
  exam_name: string;
  exam_slug: string;
  en_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface CourseRow {
  source_uuid: string;
  course_name: string;
  course_code: string;
  program_id: number;
  label: string | null;
  canonical_name: string;
  created_at: string | null;
  updated_at: string | null;
}

interface PaperVariantRow {
  id: string;
  source_uuid: string;
  exam_uuid: string;
  course_uuid: string;
  group_id: number;
  total_score: string;
  duration: number;
  paper_name: string;
  paper_description: string;
  year: number | null;
  is_new: number;
  created_at: string | null;
  updated_at: string | null;
  source_path: string;
}

interface QuestionRow {
  id: string;
  source_uuid: string;
  paper_variant_id: string;
  question_number: number;
  question_type: string;
  total_mark: string;
  total_mark_value: number;
  hash: string;
  question_text_1: string | null;
  question_text_2: string | null;
  question_text_3: string | null;
  question_text_4: string | null;
  question_text_5: string | null;
  question_image_1: string | null;
  question_image_2: string | null;
  question_image_3: string | null;
  question_image_4: string | null;
  question_image_5: string | null;
  question_image_6: string | null;
  question_image_7: string | null;
  question_image_8: string | null;
  question_image_9: string | null;
  question_image_10: string | null;
  answer_type: string | null;
  response_type: string | null;
  value_start: string | null;
  value_end: string | null;
  parent_question_uuid: string | null;
  is_markdown: number;
  have_answers: number;
  question_num_long: number;
  created_at: string | null;
  updated_at: string | null;
}

interface OptionRow {
  id: string;
  question_id: string;
  option_text: string;
  option_image: string | null;
  score: string;
  is_correct: number;
  option_number: number | null;
  option_position: number;
  created_at: string | null;
  updated_at: string | null;
}

const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), 'data-new'));

function paperVariantId(examUuid: string, courseUuid: string, paperUuid: string) {
  return `${examUuid}:${courseUuid}:${paperUuid}`;
}

function questionId(paperId: string, questionUuid: string) {
  return `${paperId}:${questionUuid}`;
}

function optionId(questionIdValue: string, optionIndex: number) {
  return `${questionIdValue}:${optionIndex}`;
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function sanitizeSqlValue(value: unknown) {
  if (typeof value === 'string') {
    return value.replaceAll('\u0000', '');
  }

  return value;
}

function collectImportRows() {
  const exams = new Map<string, ExamRow>();
  const courses = new Map<string, CourseRow>();
  const paperVariants: PaperVariantRow[] = [];
  const questions: QuestionRow[] = [];
  const options: OptionRow[] = [];
  const skippedPaperPaths: string[] = [];
  let skippedCourseResolutionCount = 0;

  for (const metadataPath of readdirSync(DATA_DIR)) {
    const examDir = path.join(DATA_DIR, metadataPath);
    const metadataFile = path.join(examDir, 'metadata.json');
    if (!existsSync(examDir) || !existsSync(metadataFile)) {
      continue;
    }

    try {
      const metadata = readJsonFile<RawExamMetadata>(metadataFile);
      const examUuid = metadata.exam.uuid;
      const metadataCourseUuidByName = new Map<string, string>();

      exams.set(examUuid, {
        source_uuid: examUuid,
        exam_name: metadata.exam.exam_name,
        exam_slug: EXAM_UUID_TO_SLUG[examUuid] ?? examUuid,
        en_id: null,
        created_at: null,
        updated_at: null,
      });

      for (const course of metadata.courses) {
        metadataCourseUuidByName.set(course.course_name.trim().toLowerCase(), course.uuid);
        metadataCourseUuidByName.set(course.course_code.trim().toLowerCase(), course.uuid);

        if (!courses.has(course.uuid)) {
          courses.set(course.uuid, {
            source_uuid: course.uuid,
            course_name: course.course_name,
            course_code: course.course_code,
            program_id: course.program_id,
            label: course.label ?? null,
            canonical_name: getCanonicalCourseName(course.course_name),
            created_at: course.created_at ?? null,
            updated_at: course.updated_at ?? null,
          });
        }
      }

      const courseDirectories = readdirSync(examDir, { withFileTypes: true }).filter((entry) =>
        entry.isDirectory(),
      );

      for (const courseDirectory of courseDirectories) {
        const indexPath = path.join(examDir, courseDirectory.name, 'index.json');
        const paperIndex = readJsonFile<Array<{ uuid: string } & Record<string, unknown>>>(indexPath);

        for (const paperSummary of paperIndex) {
          const paperPath = path.join(examDir, courseDirectory.name, `${paperSummary.uuid}.json`);
          let paper: RawPaperFile;

          try {
            paper = readJsonFile<RawPaperFile>(paperPath);
          } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
              skippedPaperPaths.push(path.relative(process.cwd(), paperPath));
              continue;
            }

            throw error;
          }

          const fallbackCourseUuid = metadataCourseUuidByName.get(
            courseDirectory.name.trim().toLowerCase(),
          );
          const questionCourseUuid = paper.questions.find((question) => question.course?.uuid)?.course?.uuid;
          const courseUuid = paper.course?.uuid ?? questionCourseUuid ?? fallbackCourseUuid;
          const resolvedQuestionCourse = paper.questions.find((question) => question.course?.uuid)?.course;
          const resolvedCourse = paper.course ?? resolvedQuestionCourse;

          if (!courseUuid) {
            skippedCourseResolutionCount += 1;
            continue;
          }

          if (!courses.has(courseUuid)) {
            const resolvedName = resolvedCourse?.course_name?.trim() || courseDirectory.name;
            const resolvedCode = resolvedCourse?.course_code?.trim() || resolvedName;
            courses.set(courseUuid, {
              source_uuid: courseUuid,
              course_name: resolvedName,
              course_code: resolvedCode,
              program_id: resolvedCourse?.program_id ?? 0,
              label: resolvedCourse?.label ?? null,
              canonical_name: getCanonicalCourseName(resolvedName),
              created_at: resolvedCourse?.created_at ?? null,
              updated_at: resolvedCourse?.updated_at ?? null,
            });
          }

          const variantId = paperVariantId(examUuid, courseUuid, paper.uuid);

          paperVariants.push({
            id: variantId,
            source_uuid: paper.uuid,
            exam_uuid: examUuid,
            course_uuid: courseUuid,
            group_id: paper.group_id,
            total_score: paper.total_score,
            duration: paper.duration,
            paper_name: paper.question_paper_name,
            paper_description: paper.question_paper_description,
            year: typeof paper.year === 'number' ? paper.year : null,
            is_new: paper.is_new,
            created_at: paper.created_at ?? null,
            updated_at: paper.updated_at ?? null,
            source_path: path.relative(process.cwd(), paperPath),
          });

          for (const rawQuestion of paper.questions) {
            if (!shouldIncludeQuestion(rawQuestion)) {
              continue;
            }

            const rowQuestionId = questionId(variantId, rawQuestion.uuid);

            questions.push({
              id: rowQuestionId,
              source_uuid: rawQuestion.uuid,
              paper_variant_id: variantId,
              question_number: rawQuestion.question_number,
              question_type: rawQuestion.question_type,
              total_mark: rawQuestion.total_mark,
              total_mark_value: Number.parseFloat(rawQuestion.total_mark) || 0,
              hash: rawQuestion.hash,
              question_text_1: rawQuestion.question_text_1 ?? null,
              question_text_2: rawQuestion.question_text_2 ?? null,
              question_text_3: rawQuestion.question_text_3 ?? null,
              question_text_4: rawQuestion.question_text_4 ?? null,
              question_text_5: rawQuestion.question_text_5 ?? null,
              question_image_1: rawQuestion.question_image_1 ?? null,
              question_image_2: rawQuestion.question_image_2 ?? null,
              question_image_3: rawQuestion.question_image_3 ?? null,
              question_image_4: rawQuestion.question_image_4 ?? null,
              question_image_5: rawQuestion.question_image_5 ?? null,
              question_image_6: rawQuestion.question_image_6 ?? null,
              question_image_7: rawQuestion.question_image_7 ?? null,
              question_image_8: rawQuestion.question_image_8 ?? null,
              question_image_9: rawQuestion.question_image_9 ?? null,
              question_image_10: rawQuestion.question_image_10 ?? null,
              answer_type: rawQuestion.answer_type ?? null,
              response_type: rawQuestion.response_type ?? null,
              value_start: rawQuestion.value_start ?? null,
              value_end: rawQuestion.value_end ?? null,
              parent_question_uuid: rawQuestion.parent_question?.uuid ?? null,
              is_markdown: rawQuestion.is_markdown,
              have_answers: rawQuestion.have_answers,
              question_num_long: rawQuestion.question_num_long,
              created_at: rawQuestion.created_at ?? null,
              updated_at: rawQuestion.updated_at ?? null,
            });

            rawQuestion.options?.forEach((option, optionIndex) => {
              options.push({
                id: optionId(rowQuestionId, optionIndex),
                question_id: rowQuestionId,
                option_text: option.option_text,
                option_image: option.option_image || null,
                score: option.score,
                is_correct: option.is_correct,
                option_number: option.option_number ?? null,
                option_position: optionIndex,
                created_at: option.created_at ?? null,
                updated_at: option.updated_at ?? null,
              });
            });
          }
        }
      }
    } catch (error) {
      if (metadataPath !== '.DS_Store') {
        throw error;
      }
    }
  }

  return {
    exams: [...exams.values()],
    courses: [...courses.values()],
    paperVariants,
    questions,
    options,
    skippedPaperPaths,
    skippedCourseResolutionCount,
  };
}

async function insertInBatches(
  sql: ReturnType<typeof createDbClient>,
  tableName: string,
  columns: string[],
  rows: object[],
  batchSize: number,
) {
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    if (batch.length === 0) {
      continue;
    }

    const values: unknown[] = [];
    const placeholders = batch
      .map((row) => {
        const rowValues = columns.map((column) => {
          values.push(sanitizeSqlValue((row as Record<string, unknown>)[column] ?? null));
          return `$${values.length}`;
        });

        return `(${rowValues.join(', ')})`;
      })
      .join(', ');

    const quotedColumns = columns.map((column) => `"${column}"`).join(', ');
    await sql.unsafe(
      `INSERT INTO "${tableName}" (${quotedColumns}) VALUES ${placeholders}`,
      values as never[],
    );

    console.log(`${tableName}: ${Math.min(index + batch.length, rows.length)}/${rows.length}`);
  }
}

async function main() {
  const sql = createDbClient();

  try {
    if (!readdirSync(DATA_DIR, { withFileTypes: true }).some((entry) => entry.isDirectory())) {
      throw new Error(`DATA_DIR appears empty or invalid: ${DATA_DIR}`);
    }

    await ensureSchema(sql);
    await resetSchema(sql);

    const rows = collectImportRows();
    console.log(
      JSON.stringify(
        {
          dataDir: DATA_DIR,
          exams: rows.exams.length,
          courses: rows.courses.length,
          paperVariants: rows.paperVariants.length,
          questions: rows.questions.length,
          options: rows.options.length,
          skippedPaperPaths: rows.skippedPaperPaths.length,
          skippedCourseResolutionCount: rows.skippedCourseResolutionCount,
        },
        null,
        2,
      ),
    );

    if (rows.skippedPaperPaths.length > 0) {
      console.warn('Skipped missing paper files:');
      rows.skippedPaperPaths.forEach((paperPath) => console.warn(`- ${paperPath}`));
    }

    await insertInBatches(sql, 'exams', ['source_uuid', 'exam_name', 'exam_slug', 'en_id', 'created_at', 'updated_at'], rows.exams as object[], 50);
    await insertInBatches(sql, 'courses', ['source_uuid', 'course_name', 'course_code', 'program_id', 'label', 'canonical_name', 'created_at', 'updated_at'], rows.courses as object[], 250);
    await insertInBatches(sql, 'paper_variants', ['id', 'source_uuid', 'exam_uuid', 'course_uuid', 'group_id', 'total_score', 'duration', 'paper_name', 'paper_description', 'year', 'is_new', 'created_at', 'updated_at', 'source_path'], rows.paperVariants as object[], 250);
    await insertInBatches(sql, 'questions', ['id', 'source_uuid', 'paper_variant_id', 'question_number', 'question_type', 'total_mark', 'total_mark_value', 'hash', 'question_text_1', 'question_text_2', 'question_text_3', 'question_text_4', 'question_text_5', 'question_image_1', 'question_image_2', 'question_image_3', 'question_image_4', 'question_image_5', 'question_image_6', 'question_image_7', 'question_image_8', 'question_image_9', 'question_image_10', 'answer_type', 'response_type', 'value_start', 'value_end', 'parent_question_uuid', 'is_markdown', 'have_answers', 'question_num_long', 'created_at', 'updated_at'], rows.questions as object[], 1000);
    await insertInBatches(sql, 'options', ['id', 'question_id', 'option_text', 'option_image', 'score', 'is_correct', 'option_number', 'option_position', 'created_at', 'updated_at'], rows.options as object[], 2000);

    console.log('Import complete');
  } finally {
    await sql.close();
  }
}

void main();
