#!/usr/bin/env bun
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const docClient = DynamoDBDocumentClient.from(client);

const paperUuid = "a3d88545-398";

console.log(`Checking questions for paper ${paperUuid} in DynamoDB:\n`);

const result = await docClient.send(new QueryCommand({
  TableName: "quiz-questions",
  KeyConditionExpression: "paperUuid = :pid",
  ExpressionAttributeValues: { ":pid": paperUuid },
  ProjectionExpression: "questionNumber, courseId, courseName",
}));

console.log(`Total questions in DB: ${result.Items?.length || 0}`);

// Count by course
const byCourse = new Map<string, number>();
for (const item of result.Items || []) {
  const course = item.courseName || "Unknown";
  byCourse.set(course, (byCourse.get(course) || 0) + 1);
}

console.log("\nQuestions by course:");
for (const [course, count] of [...byCourse.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${course}: ${count}`);
}
