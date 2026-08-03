const express = require('express');
const multer = require('multer');
const { admin, db } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/upload-photo', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const uid = req.body?.uid || req.query?.uid;
    const category = req.body?.category || req.query?.category || 'general';
    if (!uid) return res.status(400).json({ error: 'uid requerido' });
    if (!req.file) return res.status(400).json({ error: 'archivo requerido' });
    const base64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';
    const isVideo = mimeType.startsWith('video/');
    const dataUri = `data:${mimeType};base64,${base64}`;
    const uploadEndpoint = isVideo ? 'video' : 'image';

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD}/${uploadEndpoint}/upload`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: dataUri,
          upload_preset: process.env.CLOUDINARY_PRESET,
          resource_type: isVideo ? 'video' : 'image'
        })
      }
    );
    const data = await response.json();
    console.log('cloudinary:', response.status, data.error || 'ok');
    if (!data.secure_url) throw new Error(data.error?.message || 'Error al subir');
    await db.collection('photos').add({
      userId: uid, url: data.secure_url, publicId: data.public_id,
      category: category,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      dateString: new Date().toLocaleDateString('es-MX', { dateStyle: 'medium' })
    });
    res.json({ url: data.secure_url, publicId: data.public_id });
  } catch (e) { console.error('upload error:', e.message); res.status(500).json({ error: e.message }); }
});

// Imágenes de comida — Unsplash
router.get('/food-image', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query requerida' });

    const query = encodeURIComponent(`${q} food meal`);
    const url = `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape&content_filter=high`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` }
    });
    const data = await response.json();

    if (data.results?.length > 0) {
      const photo = data.results[0];
      res.json({
        url: photo.urls.small,
        thumb: photo.urls.thumb,
        alt: photo.alt_description || q,
        credit: photo.user.name,
        creditUrl: photo.user.links.html
      });
    } else {
      res.json({ url: null });
    }
  } catch(e) {
    console.error('food-image error:', e.message);
    res.json({ url: null });
  }
});

// YouTube video search
router.get('/youtube', authMiddleware, async (req, res) => {
  try {
    const { q, equipo = '' } = req.query;
    const contexto = equipo ? `${equipo} ` : '';
    const query = encodeURIComponent(`${q} ${contexto}shorts tutorial forma correcta`);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=1&relevanceLanguage=es&videoDuration=short&key=${process.env.YOUTUBE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    const video = data.items?.[0];
    if (!video) return res.json({ videoId: null });
    res.json({ videoId: video.id.videoId, title: video.snippet.title });
  } catch (e) {
    console.error('youtube error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ExerciseDB (RapidAPI) — GIFs animados
const EXERCISEDB_KEY = process.env.EXERCISEDB_KEY || '';
router.get('/ejercicio', async (req, res) => {
  try {
    const { q } = req.query;
    const query = encodeURIComponent(q.toLowerCase().trim());
    const url = `https://exercisedb.p.rapidapi.com/exercises/name/${query}?limit=1&offset=0`;
    const response = await fetch(url, {
      headers: {
        'x-rapidapi-key': EXERCISEDB_KEY,
        'x-rapidapi-host': 'exercisedb.p.rapidapi.com'
      }
    });
    const data = await response.json();
    const ejercicio = Array.isArray(data) ? data[0] : null;
    if (!ejercicio) return res.json({ gif: null, instrucciones: [] });
    res.json({
      gif: ejercicio.gifUrl,
      nombre: ejercicio.name,
      musculo: ejercicio.target,
      equipo: ejercicio.equipment,
      instrucciones: ejercicio.instructions || []
    });
  } catch (e) {
    console.error('exercisedb error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
