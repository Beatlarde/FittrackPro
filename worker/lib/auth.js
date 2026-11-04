// Middlewares de autenticación — equivalentes a backend/middleware/auth.js
import { verifyIdToken } from './firebase-auth.js';
import { firestore } from './firestore.js';

export const authMiddleware = async (c, next) => {
  const header = c.req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return c.json({ error: 'No autorizado' }, 401);
  try {
    const decoded = await verifyIdToken(token, c.env.FIREBASE_PROJECT_ID);
    c.set('uid', decoded.uid);
    c.set('authEmail', decoded.email || null);
    c.set('authProvider', decoded.firebase?.sign_in_provider || null);
  } catch (e) {
    return c.json({ error: 'Token inválido' }, 401);
  }
  await next();
};

export const premiumMiddleware = async (c, next) => {
  try {
    const snap = await firestore(c.env).get(`users/${c.get('uid')}`);
    if (!snap) return c.json({ error: 'Usuario no encontrado' }, 404);
    c.set('user', snap.data);
    c.set('isPremium', snap.data.premium === true);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
  await next();
};

export const adminMiddleware = async (c, next) => {
  try {
    const snap = await firestore(c.env).get(`users/${c.get('uid')}`);
    if (!snap || snap.data.admin !== true) return c.json({ error: 'Acceso denegado — solo admins' }, 403);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
  await next();
};
