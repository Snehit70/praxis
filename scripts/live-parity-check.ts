#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type SourceCourse = {
  id: number;
  uuid: string;
  course_name: string;
  course_code: string;
};

type SourceExamPage = {
  props?: {
    exam?: { en_id?: string };
    courses?: SourceCourse[];
  };
};

type SourceGroup = {
  id: number;
  question_papers?: Array<{
    uuid: string;
    question_paper_name?: string;
    question_paper_description?: string;
    paper_name?: string;
    paper_description?: string;
    name?: string;
    description?: string;
  }>;
};

type LocalBundle = {
  groupId: number;
  papers: Array<{
    uuid: string;
    paperName?: string;
    paperDescription?: string;
  }>;
};

type ParityRow = {
  examUuid: string;
  courseUuid: string;
  courseName: string;
  sourceBundleCount: number;
  localBundleCount: number;
  sourceOrder: number[];
  localOrder: number[];
  missingGroupsInLocal: number[];
  extraGroupsInLocal: number[];
  contentMismatches: number[];
  nameMismatches: string[];
  orderMatches: boolean;
  ok: boolean;
  sourceError?: string;
  localError?: string;
};

const QUIZPRACTICE_BASE = 'https://quizpractice.space';
const LOCAL_API_BASE = process.env.LOCAL_API_BASE ?? 'http://127.0.0.1:8787';
const OUT_DIR = path.join(process.cwd(), 'reports');
const CHECKPOINT_PATH = path.join(OUT_DIR, 'live-parity-check.checkpoint.json');
const REQUEST_DELAY_MS = Number.parseInt(process.env.PARITY_REQUEST_DELAY_MS ?? '350', 10);
const MAX_RETRIES = Number.parseInt(process.env.PARITY_MAX_RETRIES ?? '6', 10);
const START_FROM_EXAM_UUID = process.env.PARITY_START_EXAM_UUID ?? '';
const ONLY_EXAM_UUID = process.env.PARITY_ONLY_EXAM_UUID ?? '';

const EXAMS = [
  { name: 'Quiz 1', uuid: '9251bc3a-e33e-45e0-bcf0-b16a0ea5b5fa' },
  { name: 'Quiz 2', uuid: '1948ee72-5c62-4816-97c8-7d662330a220' },
  { name: 'End Term Quiz', uuid: '7a6ff569-f50c-40e7-a08b-f5c334392600' },
  { name: 'OPPE', uuid: '4e5fffd3-41e9-4ec7-853c-8af983edb699' },
] as const;

function htmlDecode(input: string) {
  return input
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(errorMessage: string) {
  return errorMessage.includes('429') || errorMessage.includes('5');
}

async function fetchJsonWithRetry<T>(url: string, init?: RequestInit) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await fetchJson<T>(url, init);
    } catch (error) {
      lastError = error;
      const message = String(error);
      if (attempt === MAX_RETRIES || !shouldRetry(message)) throw error;
      const exponential = 2 ** attempt * 750;
      const jitter = Math.floor(Math.random() * 300);
      await sleep(exponential + jitter);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
  return (await res.json()) as T;
}

async function fetchExamPage(examUuid: string) {
  const res = await fetch(`${QUIZPRACTICE_BASE}/exam/${examUuid}`);
  if (!res.ok) {
    throw new Error(`Exam page fetch failed (${res.status}) for ${examUuid}`);
  }
  const html = await res.text();
  const marker = 'id="app" data-page="';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error(`data-page not found for ${examUuid}`);
  const after = html.slice(start + marker.length);
  const end = after.indexOf('"></div>');
  if (end < 0) throw new Error(`data-page end not found for ${examUuid}`);
  const raw = after.slice(0, end);
  const decoded = htmlDecode(raw);
  return JSON.parse(decoded) as SourceExamPage;
}

function compareSets(source: Set<string>, local: Set<string>) {
  if (source.size !== local.size) return false;
  for (const value of source) if (!local.has(value)) return false;
  return true;
}

