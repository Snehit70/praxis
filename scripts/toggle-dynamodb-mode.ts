#!/usr/bin/env bun
import { DynamoDBClient, UpdateTableCommand, waitUntilTableExists } from "@aws-sdk/client-dynamodb";

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

const mode = process.argv[2] as "on-demand" | "provisioned";

if (!["on-demand", "provisioned"].includes(mode)) {
  console.error("❌ Usage: bun run scripts/toggle-dynamodb-mode.ts <on-demand|provisioned>");
  process.exit(1);
}

async function updateTable(tableName: string) {
  console.log(`🔄 Updating table ${tableName} to ${mode}...`);
  
  try {
    if (mode === "on-demand") {
      await client.send(new UpdateTableCommand({
        TableName: tableName,
        BillingMode: "PAY_PER_REQUEST",
      }));
    } else {
      await client.send(new UpdateTableCommand({
        TableName: tableName,
        BillingMode: "PROVISIONED",
        ProvisionedThroughput: {
          ReadCapacityUnits: 25,
          WriteCapacityUnits: 25,
        },
      }));
    }
    
    console.log(`   Waiting for ${tableName} to update...`);
    await waitUntilTableExists({ client, maxWaitTime: 300 }, { TableName: tableName });
    console.log(`   ✓ ${tableName} updated successfully`);
    
  } catch (error: any) {
    if (error.name === "ResourceInUseException") {
      console.log(`⚠️  Table ${tableName} is already being updated or created. Wait a moment.`);
    } else {
      console.error(`❌ Error updating ${tableName}:`, error.message);
    }
  }
}

async function main() {
  await updateTable("quiz-papers");
  await updateTable("quiz-questions");
  
  console.log(`\n✅ All tables switched to ${mode.toUpperCase()} mode.`);
  if (mode === "on-demand") {
    console.log("   ⚡ Ready for fast import! Cost: ~$1.25 per million writes.");
  } else {
    console.log("   🆓 Back to Free Tier limits (25 RCU / 25 WCU).");
  }
}

main().catch(console.error);
