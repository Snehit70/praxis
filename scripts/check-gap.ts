#!/usr/bin/env bun
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { readdirSync } from "fs";
import { join } from "path";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const docClient = DynamoDBDocumentClient.from(client);

console.log("Checking data gap...\n");

// Get paper UUIDs from DynamoDB
console.log("📄 Scanning DynamoDB papers...");
const dbPapers = new Set<string>();
let lastKey: any;
do {
  const result = await docClient.send(new ScanCommand({
    TableName: "quiz-papers",
    ProjectionExpression: "#uuid",
    ExpressionAttributeNames: { "#uuid": "uuid" },
    ExclusiveStartKey: lastKey,
    Limit: 100,
  }));
  for (const item of result.Items || []) {
    dbPapers.add(item.uuid);
  }
  lastKey = result.LastEvaluatedKey;
  if (lastKey) await new Promise(r => setTimeout(r, 100));
} while (lastKey);
console.log(`   Found: ${dbPapers.size} papers\n`);

// Get paper UUIDs from raw JSON
console.log("📁 Scanning raw JSON files...");
const jsonPapers = new Set<string>();
const dataDir = join(process.cwd(), "data");
const examDirs = ["Quiz 1", "Quiz 2", "End Term Quiz", "OPPE"];

for (const exam of examDirs) {
  const examPath = join(dataDir, exam);
  try {
    const courses = readdirSync(examPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    
    for (const course of courses) {
      const files = readdirSync(join(examPath, course))
        .filter(f => f.endsWith(".json") && f !== "index.json" && f !== "metadata.json");
      
      for (const file of files) {
        jsonPapers.add(file.replace(".json", ""));
      }
    }
  } catch {}
}
console.log(`   Found: ${jsonPapers.size} papers\n`);

// Compare
const missing = [...jsonPapers].filter(p => !dbPapers.has(p));
const extra = [...dbPapers].filter(p => !jsonPapers.has(p));

console.log("═══════════════════════════════════════════════════════════");
console.log("                    COMPARISON                              ");
console.log("═══════════════════════════════════════════════════════════");
console.log(`  Raw JSON papers:      ${jsonPapers.size}`);
console.log(`  DynamoDB papers:      ${dbPapers.size}`);
console.log(`  Missing from DB:      ${missing.length}`);
console.log(`  Extra in DB:          ${extra.length}`);

if (missing.length > 0 && missing.length < 50) {
  console.log("\n  Sample missing papers:");
  missing.slice(0, 10).forEach(p => console.log(`    - ${p}`));
}

// Check if questions exist for missing papers
if (missing.length > 0) {
  console.log("\n\n🔍 Checking if questions exist for missing papers...");
  
  const sampleMissing = missing.slice(0, 5);
  for (const paperId of sampleMissing) {
    const result = await docClient.send(new ScanCommand({
      TableName: "quiz-questions",
      FilterExpression: "paperUuid = :pid",
      ExpressionAttributeValues: { ":pid": paperId },
      Select: "COUNT",
    }));
    console.log(`  ${paperId.slice(0, 20)}... : ${result.Count} questions in DB`);
    await new Promise(r => setTimeout(r, 200));
  }
}
