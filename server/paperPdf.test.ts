import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import {
  collectFigureSrcs,
  groupQuestionsForPdf,
  localizeHtmlImages,
  pdfDownloadFilename,
  renderPaperHtml,
} from './paperPdf';
import type { QuizQuestion } from '../src/lib/dataTransforms';

function question(partial: Partial<QuizQuestion> & Pick<QuizQuestion, 'uuid' | 'questionNumber' | 'questionType'>): QuizQuestion {
  return {
    totalMark: '1',
    hash: 'h',
    isMarkdown: 0,
    haveAnswers: 1,
    questionNumLong: partial.questionNumber,
    options: [],
    ...partial,
  };
}

describe('groupQuestionsForPdf', () => {
  test('keeps a numbered passage just before its children, not at Q0', () => {
    const passage = question({
      uuid: 'pass',
      questionNumber: 0,
      questionType: 'COMPREHENSION',
      totalMark: '0',
    });
    const early = question({ uuid: 'q2', questionNumber: 2, questionType: 'MCQ' });
    const child = question({
      uuid: 'q15',
      questionNumber: 15,
      questionType: 'SA',
      parentQuestionUuid: 'pass',
    });

    const grouped = groupQuestionsForPdf([passage, early, child]);
    expect(grouped.map((item) => item.uuid)).toEqual(['q2', 'pass']);
    expect(grouped[1]?.subQuestions?.map((item) => item.uuid)).toEqual(['q15']);
  });
});

describe('renderPaperHtml', () => {
  test('marks the reconstruction and answer key', () => {
    const html = renderPaperHtml(
      {
        courseName: 'DBMS',
        examName: 'Quiz 1',
        paperName: 'Database Management Systems 15 Mar 26',
        paperDescription: 'Database Management Systems 15 Mar 26',
        year: 2026,
      },
      [
        question({
          uuid: 'q2',
          questionNumber: 2,
          questionType: 'MCQ',
          questionText1: 'Which language creates the schema?',
          options: [
            { optionText: 'DDL', score: '1', isCorrect: 1 },
            { optionText: 'DML', score: '0', isCorrect: 0 },
          ],
        }),
      ],
      true,
    );

    expect(html).toContain('Praxis reconstruction');
    expect(html).toContain('answer key');
    expect(html).toContain('Term 1 2026');
    expect(html).toContain('Q2');
    expect(html).toContain('class="correct"');
    expect(html).toContain('DDL');
  });

  test('points question figures at the R2 URL so print can localize them', () => {
    const html = renderPaperHtml(
      {
        courseName: 'DBMS',
        examName: 'Quiz 1',
        paperName: 'Database Management Systems 15 Mar 26',
        paperDescription: 'Database Management Systems 15 Mar 26',
        year: 2026,
      },
      [
        question({
          uuid: 'q3',
          questionNumber: 3,
          questionType: 'MSQ',
          questionImage1: 'fjbWN1nr4w7G6oeQxoFasj0ZUUIqXMpzXIeRSGzAnt2KA66F6C.png',
        }),
      ],
      false,
    );

    expect(html).toContain(
      'https://pub-38cbed42a577473eb75ea45c187c8d6f.r2.dev/question_images/fjbWN1nr4w7G6oeQxoFasj0ZUUIqXMpzXIeRSGzAnt2KA66F6C.png',
    );
    expect(html).toContain('alt="Q3 1"');
    expect(collectFigureSrcs(html)).toEqual([
      'https://pub-38cbed42a577473eb75ea45c187c8d6f.r2.dev/question_images/fjbWN1nr4w7G6oeQxoFasj0ZUUIqXMpzXIeRSGzAnt2KA66F6C.png',
    ]);
  });
});

describe('localizeHtmlImages', () => {
  const png = Uint8Array.from(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    ),
  );

  test('rewrites remote figures to local files next to the HTML', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'praxis-pdf-test-'));
    try {
      const remote =
        'https://pub-38cbed42a577473eb75ea45c187c8d6f.r2.dev/question_images/example.png';
      const html = `<img class="figure" src="${remote}" alt="Q3 1">`;
      const result = await localizeHtmlImages(html, dir, async (url) => {
        expect(url).toBe(remote);
        return { bytes: png, contentType: 'image/png' };
      });

      expect(result).toEqual({ html: '<img class="figure" src="img-001.png" alt="Q3 1">', fetched: 1, failed: 0, total: 1 });
      expect(readFileSync(path.join(dir, 'img-001.png'))).toEqual(Buffer.from(png));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('drops a figure that cannot be fetched instead of leaving a remote src', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'praxis-pdf-test-'));
    try {
      const html = `<img class="figure" src="https://example.test/missing.png" alt="Q6 1">`;
      const result = await localizeHtmlImages(html, dir, async () => null);
      expect(result.failed).toBe(1);
      expect(result.html).toContain('Figure failed to load');
      expect(result.html).not.toContain('https://example.test/missing.png');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('pdfDownloadFilename', () => {
  test('strips punctuation from the course and exam names', () => {
    expect(
      pdfDownloadFilename(
        {
          courseName: 'DBMS',
          examName: 'Quiz 1',
          paperName: 'x',
          paperDescription: 'x',
          year: 2026,
        },
        true,
      ),
    ).toBe('DBMS-Quiz-1-answers.pdf');
  });
});
