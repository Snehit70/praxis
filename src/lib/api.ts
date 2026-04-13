import type { QuizQuestion } from '@/lib/dataTransforms';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787';

export interface DatasetStats {
  examCount: number;
  courseCount: number;
  paperVariantCount: number;
  questionCount: number;
}

export interface CourseSummary {
  _id: string;
  uuid: string;
  courseName: string;
  courseCode: string;
  paperCount: number;
}

export interface CourseRecord {
  uuid: string;
  course_name: string;
  course_code: string;
  program_id: number;
  label?: string | null;
}

export interface PaperSummary {
  _id: string;
  uuid: string;
  courseUuid: string;
  paperName: string;
  paperDescription: string;
  year: number;
  duration: number;
  totalScore: string;
  isNew: number;
  createdAt: string | null;
  updatedAt: string | null;
  questionCount: number;
  calculatedTotalMarks: number;
}

export interface PaperDetails {
  _id: string;
  uuid: string;
  paperName: string;
  paperDescription: string;
  year: number;
  duration: number;
  totalScore: string;
  isNew: number;
  createdAt: string | null;
  updatedAt: string | null;
  examName: string;
  examUuid: string;
  courseName: string;
  courseUuid: string;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API request failed (${response.status}): ${path}`);
  }

  return (await response.json()) as T;
}

export function getDatasetStats() {
  return fetchJson<DatasetStats>('/api/stats');
}

export function getExamCourses(examUuid: string) {
  return fetchJson<CourseSummary[]>(`/api/exams/${encodeURIComponent(examUuid)}/courses`);
}

export function getCourseByUuid(examUuid: string, courseUuid: string) {
  return fetchJson<CourseRecord>(
    `/api/exams/${encodeURIComponent(examUuid)}/courses/${encodeURIComponent(courseUuid)}`,
  );
}

export function getPapersByExamAndCourse(examUuid: string, courseUuid: string) {
  return getPapersByExamAndCourseUuids(examUuid, [courseUuid]);
}

export function getPapersByExamAndCourseUuids(examUuid: string, courseUuids: string[]) {
  const params = new URLSearchParams();
  if (courseUuids.length > 0) {
    params.set('courseUuids', courseUuids.join(','));
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return fetchJson<PaperSummary[]>(
    `/api/exams/${encodeURIComponent(examUuid)}/courses/${encodeURIComponent(courseUuids[0] ?? '')}/papers${suffix}`,
  );
}

export function getPaperByUuid(paperUuid: string, courseUuid?: string | null, examUuid?: string | null) {
  const params = new URLSearchParams();
  if (courseUuid) {
    params.set('courseUuid', courseUuid);
  }
  if (examUuid) {
    params.set('examUuid', examUuid);
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return fetchJson<PaperDetails>(`/api/papers/${encodeURIComponent(paperUuid)}${suffix}`);
}

export function getQuestionsByPaperUuid(
  paperUuid: string,
  courseUuid?: string | null,
  examUuid?: string | null,
) {
  const params = new URLSearchParams();
  if (courseUuid) {
    params.set('courseUuid', courseUuid);
  }
  if (examUuid) {
    params.set('examUuid', examUuid);
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return fetchJson<QuizQuestion[]>(`/api/papers/${encodeURIComponent(paperUuid)}/questions${suffix}`);
}
