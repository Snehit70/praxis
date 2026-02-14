export const EXAM_SLUG_TO_UUID: Record<string, string> = {
  'quiz1': '9251bc3a-e33e-45e0-bcf0-b16a0ea5b5fa',
  'quiz2': '1948ee72-5c62-4816-97c8-7d662330a220',
  'end-term': '7a6ff569-f50c-40e7-a08b-f5c334392600',
  'oppe': '4e5fffd3-41e9-4ec7-853c-8af983edb699',
};

export const EXAM_UUID_TO_SLUG: Record<string, string> = {
  '9251bc3a-e33e-45e0-bcf0-b16a0ea5b5fa': 'quiz1',
  '1948ee72-5c62-4816-97c8-7d662330a220': 'quiz2',
  '7a6ff569-f50c-40e7-a08b-f5c334392600': 'end-term',
  '4e5fffd3-41e9-4ec7-853c-8af983edb699': 'oppe',
};

export const EXAM_SLUG_TO_NAME: Record<string, string> = {
  'quiz1': 'Quiz 1',
  'quiz2': 'Quiz 2',
  'end-term': 'End Term Quiz',
  'oppe': 'OPPE',
};

export function getExamUuidFromSlug(slug: string): string | null {
  return EXAM_SLUG_TO_UUID[slug] || null;
}

export function getExamSlugFromUuid(uuid: string): string | null {
  return EXAM_UUID_TO_SLUG[uuid] || null;
}

export function getExamNameFromSlug(slug: string): string | null {
  return EXAM_SLUG_TO_NAME[slug] || null;
}
