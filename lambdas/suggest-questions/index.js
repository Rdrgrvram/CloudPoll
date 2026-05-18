import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });

const MODEL_ID = process.env.BEDROCK_MODEL_ID || "amazon.titan-text-express-v1";

// ── Respuesta helper ──────────────────────────────────────────────────────────
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

// ── Construir prompt ──────────────────────────────────────────────────────────
const buildPrompt = (topic, numQuestions) => `
Eres un experto en diseño de encuestas. Genera exactamente ${numQuestions} preguntas de encuesta sobre el tema: "${topic}".

Para cada pregunta, proporciona 4 opciones de respuesta claras y distintas.

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta (sin texto adicional):
{
  "questions": [
    {
      "questionId": "q1",
      "text": "Texto de la pregunta",
      "options": [
        { "optionId": "o1", "text": "Opción 1" },
        { "optionId": "o2", "text": "Opción 2" },
        { "optionId": "o3", "text": "Opción 3" },
        { "optionId": "o4", "text": "Opción 4" }
      ]
    }
  ]
}
`.trim();

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  let body;

  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { error: "Body JSON inválido" });
  }

  const { topic, numQuestions = 3 } = body;

  if (!topic || typeof topic !== "string" || topic.trim() === "") {
    return response(400, { error: "El campo 'topic' es obligatorio" });
  }

  const clampedNum = Math.min(Math.max(parseInt(numQuestions) || 3, 1), 10);
  const prompt = buildPrompt(topic.trim(), clampedNum);

  // ── Llamar a Bedrock ───────────────────────────────────────────────────────
  const payload = {
    inputText: prompt,
    textGenerationConfig: {
      maxTokenCount: 1024,
      temperature: 0.7,
      topP: 0.9,
    },
  };

  let rawText;
  try {
    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const bedrockResponse = await bedrock.send(command);
    const decoded = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
    rawText = decoded.results?.[0]?.outputText || "";
  } catch (err) {
    console.error("Error al invocar Bedrock:", err);
    return response(502, { error: "Error al comunicarse con Amazon Bedrock" });
  }

  // ── Parsear JSON de la respuesta ───────────────────────────────────────────
  let parsed;
  try {
    // Extraer el bloque JSON de la respuesta (Bedrock puede incluir texto extra)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No se encontró JSON en la respuesta");
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("Error al parsear respuesta de Bedrock:", rawText);
    return response(502, {
      error: "La respuesta de Bedrock no pudo ser parseada como JSON",
      raw: rawText,
    });
  }

  return response(200, {
    topic: topic.trim(),
    numQuestions: clampedNum,
    questions: parsed.questions,
  });
};
