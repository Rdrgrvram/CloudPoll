import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "./db.js";

const POLLS_TABLE = process.env.POLLS_TABLE;
const VOTES_TABLE = process.env.VOTES_TABLE;

// ── Respuesta helper ──────────────────────────────────────────────────────────
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  const pollId = event.pathParameters?.pollId;

  if (!pollId) {
    return response(400, { error: "Se requiere el parámetro pollId en la ruta" });
  }

  // ── 1. Obtener la encuesta (preguntas y opciones) ─────────────────────────
  let poll;
  try {
    const result = await db.send(
      new GetCommand({ TableName: POLLS_TABLE, Key: { pollId } })
    );

    if (!result.Item) {
      return response(404, { error: `Encuesta '${pollId}' no encontrada` });
    }
    poll = result.Item;
  } catch (err) {
    console.error("Error al obtener encuesta:", err);
    return response(500, { error: "Error interno al obtener la encuesta" });
  }

  // ── 2. Obtener todos los votos de la encuesta ─────────────────────────────
  let votes = [];
  try {
    let lastKey = undefined;
    do {
      const result = await db.send(
        new QueryCommand({
          TableName: VOTES_TABLE,
          KeyConditionExpression: "pollId = :pid",
          FilterExpression: "questionId <> :dupGuard",
          ExpressionAttributeValues: {
            ":pid": pollId,
            ":dupGuard": "__dup_guard__",
          },
          ExclusiveStartKey: lastKey,
        })
      );
      votes = votes.concat(result.Items || []);
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);
  } catch (err) {
    console.error("Error al obtener votos:", err);
    return response(500, { error: "Error interno al obtener los votos" });
  }

  // ── 3. Agregar resultados por pregunta y opción ───────────────────────────
  const voteCounts = {};
  for (const vote of votes) {
    const key = `${vote.questionId}#${vote.optionId}`;
    voteCounts[key] = (voteCounts[key] || 0) + 1;
  }

  const aggregated = poll.questions.map((question) => {
    const questionVotes = question.options.reduce((sum, opt) => {
      const key = `${question.questionId}#${opt.optionId}`;
      return sum + (voteCounts[key] || 0);
    }, 0);

    const options = question.options.map((opt) => {
      const key = `${question.questionId}#${opt.optionId}`;
      const count = voteCounts[key] || 0;
      const percentage = questionVotes > 0 ? Math.round((count / questionVotes) * 100) : 0;
      return { optionId: opt.optionId, text: opt.text, count, percentage };
    });

    return {
      questionId: question.questionId,
      text: question.text,
      totalVotes: questionVotes,
      options,
    };
  });

  return response(200, {
    pollId,
    title: poll.title,
    description: poll.description,
    createdAt: poll.createdAt,
    status: poll.status,
    results: aggregated,
  });
};
