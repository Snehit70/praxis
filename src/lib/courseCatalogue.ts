import type { CatalogueCourse } from '@/lib/api';
import {
  getCanonicalCourseName,
  getCourseLevel,
  getDisplayCourseName,
  type CourseLevel,
} from '@/lib/courseMapping';

import frierenImg from '@/assets/Frieren.jpeg';
import fernImg from '@/assets/Fern.jpeg';
import starkImg from '@/assets/Stark.jpeg';
import himmelImg from '@/assets/Himmel.jpeg';
import heiterImg from '@/assets/Heiter.jpeg';

/**
 * A course as shown on the dashboard: source rows that share a canonical name
 * are merged into one entry. `key` (the canonical name) is the stable identity
 * we persist as the user's enrollment, and `uuids` are every underlying source
 * course id (passed as `aliases` when linking into the paper list).
 */
export interface CatalogueEntry {
  key: string;
  displayName: string;
  courseCode: string;
  level: CourseLevel;
  uuids: string[];
  primaryUuid: string;
  paperCount: number;
  examSlugs: string[];
}

/** Preferred exam type to open first when a course offers several. */
const EXAM_PRIORITY = ['end-term', 'quiz1', 'quiz2', 'oppe'];

export function pickDefaultExamSlug(examSlugs: string[]): string | null {
  for (const slug of EXAM_PRIORITY) {
    if (examSlugs.includes(slug)) return slug;
  }
  return examSlugs[0] ?? null;
}

/** Merge raw per-source courses into deduplicated, level-tagged catalogue entries. */
export function buildCatalogue(courses: CatalogueCourse[]): CatalogueEntry[] {
  const merged = new Map<string, CatalogueEntry & { primaryPaperCount: number }>();

  for (const course of courses) {
    const key = getCanonicalCourseName(course.courseName);
    const existing = merged.get(key);

    if (existing) {
      existing.uuids.push(course.uuid);
      existing.paperCount += course.paperCount;
      for (const slug of course.examSlugs) {
        if (!existing.examSlugs.includes(slug)) existing.examSlugs.push(slug);
      }
      if (course.paperCount > existing.primaryPaperCount) {
        existing.primaryUuid = course.uuid;
        existing.primaryPaperCount = course.paperCount;
      }
    } else {
      merged.set(key, {
        key,
        displayName: getDisplayCourseName(course.courseName),
        courseCode: course.courseCode,
        level: getCourseLevel(course.courseName),
        uuids: [course.uuid],
        primaryUuid: course.uuid,
        paperCount: course.paperCount,
        primaryPaperCount: course.paperCount,
        examSlugs: [...course.examSlugs],
      });
    }
  }

  return Array.from(merged.values())
    .map(({ primaryPaperCount: _drop, ...entry }) => ({
      ...entry,
      examSlugs: EXAM_PRIORITY.filter((slug) => entry.examSlugs.includes(slug)).concat(
        entry.examSlugs.filter((slug) => !EXAM_PRIORITY.includes(slug)),
      ),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** Path into the paper list for a course, opening a sensible default exam type. */
export function courseHref(entry: CatalogueEntry): string {
  const slug = pickDefaultExamSlug(entry.examSlugs);
  if (!slug) return '/search';
  const aliases = entry.uuids.filter((uuid) => uuid !== entry.primaryUuid);
  const suffix = aliases.length > 0 ? `?aliases=${encodeURIComponent(aliases.join(','))}` : '';
  return `/exam/${slug}/course/${entry.primaryUuid}${suffix}`;
}

/** Visual identity per program level — a Frieren character + accent palette. */
export interface LevelMeta {
  label: string;
  image: string;
  /** left-border accent (matches the existing ExamPage palette). */
  accent: string;
  text: string;
  ring: string;
}

export const LEVEL_META: Record<CourseLevel, LevelMeta> = {
  Foundation: {
    label: 'Foundation',
    image: frierenImg,
    accent: 'border-l-blue-500',
    text: 'text-blue-400',
    ring: 'ring-blue-500/30',
  },
  'Diploma in Programming': {
    label: 'Diploma · Programming',
    image: fernImg,
    accent: 'border-l-purple-500',
    text: 'text-purple-400',
    ring: 'ring-purple-500/30',
  },
  'Diploma in Data Science': {
    label: 'Diploma · Data Science',
    image: starkImg,
    accent: 'border-l-orange-500',
    text: 'text-orange-400',
    ring: 'ring-orange-500/30',
  },
  Degree: {
    label: 'Degree',
    image: himmelImg,
    accent: 'border-l-emerald-500',
    text: 'text-emerald-400',
    ring: 'ring-emerald-500/30',
  },
  Other: {
    label: 'Other',
    image: heiterImg,
    accent: 'border-l-gray-500',
    text: 'text-gray-400',
    ring: 'ring-gray-500/30',
  },
};

export const SELECTABLE_LEVELS: CourseLevel[] = [
  'Foundation',
  'Diploma in Programming',
  'Diploma in Data Science',
  'Degree',
];
