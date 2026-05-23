#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { shouldIncludeQuestion, type RawPaperFile, type RawQuestion } from '../src/lib/dataTransforms';

type SourceCourse = {
  id: number;
  uuid: string;
  course_name: string;
  course_code: string;
};

type SourceExamPage = {
  props?: {
    exam?: { en_id?: string; exam_name?: string };
    courses?: SourceCourse[];
  };
};

type SourceGroup = {
  id: number;
  question_papers?: Array<{
    uuid: string;
    question_paper_name?: string;
    question_paper_description?: string;
  }>;
};

type LocalCourse = {
  uuid: string;
  courseName: string;
  courseCode: string;
  paperCount: number;
};

type LocalBundle = {
  groupId: number;
  papers: Array<{
    uuid: string;
    courseUuid: string;
    paperName: string;
    paperDescription: string;
    questionCount: number;
    calculatedTotalMarks: number;
  }>;
};

type LocalQuestion = {
  uuid: string;
  questionNumber: number;
  questionType: string;
  totalMark: string;
  hash: string;
  questionText1?: string;
  questionText2?: string;
  questionText3?: string;
  questionText4?: string;
  questionText5?: string;
  questionImage1?: string;
  questionImage2?: string;
  questionImage3?: string;
  questionImage4?: string;
  questionImage5?: string;
  questionImage6?: string;
  questionImage7?: string;
  questionImage8?: string;
  questionImage9?: string;
  questionImage10?: string;
  answerType?: string;
  responseType?: string;
  valueStart?: string;
  valueEnd?: string;
  parentQuestionUuid?: string;
  isMarkdown: number;
  haveAnswers: number;
  questionNumLong: number;
  options: Array<{
    optionText: string;
    optionImage?: string;
    score: string;
    isCorrect: number;
    optionNumber?: number;
  }>;
};

type PaperIssue = {
  paperUuid: string;
  groupId: number;
  paperName: string;
  issues: string[];
};

type CourseAudit = {
  examName: string;
  examUuid: string;
  courseName: string;
  courseUuid: string;
  sourceCourseId: number;
  sourcePaperCount: number;
  localPaperCount: number;
  sourceGroupCount: number;
  localGroupCount: number;
  missingPapers: string[];
  extraPapers: string[];
  paperIssues: PaperIssue[];
  renderRiskCounts: Record<string, number>;
  ok: boolean;
};

const QUIZPRACTICE_BASE = 'https://quizpractice.space';
const LOCAL_API_BASE = process.env.LOCAL_API_BASE ?? 'http://127.0.0.1:8787';
const OUT_DIR = path.join(process.cwd(), 'reports');
const AUDIT_SCOPE = process.env.AUDIT_SCOPE ?? 'python';
const REQUEST_DELAY_MS = Number.parseInt(process.env.COURSE_AUDIT_REQUEST_DELAY_MS ?? process.env.PYTHON_AUDIT_REQUEST_DELAY_MS ?? '250', 10);
const MAX_RETRIES = Number.parseInt(process.env.COURSE_AUDIT_MAX_RETRIES ?? process.env.PYTHON_AUDIT_MAX_RETRIES ?? '6', 10);

const EXAMS = [
  { name: 'Quiz 1', uuid: '9251bc3a-e33e-45e0-bcf0-b16a0ea5b5fa' },
  { name: 'Quiz 2', uuid: '1948ee72-5c62-4816-97c8-7d662330a220' },
  { name: 'End Term Quiz', uuid: '7a6ff569-f50c-40e7-a08b-f5c334392600' },
  { name: 'OPPE', uuid: '4e5fffd3-41e9-4ec7-853c-8af983edb699' },
] as const;

