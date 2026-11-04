/**
 * Sube los secretos del backend a Cloudflare sin copiarlos a mano.
 * Lee backend/.env y el JSON del service account de Firebase, arma un archivo
 * temporal, ejecuta `wrangler secret bulk` y lo borra al terminar.
 * Nunca imprime los valores, solo los nombres.
 *
 * Uso:  node scripts/cargar-secretos.mjs /ruta/al/serviceAccountKey.json [backend/.env]
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const [saPath, envPath = 'backend/.env'] = process.argv.slice(2);
if (!saPath) {
  console.error('Falta la ruta del service account. Uso: node scripts/cargar-secretos.mjs /ruta/serviceAccountKey.json');
  process.exit(1);
}

// .env → objeto (soporta comillas y comentarios)
const env = {};
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}

const sa = JSON.parse(readFileSync(saPath, 'utf8'));

const WANTED = [
  'GEMINI_API_KEY', 'UNSPLASH_ACCESS_KEY', 'YOUTUBE_API_KEY', 'EXERCISEDB_KEY',
  'CLOUDINARY_CLOUD', 'CLOUDINARY_PRESET',
  'MP_ACCESS_TOKEN', 'MP_PLAN_ID', 'GMAIL_USER', 'GMAIL_PASS',
];

const secrets = {
  FIREBASE_PROJECT_ID: sa.project_id,
  FIREBASE_CLIENT_EMAIL: sa.client_email,
  FIREBASE_PRIVATE_KEY: sa.private_key,
};
const faltan = [];
for (const k of WANTED) {
  if (env[k]) secrets[k] = env[k];
  else faltan.push(k);
}
for (const k of ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY']) {
  if (!secrets[k]) { console.error(`El service account no trae ${k}. ¿Es el archivo correcto?`); process.exit(1); }
}

const tmp = join(tmpdir(), `fittrack-secrets-${Date.now()}.json`);
writeFileSync(tmp, JSON.stringify(secrets), { mode: 0o600 });
try {
  console.log('Subiendo:', Object.keys(secrets).join(', '));
  if (faltan.length) console.log('No encontrados en', envPath + ':', faltan.join(', '));
  execFileSync('npx', ['wrangler', 'secret', 'bulk', tmp], { stdio: 'inherit' });
} finally {
  unlinkSync(tmp);
}
