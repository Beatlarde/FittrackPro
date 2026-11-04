# Bitácora de cambios — FitTrack Pro

Registro de cada modificación: qué se cambió, en qué archivos, cómo se probó y si salió bien.
Sirve para saber en qué punto se rompió algo y para no volver a perder funciones en una mudanza.

**Cómo agregar una entrada:** la más reciente va arriba. Usa el estado:
✅ funcionó · ⚠️ funcionó con pendientes · ❌ falló / revertido · 🔄 en progreso

---

## 2026-11-04

### ✅ La app se queda en el spinner de carga en la red de la oficina
- **Síntoma:** la app no pasa del spinner inicial. En el celular con datos móviles carga normal; en Chrome y Safari (red de oficina) se cuelga.
- **Diagnóstico:** en Network, la petición `firestore.googleapis.com/.../Listen/channel` queda en `pending` para siempre. La red corporativa/VPN corta el canal en vivo (WebChannel) de Firestore, y la app espera el perfil del usuario para salir del spinner. **No es causado por la migración** (Firestore se conecta directo desde el navegador, sin pasar por Cloudflare).
- **Cambio:** `src/firebase.js` → `initializeFirestore(app, { experimentalForceLongPolling: true })` en lugar de `getFirestore(app)`.
- **Prueba:** abrir la app en la red de la oficina.
- **Resultado:** ✅ la app carga en la red de la oficina.

### Ajuste: la caché de medios ya no guarda resultados vacíos
- `worker/routes/media.js`: solo se guardan en `mediaCache` las búsquedas que sí encontraron GIF o video, para reintentar después las que fallaron. (La prueba de `wall sit` devolvió "sin GIF" y había quedado guardada.)
- Se agregaron tiempos límite: 8–10 s en el Worker para ExerciseDB/YouTube y 15 s en la app, para que "Buscando demostración..." nunca se quede ciclado.

### 🔄 Recuperar GIFs y videos de los ejercicios
- **Actualización (mismo día):** se mostraban GIF y video al mismo tiempo; no gustó. Ahora: primero se busca el GIF; solo si no existe se avisa "No encontramos GIF…" y se muestra un video corto de YouTube. Ahorra cuota de YouTube.
- **Contexto:** los endpoints `/ejercicio` (ExerciseDB) y `/youtube` existían en el backend, pero ningún componente del frontend los llamaba. Revisando git se encontró que **nunca estuvieron en este repo**: se perdieron en la reestructura del 2026-08-03 (ver abajo).
- **Cambios:**
  - `src/components/client/EjercicioTab.jsx`: botón **"▶ Cómo se hace"** por ejercicio; muestra GIF de ExerciseDB + video de YouTube. Carga solo al tocarlo.
  - `worker/routes/media.js`:
    - Caché compartida en Firestore (colección `mediaCache`): cada ejercicio se busca una sola vez para todos los usuarios. Motivo: YouTube gratis ≈ 100 búsquedas/día.
    - ExerciseDB se consulta con el nombre en inglés del paréntesis (`"Sentadilla en pared (Wall Sit)"` → `wall sit`).
    - Proxy `/api/ejercicio-gif/:id` por si la API ya no entrega `gifUrl` directo (la imagen requiere la llave).
  - Arreglo colateral: si fallaba "Mi gym no tiene este equipo", el botón desaparecía para siempre; ahora muestra error y permite reintentar.
- **Prueba 1:** GIF y video aparecen ✅ (pero ambos a la vez; ajustado).
- **Prueba 2:** flujo GIF → video corto ✅ (después de reenviar el archivo: la primera copia no había llegado a la Mac; desde ahora se verifica cada archivo con SHA-256).
- **Ajuste de diseño:** el texto "▶ Cómo se hace" se reemplazó por un **botón redondo de play** debajo de las series/repeticiones (36 px, se rellena de verde cuando está abierto). El panel del GIF/video aparece justo debajo del ejercicio. Las series largas ("3×20-30 seg por lado") ahora se parten en dos renglones. Revisado en maqueta a 360 px, 390 px y tablet antes de aplicarlo.
- **Prueba 3:** _pendiente_ — verificar el botón de play en el celular.

