/**
 * api.js
 * Cliente HTTP centralizado para el API de CloudPoll.
 * Todas las llamadas al backend pasan por este modulo.
 */

import CONFIG from "../config.js";

// -- Helper base fetch --------------------------------------------------------
async function request(method, path, body = null, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${CONFIG.API_BASE_URL}${path}`, opts);
  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data   = data;
    throw err;
  }
  return data;
}

// -- Endpoints publicos -------------------------------------------------------

/**
 * Obtiene resultados agregados de una encuesta.
 * GET /results/{pollId}
 */
export async function getResults(pollId) {
  return request("GET", `/results/${pollId}`);
}

/**
 * Registra un voto.
 * POST /votes
 * @param {{ pollId, questionId, optionId }} voteData
 */
export async function castVote(voteData) {
  return request("POST", "/votes", voteData);
}

// -- Endpoints protegidos (requieren JWT) ------------------------------------

/**
 * Crea una nueva encuesta.
 * POST /polls
 * @param {{ title, description, questions }} pollData
 * @param {string} token JWT de Cognito
 */
export async function createPoll(pollData, token) {
  return request("POST", "/polls", pollData, token);
}

/**
 * Solicita sugerencias de preguntas a la IA.
 * POST /suggest
 * @param {string} topic Tema de la encuesta
 * @param {number} numQuestions Cantidad de preguntas (1-10)
 * @param {string} token JWT de Cognito
 */
export async function suggestQuestions(topic, numQuestions = 3, token) {
  return request("POST", "/suggest", { topic, numQuestions }, token);
}
