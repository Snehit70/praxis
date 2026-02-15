/**
 * Paper name parsing and formatting utilities
 * 
 * Raw paper names from source follow patterns like:
 * - "IIT M FOUNDATION AN EXAM QDF2 26 Oct"
 * - "IIT M IMPROVEMENT AN EXAM QIO2 13 July"
 * - "IIT M DIPLOMA AN2 EXAM QDD4 25 Feb 2024"
 * - "2024 July07: IIT M AN EXAM QDD4"
 */

interface ParsedPaperName {
  examType: 'Foundation' | 'Diploma' | 'Improvement' | 'Qualifier' | 'Regular';
  setNumber: number | null;
  date: string | null;
  year: number | null;
  month: string | null;
  attempt: number | null;
  raw: string;
}

const MONTH_MAP: Record<string, string> = {
  'jan': 'January',
  'feb': 'February',
  'mar': 'March',
  'apr': 'April',
  'may': 'May',
  'jun': 'June',
  'jul': 'July',
  'aug': 'August',
  'sep': 'September',
  'oct': 'October',
  'nov': 'November',
  'dec': 'December',
};

function normalizeMonth(monthStr: string): string | null {
  const lower = monthStr.toLowerCase().slice(0, 3);
  return MONTH_MAP[lower] || null;
}

export function parsePaperName(rawName: string): ParsedPaperName {
  const result: ParsedPaperName = {
    examType: 'Regular',
    setNumber: null,
    date: null,
    year: null,
    month: null,
    attempt: null,
    raw: rawName,
  };

  const upper = rawName.toUpperCase();

  // Detect exam type
  if (upper.includes('FOUNDATION')) {
    result.examType = 'Foundation';
  } else if (upper.includes('DIPLOMA')) {
    result.examType = 'Diploma';
  } else if (upper.includes('IMPROVEMENT')) {
    result.examType = 'Improvement';
  } else if (upper.includes('QUALIFIER')) {
    result.examType = 'Qualifier';
  }

  const attemptMatch = upper.match(/AN(\d)/);
  if (attemptMatch?.[1]) {
    result.attempt = parseInt(attemptMatch[1], 10);
  }

  const setMatch = upper.match(/Q[A-Z]{1,2}[A-Z](\d)/);
  if (setMatch?.[1]) {
    result.setNumber = parseInt(setMatch[1], 10);
  }

  const yearMatch = rawName.match(/\b(20\d{2})\b/);
  if (yearMatch?.[1]) {
    result.year = parseInt(yearMatch[1], 10);
  }

  const monthMatch = rawName.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i);
  if (monthMatch?.[1]) {
    result.month = normalizeMonth(monthMatch[1]);
  }

  // Build date string
  if (result.month && result.year) {
    result.date = `${result.month} ${result.year}`;
  } else if (result.month) {
    result.date = result.month;
  }

  return result;
}

export function formatPaperName(rawName: string, paperYear?: number): string {
  const parsed = parsePaperName(rawName);
  
  const parts: string[] = [];

  // Add exam type if not regular
  if (parsed.examType !== 'Regular') {
    parts.push(parsed.examType);
  }

  // Add attempt if specified
  if (parsed.attempt && parsed.attempt > 1) {
    parts.push(`Attempt ${parsed.attempt}`);
  }

  // Add set number
  if (parsed.setNumber) {
    parts.push(`Set ${parsed.setNumber}`);
  }

  // Add date
  if (parsed.date) {
    parts.push(`- ${parsed.date}`);
  } else if (parsed.month) {
    const year = parsed.year || paperYear;
    parts.push(`- ${parsed.month}${year ? ` ${year}` : ''}`);
  } else if (paperYear) {
    parts.push(`- ${paperYear}`);
  }

  // Fallback if we couldn't parse anything useful
  if (parts.length === 0) {
    // Try to extract just the meaningful part
    const cleaned = rawName
      .replace(/^IIT\s*M\s*/i, '')
      .replace(/\s*AN\s*EXAM\s*/i, ' ')
      .replace(/\s*EXAM\s*/i, ' ')
      .replace(/Q[A-Z]{2,3}\d?\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    return cleaned || rawName;
  }

  return parts.join(' ');
}

export function formatPaperDescription(rawDescription: string): string {
  const match = rawDescription.match(/^(\d{4})\s+([A-Za-z]+)(\d+)?:/);
  if (match?.[1] && match[2]) {
    const year = match[1];
    const month = normalizeMonth(match[2]) || match[2];
    const day = match[3] || '';
    return `${month}${day ? ` ${day}` : ''}, ${year}`;
  }
  return rawDescription;
}

export interface PaperStats {
  questionCount: number;
  totalMarks: number;
  estimatedDuration: number;
}

export function calculatePaperStats(questions: Array<{ total_mark?: string; totalMark?: string }>): PaperStats {
  const questionCount = questions.length;
  
  const totalMarks = questions.reduce((sum, q) => {
    const mark = parseFloat(q.total_mark || q.totalMark || '0');
    return sum + (isNaN(mark) ? 0 : mark);
  }, 0);

  // Estimate duration: ~2-3 minutes per question for Quiz 1
  const estimatedDuration = Math.ceil(questionCount * 2.5);

  return {
    questionCount,
    totalMarks: Math.round(totalMarks),
    estimatedDuration,
  };
}
