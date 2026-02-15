#!/usr/bin/env bun
import { DynamoDBClient, DeleteTableCommand, CreateTableCommand, waitUntilTableNotExists } from "@aws-sdk/client-dynamodb";

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.error("❌ AWS credentials not found");
  process.exit(1);
}

const client = new DynamoDBClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

async function recreateTables() {
  console.log("🗑️  Deleting existing tables...\n");

  try {
    await client.send(new DeleteTableCommand({ TableName: "quiz-papers" }));
    console.log("   Deleting quiz-papers...");
    await waitUntilTableNotExists({ client, maxWaitTime: 60 }, { TableName: "quiz-papers" });
    console.log("   ✓ quiz-papers deleted");
  } catch (error: any) {
    if (error.name !== "ResourceNotFoundException") throw error;
  }

  try {
    await client.send(new DeleteTableCommand({ TableName: "quiz-questions" }));
    console.log("   Deleting quiz-questions...");
    await waitUntilTableNotExists({ client, maxWaitTime: 60 }, { TableName: "quiz-questions" });
    console.log("   ✓ quiz-questions deleted");
  } catch (error: any) {
    if (error.name !== "ResourceNotFoundException") throw error;
  }

  console.log("\n🚀 Creating tables with Provisioned mode (Free Tier)...\n");

  await client.send(
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
      BillingMode: "PROVISIONED",
      ProvisionedThroughput: {
        ReadCapacityUnits: 25,
        WriteCapacityUnits: 25,
      },
      GlobalSecondaryIndexes: [
        {
          IndexName: "exam-course-index",
          KeySchema: [
            { AttributeName: "examId", KeyType: "HASH" },
            { AttributeName: "courseId", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
          },
        },
      ],
    })
  );
  console.log("✅ Created table: quiz-papers (25 RCU, 25 WCU)");

  await client.send(
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
      BillingMode: "PROVISIONED",
      ProvisionedThroughput: {
        ReadCapacityUnits: 25,
        WriteCapacityUnits: 25,
      },
    })
  );
  console.log("✅ Created table: quiz-questions (25 RCU, 25 WCU)");

  console.log("\n✅ Tables recreated with Provisioned mode!");
  console.log("   Region:", AWS_REGION);
  console.log("   Billing: Provisioned (Free Tier eligible)");
  console.log("   Capacity: 25 RCU / 25 WCU per table");
}

recreateTables().catch(console.error);
