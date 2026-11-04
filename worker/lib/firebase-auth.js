// Verificación de ID tokens de Firebase Auth sin firebase-admin.
// Usa las llaves públicas de Google (JWKS) y valida issuer/audience del proyecto.
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export async function verifyIdToken(token, projectId) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });
  if (!payload.sub) throw new Error('Token sin uid');
  return { uid: payload.sub, email: payload.email, ...payload };
}
