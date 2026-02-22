#!/usr/bin/env bun
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");

// Pick a duplicated paper and compare questions across courses
const paperUuid = "a3d88545-398";
const courses = ["CT", "Maths2", "Statistics2"];

console.log(`Comparing questions for paper ${paperUuid} across courses:\n`);

const questionsByCourse = new Map<string, Set<string>>();

for (const course of courses) {
  const filePath = join(DATA_DIR, "Quiz 1", course, `${paperUuid}.json`);
  if (!existsSync(filePath)) {
    console.log(`${course}: File not found`);
    continue;
  }
  
  const data = JSON.parse(readFileSync(filePath, "utf-8"));
  const questionUuids = new Set<string>();
  const questionNumbers = new Set<number>();
  
  for (const q of data.questions || []) {
    questionUuids.add(q.uuid);
    questionNumbers.add(q.question_number);
  }
  
  questionsByCourse.set(course, questionUuids);
  
  console.log(`${course}:`);
  console.log(`  Question count: ${data.questions?.length}`);
  console.log(`  Question numbers: ${[...questionNumbers].sort((a,b) => a-b).slice(0, 10).join(", ")}...`);
  console.log(`  Sample question UUIDs:`);
  for (const uuid of [...questionUuids].slice(0, 3)) {
    console.log(`    ${uuid}`);
  }
  console.log();
}

// Compare overlap
console.log("═══════════════════════════════════════════════════════════");
console.log("QUESTION UUID OVERLAP");
console.log("═══════════════════════════════════════════════════════════");

const [ct, maths, stats] = [...questionsByCourse.values()];
const courseNames = [...questionsByCourse.keys()];

const overlap = (a: Set<string>, b: Set<string>) => [...a].filter(x => b.has(x)).length;

console.log(`\nCT vs Maths2: ${overlap(questionsByCourse.get("CT")!, questionsByCourse.get("Maths2")!)} shared`);
console.log(`CT vs Stats2: ${overlap(questionsByCourse.get("CT")!, questionsByCourse.get("Statistics2")!)} shared`);
console.log(`Maths2 vs Stats2: ${overlap(questionsByCourse.get("Maths2")!, questionsByCourse.get("Statistics2")!)} shared`);
