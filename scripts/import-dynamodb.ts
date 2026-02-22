#!/usr/bin/env bun
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
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

// Parse CLI args
const SKIP_EXISTING = process.argv.includes("--skip-existing") || process.argv.includes("-s");
const FORCE_ALL = process.argv.includes("--force") || process.argv.includes("-f");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
Usage: bun run scripts/import-dynamodb.ts [options]

Options:
  -s, --skip-existing  Skip items that already exist in DynamoDB (faster re-runs)
  -f, --force          Force overwrite all items (default behavior)
  -h, --help           Show this help message
`);
  process.exit(0);
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

const SCAN_DELAY_MS = 200; // Delay between scan pages to avoid throttling

// Fetch existing IDs from DynamoDB (for --skip-existing mode)
async function getExistingPaperIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  let lastKey: Record<string, any> | undefined;
  let count = 0;
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: "quiz-papers",
      ProjectionExpression: "#uuid",
      ExpressionAttributeNames: { "#uuid": "uuid" },
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      if (item.uuid) ids.add(item.uuid);
    }
    count += result.Items?.length || 0;
    process.stdout.write(`\r   Scanning papers: ${count} found`);
    lastKey = result.LastEvaluatedKey;
    
    if (lastKey) await new Promise(resolve => setTimeout(resolve, SCAN_DELAY_MS));
  } while (lastKey);
  
  console.log();
  return ids;
}

async function getExistingQuestionKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  let lastKey: Record<string, any> | undefined;
  let count = 0;
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: "quiz-questions",
      ProjectionExpression: "paperUuid, questionNumber",
      ExclusiveStartKey: lastKey,
    }));
    
    for (const item of result.Items || []) {
      if (item.paperUuid && item.questionNumber !== undefined) {
        keys.add(`${item.paperUuid}:${item.questionNumber}`);
      }
    }
    count += result.Items?.length || 0;
    process.stdout.write(`\r   Scanning questions: ${count} found`);
    lastKey = result.LastEvaluatedKey;
    
    if (lastKey) await new Promise(resolve => setTimeout(resolve, SCAN_DELAY_MS));
  } while (lastKey);
  
  console.log();
  return keys;
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

console.log(`   Papers found: ${papersToImport.size}`);
console.log(`   Questions found: ${questionsToImport.size}`);
console.log(`   Scan time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
console.log(`   Mode: ${SKIP_EXISTING ? "skip-existing" : "overwrite-all"}\n`);

// Filter out existing items if --skip-existing
let papersFiltered = Array.from(papersToImport.values());
let questionsFiltered = Array.from(questionsToImport.values());

if (SKIP_EXISTING) {
  console.log("🔍 Phase 1b: Checking existing items in DynamoDB...");
  console.log("   (Scanning sequentially to avoid throttling)");
  
  const existingPapers = await getExistingPaperIds();
  const existingQuestions = await getExistingQuestionKeys();
  
  console.log(`   Existing papers: ${existingPapers.size}`);
  console.log(`   Existing questions: ${existingQuestions.size}`);
  
  const papersBefore = papersFiltered.length;
  const questionsBefore = questionsFiltered.length;
  
  papersFiltered = papersFiltered.filter(p => !existingPapers.has(p.uuid));
  questionsFiltered = questionsFiltered.filter(q => !existingQuestions.has(`${q.paperUuid}:${q.questionNumber}`));
  
  console.log(`   Papers to import: ${papersFiltered.length} (skipping ${papersBefore - papersFiltered.length})`);
  console.log(`   Questions to import: ${questionsFiltered.length} (skipping ${questionsBefore - questionsFiltered.length})\n`);
  
  if (papersFiltered.length === 0 && questionsFiltered.length === 0) {
    console.log("✅ Nothing new to import. All items already exist.");
    process.exit(0);
  }
}

