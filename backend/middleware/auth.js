const { admin, db } = require('../config/firebase');

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch (e) { res.status(401).json({ error: 'Token inválido' }); }
};

const premiumMiddleware = async (req, res, next) => {
  try {
    const userSnap = await db.collection('users').doc(req.uid).get();
    if (!userSnap.exists) return res.status(404).json({ error: 'Usuario no encontrado' });
    const user = userSnap.data();
    req.user = user;
    req.isPremium = user.premium === true;
    next();
  } catch (e) { res.status(500).json({ error: e.message }); }
};

const adminMiddleware = async (req, res, next) => {
  try {
    const userSnap = await db.collection('users').doc(req.uid).get();
    if (!userSnap.exists || userSnap.data().admin !== true) {
      return res.status(403).json({ error: 'Acceso denegado — solo admins' });
    }
    next();
  } catch (e) { res.status(500).json({ error: e.message }); }
};

module.exports = { authMiddleware, premiumMiddleware, adminMiddleware };
