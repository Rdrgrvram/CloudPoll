# Componentes - CloudPoll

## Servicios AWS (Producción)

### Amazon S3 — Frontend Web Estático
- Aloja el sitio web (HTML, CSS, JavaScript).
- Accesible por admins y votantes desde el navegador.
- Static website hosting habilitado; distribución opcional vía CloudFront.

### Amazon Cognito — Autenticación de Administradores
- User Pool `cloudpoll-users` con grupo `Admins`.
- App Client sin secreto, flujo de **código de autorización**.
- Emite tokens JWT usados como `Authorization: Bearer <token>` en el API.

### Amazon API Gateway — Endpoints REST
- Stage: `v1`
- CORS habilitado (`GET, POST, OPTIONS`).
- Cognito Authorizer aplicado a rutas protegidas.

| Método | Ruta | Auth | Lambda |
|---|---|---|---|
| POST | `/polls` | ✅ JWT (Cognito) | `create-poll` |
| POST | `/votes` | ❌ Pública | `vote` |
| GET | `/results/{pollId}` | ❌ Pública | `results` |
| POST | `/suggest` | ✅ JWT (Cognito) | `suggest-questions` |

### AWS Lambda — Lógica de Negocio (Node.js 20)

| Función | Ruta | Descripción |
|---|---|---|
| `create-poll` | POST /polls | Valida body, genera UUID v4, guarda en tabla `Polls` con `ConditionExpression` anti-duplicado |
| `vote` | POST /votes | Extrae IP del votante, aplica patrón `DUP#<ip>#<pollId>` para deduplicación atómica en DynamoDB |
| `results` | GET /results/{pollId} | Consulta paginada de votos, filtra guards de duplicado, agrega conteos y porcentajes por opción |
| `suggest-questions` | POST /suggest | Construye prompt para Bedrock Titan, parsea JSON con regex fallback, devuelve preguntas sugeridas |

Configuración global (SAM Globals):
- Runtime: `nodejs20.x`
- Timeout: `10s`
- Memory: `256 MB`

**Módulo compartido `db.js`** (en cada Lambda):
- Detecta `DYNAMODB_ENDPOINT` en el entorno.
- En local: usa credenciales ficticias (`local/local`) apuntando a DynamoDB Local.
- En AWS: usa el cliente por defecto con credenciales IAM del rol.

### Amazon DynamoDB — Base de Datos NoSQL

**Tabla `CloudPoll-Polls`**
- Partition Key: `pollId` (String, UUID)
- Atributos: `title`, `description`, `questions` (List), `createdAt`, `status`

**Tabla `CloudPoll-Votes`**
- Partition Key: `pollId` (String)
- Sort Key: `voteId` (String, UUID o `DUP#<ip>#<pollId>`)
- GSI `PollQuestionIndex`: PK=`pollId`, SK=`questionId`
- Atributos: `optionId`, `voterIp`, `timestamp`

> **Patrón anti-duplicado**: Por cada voto se insertan 2 items — el voto real y un guard `DUP#<ip>#<pollId>` con `ConditionExpression: attribute_not_exists(voteId)`. Si el guard ya existe, se retorna 409.

### Amazon Bedrock — Inteligencia Artificial
- Modelo: `amazon.titan-text-express-v1`
- Invocado únicamente por la Lambda `suggest-questions`.
- Permiso IAM requerido: `bedrock:InvokeModel`
- Región recomendada: `us-east-1`

### AWS IAM — Seguridad y Roles
- `LambdaExecutionRole`: rol compartido con permisos mínimos.
  - `dynamodb:PutItem`, `dynamodb:GetItem`, `dynamodb:Query`, `dynamodb:UpdateItem` en tablas y GSI.
  - `bedrock:InvokeModel` para la Lambda `suggest-questions`.
  - `AWSLambdaBasicExecutionRole` (CloudWatch Logs).

---

## Entorno Local de Desarrollo

| Componente | Tecnología | Propósito |
|---|---|---|
| `docker-compose.yml` | `amazon/dynamodb-local` | DynamoDB Local en Docker, puerto 8000 |
| `scripts/setup-local.js` | Node.js + AWS SDK v3 | Crea las 2 tablas con GSI |
| `scripts/seed-local.js` | Node.js + AWS SDK v3 | Inserta encuesta y votos de prueba |
| `scripts/dev-server.js` | Express + ES Modules | Servidor HTTP que invoca los handlers Lambda directamente |
| `env.local.json` | JSON | Variables de entorno para SAM (legacy, usar `npm run dev` en su lugar) |

### Flujo local

```
npm run dev
     │
     ├── Carga process.env (DYNAMODB_ENDPOINT=http://localhost:8000)
     ├── Importa handlers de lambdas/*/index.js
     └── Express escucha en :3000
              │
              ▼
         DynamoDB Local (Docker) en :8000
```

---

## Flujo de Seguridad (Producción)

```
1. Admin abre el frontend en S3
2. El frontend redirige a Cognito Hosted UI → Login
3. Cognito devuelve token JWT al frontend
4. Las peticiones a rutas protegidas incluyen: Authorization: Bearer <token>
5. API Gateway valida el token antes de invocar la Lambda
6. Cada Lambda asume el LambdaExecutionRole con permisos mínimos (IAM)
```