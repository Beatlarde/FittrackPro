// Envío de correo. Se implementa en la Fase 2 (Gmail SMTP desde Workers).
// Mientras tanto lanza un error claro; las rutas que mandan correos "de cortesía"
// lo atrapan y siguen funcionando, igual que en el backend original.
export async function sendMail(env, { to, subject }) {
  console.log(`[correo pendiente Fase 2] para=${to} asunto=${subject}`);
  throw new Error('El envío de correos se habilita en la Fase 2');
}
