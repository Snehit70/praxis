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

export interface SearchCourseResult {
  uuid: string;
  courseName: string;
  courseCode: string;
  examUuid: string;
  examName: string;
  examSlug: string;
  paperCount: number;
}

export interface SearchPaperResult {
  uuid: string;
  paperName: string;
  paperDescription: string;
  year: number;
  duration: number;
  totalScore: string;
  isNew: number;
  examUuid: string;
  examName: string;
  examSlug: string;
  courseUuid: string;
  courseName: string;
  questionCount: number;
  calculatedTotalMarks: number;
}

export interface SearchResults {
  courses: SearchCourseResult[];
  papers: SearchPaperResult[];
}

export interface PaperSummary {
  _id: string;
  uuid: string;
  courseUuid: string;
  paperName: string;
  paperDescription: string;
  year: number | null;
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
  year: number | null;
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

interface ApiRequestOptions {
  signal?: AbortSignal;
}

async function fetchJson<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    signal: options.signal,
  });
  if (!response.ok) {
    throw new Error(`API request failed (${response.status}): ${path}`);
  }

  return (await response.json()) as T;
}

export interface CatalogueCourse {
  uuid: string;
  courseName: string;
  courseCode: string;
  programId: number;
  paperCount: number;
  examSlugs: string[];
}

export function getDatasetStats(options?: ApiRequestOptions) {
  return fetchJson<DatasetStats>('/api/stats', options);
}

/** Every course (across all exam types) with paper counts — for the dashboard. */
export function getAllCourses(options?: ApiRequestOptions) {
  return fetchJson<CatalogueCourse[]>('/api/courses', options);
}

export function getSearchResults(query: string, options?: ApiRequestOptions) {
  return fetchJson<SearchResults>(`/api/search?q=${encodeURIComponent(query)}`, options);
}

export function getExamCourses(examUuid: string, options?: ApiRequestOptions) {
  return fetchJson<CourseSummary[]>(`/api/exams/${encodeURIComponent(examUuid)}/courses`, options);
}

export function getCourseByUuid(examUuid: string, courseUuid: string, options?: ApiRequestOptions) {
  return fetchJson<CourseRecord>(
    `/api/exams/${encodeURIComponent(examUuid)}/courses/${encodeURIComponent(courseUuid)}`,
    options,
  );
}

export function getPapersByExamAndCourse(examUuid: string, courseUuid: string, options?: ApiRequestOptions) {
  return getPapersByExamAndCourseUuids(examUuid, [courseUuid], options);
}

