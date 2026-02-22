#!/usr/bin/env bun
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const docClient = DynamoDBDocumentClient.from(client);

async function countItems(tableName: string): Promise<number> {
  let count = 0;
  let lastKey: any;
  
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: tableName,
      Select: "COUNT",
      ExclusiveStartKey: lastKey,
    }));
    count += result.Count || 0;
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  return count;
}

console.log("Verifying DynamoDB import...\n");

const papers = await countItems("quiz-papers");
const questions = await countItems("quiz-questions");

console.log(`quiz-papers: ${papers}`);
console.log(`quiz-questions: ${questions}`);