const FOUNDATION_REMAINING_COURSES = new Set([
  'aptitude',
  'basic mathematics',
  'ct',
  'english',
  'english 1',
  'english1',
  'english2',
  'mathematics',
  'maths1',
  'maths2',
  'statistics',
  'statistics1',
  'statistics2',
]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function htmlDecode(input: string) {
  return input
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function normalizeNullable(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).replaceAll('\u0000', '').trim();
}

function normalizeText(value: unknown) {
  return normalizeNullable(value).replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

function normalizeOptionImage(value: unknown) {
  return normalizeNullable(value);
}

function addCount(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

async function fetchWithRetry(url: string, init?: RequestInit) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;
      const message = `${response.status} ${response.statusText} for ${url}`;
      if (attempt === MAX_RETRIES || (response.status !== 429 && response.status < 500)) {
        throw new Error(message);
      }
      lastError = new Error(message);
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) break;
    }
    await sleep(600 * 2 ** attempt + Math.floor(Math.random() * 250));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetchWithRetry(url, init);
  return (await response.json()) as T;
}

async function fetchInertiaPage<T>(url: string) {
  const response = await fetchWithRetry(url);
  const html = await response.text();
  const marker = 'id="app" data-page="';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error(`data-page not found: ${url}`);
  const after = html.slice(start + marker.length);
  const end = after.indexOf('"></div>');
  if (end < 0) throw new Error(`data-page end not found: ${url}`);
  return JSON.parse(htmlDecode(after.slice(0, end))) as T;
}

function courseSearchText(course: LocalCourse | SourceCourse) {
  const name = 'courseName' in course ? course.courseName : course.course_name;
  const code = 'courseCode' in course ? course.courseCode : course.course_code;
  return { name, code, normalizedName: name.trim().toLowerCase(), normalizedCode: code.trim().toLowerCase() };
}

function isTargetCourse(course: LocalCourse | SourceCourse) {
  const { name, code, normalizedName, normalizedCode } = courseSearchText(course);
  if (AUDIT_SCOPE === 'foundation') {
    return FOUNDATION_REMAINING_COURSES.has(normalizedName) || FOUNDATION_REMAINING_COURSES.has(normalizedCode);
  }
  return `${name} ${code}`.toLowerCase().includes('python');
}

function selectedExams() {
  if (AUDIT_SCOPE === 'foundation') {
    return EXAMS.filter((exam) => exam.name !== 'OPPE');
  }
  return EXAMS.filter((exam) => exam.name !== 'Quiz 2');
}

async function getLocalTargetCourses(examUuid: string) {
  const courses = await fetchJson<LocalCourse[]>(`${LOCAL_API_BASE}/api/exams/${examUuid}/courses`);
  return courses.filter(isTargetCourse);
}

async function getSourceExam(examUuid: string) {
  return fetchInertiaPage<SourceExamPage>(`${QUIZPRACTICE_BASE}/exam/${examUuid}`);
}

async function getSourceGroups(courseId: number, enId: string) {
  return fetchJson<SourceGroup[]>(`${QUIZPRACTICE_BASE}/api/get-questions-paper-by-exam`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ course_id: courseId, year: 'all', exam_id: enId }),
  });
}

async function getSourcePaper(courseId: number, paperUuid: string) {
  const page = await fetchInertiaPage<{ props?: { question_paper?: RawPaperFile } }>(
    `${QUIZPRACTICE_BASE}/question-paper/practise/${courseId}/${paperUuid}`,
  );
  const paper = page.props?.question_paper;
  if (!paper) throw new Error(`Missing source question_paper for ${paperUuid}`);
  return paper;
}

async function getLocalQuestions(examUuid: string, courseUuid: string, paperUuid: string) {
  return fetchJson<LocalQuestion[]>(
    `${LOCAL_API_BASE}/api/papers/${paperUuid}/questions?courseUuid=${courseUuid}&examUuid=${examUuid}`,
  );
}

