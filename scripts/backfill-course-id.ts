#!/usr/bin/env bun
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
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

console.log("📊 Phase 1: Building courseId lookup from raw JSON files...");
const startTime = Date.now();

const courseLookup = new Map<string, { courseId: string; courseName: string }>();

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
      try {
        const data = JSON.parse(readFileSync(filePath, "utf-8"));
        if (!data.questions) continue;

        for (const q of data.questions) {
          const key = `${file.replace(".json", "")}:${q.question_number}`;
          if (!courseLookup.has(key)) {
            courseLookup.set(key, {
              courseId: q.course?.uuid || "",
              courseName: q.course?.course_name || "",
            });
          }
        }
      } catch { continue; }
    }
  }
}

console.log(`   Lookup entries: ${courseLookup.size}`);
console.log(`   Build time: ${((Date.now() - startTime) / 1000).toFixed(1)}s\n`);

console.log("📊 Phase 2: Scanning DynamoDB for items missing courseId...");

let scannedCount = 0;
let missingCourseId = 0;
let updatedCount = 0;
let lastKey: Record<string, any> | undefined = undefined;

async function scanAndUpdateBatch(): Promise<boolean> {
  const scanCommand = new ScanCommand({
    TableName: "quiz-questions",
    FilterExpression: "attribute_not_exists(courseId)",
    ExclusiveStartKey: lastKey,
    Limit: 100,
  });

  const response = await docClient.send(scanCommand);
  const items = response.Items || [];
  lastKey = response.LastEvaluatedKey;

  if (items.length === 0) {
    return lastKey !== undefined;
  }

  scannedCount += items.length;
  missingCourseId += items.length;

  const updates: any[] = [];

  for (const item of items) {
    const key = `${item.paperUuid}:${item.questionNumber}`;
    const courseInfo = courseLookup.get(key);

    if (courseInfo && courseInfo.courseId) {
      updates.push({
        PutRequest: {
          Item: {
            ...item,
            courseId: courseInfo.courseId,
            courseName: courseInfo.courseName,
          },
        },
      });
    }
  }

  if (updates.length > 0) {
    const batches = [];
    for (let i = 0; i < updates.length; i += 25) {
      batches.push(updates.slice(i, 25));
    }

    for (const batch of batches) {
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          "quiz-questions": batch,
        },
      }));
      updatedCount += batch.length;
    }
  }

  process.stdout.write(`\r   Scanned: ${scannedCount}, Updated: ${updatedCount}`);

  return lastKey !== undefined;
}

(async () => {
  try {
    let hasMore = true;
    while (hasMore) {
      hasMore = await scanAndUpdateBatch();
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\n✅ Backfill complete in ${totalTime}s`);
    console.log(`   Items scanned: ${scannedCount}`);
    console.log(`   Items missing courseId: ${missingCourseId}`);
    console.log(`   Items updated: ${updatedCount}`);

    if (missingCourseId > updatedCount) {
      console.log(`\n⚠️  ${missingCourseId - updatedCount} items couldn't be matched (no course info in raw data)`);
    }
  } catch (e) {
    console.error("\n❌ Backfill failed:", e);
    process.exit(1);
  }
})();
