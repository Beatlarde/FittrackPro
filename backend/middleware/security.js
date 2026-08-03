const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const helmetConfig = helmet({
  contentSecurityPolicy: false, // deshabilitado para compatibilidad con la PWA
  crossOriginEmbedderPolicy: false
});

const allowedOrigins = [
  'https://fittrackpro.store',
  'https://www.fittrackpro.store',
  'http://localhost:5173',
  'http://localhost:3000'
];

const corsConfig = cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS: origen no permitido'));
    }
  },
  credentials: true
});

const limiterGeneral = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: { error: 'Demasiadas solicitudes, intenta más tarde' }
});

const limiterIA = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10,
  message: { error: 'Límite de IA alcanzado, espera un momento' }
});

const limiterEmail = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20,
  message: { error: 'Límite de emails alcanzado' }
});

module.exports = { helmetConfig, corsConfig, limiterGeneral, limiterIA, limiterEmail };