function sourceQuestionFields(question: RawQuestion) {
  return {
    uuid: normalizeNullable(question.uuid),
    questionNumber: question.question_number,
    questionType: normalizeNullable(question.question_type),
    totalMark: normalizeNullable(question.total_mark),
    hash: normalizeNullable(question.hash),
    questionText1: normalizeText(question.question_text_1),
    questionText2: normalizeText(question.question_text_2),
    questionText3: normalizeText(question.question_text_3),
    questionText4: normalizeText(question.question_text_4),
    questionText5: normalizeText(question.question_text_5),
    questionImage1: normalizeNullable(question.question_image_1),
    questionImage2: normalizeNullable(question.question_image_2),
    questionImage3: normalizeNullable(question.question_image_3),
    questionImage4: normalizeNullable(question.question_image_4),
    questionImage5: normalizeNullable(question.question_image_5),
    questionImage6: normalizeNullable(question.question_image_6),
    questionImage7: normalizeNullable(question.question_image_7),
    questionImage8: normalizeNullable(question.question_image_8),
    questionImage9: normalizeNullable(question.question_image_9),
    questionImage10: normalizeNullable(question.question_image_10),
    answerType: normalizeNullable(question.answer_type),
    responseType: normalizeNullable(question.response_type),
    valueStart: normalizeNullable(question.value_start),
    valueEnd: normalizeNullable(question.value_end),
    parentQuestionUuid: normalizeNullable(question.parent_question?.uuid),
    isMarkdown: Number(question.is_markdown ?? 0),
    haveAnswers: Number(question.have_answers ?? 0),
    questionNumLong: Number(question.question_num_long ?? 0),
  };
}

function localQuestionFields(question: LocalQuestion) {
  return {
    uuid: normalizeNullable(question.uuid),
    questionNumber: question.questionNumber,
    questionType: normalizeNullable(question.questionType),
    totalMark: normalizeNullable(question.totalMark),
    hash: normalizeNullable(question.hash),
    questionText1: normalizeText(question.questionText1),
    questionText2: normalizeText(question.questionText2),
    questionText3: normalizeText(question.questionText3),
    questionText4: normalizeText(question.questionText4),
    questionText5: normalizeText(question.questionText5),
    questionImage1: normalizeNullable(question.questionImage1),
    questionImage2: normalizeNullable(question.questionImage2),
    questionImage3: normalizeNullable(question.questionImage3),
    questionImage4: normalizeNullable(question.questionImage4),
    questionImage5: normalizeNullable(question.questionImage5),
    questionImage6: normalizeNullable(question.questionImage6),
    questionImage7: normalizeNullable(question.questionImage7),
    questionImage8: normalizeNullable(question.questionImage8),
    questionImage9: normalizeNullable(question.questionImage9),
    questionImage10: normalizeNullable(question.questionImage10),
    answerType: normalizeNullable(question.answerType),
    responseType: normalizeNullable(question.responseType),
    valueStart: normalizeNullable(question.valueStart),
    valueEnd: normalizeNullable(question.valueEnd),
    parentQuestionUuid: normalizeNullable(question.parentQuestionUuid),
    isMarkdown: Number(question.isMarkdown ?? 0),
    haveAnswers: Number(question.haveAnswers ?? 0),
    questionNumLong: Number(question.questionNumLong ?? 0),
  };
}

function compareQuestion(source: RawQuestion, local: LocalQuestion) {
  const issues: string[] = [];
  const sourceFields = sourceQuestionFields(source);
  const localFields = localQuestionFields(local);
  for (const key of Object.keys(sourceFields) as Array<keyof typeof sourceFields>) {
    if (sourceFields[key] !== localFields[key]) {
      issues.push(`question ${source.uuid} field mismatch: ${key}`);
    }
  }

  const sourceOptions = source.options ?? [];
  const localOptions = local.options ?? [];
  if (sourceOptions.length !== localOptions.length) {
    issues.push(`question ${source.uuid} option count mismatch: source=${sourceOptions.length} local=${localOptions.length}`);
  }

  const maxOptions = Math.max(sourceOptions.length, localOptions.length);
  for (let index = 0; index < maxOptions; index += 1) {
    const sourceOption = sourceOptions[index];
    const localOption = localOptions[index];
    if (!sourceOption || !localOption) continue;
    if (normalizeText(sourceOption.option_text) !== normalizeText(localOption.optionText)) {
      issues.push(`question ${source.uuid} option ${index + 1} text mismatch`);
    }
    if (normalizeOptionImage(sourceOption.option_image) !== normalizeOptionImage(localOption.optionImage)) {
      issues.push(`question ${source.uuid} option ${index + 1} image mismatch`);
    }
    if (normalizeNullable(sourceOption.score) !== normalizeNullable(localOption.score)) {
      issues.push(`question ${source.uuid} option ${index + 1} score mismatch`);
    }
    if (Number(sourceOption.is_correct ?? 0) !== Number(localOption.isCorrect ?? 0)) {
      issues.push(`question ${source.uuid} option ${index + 1} correctness mismatch`);
    }
    if (Number(sourceOption.option_number ?? 0) !== Number(localOption.optionNumber ?? 0)) {
      issues.push(`question ${source.uuid} option ${index + 1} order-number mismatch`);
    }
  }

  return issues;
}

