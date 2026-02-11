import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const wipeAll = mutation({
  args: {},
  handler: async (ctx) => {
    const tables = ["options", "questions", "papers", "courses", "exams"] as const;
    const counts: Record<string, number> = {};
    
    for (const table of tables) {
      const docs = await ctx.db.query(table).collect();
      counts[table] = docs.length;
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }
    }
    
    return counts;
  },
});

export const wipeTableBatch = mutation({
  args: {
    table: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Validate table name to prevent arbitrary deletion
    if (!["exams", "courses", "papers", "questions", "options"].includes(args.table)) {
      throw new Error("Invalid table name");
    }
    
    const docs = await ctx.db.query(args.table as "exams" | "courses" | "papers" | "questions" | "options").take(args.limit);
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
    return docs.length;
  },
});

// Seed exams
export const seedExams = mutation({
  args: {
    exams: v.array(
      v.object({
        examName: v.string(),
        uuid: v.string(),
        enId: v.optional(v.string()),
        createdAt: v.string(),
        updatedAt: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ids: Record<string, Id<"exams">> = {};
    
    for (const exam of args.exams) {
      const id = await ctx.db.insert("exams", exam);
      ids[exam.uuid] = id;
    }
    
    return ids;
  },
});

// Seed courses
export const seedCourses = mutation({
  args: {
    courses: v.array(
      v.object({
        courseName: v.string(),
        courseCode: v.string(),
        programId: v.number(),
        uuid: v.string(),
        createdAt: v.string(),
        updatedAt: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ids: Record<string, Id<"courses">> = {};
    
    for (const course of args.courses) {
      const id = await ctx.db.insert("courses", course);
      ids[course.uuid] = id;
    }
    
    return ids;
  },
});

// Seed papers (batch)
export const seedPapers = mutation({
  args: {
    papers: v.array(
      v.object({
        examUuid: v.string(),
        courseUuid: v.string(),
        groupId: v.number(),
        totalScore: v.string(),
        duration: v.number(),
        paperName: v.string(),
        paperDescription: v.string(),
        uuid: v.string(),
        year: v.number(),
        isNew: v.number(),
        createdAt: v.string(),
        updatedAt: v.string(),
      })
    ),
    examIdMap: v.record(v.string(), v.id("exams")),
    courseIdMap: v.record(v.string(), v.id("courses")),
  },
  handler: async (ctx, args) => {
    const ids: Record<string, Id<"papers">> = {};
    
    for (const paper of args.papers) {
      const examId = args.examIdMap[paper.examUuid];
      const courseId = args.courseIdMap[paper.courseUuid];
      
      if (!examId || !courseId) {
        console.error(`Missing exam or course ID for paper ${paper.uuid}`);
        continue;
      }
      
      const id = await ctx.db.insert("papers", {
        examId,
        courseId,
        groupId: paper.groupId,
        totalScore: paper.totalScore,
        duration: paper.duration,
        paperName: paper.paperName,
        paperDescription: paper.paperDescription,
        uuid: paper.uuid,
        year: paper.year,
        isNew: paper.isNew,
        createdAt: paper.createdAt,
        updatedAt: paper.updatedAt,
      });
      
      ids[paper.uuid] = id;
    }
    
    return ids;
  },
});

// Seed questions (batch)
export const seedQuestions = mutation({
  args: {
    questions: v.array(
      v.object({
        examUuid: v.string(),
        paperUuid: v.string(),
        courseUuid: v.string(),
        questionNumber: v.number(),
        questionType: v.union(v.literal("MCQ"), v.literal("MSQ"), v.literal("SA"), v.literal("COMPREHENSION"), v.literal("OPPE")),
        totalMark: v.string(),
        hash: v.string(),
        uuid: v.string(),
        
        questionText1: v.optional(v.string()),
        questionText2: v.optional(v.string()),
        questionText3: v.optional(v.string()),
        questionText4: v.optional(v.string()),
        questionText5: v.optional(v.string()),
        
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
        
        answerType: v.optional(v.string()),
        responseType: v.optional(v.string()),
        valueStart: v.optional(v.string()),
        valueEnd: v.optional(v.string()),
        
        parentQuestionUuid: v.optional(v.string()),
        
        isMarkdown: v.number(),
        haveAnswers: v.number(),
        questionNumLong: v.number(),
        
        createdAt: v.string(),
        updatedAt: v.string(),
      })
    ),
    examIdMap: v.record(v.string(), v.id("exams")),
    paperIdMap: v.record(v.string(), v.id("papers")),
    courseIdMap: v.record(v.string(), v.id("courses")),
    questionIdMap: v.optional(v.record(v.string(), v.id("questions"))),
  },
  handler: async (ctx, args) => {
    const ids: Record<string, Id<"questions">> = {};
    
    for (const question of args.questions) {
      const examId = args.examIdMap[question.examUuid];
      const paperId = args.paperIdMap[question.paperUuid];
      const courseId = args.courseIdMap[question.courseUuid];
      
      if (!examId || !paperId || !courseId) {
        console.error(`Missing IDs for question ${question.uuid}`);
        continue;
      }
      
      let parentQuestionId = undefined;
      if (question.parentQuestionUuid && args.questionIdMap) {
        parentQuestionId = args.questionIdMap[question.parentQuestionUuid];
      }
      
      const id = await ctx.db.insert("questions", {
        examId,
        paperId,
        courseId,
        questionNumber: question.questionNumber,
        questionType: question.questionType,
        totalMark: question.totalMark,
        hash: question.hash,
        uuid: question.uuid,
        
        questionText1: question.questionText1,
        questionText2: question.questionText2,
        questionText3: question.questionText3,
        questionText4: question.questionText4,
        questionText5: question.questionText5,
        
        questionImage1: question.questionImage1,
        questionImage2: question.questionImage2,
        questionImage3: question.questionImage3,
        questionImage4: question.questionImage4,
        questionImage5: question.questionImage5,
        questionImage6: question.questionImage6,
        questionImage7: question.questionImage7,
        questionImage8: question.questionImage8,
        questionImage9: question.questionImage9,
        questionImage10: question.questionImage10,
        
        answerType: question.answerType,
        responseType: question.responseType,
        valueStart: question.valueStart,
        valueEnd: question.valueEnd,
        
        parentQuestionId,
        
        isMarkdown: question.isMarkdown,
        haveAnswers: question.haveAnswers,
        questionNumLong: question.questionNumLong,
        
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
      });
      
      ids[question.uuid] = id;
    }
    
    return ids;
  },
});

// Seed options (batch)
export const seedOptions = mutation({
  args: {
    options: v.array(
      v.object({
        questionUuid: v.string(),
        optionText: v.string(),
        optionImage: v.optional(v.string()),
        score: v.string(),
        isCorrect: v.number(),
        optionNumber: v.optional(v.number()),
        createdAt: v.string(),
        updatedAt: v.string(),
      })
    ),
    questionIdMap: v.record(v.string(), v.id("questions")),
  },
  handler: async (ctx, args) => {
    const ids: Id<"options">[] = [];
    
    for (const option of args.options) {
      const questionId = args.questionIdMap[option.questionUuid];
      
      if (!questionId) {
        console.error(`Missing question ID for option`);
        continue;
      }
      
      const id = await ctx.db.insert("options", {
        questionId,
        optionText: option.optionText,
        optionImage: option.optionImage,
        score: option.score,
        isCorrect: option.isCorrect,
        optionNumber: option.optionNumber ?? undefined,
        createdAt: option.createdAt,
        updatedAt: option.updatedAt,
      });
      
      ids.push(id);
    }
    
    return { count: ids.length };
  },
});
