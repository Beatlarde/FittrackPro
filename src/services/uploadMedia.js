// Subida de fotos y videos al backend (que los pasa a Cloudinary).
// Centraliza lo que antes estaba repetido en 3 pantallas:
//   - manda el token de Firebase (antes no se mandaba y el backend respondía 401)
//   - reduce las fotos a 1600 px de lado mayor en JPEG (≈10x menos peso; HEIC → JPEG)
//   - tiempo límite para que el indicador de "subiendo" nunca se quede girando
import { BACKEND_URL } from '../config/constants';
import { getAuthToken } from './api';

const MAX_LADO = 1600;

// Imagen → JPEG reducido. Si el navegador no puede leerla, devuelve el archivo original.
export const prepararImagen = (file, maxLado = MAX_LADO, calidad = 0.85) =>
  new Promise((resolve) => {
    if (!file?.type?.startsWith('image/') && !/\.(heic|heif)$/i.test(file?.name || '')) return resolve(file);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', calidad);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

// Sube un archivo y devuelve { url, publicId }. Lanza error si falla.
export const subirArchivo = async ({ file, uid, category, timeoutMs }) => {
  if (!file) throw new Error('Archivo requerido');
  const esVideo = file.type?.startsWith('video/');
  const archivo = esVideo ? file : await prepararImagen(file);

  const formData = new FormData();
  formData.append('file', archivo, esVideo ? (file.name || 'video.mp4') : 'photo.jpg');
  formData.append('uid', uid);
  formData.append('category', category);

  const token = await getAuthToken();
  const res = await fetch(`${BACKEND_URL}/upload-photo`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
    signal: AbortSignal.timeout(timeoutMs || (esVideo ? 180000 : 60000)),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || `Error al subir (${res.status})`);
  return data;
};
