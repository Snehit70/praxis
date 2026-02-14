import { query } from "./_generated/server";
import { v } from "convex/values";

export const verifyData = query({
  args: { seed: v.optional(v.number()) },
  handler: async (ctx) => {
    const results: any = {
      checks: [],
      errors: [],
      performance: {},
      stats: {}
    };

    const exams = await ctx.db.query("exams").collect();
    if (exams.length === 0) return { error: "No exams found" };
    
    const randomExam = exams[Math.floor(Math.random() * exams.length)];
    if (!randomExam) return { error: "No exams found" };
    results.checks.push(`Selected Exam: ${randomExam.examName} (${randomExam._id})`);

    const papers = await ctx.db.query("papers")
      .withIndex("by_exam", (q) => q.eq("examId", randomExam._id))
      .collect();
    
    if (papers.length === 0) {
      results.errors.push(`No papers found for exam ${randomExam.examName}`);
      return results;
    }
    results.checks.push(`Found ${papers.length} papers for this exam`);

    let randomPaper = null;
    let questions: any[] = [];
    let attempts = 0;
    
    while (attempts < 50 && questions.length === 0) {
        const candidatePaper = papers[Math.floor(Math.random() * papers.length)];
        if (candidatePaper) {
            const candidateQuestions = await ctx.db.query("questions")
              .withIndex("by_paper", (q) => q.eq("paperId", candidatePaper._id))
              .collect();
            
            if (candidateQuestions.length > 0) {
                randomPaper = candidatePaper;
                questions = candidateQuestions;
            }
        }
        attempts++;
    }

    if (!randomPaper || questions.length === 0) {
        results.errors.push(`Could not find a paper with questions after ${attempts} attempts`);
        const fallbackPaper = papers[Math.floor(Math.random() * papers.length)];
        if (fallbackPaper) {
            randomPaper = fallbackPaper;
            results.checks.push(`Fallback to random empty paper: ${randomPaper.paperName}`);
        } else {
            return { error: "No papers available" };
        }
    } else {
        results.checks.push(`Selected Populated Paper: ${randomPaper.paperName} (${randomPaper._id}) after ${attempts} attempts`);
    }

    const course = await ctx.db.get(randomPaper.courseId);
    if (!course) {
      results.errors.push(`Course not found for paper ${randomPaper._id} (courseId: ${randomPaper.courseId})`);
    } else {
      results.checks.push(`Verified Course: ${course.courseName} (${course._id})`);
    }

    const start = Date.now();
    
    const optionsPromises = questions.map(q => 
      ctx.db.query("options")
        .withIndex("by_question", (qQuery) => qQuery.eq("questionId", q._id))
        .collect()
    );
    const optionsResults = await Promise.all(optionsPromises);
    const optionCount = optionsResults.reduce((acc, opts) => acc + opts.length, 0);
    
    const end = Date.now();
    results.performance.optionsFetchMs = end - start;
    results.performance.questionCount = questions.length;
    results.performance.optionCount = optionCount;
    results.performance.estimatedTotalFetchMs = (end - start) + 50; 

    if (questions.length > 0) {
      let subQuestionCount = 0;
      let questionsWithImages = 0;
      let questionsWithText = 0;
      let orphanParentIds = 0;

      for (const q of questions) {
        if (q.examId !== randomExam._id) results.errors.push(`Question ${q._id} examId mismatch`);
        if (q.paperId !== randomPaper._id) results.errors.push(`Question ${q._id} paperId mismatch`);
        if (q.courseId !== randomPaper.courseId) results.errors.push(`Question ${q._id} courseId mismatch`);

        const hasText = [1,2,3,4,5].some(i => (q as any)[`questionText${i}`]);
        if (hasText) questionsWithText++;

        const hasImage = [1,2,3,4,5,6,7,8,9,10].some(i => (q as any)[`questionImage${i}`]);
        if (hasImage) questionsWithImages++;

        if (q.parentQuestionId) {
          subQuestionCount++;
          const parent = await ctx.db.get(q.parentQuestionId);
          if (!parent) orphanParentIds++;
        }
      }

      results.stats.subQuestions = subQuestionCount;
      results.stats.questionsWithImages = questionsWithImages;
      results.stats.questionsWithText = questionsWithText;
      
      if (orphanParentIds > 0) {
        results.errors.push(`Found ${orphanParentIds} questions with invalid parentQuestionId`);
      } else if (subQuestionCount > 0) {
        results.checks.push(`Verified ${subQuestionCount} sub-questions link to valid parents`);
      }

      if (optionCount > 0) {
        const firstOptions = optionsResults.find(o => o.length > 0);
        if (firstOptions && firstOptions.length > 0) {
          const sampleOption = firstOptions[0];
          if (sampleOption) {
            results.checks.push(`Sample Option: "${sampleOption.optionText.substring(0, 20)}..." (Correct: ${sampleOption.isCorrect})`);
          }
        }
      }
    }

    return results;
  }
});
