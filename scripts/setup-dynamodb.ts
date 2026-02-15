#!/usr/bin/env bun
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { CreateTableCommand } from "@aws-sdk/client-dynamodb";

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.error("❌ AWS credentials not found. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env");
  process.exit(1);
}

const client = new DynamoDBClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

async function createTables() {
  console.log("🚀 Creating DynamoDB tables...\n");

  try {
    const papersTable = await client.send(
      new CreateTableCommand({
        TableName: "quiz-papers",
        KeySchema: [
          { AttributeName: "uuid", KeyType: "HASH" },
        ],
        AttributeDefinitions: [
          { AttributeName: "uuid", AttributeType: "S" },
          { AttributeName: "examId", AttributeType: "S" },
          { AttributeName: "courseId", AttributeType: "S" },
        ],
        BillingMode: "PAY_PER_REQUEST",
        GlobalSecondaryIndexes: [
          {
            IndexName: "exam-course-index",
            KeySchema: [
              { AttributeName: "examId", KeyType: "HASH" },
              { AttributeName: "courseId", KeyType: "RANGE" },
            ],
            Projection: { ProjectionType: "ALL" },
          },
        ],
      })
    );
    console.log("✅ Created table: quiz-papers");
  } catch (error: any) {
    if (error.name === "ResourceInUseException") {
      console.log("⚠️  Table quiz-papers already exists");
    } else {
      throw error;
    }
  }

  try {
    const questionsTable = await client.send(
      new CreateTableCommand({
        TableName: "quiz-questions",
        KeySchema: [
          { AttributeName: "paperUuid", KeyType: "HASH" },
          { AttributeName: "questionNumber", KeyType: "RANGE" },
        ],
        AttributeDefinitions: [
          { AttributeName: "paperUuid", AttributeType: "S" },
          { AttributeName: "questionNumber", AttributeType: "N" },
        ],
        BillingMode: "PAY_PER_REQUEST",
      })
    );
    console.log("✅ Created table: quiz-questions");
  } catch (error: any) {
    if (error.name === "ResourceInUseException") {
      console.log("⚠️  Table quiz-questions already exists");
    } else {
      throw error;
    }
  }

  console.log("\n✅ DynamoDB setup complete!");
  console.log("   Region:", AWS_REGION);
  console.log("   Tables: quiz-papers, quiz-questions");
}

createTables().catch(console.error);
