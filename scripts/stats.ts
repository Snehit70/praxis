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

async function scanWithDelay(tableName: string, attributes: string[], limit: number = 500): Promise<any[]> {
  const items: any[] = [];
  let lastKey: any;
  
  const attrNames: Record<string, string> = {};
  attributes.forEach((attr, i) => {
    attrNames[`#a${i}`] = attr;
  });
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: tableName,
      ProjectionExpression: attributes.map((_, i) => `#a${i}`).join(", "),
      ExpressionAttributeNames: attrNames,
      ExclusiveStartKey: lastKey,
      Limit: limit,
    }));
    
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
    
    if (lastKey) await delay(150);
  } while (lastKey);
  
  return items;
}

console.log("📊 Gathering stats from DynamoDB...\n");

// Get papers with exam info
console.log("📄 Scanning papers...");
const papers = await scanWithDelay("quiz-papers", ["uuid", "examId", "examName", "courseId", "courseName"]);
console.log(`   Found: ${papers.length} papers\n`);

// Get question counts per paper (sample)
console.log("❓ Sampling questions...");
const questionSample = await scanWithDelay("quiz-questions", ["paperUuid", "questionNumber", "questionType", "courseId"], 1000);
console.log(`   Sampled: ${questionSample.length} questions\n`);

// Calculate stats
const examStats = new Map<string, { papers: number; questions: number }>();
const courseStats = new Map<string, { papers: number; questions: number }>();
const questionTypes = new Map<string, number>();

// Count papers per exam
for (const p of papers) {
  const exam = p.examName || p.examId || "Unknown";
  const stat = examStats.get(exam) || { papers: 0, questions: 0 };
  stat.papers++;
  examStats.set(exam, stat);
}

// Count questions per paper from sample
const questionsPerPaper = new Map<string, number>();
for (const q of questionSample) {
  questionsPerPaper.set(q.paperUuid, (questionsPerPaper.get(q.paperUuid) || 0) + 1);
  
  const type = q.questionType || "Unknown";
  questionTypes.set(type, (questionTypes.get(type) || 0) + 1);
}

// Estimate total questions per exam
const avgQuestionsPerPaper = questionSample.length / questionsPerPaper.size;
console.log(`📈 Stats Summary:\n`);

console.log("═══════════════════════════════════════════════════════════");
console.log("                      BY EXAM TYPE                          ");
console.log("═══════════════════════════════════════════════════════════");
console.log(`${"Exam".padEnd(20)} | ${"Papers".padStart(8)} | ${"Est. Questions".padStart(15)}`);
console.log("─".repeat(50));

const examOrder = ["Quiz 1", "Quiz 2", "End Term Quiz", "OPPE"];
let totalPapers = 0;
for (const exam of examOrder) {
  const stat = examStats.get(exam) || { papers: 0, questions: 0 };
  const estQuestions = Math.round(stat.papers * avgQuestionsPerPaper);
  console.log(`${exam.padEnd(20)} | ${stat.papers.toString().padStart(8)} | ${estQuestions.toLocaleString().padStart(15)}`);
  totalPapers += stat.papers;
}

// Other exams
for (const [exam, stat] of examStats) {
  if (!examOrder.includes(exam)) {
    const estQuestions = Math.round(stat.papers * avgQuestionsPerPaper);
    console.log(`${exam.padEnd(20)} | ${stat.papers.toString().padStart(8)} | ${estQuestions.toLocaleString().padStart(15)}`);
    totalPapers += stat.papers;
  }
}

console.log("─".repeat(50));
console.log(`${"TOTAL".padEnd(20)} | ${totalPapers.toString().padStart(8)} | ${Math.round(totalPapers * avgQuestionsPerPaper).toLocaleString().padStart(15)}`);

// Top courses by paper count
console.log("\n═══════════════════════════════════════════════════════════");
console.log("                  TOP 15 COURSES                            ");
console.log("═══════════════════════════════════════════════════════════");

const coursePaperCount = new Map<string, number>();
for (const p of papers) {
  const course = p.courseName || "Unknown";
  coursePaperCount.set(course, (coursePaperCount.get(course) || 0) + 1);
}

const topCourses = [...coursePaperCount.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15);

console.log(`${"Course".padEnd(30)} | ${"Papers".padStart(8)}`);
console.log("─".repeat(42));
for (const [course, count] of topCourses) {
  console.log(`${course.slice(0, 30).padEnd(30)} | ${count.toString().padStart(8)}`);
}

// Question types
console.log("\n═══════════════════════════════════════════════════════════");
console.log("                  QUESTION TYPES                            ");
console.log("═══════════════════════════════════════════════════════════");

const totalSampleQ = [...questionTypes.values()].reduce((a, b) => a + b, 0);
for (const [type, count] of [...questionTypes.entries()].sort((a, b) => b[1] - a[1])) {
  const pct = ((count / totalSampleQ) * 100).toFixed(1);
  console.log(`${type.padEnd(15)} | ${count.toString().padStart(6)} (${pct}%)`);
}

// Comparison with raw data
console.log("\n═══════════════════════════════════════════════════════════");
console.log("              IMPORT COMPARISON                              ");
console.log("═══════════════════════════════════════════════════════════");
console.log(`${"Metric".padEnd(20)} | ${"Raw JSON".padStart(12)} | ${"DynamoDB".padStart(12)}`);
console.log("─".repeat(48));
console.log(`${"Papers".padEnd(20)} | ${"3,874".padStart(12)} | ${papers.length.toString().padStart(12)}`);
console.log(`${"Questions (est)".padEnd(20)} | ${"94,671".padStart(12)} | ${Math.round(papers.length * avgQuestionsPerPaper).toLocaleString().padStart(12)}`);
console.log(`${"Import %".padEnd(20)} | ${"100%".padStart(12)} | ${((papers.length / 3874) * 100).toFixed(1).padStart(11)}%`);

console.log("\n✅ Stats complete!");
