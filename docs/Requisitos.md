# Requisitos - CloudPoll

## Funcionales (MVP)

### RF1 – Autenticación y autorización
- Los administradores inician sesión mediante Amazon Cognito (flujo de código de autorización).
- Solo admins autenticados (token JWT válido) pueden crear encuestas y usar sugerencias de IA.
- Los votantes (público general) pueden votar y ver resultados **sin login**.

### RF2 – Gestión de encuestas
- Crear encuesta con: título, descripción, lista de preguntas y opciones múltiples por pregunta.
- Cada encuesta recibe un ID único (UUID) generado en la Lambda.
- Solo admins pueden crear encuestas (`POST /polls` protegido por Cognito Authorizer).

### RF3 – Votación
- Registrar voto: `pollId`, `questionId`, `optionId`, identificador de usuario (IP o anónimo).
- Evitar votos duplicados por `IP + pollId` (estrategia MVP).
- El voto se almacena de forma asíncrona en DynamoDB.
- Endpoint público: `POST /votes` (sin autenticación requerida).

### RF4 – Resultados
- Consultar resultados agregados por encuesta: totales de votos y porcentajes por opción.
- Endpoint público: `GET /results/{pollId}` (sin autenticación requerida).

### RF5 – Sugerencias de IA (Bedrock)
- Endpoint `POST /suggest` que recibe un **tema** y devuelve sugerencias de preguntas con opciones generadas por Amazon Bedrock (`amazon.titan-text-express`).
- Solo accesible para administradores autenticados.

---

## No Funcionales

| ID | Requisito |
|---|---|
| RNF1 | **Escalabilidad automática** — arquitectura 100% serverless, sin servidores a gestionar |
| RNF2 | **Latencia** — p95 < 200 ms para votar y consultar resultados |
| RNF3 | **Tolerancia a fallos** — ningún voto se pierde; DynamoDB con replicación multi-AZ |
| RNF4 | **Costo por uso** — DynamoDB en `PAY_PER_REQUEST`, Lambda por invocación |
| RNF5 | **Seguridad** — IAM de mínimo privilegio por Lambda, tokens JWT validados por API Gateway |
| RNF6 | **Disponibilidad** — objetivos de disponibilidad heredados de los SLA de AWS (99.9%+) |
