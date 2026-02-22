#!/usr/bin/env bun
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const EXAM_DIRS = ["Quiz 1", "Quiz 2", "End Term Quiz", "OPPE"];

const uuidFromFile = new Map<string, string>(); // uuid -> filename
const duplicateUuids = new Set<string>();
let totalFiles = 0;
let filesWithUuidField = 0;

for (const examDir of EXAM_DIRS) {
  const examPath = join(DATA_DIR, examDir);
  if (!existsSync(examPath)) continue;
  
  const courseDirs = readdirSync(examPath, { withFileTypes: true }).filter(d => d.isDirectory());
  
  for (const courseDir of courseDirs) {
    const coursePath = join(examPath, courseDir.name);
    const files = readdirSync(coursePath).filter(f => 
      f.endsWith(".json") && f !== "index.json" && f !== "metadata.json"
    );
    
    for (const file of files) {
      totalFiles++;
      const filePath = join(coursePath, file);
      try {
        const data = JSON.parse(readFileSync(filePath, "utf-8"));
        
        if (data.uuid) {
          filesWithUuidField++;
          const uuid = data.uuid;
          
          if (uuidFromFile.has(uuid)) {
            duplicateUuids.add(uuid);
            // console.log(`  DUPLICATE: ${uuid} in ${file} and ${uuidFromFile.get(uuid)}`);
          } else {
            uuidFromFile.set(uuid, file);
          }
        } else {
          console.log(`  NO UUID FIELD: ${file}`);
        }
      } catch (e) {
        console.log(`  ERROR PARSING: ${file}`);
      }
    }
  }
}

console.log("═══════════════════════════════════════════════════════════");
console.log("UUID ANALYSIS");
console.log("═══════════════════════════════════════════════════════════");
console.log(`Total files:          ${totalFiles}`);
console.log(`Files with uuid:      ${filesWithUuidField}`);
console.log(`Unique UUIDs:         ${uuidFromFile.size}`);
console.log(`Duplicate UUIDs:      ${duplicateUuids.size}`);
console.log(`Files deduplicated:   ${filesWithUuidField - uuidFromFile.size}`);
