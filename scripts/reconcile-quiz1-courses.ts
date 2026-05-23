#!/usr/bin/env bun
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE_URL = 'https://quizpractice.space';
const DATA_DIR = path.join(process.cwd(), 'data-new', 'Quiz 1');
const TARGET_COURSE_UUIDS = new Set([
  'cf4f1445-e2f3-40c4-b1ab-d5d92d301a90', // English1
  '737f800a-3792-420d-9668-d7c5e54b7781', // English2
  '0ba125a6-f79c-4e3a-8e85-b125a5aa45a1', // Intro to C Programming
]);
const QUIZ1_UUID = '9251bc3a-e33e-45e0-bcf0-b16a0ea5b5fa';

type SourceCourse = { id: number; uuid: string; course_name: string };
type SourcePaper = { uuid: string };
type SourceGroup = { question_papers?: SourcePaper[] };

function htmlDecode(input: string) {
  return input
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

async function fetchExamPage() {
  const res = await fetch(`${BASE_URL}/exam/${QUIZ1_UUID}`);
  if (!res.ok) throw new Error(`Failed exam page fetch: ${res.status}`);
  const html = await res.text();
  const marker = 'id="app" data-page="';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('data-page marker missing');
  const after = html.slice(start + marker.length);
  const end = after.indexOf('"></div>');
  if (end < 0) throw new Error('data-page end marker missing');
  return JSON.parse(htmlDecode(after.slice(0, end))) as {
    props?: { exam?: { en_id?: string }; courses?: SourceCourse[] };
  };
}

async function fetchSourceGroups(courseId: number, examId: string) {
  const res = await fetch(`${BASE_URL}/api/get-questions-paper-by-exam`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ course_id: courseId, exam_id: examId, year: 'all' }),
  });
  if (!res.ok) throw new Error(`Failed source groups for ${courseId}: ${res.status}`);
  return (await res.json()) as SourceGroup[];
}

async function fetchPaper(courseId: number, paperUuid: string) {
  const res = await fetch(`${BASE_URL}/question-paper/practise/${courseId}/${paperUuid}`);
  if (!res.ok) throw new Error(`Failed paper ${paperUuid}: ${res.status}`);
  const html = await res.text();
  const marker = 'id="app" data-page="';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error(`data-page missing for ${paperUuid}`);
  const after = html.slice(start + marker.length);
  const end = after.indexOf('"></div>');
  if (end < 0) throw new Error(`data-page end missing for ${paperUuid}`);
  const data = JSON.parse(htmlDecode(after.slice(0, end))) as { props?: { question_paper?: unknown } };
  if (!data.props?.question_paper) throw new Error(`question_paper missing for ${paperUuid}`);
  return data.props.question_paper;
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });
  const page = await fetchExamPage();
  const examId = page.props?.exam?.en_id;
  const courses = (page.props?.courses ?? []).filter((c) => TARGET_COURSE_UUIDS.has(c.uuid));
  if (!examId) throw new Error('Missing quiz1 en_id');
  if (courses.length === 0) throw new Error('No target courses found on source page');

  for (const course of courses) {
    const courseDir = path.join(DATA_DIR, course.course_name);
    mkdirSync(courseDir, { recursive: true });

    const groups = await fetchSourceGroups(course.id, examId);
    const sourceUuids = new Set(
      groups.flatMap((g) => (g.question_papers ?? []).map((p) => p.uuid)).filter(Boolean),
    );

    for (const paperUuid of sourceUuids) {
      const paper = await fetchPaper(course.id, paperUuid);
      const outPath = path.join(courseDir, `${paperUuid}.json`);
      writeFileSync(outPath, `${JSON.stringify(paper, null, 2)}\n`);
    }

    for (const entry of readdirSync(courseDir)) {
      if (!entry.endsWith('.json')) continue;
      if (entry === 'metadata.json') continue;
      if (entry === 'index.json') continue;
      const paperUuid = entry.slice(0, -5);
      if (!sourceUuids.has(paperUuid)) {
        rmSync(path.join(courseDir, entry), { force: true });
      }
    }

    writeFileSync(path.join(courseDir, 'index.json'), `${JSON.stringify(groups, null, 2)}\n`);

    const metadataPath = path.join(courseDir, 'metadata.json');
    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as Record<string, unknown>;
    } catch {
      metadata = {};
    }
    metadata.updatedAt = new Date().toISOString();
    metadata.courseName = course.course_name;
    metadata.sourcePaperCount = sourceUuids.size;
    writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

    console.log(`Reconciled ${course.course_name}: ${sourceUuids.size} source papers.`);
  }
}

void main();
