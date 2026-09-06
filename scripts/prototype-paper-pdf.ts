/**
 * PROTOTYPE — throwaway paper PDF renderer. Not production.
 *
 * Question this answers: can we reconstruct a printable question paper
 * from data-new JSON + images-new, well enough that a student could use it?
 *
 * Default target: DBMS Quiz 1, 15 Mar 2026 (Term 1 2026).
 *
 *   bun run proto:paper-pdf
 *   bun run proto:paper-pdf -- --paper "data-new/Quiz 1/DBMS/<uuid>.json"
 *   bun run proto:paper-pdf -- --answers-only
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  getQuestionStats,
  shouldIncludeQuestion,
  transformRawQuestion,
  type QuizQuestion,
  type RawPaperFile,
} from '../src/lib/dataTransforms';
import { inferTerm, parseBundleDate } from '../server/paperCatalogue';

const ROOT = process.cwd();
const DEFAULT_PAPER = path.join(ROOT, 'data-new/Quiz 1/DBMS/64621c74-361.json');
const IMAGES_ROOT = path.join(ROOT, 'images-new');
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

type Args = {
  paperPath: string;
  outDir: string;
  questions: boolean;
  answers: boolean;
};

type ResolvedImage = {
  src: string;
  kind: 'figure' | 'inline';
  missing: boolean;
  filename: string;
};

type PrintQuestion = QuizQuestion & { subQuestions?: QuizQuestion[] };

function parseArgs(argv: string[]): Args {
  const args: Args = {
    paperPath: DEFAULT_PAPER,
    outDir: path.join(ROOT, 'tmp/paper-pdf'),
    questions: true,
    answers: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--paper') args.paperPath = path.resolve(argv[++i] ?? DEFAULT_PAPER);
    else if (token === '--out') args.outDir = path.resolve(argv[++i] ?? args.outDir);
    else if (token === '--answers-only') {
      args.questions = false;
      args.answers = true;
    } else if (token === '--questions-only') {
      args.questions = true;
      args.answers = false;
    }
  }

  return args;
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

  const escaped = escapeHtml(decoded)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');

  const looksLikeSql =
    /CREATE\s+TABLE/i.test(decoded) ||
    /SELECT\s+.+\s+FROM/i.test(decoded) ||
    /INSERT\s+INTO/i.test(decoded) ||
    /WITH\s+\w+\s+AS/i.test(decoded);
  if (looksLikeSql) {
    return `<pre class="sql">${escapeHtml(decoded)}</pre>`;
  }

  return escaped.replaceAll('\n', '<br>');
}

function pngSize(filePath: string): { width: number; height: number } | null {
  const buf = readFileSync(filePath);
  if (buf.length < 24 || buf[0] !== 0x89) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function resolveImageFile(filename: string | undefined, kind: 'question' | 'option') {
  if (!filename) return null;
  const folder = kind === 'question' ? 'question_images' : 'option_images';
  const primary = path.join(IMAGES_ROOT, folder, filename);
  if (existsSync(primary)) return primary;
  const other = path.join(
    IMAGES_ROOT,
    kind === 'question' ? 'option_images' : 'question_images',
    filename,
  );
  if (existsSync(other)) return other;
  return null;
}

function groupInSourceOrder(questions: QuizQuestion[]): PrintQuestion[] {
  const children = new Map<string, QuizQuestion[]>();
  for (const question of questions) {
    if (!question.parentQuestionUuid) continue;
    const list = children.get(question.parentQuestionUuid) ?? [];
    list.push(question);
    children.set(question.parentQuestionUuid, list);
  }

  const grouped: PrintQuestion[] = [];
  for (const question of questions) {
    if (question.parentQuestionUuid) continue;
    if (question.questionType === 'COMPREHENSION') {
      grouped.push({ ...question, subQuestions: children.get(question.uuid) ?? [] });
    } else {
      grouped.push(question);
    }
  }
  return grouped;
}

function paperMeta(paper: RawPaperFile) {
  const date =
    parseBundleDate(paper.question_paper_name) ??
    parseBundleDate(paper.question_paper_description);
  const term = date ? inferTerm(date.month) : null;
  const termLabel = date && term ? `Term ${term} ${date.year}` : paper.year ? `Year ${paper.year}` : null;
  const dateLabel = date
    ? new Date(Date.UTC(date.year, date.month - 1, date.day)).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : null;

  return {
    course: paper.course?.course_name ?? paper.questions[0]?.course?.course_name ?? 'Course',
    exam: paper.exam.exam_name,
    title: paper.question_paper_name,
    termLabel,
    dateLabel,
  };
}

function typeLabel(type: string) {
  if (type === 'COMPREHENSION') return 'Passage';
  if (type === 'SA') return 'Short answer';
  if (type === 'MSQ') return 'MSQ';
  if (type === 'OPPE') return 'OPPE';
  return 'MCQ';
}

function buildImageResolver(assetDir: string) {
  let counter = 0;
  const missing: string[] = [];

  return {
    missing,
    resolve(filename: string | undefined, kind: 'question' | 'option'): ResolvedImage | null {
      if (!filename) return null;
      const source = resolveImageFile(filename, kind);
      if (!source) {
        missing.push(`${kind}:${filename}`);
        return { src: '', kind: 'figure', missing: true, filename };
      }

      counter += 1;
      const ext = path.extname(source) || '.png';
      const destName = `${kind}-${String(counter).padStart(3, '0')}${ext}`;
      copyFileSync(source, path.join(assetDir, destName));
      const size = pngSize(source);
      const isInlineMath = Boolean(size && size.height <= 32 && size.width <= 120);
      return {
        src: `assets/${destName}`,
        kind: kind === 'option' || !isInlineMath ? 'figure' : 'inline',
        missing: false,
        filename,
      };
    },
  };
}

function renderMedia(
  question: QuizQuestion,
  resolver: ReturnType<typeof buildImageResolver>,
  altPrefix: string,
) {
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
    const image = resolver.resolve(images[i], 'question');
    if (!image) continue;
    if (image.missing) {
      parts.push(`<p class="missing">Missing image: ${escapeHtml(image.filename)}</p>`);
      continue;
    }
    parts.push(
      `<img class="${image.kind}" src="${image.src}" alt="${escapeHtml(`${altPrefix} ${i + 1}`)}">`,
    );
  }

  return parts.join('');
}

function renderOptions(question: QuizQuestion, resolver: ReturnType<typeof buildImageResolver>, showAnswers: boolean) {
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
    const image = resolver.resolve(option.optionImage, 'option');
    const text = option.optionText?.trim() ?? '';
    const correct = showAnswers && option.isCorrect === 1;
    const body: string[] = [];
    if (text) body.push(markupToHtml(text));
    if (image?.missing) body.push(`<em class="missing">Missing option image: ${escapeHtml(image.filename)}</em>`);
    else if (image) {
      body.push(`<img class="${image.kind}" src="${image.src}" alt="Option ${label}">`);
    }
    if (body.length === 0) body.push('<em class="missing">Empty option</em>');

    return `<li class="${correct ? 'correct' : ''}"><span class="opt">${label}</span><div class="opt-body">${body.join('')}</div></li>`;
  });

  const hint = question.questionType === 'MSQ' ? '<p class="hint">Select all that apply.</p>' : '';
  return `${hint}<ol class="options">${items.join('')}</ol>`;
}

function renderQuestion(
  question: PrintQuestion,
  resolver: ReturnType<typeof buildImageResolver>,
  showAnswers: boolean,
) {
  const isPassage = question.questionType === 'COMPREHENSION';
  const number = isPassage || question.questionNumber <= 0 ? null : question.questionNumber;
  const marks = parseFloat(question.totalMark);
  const markLabel = !isPassage && marks > 0 ? `${marks % 1 === 0 ? marks.toFixed(0) : marks} mark${marks === 1 ? '' : 's'}` : '';

  const heading = number
    ? `Q${number}`
    : isPassage
      ? 'Passage'
      : 'Question';

  const sub = (question.subQuestions ?? [])
    .map((child) => renderQuestion(child, resolver, showAnswers))
    .join('');

  return `
<article class="q ${isPassage ? 'passage' : ''}">
  <header class="q-head">
    <span class="q-num">${heading}</span>
    <span class="q-type">${typeLabel(question.questionType)}</span>
    ${markLabel ? `<span class="q-marks">${markLabel}</span>` : ''}
  </header>
  ${renderMedia(question, resolver, heading)}
  ${renderOptions(question, resolver, showAnswers)}
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
    .q-head { break-after: avoid; }
    .q:last-child { border-bottom: 0; }
    .q-head { display: flex; gap: 8pt; align-items: baseline; margin-bottom: 6pt; }
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
    img.inline { height: 1.15em; width: auto; vertical-align: middle; }
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
    .passage > .q { margin-top: 10pt; padding-left: 8pt; border-left: 1.5pt solid #bbb; border-bottom: 0.4pt solid #ddd; }
  `;
}

function renderHtml(paper: RawPaperFile, grouped: PrintQuestion[], showAnswers: boolean, resolver: ReturnType<typeof buildImageResolver>) {
  const meta = paperMeta(paper);
  const stats = getQuestionStats(grouped.flatMap((question) => [question, ...(question.subQuestions ?? [])]));
  const bits = [meta.exam, meta.termLabel, meta.dateLabel].filter(Boolean).join(' · ');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(meta.course)} ${escapeHtml(meta.exam)}${showAnswers ? ' (answers)' : ''}</title>
  <style>${documentCss()}</style>
</head>
<body>
  <div class="sheet">
    <header class="mast">
      <p class="kicker">Praxis reconstruction${showAnswers ? ' · answer key' : ''}</p>
      <h1>${escapeHtml(meta.course)}</h1>
      <p class="meta">${escapeHtml(bits)}</p>
      <p class="counts">${stats.answerableCount} questions · ${stats.totalMarks} marks</p>
      <p class="disclaimer">Reconstructed from Praxis data. Not an official IIT Madras question paper. Source name: ${escapeHtml(meta.title)}.</p>
    </header>
    ${grouped.map((question) => renderQuestion(question, resolver, showAnswers)).join('\n')}
  </div>
</body>
</html>`;
}

function printPdf(htmlPath: string, pdfPath: string) {
  const result = spawnSync(
    'playwright',
    ['pdf', '--paper-format', 'A4', '--color-scheme', 'light', '--timeout', '60000', `file://${htmlPath}`, pdfPath],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    throw new Error(`playwright pdf failed with status ${result.status}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.paperPath)) {
    throw new Error(`Paper JSON not found: ${args.paperPath}`);
  }

  const paper = JSON.parse(readFileSync(args.paperPath, 'utf8')) as RawPaperFile;
  const questions = (paper.questions ?? [])
    .filter(shouldIncludeQuestion)
    .map(transformRawQuestion);
  const grouped = groupInSourceOrder(questions);

  rmSync(args.outDir, { recursive: true, force: true });
  const assetDir = path.join(args.outDir, 'assets');
  mkdirSync(assetDir, { recursive: true });

  const jobs: Array<{ name: string; answers: boolean }> = [];
  if (args.questions) jobs.push({ name: 'paper', answers: false });
  if (args.answers) jobs.push({ name: 'paper-answers', answers: true });

  for (const job of jobs) {
    const resolver = buildImageResolver(assetDir);
    const html = renderHtml(paper, grouped, job.answers, resolver);
    if (resolver.missing.length > 0) {
      console.error('Missing images:');
      for (const item of resolver.missing) console.error(`  ${item}`);
      throw new Error(`${resolver.missing.length} image(s) missing. Refusing to emit a broken paper.`);
    }

    const htmlPath = path.join(args.outDir, `${job.name}.html`);
    const pdfPath = path.join(args.outDir, `${job.name}.pdf`);
    writeFileSync(htmlPath, html);
    printPdf(htmlPath, pdfPath);
    console.log(`wrote ${pdfPath}`);
  }

  const stats = getQuestionStats(questions);
  const meta = paperMeta(paper);
  console.log(
    JSON.stringify(
      {
        course: meta.course,
        exam: meta.exam,
        term: meta.termLabel,
        date: meta.dateLabel,
        questions: stats.answerableCount,
        marks: stats.totalMarks,
        source: path.relative(ROOT, args.paperPath),
        out: path.relative(ROOT, args.outDir),
      },
      null,
      2,
    ),
  );
}

main();
