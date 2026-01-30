export interface Exam {
    id: number;
    uuid: string;
    exam_name: string;
    en_id: string; // Encrypted ID for API calls
}

export interface Course {
    id: number;
    course_name: string;
    course_code: string;
    uuid: string;
}

export interface QuestionPaper {
    id: number;
    uuid: string;
    exam_id: number;
    question_paper_name: string;
    question_paper_description: string;
    year: number;
    is_new: number;
}

export interface Question {
    id: number;
    question_text: string; // This might need adjustment based on actual structure (HTML/Text)
    options: any[]; // Need to check exact structure
    correct_answer: any;
    images?: string[];
}

export interface PageProps {
    courses: Course[];
    exam: Exam;
    question_paper?: {
        questions: Question[];
        [key: string]: any;
    };
    [key: string]: any;
}

export interface InertiaPage {
    component: string;
    props: PageProps;
    url: string;
    version: string;
}
