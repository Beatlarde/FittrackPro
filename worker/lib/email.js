// Envío de correo por Gmail (SMTP 465 con TLS) desde Cloudflare Workers.
// Requiere los secretos GMAIL_USER y GMAIL_PASS (contraseña de aplicación de Google)
// y el flag "nodejs_compat" en wrangler.jsonc. El puerto 25 está bloqueado en Workers;
// 465 sí funciona.
import { WorkerMailer } from 'worker-mailer';

export async function sendMail(env, { to, subject, html, text }) {
  if (!env.GMAIL_USER || !env.GMAIL_PASS) {
    console.log(`[correo no configurado] para=${to} asunto=${subject}`);
    throw new Error('Correo no configurado: faltan GMAIL_USER / GMAIL_PASS');
  }
  await WorkerMailer.send(
    {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      startTls: false,
      credentials: { username: env.GMAIL_USER, password: env.GMAIL_PASS },
      authType: 'plain',
      socketTimeoutMs: 15000,
      responseTimeoutMs: 15000,
    },
    {
      from: { name: 'FitTrack Pro', email: env.GMAIL_USER },
      to,
      subject,
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
    }
  );
}
