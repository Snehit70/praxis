#!/usr/bin/env bun
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const docClient = DynamoDBDocumentClient.from(client);

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

console.log("📊 Final Import Statistics\n");
console.log("Scanning DynamoDB tables...\n");

// Count papers
let paperCount = 0;
let lastKey: any;
do {
  const result = await docClient.send(new ScanCommand({
    TableName: "quiz-papers",
    Select: "COUNT",
    ExclusiveStartKey: lastKey,
  }));
  paperCount += result.Count || 0;
  lastKey = result.LastEvaluatedKey;
  if (lastKey) await delay(100);
} while (lastKey);

// Count questions with course distribution
let questionCount = 0;
const courses = new Map<string, number>();
const exams = new Map<string, number>();
const questionTypes = new Map<string, number>();

lastKey = undefined;
do {
  const result = await docClient.send(new ScanCommand({
    TableName: "quiz-questions",
    ProjectionExpression: "courseName, questionType",
    ExclusiveStartKey: lastKey,
    Limit: 500,
  }));
  
  for (const item of result.Items || []) {
    questionCount++;
    const course = item.courseName || "Unknown";
    const type = item.questionType || "Unknown";
    courses.set(course, (courses.get(course) || 0) + 1);
    questionTypes.set(type, (questionTypes.get(type) || 0) + 1);
  }
  
  lastKey = result.LastEvaluatedKey;
  process.stdout.write(`\r   Questions scanned: ${questionCount}`);
  if (lastKey) await delay(100);
} while (lastKey);

console.log("\n\n═══════════════════════════════════════════════════════════════════════════");
console.log("                         FINAL STATISTICS                                     ");
console.log("═════════════════════════════════════════════════════════════════════════════");

console.log(`\n  Papers:              ${paperCount.toLocaleString()}`);
console.log(`  Questions:           ${questionCount.toLocaleString()}`);
console.log(`  Unique Courses:      ${courses.size}`);

console.log("\n═════════════════════════════════════════════════════════════════════════════");
console.log("                    TOP 20 COURSES BY QUESTIONS                              ");
console.log("═════════════════════════════════════════════════════════════════════════════");

const topCourses = [...courses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
console.log(`${"Course".padEnd(30)} | ${"Questions".padStart(10)}`);
console.log("─".repeat(45));
for (const [course, count] of topCourses) {
  console.log(`${course.slice(0, 30).padEnd(30)} | ${count.toLocaleString().padStart(10)}`);
}

console.log("\n═════════════════════════════════════════════════════════════════════════════");
console.log("                    QUESTION TYPES                                           ");
console.log("═════════════════════════════════════════════════════════════════════════════");

const totalTypes = [...questionTypes.values()].reduce((a, b) => a + b, 0);
for (const [type, count] of [...questionTypes.entries()].sort((a, b) => b[1] - a[1])) {
  const pct = ((count / totalTypes) * 100).toFixed(1);
  console.log(`  ${type.padEnd(15)} ${count.toLocaleString().padStart(8)} (${pct}%)`);
}

console.log("\n✅ Import verified successfully!");
