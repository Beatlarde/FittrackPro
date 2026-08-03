const express = require('express');
const { db } = require('../config/firebase');
const { client, PreApproval } = require('../config/mercadopago');
const { transporter } = require('../services/email');
const router = express.Router();

router.post('/webhook-hotmart', async (req, res) => {
  try {
    const { event, data } = req.body;
    console.log('🔥 Webhook Hotmart:', event, data?.buyer?.email);

    const email = data?.buyer?.email;
    if (!email) return res.sendStatus(200);

    const snap = await db.collection('users').where('email', '==', email).limit(1).get();

    if (event === 'PURCHASE_APPROVED' || event === 'SUBSCRIPTION_REACTIVATED') {
      if (!snap.empty) {
        await snap.docs[0].ref.update({
          premium: true,
          premiumStatus: 'authorized',
          premiumSource: 'hotmart',
          hotmartTransactionId: data?.purchase?.transaction,
          premiumUpdatedAt: Date.now()
        });
        console.log(`✅ Hotmart premium activado: ${email}`);
        const userData = snap.docs[0].data();
        try {
          await transporter.sendMail({
            from: `"FitTrack Pro" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: '⭐ ¡Ya eres Premium en FitTrack Pro!',
            html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;color:#fff;border-radius:16px;">
              <h2 style="color:#10b981;">⭐ ¡Bienvenido a Premium!</h2>
              <p>Hola ${userData.name || ''},</p>
              <p>Tu suscripción Premium ya está activa. Ahora tienes acceso completo a FitTrack Pro.</p>
              <a href="https://fittrackpro.store" style="display:inline-block;margin-top:16px;background:#10b981;color:#000;font-weight:900;padding:12px 24px;border-radius:12px;text-decoration:none;">Abrir FitTrack Pro →</a>
            </div>`
          });
        } catch(e) { console.error('Error email hotmart:', e.message); }
      } else {
        await db.collection('premiumPendiente').doc(email).set({
          email, source: 'hotmart', ts: Date.now(),
          transactionId: data?.purchase?.transaction
        });
        console.log(`⏳ Hotmart premium pendiente (usuario sin cuenta): ${email}`);
      }
    } else if (event === 'SUBSCRIPTION_CANCELLATION' || event === 'PURCHASE_REFUNDED') {
      if (!snap.empty) {
        await snap.docs[0].ref.update({ premium: false, premiumStatus: event.toLowerCase(), premiumUpdatedAt: Date.now() });
        console.log(`❌ Hotmart premium cancelado: ${email}`);
      }
    }

    res.sendStatus(200);
  } catch(e) {
    console.error('webhook-hotmart error:', e.message);
    res.sendStatus(500);
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const userAgent = req.headers['user-agent'] || '';
    const mpSignature = req.headers['x-signature'] || '';
    const mpRequestId = req.headers['x-request-id'] || '';

    if (!userAgent.includes('MercadoPago') && !mpSignature && !mpRequestId) {
      console.warn('⚠️ Webhook origen desconocido:', req.ip);
      return res.sendStatus(200);
    }

    const { type, data } = req.body;
    console.log('📩 Webhook MP:', type, data?.id);

    const activarPremium = async (email, subscriptionId, status, payerId = null) => {
      const isPremium = status === 'authorized';
      let userRef = null;

      if (email) {
        const snap = await db.collection('users').where('email', '==', email).limit(1).get();
        if (!snap.empty) userRef = snap.docs[0].ref;
      }

      if (!userRef && payerId) {
        const snap = await db.collection('users').where('mpPayerId', '==', String(payerId)).limit(1).get();
        if (!snap.empty) userRef = snap.docs[0].ref;
      }

      if (!userRef) {
        console.warn(`⚠️ Usuario no encontrado — email: "${email}" | payerId: ${payerId}`);
        return;
      }

      await userRef.update({
        premium: isPremium,
        mpSubscriptionId: subscriptionId,
        premiumStatus: status,
        premiumUpdatedAt: Date.now(),
        ...(payerId ? { mpPayerId: String(payerId) } : {})
      });
      console.log(`✅ Usuario premium: ${isPremium} (${status})`);

      if (isPremium) {
        const userData = (await userRef.get()).data();
        try {
          await transporter.sendMail({
            from: `"FitTrack Pro" <${process.env.GMAIL_USER}>`,
            to: userData.email,
            subject: '⭐ ¡Ya eres Premium en FitTrack Pro!',
            html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;color:#fff;border-radius:16px;">
              <h2 style="color:#10b981;">⭐ ¡Bienvenido a Premium!</h2>
              <p>Hola ${userData.name || ''},</p>
              <p>Tu suscripción Premium ya está activa. Ahora tienes acceso a:</p>
              <ul style="color:#94a3b8;line-height:2;">
                <li>📅 Plan completo 7 días</li>
                <li>🔄 Alternativas ilimitadas</li>
                <li>🛒 Lista del súper automática</li>
                <li>📸 Fotos de progreso con análisis IA</li>
                <li>💬 Chat ilimitado con tu coach</li>
              </ul>
              <a href="https://fittrackpro.store" style="display:inline-block;margin-top:16px;background:#10b981;color:#000;font-weight:900;padding:12px 24px;border-radius:12px;text-decoration:none;">Abrir FitTrack Pro →</a>
            </div>`
          });
        } catch(e) { console.error('Error email premium:', e.message); }
      }
    };

    if (type === 'subscription_preapproval' || type === 'subscription_preapproval_updated') {
      const preApproval = new PreApproval(client);
      const sub = await preApproval.get({ id: data.id });
      await activarPremium(sub.payer_email, data.id, sub.status, sub.payer_id);
    } else if (type === 'subscription_authorized_payment') {
      try {
        const paymentRes = await fetch(`https://api.mercadopago.com/authorized_payments/${data.id}`, {
          headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` }
        });
        const payment = await paymentRes.json();
        console.log('💳 Pago autorizado status:', payment.status, '| preapproval_id:', payment.preapproval_id);
        if (payment.preapproval_id) {
          const preApproval = new PreApproval(client);
          const sub = await preApproval.get({ id: payment.preapproval_id });
          await activarPremium(sub.payer_email, payment.preapproval_id, sub.status);
        }
      } catch(e) { console.error('Error procesando authorized_payment:', e.message); }
    } else if (type === 'payment') {
      const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
        headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
      const payment = await paymentRes.json();
      if (payment.status === 'approved' && payment.payer?.email) {
        await activarPremium(payment.payer.email, data.id, 'authorized');
      }
    }

    res.sendStatus(200);
  } catch (e) {
    console.error('webhook error:', e.message);
    res.sendStatus(500); // MP reintentará automáticamente
  }
});

module.exports = router;
