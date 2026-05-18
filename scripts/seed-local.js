/**
 * seed-local.js
 * Inserta datos de prueba en DynamoDB Local.
 * Uso: node scripts/seed-local.js
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: { accessKeyId: "local", secretAccessKey: "local" },
});
const db = DynamoDBDocumentClient.from(client);

const POLLS_TABLE = "CloudPoll-Polls";
const VOTES_TABLE = "CloudPoll-Votes";

// ── Encuesta de prueba ─────────────────────────────────────────────────────────
const poll = {
  pollId: "poll-test-001",
  title: "Encuesta de tecnologías favoritas",
  description: "¿Qué tecnologías prefieres para desarrollo web?",
  createdAt: new Date().toISOString(),
  status: "active",
  questions: [
    {
      questionId: "q1",
      text: "¿Cuál es tu framework de backend favorito?",
      options: [
        { optionId: "o1", text: "Node.js / Express" },
        { optionId: "o2", text: "Python / FastAPI" },
        { optionId: "o3", text: "Java / Spring Boot" },
        { optionId: "o4", text: "Go / Gin" },
      ],
    },
    {
      questionId: "q2",
      text: "¿Qué base de datos usas más?",
      options: [
        { optionId: "o1", text: "PostgreSQL" },
        { optionId: "o2", text: "DynamoDB" },
        { optionId: "o3", text: "MongoDB" },
        { optionId: "o4", text: "MySQL" },
      ],
    },
  ],
};

// ── Votos de prueba ────────────────────────────────────────────────────────────
const votes = [
  { pollId: "poll-test-001", voteId: "v001", questionId: "q1", optionId: "o1", voterIp: "10.0.0.1", timestamp: new Date().toISOString() },
  { pollId: "poll-test-001", voteId: "v002", questionId: "q1", optionId: "o1", voterIp: "10.0.0.2", timestamp: new Date().toISOString() },
  { pollId: "poll-test-001", voteId: "v003", questionId: "q1", optionId: "o2", voterIp: "10.0.0.3", timestamp: new Date().toISOString() },
  { pollId: "poll-test-001", voteId: "v004", questionId: "q1", optionId: "o3", voterIp: "10.0.0.4", timestamp: new Date().toISOString() },
  { pollId: "poll-test-001", voteId: "v005", questionId: "q2", optionId: "o2", voterIp: "10.0.0.1", timestamp: new Date().toISOString() },
  { pollId: "poll-test-001", voteId: "v006", questionId: "q2", optionId: "o1", voterIp: "10.0.0.2", timestamp: new Date().toISOString() },
  { pollId: "poll-test-001", voteId: "v007", questionId: "q2", optionId: "o2", voterIp: "10.0.0.3", timestamp: new Date().toISOString() },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱 Insertando datos de prueba...\n");

  // Insertar encuesta
  await db.send(new PutCommand({ TableName: POLLS_TABLE, Item: poll }));
  console.log(`  ✅ Encuesta insertada: ${poll.pollId}`);

  // Insertar votos
  for (const vote of votes) {
    await db.send(new PutCommand({ TableName: VOTES_TABLE, Item: vote }));
  }
  console.log(`  ✅ ${votes.length} votos insertados`);

  console.log(`
✨ Datos listos. Prueba los endpoints:

  GET  http://localhost:3000/results/poll-test-001
  POST http://localhost:3000/votes
       Body: {"pollId":"poll-test-001","questionId":"q1","optionId":"o1"}
`);
}

main().catch(console.error);
