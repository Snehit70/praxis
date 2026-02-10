import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Top-level exam types (Quiz 1, Quiz 2, End Term, OPPE)
  exams: defineTable({
    examName: v.string(),
    uuid: v.string(),
    enId: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_uuid", ["uuid"]),

  // Courses/subjects (CT, PDSA, AppDev1, etc.)
  courses: defineTable({
    courseName: v.string(),
    courseCode: v.string(),
    programId: v.number(),
    uuid: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_uuid", ["uuid"])
    .index("by_course_code", ["courseCode"]),

  // Question papers (specific exam instance for a course)
  papers: defineTable({
    examId: v.id("exams"),
    courseId: v.id("courses"),
    groupId: v.number(), // Original group_id from source data
    totalScore: v.string(),
    duration: v.number(),
    paperName: v.string(),
    paperDescription: v.string(),
    uuid: v.string(),
    year: v.number(),
    isNew: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_exam", ["examId"])
    .index("by_course", ["courseId"])
    .index("by_uuid", ["uuid"])
    .index("by_year", ["year"])
    .index("by_exam_course", ["examId", "courseId"]),

  // Questions within papers
  questions: defineTable({
    examId: v.id("exams"),
    paperId: v.id("papers"),
    courseId: v.id("courses"),
    questionNumber: v.number(),
    questionType: v.union(v.literal("MCQ"), v.literal("MSQ"), v.literal("SA"), v.literal("COMPREHENSION"), v.literal("OPPE")),
    totalMark: v.string(),
    hash: v.string(),
    uuid: v.string(),
    
    // Question text fields (up to 5)
    questionText1: v.optional(v.string()),
    questionText2: v.optional(v.string()),
    questionText3: v.optional(v.string()),
    questionText4: v.optional(v.string()),
    questionText5: v.optional(v.string()),
    
    // Question image fields (up to 10)
    questionImage1: v.optional(v.string()),
    questionImage2: v.optional(v.string()),
    questionImage3: v.optional(v.string()),
    questionImage4: v.optional(v.string()),
    questionImage5: v.optional(v.string()),
    questionImage6: v.optional(v.string()),
    questionImage7: v.optional(v.string()),
    questionImage8: v.optional(v.string()),
    questionImage9: v.optional(v.string()),
    questionImage10: v.optional(v.string()),
    
    // For short answer questions
    answerType: v.optional(v.string()), // "Equal", "Range"
    responseType: v.optional(v.string()), // "Numeric", "Text"
    valueStart: v.optional(v.string()),
    valueEnd: v.optional(v.string()),
    
    // For sub-questions
    parentQuestionId: v.optional(v.id("questions")),
    
    isMarkdown: v.number(),
    haveAnswers: v.number(),
    questionNumLong: v.number(),
    
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_paper", ["paperId"])
    .index("by_exam", ["examId"])
    .index("by_course", ["courseId"])
    .index("by_uuid", ["uuid"])
    .index("by_hash", ["hash"])
    .index("by_parent", ["parentQuestionId"])
    .index("by_paper_number", ["paperId", "questionNumber"]),

  // Answer options for MCQ/MSQ questions
  options: defineTable({
    questionId: v.id("questions"),
    optionText: v.string(),
    optionImage: v.optional(v.string()),
    score: v.string(),
    isCorrect: v.number(),
    optionNumber: v.optional(v.number()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_question", ["questionId"])
    .index("by_question_number", ["questionId", "optionNumber"]),
});
