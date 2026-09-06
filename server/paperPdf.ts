import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  getQuestionStats,
  type QuizQuestion,
} from '../src/lib/dataTransforms';
import { getOptionImageUrl, getQuestionImageUrl, imageSourceFallbacks } from '../src/lib/imageUtils';
import { inferTerm, parseBundleDate } from './paperCatalogue';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export interface PaperPdfMeta {
  courseName: string;
  examName: string;
  paperName: string;
  paperDescription: string;
  year: number | null;
}

export interface PrintQuestion extends QuizQuestion {
  subQuestions?: QuizQuestion[];
}

export function groupQuestionsForPdf(questions: QuizQuestion[]): PrintQuestion[] {
  const childrenByParent = new Map<string, QuizQuestion[]>();
  for (const question of questions) {
    if (!question.parentQuestionUuid) continue;
    const list = childrenByParent.get(question.parentQuestionUuid) ?? [];
    list.push(question);
    childrenByParent.set(question.parentQuestionUuid, list);
  }

  const top: Array<PrintQuestion & { sort: number }> = [];
  for (const question of questions) {
    if (question.parentQuestionUuid) continue;
    if (question.questionType === 'COMPREHENSION') {
      const kids = childrenByParent.get(question.uuid) ?? [];
      const firstChild = kids[0]?.questionNumber ?? question.questionNumber;
      top.push({ ...question, subQuestions: kids, sort: firstChild - 0.5 });
    } else {
      top.push({ ...question, sort: question.questionNumber });
    }
  }

  return top.sort((left, right) => left.sort - right.sort);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function decodeHtmlEntities(text: string) {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    nbsp: ' ',
    quot: '"',
    lt: '<',
    gt: '>',
    times: '×',
    minus: '−',
    le: '≤',
    deg: '°',
  };

  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, value: string) => {
    const lower = value.toLowerCase();
    if (lower.startsWith('#x')) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    if (lower.startsWith('#')) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    return named[lower] ?? entity;
  });
}

function markupToHtml(raw: string) {
  if (/image content will be provided separately/i.test(raw)) {
    return '<em class="missing">Option image missing in source</em>';
  }

  const withBreaks = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<\/?p>/gi, '');

  const withMarkdownish = withBreaks
    .replace(/<b>(.*?)<\/b>/gis, '**$1**')
    .replace(/<strong>(.*?)<\/strong>/gis, '**$1**')
    .replace(/<i>(.*?)<\/i>/gis, '*$1*')
    .replace(/<em>(.*?)<\/em>/gis, '*$1*');

  const stripped = withMarkdownish.replace(/<[^>]+>/g, '');
  const decoded = decodeHtmlEntities(stripped).trim();
  if (!decoded) {
    return '<em class="missing">Option image missing in source</em>';
  }

  const looksLikeSql =
    /CREATE\s+TABLE/i.test(decoded) ||
    /SELECT\s+.+\s+FROM/i.test(decoded) ||
    /INSERT\s+INTO/i.test(decoded) ||
    /WITH\s+\w+\s+AS/i.test(decoded);
  if (looksLikeSql) {
    return `<pre class="sql">${escapeHtml(decoded)}</pre>`;
  }

  return escapeHtml(decoded)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replaceAll('\n', '<br>');
}

function typeLabel(type: string) {
  if (type === 'COMPREHENSION') return 'Passage';
  if (type === 'SA') return 'Short answer';
  if (type === 'MSQ') return 'MSQ';
  if (type === 'OPPE') return 'OPPE';
  return 'MCQ';
}

function paperBits(paper: PaperPdfMeta) {
  const date =
    parseBundleDate(paper.paperName) ?? parseBundleDate(paper.paperDescription);
  const term = date ? inferTerm(date.month) : null;
  const termLabel =
    date && term ? `Term ${term} ${date.year}` : paper.year ? `Year ${paper.year}` : null;
  const dateLabel = date
    ? new Date(Date.UTC(date.year, date.month - 1, date.day)).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : null;
  return [paper.examName, termLabel, dateLabel].filter(Boolean).join(' · ');
}

function imageTag(src: string | undefined, alt: string) {
  if (!src) return '';
  return `<img class="figure" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`;
}