async function writeBatchesAdaptive<T extends Record<string, any>>(items: T[], tableName: string): Promise<void> {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, i + BATCH_SIZE));
  }

  let completed = 0;
  const total = items.length;
  const batchStartTime = Date.now();
  
  // Adaptive rate control
  let delayMs = 100;        // Start aggressive (100ms between batches)
  const MIN_DELAY = 50;     // Fastest we'll go
  const MAX_DELAY = 2000;   // Slowest we'll go
  let consecutiveSuccess = 0;
  let concurrency = 5;      // Start with moderate parallelism
  const MAX_CONCURRENCY = 10;
  const MIN_CONCURRENCY = 1;

  const writeBatch = async (batch: T[], retries = 3): Promise<'success' | 'throttled'> => {
    try {
      const result = await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [tableName]: batch.map(item => ({ PutRequest: { Item: item } }))
        }
      }));
      
      // Handle unprocessed items (partial failure - also means throttling)
      const unprocessed = result.UnprocessedItems?.[tableName];
      if (unprocessed && unprocessed.length > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs * 2));
        const retryItems = unprocessed.map(u => u.PutRequest!.Item as T);
        await writeBatch(retryItems, retries - 1);
        return 'throttled';
      }
      
      completed += batch.length;
      return 'success';
    } catch (err: any) {
      if (retries > 0 && err.name === 'ProvisionedThroughputExceededException') {
        await new Promise(resolve => setTimeout(resolve, delayMs * 3));
        return writeBatch(batch, retries - 1);
      }
      throw err;
    }
  };

  const updateProgress = () => {
    const elapsed = (Date.now() - batchStartTime) / 1000;
    const rate = completed / elapsed;
    const remaining = (total - completed) / rate;
    const eta = remaining > 60 ? `${(remaining / 60).toFixed(1)}m` : `${remaining.toFixed(0)}s`;
    const ratePerSec = rate.toFixed(0);
    process.stdout.write(`\r   ✓ ${completed}/${total} | ${ratePerSec}/s | delay:${delayMs}ms | c:${concurrency} | ETA: ${eta}   `);
  };

  for (let i = 0; i < batches.length; i += concurrency) {
    const chunk = batches.slice(i, Math.min(i + concurrency, batches.length));
    const results = await Promise.all(chunk.map(b => writeBatch(b)));
    
    const hadThrottle = results.includes('throttled');
    
    if (hadThrottle) {
      // Back off: increase delay, reduce concurrency
      delayMs = Math.min(delayMs * 1.5, MAX_DELAY);
      concurrency = Math.max(concurrency - 1, MIN_CONCURRENCY);
      consecutiveSuccess = 0;
      console.log(`\n   ⚠ Throttled! Backing off to delay:${delayMs.toFixed(0)}ms, concurrency:${concurrency}`);
    } else {
      consecutiveSuccess++;
      // Speed up after 10 consecutive successes
      if (consecutiveSuccess >= 10) {
        delayMs = Math.max(delayMs * 0.9, MIN_DELAY);
        if (consecutiveSuccess >= 20 && concurrency < MAX_CONCURRENCY) {
          concurrency++;
          consecutiveSuccess = 10; // Reset partially
        }
      }
    }
    
    updateProgress();
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  console.log();
}

// Adaptive rate limiting: starts fast, backs off on throttle, speeds up on success

if (papersFiltered.length > 0) {
  console.log("📄 Phase 2: Importing papers...");
  await writeBatchesAdaptive(papersFiltered, "quiz-papers");
} else {
  console.log("📄 Phase 2: No new papers to import");
}

if (questionsFiltered.length > 0) {
  console.log("\n❓ Phase 3: Importing questions...");
  console.log("   (Adaptive rate - will find optimal speed automatically)");
  await writeBatchesAdaptive(questionsFiltered, "quiz-questions");
} else {
  console.log("\n❓ Phase 3: No new questions to import");
}

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n✅ Import complete in ${totalTime}s`);
console.log(`   Papers imported: ${papersFiltered.length}`);
console.log(`   Questions imported: ${questionsFiltered.length}`);
