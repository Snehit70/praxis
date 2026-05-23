#!/usr/bin/env bun
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getCanonicalCourseName, getCourseLevel } from '../src/lib/courseMapping';
import { shouldIncludeQuestion, type RawExamMetadata, type RawPaperFile, type RawQuestion } from '../src/lib/dataTransforms';

type CountMap = Map<string, number>;

interface PaperRecord {
  examName: string;
  examUuid: string;
  courseDir: string;
  courseUuid: string | null;
  courseName: string;
  canonicalCourse: string;
  courseLevel: string;
  paperUuid: string;
  paperPath: string;
  year: number | null;
  duration: number | null;
  totalScore: number | null;
  rawQuestions: number;
  importableQuestions: number;
  options: number;
}

interface Issue {
  kind: string;
  path: string;
  detail: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const OUTPUT_DIR = path.join(process.cwd(), 'reports');
const TOP_N = 30;

const count = (map: CountMap, key: string, delta = 1) => map.set(key, (map.get(key) ?? 0) + delta);
const pct = (part: number, total: number) => (total === 0 ? '0.0%' : `${((part / total) * 100).toFixed(1)}%`);
const isPresent = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const asNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function sortedEntries(map: CountMap) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function formatTable(headers: string[], rows: Array<Array<string | number>>, maxRows = rows.length) {
  const visibleRows = rows.slice(0, maxRows);
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...visibleRows.map((row) => String(row[index] ?? '').length)),
  );
  const line = `| ${headers.map((header, index) => header.padEnd(widths[index]!)).join(' | ')} |`;
  const sep = `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`;
  const body = visibleRows.map((row) => `| ${row.map((cell, index) => String(cell).padEnd(widths[index]!)).join(' | ')} |`);
  return [line, sep, ...body].join('\n');
}

function quantiles(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))] ?? 0;
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  return {
    min: sorted[0] ?? 0,
    p25: at(0.25),
    median: at(0.5),
    p75: at(0.75),
    p90: at(0.9),
    max: sorted.at(-1) ?? 0,
    avg: sorted.length === 0 ? 0 : sum / sorted.length,
  };
}

function questionImageCount(question: RawQuestion) {
  let total = 0;
  for (let i = 1; i <= 10; i += 1) {
    if (isPresent((question as unknown as Record<string, unknown>)[`question_image_${i}`])) {
      total += 1;
    }
  }
  return total;
}

const records: PaperRecord[] = [];
const issues: Issue[] = [];
const examMeta = new Map<string, RawExamMetadata>();
const examNames = new Set<string>();
const examUuids = new Set<string>();
const courseUuids = new Set<string>();
const courseNames = new Set<string>();
const canonicalCourses = new Set<string>();
const paperUuids = new Set<string>();
const questionUuids = new Set<string>();
const questionHashes = new Map<string, Set<string>>();
const questionUuidUses = new Map<string, Set<string>>();
const imageFiles = new Set<string>();

const byExamQuestions: CountMap = new Map();
const byExamPapers: CountMap = new Map();
const byCourseQuestions: CountMap = new Map();
const byCanonicalQuestions: CountMap = new Map();
const byLevelQuestions: CountMap = new Map();
const byYearPapers: CountMap = new Map();
const byYearQuestions: CountMap = new Map();
const questionTypes: CountMap = new Map();
const answerTypes: CountMap = new Map();
const responseTypes: CountMap = new Map();
const marks: CountMap = new Map();
const optionsPerQuestion: CountMap = new Map();
const correctOptionsPerQuestion: CountMap = new Map();
const questionImageSlots: CountMap = new Map();
const paperUuidFileCounts: CountMap = new Map();
const courseAliasMap = new Map<string, Set<string>>();
const examCourseMatrix = new Map<string, CountMap>();
const yearExamMatrix = new Map<string, CountMap>();

