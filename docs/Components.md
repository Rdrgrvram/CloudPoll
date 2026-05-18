# Componentes - CloudPoll

## Servicios AWS

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
- CORS habilitado para todos los orígenes (MVP).
- Cognito Authorizer aplicado a rutas protegidas.

| Método | Ruta | Protegida | Lambda |
|---|---|---|---|
| POST | `/polls` | ✅ Sí (JWT) | `create-poll` |
| POST | `/votes` | ❌ No | `vote` |
| GET | `/results/{pollId}` | ❌ No | `results` |
| POST | `/suggest` | ✅ Sí (JWT) | `suggest-questions` |

### AWS Lambda — Lógica de Negocio (Node.js 20)

| Función | Ruta | Descripción |
|---|---|---|
| `create-poll` | POST /polls | Valida body, genera UUID, guarda en tabla `Polls` |
| `vote` | POST /votes | Verifica duplicado por IP+pollId, guarda en tabla `Votes` |
| `results` | GET /results/{pollId} | Agrega votos por opción, calcula porcentajes |
| `suggest-questions` | POST /suggest | Llama a Bedrock con el tema recibido, devuelve preguntas sugeridas |

Configuración global:
- Runtime: `nodejs20.x`
- Timeout: `10s`
- Memory: `256 MB`

### Amazon DynamoDB — Base de Datos NoSQL

**Tabla `CloudPoll-Polls`**
- Partition Key: `pollId` (String)
- Atributos adicionales: `title`, `description`, `questions` (List), `createdAt`

**Tabla `CloudPoll-Votes`**
- Partition Key: `pollId` (String)
- Sort Key: `voteId` (String)
- GSI `PollQuestionIndex`: PK=`pollId`, SK=`questionId` (para agregar resultados por pregunta)
- Atributos adicionales: `optionId`, `voterIp`, `timestamp`

### Amazon Bedrock — Inteligencia Artificial
- Modelo: `amazon.titan-text-express-v1`
- Invocado únicamente por la Lambda `suggest-questions`.
- Permiso IAM requerido: `bedrock:InvokeModel`

### AWS IAM — Seguridad y Roles
- `LambdaExecutionRole`: rol compartido con permisos mínimos.
  - `dynamodb:PutItem`, `dynamodb:GetItem`, `dynamodb:Query` en tablas y GSI.
  - `bedrock:InvokeModel` en `suggest-questions`.
  - `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` (CloudWatch).

---

## Flujo de Seguridad

```
1. Admin abre el frontend en S3
2. El frontend redirige a Cognito Hosted UI → Login
3. Cognito devuelve token JWT al frontend
4. Las peticiones a rutas protegidas incluyen: Authorization: Bearer <token>
5. API Gateway valida el token antes de invocar la Lambda
6. Cada Lambda asume el LambdaExecutionRole con permisos mínimos (IAM)
```