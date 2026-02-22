#!/usr/bin/env bun
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const EXAM_DIRS = ["Quiz 1", "Quiz 2", "End Term Quiz", "OPPE"];

const uuidLocations = new Map<string, string[]>();
const uuidQuestionCounts = new Map<string, number[]>();

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
      const filePath = join(coursePath, file);
      try {
        const data = JSON.parse(readFileSync(filePath, "utf-8"));
        const uuid = data.uuid;
        const location = `${examDir}/${courseDir.name}/${file}`;
        
        if (!uuidLocations.has(uuid)) {
          uuidLocations.set(uuid, []);
          uuidQuestionCounts.set(uuid, []);
        }
        uuidLocations.get(uuid)!.push(location);
        uuidQuestionCounts.get(uuid)!.push(data.questions?.length || 0);
      } catch {}
    }
  }
}

// Find duplicates with different question counts
console.log("Analyzing duplicates...\n");

let sameCount = 0;
let differentCount = 0;

for (const [uuid, locations] of uuidLocations) {
  if (locations.length > 1) {
    const counts = uuidQuestionCounts.get(uuid)!;
    const allSame = counts.every(c => c === counts[0]);
    
    if (allSame) {
      sameCount++;
    } else {
      differentCount++;
      if (differentCount <= 5) {
        console.log(`UUID ${uuid}:`);
        locations.forEach((loc, i) => {
          console.log(`  ${loc} - ${counts[i]} questions`);
        });
        console.log();
      }
    }
  }
}

console.log("═══════════════════════════════════════════════════════════");
console.log("DUPLICATE ANALYSIS");
console.log("═══════════════════════════════════════════════════════════");
console.log(`Unique papers:            ${uuidLocations.size}`);
console.log(`Papers appearing 1x:      ${[...uuidLocations.values()].filter(l => l.length === 1).length}`);
console.log(`Papers appearing 2+x:     ${[...uuidLocations.values()].filter(l => l.length > 1).length}`);
console.log(`Duplicates (same Q count): ${sameCount}`);
console.log(`Duplicates (diff Q count): ${differentCount}`);

// Max appearances
const maxAppearances = Math.max(...[...uuidLocations.values()].map(l => l.length));
const exampleUuid = [...uuidLocations.entries()].find(([_, l]) => l.length === maxAppearances);
if (exampleUuid) {
  console.log(`\nMost duplicated paper (${maxAppearances} times):`);
  console.log(`  UUID: ${exampleUuid[0]}`);
  exampleUuid[1].slice(0, 5).forEach(loc => console.log(`    - ${loc}`));
}
