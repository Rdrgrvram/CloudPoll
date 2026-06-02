/**
 * config.js
 * Configuracion centralizada del frontend CloudPoll.
 * Detecta automaticamente entorno local vs produccion.
 */

const isLocal = window.location.hostname === "localhost" ||
                window.location.hostname === "127.0.0.1";

const CONFIG = {
  // URL base del API Gateway (o dev-server local)
  API_BASE_URL: isLocal
    ? "http://localhost:3000"
    : "REPLACE_WITH_API_GATEWAY_URL", // e.g. https://abc123.execute-api.us-east-1.amazonaws.com/v1

  // Cognito — rellenar con los valores reales al desplegar en AWS
  COGNITO_DOMAIN:   "REPLACE_WITH_COGNITO_DOMAIN",  // e.g. cloudpoll.auth.us-east-1.amazoncognito.com
  CLIENT_ID:        "REPLACE_WITH_COGNITO_CLIENT_ID",
  REDIRECT_URI:     isLocal
    ? "http://localhost:3000/admin.html"
    : "REPLACE_WITH_PRODUCTION_REDIRECT_URI",

  // Opciones de la app
  APP_NAME: "CloudPoll",
  VERSION:  "1.0.0",
};

// En modo local, las rutas protegidas no requieren JWT real
CONFIG.IS_LOCAL = isLocal;

export default CONFIG;
