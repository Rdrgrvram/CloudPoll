# Documento Final del Proyecto: CloudPoll ☁️📊
### Plataforma de Encuestas Serverless con Amazon Web Services

---

## 1. Resumen Ejecutivo
**CloudPoll** es una solución de software moderna diseñada para facilitar la creación de encuestas, el registro de votos y el análisis de resultados en tiempo real. Utilizando un enfoque arquitectónico **100% Serverless** en Amazon Web Services (AWS), CloudPoll elimina la necesidad de aprovisionar o gestionar servidores web o de bases de datos. Esto resulta en una plataforma altamente disponible, con escalabilidad automática horizontal y un modelo de facturación puramente basado en el consumo directo (costo cero cuando la plataforma no tiene uso).

Adicionalmente, el sistema integra capacidades de Inteligencia Artificial Generativa a través de **Amazon Bedrock** para asistir a los administradores en el diseño y redacción de las preguntas de sus encuestas de forma automatizada.

---

## 2. Objetivos del Proyecto
1. **Diseñar** e implementar una arquitectura web desacoplada de alto rendimiento y bajo costo operativo.
2. **Desarrollar** una interfaz frontend interactiva, responsive y moderna utilizando tecnologías web puras (HTML5, CSS3, JavaScript ES Modules) adaptada para el alojamiento estático.
3. **Asegurar** la persistencia e integridad de los datos mediante un motor NoSQL (DynamoDB), aplicando técnicas avanzadas de modelado para el control de concurrencia y deduplicación de votos.
4. **Implementar** seguridad perimetral de grado empresarial mediante autorización basada en JSON Web Tokens (JWT) provistos por Amazon Cognito y validados por AWS API Gateway.
5. **Configurar** un entorno local portátil con Docker y herramientas de scripting para el desarrollo continuo y pruebas automatizadas de cobertura completa.

---

## 3. Requisitos del Sistema

### 3.1 Requisitos Funcionales (RF)
* **RF1 – Autenticación y Autorización**: El panel de administración está restringido únicamente a usuarios registrados en el User Pool de Amazon Cognito con privilegios correspondientes. Los votantes generales pueden acceder a votar y ver resultados sin autenticación.
* **RF2 – Creación de Encuestas**: El administrador puede ingresar el título, la descripción, definir múltiples preguntas y asociar opciones de respuesta para cada una. Cada encuesta recibe un identificador único (UUID).
* **RF3 – Votación Pública**: Admite el ingreso de un voto para cualquier encuesta activa seleccionando una opción por pregunta.
* **RF4 – Control Anti-Duplicado**: Bloqueo atómico a nivel de persistencia de votos repetidos originados desde una misma dirección IP para una misma encuesta.
* **RF5 – Visualización de Resultados**: Gráficos interactivos de actualización en tiempo real que reflejan el número de votos acumulados y el porcentaje de participación por cada opción de respuesta.
* **RF6 – Sugerencias por IA**: Asistencia automatizada para el diseño de encuestas sobre cualquier tema sugerido por el administrador empleando modelos fundacionales de lenguaje.

### 3.2 Requisitos No Funcionales (RNF)
* **RNF1 – Escalabilidad**: Adaptación dinámica para soportar desde unos pocos usuarios hasta miles de votantes concurrentes de manera elástica.
* **RNF2 – Latencia**: Tiempos de respuesta para las llamadas públicas inferiores a 200 ms.
* **RNF3 – Costo por Uso**: Adopción de servicios serverless bajo esquemas On-Demand (Lambda, DynamoDB PAY_PER_REQUEST, S3 Static Web Hosting).
* **RNF4 – Seguridad de Mínimo Privilegio**: Configuración estricta de políticas de roles IAM para cada función Lambda.

---

## 4. Arquitectura del Sistema
El sistema sigue un patrón de diseño desacoplado (Decoupled Frontend-Backend Architecture):

```
       [ CLIENTE WEB ] (HTML5 / CSS3 / JS Vanilla)
              │
      Peticiones HTTP (REST)
              │
              ▼
      [ API GATEWAY ] (Rutas Públicas y Protegidas con Cognito JWT)
              │
      Invocaciones de Evento
              │
              ▼
     [ FUNCIONES LAMBDA ] (Node.js 20 - Runtime de Ejecución)
         ├── create-poll ──► DynamoDB (CloudPoll-Polls)
         ├── vote ─────────► DynamoDB (CloudPoll-Votes)
         ├── results ──────► DynamoDB (Polls & Votes)
         └── suggest ──────► Amazon Bedrock (Titan Express v1)
```

---

## 5. Diseño y Persistencia de Base de Datos (DynamoDB)

Se implementaron dos tablas en Amazon DynamoDB que operan bajo un modelo NoSQL eficiente optimizado para consultas específicas:

### 5.1 Tabla: `CloudPoll-Polls`
Almacena el registro principal de las encuestas creadas por los administradores.
* **Clave de Partición (PK)**: `pollId` (String, UUIDv4).
* **Estructura del Registro**:
  ```json
  {
    "pollId": "c4d72856-bb6b-4e89-9dbb-8cc7fa608930",
    "title": "Encuesta Tecnológica",
    "description": "Preferencia de herramientas de desarrollo",
    "createdAt": "2026-06-02T21:13:11.864Z",
    "status": "active",
    "questions": [
      {
        "questionId": "q1",
        "text": "¿Cuál es tu framework favorito?",
        "options": [
          { "optionId": "o1", "text": "React" },
          { "optionId": "o2", "text": "Vue" }
        ]
      }
    ]
  }
  ```