function toTable(headers: string[], rows: Array<Array<string | number | boolean>>) {
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

function normalizeText(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function sourcePaperName(paper: NonNullable<SourceGroup['question_papers']>[number]) {
  return (
    paper.question_paper_name ??
    paper.paper_name ??
    paper.name ??
    ''
  );
}

function sourcePaperDescription(paper: NonNullable<SourceGroup['question_papers']>[number]) {
  return (
    paper.question_paper_description ??
    paper.paper_description ??
    paper.description ??
    ''
  );
}

function rowKey(examUuid: string, courseUuid: string) {
  return `${examUuid}::${courseUuid}`;
}

function loadCheckpoint() {
  if (!existsSync(CHECKPOINT_PATH)) return new Map<string, ParityRow>();
  try {
    const parsed = JSON.parse(readFileSync(CHECKPOINT_PATH, 'utf8')) as { rows?: ParityRow[] };
    const rows = parsed.rows ?? [];
    return new Map(rows.map((row) => [rowKey(row.examUuid, row.courseUuid), row]));
  } catch {
    return new Map<string, ParityRow>();
  }
}

function saveCheckpoint(rows: ParityRow[]) {
  writeFileSync(CHECKPOINT_PATH, `${JSON.stringify({ updatedAt: new Date().toISOString(), rows }, null, 2)}\n`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const checkpointMap = loadCheckpoint();
  const rowsMap = new Map(checkpointMap);
  const selectedExams = EXAMS.filter((exam) => {
    if (ONLY_EXAM_UUID) return exam.uuid === ONLY_EXAM_UUID;
    if (!START_FROM_EXAM_UUID) return true;
    const index = EXAMS.findIndex((item) => item.uuid === START_FROM_EXAM_UUID);
    const current = EXAMS.findIndex((item) => item.uuid === exam.uuid);
    return index < 0 || current >= index;
  });

  for (const exam of selectedExams) {
    const page = await fetchExamPage(exam.uuid);
    const enId = page.props?.exam?.en_id;
    const courses = page.props?.courses ?? [];
    if (!enId) {
      for (const course of courses) {
        rowsMap.set(rowKey(exam.uuid, course.uuid), {
          examUuid: exam.uuid,
          courseUuid: course.uuid,
          courseName: course.course_name,
          sourceBundleCount: 0,
          localBundleCount: 0,
          sourceOrder: [],
          localOrder: [],
          missingGroupsInLocal: [],
          extraGroupsInLocal: [],
          contentMismatches: [],
          nameMismatches: [],
          orderMatches: false,
          ok: false,
          sourceError: 'missing en_id',
        });
      }
      saveCheckpoint(Array.from(rowsMap.values()));
      continue;
    }

    for (const course of courses) {
      const key = rowKey(exam.uuid, course.uuid);
      if (rowsMap.has(key)) continue;

      const base: ParityRow = {
        examUuid: exam.uuid,
        courseUuid: course.uuid,
        courseName: course.course_name || course.course_code || course.uuid,
        sourceBundleCount: 0,
        localBundleCount: 0,
        sourceOrder: [],
        localOrder: [],
        missingGroupsInLocal: [],
        extraGroupsInLocal: [],
        contentMismatches: [],
        nameMismatches: [],
        orderMatches: false,
        ok: false,
      };

      try {
        const source = await fetchJsonWithRetry<SourceGroup[]>(
          `${QUIZPRACTICE_BASE}/api/get-questions-paper-by-exam`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              course_id: course.id,
              year: 'all',
              exam_id: enId,
            }),
          },
        );

        let local: LocalBundle[] = [];
        try {
          local = await fetchJsonWithRetry<LocalBundle[]>(
            `${LOCAL_API_BASE}/api/exams/${encodeURIComponent(exam.uuid)}/courses/${encodeURIComponent(course.uuid)}/bundles`,
          );
        } catch (error) {
          rowsMap.set(key, {
            ...base,
            sourceBundleCount: source.length,
            sourceOrder: source.map((group) => group.id),
            localError: String(error),
          });
          saveCheckpoint(Array.from(rowsMap.values()));
          continue;
        }

        const sourceOrder = source.map((group) => group.id);
        const localOrder = local.map((bundle) => bundle.groupId);
        const sourceMap = new Map(source.map((group) => [group.id, new Set((group.question_papers ?? []).map((paper) => paper.uuid))]));
        const localMap = new Map(local.map((bundle) => [bundle.groupId, new Set(bundle.papers.map((paper) => paper.uuid))]));

        const missingGroupsInLocal = sourceOrder.filter((id) => !localMap.has(id));
        const extraGroupsInLocal = localOrder.filter((id) => !sourceMap.has(id));
        const contentMismatches: number[] = [];
        const nameMismatches: string[] = [];
        const sourcePaperMap = new Map(
          source.flatMap((group) =>
            (group.question_papers ?? []).map((paper) => [
              paper.uuid,
              {
                name: normalizeText(sourcePaperName(paper)),
                description: normalizeText(sourcePaperDescription(paper)),
              },
            ]),
          ),
        );
        const localPaperMap = new Map(
          local.flatMap((bundle) =>
            bundle.papers.map((paper) => [
              paper.uuid,
              {
                name: normalizeText(paper.paperName),
                description: normalizeText(paper.paperDescription),
              },
            ]),
          ),
        );

        for (const [groupId, sourceSet] of sourceMap.entries()) {
          const localSet = localMap.get(groupId);
          if (!localSet) continue;
          if (!compareSets(sourceSet, localSet)) contentMismatches.push(groupId);
        }

        for (const [paperUuid, sourceMeta] of sourcePaperMap.entries()) {
          const localMeta = localPaperMap.get(paperUuid);
          if (!localMeta) continue;
          if (sourceMeta.name && localMeta.name && sourceMeta.name !== localMeta.name) {
            nameMismatches.push(paperUuid);
            continue;
          }
          if (
            sourceMeta.description &&
            localMeta.description &&
            sourceMeta.description !== localMeta.description
          ) {
            nameMismatches.push(paperUuid);
          }
        }

        const orderMatches = JSON.stringify(sourceOrder) === JSON.stringify(localOrder);
        const ok =
          missingGroupsInLocal.length === 0 &&
          extraGroupsInLocal.length === 0 &&
          contentMismatches.length === 0 &&
          nameMismatches.length === 0 &&
          orderMatches;

        rowsMap.set(key, {
          ...base,
          sourceBundleCount: source.length,
          localBundleCount: local.length,
          sourceOrder,
          localOrder,
          missingGroupsInLocal,
          extraGroupsInLocal,
          contentMismatches,
          nameMismatches,
          orderMatches,
          ok,
        });
      } catch (error) {
        rowsMap.set(key, {
          ...base,
          sourceError: String(error),
        });
      }

      saveCheckpoint(Array.from(rowsMap.values()));
      await sleep(REQUEST_DELAY_MS + Math.floor(Math.random() * 120));
    }
  }

  const rows = Array.from(rowsMap.values()).sort((a, b) => {
    if (a.examUuid !== b.examUuid) return a.examUuid.localeCompare(b.examUuid);
    return a.courseName.localeCompare(b.courseName);
  });

  const total = rows.length;
  const okRows = rows.filter((row) => row.ok).length;
  const failedRows = rows.filter((row) => !row.ok).length;
  const orderFailures = rows.filter((row) => !row.orderMatches).length;
  const contentFailures = rows.filter((row) => row.contentMismatches.length > 0).length;
  const nameFailures = rows.filter((row) => row.nameMismatches.length > 0).length;
  const groupFailures = rows.filter(
    (row) => row.missingGroupsInLocal.length > 0 || row.extraGroupsInLocal.length > 0,
  ).length;

  const summary = {
    generatedAt: new Date().toISOString(),
    totalCoursesCompared: total,
    exactParityCourses: okRows,
    failedCourses: failedRows,
    orderFailures,
    contentFailures,
    nameFailures,
    groupFailures,
  };

  const topFailures = rows
    .filter((row) => !row.ok)
    .slice(0, 200)
    .map((row) => [
      row.examUuid,
      row.courseName,
      row.orderMatches,
      row.contentMismatches.length,
      row.nameMismatches.length,
      row.missingGroupsInLocal.length,
      row.extraGroupsInLocal.length,
      row.sourceError ? 'Y' : '',
      row.localError ? 'Y' : '',
    ]);

  const md = `# Live Parity Check

Generated: ${summary.generatedAt}

## Summary

${toTable(['Metric', 'Value'], [
    ['Courses compared', summary.totalCoursesCompared],
    ['Exact parity', summary.exactParityCourses],
    ['Failures', summary.failedCourses],
    ['Order failures', summary.orderFailures],
    ['Content failures', summary.contentFailures],
    ['Name failures', summary.nameFailures],
    ['Group set failures', summary.groupFailures],
  ])}

## Failure Sample

${toTable(
    ['Exam UUID', 'Course', 'Order OK', 'Content Mismatch Groups', 'Name Mismatches', 'Missing Groups', 'Extra Groups', 'SourceErr', 'LocalErr'],
    topFailures,
  )}
`;

  writeFileSync(path.join(OUT_DIR, 'live-parity-check.json'), `${JSON.stringify({ summary, rows }, null, 2)}\n`);
  writeFileSync(path.join(OUT_DIR, 'live-parity-check.md'), md);

  console.log(md);
}

void main();
