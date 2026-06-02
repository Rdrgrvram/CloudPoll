/**
 * auth.js
 * Manejo de autenticacion Cognito para el panel de administrador.
 *
 * Flujo:
 *   1. Admin hace clic en "Iniciar sesion" -> redirige a Cognito Hosted UI
 *   2. Cognito redirige a redirect_uri con ?code=...
 *   3. Este modulo detecta el code y lo intercambia por tokens (PKCE flow simplificado)
 *   4. En modo local, simula autenticacion sin Cognito real
 */

import CONFIG from "../config.js";

const TOKEN_KEY = "cloudpoll_access_token";
const USER_KEY  = "cloudpoll_user";

// -- Getters ------------------------------------------------------------------

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  if (CONFIG.IS_LOCAL) {
    // En local, verificamos si hay un token de sesion simulado
    return !!sessionStorage.getItem(TOKEN_KEY);
  }
  return !!getToken();
}

// -- Login / Logout -----------------------------------------------------------

/**
 * Redirige al usuario a la Cognito Hosted UI para iniciar sesion.
 * En modo local, simula un login directo.
 */
export function login() {
  if (CONFIG.IS_LOCAL) {
    // Modo local: simular login con token ficticio
    sessionStorage.setItem(TOKEN_KEY, "local-dev-token");
    sessionStorage.setItem(USER_KEY, JSON.stringify({
      name: "Admin Local",
      email: "admin@localhost",
    }));
    window.dispatchEvent(new Event("auth:login"));
    return;
  }

  // Modo produccion: redirigir a Cognito Hosted UI
  const params = new URLSearchParams({
    response_type: "code",
    client_id:     CONFIG.CLIENT_ID,
    redirect_uri:  CONFIG.REDIRECT_URI,
    scope:         "openid email profile",
  });

  window.location.href = `https://${CONFIG.COGNITO_DOMAIN}/oauth2/authorize?${params}`;
}

/**
 * Cierra la sesion eliminando los tokens del sessionStorage.
 */
export function logout() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("auth:logout"));
}

/**
 * Maneja el callback de Cognito con el codigo de autorizacion.
 * Debe llamarse en la pagina de redirect_uri.
 * En modo local no hace nada porque login() ya establece el token.
 */
export async function handleCallback() {
  if (CONFIG.IS_LOCAL) return false;

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) return false;

  try {
    // Intercambiar el codigo por tokens en el endpoint de Cognito
    const body = new URLSearchParams({
      grant_type:   "authorization_code",
      client_id:    CONFIG.CLIENT_ID,
      redirect_uri: CONFIG.REDIRECT_URI,
      code,
    });

    const res = await fetch(`https://${CONFIG.COGNITO_DOMAIN}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) throw new Error("Error al obtener token");

    const tokens = await res.json();
    sessionStorage.setItem(TOKEN_KEY, tokens.access_token);

    // Decodificar el id_token para obtener el nombre del usuario
    if (tokens.id_token) {
      const payload = JSON.parse(atob(tokens.id_token.split(".")[1]));
      sessionStorage.setItem(USER_KEY, JSON.stringify({
        name:  payload.name || payload["cognito:username"] || "Admin",
        email: payload.email || "",
      }));
    }

    // Limpiar el code de la URL
    window.history.replaceState({}, document.title, window.location.pathname);
    window.dispatchEvent(new Event("auth:login"));
    return true;
  } catch (err) {
    console.error("Error en callback de Cognito:", err);
    return false;
  }
}
