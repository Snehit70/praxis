export type QuestionType = 'MCQ' | 'MSQ' | 'SA' | 'COMPREHENSION' | 'OPPE';

export interface RawExam {
  exam_name: string;
  uuid: string;
}

export interface RawCourse {
  course_name: string;
  course_code: string;
  program_id: number;
  uuid: string;
  label?: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RawExamMetadata {
  exam: RawExam;
  courses: RawCourse[];
}

export interface RawPaperIndexEntry {
  group_id: number;
  total_score: string;
  duration: number;
  created_at: string;
  updated_at: string;
  question_paper_name: string;
  question_paper_description: string;
  uuid: string;
  year: number;
  is_new: number;
}

export interface RawOption {
  option_text: string;
  option_image?: string | null;
  score: string;
  is_correct: number;
  option_number?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RawParentQuestion {
  uuid: string;
}

export interface RawQuestion {
  uuid: string;
  question_number: number;
  question_type: string;
  total_mark: string;
  hash: string;
  created_at?: string | null;
  updated_at?: string | null;
  question_text_1?: string | null;
  question_text_2?: string | null;
  question_text_3?: string | null;
  question_text_4?: string | null;
  question_text_5?: string | null;
  question_image_1?: string | null;
  question_image_2?: string | null;
  question_image_3?: string | null;
  question_image_4?: string | null;
  question_image_5?: string | null;
  question_image_6?: string | null;
  question_image_7?: string | null;
  question_image_8?: string | null;
  question_image_9?: string | null;
  question_image_10?: string | null;
  answer_type?: string | null;
  response_type?: string | null;
  value_start?: string | null;
  value_end?: string | null;
  parent_question_id?: number | null;
  parent_question?: RawParentQuestion | null;
  course?: RawCourse;
  is_markdown: number;
  have_answers: number;
  question_num_long: number;
  options?: RawOption[];
}

export interface RawPaperFile extends RawPaperIndexEntry {
  exam: RawExam;
  course?: RawCourse;
  questions: RawQuestion[];
}

export interface QuizOption {
  optionText: string;
  optionImage?: string;
  score: string;
  isCorrect: number;
  optionNumber?: number;
}

export interface QuizQuestion {
  uuid: string;
  questionNumber: number;
  questionType: QuestionType;
  totalMark: string;
  hash: string;
  questionText1?: string;
  questionText2?: string;
  questionText3?: string;
  questionText4?: string;
  questionText5?: string;
  questionImage1?: string;
  questionImage2?: string;
  questionImage3?: string;
  questionImage4?: string;
  questionImage5?: string;
  questionImage6?: string;
  questionImage7?: string;
  questionImage8?: string;
  questionImage9?: string;
  questionImage10?: string;
  answerType?: string;
  responseType?: string;
  valueStart?: string;
  valueEnd?: string;
  parentQuestionUuid?: string;
  isMarkdown: number;
  haveAnswers: number;
  questionNumLong: number;
  options: QuizOption[];
}

export interface QuizQuestionStats {
  answerableCount: number;
  totalMarks: number;
}

function asQuestionType(value: string): QuestionType {
  switch (value) {
    case 'MCQ':
    case 'MSQ':
    case 'SA':
    case 'COMPREHENSION':
    case 'OPPE':
      return value;
    default:
      return 'MCQ';
  }
}

function isInstructionalQuestion(question: RawQuestion): boolean {
  const text = question.question_text_1?.toUpperCase() ?? '';
  const optionTexts = (question.options ?? []).map((option) =>
    option.option_text.toUpperCase(),
  );

  const isHallTicketPrompt =
    text.includes('HALL TICKET') ||
    text.includes('CROSS CHECK') ||
    text.includes('REGISTERED BY YOU');

  const isUsefulDataPrompt = optionTexts.some((optionText) =>
    optionText.includes('USEFUL DATA HAS BEEN MENTIONED'),
  );

  return isHallTicketPrompt || isUsefulDataPrompt;
}

export function shouldIncludeQuestion(question: RawQuestion): boolean {
  if (question.question_type === 'COMPREHENSION') {
    return true;
  }

  if (parseFloat(question.total_mark) > 0) {
    return true;
  }

  return !isInstructionalQuestion(question);
}

export function transformRawQuestion(question: RawQuestion): QuizQuestion {
  const options = [...(question.options ?? [])]
    .sort((left, right) => (left.option_number ?? 0) - (right.option_number ?? 0))
    .map((option) => ({
      optionText: option.option_text,
      optionImage: option.option_image ?? undefined,
      score: option.score,
      isCorrect: option.is_correct,
      optionNumber: option.option_number ?? undefined,
    }));

  return {
    uuid: question.uuid,
    questionNumber: question.question_number,
    questionType: asQuestionType(question.question_type),
    totalMark: question.total_mark,
    hash: question.hash,
    questionText1: question.question_text_1 ?? undefined,
    questionText2: question.question_text_2 ?? undefined,
    questionText3: question.question_text_3 ?? undefined,
    questionText4: question.question_text_4 ?? undefined,
    questionText5: question.question_text_5 ?? undefined,
    questionImage1: question.question_image_1 ?? undefined,
    questionImage2: question.question_image_2 ?? undefined,
    questionImage3: question.question_image_3 ?? undefined,
    questionImage4: question.question_image_4 ?? undefined,
    questionImage5: question.question_image_5 ?? undefined,
    questionImage6: question.question_image_6 ?? undefined,
    questionImage7: question.question_image_7 ?? undefined,
    questionImage8: question.question_image_8 ?? undefined,
    questionImage9: question.question_image_9 ?? undefined,
    questionImage10: question.question_image_10 ?? undefined,
    answerType: question.answer_type ?? undefined,
    responseType: question.response_type ?? undefined,
    valueStart: question.value_start ?? undefined,
    valueEnd: question.value_end ?? undefined,
    parentQuestionUuid: question.parent_question?.uuid ?? undefined,
    isMarkdown: question.is_markdown,
    haveAnswers: question.have_answers,
    questionNumLong: question.question_num_long,
    options,
  };
}

export function transformRawQuestions(questions: RawQuestion[]): QuizQuestion[] {
  return questions
    .filter(shouldIncludeQuestion)
    .map(transformRawQuestion)
    .sort((left, right) => left.questionNumber - right.questionNumber);
}

export function getQuestionStats(questions: QuizQuestion[]): QuizQuestionStats {
  const answerableQuestions = questions.filter(
    (question) => question.questionType !== 'COMPREHENSION',
  );

  const totalMarks = answerableQuestions.reduce((sum, question) => {
    const marks = parseFloat(question.totalMark);
    return sum + (Number.isNaN(marks) ? 0 : marks);
  }, 0);

  return {
    answerableCount: answerableQuestions.length,
    totalMarks: Math.round(totalMarks),
  };
}
