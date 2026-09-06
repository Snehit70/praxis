import { describe, expect, test } from 'bun:test';
import {
  groupQuestionsForPdf,
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
