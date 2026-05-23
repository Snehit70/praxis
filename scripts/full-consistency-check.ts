#!/usr/bin/env bun
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type CourseStats = {
  exam: string;
  course: string;
  indexed: number;
  files: number;
  missingFiles: string[];
  unindexedFiles: string[];
  duplicateIndexUuids: string[];
  duplicateFileUuids: string[];
  parseErrors: string[];
  uuidSet: Set<string>;
};

type DatasetStats = {
  root: string;
  courses: Map<string, CourseStats>;
  totalExams: number;
  totalCourses: number;
  totalIndexed: number;
  totalFiles: number;
  missingFilesCount: number;
  unindexedFilesCount: number;
  parseErrorCount: number;
};

const OLD_DIR = path.resolve(process.env.OLD_DATA_DIR ?? path.join(process.cwd(), 'data'));
const NEW_DIR = path.resolve(process.env.NEW_DATA_DIR ?? path.join(process.cwd(), 'data-new'));
const OUT_DIR = path.join(process.cwd(), 'reports');

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function getExamDirs(root: string) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(path.join(root, name, 'metadata.json')))
    .sort((a, b) => a.localeCompare(b));
}

function uniqueDuplicates(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort((a, b) => a.localeCompare(b));
}

function collectDataset(root: string): DatasetStats {
  const exams = getExamDirs(root);
  const courses = new Map<string, CourseStats>();

  let totalCourses = 0;
  let totalIndexed = 0;
  let totalFiles = 0;
  let missingFilesCount = 0;
  let unindexedFilesCount = 0;
  let parseErrorCount = 0;

  for (const exam of exams) {
    const examDir = path.join(root, exam);
    const courseDirs = readdirSync(examDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    for (const course of courseDirs) {
      totalCourses += 1;
      const courseDir = path.join(examDir, course);
      const indexPath = path.join(courseDir, 'index.json');
      const key = `${exam}::${course}`;
      const parseErrors: string[] = [];

      let indexEntries: Array<{ uuid?: string }> = [];
      if (existsSync(indexPath)) {
        try {
          const parsed = readJson(indexPath);
          if (Array.isArray(parsed)) indexEntries = parsed as Array<{ uuid?: string }>;
          else parseErrors.push('index.json is not an array');
        } catch (error) {
          parseErrors.push(`index.json parse error: ${String(error)}`);
        }
      } else {
        parseErrors.push('index.json missing');
      }

      const indexUuids = indexEntries
        .map((entry) => (typeof entry.uuid === 'string' ? entry.uuid : ''))
        .filter(Boolean);
      const duplicateIndexUuids = uniqueDuplicates(indexUuids);
      const indexUuidSet = new Set(indexUuids);

      const fileNames = readdirSync(courseDir).filter(
        (name) => name.endsWith('.json') && name !== 'index.json' && name !== 'metadata.json',
      );
      const fileUuids: string[] = [];
      for (const name of fileNames) {
        const full = path.join(courseDir, name);
        const fallbackUuid = path.basename(name, '.json');
        try {
          const parsed = readJson(full) as { uuid?: string };
          fileUuids.push(typeof parsed.uuid === 'string' ? parsed.uuid : fallbackUuid);
        } catch (error) {
          fileUuids.push(fallbackUuid);
          parseErrors.push(`${name} parse error: ${String(error)}`);
        }
      }
      const duplicateFileUuids = uniqueDuplicates(fileUuids);
      const fileUuidSet = new Set(fileUuids);

      const missingFiles = [...indexUuidSet].filter((uuid) => !fileUuidSet.has(uuid)).sort((a, b) => a.localeCompare(b));
      const unindexedFiles = [...fileUuidSet].filter((uuid) => !indexUuidSet.has(uuid)).sort((a, b) => a.localeCompare(b));

      totalIndexed += indexUuidSet.size;
      totalFiles += fileUuidSet.size;
      missingFilesCount += missingFiles.length;
      unindexedFilesCount += unindexedFiles.length;
      parseErrorCount += parseErrors.length;

      courses.set(key, {
        exam,
        course,
        indexed: indexUuidSet.size,
        files: fileUuidSet.size,
        missingFiles,
        unindexedFiles,
        duplicateIndexUuids,
        duplicateFileUuids,
        parseErrors,
        uuidSet: fileUuidSet,
      });
    }
  }

  return {
    root,
    courses,
    totalExams: exams.length,
    totalCourses,
    totalIndexed,
    totalFiles,
    missingFilesCount,
    unindexedFilesCount,
    parseErrorCount,
  };
}

function table(headers: string[], rows: Array<Array<string | number>>) {
  const widths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => String(row[i] ?? '').length)),
  );
  const headerRow = `| ${headers.map((h, i) => h.padEnd(widths[i]!)).join(' | ')} |`;
  const divider = `| ${widths.map((w) => '-'.repeat(w)).join(' | ')} |`;
  const body = rows.map(
    (row) => `| ${row.map((cell, i) => String(cell ?? '').padEnd(widths[i]!)).join(' | ')} |`,
  );
  return [headerRow, divider, ...body].join('\n');
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const oldData = collectDataset(OLD_DIR);
  const newData = collectDataset(NEW_DIR);
  const allKeys = new Set([...oldData.courses.keys(), ...newData.courses.keys()]);

  const perCourse = [...allKeys]
    .sort((a, b) => a.localeCompare(b))
    .map((key) => {
      const left = oldData.courses.get(key);
      const right = newData.courses.get(key);
      const oldCount = left?.files ?? 0;
      const newCount = right?.files ?? 0;
      const added = right ? [...right.uuidSet].filter((uuid) => !(left?.uuidSet.has(uuid) ?? false)).length : 0;
      const removed = left ? [...left.uuidSet].filter((uuid) => !(right?.uuidSet.has(uuid) ?? false)).length : 0;
      return {
        exam: right?.exam ?? left?.exam ?? 'unknown',
        course: right?.course ?? left?.course ?? 'unknown',
        oldCount,
        newCount,
        delta: newCount - oldCount,
        added,
        removed,
        oldMissing: left?.missingFiles.length ?? 0,
        newMissing: right?.missingFiles.length ?? 0,
        oldUnindexed: left?.unindexedFiles.length ?? 0,
        newUnindexed: right?.unindexedFiles.length ?? 0,
        oldParseErrors: left?.parseErrors.length ?? 0,
        newParseErrors: right?.parseErrors.length ?? 0,
      };
    });

  const mismatches = perCourse.filter((row) => row.delta !== 0 || row.added !== 0 || row.removed !== 0);
  const integrityIssues = perCourse.filter(
    (row) =>
      row.oldMissing > 0 ||
      row.newMissing > 0 ||
      row.oldUnindexed > 0 ||
      row.newUnindexed > 0 ||
      row.oldParseErrors > 0 ||
      row.newParseErrors > 0,
  );

  const summary = {
    generatedAt: new Date().toISOString(),
    oldDir: OLD_DIR,
    newDir: NEW_DIR,
    old: {
      exams: oldData.totalExams,
      courses: oldData.totalCourses,
      indexed: oldData.totalIndexed,
      files: oldData.totalFiles,
      missingFiles: oldData.missingFilesCount,
      unindexedFiles: oldData.unindexedFilesCount,
      parseErrors: oldData.parseErrorCount,
    },
    new: {
      exams: newData.totalExams,
      courses: newData.totalCourses,
      indexed: newData.totalIndexed,
      files: newData.totalFiles,
      missingFiles: newData.missingFilesCount,
      unindexedFiles: newData.unindexedFilesCount,
      parseErrors: newData.parseErrorCount,
    },
    changedCourses: mismatches.length,
    integrityIssueCourses: integrityIssues.length,
  };

  const md = `# Full Consistency Check

Generated: ${summary.generatedAt}

Old dataset: \`${summary.oldDir}\`
New dataset: \`${summary.newDir}\`

## Totals

${table(['Metric', 'Old', 'New'], [
    ['Exam folders', summary.old.exams, summary.new.exams],
    ['Course folders', summary.old.courses, summary.new.courses],
    ['Indexed paper UUIDs', summary.old.indexed, summary.new.indexed],
    ['Paper JSON files', summary.old.files, summary.new.files],
    ['Missing files from index', summary.old.missingFiles, summary.new.missingFiles],
    ['Unindexed files', summary.old.unindexedFiles, summary.new.unindexedFiles],
    ['Parse errors', summary.old.parseErrors, summary.new.parseErrors],
  ])}

## High-Level Result

- Course-by-course count changes: **${summary.changedCourses}** course folders
- Integrity issue course folders: **${summary.integrityIssueCourses}**

## Largest Course Deltas

${table(
    ['Exam', 'Course', 'Old', 'New', 'Delta', 'Added UUIDs', 'Removed UUIDs'],
    mismatches
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.added - a.added || a.exam.localeCompare(b.exam))
      .slice(0, 100)
      .map((row) => [row.exam, row.course, row.oldCount, row.newCount, row.delta, row.added, row.removed]),
  )}

## Integrity Issue Courses

${table(
    ['Exam', 'Course', 'OldMissing', 'NewMissing', 'OldUnindexed', 'NewUnindexed', 'OldParseErr', 'NewParseErr'],
    integrityIssues.slice(0, 100).map((row) => [
      row.exam,
      row.course,
      row.oldMissing,
      row.newMissing,
      row.oldUnindexed,
      row.newUnindexed,
      row.oldParseErrors,
      row.newParseErrors,
    ]),
  )}
`;

  const outJson = {
    summary,
    perCourse,
    mismatches,
    integrityIssues,
  };

  writeFileSync(path.join(OUT_DIR, 'full-consistency-check.json'), `${JSON.stringify(outJson, null, 2)}\n`);
  writeFileSync(path.join(OUT_DIR, 'full-consistency-check.md'), md);

  console.log(md);
}

main();
