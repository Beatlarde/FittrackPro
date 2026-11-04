// Medios: fotos (Cloudinary), imágenes de comida (Unsplash), videos (YouTube), GIFs (ExerciseDB)
// Port de backend/routes/media.js
import { Hono } from 'hono';
import { authMiddleware } from '../lib/auth.js';
import { firestore, SERVER_TIMESTAMP } from '../lib/firestore.js';
import { toBase64 } from '../lib/gemini.js';

const r = new Hono();
const MAX_BYTES = 50 * 1024 * 1024;

// ---------- caché compartida en Firestore (colección mediaCache) ----------
// Cada búsqueda externa (YouTube, ExerciseDB) se hace una sola vez para todos los usuarios.
async function cacheKey(tipo, texto) {
  const data = new TextEncoder().encode(`${tipo}:${texto.toLowerCase().trim()}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return tipo + '_' + [...new Uint8Array(hash)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function leerCache(env, tipo, texto) {
  try {
    const doc = await firestore(env).get(`mediaCache/${await cacheKey(tipo, texto)}`);
    return doc ? doc.data.resultado : undefined;
  } catch { return undefined; }
}
async function guardarCache(env, tipo, texto, resultado) {
  try {
    await firestore(env).set(`mediaCache/${await cacheKey(tipo, texto)}`, {
      tipo, consulta: texto, resultado, creado: SERVER_TIMESTAMP,
    });
  } catch (e) { console.error('cache error:', e.message); }
}

// "Sentadilla isométrica en pared (Wall Sit)" → "wall sit" (ExerciseDB está en inglés).
// Si el paréntesis está en español ("Superman (extensión lumbar)"), usa lo de afuera.
function nombreEnIngles(q) {
  const m = q.match(/\(([^)]+)\)/);
  const dentro = m ? m[1] : '';
  const fuera = q.replace(/\([^)]*\)/g, ' ');
  const pareceEspanol = /[áéíóúñü]/i.test(dentro) || /\b(de|en|con|para|del|suave|lateral)\b/i.test(dentro);
  const elegido = dentro && !pareceEspanol ? dentro : fuera;
  return elegido.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

r.post('/upload-photo', authMiddleware, async (c) => {
  try {
    const form = await c.req.parseBody();
    const uid = form.uid || c.req.query('uid');
    const category = form.category || c.req.query('category') || 'general';
    const file = form.file;
    if (!uid) return c.json({ error: 'uid requerido' }, 400);
    if (!file || typeof file === 'string') return c.json({ error: 'archivo requerido' }, 400);
    if (file.size > MAX_BYTES) return c.json({ error: 'archivo demasiado grande' }, 413);

    const mimeType = file.type || 'image/jpeg';
    const isVideo = mimeType.startsWith('video/');
    const dataUri = `data:${mimeType};base64,${toBase64(await file.arrayBuffer())}`;

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${c.env.CLOUDINARY_CLOUD}/${isVideo ? 'video' : 'image'}/upload`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: dataUri, upload_preset: c.env.CLOUDINARY_PRESET, resource_type: isVideo ? 'video' : 'image' }),
      }
    );
    const data = await response.json();
    console.log('cloudinary:', response.status, data.error || 'ok');
    if (!data.secure_url) throw new Error(data.error?.message || 'Error al subir');

    await firestore(c.env).add('photos', {
      userId: uid, url: data.secure_url, publicId: data.public_id, category,
      createdAt: SERVER_TIMESTAMP,
      dateString: new Date().toLocaleDateString('es-MX', { dateStyle: 'medium', timeZone: 'America/Mexico_City' }),
    });
    return c.json({ url: data.secure_url, publicId: data.public_id });
  } catch (e) {
    console.error('upload error:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

r.get('/food-image', authMiddleware, async (c) => {
  try {
    const q = c.req.query('q');
    if (!q) return c.json({ error: 'Query requerida' }, 400);
    const query = encodeURIComponent(`${q} food meal`);
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${c.env.UNSPLASH_ACCESS_KEY}` } }
    );
    const data = await response.json();
    if (data.results?.length > 0) {
      const photo = data.results[0];
      return c.json({
        url: photo.urls.small, thumb: photo.urls.thumb, alt: photo.alt_description || q,
        credit: photo.user.name, creditUrl: photo.user.links.html,
      });
    }
    return c.json({ url: null });
  } catch (e) {
    console.error('food-image error:', e.message);
    return c.json({ url: null });
  }
});

r.get('/youtube', authMiddleware, async (c) => {
  try {
    const q = c.req.query('q') || '';
    const equipo = c.req.query('equipo') || '';
    if (!q) return c.json({ error: 'Query requerida' }, 400);
    const consulta = `${q} ${equipo}`.trim();

    const enCache = await leerCache(c.env, 'yt', consulta);
    if (enCache?.videoId) return c.json({ ...enCache, cache: true });

    const contexto = equipo ? `${equipo} ` : '';
    const query = encodeURIComponent(`${q} ${contexto}shorts tutorial forma correcta`);
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=1&relevanceLanguage=es&videoDuration=short&key=${c.env.YOUTUBE_API_KEY}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await response.json();
    if (!response.ok) {
      // Cuota agotada u otro error: no se guarda en caché para reintentar después
      console.error('youtube error:', response.status, data.error?.message);
      return c.json({ videoId: null, error: data.error?.message || 'YouTube no disponible' });
    }
    const video = data.items?.[0];
    const resultado = video ? { videoId: video.id.videoId, title: video.snippet.title } : { videoId: null };
    if (resultado.videoId) await guardarCache(c.env, 'yt', consulta, resultado); // solo resultados con video
    return c.json(resultado);
  } catch (e) {
    console.error('youtube error:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

async function buscarExerciseDB(env, nombre) {
  const response = await fetch(
    `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(nombre)}?limit=1&offset=0`,
    {
      headers: { 'x-rapidapi-key': env.EXERCISEDB_KEY || '', 'x-rapidapi-host': 'exercisedb.p.rapidapi.com' },
      signal: AbortSignal.timeout(8000),
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `ExerciseDB ${response.status}`);
  return Array.isArray(data) ? data[0] : null;
}

r.get('/ejercicio', async (c) => {
  try {
    const q = c.req.query('q') || '';
    const nombre = nombreEnIngles(q);
    if (!nombre) return c.json({ gif: null, instrucciones: [] });

    const enCache = await leerCache(c.env, 'ex', nombre);
    if (enCache?.gif) return c.json({ ...enCache, cache: true });

    // Si no hay coincidencia exacta, intenta con las dos primeras palabras ("wall sit hold" → "wall sit")
    let ejercicio = await buscarExerciseDB(c.env, nombre);
    const corto = nombre.split(' ').slice(0, 2).join(' ');
    if (!ejercicio && corto !== nombre) ejercicio = await buscarExerciseDB(c.env, corto);

    const resultado = ejercicio ? {
      // Algunas versiones de la API ya no traen gifUrl: entonces se sirve por el proxy de abajo
      gif: ejercicio.gifUrl || (ejercicio.id ? `/api/ejercicio-gif/${ejercicio.id}` : null),
      nombre: ejercicio.name, musculo: ejercicio.target,
      equipo: ejercicio.equipment, instrucciones: ejercicio.instructions || [],
    } : { gif: null, instrucciones: [] };

    if (resultado.gif) await guardarCache(c.env, 'ex', nombre, resultado); // solo resultados con GIF
    return c.json(resultado);
  } catch (e) {
    console.error('exercisedb error:', e.message);
    return c.json({ gif: null, instrucciones: [], error: e.message });
  }
});

// Proxy del GIF: la imagen de ExerciseDB requiere la llave, que no debe ir al navegador
r.get('/ejercicio-gif/:id', async (c) => {
  const id = c.req.param('id');
  if (!/^[0-9a-zA-Z]{1,12}$/.test(id)) return c.json({ error: 'id inválido' }, 400);
  const res = await fetch(`https://exercisedb.p.rapidapi.com/image?exerciseId=${id}&resolution=360`, {
    headers: { 'x-rapidapi-key': c.env.EXERCISEDB_KEY || '', 'x-rapidapi-host': 'exercisedb.p.rapidapi.com' },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!res || !res.ok) return c.json({ error: 'GIF no disponible' }, 404);
  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'image/gif',
      'Cache-Control': 'public, max-age=2592000, immutable', // el navegador lo guarda 30 días
    },
  });
});

export default r;
