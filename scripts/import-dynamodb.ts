#!/usr/bin/env bun
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.error("❌ AWS credentials not found");
  process.exit(1);
}

const client = new DynamoDBClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

const DATA_DIR = join(process.cwd(), "data");
const EXAM_DIRS = ["Quiz 1", "Quiz 2", "End Term Quiz", "OPPE"];
const BATCH_SIZE = 25;

interface Option {
  optionText: string;
  optionImage?: string;
  score: string;
  isCorrect: number;
  optionNumber?: number;
}

interface Question {
  paperUuid: string;
  questionNumber: number;
  questionType: string;
  totalMark: string;
  hash: string;
  uuid: string;
  courseId?: string;
  courseName?: string;
  questionText1?: string;
  questionText2?: string;
  questionText3?: string;
  questionText4?: string;
  questionText5?: string;
  questionImage1?: string;
  questionImage2?: string;
  questionImage3?: string;
  questionImage4?: string;
  questionImage5?: string;
  questionImage6?: string;
  questionImage7?: string;
  questionImage8?: string;
  questionImage9?: string;
  questionImage10?: string;
  isMarkdown: number;
  haveAnswers: number;
  parentQuestionUuid?: string;
  options: Option[];
}

interface Paper {
  uuid: string;
  examId: string;
  examName: string;
  courseId: string;
  courseName: string;
}

interface PaperFile {
  exam: {
    exam_name: string;
    uuid: string;
  };
  questions: Array<{
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
    question_type: string;
    total_mark: string;
    hash: string;
    uuid: string;
    is_markdown: number;
    have_answers: number;
    parent_question?: { uuid: string };
    course: {
      course_name: string;
      uuid: string;
    };
    options: Array<{
      option_text: string;
      option_image?: string;
      score: string;
      is_correct: number;
      option_number?: number;
    }>;
  }>;
}

console.log("📊 Phase 1: Scanning data files...");
const startTime = Date.now();

const papersToImport = new Map<string, Paper>();
const questionsToImport = new Map<string, Question>();

for (const examDir of EXAM_DIRS) {
  const examPath = join(DATA_DIR, examDir);
  let courseDirs: { name: string }[];
  try {
    courseDirs = readdirSync(examPath, { withFileTypes: true }).filter(d => d.isDirectory());
  } catch { continue; }

  for (const courseDir of courseDirs) {
    const coursePath = join(examPath, courseDir.name);
    const files = readdirSync(coursePath).filter(f => f.endsWith(".json") && f !== "index.json" && f !== "metadata.json");

    for (const file of files) {
      const filePath = join(coursePath, file);
      const data: PaperFile = JSON.parse(readFileSync(filePath, "utf-8"));
      const paperUuid = file.replace(".json", "");

      if (!data.questions || data.questions.length === 0) continue;

      const courseUuid = data.questions[0]!.course.uuid;

      if (!papersToImport.has(paperUuid)) {
        papersToImport.set(paperUuid, {
          uuid: paperUuid,
          examId: data.exam.uuid,
          examName: data.exam.exam_name,
          courseId: courseUuid,
          courseName: data.questions[0]!.course.course_name,
        });
      }

      for (const q of data.questions) {
        const questionKey = `${paperUuid}:${q.question_number}`;
        if (!questionsToImport.has(questionKey)) {
          questionsToImport.set(questionKey, {
            paperUuid,
            questionNumber: q.question_number,
            questionType: q.question_type,
            totalMark: q.total_mark,
            hash: q.hash,
            uuid: q.uuid,
            courseId: q.course?.uuid,
            courseName: q.course?.course_name,
            questionText1: q.question_text_1,
            questionText2: q.question_text_2,
            questionText3: q.question_text_3,
            questionText4: q.question_text_4,
            questionText5: q.question_text_5,
            questionImage1: q.question_image_1,
            questionImage2: q.question_image_2,
            questionImage3: q.question_image_3,
            questionImage4: q.question_image_4,
            questionImage5: q.question_image_5,
            questionImage6: q.question_image_6,
            questionImage7: q.question_image_7,
            questionImage8: q.question_image_8,
            questionImage9: q.question_image_9,
            questionImage10: q.question_image_10,
            isMarkdown: q.is_markdown,
            haveAnswers: q.have_answers,
            parentQuestionUuid: q.parent_question?.uuid,
            options: q.options.map(opt => ({
              optionText: opt.option_text,
              optionImage: opt.option_image,
              score: opt.score,
              isCorrect: opt.is_correct,
              optionNumber: opt.option_number,
            })),
          });
        }
      }
    }
  }
}

console.log(`   Papers: ${papersToImport.size}`);
console.log(`   Questions: ${questionsToImport.size}`);
console.log(`   Scan time: ${((Date.now() - startTime) / 1000).toFixed(1)}s\n`);

async function writeBatchesParallel<T extends Record<string, any>>(items: T[], tableName: string, concurrency: number = 20, delayMs: number = 0): Promise<void> {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, i + BATCH_SIZE));
  }

  let completed = 0;
  const total = items.length;

  const writeBatch = async (batch: T[]): Promise<void> => {
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [tableName]: batch.map(item => ({ PutRequest: { Item: item } }))
      }
    }));
    completed += batch.length;
    process.stdout.write(`\r   ✓ ${completed}/${total}`);
    if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
  };

  for (let i = 0; i < batches.length; i += concurrency) {
    const chunk = batches.slice(i, i + concurrency);
    await Promise.all(chunk.map(writeBatch));
  }
  console.log();
}

console.log("📄 Phase 2: Importing papers...");
const papers = Array.from(papersToImport.values());
await writeBatchesParallel(papers, "quiz-papers", 20, 0);

console.log("\n❓ Phase 3: Importing questions...");
const questions = Array.from(questionsToImport.values());
await writeBatchesParallel(questions, "quiz-questions", 20, 0);

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n✅ Import complete in ${totalTime}s`);
console.log(`   Papers: ${papers.length}`);
console.log(`   Questions: ${questions.length}`);
