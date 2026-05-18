/**
 * setup-local.js
 * Crea las tablas CloudPoll-Polls y CloudPoll-Votes en DynamoDB Local.
 * Uso: node scripts/setup-local.js
 */

import { DynamoDBClient, CreateTableCommand, ListTablesCommand, DeleteTableCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "local",
    secretAccessKey: "local",
  },
});

// ── Definición de tablas ───────────────────────────────────────────────────────
const tables = [
  {
    TableName: "CloudPoll-Polls",
    AttributeDefinitions: [
      { AttributeName: "pollId", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "pollId", KeyType: "HASH" },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: "CloudPoll-Votes",
    AttributeDefinitions: [
      { AttributeName: "pollId",     AttributeType: "S" },
      { AttributeName: "voteId",     AttributeType: "S" },
      { AttributeName: "questionId", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "pollId", KeyType: "HASH" },
      { AttributeName: "voteId", KeyType: "RANGE" },
    ],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: [
      {
        IndexName: "PollQuestionIndex",
        KeySchema: [
          { AttributeName: "pollId",     KeyType: "HASH" },
          { AttributeName: "questionId", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
async function tableExists(name) {
  const { TableNames } = await client.send(new ListTablesCommand({}));
  return TableNames.includes(name);
}

async function dropIfExists(name) {
  if (await tableExists(name)) {
    console.log(`  ⚠️  Tabla '${name}' existe — eliminando para recrear...`);
    await client.send(new DeleteTableCommand({ TableName: name }));
    // Pequeña espera para que DynamoDB Local procese la eliminación
    await new Promise((r) => setTimeout(r, 500));
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔧 Configurando DynamoDB Local en http://localhost:8000\n");

  for (const tableDef of tables) {
    try {
      await dropIfExists(tableDef.TableName);
      await client.send(new CreateTableCommand(tableDef));
      console.log(`  ✅ Tabla '${tableDef.TableName}' creada`);
    } catch (err) {
      console.error(`  ❌ Error con '${tableDef.TableName}':`, err.message);
      process.exit(1);
    }
  }

  console.log("\n✨ Listo. Tablas disponibles:");
  const { TableNames } = await client.send(new ListTablesCommand({}));
  TableNames.forEach((t) => console.log(`   - ${t}`));
  console.log("\n🚀 Puedes iniciar SAM con:\n   sam local start-api --env-vars env.local.json\n");
}

main();
