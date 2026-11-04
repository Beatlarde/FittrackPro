# Bitácora de cambios — FitTrack Pro

Registro de cada modificación: qué se cambió, en qué archivos, cómo se probó y si salió bien.
Sirve para saber en qué punto se rompió algo y para no volver a perder funciones en una mudanza.

**Cómo agregar una entrada:** la más reciente va arriba. Usa el estado:
✅ funcionó · ⚠️ funcionó con pendientes · ❌ falló / revertido · 🔄 en progreso

---

## 📋 Pruebas pendientes

Pruebas que no se pudieron hacer en su momento. Al hacerlas, mover el resultado a la entrada correspondiente y borrar la línea de aquí.

- [ ] **Coach ve las fotos de su cliente** (agregada 2026-11-04). No se pudo probar: la cuenta de prueba es premium sin coach asignado, y no existe un rol de coach general que vea a todos los clientes. Para probar: cuenta coach → registrar un cliente con su link de referido → subir foto desde el cliente → revisar en el panel del coach (1) la galería del cliente y (2) la tarjeta de métricas "últimas fotos". Depende de las reglas de seguridad de Firestore para `photos`.
- [ ] **Panel admin → Coaches** (Fase 1b): carga lista de coaches y solicitudes.
- [ ] **Demo de coach** desde el login (en incógnito): abre panel con 5 clientes de ejemplo.

## 2026-11-04

### 🔄 Las fotos subidas no aparecían en la tarjeta de métricas del coach
- **Causa:** `/coach/cliente-metricas` pedía las fotos con `orderBy('timestamp')`, pero `/upload-photo` las guarda con `createdAt`. Firestore descarta los documentos sin el campo de orden → la tarjeta "últimas fotos" nunca mostraba fotos subidas. **Venía del backend original.**
- **Cambio:** `worker/routes/coach.js` trae las fotos sin `orderBy`, las ordena en el Worker por `createdAt` o `timestamp` (lo que tenga cada una), excluye videos de técnica y toma las 4 más recientes.
- **Nota:** la galería del cliente dentro del panel del coach (`PhotosSection isCoach`) lee Firestore directo; depende de que las reglas de Firestore permitan al coach leer `photos` de sus clientes. **Verificar con una cuenta de coach real.**
- **Prueba local:** foto vieja (`timestamp`) + nueva (`createdAt`) + video → aparecen las 2 fotos, la nueva primero, sin el video ✅.

### ✅ "Fotos de progreso" dejaba la app en blanco + aislamiento de secciones
- **Diagnóstico (en el navegador, capturando errores):** `ReferenceError: PHOTO_CATEGORIES is not defined`. La constante quedó definida (y sin usarse) en `CoachNotesWidget.jsx` durante la reestructura del 2026-08-03, y `PhotosSection.jsx` la usaba sin importarla. **La sección estaba rota desde agosto.**
- **Cambios:**
  - `src/config/constants.js`: `export const PHOTO_CATEGORIES`. `PhotosSection.jsx` la importa; se quitó la copia huérfana de `CoachNotesWidget.jsx`.
  - Nuevo `src/components/shared/SectionBoundary.jsx` (Error Boundary): si una sección falla, muestra nombre de la sección + error + "Reintentar", sin tumbar la app.
  - `ClientDashboard.jsx`: el contenido de cada pestaña va dentro de `SectionBoundary` (se reinicia al cambiar de pestaña).
  - `main.jsx`: respaldo general para toda la app (pantalla de error con "Reintentar" en vez de pantalla en blanco).
- **Prueba local:** sección que truena → tarjeta de error, navegación funciona, volver a "Hoy" OK ✅.
- **Prueba en producción:** ✅ "Fotos de progreso" ya abre.
- **Lección:** la reestructura de agosto dejó al menos 3 cosas rotas sin que se notara (GIFs, `PHOTO_CATEGORIES`, fotos sin token). Con `SectionBoundary` estos errores ahora se ven de inmediato.

### ✅ Causa real de "se queda colgado": ciclo de recarga infinito
- **Síntoma:** la app se quedaba en el spinner o en blanco (Chrome y Safari). Al inspeccionarla, la página se recargaba sola una y otra vez.
- **Causa:** el script de auto-actualización de `index.html` descarga `/index.html` y recarga si el bundle publicado es distinto al cargado. Pero `public/sw.js` respondía esa petición **desde su caché** (copia guardada al instalarse) → siempre "veía" una versión distinta → recargaba → en bucle. Empeoraba con cada deploy (cada build cambia el hash del bundle). Probablemente también explica el síntoma atribuido antes a la red de la oficina.
- **Cambios:**
  - `public/sw.js` (v3): `/` e `/index.html` siempre red primero (caché solo sin internet); no intercepta `/api/` ni dominios externos; `CACHE_NAME` → `fittrack-pro-v3` (borra la caché vieja).
  - `index.html`: el chequeo pide `/?v=<timestamp>` con `no-store` y tiene freno de seguridad: máximo una recarga automática cada 30 s (`sessionStorage`).
