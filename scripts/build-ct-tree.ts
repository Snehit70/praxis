import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type PaperIndexEntry = {
  uuid: string;
  group_id: number;
  question_paper_name: string;
  question_paper_description: string;
  year: number | null;
  created_at: string;
  duration: number;
  total_score: string;
  is_new: number;
};

type TermId = `${'jan' | 'may' | 'sep'}-${number}` | 'unknown';

const DATA_ROOT = path.join(process.cwd(), 'data-new');
const OUT_DIR = path.join(process.cwd(), 'docs');
const OUT_JSON = path.join(OUT_DIR, 'ct-question-paper-tree.json');
const OUT_MD = path.join(OUT_DIR, 'ct-question-paper-tree.md');
const EXAMS = ['Quiz 1', 'Quiz 2', 'End Term Quiz'] as const;

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function parseDateFromText(text: string, fallbackYear: number | null) {
  const yearFirst = text.match(/\b(20\d{2})\s+([A-Za-z]+)\s*(\d{1,2})?\b/);
  if (yearFirst?.[1] && yearFirst[2]) {
    const month = MONTHS[yearFirst[2].toLowerCase()];
    if (month) {
      return {
        year: Number(yearFirst[1]),
        month,
        day: yearFirst[3] ? Number(yearFirst[3]) : null,
        source: yearFirst[0],
      };
    }
  }

  const monthFirst = text.match(/\b(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2}|\d{2})\b/);
  if (monthFirst?.[1] && monthFirst[2] && monthFirst[3]) {
    const month = MONTHS[monthFirst[2].toLowerCase()];
    if (month) {
      const rawYear = Number(monthFirst[3]);
      return {
        year: rawYear < 100 ? 2000 + rawYear : rawYear,
        month,
        day: Number(monthFirst[1]),
        source: monthFirst[0],
      };
    }
  }

  const daylessMonthFirst = text.match(/\b([A-Za-z]+)\s+(20\d{2}|\d{2})\b/);
  if (daylessMonthFirst?.[1] && daylessMonthFirst[2]) {
    const month = MONTHS[daylessMonthFirst[1].toLowerCase()];
    if (month) {
      const rawYear = Number(daylessMonthFirst[2]);
      return {
        year: rawYear < 100 ? 2000 + rawYear : rawYear,
        month,
        day: null,
        source: daylessMonthFirst[0],
      };
    }
  }

  const daylessYearFirst = text.match(/\b(20\d{2})\s+([A-Za-z]+)\b/);
  if (daylessYearFirst?.[1] && daylessYearFirst[2]) {
    const month = MONTHS[daylessYearFirst[2].toLowerCase()];
    if (month) {
      return {
        year: Number(daylessYearFirst[1]),
        month,
        day: null,
        source: daylessYearFirst[0],
      };
    }
  }

  return { year: fallbackYear, month: null, day: null, source: null };
}

function dateScore(date: ReturnType<typeof parseDateFromText>) {
  if (!date.year || !date.month) return 0;
  return date.day ? 3 : 2;
}

type ParsedDate = ReturnType<typeof parseDateFromText>;

function parseDate(entry: PaperIndexEntry) {
  const fromName = parseDateFromText(entry.question_paper_name, entry.year);
  const fromDescription = parseDateFromText(entry.question_paper_description, entry.year);

  return dateScore(fromName) >= dateScore(fromDescription) ? fromName : fromDescription;
}

function compareParsedDates(left: ParsedDate, right: ParsedDate) {
  const scoreDiff = dateScore(right) - dateScore(left);
  if (scoreDiff !== 0) return scoreDiff;

  const leftTime = left.year && left.month
    ? Date.UTC(left.year, left.month - 1, left.day ?? 1)
    : 0;
  const rightTime = right.year && right.month
    ? Date.UTC(right.year, right.month - 1, right.day ?? 1)
    : 0;

  return rightTime - leftTime;
}

function bestBundleDate(entries: PaperIndexEntry[]) {
  const dates = entries.map(parseDate).sort(compareParsedDates);
  return dates[0] ?? { year: null, month: null, day: null, source: null };
}

function termFromDate(date: ReturnType<typeof parseDate>): TermId {
  if (!date.year || !date.month) return 'unknown';

  if (date.month >= 2 && date.month <= 5) return `jan-${date.year}`;
  if (date.month >= 6 && date.month <= 9) return `may-${date.year}`;
  if (date.month >= 10 && date.month <= 12) return `sep-${date.year}`;

  return `sep-${date.year - 1}`;
}

function formatDate(date: ReturnType<typeof parseDate>) {
  if (!date.year || !date.month) return 'Unknown date';

  const month = new Date(Date.UTC(date.year, date.month - 1, 1)).toLocaleString('en-IN', {
    month: 'long',
    timeZone: 'UTC',
  });

  return date.day ? `${date.day} ${month} ${date.year}` : `${month} ${date.year}`;
}

function termLabel(termId: TermId) {
  if (termId === 'unknown') return 'Unknown term';
  const [term, year] = termId.split('-');
  const label = term === 'jan' ? 'January' : term === 'may' ? 'May' : 'September';
  return `${label} ${year}`;
}

