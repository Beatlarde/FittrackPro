# FitTrack Pro

App de fitness y nutrición con coaching asistido por IA. Los clientes reciben planes de entrenamiento y dieta personalizados (Gemini), pueden registrar su progreso, y sus coaches los siguen desde un panel dedicado. Incluye pagos recurrentes (MercadoPago) y venta vía Hotmart.

Producción: [fittrackpro.store](https://fittrackpro.store)

## Estructura del repo

```
fittrack-pro/
├── src/            # Frontend: React + Vite (PWA)
├── backend/        # Backend: Node/Express, propio package.json
└── public/         # Assets estáticos servidos por Vite
```

Frontend y backend se despliegan por separado — el backend corre como su propio servicio (PM2 en producción), no como parte del build de Vite.

## Frontend

```bash
npm install
cp .env.example .env   # completar con tus credenciales de Firebase/MercadoPago/Google
npm run dev
```

- `src/App.jsx` — enruta entre Login, Onboarding, Cliente, Coach y Admin según el usuario autenticado.
- `src/components/{shared,auth,onboarding,client,coach,admin}/` — componentes agrupados por dominio.
- `src/firebase.js`, `src/services/`, `src/hooks/`, `src/context/`, `src/utils/` — módulos compartidos (Auth/Firestore, llamadas al backend, hooks de UI, tema, métricas).

## Backend

```bash
cd backend
npm install
cp .env.example .env   # completar con tus credenciales
npm start
```

- `server.js` — bootstrap: middlewares, monta las rutas y arranca el servidor y los crons.
- `routes/` — endpoints agrupados por dominio (planes, premium, agentes IA, medios, webhooks de pago, coach, admin, etc.).
- `config/`, `middleware/`, `services/`, `crons/` — Firebase Admin, autenticación/roles, MercadoPago, email transaccional, prompts de IA, y las tareas programadas de notificaciones.

`GOOGLE_APPLICATION_CREDENTIALS` debe apuntar a la ruta local del JSON de tu service account de Firebase Admin (nunca se sube al repo).

## Variables de entorno

Ver `.env.example` (raíz, frontend) y `backend/.env.example` (backend) para la lista completa. Ninguno de los dos `.env` reales se sube al repositorio.