export function getPapersByExamAndCourseUuids(
  examUuid: string,
  courseUuids: string[],
  options?: ApiRequestOptions,
) {
  const params = new URLSearchParams();
  if (courseUuids.length > 0) {
    params.set('courseUuids', courseUuids.join(','));
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return fetchJson<PaperSummary[]>(
    `/api/exams/${encodeURIComponent(examUuid)}/courses/${encodeURIComponent(courseUuids[0] ?? '')}/papers${suffix}`,
    options,
  );
}

export interface PaperBundle {
  groupId: number;
  bundleLabel: string;
  dateLabel: string;
  termLabel: string | null;
  variantCount: number;
  papers: PaperSummary[];
}

export function getPaperBundlesByExamAndCourseUuids(
  examUuid: string,
  courseUuids: string[],
  options?: ApiRequestOptions,
) {
  const params = new URLSearchParams();
  if (courseUuids.length > 0) {
    params.set('courseUuids', courseUuids.join(','));
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return fetchJson<PaperBundle[]>(
    `/api/exams/${encodeURIComponent(examUuid)}/courses/${encodeURIComponent(courseUuids[0] ?? '')}/bundles${suffix}`,
    options,
  );
}

export function getPaperByUuid(
  paperUuid: string,
  courseUuid?: string | null,
  examUuid?: string | null,
  options?: ApiRequestOptions,
) {
  const params = new URLSearchParams();
  if (courseUuid) {
    params.set('courseUuid', courseUuid);
  }
  if (examUuid) {
    params.set('examUuid', examUuid);
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return fetchJson<PaperDetails>(`/api/papers/${encodeURIComponent(paperUuid)}${suffix}`, options);
}

export function getQuestionsByPaperUuid(
  paperUuid: string,
  courseUuid?: string | null,
  examUuid?: string | null,
  options?: ApiRequestOptions,
) {
  const params = new URLSearchParams();
  if (courseUuid) {
    params.set('courseUuid', courseUuid);
  }
  if (examUuid) {
    params.set('examUuid', examUuid);
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return fetchJson<QuizQuestion[]>(
    `/api/papers/${encodeURIComponent(paperUuid)}/questions${suffix}`,
    options,
  );
}

// --- Authenticated (per-user) API -----------------------------------------

/** A function that returns a Clerk session token, e.g. Clerk's `getToken`. */
export type TokenGetter = () => Promise<string | null>;

export interface SavedPaper {
  id: string;
  uuid: string;
  paperName: string;
  examUuid: string;
  examName: string;
  courseUuid: string;
  courseName: string;
  year: number | null;
  savedAt: string | null;
}

export interface HistoryItem {
  id: string;
  uuid: string;
  paperName: string;
  examUuid: string;
  examName: string;
  courseUuid: string;
  courseName: string;
  year: number | null;
  viewedAt: string | null;
}

async function fetchAuthedJson<T>(
  path: string,
  getToken: TokenGetter,
  init: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new Error(`API request failed (${response.status}): ${path}`);
  }

  return (await response.json()) as T;
}

export function getSavedPapers(getToken: TokenGetter) {
  return fetchAuthedJson<SavedPaper[]>('/api/me/saved', getToken);
}

export function addSavedPaper(paperId: string, getToken: TokenGetter) {
  return fetchAuthedJson<{ ok: boolean; paperId: string }>('/api/me/saved', getToken, {
    method: 'POST',
    body: JSON.stringify({ paperId }),
  });
}

export function removeSavedPaper(paperId: string, getToken: TokenGetter) {
  return fetchAuthedJson<{ ok: boolean; paperId: string }>(
    `/api/me/saved/${encodeURIComponent(paperId)}`,
    getToken,
    { method: 'DELETE' },
  );
}

export function getHistory(getToken: TokenGetter) {
  return fetchAuthedJson<HistoryItem[]>('/api/me/history', getToken);
}

export function recordView(paperId: string, getToken: TokenGetter) {
  return fetchAuthedJson<{ ok: boolean; paperId: string }>('/api/me/history', getToken, {
    method: 'POST',
    body: JSON.stringify({ paperId }),
  });
}

export interface EnrolledCourses {
  /** Program level the user selected (e.g. "Foundation"), or null if unset. */
  level: string | null;
  /** Canonical course names the user is taking this term. */
  courseKeys: string[];
}

export function getEnrolledCourses(getToken: TokenGetter) {
  return fetchAuthedJson<EnrolledCourses>('/api/me/courses', getToken);
}

export function saveEnrolledCourses(payload: EnrolledCourses, getToken: TokenGetter) {
  return fetchAuthedJson<{ ok: boolean } & EnrolledCourses>('/api/me/courses', getToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function filenameFromDisposition(header: string | null, fallback: string) {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

export class PdfDownloadError extends Error {
  status: number;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = 'PdfDownloadError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function downloadPaperPdf(
  paperUuid: string,
  getToken: TokenGetter,
  options: {
    courseUuid?: string | null;
    examUuid?: string | null;
    answers?: boolean;
  } = {},
) {
  const token = await getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const params = new URLSearchParams();
  if (options.courseUuid) params.set('courseUuid', options.courseUuid);
  if (options.examUuid) params.set('examUuid', options.examUuid);
  if (options.answers) params.set('answers', '1');
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const fallback = options.answers ? 'paper-answers.pdf' : 'paper.pdf';

  const response = await fetch(
    `${API_BASE_URL}/api/papers/${encodeURIComponent(paperUuid)}/pdf${suffix}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    let message = `Could not download the PDF (${response.status})`;
    let retryAfterSeconds: number | undefined;
    try {
      const body = (await response.json()) as { error?: string; retryAfterSeconds?: number };
      if (body.error) message = body.error;
      if (typeof body.retryAfterSeconds === 'number') retryAfterSeconds = body.retryAfterSeconds;
    } catch {
      // Keep the status fallback when the body is not JSON.
    }
    throw new PdfDownloadError(message, response.status, retryAfterSeconds);
  }

  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(response.headers.get('content-disposition'), fallback),
  };
}