let metadataFileCount = 0;
let courseFolderCount = 0;
let indexFileCount = 0;
let paperFileCount = 0;
let rawQuestionCount = 0;
let importableQuestionCount = 0;
let excludedQuestionCount = 0;
let optionCount = 0;
let questionImageRefCount = 0;
let optionImageRefCount = 0;
let textOnlyQuestions = 0;
let imageOnlyQuestions = 0;
let textAndImageQuestions = 0;
let textlessImagelessQuestions = 0;
let zeroMarkQuestions = 0;
let markdownQuestions = 0;
let haveAnswersQuestions = 0;
let parentQuestionRefs = 0;
let questionsWithNoOptions = 0;
let questionsWithNoCorrectOption = 0;
let questionsWithMultipleCorrectOptions = 0;
let mcqWithMultipleCorrectOptions = 0;
let msqWithSingleCorrectOption = 0;
let saWithOptions = 0;
let negativeScoreOptions = 0;
let positiveScoreOptions = 0;
let nullOptionNumber = 0;
let whitespaceOnlyTextFields = 0;

for (const examDirName of readdirSync(DATA_DIR)) {
  const examDir = path.join(DATA_DIR, examDirName);
  const metadataPath = path.join(examDir, 'metadata.json');
  if (!existsSync(metadataPath)) continue;

  metadataFileCount += 1;
  const metadata = readJson<RawExamMetadata>(metadataPath);
  examMeta.set(examDirName, metadata);
  examNames.add(metadata.exam.exam_name);
  examUuids.add(metadata.exam.uuid);

  const metadataCourseUuidByName = new Map<string, string>();
  for (const course of metadata.courses) {
    metadataCourseUuidByName.set(course.course_name.trim().toLowerCase(), course.uuid);
    metadataCourseUuidByName.set(course.course_code.trim().toLowerCase(), course.uuid);
    courseUuids.add(course.uuid);
    courseNames.add(course.course_name);
    canonicalCourses.add(getCanonicalCourseName(course.course_name));
  }

  const courseDirs = readdirSync(examDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  courseFolderCount += courseDirs.length;

  for (const courseDir of courseDirs) {
    const indexPath = path.join(examDir, courseDir.name, 'index.json');
    if (!existsSync(indexPath)) {
      issues.push({ kind: 'missing_index', path: path.relative(process.cwd(), indexPath), detail: 'Course folder has no index.json' });
      continue;
    }
    indexFileCount += 1;
    const index = readJson<Array<{ uuid: string }>>(indexPath);

    for (const paperSummary of index) {
      const paperPath = path.join(examDir, courseDir.name, `${paperSummary.uuid}.json`);
      if (!existsSync(paperPath)) {
        issues.push({ kind: 'missing_paper_file', path: path.relative(process.cwd(), paperPath), detail: 'Referenced by index.json' });
        continue;
      }

      paperFileCount += 1;
      const paper = readJson<RawPaperFile>(paperPath);
      const fallbackCourseUuid = metadataCourseUuidByName.get(courseDir.name.trim().toLowerCase()) ?? null;
      const questionCourseUuid = paper.questions.find((question) => question.course?.uuid)?.course?.uuid ?? null;
      const courseUuid = paper.course?.uuid ?? questionCourseUuid ?? fallbackCourseUuid;
      const courseName = paper.course?.course_name ?? paper.questions.find((question) => question.course?.course_name)?.course?.course_name ?? courseDir.name;
      const canonicalCourse = getCanonicalCourseName(courseName);
      const courseLevel = getCourseLevel(courseName);
      const importable = paper.questions.filter(shouldIncludeQuestion);
      const yearKey = String(paper.year ?? 'Unknown');

      if (!courseUuid) {
        issues.push({ kind: 'unresolved_course', path: path.relative(process.cwd(), paperPath), detail: `Could not resolve course for ${courseDir.name}` });
      } else {
        courseUuids.add(courseUuid);
      }

      count(byExamPapers, metadata.exam.exam_name);
      count(byYearPapers, yearKey);
      count(byYearQuestions, yearKey, importable.length);
      count(byExamQuestions, metadata.exam.exam_name, importable.length);
      count(byCourseQuestions, courseName, importable.length);
      count(byCanonicalQuestions, canonicalCourse, importable.length);
      count(byLevelQuestions, courseLevel, importable.length);
      count(paperUuidFileCounts, paper.uuid);
      paperUuids.add(paper.uuid);
      courseNames.add(courseName);
      canonicalCourses.add(canonicalCourse);

      const aliases = courseAliasMap.get(canonicalCourse) ?? new Set<string>();
      aliases.add(courseDir.name);
      aliases.add(courseName);
      courseAliasMap.set(canonicalCourse, aliases);

      const examMatrixRow = examCourseMatrix.get(metadata.exam.exam_name) ?? new Map<string, number>();
      count(examMatrixRow, canonicalCourse, importable.length);
      examCourseMatrix.set(metadata.exam.exam_name, examMatrixRow);

      const yearMatrixRow = yearExamMatrix.get(yearKey) ?? new Map<string, number>();
      count(yearMatrixRow, metadata.exam.exam_name, importable.length);
      yearExamMatrix.set(yearKey, yearMatrixRow);

      rawQuestionCount += paper.questions.length;
      importableQuestionCount += importable.length;
      excludedQuestionCount += paper.questions.length - importable.length;
      optionCount += importable.reduce((sum, question) => sum + (question.options?.length ?? 0), 0);

      records.push({
        examName: metadata.exam.exam_name,
        examUuid: metadata.exam.uuid,
        courseDir: courseDir.name,
        courseUuid,
        courseName,
        canonicalCourse,
        courseLevel,
        paperUuid: paper.uuid,
        paperPath: path.relative(process.cwd(), paperPath),
        year: paper.year ?? null,
        duration: paper.duration ?? null,
        totalScore: asNumber(paper.total_score),
        rawQuestions: paper.questions.length,
        importableQuestions: importable.length,
        options: importable.reduce((sum, question) => sum + (question.options?.length ?? 0), 0),
      });

      const questionNumbers = new Set<number>();
      for (const question of importable) {
        questionUuids.add(question.uuid);
        const qUse = questionUuidUses.get(question.uuid) ?? new Set<string>();
        qUse.add(`${metadata.exam.exam_name}/${canonicalCourse}/${paper.uuid}`);
        questionUuidUses.set(question.uuid, qUse);

        const hashUses = questionHashes.get(question.hash) ?? new Set<string>();
        hashUses.add(`${metadata.exam.exam_name}/${canonicalCourse}/${paper.uuid}`);
        questionHashes.set(question.hash, hashUses);

        if (questionNumbers.has(question.question_number)) {
          issues.push({ kind: 'duplicate_question_number', path: path.relative(process.cwd(), paperPath), detail: `question_number ${question.question_number}` });
        }
        questionNumbers.add(question.question_number);

        count(questionTypes, question.question_type || 'Unknown');
        count(answerTypes, question.answer_type || 'null');
        count(responseTypes, question.response_type || 'null');
        count(marks, question.total_mark || 'null');
        if (Number.parseFloat(question.total_mark) === 0) zeroMarkQuestions += 1;
        if (question.is_markdown) markdownQuestions += 1;
        if (question.have_answers) haveAnswersQuestions += 1;
        if (question.parent_question?.uuid) parentQuestionRefs += 1;

        const qImages = questionImageCount(question);
        questionImageRefCount += qImages;
        for (let i = 1; i <= 10; i += 1) {
          const image = (question as unknown as Record<string, unknown>)[`question_image_${i}`];
          if (isPresent(image)) {
            count(questionImageSlots, `question_image_${i}`);
            imageFiles.add(String(image).trim());
          }
        }
        const texts = [question.question_text_1, question.question_text_2, question.question_text_3, question.question_text_4, question.question_text_5];
        const hasText = texts.some(isPresent);
        const hasImage = qImages > 0;
        if (hasText && hasImage) textAndImageQuestions += 1;
        else if (hasText) textOnlyQuestions += 1;
        else if (hasImage) imageOnlyQuestions += 1;
        else textlessImagelessQuestions += 1;
        whitespaceOnlyTextFields += texts.filter((value) => typeof value === 'string' && value.length > 0 && value.trim().length === 0).length;

        const options = question.options ?? [];
        count(optionsPerQuestion, String(options.length));
        if (options.length === 0) questionsWithNoOptions += 1;
        const correctCount = options.filter((option) => option.is_correct).length;
        count(correctOptionsPerQuestion, String(correctCount));
        if (correctCount === 0) questionsWithNoCorrectOption += 1;
        if (correctCount > 1) questionsWithMultipleCorrectOptions += 1;
        if (question.question_type === 'MCQ' && correctCount > 1) mcqWithMultipleCorrectOptions += 1;
        if (question.question_type === 'MSQ' && correctCount === 1) msqWithSingleCorrectOption += 1;
        if (question.question_type === 'SA' && options.length > 0) saWithOptions += 1;

        const optionTexts = new Set<string>();
        const optionImages = new Set<string>();
        for (const option of options) {
          if (asNumber(option.score) !== null && asNumber(option.score)! < 0) negativeScoreOptions += 1;
          if (asNumber(option.score) !== null && asNumber(option.score)! > 0) positiveScoreOptions += 1;
          if (option.option_number == null) nullOptionNumber += 1;
          if (isPresent(option.option_image)) {
            optionImageRefCount += 1;
            imageFiles.add(option.option_image!.trim());
            if (optionImages.has(option.option_image!.trim())) {
              issues.push({ kind: 'duplicate_option_image', path: path.relative(process.cwd(), paperPath), detail: `Question ${question.uuid}` });
            }
            optionImages.add(option.option_image!.trim());
          }
          const optionText = option.option_text?.trim() ?? '';
          if (optionText && optionTexts.has(optionText)) {
            issues.push({ kind: 'duplicate_option_text', path: path.relative(process.cwd(), paperPath), detail: `Question ${question.uuid}: ${optionText.slice(0, 80)}` });
          }
          if (optionText) optionTexts.add(optionText);
        }
      }
    }
  }
}

const duplicateQuestionHashes = [...questionHashes.entries()].filter(([, uses]) => uses.size > 1);
const reusedQuestionUuids = [...questionUuidUses.entries()].filter(([, uses]) => uses.size > 1);
const duplicatedPaperUuids = sortedEntries(paperUuidFileCounts).filter(([, files]) => files > 1);
const paperQuestionStats = quantiles(records.map((record) => record.importableQuestions));
const optionQuestionStats = quantiles([...optionsPerQuestion.entries()].flatMap(([value, times]) => Array.from({ length: times }, () => Number(value))));

const summary = {
  generatedAt: new Date().toISOString(),
  inventory: {
    examFolders: metadataFileCount,
    metadataFiles: metadataFileCount,
    courseFolders: courseFolderCount,
    indexFiles: indexFileCount,
    paperJsonFiles: paperFileCount,
    uniqueExamUuids: examUuids.size,
    uniqueCourseUuids: courseUuids.size,
    uniqueRawCourseNames: courseNames.size,
    uniqueCanonicalCourses: canonicalCourses.size,
    uniquePaperUuids: paperUuids.size,
    uniqueQuestionUuids: questionUuids.size,
    uniqueImageFilenames: imageFiles.size,
  },
  appImportable: {
    rawQuestionCount,
    importableQuestionCount,
    excludedQuestionCount,
    optionCount,
    questionImageRefCount,
    optionImageRefCount,
  },
  quality: {
    issues: issues.length,
    missingPaperFiles: issues.filter((issue) => issue.kind === 'missing_paper_file').length,
    unresolvedCourses: issues.filter((issue) => issue.kind === 'unresolved_course').length,
    duplicateQuestionNumbers: issues.filter((issue) => issue.kind === 'duplicate_question_number').length,
    duplicatedPaperUuids: duplicatedPaperUuids.length,
    duplicateQuestionHashes: duplicateQuestionHashes.length,
    reusedQuestionUuids: reusedQuestionUuids.length,
    zeroMarkQuestions,
    questionsWithNoOptions,
    questionsWithNoCorrectOption,
    questionsWithMultipleCorrectOptions,
    mcqWithMultipleCorrectOptions,
    msqWithSingleCorrectOption,
    saWithOptions,
  },
  distributions: {
    byExamPapers: Object.fromEntries(sortedEntries(byExamPapers)),
    byExamQuestions: Object.fromEntries(sortedEntries(byExamQuestions)),
    byCanonicalQuestions: Object.fromEntries(sortedEntries(byCanonicalQuestions)),
    questionTypes: Object.fromEntries(sortedEntries(questionTypes)),
    marks: Object.fromEntries(sortedEntries(marks)),
    optionsPerQuestion: Object.fromEntries(sortedEntries(optionsPerQuestion)),
    correctOptionsPerQuestion: Object.fromEntries(sortedEntries(correctOptionsPerQuestion)),
  },
};

const aliasRows = [...courseAliasMap.entries()]
  .map(([canonical, aliases]) => [canonical, [...aliases].sort().join(', ')])
  .filter(([, aliases]) => String(aliases).includes(','))
  .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

const report = `# Praxis Raw Data Analysis

Generated: ${summary.generatedAt}

## Executive Summary

- Raw data contains ${paperFileCount.toLocaleString()} paper JSON files, but only ${paperUuids.size.toLocaleString()} unique paper UUIDs. This confirms the same paper event is intentionally repeated across course folders.
- App-importable dataset contains ${importableQuestionCount.toLocaleString()} questions and ${optionCount.toLocaleString()} options after applying \`shouldIncludeQuestion()\`.
- ${excludedQuestionCount.toLocaleString()} raw questions (${pct(excludedQuestionCount, rawQuestionCount)}) are excluded by the app filter, mostly zero-mark instructional prompts.
- Coverage is broad: ${canonicalCourses.size} canonical courses across ${metadataFileCount} exam types. OPPE is sparse with ${(byExamPapers.get('OPPE') ?? 0).toLocaleString()} paper variant(s) and ${(byExamQuestions.get('OPPE') ?? 0).toLocaleString()} importable questions.
- The biggest data quality risks are duplicate question numbers within some paper variants, alias-heavy course folders, and answer-shape anomalies that need product decisions rather than blind cleanup.

## Inventory

${formatTable(
  ['Metric', 'Count'],
  [
    ['Exam folders / metadata files', metadataFileCount],
    ['Course folders', courseFolderCount],
    ['Index files', indexFileCount],
    ['Paper JSON files', paperFileCount],
    ['Unique exam UUIDs', examUuids.size],
    ['Unique course UUIDs', courseUuids.size],
    ['Raw course names', courseNames.size],
    ['Canonical courses', canonicalCourses.size],
    ['Unique paper UUIDs', paperUuids.size],
    ['Unique importable question UUIDs', questionUuids.size],
    ['Unique image filenames referenced', imageFiles.size],
  ],
)}

## Raw vs App-Importable

${formatTable(
  ['Metric', 'Count', 'Share'],
  [
    ['Raw questions', rawQuestionCount.toLocaleString(), '100.0%'],
    ['Importable questions', importableQuestionCount.toLocaleString(), pct(importableQuestionCount, rawQuestionCount)],
    ['Excluded questions', excludedQuestionCount.toLocaleString(), pct(excludedQuestionCount, rawQuestionCount)],
    ['Importable options', optionCount.toLocaleString(), ''],
    ['Question image refs', questionImageRefCount.toLocaleString(), ''],
    ['Option image refs', optionImageRefCount.toLocaleString(), ''],
  ],
)}

## By Exam

${formatTable(
  ['Exam', 'Paper files', 'Questions', 'Options'],
  sortedEntries(byExamPapers).map(([exam, papers]) => [
    exam,
    papers.toLocaleString(),
    (byExamQuestions.get(exam) ?? 0).toLocaleString(),
    records.filter((record) => record.examName === exam).reduce((sum, record) => sum + record.options, 0).toLocaleString(),
  ]),
)}

## By Year

${formatTable(
  ['Year', 'Paper files', 'Questions'],
  sortedEntries(byYearPapers).sort((a, b) => a[0].localeCompare(b[0])).map(([year, papers]) => [
    year,
    papers.toLocaleString(),
    (byYearQuestions.get(year) ?? 0).toLocaleString(),
  ]),
)}

## Top Courses By Questions

${formatTable(
  ['Canonical course', 'Questions', 'Level'],
  sortedEntries(byCanonicalQuestions).slice(0, TOP_N).map(([course, questions]) => [
    course,
    questions.toLocaleString(),
    getCourseLevel(course),
  ]),
)}

## Course Level Coverage

${formatTable(
  ['Level', 'Questions', 'Share'],
  sortedEntries(byLevelQuestions).map(([level, questions]) => [level, questions.toLocaleString(), pct(questions, importableQuestionCount)]),
)}

## Question Types

${formatTable(
  ['Type', 'Questions', 'Share'],
  sortedEntries(questionTypes).map(([type, questions]) => [type, questions.toLocaleString(), pct(questions, importableQuestionCount)]),
)}

## Marks Distribution

${formatTable(
  ['Mark', 'Questions', 'Share'],
  sortedEntries(marks).slice(0, 20).map(([mark, questions]) => [mark, questions.toLocaleString(), pct(questions, importableQuestionCount)]),
)}

## Answer Shape

${formatTable(
  ['Metric', 'Count', 'Share'],
  [
    ['Questions with zero options', questionsWithNoOptions.toLocaleString(), pct(questionsWithNoOptions, importableQuestionCount)],
    ['Questions with no correct option', questionsWithNoCorrectOption.toLocaleString(), pct(questionsWithNoCorrectOption, importableQuestionCount)],
    ['Questions with multiple correct options', questionsWithMultipleCorrectOptions.toLocaleString(), pct(questionsWithMultipleCorrectOptions, importableQuestionCount)],
    ['MCQ with multiple correct options', mcqWithMultipleCorrectOptions.toLocaleString(), pct(mcqWithMultipleCorrectOptions, questionTypes.get('MCQ') ?? 0)],
    ['MSQ with single correct option', msqWithSingleCorrectOption.toLocaleString(), pct(msqWithSingleCorrectOption, questionTypes.get('MSQ') ?? 0)],
    ['SA with options', saWithOptions.toLocaleString(), pct(saWithOptions, questionTypes.get('SA') ?? 0)],
    ['Positive-score options', positiveScoreOptions.toLocaleString(), pct(positiveScoreOptions, optionCount)],
    ['Negative-score options', negativeScoreOptions.toLocaleString(), pct(negativeScoreOptions, optionCount)],
    ['Null option_number', nullOptionNumber.toLocaleString(), pct(nullOptionNumber, optionCount)],
  ],
)}

## Options Per Question

${formatTable(
  ['Options', 'Questions', 'Share'],
  sortedEntries(optionsPerQuestion).sort((a, b) => Number(a[0]) - Number(b[0])).map(([optionTotal, questions]) => [
    optionTotal,
    questions.toLocaleString(),
    pct(questions, importableQuestionCount),
  ]),
)}

Option quantiles: min ${optionQuestionStats.min}, p25 ${optionQuestionStats.p25}, median ${optionQuestionStats.median}, p75 ${optionQuestionStats.p75}, p90 ${optionQuestionStats.p90}, max ${optionQuestionStats.max}, avg ${optionQuestionStats.avg.toFixed(2)}.

## Media Shape

${formatTable(
  ['Metric', 'Count', 'Share'],
  [
    ['Text-only questions', textOnlyQuestions.toLocaleString(), pct(textOnlyQuestions, importableQuestionCount)],
    ['Image-only questions', imageOnlyQuestions.toLocaleString(), pct(imageOnlyQuestions, importableQuestionCount)],
    ['Text + image questions', textAndImageQuestions.toLocaleString(), pct(textAndImageQuestions, importableQuestionCount)],
    ['No text and no image', textlessImagelessQuestions.toLocaleString(), pct(textlessImagelessQuestions, importableQuestionCount)],
    ['Whitespace-only text fields', whitespaceOnlyTextFields.toLocaleString(), ''],
    ['Question image refs', questionImageRefCount.toLocaleString(), ''],
    ['Option image refs', optionImageRefCount.toLocaleString(), ''],
  ],
)}

${formatTable(
  ['Question image slot', 'Refs'],
  sortedEntries(questionImageSlots).map(([slot, refs]) => [slot, refs.toLocaleString()]),
)}

## Paper Size Distribution

Importable questions per paper variant: min ${paperQuestionStats.min}, p25 ${paperQuestionStats.p25}, median ${paperQuestionStats.median}, p75 ${paperQuestionStats.p75}, p90 ${paperQuestionStats.p90}, max ${paperQuestionStats.max}, avg ${paperQuestionStats.avg.toFixed(2)}.

## Duplicate / Reuse Signals

${formatTable(
  ['Metric', 'Count'],
  [
    ['Paper UUIDs used by multiple files', duplicatedPaperUuids.length],
    ['Question UUIDs reused across contexts', reusedQuestionUuids.length],
    ['Question hashes reused across contexts', duplicateQuestionHashes.length],
    ['Recorded issues', issues.length],
    ['Missing paper files', issues.filter((issue) => issue.kind === 'missing_paper_file').length],
    ['Unresolved courses', issues.filter((issue) => issue.kind === 'unresolved_course').length],
    ['Duplicate question numbers', issues.filter((issue) => issue.kind === 'duplicate_question_number').length],
    ['Duplicate option text instances', issues.filter((issue) => issue.kind === 'duplicate_option_text').length],
  ],
)}

Top repeated paper UUIDs:

${formatTable(['Paper UUID', 'File count'], duplicatedPaperUuids.slice(0, 20).map(([uuid, files]) => [uuid, files]))}

## Course Alias Clusters

${formatTable(['Canonical course', 'Observed aliases / folders'], aliasRows.slice(0, 40))}

## Critical Data Issues

1. Course aliases are substantial. The app needs canonical course names for display and aggregation, but source paths should remain available for traceability.
2. OPPE is genuinely sparse in the current raw tree compared with other exams.
3. Duplicate question numbers exist inside some paper variants and should be handled by sorting on \`question_num_long\` as a secondary key.
4. SA questions often have no options, so answer validation needs a separate path from MCQ/MSQ.
5. Some MCQ/MSQ correctness patterns do not match simple assumptions; the UI should trust \`question_type\` plus option scores/correctness carefully.
6. Paper UUID alone is not a safe primary key for app display. Use exam + course + paper UUID, matching the current Postgres import.

## Recommended Fixes

P0:
- Keep \`paper_variants.id = examUuid:courseUuid:paperUuid\`; do not collapse by paper UUID.
- Add an import validation step that emits this report and fails only on true blockers: missing files, unresolved courses, invalid required fields.
- Use canonical course names in navigation/search, but preserve raw course labels and source paths.

P1:
- Add regression tests for \`shouldIncludeQuestion()\`, especially hall-ticket prompts, zero-mark non-instructional questions, and COMPREHENSION rows.
- Add a data quality page or generated JSON consumed by the app for coverage stats.
- Add explicit handling for SA/OPPE answer rendering instead of treating every answer as option-based.

P2:
- Add duplicate-hash exploration for related-question/practice recommendations.
- Normalize aliases in metadata/import and expose alternate names in search.
- Add media existence checks against the R2 object list if a bucket manifest is available.

## Engineer Handoff

The raw data is usable and much richer than the unique paper UUID count suggests. The central rule is that paper UUIDs repeat by design across course folders; the app should work with paper variants, not global papers. The current import model is directionally correct, but it needs a reproducible validation/reporting step and better product handling for aliases, sparse OPPE coverage, SA questions, and duplicate/reused question signals.
`;

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(path.join(OUTPUT_DIR, 'raw-data-analysis.json'), `${JSON.stringify({ summary, records, issues }, null, 2)}\n`);
writeFileSync(path.join(OUTPUT_DIR, 'raw-data-analysis.md'), report);

console.log(report);
