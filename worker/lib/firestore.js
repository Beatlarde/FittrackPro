// Cliente mínimo de Firestore por REST, en reemplazo de firebase-admin
// (que no corre en Cloudflare Workers). Autentica con el service account.
import { SignJWT, importPKCS8 } from 'jose';

let cachedToken = null; // { token, exp } — vive mientras el isolate siga activo

async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const privateKey = await importPKCS8(env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/datastore' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(env.FIREBASE_CLIENT_EMAIL)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Firestore auth: ' + (data.error_description || data.error));
  cachedToken = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return cachedToken.token;
}

// ---------- conversión de valores ----------

// Imita Timestamp de firebase-admin: .toDate(), .toMillis() y mismo JSON
export class FsTimestamp {
  constructor(iso) { this.iso = iso; }
  toDate() { return new Date(this.iso); }
  toMillis() { return new Date(this.iso).getTime(); }
  get _seconds() { return Math.floor(this.toMillis() / 1000); }
  toJSON() { const ms = this.toMillis(); return { _seconds: Math.floor(ms / 1000), _nanoseconds: (ms % 1000) * 1e6 }; }
}

export const SERVER_TIMESTAMP = Symbol('serverTimestamp');

export function encode(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v === SERVER_TIMESTAMP) return { timestampValue: new Date().toISOString() };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (v instanceof FsTimestamp) return { timestampValue: v.iso };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  if (typeof v === 'object') return { mapValue: { fields: encodeFields(v) } };
  return { stringValue: String(v) };
}

export function encodeFields(obj) {
  const out = {};
  for (const [k, val] of Object.entries(obj)) if (val !== undefined) out[k] = encode(val);
  return out;
}

export function decode(v) {
  if (!v) return null;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return new FsTimestamp(v.timestampValue);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  if ('referenceValue' in v) return v.referenceValue;
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('bytesValue' in v) return v.bytesValue;
  return null;
}

export function decodeFields(fields) {
  const out = {};
  for (const [k, val] of Object.entries(fields || {})) out[k] = decode(val);
  return out;
}

const SIMPLE_SEGMENT = /^[a-zA-Z_][a-zA-Z_0-9]*$/;
const quoteSegment = (s) => (SIMPLE_SEGMENT.test(s) ? s : '`' + s.replace(/`/g, '\\`') + '`');

// ---------- cliente ----------

export function firestore(env) {
  const base = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;

  async function call(url, init = {}) {
    const token = await getAccessToken(env);
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    });
    if (res.status === 404) return null;
    const data = await res.json();
    if (!res.ok) throw new Error('Firestore: ' + (data.error?.message || res.status));
    return data;
  }

  const toDoc = (d) => ({ id: d.name.split('/').pop(), path: d.name.split('/documents/')[1], data: decodeFields(d.fields) });

  return {
    // Lee un documento: devuelve { id, data } o null si no existe
    async get(path) {
      const d = await call(`${base}/${path}`);
      return d ? toDoc(d) : null;
    },

    // Crea un documento con id automático en una colección
    async add(collection, obj) {
      const d = await call(`${base}/${collection}`, { method: 'POST', body: JSON.stringify({ fields: encodeFields(obj) }) });
      return toDoc(d);
    },

    // Escribe un documento completo (merge=true solo toca los campos enviados)
    async set(path, obj, { merge = false } = {}) {
      let url = `${base}/${path}`;
      if (merge) {
        const mask = Object.keys(obj).filter((k) => obj[k] !== undefined)
          .map((k) => 'updateMask.fieldPaths=' + encodeURIComponent(quoteSegment(k))).join('&');
        url += '?' + mask;
      }
      const d = await call(url, { method: 'PATCH', body: JSON.stringify({ fields: encodeFields(obj) }) });
      return toDoc(d);
    },

    // Como update() de firebase-admin: acepta rutas con punto ("esfuerzo.2026-11-03.press")
    // y falla si el documento no existe.
    async update(path, updates) {
      const fields = {};
      const masks = [];
      for (const [dotted, value] of Object.entries(updates)) {
        const parts = dotted.split('.');
        masks.push(parts.map(quoteSegment).join('.'));
        let node = fields;
        parts.forEach((p, i) => {
          if (i === parts.length - 1) node[p] = encode(value);
          else {
            node[p] = node[p] || { mapValue: { fields: {} } };
            node = node[p].mapValue.fields;
          }
        });
      }
      const qs = masks.map((m) => 'updateMask.fieldPaths=' + encodeURIComponent(m)).join('&');
      await call(`${base}/${path}?${qs}&currentDocument.exists=true`, { method: 'PATCH', body: JSON.stringify({ fields }) });
    },

    async delete(path) {
      await call(`${base}/${path}`, { method: 'DELETE' });
    },

    // Consulta simple: where = [[campo, op, valor]], op: '==','!=','<','<=','>','>=','array-contains','in'
    async query(collection, { where = [], orderBy = null, limit = null } = {}) {
      const OPS = {
        '==': 'EQUAL', '!=': 'NOT_EQUAL', '<': 'LESS_THAN', '<=': 'LESS_THAN_OR_EQUAL',
        '>': 'GREATER_THAN', '>=': 'GREATER_THAN_OR_EQUAL', 'array-contains': 'ARRAY_CONTAINS', 'in': 'IN',
      };
      const filters = where.map(([field, op, value]) => ({
        fieldFilter: { field: { fieldPath: field }, op: OPS[op], value: encode(value) },
      }));
      const structuredQuery = { from: [{ collectionId: collection }] };
      if (filters.length === 1) structuredQuery.where = filters[0];
      if (filters.length > 1) structuredQuery.where = { compositeFilter: { op: 'AND', filters } };
      if (orderBy) {
        const [field, dir = 'asc'] = Array.isArray(orderBy) ? orderBy : [orderBy];
        structuredQuery.orderBy = [{ field: { fieldPath: field }, direction: dir === 'desc' ? 'DESCENDING' : 'ASCENDING' }];
      }
      if (limit) structuredQuery.limit = limit;
      const rows = await call(`${base}:runQuery`, { method: 'POST', body: JSON.stringify({ structuredQuery }) });
      return (rows || []).filter((r) => r.document).map((r) => toDoc(r.document));
    },
  };
}
