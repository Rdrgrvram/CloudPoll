# Guión de Presentación Oral: CloudPoll ☁️📊

Este guión está estructurado para una presentación de **7 a 8 minutos**, detallando qué mostrar en pantalla y qué decir textualmente, incluyendo las aclaraciones sobre el entorno de simulación local.

---

## Diapositiva 1: Portada y Presentación
* **Visual / Acción**: Mostrar la diapositiva de portada con el título de CloudPoll. Tener abierta la aplicación web en [http://localhost:3000](http://localhost:3000) en otra pestaña del navegador.
* **Tiempo estimado**: 0:45 min
* **Narración**:
  > *"Buenas tardes a todos. Hoy les presento **CloudPoll**, una plataforma moderna de encuestas en tiempo real construida bajo un enfoque arquitectónico **100% serverless** en Amazon Web Services (AWS) y asistida por Inteligencia Artificial.
  > 
  > Antes de iniciar con los detalles técnicos, cabe destacar que **para esta demostración estamos ejecutando un entorno de simulación local**. La base de datos corre en un contenedor Docker de DynamoDB y la API junto al frontend se sirven mediante un servidor Express local. Esto nos permite emular el comportamiento exacto de la nube de AWS sin incurrir en costos de infraestructura durante el desarrollo y evaluación, aunque todo el stack está completamente listo para producción con AWS SAM."*

---

## Diapositiva 2: El Desafío y la Solución
* **Visual / Acción**: Mostrar la diapositiva con los puntos del Problema (costos fijos, saturación de servidores) y la Solución (serverless, pago por uso, escalado elástico).
* **Tiempo estimado**: 1:00 min
* **Narración**:
  > *"Cuando diseñamos sistemas de votación o encuestas en vivo, el mayor reto es la predictibilidad del tráfico. Un servidor tradicional encendido continuamente genera costos fijos altos y puede colapsar ante picos masivos de usuarios concurrentes.
  > 
  > Con **CloudPoll**, solucionamos esto eliminando los servidores gestionados. En su lugar, utilizamos un modelo orientado a eventos donde solo se paga por milisegundo de ejecución cuando un usuario emite un voto o crea una encuesta. Si la plataforma no tiene uso, el costo es literalmente **cero**. Todo esto garantizando la privacidad de los votantes mediante un control estricto de accesos para administradores."*

---

## Diapositiva 3: Arquitectura Técnica en AWS y Simulación Local
* **Visual / Acción**: Mostrar el diagrama de arquitectura y señalar los servicios equivalentes locales.
* **Tiempo estimado**: 1:15 min
* **Narración**:
  > *"Nuestra arquitectura en la nube está completamente desacoplada. El frontend estático se aloja en **Amazon S3** y las peticiones HTTP REST pasan por **Amazon API Gateway**, que distribuye el tráfico a cuatro funciones **AWS Lambda** escritas en Node.js 20. La persistencia se maneja en **Amazon DynamoDB** y la inteligencia artificial a través de **Amazon Bedrock**.
  > 
  > ¿Cómo simulamos esto hoy de forma local para la demo?
  > Primero, la base de datos corre en un contenedor Docker local que replica la estructura física y de índices de DynamoDB de forma exacta.
  > Segundo, en lugar de subir las Lambdas a AWS, nuestro servidor local Express importa el código original de las Lambdas directamente y simula los eventos de API Gateway. 
  > Y tercero, el inicio de sesión del administrador está emulado en local para facilitar las pruebas del panel sin requerir una cuenta activa de Cognito."*

---

## Diapositiva 4: Seguridad y Autorización
* **Visual / Acción**: Mostrar los puntos de autenticación de administradores frente a votantes públicos.
* **Tiempo estimado**: 1:00 min
* **Narración**:
  > *"La seguridad está integrada desde el diseño. Dividimos el acceso en dos perfiles claramente diferenciados:
  > Por un lado, los **Votantes Públicos** acceden a rutas totalmente abiertas para agilizar el voto sin fricciones.
  > Por otro lado, los **Administradores** requieren autenticación administrada por **Amazon Cognito**.
  > 
  > La validación de los tokens JWT se realiza a nivel perimetral en **API Gateway**. Si una petición no autorizada intenta acceder al backend, es rechazada en la frontera de red. La Lambda nunca se ejecuta, lo que previene costos innecesarios por llamadas maliciosas."*

---

## Diapositiva 5: El Algoritmo Anti-Duplicado
* **Visual / Acción**: Ir al navegador ([http://localhost:3000/vote.html?pollId=poll-test-001](http://localhost:3000/vote.html?pollId=poll-test-001)), emitir un voto de prueba e intentar votar una segunda vez para mostrar la alerta roja de conflicto (HTTP 409).
* **Tiempo estimado**: 1:00 min
* **Narración**:
  > *"Para evitar que un usuario altere los resultados votando múltiples veces de forma anónima, implementamos una estrategia de **deduplicación atómica en DynamoDB**.
  > 
  > Por cada voto, la Lambda extrae la IP pública del votante y guarda de forma concurrente un registro con la clave `DUP#IP#PollId`. Utilizando una expresión condicional de DynamoDB, la base de datos aborta la transacción si la clave ya existe. Esto nos permite bloquear el voto duplicado en milisegundos a nivel de almacenamiento y responder inmediatamente con un código HTTP 409 Conflict."*

---

## Diapositiva 6: Asistente de Preguntas con IA (Amazon Bedrock)
* **Visual / Acción**: Ir a la pestaña **Admin**, iniciar sesión en el simulador, ir a **Sugerencias IA**, ingresar un tema rápido como 'Desarrollo de Software', presionar "Generar con IA" e importar las preguntas resultantes al creador de encuestas.
* **Tiempo estimado**: 1:00 min
* **Narración**:
  > *"Para asistir al administrador, conectamos la plataforma con **Amazon Bedrock** utilizando el modelo Titan Text Express.
  > 
  > El administrador simplemente introduce un tema. La Lambda `suggest-questions` toma esta entrada y le exige al modelo generativo mediante un Prompt estricto que retorne únicamente un objeto JSON válido con preguntas y opciones múltiples.
  > 
  > Como ven en pantalla, el frontend recibe estas sugerencias, las parsea y las inyecta en nuestro editor visual, permitiendo al administrador crear una encuesta profesional en segundos."*

---

## Diapositiva 7: Interfaz de Usuario y UX Premium
* **Visual / Acción**: Mostrar la página de resultados (`results.html`) y cómo se calculan las barras de progreso animadas en vivo con degradados.
* **Tiempo estimado**: 0:45 min
* **Narración**:
  > *"Para la interfaz de usuario, optamos por una estética oscura moderna llamada **glassmorphism**, que utiliza tarjetas traslúcidas con bordes degradados y desenfoque de fondo.
  > 
  > Las páginas son completamente responsive y mobile-first. Los resultados agregados calculan porcentajes de manera dinámica y se representan mediante barras de progreso animadas con CSS puro, lo que proporciona una experiencia visual sumamente pulida e interactiva."*

---

## Diapositiva 8: Calidad de Código y Pruebas Automatizadas
* **Visual / Acción**: Abrir la consola de comandos en vivo y ejecutar `npm test`. Mostrar que pasan los 11 tests en menos de un segundo.
* **Tiempo estimado**: 0:45 min
* **Narración**:
  > *"La calidad de código se valida a través de una suite de **tests de integración** que se ejecuta de forma nativa con el test runner de **Node.js 24**, eliminando librerías externas.
  > 
  > Estos tests validan todos los endpoints locales en DynamoDB. Cabe resaltar que para las pruebas automatizadas, el cliente de **Amazon Bedrock está mockeado**. Esto permite probar e integrar el código de forma continua (CI/CD) localmente sin depender de la red ni de credenciales de nube reales. Las 11 pruebas se completan con éxito en fracciones de segundo."*

---

## Diapositiva 9: Conclusiones
* **Visual / Acción**: Mostrar la diapositiva de conclusiones.
* **Tiempo estimado**: 0:30 min
* **Narración**:
  > *"En conclusión, CloudPoll demuestra que es posible implementar sistemas web interactivos, seguros y con IA a un costo de mantenimiento de cero dólares en reposo. Gracias al desacoplamiento físico entre el frontend y el backend, la plataforma está lista para escalar a millones de votos cuando se requiera, lista para ser desplegada en la nube de AWS usando SAM.
  > 
  > Quedo abierto a sus preguntas y comentarios. Muchas gracias."*
