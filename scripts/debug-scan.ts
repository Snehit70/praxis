#!/usr/bin/env bun
import { readdirSync, existsSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const EXAM_DIRS = ["Quiz 1", "Quiz 2", "End Term Quiz", "OPPE"];

let totalFiles = 0;
let totalDirs = 0;
let filesWithQuestions = 0;
let filesWithNoQuestions = 0;

console.log("Scanning data directory structure...\n");

for (const examDir of EXAM_DIRS) {
  const examPath = join(DATA_DIR, examDir);
  if (!existsSync(examPath)) {
    console.log(`${examDir}: NOT FOUND`);
    continue;
  }
  
  const entries = readdirSync(examPath, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory());
  const files = entries.filter(e => e.isFile() && e.name.endsWith(".json") && !["index.json", "metadata.json"].includes(e.name));
  
  console.log(`\n${examDir}:`);
  console.log(`  Directories: ${dirs.length}`);
  console.log(`  Direct files: ${files.length}`);
  
  totalDirs += dirs.length;
  
  // Check each directory
  for (const dir of dirs) {
    const coursePath = join(examPath, dir.name);
    const courseFiles = readdirSync(coursePath).filter(f => 
      f.endsWith(".json") && f !== "index.json" && f !== "metadata.json"
    );
    
    totalFiles += courseFiles.length;
    
    // Sample first file to check if it has questions
    if (courseFiles.length > 0) {
      const filePath = join(coursePath, courseFiles[0]!);
      const content = JSON.parse(require("fs").readFileSync(filePath, "utf-8"));
      
      if (content.questions && content.questions.length > 0) {
        filesWithQuestions++;
      } else {
        filesWithNoQuestions++;
        console.log(`    ${dir.name}: NO QUESTIONS in ${courseFiles[0]}`);
      }
    }
  }
  
  // Direct files in exam folder
  totalFiles += files.length;
}

console.log("\n═══════════════════════════════════════════════════════════");
console.log("SUMMARY");
console.log("═══════════════════════════════════════════════════════════");
console.log(`Total course directories: ${totalDirs}`);
console.log(`Total paper files: ${totalFiles}`);
console.log(`Files with questions (sampled): ${filesWithQuestions}`);
console.log(`Files without questions (sampled): ${filesWithNoQuestions}`);
