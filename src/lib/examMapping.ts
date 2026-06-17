export const EXAM_SLUG_TO_UUID: Record<string, string> = {
  'quiz1': '9251bc3a-e33e-45e0-bcf0-b16a0ea5b5fa',
  'quiz2': '1948ee72-5c62-4816-97c8-7d662330a220',
  'end-term': '7a6ff569-f50c-40e7-a08b-f5c334392600',
};

export const EXAM_UUID_TO_SLUG: Record<string, string> = {
  '9251bc3a-e33e-45e0-bcf0-b16a0ea5b5fa': 'quiz1',
  '1948ee72-5c62-4816-97c8-7d662330a220': 'quiz2',
  '7a6ff569-f50c-40e7-a08b-f5c334392600': 'end-term',
};

export const EXAM_SLUG_TO_NAME: Record<string, string> = {
  'quiz1': 'Quiz 1',
  'quiz2': 'Quiz 2',
  'end-term': 'End Term Quiz',
};

export const SUPPORTED_EXAM_SLUGS = ['quiz1', 'quiz2', 'end-term'] as const;

export function isSupportedExamSlug(slug: string): boolean {
  return slug in EXAM_SLUG_TO_UUID;
}

export function getExamUuidFromSlug(slug: string): string | null {
  return EXAM_SLUG_TO_UUID[slug] || null;
}

export function getExamSlugFromUuid(uuid: string): string | null {
  return EXAM_UUID_TO_SLUG[uuid] || null;
}

export function getExamNameFromSlug(slug: string): string | null {
  return EXAM_SLUG_TO_NAME[slug] || null;
}

// Timed-attempt length per exam type, in minutes. Quizzes run 60 minutes, the
// End Term runs 90. Per-paper `duration` values in the dataset are placeholders
// (almost all are 4), so the clock and the displayed duration are derived from
// the exam type here instead.
export const EXAM_SLUG_TO_DURATION_MINUTES: Record<string, number> = {
  'quiz1': 60,
  'quiz2': 60,
  'end-term': 90,
};

const DEFAULT_EXAM_DURATION_MINUTES = 60;

export function getExamDurationMinutes(slug: string | null): number {
  if (!slug) return DEFAULT_EXAM_DURATION_MINUTES;
  return EXAM_SLUG_TO_DURATION_MINUTES[slug] ?? DEFAULT_EXAM_DURATION_MINUTES;
}
