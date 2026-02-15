#!/usr/bin/env bun
/**
 * Fast bulk import using batched mutations
 * Batches: 500 docs per mutation (under 16K write limit)
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const CONVEX_URL = process.env.CONVEX_URL;
if (!CONVEX_URL) {
  console.error("CONVEX_URL not set");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);
const DATA_DIR = join(process.cwd(), "data");
const EXAM_DIRS = ["Quiz 1", "Quiz 2", "End Term Quiz", "OPPE"];

// Batch size - stay well under 16K write limit
const BATCH_SIZE = 500;

interface ExamData {
  exam_name: string;
  uuid: string;
  en_id?: string;
  created_at: string;
  updated_at: string;
}

interface CourseData {
  course_name: string;
  course_code: string;
  program_id: number;
  uuid: string;
  created_at: string;
  updated_at: string;
}

interface PaperData {
  group_id: number;
  total_score: string;
  duration: number;
  question_paper_name: string;
  question_paper_description: string;
  uuid: string;
  year: number;
  is_new: number;
  created_at: string;
  updated_at: string;
}

interface OptionData {
  option_text: string;
  option_image: string;
  score: string;
  is_correct: number;
  option_number: number | null;
  created_at: string;
  updated_at: string;
}

interface QuestionData {
  question_number: number;
  question_text_1?: string;
  question_text_2?: string;
  question_text_3?: string;
  question_text_4?: string;
  question_text_5?: string;
  question_image_1?: string;
  question_image_2?: string;
  question_image_3?: string;
  question_image_4?: string;
  question_image_5?: string;
  question_image_6?: string;
  question_image_7?: string;
  question_image_8?: string;
  question_image_9?: string;
  question_image_10?: string;
  question_type: "MCQ" | "MSQ" | "SA" | "COMPREHENSION" | "OPPE";
  total_mark: string;
  value_start?: string;
  value_end?: string;
  answer_type?: string;
  response_type?: string;
  parent_question_id?: number;
  parent_question?: { uuid: string; question_type: string };
  hash: string;
  is_markdown: number;
  have_answers: number;
  question_num_long: number;
  uuid: string;
  created_at: string;
  updated_at: string;
  course: CourseData;
  options: OptionData[];
}

interface PaperFile {
  exam: ExamData;
  questions: QuestionData[];
}

// Collect all data first
console.log("📊 Phase 1: Scanning all data files...");
const startTime = Date.now();

const examsMap = new Map<string, ExamData>();
const coursesMap = new Map<string, CourseData>();
const papersMap = new Map<string, { examUuid: string; courseUuid: string; data: PaperData }>();
const questionsData: { examUuid: string; paperUuid: string; courseUuid: string; q: QuestionData }[] = [];

for (const examDir of EXAM_DIRS) {
  const examPath = join(DATA_DIR, examDir);
  let courseDirs: { name: string }[];
  try {
    courseDirs = readdirSync(examPath, { withFileTypes: true }).filter(d => d.isDirectory());
  } catch { continue; }

  for (const courseDir of courseDirs) {
    const coursePath = join(examPath, courseDir.name);
    const files = readdirSync(coursePath).filter(f => f.endsWith(".json") && f !== "index.json" && f !== "metadata.json");

    // Get papers from index.json
    const indexPath = join(coursePath, "index.json");
    let papers: PaperData[] = [];
    try {
      papers = JSON.parse(readFileSync(indexPath, "utf-8"));
    } catch {}

    // Process each paper file
    for (const file of files) {
      const filePath = join(coursePath, file);
      const data: PaperFile = JSON.parse(readFileSync(filePath, "utf-8"));
      const paperUuid = file.replace(".json", "");

      // Collect exam
      if (data.exam && !examsMap.has(data.exam.uuid)) {
        examsMap.set(data.exam.uuid, data.exam);
      }

      // Collect course and questions
      if (data.questions && data.questions.length > 0) {
        const courseUuid = data.questions[0]!.course.uuid;
        
        for (const q of data.questions) {
          if (q.course && !coursesMap.has(q.course.uuid)) {
            coursesMap.set(q.course.uuid, q.course);
          }
          questionsData.push({
            examUuid: data.exam.uuid,
            paperUuid,
            courseUuid: q.course.uuid,
            q,
          });
        }

        // Collect paper from index.json, dedupe by UUID, use courseUuid from questions
        const paperFromIndex = papers.find(p => p.uuid === paperUuid);
        if (paperFromIndex && !papersMap.has(paperUuid)) {
          papersMap.set(paperUuid, {
            examUuid: data.exam.uuid,
            courseUuid,
            data: paperFromIndex,
          });
        }
      }
    }
  }
}

const papersData = Array.from(papersMap.values());

console.log(`   Exams: ${examsMap.size}`);
console.log(`   Courses: ${coursesMap.size}`);
console.log(`   Papers: ${papersData.length}`);
console.log(`   Questions: ${questionsData.length}`);
console.log(`   Scan time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

// Phase 2: Import exams
console.log("\n📚 Phase 2: Importing exams...");
const exams = Array.from(examsMap.values()).map(e => ({
  examName: e.exam_name,
  uuid: e.uuid,
  enId: e.en_id,
  createdAt: e.created_at,
  updatedAt: e.updated_at,
}));
const examIdMap = await client.mutation(api.seed.seedExams, { exams });
console.log(`   ✓ ${Object.keys(examIdMap).length} exams`);

// Phase 3: Import courses
console.log("\n📖 Phase 3: Importing courses...");
const courses = Array.from(coursesMap.values()).map(c => ({
  courseName: c.course_name,
  courseCode: c.course_code,
  programId: c.program_id,
  uuid: c.uuid,
  createdAt: c.created_at,
  updatedAt: c.updated_at,
}));
const courseIdMap = await client.mutation(api.seed.seedCourses, { courses });
console.log(`   ✓ ${Object.keys(courseIdMap).length} courses`);

// Phase 4: Import papers in batches
console.log("\n📄 Phase 4: Importing papers...");
let paperIdMap: Record<string, Id<"papers">> = {};
const paperBatches = Math.ceil(papersData.length / BATCH_SIZE);

for (let i = 0; i < papersData.length; i += BATCH_SIZE) {
  const batch = papersData.slice(i, i + BATCH_SIZE).map(p => ({
    examUuid: p.examUuid,
    courseUuid: p.courseUuid,
    groupId: p.data.group_id,
    totalScore: p.data.total_score,
    duration: p.data.duration,
    paperName: p.data.question_paper_name,
    paperDescription: p.data.question_paper_description,
    uuid: p.data.uuid,
    year: p.data.year,
    isNew: p.data.is_new,
    createdAt: p.data.created_at,
    updatedAt: p.data.updated_at,
  }));

  const batchIds = await client.mutation(api.seed.seedPapers, {
    papers: batch,
    examIdMap,
    courseIdMap,
  });
  paperIdMap = { ...paperIdMap, ...batchIds };
  
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  process.stdout.write(`\r   ✓ ${Math.min(i + BATCH_SIZE, papersData.length)}/${papersData.length} papers (batch ${batchNum}/${paperBatches})`);
}
console.log();

// Phase 5: Import questions in batches
console.log("\n❓ Phase 5: Importing questions...");
let questionIdMap: Record<string, Id<"questions">> = {};
const questionBatches = Math.ceil(questionsData.length / BATCH_SIZE);

for (let i = 0; i < questionsData.length; i += BATCH_SIZE) {
  const batch = questionsData.slice(i, i + BATCH_SIZE).map(({ examUuid, paperUuid, courseUuid, q }) => ({
    examUuid,
    paperUuid,
    courseUuid,
    questionNumber: q.question_number,
    questionType: q.question_type,
    totalMark: q.total_mark,
    hash: q.hash,
    uuid: q.uuid,
    questionText1: q.question_text_1 || undefined,
    questionText2: q.question_text_2 || undefined,
    questionText3: q.question_text_3 || undefined,
    questionText4: q.question_text_4 || undefined,
    questionText5: q.question_text_5 || undefined,
    questionImage1: q.question_image_1 || undefined,
    questionImage2: q.question_image_2 || undefined,
    questionImage3: q.question_image_3 || undefined,
    questionImage4: q.question_image_4 || undefined,
    questionImage5: q.question_image_5 || undefined,
    questionImage6: q.question_image_6 || undefined,
    questionImage7: q.question_image_7 || undefined,
    questionImage8: q.question_image_8 || undefined,
    questionImage9: q.question_image_9 || undefined,
    questionImage10: q.question_image_10 || undefined,
    answerType: q.answer_type || undefined,
    responseType: q.response_type || undefined,
    valueStart: q.value_start || undefined,
    valueEnd: q.value_end || undefined,
    parentQuestionUuid: q.parent_question?.uuid || undefined,
    isMarkdown: q.is_markdown,
    haveAnswers: q.have_answers,
    questionNumLong: q.question_num_long,
    createdAt: q.created_at,
    updatedAt: q.updated_at,
  }));

  // Filter maps to only include relevant IDs for this batch (avoid 1024 field limit)
  const batchPaperUuids = new Set(batch.map(q => q.paperUuid));
  const batchPaperMap: Record<string, Id<"papers">> = {};
  for (const uuid of batchPaperUuids) {
    if (paperIdMap[uuid]) batchPaperMap[uuid] = paperIdMap[uuid]!;
  }

  // Filter questionIdMap to only include parent UUIDs referenced by this batch
  const batchParentUuids = new Set(batch.map(q => q.parentQuestionUuid).filter(Boolean));
  const batchQuestionMap: Record<string, Id<"questions">> = {};
  for (const uuid of batchParentUuids) {
    if (uuid && questionIdMap[uuid]) batchQuestionMap[uuid] = questionIdMap[uuid]!;
  }

  const batchIds = await client.mutation(api.seed.seedQuestions, {
    questions: batch,
    examIdMap,
    paperIdMap: batchPaperMap,
    courseIdMap,
    ...(Object.keys(batchQuestionMap).length > 0 ? { questionIdMap: batchQuestionMap } : {}),
  });
  questionIdMap = { ...questionIdMap, ...batchIds };
  
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  process.stdout.write(`\r   ✓ ${Math.min(i + BATCH_SIZE, questionsData.length)}/${questionsData.length} questions (batch ${batchNum}/${questionBatches})`);
}
console.log();

// Phase 6: Import options in batches
console.log("\n🔘 Phase 6: Importing options...");
const allOptions: { questionUuid: string; opt: OptionData }[] = [];
for (const { q } of questionsData) {
  for (const opt of q.options || []) {
    allOptions.push({ questionUuid: q.uuid, opt });
  }
}

let totalOptions = 0;
const optionBatches = Math.ceil(allOptions.length / BATCH_SIZE);

for (let i = 0; i < allOptions.length; i += BATCH_SIZE) {
  const batch = allOptions.slice(i, i + BATCH_SIZE).map(({ questionUuid, opt }) => ({
    questionUuid,
    optionText: opt.option_text,
    optionImage: opt.option_image || undefined,
    score: opt.score,
    isCorrect: opt.is_correct,
    optionNumber: opt.option_number ?? undefined,
    createdAt: opt.created_at,
    updatedAt: opt.updated_at,
  }));

  const batchQuestionUuids = new Set(batch.map(o => o.questionUuid));
  const batchQuestionMap: Record<string, Id<"questions">> = {};
  for (const uuid of batchQuestionUuids) {
    if (questionIdMap[uuid]) batchQuestionMap[uuid] = questionIdMap[uuid]!;
  }

  const result = await client.mutation(api.seed.seedOptions, {
    options: batch,
    questionIdMap: batchQuestionMap,
  });
  totalOptions += result.count;
  
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  process.stdout.write(`\r   ✓ ${Math.min(i + BATCH_SIZE, allOptions.length)}/${allOptions.length} options (batch ${batchNum}/${optionBatches})`);
}
console.log();

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n✅ Import complete in ${totalTime}s`);
console.log(`   Exams: ${Object.keys(examIdMap).length}`);
console.log(`   Courses: ${Object.keys(courseIdMap).length}`);
console.log(`   Papers: ${Object.keys(paperIdMap).length}`);
console.log(`   Questions: ${Object.keys(questionIdMap).length}`);
console.log(`   Options: ${totalOptions}`);