function collectRenderRisks(paper: RawPaperFile, counts: Record<string, number>) {
  for (const question of paper.questions.filter(shouldIncludeQuestion)) {
    const text = [
      question.question_text_1,
      question.question_text_2,
      question.question_text_3,
      question.question_text_4,
      question.question_text_5,
    ]
      .map(normalizeNullable)
      .join('\n');
    const options = question.options ?? [];
    if (text.includes('```')) addCount(counts, 'markdown_code_fences');
    if (/<\/?(b|strong|i|em|u)>/i.test(text)) addCount(counts, 'html_inline_markup');
    if (question.question_type === 'MCQ' && options.length === 0) addCount(counts, 'mcq_without_options');
    if (question.question_type === 'MSQ' && options.length === 0) addCount(counts, 'msq_without_options');
    if ((question.question_type === 'SA' || question.response_type || question.answer_type) && options.length === 0) {
      addCount(counts, 'answer_input_questions');
    }
    for (const option of options) {
      if (!normalizeNullable(option.option_text) && !normalizeNullable(option.option_image)) {
        addCount(counts, 'empty_option_payloads');
      }
    }
  }
}

async function auditCourse(examName: string, examUuid: string, localCourse: LocalCourse, sourceCourse: SourceCourse, enId: string) {
  const sourceGroups = await getSourceGroups(sourceCourse.id, enId);
  const localBundles = await fetchJson<LocalBundle[]>(
    `${LOCAL_API_BASE}/api/exams/${examUuid}/courses/${localCourse.uuid}/bundles`,
  );
  const sourcePaperRows = sourceGroups.flatMap((group) =>
    (group.question_papers ?? []).map((paper) => ({
      groupId: group.id,
      uuid: paper.uuid,
      paperName: paper.question_paper_name ?? '',
      paperDescription: paper.question_paper_description ?? '',
    })),
  );
  const localPaperRows = localBundles.flatMap((bundle) =>
    bundle.papers.map((paper) => ({
      groupId: bundle.groupId,
      uuid: paper.uuid,
      paperName: paper.paperName,
      paperDescription: paper.paperDescription,
      questionCount: paper.questionCount,
      calculatedTotalMarks: paper.calculatedTotalMarks,
    })),
  );
  const sourceUuids = new Set(sourcePaperRows.map((paper) => paper.uuid));
  const localUuids = new Set(localPaperRows.map((paper) => paper.uuid));
  const missingPapers = [...sourceUuids].filter((uuid) => !localUuids.has(uuid)).sort();
  const extraPapers = [...localUuids].filter((uuid) => !sourceUuids.has(uuid)).sort();
  const localByUuid = new Map(localPaperRows.map((paper) => [paper.uuid, paper]));
  const paperIssues: PaperIssue[] = [];
  const renderRiskCounts: Record<string, number> = {};

  for (const sourcePaperRow of sourcePaperRows) {
    if (!localUuids.has(sourcePaperRow.uuid)) continue;
    const sourcePaper = await getSourcePaper(sourceCourse.id, sourcePaperRow.uuid);
    const localQuestions = await getLocalQuestions(examUuid, localCourse.uuid, sourcePaperRow.uuid);
    const includedSourceQuestions = sourcePaper.questions.filter(shouldIncludeQuestion);
    collectRenderRisks(sourcePaper, renderRiskCounts);

    const localPaper = localByUuid.get(sourcePaperRow.uuid);
    const issues: string[] = [];
    if (localPaper?.groupId !== sourcePaperRow.groupId) {
      issues.push(`group mismatch: source=${sourcePaperRow.groupId} local=${localPaper?.groupId}`);
    }
    if (normalizeText(localPaper?.paperName) !== normalizeText(sourcePaper.question_paper_name)) {
      issues.push('paper name mismatch');
    }
    if (normalizeText(localPaper?.paperDescription) !== normalizeText(sourcePaper.question_paper_description)) {
      issues.push('paper description mismatch');
    }
    if (includedSourceQuestions.length !== localQuestions.length) {
      issues.push(`included question count mismatch: source=${includedSourceQuestions.length} local=${localQuestions.length}`);
    }

    const localByQuestionUuid = new Map(localQuestions.map((question) => [question.uuid, question]));
    for (const sourceQuestion of includedSourceQuestions) {
      const localQuestion = localByQuestionUuid.get(sourceQuestion.uuid);
      if (!localQuestion) {
        issues.push(`missing local question ${sourceQuestion.uuid}`);
        continue;
      }
      issues.push(...compareQuestion(sourceQuestion, localQuestion));
    }
    for (const localQuestion of localQuestions) {
      if (!includedSourceQuestions.some((sourceQuestion) => sourceQuestion.uuid === localQuestion.uuid)) {
        issues.push(`extra local question ${localQuestion.uuid}`);
      }
    }

    if (issues.length > 0) {
      paperIssues.push({
        paperUuid: sourcePaperRow.uuid,
        groupId: sourcePaperRow.groupId,
        paperName: sourcePaper.question_paper_name,
        issues,
      });
    }
    await sleep(REQUEST_DELAY_MS + Math.floor(Math.random() * 100));
  }

  return {
    examName,
    examUuid,
    courseName: localCourse.courseName,
    courseUuid: localCourse.uuid,
    sourceCourseId: sourceCourse.id,
    sourcePaperCount: sourcePaperRows.length,
    localPaperCount: localPaperRows.length,
    sourceGroupCount: new Set(sourcePaperRows.map((paper) => paper.groupId)).size,
    localGroupCount: new Set(localPaperRows.map((paper) => paper.groupId)).size,
    missingPapers,
    extraPapers,
    paperIssues,
    renderRiskCounts,
    ok: missingPapers.length === 0 && extraPapers.length === 0 && paperIssues.length === 0,
  } satisfies CourseAudit;
}

