#!/usr/bin/env bun
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

interface PaperInfo {
  key: string;
  exam: string;
  courseDir: string;
  paperUuid: string;
  relativePath: string;
  size: number;
  hash: string;
  questionCount: number | null;
  updatedAt: string | null;
  year: number | null;
}

const OLD_DIR = path.resolve(process.env.OLD_DATA_DIR ?? path.join(process.cwd(), 'data'));
const NEW_DIR = path.resolve(process.env.NEW_DATA_DIR ?? path.join(process.cwd(), 'data-new'));
const REPORT_DIR = path.join(process.cwd(), 'reports');

async function sha256(filePath: string) {
  const bytes = await Bun.file(filePath).arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function readJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function walkJson(dir: string, files: string[] = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkJson(fullPath, files);
    } else if (entry.name.endsWith('.json') && entry.name !== 'metadata.json' && entry.name !== 'index.json') {
      files.push(fullPath);
    }
  }
  return files;
}

async function collect(root: string) {
  const map = new Map<string, PaperInfo>();
  for (const filePath of walkJson(root)) {
    const relativePath = path.relative(root, filePath);
    const [exam = 'unknown', courseDir = 'unknown'] = relativePath.split(path.sep);
    const json = readJson(filePath);
    const paperUuid = json.uuid ?? path.basename(filePath, '.json');
    const key = `${exam}::${courseDir}::${paperUuid}`;
    map.set(key, {
      key,
      exam,
      courseDir,
      paperUuid,
      relativePath,
      size: readFileSync(filePath).byteLength,
      hash: await sha256(filePath),
      questionCount: Array.isArray(json.questions) ? json.questions.length : null,
      updatedAt: json.updated_at ?? null,
      year: typeof json.year === 'number' ? json.year : null,
    });
  }
  return map;
}

function byExam(items: PaperInfo[]) {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.exam, (counts.get(item.exam) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function table(headers: string[], rows: Array<Array<string | number | null>>, limit = rows.length) {
  const visible = rows.slice(0, limit);
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...visible.map((row) => String(row[index] ?? '').length)),
  );
  return [
    `| ${headers.map((header, index) => header.padEnd(widths[index]!)).join(' | ')} |`,
    `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`,
    ...visible.map((row) => `| ${row.map((cell, index) => String(cell ?? '').padEnd(widths[index]!)).join(' | ')} |`),
  ].join('\n');
}

async function main() {
  mkdirSync(REPORT_DIR, { recursive: true });
  const oldPapers = await collect(OLD_DIR);
  const newPapers = await collect(NEW_DIR);

  const added = [...newPapers.values()].filter((paper) => !oldPapers.has(paper.key));
  const removed = [...oldPapers.values()].filter((paper) => !newPapers.has(paper.key));
  const changed = [...newPapers.values()].filter((paper) => {
    const previous = oldPapers.get(paper.key);
    return previous && previous.hash !== paper.hash;
  });
  const unchanged = [...newPapers.values()].filter((paper) => {
    const previous = oldPapers.get(paper.key);
    return previous && previous.hash === paper.hash;
  });

  const changedDetails = changed.map((paper) => {
    const previous = oldPapers.get(paper.key)!;
    return {
      key: paper.key,
      relativePath: paper.relativePath,
      oldQuestions: previous.questionCount,
      newQuestions: paper.questionCount,
      oldUpdatedAt: previous.updatedAt,
      newUpdatedAt: paper.updatedAt,
      oldSize: previous.size,
      newSize: paper.size,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    oldDir: OLD_DIR,
    newDir: NEW_DIR,
    counts: {
      oldPapers: oldPapers.size,
      newPapers: newPapers.size,
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      unchanged: unchanged.length,
    },
    byExam: {
      added: byExam(added),
      removed: byExam(removed),
      changed: byExam(changed),
    },
    added,
    removed,
    changed: changedDetails,
  };

  const md = `# Scraped Data Diff

Generated: ${report.generatedAt}

Old data: \`${OLD_DIR}\`
New data: \`${NEW_DIR}\`

## Summary

${table(['Metric', 'Count'], [
    ['Old paper variants', oldPapers.size],
    ['New paper variants', newPapers.size],
    ['Added', added.length],
    ['Removed', removed.length],
    ['Changed', changed.length],
    ['Unchanged', unchanged.length],
])}

## Added By Exam

${table(['Exam', 'Added'], Object.entries(report.byExam.added).map(([exam, count]) => [exam, count]))}

## Changed By Exam

${table(['Exam', 'Changed'], Object.entries(report.byExam.changed).map(([exam, count]) => [exam, count]))}

## Removed By Exam

${table(['Exam', 'Removed'], Object.entries(report.byExam.removed).map(([exam, count]) => [exam, count]))}

## Sample Added

${table(['Path', 'Questions', 'Year', 'Updated At'], added.slice(0, 50).map((paper) => [
    paper.relativePath,
    paper.questionCount,
    paper.year,
    paper.updatedAt,
]))}

## Sample Changed

${table(['Path', 'Old Qs', 'New Qs', 'Old Updated', 'New Updated'], changedDetails.slice(0, 50).map((paper) => [
    paper.relativePath,
    paper.oldQuestions,
    paper.newQuestions,
    paper.oldUpdatedAt,
    paper.newUpdatedAt,
]))}
`;

  writeFileSync(path.join(REPORT_DIR, 'scraped-data-diff.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(path.join(REPORT_DIR, 'scraped-data-diff.md'), md);
  console.log(md);
}

void main();
