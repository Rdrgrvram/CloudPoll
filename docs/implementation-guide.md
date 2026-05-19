# Guía de Implementación - CloudPoll

---

## 🖥️ ENTORNO LOCAL (desarrollo y demo)

> Para probar el proyecto sin cuenta AWS. Solo necesitas **Node.js 20+** y **Docker Desktop**.

### Pre-requisitos locales

- Node.js 20+
- Docker Desktop corriendo

### Paso a paso

**1. Instalar dependencias**
```bash
npm install
```

**2. Levantar DynamoDB Local**
```bash
docker compose up -d
```

**3. Crear tablas y cargar datos de prueba**
```bash
npm run setup-local   # crea CloudPoll-Polls y CloudPoll-Votes
npm run seed          # inserta 1 encuesta + 7 votos de prueba
```

**4. Iniciar el servidor de desarrollo**
```bash
npm run dev
# → API disponible en http://localhost:3000
```

### Endpoints disponibles localmente

```powershell
# Ver resultados de la encuesta de prueba
Invoke-RestMethod http://localhost:3000/results/poll-test-001 | ConvertTo-Json -Depth 5

# Registrar un voto
$body = '{"pollId":"poll-test-001","questionId":"q1","optionId":"o1"}'
Invoke-RestMethod -Uri http://localhost:3000/votes -Method POST -Body $body -ContentType "application/json"

# Crear una encuesta nueva
$poll = '{"title":"Mi encuesta","description":"Demo","questions":[{"questionId":"q1","text":"¿Pregunta?","options":[{"optionId":"o1","text":"Sí"},{"optionId":"o2","text":"No"}]}]}'
Invoke-RestMethod -Uri http://localhost:3000/polls -Method POST -Body $poll -ContentType "application/json"
```

> **Nota**: En el entorno local las rutas protegidas (`/polls`, `/suggest`) **no validan JWT** — el auth se aplica solo en AWS vía Cognito Authorizer.

### Scripts disponibles

| Comando | Acción |
|---|---|
| `npm run dev` | Inicia el servidor Express local (invoca Lambdas directamente) |
| `npm run setup-local` | Crea las tablas en DynamoDB Local |
| `npm run seed` | Inserta encuesta y votos de prueba |

---

## ☁️ ENTORNO AWS (producción)

### Pre-requisitos cloud

- Cuenta AWS con permisos de administrador
- AWS CLI configurado (`aws configure`)
- AWS SAM CLI instalado
- Node.js 20+

---

### Paso 1: Cognito

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
4. Anotar `User Pool ID` y `App Client ID` — se usan en el template SAM y el frontend.

---

### Paso 2: Desplegar infraestructura con SAM

```bash
# Desde la raíz del proyecto
sam build
sam deploy --guided \
  --parameter-overrides CognitoUserPoolArn=arn:aws:cognito-idp:<region>:<account>:userpool/<pool-id>
```

El wizard pedirá:
- Stack name: `cloudpoll`
- AWS Region: `us-east-1` (recomendada para Bedrock)
- Confirmar cambios: `Y`

Esto crea automáticamente:
- Tablas DynamoDB (`CloudPoll-Polls`, `CloudPoll-Votes`) con GSI
- Las 4 funciones Lambda con roles IAM
- API Gateway con Cognito Authorizer en stage `v1`

---

### Paso 3: Desplegar el Frontend en S3

1. Crear bucket:
   ```bash
   aws s3 mb s3://cloudpoll-frontend-<tu-cuenta>
   aws s3 website s3://cloudpoll-frontend-<tu-cuenta> \
     --index-document index.html --error-document index.html
   ```
2. Subir archivos:
   ```bash
   aws s3 sync ./frontend s3://cloudpoll-frontend-<tu-cuenta> --acl public-read
   ```
3. Actualizar `frontend/config.js` con la URL del API Gateway del output de SAM.

---

### Paso 4: Habilitar Bedrock

Activar el modelo `amazon.titan-text-express-v1` en la consola de Amazon Bedrock (región `us-east-1`). Requiere habilitación manual la primera vez.

---

### Paso 5: Verificación en AWS

```bash
# Obtener URL del API
aws cloudformation describe-stacks --stack-name cloudpoll \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text

# Crear encuesta (requiere JWT de Cognito)
curl -X POST https://<api-id>.execute-api.<region>.amazonaws.com/v1/polls \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","description":"Demo","questions":[{"questionId":"q1","text":"¿Pregunta?","options":[{"optionId":"o1","text":"Sí"},{"optionId":"o2","text":"No"}]}]}'

# Votar (sin auth)
curl -X POST https://<api-id>.execute-api.<region>.amazonaws.com/v1/votes \
  -H "Content-Type: application/json" \
  -d '{"pollId":"<uuid>","questionId":"q1","optionId":"o1"}'

# Ver resultados (sin auth)
curl https://<api-id>.execute-api.<region>.amazonaws.com/v1/results/<pollId>
```