- **Prueba local:** servidor que siempre reporta "versión nueva" → 2 cargas y se detiene ✅ (sin freno: infinitas).
- **Prueba en producción:** ✅ la app vuelve a cargar en Chrome.
- **Nota:** el ajuste de Firestore (`experimentalForceLongPolling`) se conserva; no estorba y ayuda en redes restrictivas.

### 🔄 Subida de fotos se quedaba colgada
- **Causas encontradas:**
  1. Ninguna de las 3 pantallas que suben archivos (Fotos de progreso, fotos del onboarding, video de técnica) mandaba el token → el backend respondía 401. **Venía del backend original.**
  2. El Worker convertía la foto completa a base64 antes de mandarla a Cloudinary: con fotos de celular de 3–5 MB rebasa los 10 ms de CPU del plan gratis.
- **Cambios:**
  - Nuevo `src/services/uploadMedia.js` (`subirArchivo`): manda el token, reduce fotos a JPEG ≤1600 px (≈10x menos peso, convierte HEIC), tiempo límite 60 s fotos / 180 s videos.
  - Usado en `PhotosSection.jsx`, `OnboardingPhotos.jsx` y `ClientDashboard.jsx` (video de técnica).
  - `worker/routes/media.js`: reenvía el archivo a Cloudinary como multipart, sin base64.
  - Secreto `CLOUDINARY_PRESET` = `fittrack_photos` (preset *unsigned*).
- **Prueba local:** foto de 3 MB llega a Cloudinary como archivo ✅; sin token → 401 ✅.
- **Prueba en producción:** _pendiente_

### 🔄 Fase 1b — coach, admin, planes, premium y demo en Workers
- **Archivos nuevos:** `worker/routes/coach.js`, `admin.js` (incluye `/solicitud-coach`), `plans.js`, `premium.js`, `demo.js`; `worker/lib/fechas.js` (fechas en hora CDMX); `worker/lib/email.js` (pendiente: se implementa en Fase 2, por ahora solo registra y lanza error).
- **Bugs del backend original encontrados y corregidos:**
  - `/coach/guardar-plan-cliente`, `/coach/cliente-metricas/:id` y `/notificar-nuevo-cliente` usaban `.exists()` como función (en firebase-admin es propiedad) → **siempre fallaban**.
  - `/demo/crear-sesion` no pedía login: cualquiera podía mandar el uid de otra cuenta y sobrescribirla como coach premium. Ahora exige el token de la sesión anónima y que el uid coincida. Cambio en `src/components/auth/LoginScreen.jsx` para mandar el token.
  - "Hoy" se calculaba en UTC: entre 6 pm y medianoche las métricas del coach mostraban el día equivocado. Ahora usa hora de CDMX.
  - `/mensaje-bienvenida` nunca funcionó: el onboarding no manda token. **Pendiente para Fase 2.**
- **Optimización:** `/coach/dashboard-metricas` hacía 2 consultas por cliente (con 25+ clientes rebasaría el límite de 50 subpeticiones del plan gratis). Ahora trae los logs de hasta 30 clientes por consulta.
- **Deuda técnica anotada:** la clave `entrenarонHoy` tiene una "о" cirílica, en el backend y en `CoachDashboard.jsx`. Se conservó para no romper el panel; corregir en ambos lados a la vez.
- **Mercado Pago:** `/verificar-pago` ahora consulta la API REST (`/preapproval/:id`); requiere el secreto `MP_ACCESS_TOKEN` (pendiente).
- **Prueba local:** con Firestore simulado — referidos, clientes, métricas (2 subpeticiones), guardar plan con historial, demo bloqueando ataque, admin protegido ✅.
- **Prueba en producción:** _pendiente_

### ✅ La app se queda en el spinner de carga en la red de la oficina
- **Síntoma:** la app no pasa del spinner inicial. En el celular con datos móviles carga normal; en Chrome y Safari (red de oficina) se cuelga.
- **Diagnóstico:** en Network, la petición `firestore.googleapis.com/.../Listen/channel` queda en `pending` para siempre. La red corporativa/VPN corta el canal en vivo (WebChannel) de Firestore, y la app espera el perfil del usuario para salir del spinner. **No es causado por la migración** (Firestore se conecta directo desde el navegador, sin pasar por Cloudflare).
- **Cambio:** `src/firebase.js` → `initializeFirestore(app, { experimentalForceLongPolling: true })` en lugar de `getFirestore(app)`.
- **Prueba:** abrir la app en la red de la oficina.
- **Resultado:** ✅ la app carga en la red de la oficina.

### Ajuste: la caché de medios ya no guarda resultados vacíos
- `worker/routes/media.js`: solo se guardan en `mediaCache` las búsquedas que sí encontraron GIF o video, para reintentar después las que fallaron. (La prueba de `wall sit` devolvió "sin GIF" y había quedado guardada.)
- Se agregaron tiempos límite: 8–10 s en el Worker para ExerciseDB/YouTube y 15 s en la app, para que "Buscando demostración..." nunca se quede ciclado.

### ✅ Recuperar GIFs y videos de los ejercicios
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
- **Prueba 3:** botón de play en el celular ✅ — "me gusta más".

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
