# CloudPoll - Sistema de Encuestas Serverless

CloudPoll es una plataforma de encuestas que escala automáticamente ante picos de tráfico, construida íntegramente con servicios serverless de AWS.

## Tecnologías

| Capa | Servicio AWS | Rol |
|---|---|---|
| Frontend estático | Amazon S3 | Aloja la web (HTML/CSS/JS), accesible por admins y votantes |
| Autenticación | Amazon Cognito | User Pool solo para administradores. Emite tokens JWT |
| API | Amazon API Gateway | Enruta peticiones REST; valida JWT en rutas protegidas |
| Lógica de negocio | AWS Lambda (Node.js 20) | 4 funciones: create-poll, vote, results, suggest-questions |
| Base de datos | Amazon DynamoDB | Tablas `CloudPoll-Polls` y `CloudPoll-Votes` (NoSQL, PAY_PER_REQUEST) |
| Inteligencia Artificial | Amazon Bedrock | Genera sugerencias de preguntas para admins (`amazon.titan-text-express`) |
| Seguridad | AWS IAM | Roles de mínimo privilegio por función Lambda |
| CI/CD | GitHub Actions + AWS SAM | Despliegue automatizado vía `template.yml` |

## Estructura del repositorio

```
CloudPoll/
├── template.yml               # Infraestructura como código (AWS SAM)
├── lambdas/
│   ├── create-poll/           # POST /polls  — crea encuesta (solo admins)
│   ├── vote/                  # POST /votes  — registra voto (público)
│   ├── results/               # GET /results/{pollId} — resultados (público)
│   └── suggest-questions/     # POST /suggest — IA de preguntas (solo admins)
├── frontend/                  # Sitio estático desplegado en S3
├── docs/                      # Documentación adicional
└── tests/                     # Pruebas unitarias e integración
```

## Flujo principal

1. **Votante** navega a la web estática en S3, vota sin necesidad de login.
2. **Administrador** hace login en Cognito, obtiene JWT y accede a funciones protegidas.
3. El frontend envía peticiones HTTP al API Gateway.
4. API Gateway valida el JWT (rutas protegidas) y activa la Lambda correspondiente.
5. Lambda lee/escribe en DynamoDB y, si aplica, llama a Bedrock.