const FIGURE_TAG_RE = /<img class="figure" src="([^"]*)" alt="([^"]*)">/g;
const IMAGE_FETCH_TIMEOUT_MS = 15_000;
const IMAGE_FETCH_CONCURRENCY = 6;
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

function unescapeHtmlAttr(value: string) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

export function collectFigureSrcs(html: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(new RegExp(FIGURE_TAG_RE, 'g'))) {
    const src = unescapeHtmlAttr(match[1] ?? '');
    if (!src || src.startsWith('data:') || src.startsWith('file:') || seen.has(src)) continue;
    seen.add(src);
    found.push(src);
  }
  return found;
}

function extensionFor(contentType: string, url: string): string {
  const type = contentType.toLowerCase();
  if (type.includes('png')) return '.png';
  if (type.includes('jpeg') || type.includes('jpg')) return '.jpg';
  if (type.includes('webp')) return '.webp';
  if (type.includes('gif')) return '.gif';
  if (type.includes('svg')) return '.svg';
  const fromUrl = url.split('?')[0]?.split('.').pop()?.toLowerCase();
  if (fromUrl && /^[a-z0-9]{2,4}$/.test(fromUrl)) return `.${fromUrl}`;
  return '.png';
}

export type FetchPdfImage = (
  url: string,
) => Promise<{ bytes: Uint8Array; contentType: string } | null>;

async function fetchOnePdfImage(url: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType && !contentType.startsWith('image/') && !contentType.includes('octet-stream')) {
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > IMAGE_MAX_BYTES) return null;
    return { bytes, contentType };
  } catch (error) {
    console.warn('pdf image fetch failed', { url, error: error instanceof Error ? error.message : error });
    return null;
  }
}

async function defaultFetchPdfImage(url: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  for (const candidate of imageSourceFallbacks(url)) {
    const image = await fetchOnePdfImage(candidate);
    if (image) return image;
  }
  return null;
}

async function mapPool<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!, index);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) || 0 }, () => run());
  await Promise.all(workers);
  return results;
}

export async function localizeHtmlImages(
  html: string,
  destDir: string,
  fetchImage: FetchPdfImage = defaultFetchPdfImage,
): Promise<{ html: string; fetched: number; failed: number; total: number }> {
  const srcs = collectFigureSrcs(html);
  if (srcs.length === 0) {
    return { html, fetched: 0, failed: 0, total: 0 };
  }

  const resolved = new Map<string, string | null>();
  await mapPool(srcs, IMAGE_FETCH_CONCURRENCY, async (src, index) => {
    const image = await fetchImage(src);
    if (!image) {
      resolved.set(src, null);
      return;
    }
    const filename = `img-${String(index + 1).padStart(3, '0')}${extensionFor(image.contentType, src)}`;
    writeFileSync(path.join(destDir, filename), image.bytes);
    resolved.set(src, filename);
  });

  const rewritten = html.replace(new RegExp(FIGURE_TAG_RE, 'g'), (_all, rawSrc: string, rawAlt: string) => {
    const src = unescapeHtmlAttr(rawSrc);
    const local = resolved.get(src);
    if (local) return `<img class="figure" src="${escapeHtml(local)}" alt="${rawAlt}">`;
    return `<em class="missing">Figure failed to load</em>`;
  });

  const failed = [...resolved.values()].filter((value) => value === null).length;
  return { html: rewritten, fetched: srcs.length - failed, failed, total: srcs.length };
}

function renderMedia(question: QuizQuestion, altPrefix: string) {
  const parts: string[] = [];
  const texts = [
    question.questionText1,
    question.questionText2,
    question.questionText3,
    question.questionText4,
    question.questionText5,
  ];
  const images = [
    question.questionImage1,
    question.questionImage2,
    question.questionImage3,
    question.questionImage4,
    question.questionImage5,
    question.questionImage6,
    question.questionImage7,
    question.questionImage8,
    question.questionImage9,
    question.questionImage10,
  ];
  const max = Math.max(texts.length, images.length);
  for (let i = 0; i < max; i++) {
    const text = texts[i]?.trim();
    if (text) parts.push(`<div class="stem">${markupToHtml(text)}</div>`);
    const src = getQuestionImageUrl(images[i]);
    if (src) parts.push(imageTag(src, `${altPrefix} ${i + 1}`));
  }
  return parts.join('');
}

