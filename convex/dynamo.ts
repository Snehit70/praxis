"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const getPapersByExamAndCourse = action({
  args: {
    examUuid: v.string(),
    courseUuid: v.string(),
  },
  handler: async (ctx, args) => {
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
      return response.Items || [];
    } catch (e) {
      console.error("DynamoDB Error:", e);
      throw new Error("Failed to fetch papers");
    }
  },
});

export const getQuestionsByPaper = action({
  args: {
    paperUuid: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const command = new QueryCommand({
        TableName: "quiz-questions",
        KeyConditionExpression: "paperUuid = :pid",
        ExpressionAttributeValues: {
          ":pid": args.paperUuid,
        },
      });

      const response = await docClient.send(command);
      const questions = response.Items || [];
      return questions.sort((a: any, b: any) => a.questionNumber - b.questionNumber);
    } catch (e) {
      console.error("DynamoDB Error:", e);
      throw new Error("Failed to fetch questions");
    }
  },
});