### ✅ Llave de ExerciseDB cargada en Cloudflare
- `EXERCISEDB_KEY` subida con `wrangler secret put`.

### ❌ Unsplash (imágenes de comida) — cuota agotada
- Se agotó el plan gratuito. La app sigue funcionando: las comidas se muestran sin foto.
- **Pendiente / idea:** cambiar a Pexels y usar la misma caché `mediaCache`.

---

## 2026-11-03

### ✅ Fase 1a — backend en Cloudflare Workers (IA, medios, macros)
- **Cambios:** carpeta `worker/` (Hono). Reemplaza `firebase-admin` por:
  - `worker/lib/firebase-auth.js`: verificación del token de Firebase con las llaves públicas de Google.
  - `worker/lib/firestore.js`: cliente REST de Firestore con el service account.
- Rutas portadas sin cambios de lógica: `/agente-nutricion`, `/agente-entrenamiento`, `/gemini`, `/gemini-images`, `/upload-photo`, `/food-image`, `/youtube`, `/ejercicio`, `/calcular-macros`, `/registrar-esfuerzo`, `/health`.
- `wrangler.jsonc`: un solo Worker; `/api/*` → backend, todo lo demás → React (`dist`).
- `.env`: `VITE_BACKEND_URL=/api` (antes `https://fittrackpro.store/api`). Respaldo en `.env.backup.v2`.
- Secretos subidos con `scripts/cargar-secretos.mjs` (lee `backend/.env` + service account, nunca imprime valores).
- **Prueba:** la IA responde (alternativas de menú) ✅.
- **Hallazgo:** faltaban secretos que solo existían en el `.env` del VPS: `UNSPLASH_ACCESS_KEY`, `EXERCISEDB_KEY`, `CLOUDINARY_PRESET`, `MP_ACCESS_TOKEN`, `GMAIL_USER`, `GMAIL_PASS`. Guardarlos también en la app Contraseñas.
- **Mejora detectada:** las alternativas de comida sugieren platillos no mexicanos. Causa: el prompt `MEAL_SWAPPER` (`src/config/constants.js`) dice "mercado latinoamericano".

### ✅ Fase 0 — frontend en Cloudflare Workers
- `wrangler.jsonc` + `npm install -D wrangler`. URL: `https://fittrackpro-web.jcv-lab.workers.dev`.
- Dominio agregado en Firebase → Authentication → Authorized domains.
- **Prueba:** login y datos de Firebase OK ✅.

### ✅ Respaldo previo a la migración
- Rama `cloudflare-migration`. Se guardaron cambios de agosto sin commit (wallpaper, sw, Dieta/Ejercicio) y la app nativa `ios/` (SwiftUI con datos de prueba).

---

## 2026-10 (retroactivo)

### ❌ Intento de migración a Render (~2026-10-13)
- `fittrackpro-web` (estático): desplegado y funcionando.
- `fittrackpro-api` (Node): **falló el deploy**. No se investigó la causa; se descartó Render (el plan gratis duerme el servidor y apagaría los crons).
- **Pendiente:** borrar ambos servicios de Render cuando el dominio apunte a Cloudflare.

### ❌ Pérdida del VPS (2026-10)
- El VPS (srv945792) se perdió sin respaldo. Se perdieron el backend corriendo y su `.env`. Los datos estaban a salvo en Firebase (Firestore/Auth) y Cloudinary.

---

## 2026-08 (retroactivo, según historial de git)

### ⚠️ 2026-08-03 — Reestructura para GitHub
- Commit `7a40dc5`: "Reestructurar FitTrack Pro para GitHub: frontend por dominio, backend modular".
- **Efecto no detectado en su momento:** la parte visual de GIFs/videos de ejercicios no pasó al frontend nuevo (los endpoints sí). Detectado el 2026-11-04.
- Otros commits del periodo: progreso diario en Firestore (`6ce16a1`), export a Calendario iOS `.ics` (`2ca11b2`), endpoint de resumen del día y wallpaper con anillos (`35435da`, `62e1930`).
