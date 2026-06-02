/**
 * dev-server.js
 * Servidor local que invoca los handlers Lambda directamente (sin Docker/SAM).
 * DynamoDB Local corre en localhost:8000 via docker-compose.
 * Tambien sirve el frontend estatico desde /frontend.
 *
 * Uso:
 *   node scripts/dev-server.js
 *
 * Endpoints disponibles en http://localhost:3000
 */

import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// -- Configurar variables de entorno ANTES de importar los handlers -----------
process.env.POLLS_TABLE           = "CloudPoll-Polls";
process.env.VOTES_TABLE           = "CloudPoll-Votes";
process.env.DYNAMODB_ENDPOINT     = "http://localhost:8000";
process.env.AWS_REGION            = "us-east-1";
process.env.AWS_ACCESS_KEY_ID     = "local";
process.env.AWS_SECRET_ACCESS_KEY = "local";

// -- Importar handlers Lambda --------------------------------------------------
const { handler: createPoll }       = await import("../lambdas/create-poll/index.js");
const { handler: vote }             = await import("../lambdas/vote/index.js");
const { handler: results }          = await import("../lambdas/results/index.js");
const { handler: suggestQuestions } = await import("../lambdas/suggest-questions/index.js");

// -- Helper: Express req -> evento Lambda -------------------------------------
function toEvent(req) {
  return {
    httpMethod: req.method,
    path: req.path,
    pathParameters: req.params,
    queryStringParameters: req.query,
    headers: req.headers,
    body: JSON.stringify(req.body),
    requestContext: {
      identity: { sourceIp: req.ip || "127.0.0.1" },
    },
  };
}

// -- Helper: respuesta Lambda -> Express res ----------------------------------
async function invoke(handler, req, res) {
  try {
    const event    = toEvent(req);
    const response = await handler(event);
    const body     = JSON.parse(response.body);

    res
      .status(response.statusCode)
      .set(response.headers || {})
      .json(body);
  } catch (err) {
    console.error("Error en handler:", err);
    res.status(500).json({ error: "Error interno del servidor", detail: err.message });
  }
}

// -- App Express --------------------------------------------------------------
const app = express();
app.use(express.json());

// CORS basico para desarrollo
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// -- Servir frontend estatico -------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(join(__dirname, "../frontend")));

// -- Rutas API ----------------------------------------------------------------
app.post("/polls",            (req, res) => invoke(createPoll, req, res));
app.post("/votes",            (req, res) => invoke(vote, req, res));
app.get("/results/:pollId",   (req, res) => invoke(results, req, res));
app.post("/suggest",          (req, res) => invoke(suggestQuestions, req, res));

// -- Arrancar -----------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
+----------------------------------------------------------+
|     CloudPoll - Dev Server en http://localhost:${PORT}       |
+----------------------------------------------------------+
|  Frontend  -> http://localhost:${PORT}                       |
+----------------------------------------------------------+
|  POST   /polls              <- crear encuesta            |
|  POST   /votes              <- registrar voto            |
|  GET    /results/:pollId    <- ver resultados            |
|  POST   /suggest            <- IA (Bedrock)              |
+----------------------------------------------------------+
|  DynamoDB Local -> http://localhost:8000                 |
+----------------------------------------------------------+
  `);
});