### 5.2 Tabla: `CloudPoll-Votes`
Almacena los votos reales y los registros de deduplicación.
* **Clave de Partición (PK)**: `pollId` (String).
* **Clave de Ordenación (SK)**: `voteId` (String, UUIDv4 para votos reales; o `DUP#<voterIp>#<pollId>` para el control de duplicados).
* **Índice Secundario Global (GSI)**: `PollQuestionIndex` (PK: `pollId`, SK: `questionId`). Permite consultar rápidamente todos los votos filtrados por pregunta.

### 5.3 Lógica de Deduplicación Atómica
Por cada voto válido, la función Lambda `vote` inserta de manera concurrente dos ítems en la tabla de votos:
1. El registro del voto real conteniendo la elección realizada (`questionId`, `optionId`, `voterIp`).
2. Un registro de control (*guard*) donde el `voteId` se define explícitamente como `DUP#<ip>#<pollId>`.

Al insertar este guardia, se aplica la expresión condicional:
`ConditionExpression: "attribute_not_exists(voteId)"`

Si el usuario con esa IP ya ha votado en esa encuesta, el guard existirá y la escritura en DynamoDB fallará a nivel atómico con un error `ConditionalCheckFailedException`. Esto cancela toda la transacción, evitando el doble voto y retornando un HTTP `409 Conflict`.

---

## 6. Módulos y Diseño del Frontend
El frontend se construyó utilizando componentes nativos estáticos alojados en un bucket de Amazon S3, maximizando la velocidad de carga y eliminando costos de ejecución de servidor.

* **Hoja de Estilos (`css/styles.css`)**: Implementa un sistema de diseño responsivo basado en CSS Grid y Flexbox. La interfaz está construida con una temática oscura premium, efectos de desenfoque de fondo (glassmorphism), variables de tipografía moderna y micro-animaciones en los botones y barras de progreso.
* **Módulo API (`js/api.js`)**: Cliente centralizado que abstrae las llamadas HTTP al backend, incorporando manejo automático de cabeceras de autorización y control de errores HTTP.
* **Módulo Auth (`js/auth.js`)**: Modulo encargado de gestionar los tokens JWT procedentes del flujo de autenticación de Amazon Cognito y almacenar las sesiones de administrador de manera segura en el almacenamiento de sesión local (`sessionStorage`). Incluye un simulador automático para desarrollo en entorno local.

---

## 7. Backend y Funciones Lambda
Escritas en Node.js 20 utilizando el SDK de AWS v3. Se estructuran bajo el estándar ES Modules (`import/export`):
* **`create-poll`**: Valida los cuerpos de datos entrantes, crea la estructura de la encuesta y la inserta en la base de datos.
* **`vote`**: Extrae de forma confiable la IP de origen del evento de API Gateway y realiza las inserciones del voto y del guardián anti-duplicados de forma concurrente.
* **`results`**: Recupera los metadatos de la encuesta y realiza una query optimizada para contar los votos agrupados por pregunta y opción, calculando los porcentajes exactos de respuesta.
* **`suggest-questions`**: Interactúa con la API de Amazon Bedrock construyendo un prompt enfocado para obtener preguntas estructuradas en formato JSON estructurado listo para inyectarse al panel de administración.

---

## 8. Calidad y Pruebas
Se cuenta con una cobertura completa de integración localizada en `tests/api.test.js` la cual utiliza el Test Runner nativo de Node.js. 

Las pruebas:
1. Validan la integridad de los datos de entrada en las rutas públicas y protegidas.
2. Comprueban la creación correcta de registros en DynamoDB Local.
3. Aseguran que la lógica anti-duplicados rechace efectivamente registros de IP concurrentes.
4. Mokean de manera exitosa los controladores de Bedrock Runtime para asegurar la independencia de ejecución en despliegues e integraciones continuas locales sin requerir credenciales activas de AWS.

---

## 9. Instrucciones de Operación y Despliegue

### 9.1 Ejecución Local (Desarrollo)
1. Levantar el servicio de DynamoDB Local en Docker:
   ```bash
   docker compose up -d
   ```
2. Inicializar la estructura de las tablas locales:
   ```bash
   npm run setup-local
   ```
3. Sembrar datos de prueba:
   ```bash
   npm run seed
   ```
4. Levantar el servidor web y API local:
   ```bash
   npm run dev
   ```
   *Acceso al frontend:* http://localhost:3000

### 9.2 Ejecución de Pruebas
```bash
npm test
```

### 9.3 Despliegue en AWS (Producción)
1. Crear el User Pool y App Client de Amazon Cognito desde la CLI o consola de AWS.
2. Compilar y empaquetar el stack de SAM:
   ```bash
   sam build
   ```
3. Desplegar los recursos indicando el ARN de Cognito configurado:
   ```bash
   sam deploy --guided --parameter-overrides CognitoUserPoolArn=<ARN_COGNITO>
   ```
4. Crear un bucket de S3 para Hosting Estático y subir los archivos del frontend:
   ```bash
   aws s3 sync ./frontend s3://<nombre-bucket-frontend> --acl public-read
   ```
5. Configurar el archivo `frontend/config.js` apuntando a la URL final generada por API Gateway en los Outputs del despliegue de SAM.

---

## 10. Conclusión
El desarrollo de **CloudPoll** demuestra la viabilidad de implementar sistemas interactivos de alta performance y escalabilidad infinita a costos marginales mínimos utilizando arquitecturas Serverless en AWS. Gracias al desacoplamiento físico del frontend y el backend, la plataforma garantiza una rápida entrega de contenidos estáticos combinada con una API REST robusta que maneja de forma segura la autenticación empresarial (Cognito), la persistencia atómica compleja (DynamoDB) y asistentes cognitivos automatizados (Bedrock).
