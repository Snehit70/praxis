#!/usr/bin/env bun
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type ParityRow = {
  examUuid: string;
  courseUuid: string;
  courseName: string;
  ok: boolean;
  sourceError?: string;
  localError?: string;
};

type SourceCourse = {
  id: number;
  uuid: string;
  course_name: string;
};

type SourceExamPage = {
  props?: {
    exam?: { en_id?: string };
    courses?: SourceCourse[];
  };
};

type SourcePaper = { uuid?: string } & Record<string, unknown>;
type SourceGroup = { question_papers?: SourcePaper[] };

const BASE_URL = 'https://quizpractice.space';
const DATA_NEW_DIR = path.join(process.cwd(), 'data-new');
const PARITY_REPORT = path.join(process.cwd(), 'reports', 'live-parity-check.json');
const REQUEST_DELAY_MS = Number.parseInt(process.env.RECONCILE_REQUEST_DELAY_MS ?? '350', 10);
const MAX_RETRIES = Number.parseInt(process.env.RECONCILE_MAX_RETRIES ?? '6', 10);

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

function loadExamDirectoryMap() {
  const map = new Map<string, string>();
  const examDirs = readdirSync(DATA_NEW_DIR, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  for (const examDir of examDirs) {
    const metadataPath = path.join(DATA_NEW_DIR, examDir.name, 'metadata.json');
    try {
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as { exam?: { uuid?: string } };
      const examUuid = metadata.exam?.uuid;
      if (examUuid) map.set(examUuid, examDir.name);
    } catch {
      // Ignore non-scraped directories.
    }
  }
  return map;
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
    const backoff = 700 * 2 ** attempt + Math.floor(Math.random() * 300);
    await sleep(backoff);
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchExamPage(examUuid: string) {
  const res = await fetchWithRetry(`${BASE_URL}/exam/${examUuid}`);
  const html = await res.text();
  const marker = 'id="app" data-page="';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error(`data-page not found for ${examUuid}`);
  const after = html.slice(start + marker.length);
  const end = after.indexOf('"></div>');
  if (end < 0) throw new Error(`data-page end not found for ${examUuid}`);
  return JSON.parse(htmlDecode(after.slice(0, end))) as SourceExamPage;
}

async function fetchSourceGroups(courseId: number, enId: string) {
  const res = await fetchWithRetry(`${BASE_URL}/api/get-questions-paper-by-exam`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ course_id: courseId, year: 'all', exam_id: enId }),
  });
  return (await res.json()) as SourceGroup[];
}

async function fetchQuestionPaper(courseId: number, paperUuid: string) {
  const res = await fetchWithRetry(`${BASE_URL}/question-paper/practise/${courseId}/${paperUuid}`);
  const html = await res.text();
  const marker = 'id="app" data-page="';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error(`paper data-page not found: ${paperUuid}`);
  const after = html.slice(start + marker.length);
  const end = after.indexOf('"></div>');
  if (end < 0) throw new Error(`paper data-page end not found: ${paperUuid}`);
  const parsed = JSON.parse(htmlDecode(after.slice(0, end))) as { props?: { question_paper?: unknown } };
  if (!parsed.props?.question_paper) throw new Error(`question_paper missing: ${paperUuid}`);
  return parsed.props.question_paper;
}

async function main() {
  const parity = JSON.parse(readFileSync(PARITY_REPORT, 'utf8')) as { rows: ParityRow[] };
  const mismatches = parity.rows.filter(
    (row) => row.ok === false && !row.sourceError && !row.localError,
  );
  if (mismatches.length === 0) {
    console.log('No comparable mismatches to reconcile.');
    return;
  }

  const examDirByUuid = loadExamDirectoryMap();
  const byExam = new Map<string, ParityRow[]>();
  for (const row of mismatches) {
    const list = byExam.get(row.examUuid) ?? [];
    list.push(row);
    byExam.set(row.examUuid, list);
  }

  for (const [examUuid, examRows] of byExam) {
    const examDirName = examDirByUuid.get(examUuid);
    if (!examDirName) {
      console.log(`Skipping ${examUuid}: exam directory not found in data-new`);
      continue;
    }

    const page = await fetchExamPage(examUuid);
    const enId = page.props?.exam?.en_id;
    const courses = page.props?.courses ?? [];
    if (!enId) {
      console.log(`Skipping ${examUuid}: missing en_id`);
      continue;
    }

    const sourceCourseByUuid = new Map(courses.map((course) => [course.uuid, course]));

    for (const row of examRows) {
      const sourceCourse = sourceCourseByUuid.get(row.courseUuid);
      if (!sourceCourse) {
        console.log(`Skipping ${row.courseName} (${row.courseUuid}): missing in source exam page`);
        continue;
      }

      const courseDirName = sourceCourse.course_name.trim() || sourceCourse.uuid;
      const courseDir = path.join(DATA_NEW_DIR, examDirName, courseDirName);
      mkdirSync(courseDir, { recursive: true });

      const groups = await fetchSourceGroups(sourceCourse.id, enId);
      const indexRows = groups
        .flatMap((group) => (group.question_papers ?? []))
        .filter((paper) => typeof paper.uuid === 'string' && paper.uuid.length > 0);
      const uuids = Array.from(new Set(indexRows.map((paper) => paper.uuid as string)));

      writeFileSync(path.join(courseDir, 'index.json'), `${JSON.stringify(indexRows, null, 2)}\n`);

      for (const uuid of uuids) {
        const questionPaper = await fetchQuestionPaper(sourceCourse.id, uuid);
        writeFileSync(path.join(courseDir, `${uuid}.json`), `${JSON.stringify(questionPaper, null, 2)}\n`);
        await sleep(REQUEST_DELAY_MS + Math.floor(Math.random() * 120));
      }

      for (const entry of readdirSync(courseDir)) {
        if (!entry.endsWith('.json')) continue;
        if (entry === 'index.json' || entry === 'metadata.json') continue;
        const uuid = entry.slice(0, -5);
        if (!uuids.includes(uuid)) {
          rmSync(path.join(courseDir, entry), { force: true });
        }
      }

      console.log(
        `Reconciled ${examDirName} / ${courseDirName}: ${uuids.length} papers`,
      );
    }
  }
}

void main();
