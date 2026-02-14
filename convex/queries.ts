import { query } from "./_generated/server";
import { v } from "convex/values";

export const listAllExams = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("exams").collect();
  },
});

export const getCoursesByExamUuid = query({
  args: {
    examUuid: v.string(),
  },
  handler: async (ctx, args) => {
    const exam = await ctx.db
      .query("exams")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.examUuid))
      .first();

    if (!exam) {
      return null;
    }

    const papers = await ctx.db
      .query("papers")
      .withIndex("by_exam", (q) => q.eq("examId", exam._id))
      .collect();

    const courseIds = [...new Set(papers.map((p) => p.courseId))];

    const courses = await Promise.all(
      courseIds.map(async (courseId) => {
        const course = await ctx.db.get(courseId);
        if (!course) return null;

        const paperCount = papers.filter((p) => p.courseId === courseId).length;

        return {
          _id: course._id,
          courseName: course.courseName,
          courseCode: course.courseCode,
          uuid: course.uuid,
          paperCount,
        };
      })
    );

    return courses.filter((c) => c !== null);
  },
});

export const getCourseByUuid = query({
  args: {
    courseUuid: v.string(),
  },
  handler: async (ctx, args) => {
    const course = await ctx.db
      .query("courses")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.courseUuid))
      .first();

    return course;
  },
});

export const getPapersByExamAndCourse = query({
  args: {
    examUuid: v.string(),
    courseUuid: v.string(),
  },
  handler: async (ctx, args) => {
    const exam = await ctx.db
      .query("exams")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.examUuid))
      .first();

    if (!exam) {
      return null;
    }

    const course = await ctx.db
      .query("courses")
      .withIndex("by_uuid", (q) => q.eq("uuid", args.courseUuid))
      .first();

    if (!course) {
      return null;
    }

    const papers = await ctx.db
      .query("papers")
      .withIndex("by_exam_course", (q) => 
        q.eq("examId", exam._id).eq("courseId", course._id)
      )
      .collect();

    const sortedPapers = papers
      .map((paper) => ({
        _id: paper._id,
        paperName: paper.paperName,
        paperDescription: paper.paperDescription,
        uuid: paper.uuid,
        year: paper.year,
        duration: paper.duration,
        totalScore: paper.totalScore,
        isNew: paper.isNew,
        createdAt: paper.createdAt,
      }))
      .sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return b.createdAt.localeCompare(a.createdAt);
      });

    return sortedPapers;
  },
});