function renderOptions(question: QuizQuestion, showAnswers: boolean) {
  if (question.questionType === 'SA' || question.questionType === 'OPPE') {
    if (showAnswers && question.valueStart) {
      const range = question.valueEnd ? ` to ${escapeHtml(question.valueEnd)}` : '';
      return `<p class="key">Answer: <strong>${escapeHtml(question.valueStart)}</strong>${range}</p>`;
    }
    return `<p class="blank">Answer: ____________________</p>`;
  }

  if (question.options.length === 0) return '';

  const items = question.options.map((option, index) => {
    const label = OPTION_LABELS[index] ?? String(index + 1);
    const text = option.optionText?.trim() ?? '';
    const imageSrc = getOptionImageUrl(option.optionImage || undefined);
    const correct = showAnswers && option.isCorrect === 1;
    const body: string[] = [];
    if (text) body.push(markupToHtml(text));
    if (imageSrc) body.push(imageTag(imageSrc, `Option ${label}`));
    if (body.length === 0) body.push('<em class="missing">Empty option</em>');
    return `<li class="${correct ? 'correct' : ''}"><span class="opt">${label}</span><div class="opt-body">${body.join('')}</div></li>`;
  });

  const hint = question.questionType === 'MSQ' ? '<p class="hint">Select all that apply.</p>' : '';
  return `${hint}<ol class="options">${items.join('')}</ol>`;
}

function renderQuestion(question: PrintQuestion, showAnswers: boolean): string {
  const isPassage = question.questionType === 'COMPREHENSION';
  const number = isPassage || question.questionNumber <= 0 ? null : question.questionNumber;
  const marks = parseFloat(question.totalMark);
  const markLabel =
    !isPassage && marks > 0
      ? `${marks % 1 === 0 ? marks.toFixed(0) : marks} mark${marks === 1 ? '' : 's'}`
      : '';
  const heading = number ? `Q${number}` : isPassage ? 'Passage' : 'Question';
  const sub = (question.subQuestions ?? [])
    .map((child) => renderQuestion(child, showAnswers))
    .join('');

  return `
<article class="q ${isPassage ? 'passage' : ''}">
  <header class="q-head">
    <span class="q-num">${heading}</span>
    <span class="q-type">${typeLabel(question.questionType)}</span>
    ${markLabel ? `<span class="q-marks">${markLabel}</span>` : ''}
  </header>
  ${renderMedia(question, heading)}
  ${renderOptions(question, showAnswers)}
  ${sub}
</article>`;
}

function documentCss() {
  return `
    @page { size: A4; margin: 14mm 14mm 16mm 14mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      color: #111;
      background: #fff;
      font: 11pt/1.45 "Source Serif 4", "Iowan Old Style", Palatino, Georgia, serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet { max-width: 180mm; }
    .mast {
      border-bottom: 1.5pt solid #111;
      padding-bottom: 8pt;
      margin-bottom: 14pt;
    }
    .kicker {
      margin: 0 0 2pt;
      font: 8pt/1.2 ui-sans-serif, system-ui, sans-serif;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #444;
    }
    h1 { margin: 0; font-size: 18pt; font-weight: 650; letter-spacing: -0.02em; }
    .meta, .counts { margin: 2pt 0 0; font: 10pt/1.3 ui-sans-serif, system-ui, sans-serif; color: #222; }
    .disclaimer {
      margin: 8pt 0 0;
      font: 8.5pt/1.3 ui-sans-serif, system-ui, sans-serif;
      color: #555;
    }
    .q {
      margin: 0 0 13pt;
      padding: 0 0 11pt;
      border-bottom: 0.4pt solid #ddd;
    }
    .q-head {
      display: flex;
      gap: 8pt;
      align-items: baseline;
      margin-bottom: 6pt;
      break-after: avoid;
    }
    .q-num { font: 700 11pt ui-sans-serif, system-ui, sans-serif; }
    .q-type, .q-marks {
      font: 8pt/1 ui-sans-serif, system-ui, sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #555;
    }
    .stem { margin: 0 0 6pt; }
    img.figure {
      display: block;
      max-width: 100%;
      max-height: 78mm;
      height: auto;
      margin: 6pt 0 8pt;
      object-fit: contain;
      break-inside: avoid;
    }
    .opt-body img.figure { max-height: 42mm; margin: 2pt 0; }
    .options { list-style: none; margin: 6pt 0 0; padding: 0; }
    .options li {
      display: flex;
      gap: 8pt;
      align-items: flex-start;
      margin: 0 0 5pt;
      padding: 4pt 6pt;
      break-inside: avoid;
    }
    .options li.correct { background: #eef7ee; outline: 0.6pt solid #1b7a2c; }
    .opt {
      flex: 0 0 16pt;
      height: 16pt;
      border: 0.8pt solid #222;
      display: flex;
      align-items: center;
      justify-content: center;
      font: 8pt/1 ui-sans-serif, system-ui, sans-serif;
      font-weight: 700;
    }
    .options li.correct .opt { background: #1b7a2c; color: #fff; border-color: #1b7a2c; }
    .opt-body { flex: 1; min-width: 0; }
    .sql {
      margin: 0;
      white-space: pre-wrap;
      font: 8pt/1.35 ui-monospace, "SF Mono", Menlo, monospace;
      background: #f6f6f4;
      padding: 6pt 7pt;
      border: 0.4pt solid #ddd;
    }
    .hint, .blank, .key { font: 9.5pt/1.3 ui-sans-serif, system-ui, sans-serif; color: #333; }
    .key { color: #145c24; }
    .missing { color: #9b1c1c; font-style: italic; }
    .passage > .q {
      margin-top: 10pt;
      padding-left: 8pt;
      border-left: 1.5pt solid #bbb;
      border-bottom: 0.4pt solid #ddd;
    }
  `;
}

