# CO2 Sprint App

Aplicación de taller interactivo para calcular y comparar huellas de carbono. Arquitectura monorepo con frontend React y backend Node.js.

## Estructura

```
co2-sprint-app/
  frontend/   → React + Vite (participantes y facilitadores)
  backend/    → Node.js + Express + MongoDB + Socket.io
```

## Requisitos

- Node.js 18+
- MongoDB corriendo localmente en el puerto 27017

## Arrancar el proyecto

### 1. Backend

```bash
cd backend
npm install
node index.js
```

El servidor corre en `http://localhost:5000`.

Al conectarse a MongoDB por primera vez, crea automáticamente el usuario de prueba:
- **Email:** admin@co2sprint.com
- **Password:** admin123

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

La app corre en `http://localhost:5173`.

## Variables de entorno

### backend/.env
| Variable | Valor por defecto |
|---|---|
| PORT | 5000 |
| MONGODB_URI | mongodb://localhost:27017/co2sprint |
| JWT_SECRET | co2sprintsecret2024 |
| FRONTEND_URL | http://localhost:5173 |
| EMAIL_HOST | smtp.gmail.com |
| EMAIL_PORT | 587 |
| EMAIL_USER | *(requerido para envío de emails)* |
| EMAIL_PASS | *(requerido para envío de emails)* |

#### Configurar el envío de emails (Gmail)

El endpoint `POST /api/results/send-email` usa nodemailer. Sin `EMAIL_USER` y `EMAIL_PASS` configurados el endpoint devuelve `503` y el botón de la app no aparecerá roto (simplemente falla silenciosamente en producción si no hay SMTP).

**Pasos para Gmail:**

1. Activa la verificación en dos pasos en tu cuenta Google.
2. Ve a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) y genera una *App Password* para "Mail".
3. Copia esa contraseña de 16 caracteres (sin espacios) en `EMAIL_PASS`.
4. En `EMAIL_USER` pon tu dirección Gmail completa.

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=taller@tudominio.com
EMAIL_PASS=abcd efgh ijkl mnop   # la app password de Google (sin espacios)
```

> Para otros proveedores (Outlook, Brevo, Resend…) cambia `EMAIL_HOST` y `EMAIL_PORT` según su documentación SMTP.

### frontend/.env
| Variable | Valor |
|---|---|
| VITE_BACKEND_URL | http://localhost:5000 |

## Flujos principales

| Ruta | Quién | Descripción |
|---|---|---|
| `/login` | Facilitador | Login con email/contraseña |
| `/dashboard` | Facilitador | Lista de sesiones |
| `/session/create` | Facilitador | Crear nueva sesión |
| `/session/:code/step1` | Facilitador | Quiz en pantalla grande |
| `/session/:code/step2` | Facilitador | Rankings en tiempo real |
| `/join` | Participante | Unirse con código de sesión |
| `/session/:code/quiz` | Participante | Responder preguntas |
| `/session/:code/calculator` | Participante | Calculadora de huella |
| `/session/:code/results` | Participante | Ver resultado personal |

## API REST

```
POST   /api/auth/register
POST   /api/auth/login

POST   /api/sessions          (JWT)
GET    /api/sessions          (JWT)
GET    /api/sessions/:code    (JWT)
PATCH  /api/sessions/:code/step      (JWT)
PATCH  /api/sessions/:code/question  (JWT)
DELETE /api/sessions/:code    (JWT)

GET    /api/results/:code              (JWT)
GET    /api/results/:code/ranking      (público)
GET    /api/results/:code/ranking/groups (público)
GET    /api/results/:code/stats        (público)
POST   /api/results/send-email         (público)
```

## Socket.io

```js
// Cliente → Servidor
socket.emit('session:join',     { code, name, group })
socket.emit('quiz:answer',      { sessionCode, questionId, answer, group })
socket.emit('footprint:submit', { sessionCode, group, carbonTons, areas })
socket.emit('step:change',      { sessionCode, step })
socket.emit('question:change',  { sessionCode, question })

// Servidor → Cliente
socket.on('participant:joined', ({ count }) => {})
socket.on('quiz:results',       ({ questionId, results }) => {})
socket.on('ranking:update',     ({ individual }) => {})
socket.on('step:change',        (step) => {})
socket.on('question:change',    (question) => {})
```
