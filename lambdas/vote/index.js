import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { db } from "./db.js";


// ── Respuesta helper ──────────────────────────────────────────────────────────
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

// ── Obtener IP del votante ─────────────────────────────────────────────────────
const getVoterIp = (event) =>
  event.requestContext?.identity?.sourceIp ||
  event.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
  "unknown";

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  let body;

  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { error: "Body JSON inválido" });
  }

  const { pollId, questionId, optionId } = body;

  if (!pollId || !questionId || !optionId) {
    return response(400, { error: "Se requieren: pollId, questionId, optionId" });
  }

  const voterIp = getVoterIp(event);

  // ── Verificar voto duplicado por IP + pollId ───────────────────────────────
  // El voteId de duplicado usa patrón: DUP#<ip>#<pollId>
  const duplicateCheckId = `DUP#${voterIp}#${pollId}`;

  try {
    const existing = await db.send(
      new QueryCommand({
        TableName: VOTES_TABLE,
        KeyConditionExpression: "pollId = :pid AND voteId = :vid",
        ExpressionAttributeValues: {
          ":pid": pollId,
          ":vid": duplicateCheckId,
        },
        Limit: 1,
      })
    );

    if (existing.Items && existing.Items.length > 0) {
      return response(409, { error: "Ya has votado en esta encuesta" });
    }
  } catch (err) {
    console.error("Error al verificar duplicado:", err);
    return response(500, { error: "Error interno al verificar voto" });
  }

  const timestamp = new Date().toISOString();
  const voteId = randomUUID();

  // ── Guardar voto real ──────────────────────────────────────────────────────
  const voteItem = {
    pollId,
    voteId,
    questionId,
    optionId,
    voterIp,
    timestamp,
  };

  // ── Guardar registro anti-duplicado ───────────────────────────────────────
  const dupItem = {
    pollId,
    voteId: duplicateCheckId,
    questionId: "__dup_guard__",
    optionId: "__dup_guard__",
    voterIp,
    timestamp,
  };

  try {
    // Guardar ambos items (el voto real + el guard de duplicado)
    await Promise.all([
      db.send(new PutCommand({ TableName: VOTES_TABLE, Item: voteItem })),
      db.send(
        new PutCommand({
          TableName: VOTES_TABLE,
          Item: dupItem,
          ConditionExpression: "attribute_not_exists(voteId)",
        })
      ),
    ]);

    return response(201, { message: "Voto registrado exitosamente", voteId, timestamp });
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return response(409, { error: "Ya has votado en esta encuesta" });
    }
    console.error("Error al registrar voto:", err);
    return response(500, { error: "Error interno al registrar el voto" });
  }
};
