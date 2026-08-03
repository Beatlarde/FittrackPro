const admin = require('firebase-admin');

// GOOGLE_APPLICATION_CREDENTIALS debe apuntar al archivo de credenciales
// del service account (ver .env.example). En el VPS de producción vive en
// /var/www/backend/serviceAccountKey.json — nunca hardcodear la ruta aquí.
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

module.exports = { admin, db };
