#!/usr/bin/env bun
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const docClient = DynamoDBDocumentClient.from(client);

async function queryCount(tableName: string, keyCondition: string, values: Record<string, any>): Promise<number> {
  let count = 0;
  let lastKey: any;
  
  do {
    const result = await docClient.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: values,
      Select: "COUNT",
      ExclusiveStartKey: lastKey,
    }));
    count += result.Count || 0;
    lastKey = result.LastEvaluatedKey;
    if (lastKey) await new Promise(r => setTimeout(r, 200)); // Throttle
  } while (lastKey);
  
  return count;
}

console.log("Verifying import with queries...\n");

// Check questions per exam type using known paper UUIDs
const examChecks = [
  { name: "Quiz 1", paperId: "f8b3e2a1-4c5d-4e6f-8a9b-0c1d2e3f4a5b" },
  { name: "Quiz 2", paperId: "a1b2c3d4-5e6f-4a5b-8c9d-0e1f2a3b4c5d" },
  { name: "End Term", paperId: "1a2b3c4d-5e6f-4a5b-8c9d-0e1f2a3b4c5d" },
];

// Just query for a few papers to verify structure
const samplePaperIds = [
  "f8b3e2a1-4c5d-4e6f-8a9b-0c1d2e3f4a5b",
  "a1b2c3d4-5e6f-4a5b-8c9d-0e1f2a3b4c5d",
];

for (const paperId of samplePaperIds) {
  const count = await queryCount("quiz-questions", "paperUuid = :pid", { ":pid": paperId });
  console.log(`Paper ${paperId.slice(0, 8)}...: ${count} questions`);
  await new Promise(r => setTimeout(r, 500));
}

// Get a real paper ID from the data
console.log("\nChecking first 5 papers from data directory...");
const { readdirSync, readFileSync } = require("fs");
const { join } = require("path");
const dataDir = join(process.cwd(), "data");
const papers: string[] = [];

for (const exam of ["Quiz 1", "Quiz 2", "End Term Quiz", "OPPE"]) {
  const examPath = join(dataDir, exam);
  try {
    const courses = readdirSync(examPath, { withFileTypes: true }).filter(
      (directory: { isDirectory: () => boolean }) => directory.isDirectory(),
    );
    for (const course of courses.slice(0, 2)) {
      const files = readdirSync(join(examPath, course.name)).filter(
        (file: string) => file.endsWith(".json") && file !== "index.json",
      );
      papers.push(...files.slice(0, 2).map((file: string) => file.replace(".json", "")));
    }
  } catch {}
}

console.log(`\nFound ${papers.length} sample paper IDs to check`);

let totalQ = 0;
let papersWithQ = 0;
for (const paperId of papers.slice(0, 10)) {
  const count = await queryCount("quiz-questions", "paperUuid = :pid", { ":pid": paperId });
  if (count > 0) {
    papersWithQ++;
    totalQ += count;
    console.log(`  ${paperId.slice(0, 12)}...: ${count} questions ✓`);
  } else {
    console.log(`  ${paperId.slice(0, 12)}...: 0 questions ✗`);
  }
  await new Promise(r => setTimeout(r, 300));
}

console.log(`\n✅ ${papersWithQ}/${Math.min(10, papers.length)} papers have questions`);
console.log(`   Average: ${(totalQ / papersWithQ).toFixed(0)} questions per paper`);
