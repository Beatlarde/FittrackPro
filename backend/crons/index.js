const cron = require('node-cron');
const { db } = require('../config/firebase');
const { transporter, enviarMensajeAuto } = require('../services/email');
const { generarMensajeCoach } = require('../services/gemini');

// Guard: no ejecutar crons en los primeros 2 minutos del servidor
const serverStartTime = Date.now();
const cronReady = () => Date.now() - serverStartTime > 2 * 60 * 1000;

function registerCrons() {
  // Cron: recordatorio de comidas (9pm hora México)
  cron.schedule('0 21 * * *', async () => {
    if (!cronReady()) return;
    console.log('⏰ Cron: verificando comidas no registradas...');
    try {
      const hoy = new Date().toISOString().split('T')[0];
      const usersSnap = await db.collection('users')
        .where('onboardingComplete', '==', true)
        .where('planStatus', '==', 'active')
        .get();

      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        if (!userData.email || !userData.mealTimes) continue;

        const actSnap = await db.collection('activity')
          .where('userId', '==', userDoc.id)
          .where('date', '==', hoy)
          .where('type', '==', 'meal')
          .limit(1)
          .get();

        if (!actSnap.empty) continue;

        const hoyEnviado = userData.lastReminderDate === hoy;
        if (hoyEnviado) continue;

        const nombre = userData.name || 'Usuario';
        try {
          await transporter.sendMail({
            from: `"FitTrack Pro" <${process.env.GMAIL_USER}>`,
            to: userData.email,
            subject: `${nombre}, ¿ya registraste tus comidas de hoy? 🥗`,
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#fff;border-radius:16px;padding:32px;">
                <h2 style="color:#10b981;margin-bottom:8px;">¡Hola, ${nombre}! 👋</h2>
                <p style="color:#94a3b8;margin-bottom:16px;">Notamos que hoy no has registrado ninguna de tus comidas en FitTrack Pro.</p>
                <p style="color:#fff;margin-bottom:8px;">Tus horarios configurados:</p>
                <ul style="color:#10b981;padding-left:20px;">
                  <li>🌅 Desayuno: ${userData.mealTimes.desayuno}</li>
                  <li>☀️ Comida: ${userData.mealTimes.comida}</li>
                  <li>🌙 Cena: ${userData.mealTimes.cena}</li>
                </ul>
                <p style="color:#94a3b8;margin-top:16px;">Registrar tus comidas te ayuda a mantenerte en el camino. ¡Tú puedes!</p>
                <a href="${process.env.FRONTEND_URL}" style="display:inline-block;margin-top:20px;background:#10b981;color:#000;font-weight:900;padding:12px 24px;border-radius:12px;text-decoration:none;">
                  Ir a FitTrack Pro →
                </a>
              </div>
            `
          });
          console.log('📧 Recordatorio enviado a:', userData.email);
          await userDoc.ref.update({ lastReminderDate: hoy });
        } catch (emailErr) {
          console.error('Error enviando email a', userData.email, emailErr.message);
        }
      }
    } catch (e) {
      console.error('Cron error:', e);
    }
  }, { timezone: 'America/Mexico_City' });

  // Cron: 2+ días sin registrar actividad (10am)
  cron.schedule('0 10 * * *', async () => {
    if (!cronReady()) return;
    console.log('⏰ Cron: verificando inactividad 2+ días...');
    try {
      const hace2dias = Date.now() - 2 * 24 * 60 * 60 * 1000;
      const usersSnap = await db.collection('users').where('planStatus', '==', 'active').get();
      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        const lastActivity = userData.lastActivityTimestamp || userData.createdAt?.toMillis?.() || 0;
        if (lastActivity > hace2dias) continue;
        const lastMsg = userData.lastInactivityMsg || 0;
        if (Date.now() - lastMsg < 3 * 24 * 60 * 60 * 1000) continue;
        const texto = await generarMensajeCoach(userData.name, userData.goals?.objective,
          'El usuario lleva 2 o más días sin registrar actividad. Motívalo a retomar su rutina.');
        await enviarMensajeAuto(userDoc.id, userData, texto, `${userData.name}, ¡te extrañamos! 💪`);
        await db.collection('users').doc(userDoc.id).update({ lastInactivityMsg: Date.now() });
      }
    } catch (e) { console.error('Cron inactividad error:', e); }
  }, { timezone: 'America/Mexico_City' });

  // Cron: primera semana completa (11am)
  cron.schedule('0 11 * * *', async () => {
    if (!cronReady()) return;
    console.log('⏰ Cron: verificando primera semana completa...');
    try {
      const usersSnap = await db.collection('users').where('planStatus', '==', 'active').get();
      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        if (userData.weekCongratsSent) continue;
        const createdAt = userData.createdAt?.toMillis?.() || 0;
        if (createdAt > Date.now() - 7 * 24 * 60 * 60 * 1000) continue;
        const texto = await generarMensajeCoach(userData.name, userData.goals?.objective,
          'El usuario completó su primera semana. Felicítalo efusivamente.');
        await enviarMensajeAuto(userDoc.id, userData, texto, `🏆 ${userData.name}, ¡completaste tu primera semana!`);
        await db.collection('users').doc(userDoc.id).update({ weekCongratsSent: true });
      }
    } catch (e) { console.error('Cron semana error:', e); }
  }, { timezone: 'America/Mexico_City' });

  // Cron: 3 días sin abrir la app (8pm)
  cron.schedule('0 20 * * *', async () => {
    if (!cronReady()) return;
    console.log('⏰ Cron: verificando 3 días sin abrir app...');
    try {
      const hace3dias = Date.now() - 3 * 24 * 60 * 60 * 1000;
      const usersSnap = await db.collection('users').where('planStatus', '==', 'active').get();
      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        const lastOpen = userData.lastOpenTimestamp || userData.createdAt?.toMillis?.() || 0;
        if (lastOpen > hace3dias) continue;
        const lastMsg = userData.lastAbsenceMsg || 0;
        if (Date.now() - lastMsg < 3 * 24 * 60 * 60 * 1000) continue;
        const texto = await generarMensajeCoach(userData.name, userData.goals?.objective,
          'El usuario lleva 3 días sin abrir la app. Recuérdale que su plan lo está esperando.');
        await enviarMensajeAuto(userDoc.id, userData, texto, `${userData.name}, tu plan te está esperando 🔥`);
        await db.collection('users').doc(userDoc.id).update({ lastAbsenceMsg: Date.now() });
      }
    } catch (e) { console.error('Cron ausencia error:', e); }
  }, { timezone: 'America/Mexico_City' });

  // Cron: Pregunta al final del día (9pm)
  cron.schedule('0 21 * * *', async () => {
    if (!cronReady()) return;
    console.log('⏰ Cron: marcando pregunta del día pendiente...');
    try {
      const hoy = new Date().toISOString().split('T')[0];
      const usersSnap = await db.collection('users')
        .where('onboardingComplete', '==', true)
        .where('planStatus', '==', 'active')
        .get();
      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        if (userData.dayReviews?.[hoy]) continue;
        await db.collection('users').doc(userDoc.id).update({ pendingDayReview: hoy });
      }
      console.log('✅ Cron pregunta del día completado');
    } catch (e) { console.error('Cron dayReview error:', e); }
  }, { timezone: 'America/Mexico_City' });

  // Cron: limpiar sesiones demo cada hora
  cron.schedule('0 * * * *', async () => {
    try {
      const hace24h = Date.now() - 24 * 60 * 60 * 1000;
      const demoSnap = await db.collection('users')
        .where('isDemo', '==', true)
        .where('demoCreatedAt', '<', hace24h)
        .get();

      if (demoSnap.empty) return;

      const batch = db.batch();
      for (const doc of demoSnap.docs) {
        batch.delete(doc.ref);
        if (doc.data().role === 'coach') {
          const clientesSnap = await db.collection('users')
            .where('demoCoachId', '==', doc.id).get();
          clientesSnap.docs.forEach(c => batch.delete(c.ref));
        }
      }
      await batch.commit();
      console.log(`🗑️ Sesiones demo limpiadas: ${demoSnap.size}`);
    } catch (e) { console.error('Cron demo cleanup error:', e); }
  }, { timezone: 'America/Mexico_City' });
}

module.exports = { registerCrons };