function markdownTable(headers: string[], rows: Array<Array<string | number>>) {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => String(row[index] ?? '').length)),
  );
  return [
    `| ${headers.map((header, index) => header.padEnd(widths[index]!)).join(' | ')} |`,
    `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((cell, index) => String(cell ?? '').padEnd(widths[index]!)).join(' | ')} |`),
  ].join('\n');
}

function writeReport(audits: CourseAudit[]) {
  const generatedAt = new Date().toISOString();
  const ok = audits.every((audit) => audit.ok);
  const title = AUDIT_SCOPE === 'foundation' ? 'Foundation Course Data Audit' : 'Python Course Data Audit';
  const verdictSubject = AUDIT_SCOPE === 'foundation' ? 'Remaining foundation courses' : 'Python';
  const scopeText = AUDIT_SCOPE === 'foundation'
    ? 'Compared remaining foundation-level course labels in Quiz 1, Quiz 2, and End Term Quiz against live QuizPractice source pages. Python is excluded because it already has its own clean audit.'
    : 'Compared Python-labelled courses in Quiz 1, End Term Quiz, and OPPE against live QuizPractice source pages.';
  const rows = audits.map((audit) => [
    audit.examName,
    audit.courseName,
    audit.sourcePaperCount,
    audit.localPaperCount,
    audit.sourceGroupCount,
    audit.localGroupCount,
    audit.missingPapers.length,
    audit.extraPapers.length,
    audit.paperIssues.length,
    audit.ok ? 'yes' : 'no',
  ]);
  const riskRows = audits.map((audit) => [
    audit.examName,
    audit.courseName,
    Object.entries(audit.renderRiskCounts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}: ${value}`)
      .join('<br>') || 'none',
  ]);

  const issueSections = audits
    .filter((audit) => !audit.ok)
    .map((audit) => {
      const lines = [
        `### ${audit.examName} / ${audit.courseName}`,
        '',
        `- Missing papers: ${audit.missingPapers.length ? audit.missingPapers.join(', ') : 'none'}`,
        `- Extra papers: ${audit.extraPapers.length ? audit.extraPapers.join(', ') : 'none'}`,
      ];
      for (const paper of audit.paperIssues.slice(0, 40)) {
        lines.push(`- ${paper.paperUuid} (${paper.paperName}, group ${paper.groupId}): ${paper.issues.slice(0, 12).join('; ')}`);
      }
      if (audit.paperIssues.length > 40) {
        lines.push(`- ... ${audit.paperIssues.length - 40} additional paper issue rows omitted from markdown; see JSON report.`);
      }
      return lines.join('\n');
    })
    .join('\n\n');

  const report = `# ${title}

Generated: ${generatedAt}

## Verdict

${ok
  ? `${verdictSubject} can be given a data clean chit for source/local parity. The remaining notes are render-risk categories already handled by the current Paper UI, not missing data.`
  : `${verdictSubject} should not be marked clean yet. Fix the mismatches below, re-import, then rerun this audit.`}

## Scope

${scopeText}

The audit checks:

- source paper bundles vs local bundle API
- source paper UUIDs vs local paper UUIDs
- paper name, description, and group id
- included question count after applying our import filter
- question UUID/order/type/marks/hash/text/image/answer metadata
- option text/image/score/correctness/order
- render-risk categories for Python formatting

## Summary

${markdownTable(
  ['Exam', 'Course', 'Source papers', 'Local papers', 'Source groups', 'Local groups', 'Missing', 'Extra', 'Papers with issues', 'Clean'],
  rows,
)}

## Render Risk Notes

${markdownTable(['Exam', 'Course', 'Observed categories'], riskRows)}

## Issues

${issueSections || 'No parity issues found.'}

## Repeatable Command

\`\`\`bash
${AUDIT_SCOPE === 'foundation' ? 'AUDIT_SCOPE=foundation bun run scripts/audit-python-course.ts' : 'bun run scripts/audit-python-course.ts'}
\`\`\`
`;

  const baseName = AUDIT_SCOPE === 'foundation' ? 'foundation-course' : 'python-course';
  writeFileSync(path.join(OUT_DIR, `${baseName}-audit.json`), `${JSON.stringify({ generatedAt, ok, audits }, null, 2)}\n`);
  writeFileSync(path.join(OUT_DIR, `${baseName}-report.md`), report);
  writeFileSync(path.join(OUT_DIR, 'report.md'), report);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const audits: CourseAudit[] = [];

  for (const exam of selectedExams()) {
    const [localCourses, sourceExam] = await Promise.all([
      getLocalTargetCourses(exam.uuid),
      getSourceExam(exam.uuid),
    ]);
    const enId = sourceExam.props?.exam?.en_id;
    const sourceCourses = sourceExam.props?.courses ?? [];
    if (!enId) throw new Error(`Missing source en_id for ${exam.name}`);

    for (const localCourse of localCourses) {
      const sourceCourse = sourceCourses.find((course) => course.uuid === localCourse.uuid);
      if (!sourceCourse) {
        audits.push({
          examName: exam.name,
          examUuid: exam.uuid,
          courseName: localCourse.courseName,
          courseUuid: localCourse.uuid,
          sourceCourseId: 0,
          sourcePaperCount: 0,
          localPaperCount: localCourse.paperCount,
          sourceGroupCount: 0,
          localGroupCount: 0,
          missingPapers: [],
          extraPapers: [],
          paperIssues: [{ paperUuid: '-', groupId: 0, paperName: '-', issues: ['local course not found on source exam page'] }],
          renderRiskCounts: {},
          ok: false,
        });
        continue;
      }
      console.log(`Auditing ${exam.name} / ${localCourse.courseName} (${localCourse.paperCount} local papers)`);
      audits.push(await auditCourse(exam.name, exam.uuid, localCourse, sourceCourse, enId));
    }
  }

  writeReport(audits);
  const failed = audits.filter((audit) => !audit.ok).length;
  const baseName = AUDIT_SCOPE === 'foundation' ? 'foundation-course' : 'python-course';
  console.log(`${AUDIT_SCOPE} audit complete: ${audits.length - failed}/${audits.length} course-exam pairs clean`);
  console.log(`Report: ${path.join(OUT_DIR, `${baseName}-report.md`)}`);
  console.log(`Handoff report: ${path.join(OUT_DIR, 'report.md')}`);
  if (failed > 0) process.exitCode = 1;
}

void main();
