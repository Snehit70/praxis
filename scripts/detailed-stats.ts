#!/usr/bin/env bun
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const docClient = DynamoDBDocumentClient.from(client);

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function getQuestionCount(paperUuid: string): Promise<number> {
  let count = 0;
  let lastKey: any;
  
  do {
    const result = await docClient.send(new QueryCommand({
      TableName: "quiz-questions",
      KeyConditionExpression: "paperUuid = :pid",
      ExpressionAttributeValues: { ":pid": paperUuid },
      Select: "COUNT",
      ExclusiveStartKey: lastKey,
    }));
    count += result.Count || 0;
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return count;
}

console.log("📊 Detailed Paper & Subject Analysis\n");
console.log("Reading paper data from DynamoDB...\n");

// Scan papers
let papers: any[] = [];
let lastKey: any;
do {
  const result = await docClient.send(new ScanCommand({
    TableName: "quiz-papers",
    ExclusiveStartKey: lastKey,
    Limit: 100,
  }));
  papers.push(...(result.Items || []));
  lastKey = result.LastEvaluatedKey;
  if (lastKey) await delay(200);
} while (lastKey);

console.log(`Found ${papers.length} papers in DynamoDB\n`);

// Group by course
const byCourse = new Map<string, any[]>();
for (const p of papers) {
  const course = p.courseName || "Unknown";
  if (!byCourse.has(course)) byCourse.set(course, []);
  byCourse.get(course)!.push(p);
}

// Group by exam
const byExam = new Map<string, any[]>();
for (const p of papers) {
  const exam = p.examName || p.examId || "Unknown";
  if (!byExam.has(exam)) byExam.set(exam, []);
  byExam.get(exam)!.push(p);
}

console.log("═══════════════════════════════════════════════════════════════════════════");
console.log("                        PAPERS PER EXAM TYPE                                ");
console.log("═══════════════════════════════════════════════════════════════════════════");

const examOrder = ["Quiz 1", "Quiz 2", "End Term Quiz", "OPPE"];
for (const exam of examOrder) {
  const examPapers = byExam.get(exam) || [];
  if (examPapers.length > 0) {
    console.log(`\n📁 ${exam.toUpperCase()} (${examPapers.length} papers)`);
    console.log("─".repeat(75));
    
    // Group by course within exam
    const examByCourse = new Map<string, number>();
    for (const p of examPapers) {
      const course = p.courseName || "Unknown";
      examByCourse.set(course, (examByCourse.get(course) || 0) + 1);
    }
    
    const sorted = [...examByCourse.entries()].sort((a, b) => b[1] - a[1]);
    console.log(`${"Course".padEnd(35)} | ${"Papers".padStart(8)}`);
    console.log("─".repeat(50));
    for (const [course, count] of sorted) {
      console.log(`${course.slice(0, 35).padEnd(35)} | ${count.toString().padStart(8)}`);
    }
  }
}

console.log("\n\n═══════════════════════════════════════════════════════════════════════════");
console.log("                    TOP 20 COURSES (ALL EXAMS)                              ");
console.log("═══════════════════════════════════════════════════════════════════════════");

const sortedCourses = [...byCourse.entries()].sort((a, b) => b[1].length - a[1].length);
console.log(`${"Course".padEnd(35)} | ${"Papers".padStart(8)} | ${"Exam Distribution".padStart(30)}`);
console.log("─".repeat(80));

for (const [course, coursePapers] of sortedCourses.slice(0, 20)) {
  const exams = new Map<string, number>();
  for (const p of coursePapers) {
    const exam = p.examName || "Unknown";
    exams.set(exam, (exams.get(exam) || 0) + 1);
  }
  const examStr = [...exams.entries()].map(([e, c]) => `${e.slice(0, 4)}:${c}`).join(", ");
  console.log(`${course.slice(0, 35).padEnd(35)} | ${coursePapers.length.toString().padStart(8)} | ${examStr.padStart(30)}`);
}

console.log("\n\n═══════════════════════════════════════════════════════════════════════════");
console.log("                    SAMPLE PAPER DETAILS                                    ");
console.log("═══════════════════════════════════════════════════════════════════════════");

console.log("\nFetching question counts for first 10 papers...\n");
console.log(`${"Paper UUID".padEnd(20)} | ${"Course".padEnd(25)} | ${"Exam".padEnd(12)} | ${"Questions".padStart(10)}`);
console.log("─".repeat(75));

for (const p of papers.slice(0, 10)) {
  const count = await getQuestionCount(p.uuid);
  const uuid = p.uuid.slice(0, 18) + "...";
  const course = (p.courseName || "Unknown").slice(0, 25);
  const exam = (p.examName || "Unknown").slice(0, 12);
  console.log(`${uuid.padEnd(20)} | ${course.padEnd(25)} | ${exam.padEnd(12)} | ${count.toString().padStart(10)}`);
  await delay(300);
}

// Summary stats
console.log("\n\n═══════════════════════════════════════════════════════════════════════════");
console.log("                         SUMMARY                                             ");
console.log("═══════════════════════════════════════════════════════════════════════════");

console.log(`\n  Total Papers:     ${papers.length}`);
console.log(`  Total Courses:    ${byCourse.size}`);
console.log(`  Total Exam Types: ${byExam.size}`);

console.log("\n  Papers per Exam:");
for (const exam of examOrder) {
  const count = (byExam.get(exam) || []).length;
  console.log(`    ${exam.padEnd(15)}: ${count}`);
}

const avgPapersPerCourse = papers.length / byCourse.size;
console.log(`\n  Avg Papers per Course: ${avgPapersPerCourse.toFixed(1)}`);

console.log("\n✅ Analysis complete!");
