import type { CatalogueCourse } from '@/lib/api';
import {
  getCanonicalCourseName,
  getCourseLevel,
  getDisplayCourseName,
  type CourseLevel,
} from '@/lib/courseMapping';

import fernImg from '@/assets/fern_image.jpeg';
import starkImg from '@/assets/Stark-banner.jpeg';
import himmelImg from '@/assets/Himmel.jpeg';
import frierenImg from '@/assets/Frieren.jpeg';
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
  /** gradient start colour for the cinematic course-tile floor glow. */
  glow: string;
}

export const LEVEL_META: Record<CourseLevel, LevelMeta> = {
  // Foundation → Fern (the apprentice), violet to match her hair against the green field.
  Foundation: {
    label: 'Foundation',
    image: fernImg,
    accent: 'border-l-violet-500',
    text: 'text-violet-300',
    ring: 'ring-violet-500/30',
    glow: 'from-violet-500/45',
  },
  // Diploma · Programming → Himmel (the hero), sky blue from his hair.
  'Diploma in Programming': {
    label: 'Diploma · Programming',
    image: himmelImg,
    accent: 'border-l-sky-500',
    text: 'text-sky-300',
    ring: 'ring-sky-500/30',
    glow: 'from-sky-500/45',
  },
  // Diploma · Data Science → Stark (the warrior), rose/red from his coat over the cool crystal.
  'Diploma in Data Science': {
    label: 'Diploma · Data Science',
    image: starkImg,
    accent: 'border-l-rose-500',
    text: 'text-rose-300',
    ring: 'ring-rose-500/30',
    glow: 'from-rose-500/45',
  },
  // Degree → Frieren (the master), indigo — "blue", deeper than Himmel's sky so they stay distinct.
  Degree: {
    label: 'Degree',
    image: frierenImg,
    accent: 'border-l-indigo-500',
    text: 'text-indigo-300',
    ring: 'ring-indigo-500/30',
    glow: 'from-indigo-500/45',
  },
  // Other → Heiter (the priest), emerald to harmonize with his forest frame.
  Other: {
    label: 'Other',
    image: heiterImg,
    accent: 'border-l-emerald-500',
    text: 'text-emerald-300',
    ring: 'ring-emerald-500/30',
    glow: 'from-emerald-500/45',
  },
};

export const SELECTABLE_LEVELS: CourseLevel[] = [
  'Foundation',
  'Diploma in Programming',
  'Diploma in Data Science',
  'Degree',
];
