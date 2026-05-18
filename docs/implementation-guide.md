# Guía de Implementación - CloudPoll

## Pre-requisitos

- Cuenta AWS con permisos de administrador (IAM, Lambda, DynamoDB, Cognito, Bedrock, S3)
- AWS CLI configurado (`aws configure`)
- Node.js 20+
- AWS SAM CLI (`brew install aws-sam-cli` / `pip install aws-sam-cli`)

---

## Paso 1: Cognito

1. Crear User Pool `cloudpoll-users`:
   ```bash
   aws cognito-idp create-user-pool --pool-name cloudpoll-users
   ```
2. Crear grupo `Admins` dentro del User Pool.
3. Crear App Client **sin secreto**, con flujo de código de autorización:
   ```bash
   aws cognito-idp create-user-pool-client \
     --user-pool-id <USER_POOL_ID> \
     --client-name cloudpoll-app \
     --no-generate-secret \
     --allowed-o-auth-flows code \
     --allowed-o-auth-scopes openid email
   ```
4. Anotar `User Pool ID` y `App Client ID` — se usarán en el template SAM y el frontend.

---

## Paso 2: Desplegar infraestructura con SAM

```bash
# Desde la raíz del proyecto
sam build
sam deploy --guided
```

El wizard de `--guided` pedirá:
- Stack name: `cloudpoll`
- AWS Region: (tu región, ej. `us-east-1`)
- Confirmar cambios antes de desplegar: `Y`

Esto crea automáticamente:
- Tablas DynamoDB (`CloudPoll-Polls`, `CloudPoll-Votes`)
- Las 4 funciones Lambda
- API Gateway con stage `v1`
- Roles IAM

---

## Paso 3: Crear tablas DynamoDB (alternativa manual)

Si prefieres crearlas manualmente antes del deploy SAM:

```bash
# Tabla Polls
aws dynamodb create-table \
  --table-name CloudPoll-Polls \
  --attribute-definitions AttributeName=pollId,AttributeType=S \
  --key-schema AttributeName=pollId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# Tabla Votes
aws dynamodb create-table \
  --table-name CloudPoll-Votes \
  --attribute-definitions \
      AttributeName=pollId,AttributeType=S \
      AttributeName=voteId,AttributeType=S \
      AttributeName=questionId,AttributeType=S \
  --key-schema \
      AttributeName=pollId,KeyType=HASH \
      AttributeName=voteId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes '[
      {
          "IndexName": "PollQuestionIndex",
          "KeySchema": [
              {"AttributeName":"pollId","KeyType":"HASH"},
              {"AttributeName":"questionId","KeyType":"RANGE"}
          ],
          "Projection":{"ProjectionType":"ALL"}
      }
  ]'
```

---

## Paso 4: Desplegar el Frontend en S3

1. Crear bucket S3 con static website hosting:
   ```bash
   aws s3 mb s3://cloudpoll-frontend-<tu-cuenta>
   aws s3 website s3://cloudpoll-frontend-<tu-cuenta> \
     --index-document index.html --error-document index.html
   ```
2. Subir archivos del frontend:
   ```bash
   aws s3 sync ./frontend s3://cloudpoll-frontend-<tu-cuenta> --acl public-read
   ```
3. Actualizar `frontend/config.js` con la URL del API Gateway obtenida del output de SAM.

---

## Paso 5: Habilitar Bedrock

Activar el modelo `amazon.titan-text-express-v1` en la consola AWS Bedrock (requiere habilitación manual en la primera vez, región `us-east-1` recomendada).

---

## Paso 6: Verificación

```bash
# Crear encuesta (requiere token JWT de Cognito)
curl -X POST https://<api-id>.execute-api.<region>.amazonaws.com/v1/polls \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","description":"Demo","questions":[]}'

# Votar (sin auth)
curl -X POST https://<api-id>.execute-api.<region>.amazonaws.com/v1/votes \
  -H "Content-Type: application/json" \
  -d '{"pollId":"<uuid>","questionId":"q1","optionId":"o1"}'

# Ver resultados (sin auth)
curl https://<api-id>.execute-api.<region>.amazonaws.com/v1/results/<pollId>
```