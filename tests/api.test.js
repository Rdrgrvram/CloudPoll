import { test, describe, before } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

// ── Configurar variables de entorno ANTES de importar los handlers ───────────
process.env.POLLS_TABLE           = "CloudPoll-Polls";
process.env.VOTES_TABLE           = "CloudPoll-Votes";
process.env.DYNAMODB_ENDPOINT     = "http://localhost:8000";
process.env.AWS_REGION            = "us-east-1";
process.env.AWS_ACCESS_KEY_ID     = "local";
process.env.AWS_SECRET_ACCESS_KEY = "local";

// Resolvimos BedrockRuntimeClient desde el node_modules de la propia Lambda
// para asegurar que mockeamos la misma instancia de la clase que importa la Lambda.
const requireLambda = createRequire(new URL("../lambdas/suggest-questions/index.js", import.meta.url).href);
const { BedrockRuntimeClient } = requireLambda("@aws-sdk/client-bedrock-runtime");

// Mock BedrockRuntimeClient send method to avoid network calls during tests
const mockBedrockResponse = {
  questions: [
    {
      questionId: "q1",
      text: "Pregunta sugerida por IA?",
      options: [
        { optionId: "o1", text: "Sugerencia A" },
        { optionId: "o2", text: "Sugerencia B" }
      ]
    }
  ]
};

BedrockRuntimeClient.prototype.send = async function (command) {
  // Return mocked bedrock response structure
  return {
    body: new TextEncoder().encode(JSON.stringify({
      results: [
        {
          outputText: JSON.stringify(mockBedrockResponse)
        }
      ]
    }))
  };
};

// Import handlers after environment configuration
const { handler: createPoll } = await import("../lambdas/create-poll/index.js");
const { handler: vote } = await import("../lambdas/vote/index.js");
const { handler: results } = await import("../lambdas/results/index.js");
const { handler: suggestQuestions } = await import("../lambdas/suggest-questions/index.js");

describe("CloudPoll Backend Integration Tests", () => {
  let activePollId;

  describe("POST /polls (createPoll)", () => {
    test("Debe retornar 400 si falta el título", async () => {
      const event = {
        body: JSON.stringify({
          questions: [
            {
              questionId: "q1",
              text: "¿Pregunta 1?",
              options: [
                { optionId: "o1", text: "Sí" },
                { optionId: "o2", text: "No" }
              ]
            }
          ]
        })
      };

      const res = await createPoll(event);
      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.match(body.error, /title/);
    });

    test("Debe retornar 400 si no se envían preguntas", async () => {
      const event = {
        body: JSON.stringify({
          title: "Mi encuesta de prueba"
        })
      };

      const res = await createPoll(event);
      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.match(body.error, /pregunta|questions/);
    });

    test("Debe crear una encuesta exitosamente", async () => {
      const event = {
        body: JSON.stringify({
          title: "Encuesta de Prueba de Integración",
          description: "Probando el flujo completo de CloudPoll",
          questions: [
            {
              questionId: "q1",
              text: "¿Cuál es tu lenguaje favorito?",
              options: [
                { optionId: "o1", text: "JavaScript" },
                { optionId: "o2", text: "Python" },
                { optionId: "o3", text: "Rust" }
              ]
            }
          ]
        })
      };

      const res = await createPoll(event);
      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.body);
      assert.ok(body.pollId);
      assert.ok(body.createdAt);
      activePollId = body.pollId; // Guardar ID para los siguientes tests
    });
  });

  describe("GET /results/{pollId} (results)", () => {
    test("Debe retornar 404 si la encuesta no existe", async () => {
      const event = {
        pathParameters: {
          pollId: "inexistente-uuid-000"
        }
      };

      const res = await results(event);
      assert.strictEqual(res.statusCode, 404);
      const body = JSON.parse(res.body);
      assert.match(body.error, /no encontrada/);
    });

    test("Debe retornar la encuesta recién creada con 0 votos", async () => {
      const event = {
        pathParameters: {
          pollId: activePollId
        }
      };

      const res = await results(event);
      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.pollId, activePollId);
      assert.strictEqual(body.title, "Encuesta de Prueba de Integración");
      assert.strictEqual(body.results[0].totalVotes, 0);
    });
  });

  describe("POST /votes (vote)", () => {
    test("Debe registrar un voto exitosamente", async () => {
      const event = {
        body: JSON.stringify({
          pollId: activePollId,
          questionId: "q1",
          optionId: "o1"
        }),
        requestContext: {
          identity: { sourceIp: "192.168.1.100" }
        }
      };

      const res = await vote(event);
      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.body);
      assert.ok(body.voteId);
    });

    test("Debe retornar 409 al intentar votar dos veces desde la misma IP", async () => {
      const event = {
        body: JSON.stringify({
          pollId: activePollId,
          questionId: "q1",
          optionId: "o2"
        }),
        requestContext: {
          identity: { sourceIp: "192.168.1.100" } // Misma IP
        }
      };

      const res = await vote(event);
      assert.strictEqual(res.statusCode, 409);
      const body = JSON.parse(res.body);
      assert.match(body.error, /Ya has votado/);
    });

    test("Debe permitir votar desde una IP diferente", async () => {
      const event = {
        body: JSON.stringify({
          pollId: activePollId,
          questionId: "q1",
          optionId: "o2"
        }),
        requestContext: {
          identity: { sourceIp: "192.168.1.101" } // Diferente IP
        }
      };

      const res = await vote(event);
      assert.strictEqual(res.statusCode, 201);
    });

    test("Debe acumular los votos correctamente en la vista de resultados", async () => {
      const event = {
        pathParameters: {
          pollId: activePollId
        }
      };

      const res = await results(event);
      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      
      const q1Results = body.results[0];
      assert.strictEqual(q1Results.totalVotes, 2); // 2 votos registrados
      
      const o1 = q1Results.options.find(o => o.optionId === "o1");
      const o2 = q1Results.options.find(o => o.optionId === "o2");
      const o3 = q1Results.options.find(o => o.optionId === "o3");

      assert.strictEqual(o1.count, 1);
      assert.strictEqual(o2.count, 1);
      assert.strictEqual(o3.count, 0);
      assert.strictEqual(o1.percentage, 50);
      assert.strictEqual(o2.percentage, 50);
    });
  });

  describe("POST /suggest (suggestQuestions)", () => {
    test("Debe retornar 400 si falta el tema (topic)", async () => {
      const event = {
        body: JSON.stringify({
          numQuestions: 2
        })
      };

      const res = await suggestQuestions(event);
      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.match(body.error, /topic/);
    });

    test("Debe retornar sugerencias mockeadas de Bedrock exitosamente", async () => {
      const event = {
        body: JSON.stringify({
          topic: "Desarrollo Cloud",
          numQuestions: 1
        })
      };

      const res = await suggestQuestions(event);
      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.topic, "Desarrollo Cloud");
      assert.ok(Array.isArray(body.questions));
      assert.strictEqual(body.questions[0].text, "Pregunta sugerida por IA?");
    });
  });
});
