/**
 * FitTrack Pro — Worker principal
 *   /api/*  → backend (Hono), port del Express que corría en el VPS
 *   resto   → frontend React (assets estáticos en ./dist)
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import agentes from './routes/agentes.js';
import media from './routes/media.js';
import metrics from './routes/metrics.js';
import coach from './routes/coach.js';
import admin from './routes/admin.js';
import plans from './routes/plans.js';
import premium from './routes/premium.js';
import demo from './routes/demo.js';

const ALLOWED_ORIGINS = [
  'https://fittrackpro.store',
  'https://www.fittrackpro.store',
  'https://fittrackpro-web.jcv-lab.workers.dev',
  'http://localhost:5173',
  'http://localhost:3000',
];

const api = new Hono();

api.use('*', cors({
  origin: (origin) => (!origin || ALLOWED_ORIGINS.includes(origin) ? origin : null),
  credentials: true,
}));

api.get('/health', (c) => c.json({ ok: true, runtime: 'cloudflare-workers' }));
api.route('/', agentes);
api.route('/', media);
api.route('/', metrics);
api.route('/', coach);
api.route('/', admin);
api.route('/', plans);
api.route('/', premium);
api.route('/', demo);

api.onError((err, c) => {
  console.error('API error:', err);
  return c.json({ error: err.message || 'Error interno' }, 500);
});

const app = new Hono();
app.route('/api', api);
app.all('/api/*', (c) => c.json({ error: 'Ruta no encontrada' }, 404));
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
