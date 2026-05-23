#!/usr/bin/env bun
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type SourceCourse = {
  id: number;
  uuid: string;
  course_name: string;
};

type SourcePaper = { uuid?: string } & Record<string, unknown>;
type SourceGroup = { question_papers?: SourcePaper[] };

const BASE_URL = 'https://quizpractice.space';
const DATA_NEW_DIR = path.join(process.cwd(), 'data-new');
const EXAM_UUID = process.env.EXAM_UUID;
const COURSE_UUID = process.env.COURSE_UUID;
const REQUEST_DELAY_MS = Number.parseInt(process.env.RECONCILE_REQUEST_DELAY_MS ?? '350', 10);
const MAX_RETRIES = Number.parseInt(process.env.RECONCILE_MAX_RETRIES ?? '6', 10);

if (!EXAM_UUID || !COURSE_UUID) {
  throw new Error('Set EXAM_UUID and COURSE_UUID before running this script.');
}

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
    await sleep(700 * 2 ** attempt + Math.floor(Math.random() * 300));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchInertiaPage(url: string) {
  const response = await fetchWithRetry(url);
  const html = await response.text();
  const marker = 'id="app" data-page="';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error(`data-page not found: ${url}`);
  const after = html.slice(start + marker.length);
  const end = after.indexOf('"></div>');
  if (end < 0) throw new Error(`data-page end not found: ${url}`);
  return JSON.parse(htmlDecode(after.slice(0, end))) as Record<string, any>;
}

function findExamDir(examUuid: string) {
  for (const entry of readdirSync(DATA_NEW_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const metadataPath = path.join(DATA_NEW_DIR, entry.name, 'metadata.json');
    try {
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as { exam?: { uuid?: string } };
      if (metadata.exam?.uuid === examUuid) return entry.name;
    } catch {
      // Ignore non-exam directories.
    }
  }
  throw new Error(`Could not find data-new directory for exam ${examUuid}`);
}

async function main() {
  const examPage = await fetchInertiaPage(`${BASE_URL}/exam/${EXAM_UUID}`);
  const enId = examPage.props?.exam?.en_id as string | undefined;
  const course = (examPage.props?.courses as SourceCourse[] | undefined)?.find(
    (item) => item.uuid === COURSE_UUID,
  );

  if (!enId) throw new Error(`Missing source en_id for exam ${EXAM_UUID}`);
  if (!course) throw new Error(`Course ${COURSE_UUID} not found on source exam ${EXAM_UUID}`);

  const groupsResponse = await fetchWithRetry(`${BASE_URL}/api/get-questions-paper-by-exam`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ course_id: course.id, year: 'all', exam_id: enId }),
  });
  const groups = (await groupsResponse.json()) as SourceGroup[];
  const indexRows = groups
    .flatMap((group) => group.question_papers ?? [])
    .filter((paper) => typeof paper.uuid === 'string' && paper.uuid.length > 0);
  const paperUuids = Array.from(new Set(indexRows.map((paper) => paper.uuid as string)));

  const examDir = findExamDir(EXAM_UUID);
  const courseDirName = course.course_name.trim() || COURSE_UUID;
  const courseDir = path.join(DATA_NEW_DIR, examDir, courseDirName);
  mkdirSync(courseDir, { recursive: true });
  writeFileSync(path.join(courseDir, 'index.json'), `${JSON.stringify(indexRows, null, 2)}\n`);

  for (const paperUuid of paperUuids) {
    const paperPage = await fetchInertiaPage(`${BASE_URL}/question-paper/practise/${course.id}/${paperUuid}`);
    const questionPaper = paperPage.props?.question_paper;
    if (!questionPaper) throw new Error(`Missing question_paper for ${paperUuid}`);
    writeFileSync(path.join(courseDir, `${paperUuid}.json`), `${JSON.stringify(questionPaper, null, 2)}\n`);
    await sleep(REQUEST_DELAY_MS + Math.floor(Math.random() * 120));
  }

  for (const entry of readdirSync(courseDir)) {
    if (!entry.endsWith('.json') || entry === 'index.json' || entry === 'metadata.json') continue;
    const uuid = entry.slice(0, -5);
    if (!paperUuids.includes(uuid)) rmSync(path.join(courseDir, entry), { force: true });
  }

  console.log(`Reconciled ${examDir} / ${courseDirName}: ${paperUuids.length} papers`);
}

void main();
