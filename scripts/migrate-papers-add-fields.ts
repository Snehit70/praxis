#!/usr/bin/env bun
/**
 * Idempotent migration: Adds missing fields to quiz-papers table
 * Safe to run multiple times - only updates items that need it
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

const DATA_DIR = join(process.cwd(), "data");
const EXAM_DIRS = ["Quiz 1", "Quiz 2", "End Term Quiz", "OPPE"];

// Step 1: Build source data map
console.log("📊 Building source data map...");
const sourceData = new Map<string, {
  paperName: string;
  year: number;
  totalScore: string;
  duration: number;
  isNew: number;
}>();

for (const examDir of EXAM_DIRS) {
  const examPath = join(DATA_DIR, examDir);
  let courseDirs: { name: string }[];
  try {
    courseDirs = readdirSync(examPath, { withFileTypes: true }).filter(d => d.isDirectory());
  } catch { continue; }

  for (const courseDir of courseDirs) {
    const coursePath = join(examPath, courseDir.name);
    const files = readdirSync(coursePath).filter(f => 
      f.endsWith(".json") && f !== "index.json" && f !== "metadata.json"
    );

    for (const file of files) {
      try {
        const content = readFileSync(join(coursePath, file), "utf-8");
        const data = JSON.parse(content);
        const uuid = file.replace(".json", "");
        
        sourceData.set(uuid, {
          paperName: data.question_paper_name || "",
          year: data.year || 0,
          totalScore: data.total_score || "0",
          duration: data.duration || 0,
          isNew: data.is_new || 0,
        });
      } catch {}
    }
  }
}
console.log(`   Found ${sourceData.size} papers in source\n`);

// Step 2: Scan DynamoDB and find items needing update
console.log("🔍 Scanning DynamoDB for items needing migration...");
const needsUpdate: string[] = [];
let scanned = 0;
let lastKey: any = undefined;

do {
  const result = await docClient.send(new ScanCommand({
    TableName: "quiz-papers",
    ExclusiveStartKey: lastKey,
  }));
  
  for (const item of result.Items || []) {
    scanned++;
    // Check if missing any field or year is undefined/null
    if (!item.paperName || item.year === undefined || item.year === null) {
      needsUpdate.push(item.uuid);
    }
  }
  lastKey = result.LastEvaluatedKey;
} while (lastKey);

console.log(`   Scanned: ${scanned}`);
console.log(`   Need update: ${needsUpdate.length}\n`);

if (needsUpdate.length === 0) {
  console.log("✅ All items already have complete data. Nothing to migrate.");
  process.exit(0);
}

// Step 3: Update items
console.log("🚀 Migrating...");
let updated = 0;
let errors = 0;

for (const uuid of needsUpdate) {
  const fields = sourceData.get(uuid);
  if (!fields) {
    console.log(`   ⚠️  No source data for ${uuid}, skipping`);
    continue;
  }

  try {
    await docClient.send(new UpdateCommand({
      TableName: "quiz-papers",
      Key: { uuid },
      UpdateExpression: "SET paperName = :pn, #yr = :y, totalScore = :ts, #dur = :d, isNew = :isn",
      ExpressionAttributeNames: { "#yr": "year", "#dur": "duration" },
      ExpressionAttributeValues: {
        ":pn": fields.paperName,
        ":y": fields.year,
        ":ts": fields.totalScore,
        ":d": fields.duration,
        ":isn": fields.isNew,
      },
    }));
    updated++;
    process.stdout.write(`\r   Updated: ${updated}/${needsUpdate.length}`);
  } catch (e: any) {
    errors++;
    console.error(`\n   ❌ ${uuid}: ${e.message}`);
  }

  // Rate limit: ~20 WCU/sec (free tier safe)
  if (updated % 20 === 0) await new Promise(r => setTimeout(r, 1000));
}

console.log(`\n\n✅ Migration complete!`);
console.log(`   Updated: ${updated}`);
console.log(`   Errors: ${errors}`);
