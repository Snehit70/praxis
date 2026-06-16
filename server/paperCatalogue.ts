export interface ParsedBundleDate {
  year: number;
  month: number;
  day: number;
  score: number;
}

export interface PaperBundleInput {
  groupId: number;
  paperName: string;
  paperDescription: string;
  createdAt: string | null;
}

export interface PaperBundle<TPaper extends PaperBundleInput> {
  groupId: number;
  bundleLabel: string;
  dateLabel: string;
  termLabel: string | null;
  variantCount: number;
  papers: TPaper[];
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export function getCourseUuids(searchParams: URLSearchParams, fallbackCourseUuid: string) {
  const requested = searchParams
    .get('courseUuids')
    ?.split(',')
    .map((value) => decodeURIComponent(value.trim()))
    .filter(Boolean) ?? [];

  return Array.from(new Set(requested.length > 0 ? requested : [fallbackCourseUuid]));
}

export function getSearchPattern(searchParams: URLSearchParams) {
  const query = searchParams.get('q')?.trim() ?? '';
  const escapedQuery = query.replaceAll(/[%_]/g, '\\$&');
  return {
    query,
    pattern: `%${escapedQuery}%`,
    prefixPattern: `${escapedQuery}%`,
  };
}

export function parseBundleDate(text: string | null | undefined): ParsedBundleDate | null {
  if (!text) return null;
  const normalized = text.replaceAll(',', ' ').replaceAll(':', ' ').trim();
  if (!normalized) return null;

  const patterns: Array<RegExp> = [
    /\b(20\d{2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{1,2})?\b/i,
    /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{2}|\d{4})\b/i,
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{1,2})\s+(\d{2}|\d{4})\b/i,
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{2}|\d{4})\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    let year = 0;
    let month = 0;
    let day = 1;
    let score = 0;

    if (pattern === patterns[0]) {
      year = Number.parseInt(match[1] ?? '0', 10);
      month = MONTHS[match[2]?.slice(0, 3).toLowerCase() ?? ''] ?? 0;
      day = match[3] ? Number.parseInt(match[3], 10) : 1;
      score = 6;
    } else if (pattern === patterns[1]) {
      day = Number.parseInt(match[1] ?? '1', 10);
      month = MONTHS[match[2]?.slice(0, 3).toLowerCase() ?? ''] ?? 0;
      year = Number.parseInt(match[3] ?? '0', 10);
      score = 6;
    } else if (pattern === patterns[2]) {
      month = MONTHS[match[1]?.slice(0, 3).toLowerCase() ?? ''] ?? 0;
      day = Number.parseInt(match[2] ?? '1', 10);
      year = Number.parseInt(match[3] ?? '0', 10);
      score = 6;
    } else {
      month = MONTHS[match[1]?.slice(0, 3).toLowerCase() ?? ''] ?? 0;
      year = Number.parseInt(match[2] ?? '0', 10);
      day = 1;
      score = 4;
    }

    if (year > 0 && year < 100) year += 2000;
    if (!year || !month || day < 1 || day > 31) continue;
    return { year, month, day, score };
  }

  return null;
}

export function compareParsedBundleDate(
  left: ParsedBundleDate | null,
  right: ParsedBundleDate | null,
) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  if (left.score !== right.score) return right.score - left.score;
  const leftTime = Date.UTC(left.year, left.month - 1, left.day);
  const rightTime = Date.UTC(right.year, right.month - 1, right.day);
  return rightTime - leftTime;
}

export function inferTerm(month: number): number | null {
  if (month >= 2 && month <= 5) return 1;
  if (month >= 6 && month <= 9) return 2;
  if (month >= 10 || month === 1) return 3;
  return null;
}

export function formatDateLabel(date: ParsedBundleDate) {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function buildPaperBundles<TPaper extends PaperBundleInput>(
  rows: TPaper[],
): Array<PaperBundle<TPaper>> {
  const grouped = new Map<
    number,
    {
      groupId: number;
      bundleLabel: string;
      dateLabel: string;
      termLabel: string | null;
      sortTime: number;
      papers: TPaper[];
    }
  >();

  for (const row of rows) {
    const bucket = grouped.get(row.groupId) ?? {
      groupId: row.groupId,
      bundleLabel: row.groupId === 1 ? 'Others' : `QP Bundle ${row.groupId}`,
      dateLabel: row.groupId === 1 ? 'Others' : 'Unknown',
      termLabel: null,
      sortTime: 0,
      papers: [],
    };

    bucket.papers.push(row);
    grouped.set(row.groupId, bucket);
  }

  return Array.from(grouped.values())
    .map((bundle) => {
      if (bundle.groupId === 1) {
        return {
          groupId: bundle.groupId,
          bundleLabel: bundle.bundleLabel,
          dateLabel: bundle.dateLabel,
          termLabel: null,
          sortTime: -1,
          variantCount: bundle.papers.length,
          papers: bundle.papers,
        };
      }

      let bestDate: ParsedBundleDate | null = null;
      for (const paper of bundle.papers) {
        const fromName = parseBundleDate(paper.paperName);
        const fromDescription = parseBundleDate(paper.paperDescription);
        const candidate = compareParsedBundleDate(fromName, fromDescription) <= 0
          ? fromName
          : fromDescription;
        if (compareParsedBundleDate(candidate, bestDate) < 0) {
          bestDate = candidate;
        }
      }

      const term = bestDate ? inferTerm(bestDate.month) : null;
      const termLabel = bestDate && term ? `Term ${term} ${bestDate.year}` : null;
      const fallbackCreatedAt = bundle.papers.reduce((latest, paper) => {
        const time = paper.createdAt ? Date.parse(paper.createdAt) : 0;
        return time > latest ? time : latest;
      }, 0);

      return {
        groupId: bundle.groupId,
        bundleLabel: bundle.bundleLabel,
        dateLabel: bestDate ? formatDateLabel(bestDate) : bundle.dateLabel,
        termLabel,
        sortTime: bestDate
          ? Date.UTC(bestDate.year, bestDate.month - 1, bestDate.day)
          : fallbackCreatedAt,
        variantCount: bundle.papers.length,
        papers: bundle.papers.sort((a, b) => {
          const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
          const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
          return bTime - aTime;
        }),
      };
    })
    .sort((a, b) => {
      if (a.groupId === 1 && b.groupId !== 1) return 1;
      if (b.groupId === 1 && a.groupId !== 1) return -1;
      if (a.sortTime !== b.sortTime) return b.sortTime - a.sortTime;
      return b.groupId - a.groupId;
    })
    .map((bundle) => ({
      groupId: bundle.groupId,
      bundleLabel: bundle.bundleLabel,
      dateLabel: bundle.dateLabel,
      termLabel: bundle.termLabel,
      variantCount: bundle.variantCount,
      papers: bundle.papers,
    }));
}