function paperCode(entry: PaperIndexEntry) {
  const source = `${entry.question_paper_name} ${entry.question_paper_description}`.toUpperCase();
  return source.match(/\bQ[A-Z]{2,3}\d\b/)?.[0] ?? null;
}

function buildTree() {
  return EXAMS.map((examName) => {
    const indexPath = path.join(DATA_ROOT, examName, 'CT', 'index.json');
    const entries = readJson<PaperIndexEntry[]>(indexPath);

    const bundleMap = new Map<string, {
      examName: string;
      groupId: number;
      dateLabel: string;
      termId: TermId;
      termLabel: string;
      parsedDateSource: string | null;
      papers: Array<PaperIndexEntry & { paperCode: string | null }>;
      warning?: string;
    }>();

    for (const entry of entries) {
      const isOthers = entry.group_id === 1;
      const date = isOthers
        ? { year: entry.year, month: null, day: null, source: null }
        : parseDate(entry);
      const termId = isOthers ? 'unknown' : termFromDate(date);
      const dateLabel = isOthers ? 'Others' : formatDate(date);
      const key = isOthers ? 'others:group-1' : `group-${entry.group_id}`;
      const current = bundleMap.get(key) ?? {
        examName,
        groupId: entry.group_id,
        dateLabel,
        termId,
        termLabel: termLabel(termId),
        parsedDateSource: date.source,
        papers: [],
      };

      current.papers.push({ ...entry, paperCode: paperCode(entry) });
      bundleMap.set(key, current);
    }

    const bundles = [...bundleMap.values()]
      .map((bundle) => ({
        ...bundle,
        papers: bundle.papers.sort((left, right) => right.created_at.localeCompare(left.created_at)),
      }))
      .map((bundle) => {
        if (bundle.groupId === 1) return bundle;

        const date = bestBundleDate(bundle.papers);
        const termId = termFromDate(date);
        return {
          ...bundle,
          dateLabel: formatDate(date),
          termId,
          termLabel: termLabel(termId),
          parsedDateSource: date.source,
        };
      })
      .sort((left, right) => {
        if (left.groupId === 1) return 1;
        if (right.groupId === 1) return -1;
        const newestLeft = left.papers[0]?.created_at ?? '';
        const newestRight = right.papers[0]?.created_at ?? '';
        return newestRight.localeCompare(newestLeft);
      });

    return {
      examName,
      courseName: 'CT',
      totalPapers: entries.length,
      totalBundles: bundles.length,
      bundles,
    };
  });
}

function renderMarkdown(tree: ReturnType<typeof buildTree>) {
  const lines: string[] = [
    '# CT Question Paper Tree',
    '',
    'Generated from `data-new/*/CT/index.json`.',
    '',
    'The source website appears to present CT papers as date/term bundles first, then paper variants inside each bundle. This report reconstructs that tree using parsed paper dates plus `group_id`.',
    '',
    '## Inference Rules',
    '',
    '- February-May dates map to the January term of that year.',
    '- June-September dates map to the May term of that year.',
    '- October-December dates map to the September term of that year.',
    '- January dates map to the previous year September term.',
    '- For source parity, `group_id` is the primary bundle key.',
    '- `group_id = 1` is treated as the source website `Others` bucket.',
    '- For non-`1` bundles, parse the best date from `question_paper_name` first, then `question_paper_description` as fallback.',
    '',
  ];

  for (const exam of tree) {
    lines.push(`## ${exam.examName}`, '');
    lines.push(`Total papers: ${exam.totalPapers}`);
    lines.push(`Total inferred bundles: ${exam.totalBundles}`, '');

    for (const bundle of exam.bundles) {
      lines.push(`### QP Bundle ${bundle.groupId}: ${bundle.dateLabel}`);
      lines.push('');
      lines.push(`- Term: ${bundle.termLabel}`);
      lines.push(`- Parsed from: ${bundle.parsedDateSource ?? 'not parsed'}`);
      lines.push(`- Variants: ${bundle.papers.length}`);
      if (bundle.warning) lines.push(`- Warning: ${bundle.warning}`);
      lines.push('');
      lines.push('| Code | UUID | Year | Name | Description |');
      lines.push('|---|---|---:|---|---|');
      for (const paper of bundle.papers) {
        lines.push(
          `| ${paper.paperCode ?? 'Unknown'} | \`${paper.uuid}\` | ${paper.year ?? 'null'} | ${paper.question_paper_name.replaceAll('|', '\\|')} | ${paper.question_paper_description.replaceAll('|', '\\|')} |`,
        );
      }
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

const tree = buildTree();
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_JSON, `${JSON.stringify(tree, null, 2)}\n`);
writeFileSync(OUT_MD, renderMarkdown(tree));

for (const exam of tree) {
  console.log(`${exam.examName}: ${exam.totalPapers} papers, ${exam.totalBundles} inferred bundles`);
}
console.log(`Wrote ${path.relative(process.cwd(), OUT_JSON)}`);
console.log(`Wrote ${path.relative(process.cwd(), OUT_MD)}`);
