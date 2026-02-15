"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

// TypeScript interfaces for DynamoDB items
interface PaperItem {
  uuid: string;
  examId: string;
  examName: string;
  courseId: string;
  courseName: string;
  paperName?: string;
  year?: number;
  totalScore?: string;
  duration?: number;
  isNew?: number;
}

interface QuestionItem {
  paperUuid: string;
  questionNumber: number;
  questionType: string;
  totalMark: string;
  hash: string;
  uuid: string;
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
  isMarkdown: number;
  haveAnswers: number;
  parentQuestionUuid?: string;
  options: Array<{
    optionText: string;
    optionImage?: string;
    score: string;
    isCorrect: number;
    optionNumber?: number;
  }>;
}

// Initialize DynamoDB client
function createDynamoClient() {
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

/**
 * Get all courses for a specific exam type
 * Used by ExamPage.tsx
 */
export const getCoursesByExam = action({
  args: {
    examUuid: v.string(),
  },
  handler: async (_ctx, args): Promise<Array<{
    _id: string;
    uuid: string;
    courseName: string;
    courseCode: string;
    paperCount: number;
  }>> => {
    const docClient = createDynamoClient();

    try {
      // Query papers by examId using the GSI
      const command = new QueryCommand({
        TableName: "quiz-papers",
        IndexName: "exam-course-index",
        KeyConditionExpression: "examId = :eid",
        ExpressionAttributeValues: {
          ":eid": args.examUuid,
        },
      });

      const response = await docClient.send(command);
      const papers = (response.Items || []) as PaperItem[];

      // Group papers by course and count
      const courseMap = new Map<string, { courseName: string; count: number }>();
      
      for (const paper of papers) {
        const existing = courseMap.get(paper.courseId);
        if (existing) {
          existing.count++;
        } else {
          courseMap.set(paper.courseId, {
            courseName: paper.courseName,
            count: 1,
          });
        }
      }

      // Convert to array format expected by frontend
      const courses = Array.from(courseMap.entries()).map(([courseId, info]) => ({
        _id: courseId, // Use courseId as _id for compatibility
        uuid: courseId,
        courseName: info.courseName,
        courseCode: info.courseName, // Use courseName as courseCode since we don't have it in DynamoDB
        paperCount: info.count,
      }));

      // Sort by course name
      courses.sort((a, b) => a.courseName.localeCompare(b.courseName));

      return courses;
    } catch (e) {
      console.error("DynamoDB Error (getCoursesByExam):", e);
      throw new Error("Failed to fetch courses");
    }
  },
});

/**
 * Get all papers for a specific exam and course combination
 * Used by CoursePage.tsx
 */
export const getPapersByExamAndCourse = action({
  args: {
    examUuid: v.string(),
    courseUuid: v.string(),
  },
  handler: async (_ctx, args): Promise<PaperItem[]> => {
    const docClient = createDynamoClient();

    try {
      const command = new QueryCommand({
        TableName: "quiz-papers",
        IndexName: "exam-course-index",
        KeyConditionExpression: "examId = :eid AND courseId = :cid",
        ExpressionAttributeValues: {
          ":eid": args.examUuid,
          ":cid": args.courseUuid,
        },
      });

      const response = await docClient.send(command);
      const papers = (response.Items || []) as PaperItem[];

      // Sort by year descending
      papers.sort((a, b) => (b.year || 0) - (a.year || 0));

      return papers;
    } catch (e) {
      console.error("DynamoDB Error (getPapersByExamAndCourse):", e);
      throw new Error("Failed to fetch papers");
    }
  },
});

/**
 * Get a single paper by its UUID
 * Used by PaperPage.tsx
 */
export const getPaperByUuid = action({
  args: {
    paperUuid: v.string(),
  },
  handler: async (_ctx, args): Promise<PaperItem | null> => {
    const docClient = createDynamoClient();

    try {
      const command = new GetCommand({
        TableName: "quiz-papers",
        Key: {
          uuid: args.paperUuid,
        },
      });

      const response = await docClient.send(command);
      
      if (!response.Item) {
        return null;
      }

      const paper = response.Item as PaperItem;
      
      // Add examUuid and courseUuid fields for frontend compatibility
      return {
        ...paper,
        examUuid: paper.examId,
        courseUuid: paper.courseId,
      } as PaperItem & { examUuid: string; courseUuid: string };
    } catch (e) {
      console.error("DynamoDB Error (getPaperByUuid):", e);
      throw new Error("Failed to fetch paper");
    }
  },
});

/**
 * Get all questions for a specific paper
 * Used by PaperPage.tsx
 */
export const getQuestionsByPaper = action({
  args: {
    paperUuid: v.string(),
  },
  handler: async (_ctx, args): Promise<QuestionItem[]> => {
    const docClient = createDynamoClient();

    try {
      const command = new QueryCommand({
        TableName: "quiz-questions",
        KeyConditionExpression: "paperUuid = :pid",
        ExpressionAttributeValues: {
          ":pid": args.paperUuid,
        },
      });

      const response = await docClient.send(command);
      const questions = (response.Items || []) as QuestionItem[];

      questions.sort((a, b) => a.questionNumber - b.questionNumber);

      const filteredQuestions = questions.filter(q => {
        if (parseFloat(q.totalMark) > 0) return true;
        
        const isHallTicketQuestion = 
          q.questionText1?.toUpperCase().includes('HALL TICKET') ||
          q.questionText1?.toUpperCase().includes('CROSS CHECK') ||
          q.questionText1?.toUpperCase().includes('REGISTERED BY YOU');
        
        const isUsefulDataQuestion = q.options?.some(opt => 
          opt.optionText?.includes('Useful Data has been mentioned')
        );
        
        return !isHallTicketQuestion && !isUsefulDataQuestion;
      });

      return filteredQuestions;
    } catch (e) {
      console.error("DynamoDB Error (getQuestionsByPaper):", e);
      throw new Error("Failed to fetch questions");
    }
  },
});
