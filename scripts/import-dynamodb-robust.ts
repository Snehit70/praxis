#!/usr/bin/env bun

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const BATCH_SIZE = 25;
const MAX_RETRIES = 10;
const INITIAL_BACKOFF_MS = 1000;
const STATE_FILE = "import-state.json";
const FREE_TIER_WCU_LIMIT = 25;
const SAFE_WCU_USAGE = 20;
const ITEM_SIZE_LIMIT_BYTES = 400 * 1024;
const BATCH_SIZE_LIMIT_BYTES = 16 * 1024 * 1024;

interface ImportState {
  papersProcessed: number;
  questionsProcessed: number;
  completedPapers: boolean;
  completedQuestions: boolean;
}

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
  paperName: string;
  year: number;
  totalScore: string;
  duration: number;
  isNew: number;
}

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error("❌ AWS credentials not found");
  process.exit(1);
}

const client = new DynamoDBClient({
  region: AWS_REGION,
  maxAttempts: 3,
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

function loadState(): ImportState {
  if (existsSync(STATE_FILE)) {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  }
  return {
    papersProcessed: 0,
    questionsProcessed: 0,
    completedPapers: false,
    completedQuestions: false,
  };
}

function saveState(state: ImportState) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function loadData() {
  console.log("📊 Phase 1: Scanning & Deduplicating data...");
  const startTime = Date.now();
  const DATA_DIR = join(process.cwd(), "data");
  const EXAM_DIRS = ["Quiz 1", "Quiz 2", "End Term Quiz", "OPPE"];

  const papersMap = new Map<string, Paper>();
  const questionsMap = new Map<string, Question>();

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
        try {
          const filePath = join(coursePath, file);
          const content = readFileSync(filePath, "utf-8");
          const data = JSON.parse(content);
          const paperUuid = file.replace(".json", "");

          if (!data.questions || data.questions.length === 0) continue;

          const courseUuid = data.questions[0].course.uuid;

          if (!papersMap.has(paperUuid)) {
            papersMap.set(paperUuid, {
              uuid: paperUuid,
              examId: data.exam.uuid,
              examName: data.exam.exam_name,
              courseId: courseUuid,
              courseName: data.questions[0].course.course_name,
              paperName: data.question_paper_name,
              year: data.year,
              totalScore: data.total_score,
              duration: data.duration,
              isNew: data.is_new,
            });
          }

          for (const q of data.questions) {
            const questionKey = `${paperUuid}:${q.question_number}`;
            if (!questionsMap.has(questionKey)) {
              questionsMap.set(questionKey, {
                paperUuid,
                questionNumber: q.question_number,
                questionType: q.question_type,
                totalMark: q.total_mark,
                hash: q.hash,
                uuid: q.uuid,
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
                options: q.options.map((opt: any) => ({
                  optionText: opt.option_text,
                  optionImage: opt.option_image,
                  score: opt.score,
                  isCorrect: opt.is_correct,
                  optionNumber: opt.option_number,
                })),
              });
            }
          }
        } catch (e) {
          console.error(`Error processing file ${file}:`, e);
        }
      }
    }
  }

  console.log(`   Papers: ${papersMap.size}`);
  console.log(`   Questions: ${questionsMap.size}`);
  console.log(`   Scan time: ${((Date.now() - startTime) / 1000).toFixed(1)}s\n`);

  return { 
    papers: Array.from(papersMap.values()), 
    questions: Array.from(questionsMap.values()) 
  };
}

async function robustWriteBatches<T extends Record<string, any>>(
  items: T[], 
  tableName: string, 
  startIndex: number
): Promise<number> {
  const total = items.length;
  if (startIndex >= total) return total;

  console.log(`🚀 Starting import for ${tableName} from index ${startIndex}/${total}`);
  
  const DELAY_BETWEEN_BATCHES_MS = 1300; 

  let currentIndex = startIndex;

  while (currentIndex < total) {
    const batch = items.slice(currentIndex, currentIndex + BATCH_SIZE);
    
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      try {
        await docClient.send(new BatchWriteCommand({
          RequestItems: {
            [tableName]: batch.map(item => ({ PutRequest: { Item: item } }))
          }
        }));
        
        currentIndex += batch.length;
        process.stdout.write(`\r   ✓ ${currentIndex}/${total} (${Math.round(currentIndex/total*100)}%)`);
        
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
        break;

      } catch (error: any) {
        attempt++;
        const isThrottling = error.name === 'ProvisionedThroughputExceededException' || error.name === 'ThrottlingException';
        
        if (isThrottling || error.$metadata?.httpStatusCode === 500 || error.$metadata?.httpStatusCode === 503) {
          const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt) + (Math.random() * 500);
          console.log(`\n   ⚠️  ${error.name}. Retrying in ${Math.round(delay)}ms (Attempt ${attempt}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`\n   ❌ Fatal Error:`, error);
          console.error(`   Failed Item Index: ${currentIndex}`);
          throw error;
        }
      }
    }

    if (attempt >= MAX_RETRIES) {
      console.error(`\n   ❌ Max retries exceeded at index ${currentIndex}. Saving state and exiting.`);
      return currentIndex;
    }

    if (currentIndex % (BATCH_SIZE * 10) === 0) {
      const state = loadState();
      if (tableName === "quiz-papers") state.papersProcessed = currentIndex;
      else state.questionsProcessed = currentIndex;
      saveState(state);
    }
  }
  
  console.log();
  return total;
}

async function main() {
  const state = loadState();
  const { papers, questions } = loadData();

  if (!state.completedPapers) {
    console.log("📄 Phase 2: Importing Papers...");
    const nextIndex = await robustWriteBatches(papers, "quiz-papers", state.papersProcessed);
    
    state.papersProcessed = nextIndex;
    if (nextIndex >= papers.length) {
      state.completedPapers = true;
    }
    saveState(state);
  } else {
    console.log("📄 Papers already completed. Skipping.");
  }

  if (!state.completedQuestions) {
    console.log("\n❓ Phase 3: Importing Questions...");
    const nextIndex = await robustWriteBatches(questions, "quiz-questions", state.questionsProcessed);
    
    state.questionsProcessed = nextIndex;
    if (nextIndex >= questions.length) {
      state.completedQuestions = true;
    }
    saveState(state);
  } else {
    console.log("\n❓ Questions already completed. Skipping.");
  }

  console.log("\n✅ Import process finished.");
}

main().catch(console.error);
