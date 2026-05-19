import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { db } from "./db.js";

const POLLS_TABLE = process.env.POLLS_TABLE;

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
  let body;

  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { error: "Body JSON inválido" });
  }

  const { title, description, questions } = body;

  // Validaciones básicas
  if (!title || typeof title !== "string" || title.trim() === "") {
    return response(400, { error: "El campo 'title' es obligatorio" });
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    return response(400, { error: "Se requiere al menos una pregunta en 'questions'" });
  }

  // Validar estructura de cada pregunta
  for (const q of questions) {
    if (!q.questionId || !q.text || !Array.isArray(q.options) || q.options.length < 2) {
      return response(400, {
        error: "Cada pregunta debe tener: questionId, text y al menos 2 options",
      });
    }
    for (const opt of q.options) {
      if (!opt.optionId || !opt.text) {
        return response(400, { error: "Cada opción debe tener: optionId y text" });
      }
    }
  }

  const pollId = randomUUID();
  const createdAt = new Date().toISOString();

  const item = {
    pollId,
    title: title.trim(),
    description: description?.trim() ?? "",
    questions,
    createdAt,
    status: "active",
  };

  try {
    await db.send(
      new PutCommand({
        TableName: POLLS_TABLE,
        Item: item,
        // Evitar sobreescribir si ya existe (por si acaso)
        ConditionExpression: "attribute_not_exists(pollId)",
      })
    );

    return response(201, { message: "Encuesta creada exitosamente", pollId, createdAt });
  } catch (err) {
    console.error("Error al guardar encuesta:", err);
    return response(500, { error: "Error interno al crear la encuesta" });
  }
};