export function renderPaperHtml(
  paper: PaperPdfMeta,
  questions: QuizQuestion[],
  showAnswers: boolean,
) {
  const grouped = groupQuestionsForPdf(questions);
  const stats = getQuestionStats(
    grouped.flatMap((question) => [question, ...(question.subQuestions ?? [])]),
  );
  const bits = paperBits(paper);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(paper.courseName)} ${escapeHtml(paper.examName)}${showAnswers ? ' (answers)' : ''}</title>
  <style>${documentCss()}</style>
</head>
<body>
  <div class="sheet">
    <header class="mast">
      <p class="kicker">Praxis reconstruction${showAnswers ? ' · answer key' : ''}</p>
      <h1>${escapeHtml(paper.courseName)}</h1>
      <p class="meta">${escapeHtml(bits)}</p>
      <p class="counts">${stats.answerableCount} questions · ${stats.totalMarks} marks</p>
      <p class="disclaimer">Reconstructed from Praxis data. Not an official IIT Madras question paper. Source name: ${escapeHtml(paper.paperName)}.</p>
    </header>
    ${grouped.map((question) => renderQuestion(question, showAnswers)).join('\n')}
  </div>
</body>
</html>`;
}

export function pdfDownloadFilename(paper: PaperPdfMeta, showAnswers: boolean) {
  const base = `${paper.courseName}-${paper.examName}`
    .replaceAll(/[^a-zA-Z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || 'paper'}${showAnswers ? '-answers' : ''}.pdf`;
}

function chromiumCandidates() {
  const envPath = process.env.CHROMIUM_PATH?.trim();
  const home = homedir();
  return [
    envPath,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    path.join(home, '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'),
    path.join(home, '.cache/ms-playwright/chromium-1228/chrome-linux64/chrome'),
  ].filter((value): value is string => Boolean(value));
}

export function resolveChromiumPath() {
  return chromiumCandidates().find((candidate) => existsSync(candidate)) ?? null;
}

export async function printHtmlToPdf(html: string): Promise<Uint8Array> {
  const chromium = resolveChromiumPath();
  if (!chromium) {
    throw new Error('Chromium is not installed; cannot render paper PDFs');
  }

  const dir = mkdtempSync(path.join(tmpdir(), 'praxis-pdf-'));
  const htmlPath = path.join(dir, 'paper.html');
  const pdfPath = path.join(dir, 'paper.pdf');

  try {
    const localized = await localizeHtmlImages(html, dir);
    console.info('pdf images localized', {
      fetched: localized.fetched,
      failed: localized.failed,
      total: localized.total,
    });
    writeFileSync(htmlPath, localized.html);

    const result = spawnSync(
      chromium,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--hide-scrollbars',
        '--no-pdf-header-footer',
        '--allow-file-access-from-files',
        '--run-all-compositor-stages-before-draw',
        '--virtual-time-budget=20000',
        `--print-to-pdf=${pdfPath}`,
        `file://${htmlPath}`,
      ],
      { encoding: 'utf8', timeout: 60000 },
    );

    if (result.status !== 0 || !existsSync(pdfPath)) {
      throw new Error(
        `Chromium PDF print failed (${result.status}): ${result.stderr || result.stdout || 'no output'}`,
      );
    }

    return readFileSync(pdfPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
