# Arquitectura - CloudPoll

Diagrama de arquitectura de la plataforma de encuestas serverless **CloudPoll**, basado en servicios de AWS.

```mermaid
flowchart TD
    %% ── Actores ──────────────────────────────────────────
    subgraph Usuarios["🌐 Usuarios (Navegador)"]
        Admin["👤 Administradores"]
        Voter["👥 Votantes"]
    end

    %% ── AWS Cloud ────────────────────────────────────────
    subgraph AWS["☁️ AWS Cloud — CloudPoll"]

        Cognito["🔐 AWS Cognito\nAutenticación"]
        S3["🗂️ AWS S3\nFrontend / Web Estática"]

        subgraph APILayer["API Layer"]
            APIGW["◆ API Gateway\nEndpoints REST"]
            IAM["🛡️ AWS IAM\nSeguridad / Roles"]
        end

        subgraph LogicLayer["⚙️ Lógica y Procesamiento"]
            Lambda["λ AWS Lambda\nLógica de Votación y Encuestas"]
        end

        subgraph DataLayer["💾 Datos e IA"]
            DynamoDB[("🗄️ AWS DynamoDB\nBase de Datos NoSQL")]
            Bedrock["🤖 Amazon Bedrock\nInteligencia Artificial"]
        end

    end

    %% ── Flujo Principal ──────────────────────────────────
    Admin    -- "1. Login" -->                Cognito
    Cognito  -- "2. Token válido" -->         S3
    Voter    -- "1. Navega a la web" -->      S3

    S3       -- "3. Peticiones HTTP" -->      APIGW
    IAM      -. "Protege y Autoriza" .->      Lambda

    APIGW    -- "4. Activa Función" -->       Lambda

    Lambda   -- "5. Guarda / Lee Votos" -->   DynamoDB
    Lambda   -- "6. Pide sugerencias" -->     Bedrock
    Bedrock  -- "7. Devuelve opciones" -->    Lambda

    %% ── Estilos ──────────────────────────────────────────
    classDef aws        fill:#FF9900,stroke:#232F3E,color:#232F3E,font-weight:bold
    classDef actor      fill:#1A1A2E,stroke:#FF9900,color:#FF9900,font-weight:bold
    classDef data       fill:#3ABFBF,stroke:#232F3E,color:#232F3E,font-weight:bold
    classDef security   fill:#DD344C,stroke:#232F3E,color:#fff,font-weight:bold
    classDef subgraphBg fill:#1E2A3A,stroke:#4A90D9,color:#fff

    class Admin,Voter actor
    class Cognito,S3,APIGW,Lambda aws
    class DynamoDB,Bedrock data
    class IAM security
```

---

## Descripción del flujo

| Paso | Actor / Servicio | Acción |
|---|---|---|
| 1a | **Admin → Cognito** | El administrador inicia sesión. Cognito valida credenciales y emite un token JWT. |
| 1b | **Votante → S3** | El votante navega directamente al frontend estático en S3 sin autenticación. |
| 2 | **Cognito → S3** | Token JWT válido; el admin es redirigido al frontend con el token en memoria. |
| 3 | **S3 → API Gateway** | El frontend envía peticiones HTTP (con o sin JWT según la ruta). |
| 4 | **API Gateway → Lambda** | API Gateway valida el JWT en rutas protegidas y activa la función Lambda correspondiente. |
| 5 | **Lambda ↔ DynamoDB** | Lambda lee y escribe votos y encuestas en DynamoDB. |
| 6 | **Lambda → Bedrock** | Para sugerencias de preguntas, Lambda invoca Amazon Bedrock con el tema indicado. |
| 7 | **Bedrock → Lambda** | Bedrock devuelve las preguntas y opciones generadas; Lambda las retorna al cliente. |

---

## Endpoints y autenticación

| Método | Ruta | Auth | Lambda |
|---|---|---|---|
| `POST` | `/polls` | ✅ JWT (Cognito) | `create-poll` |
| `POST` | `/votes` | ❌ Pública | `vote` |
| `GET` | `/results/{pollId}` | ❌ Pública | `results` |
| `POST` | `/suggest` | ✅ JWT (Cognito) | `suggest-questions` |
