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
- [ ] **Correo llega a la bandeja:** el envío salió sin errores; confirmar que el plan llegó a pruebacoach01@gmail.com y si cayó en Spam.
- [ ] **Hotmart cancelación de suscripción:** tras el deploy, reenviar "Cancelación de suscripción" desde el panel de Hotmart → el log debe mostrar el correo (no `null`) y quitar premium si la cuenta existe.
- [ ] **Después de publicar las reglas nuevas** (con cuenta normal de cliente): abrir la app, marcar una comida, cambiar modo oscuro, calificar el día → todo guarda sin errores. Con cuenta coach: enviar plan a un cliente. Con admin: activar/quitar premium a un usuario.
- [ ] **Revisar que nadie se haya dado permisos:** en el panel admin, ver qué usuarios tienen `admin` o `role: coach` y confirmar que cada uno sea legítimo.
- [ ] **Platillos mexicanos + macros por comida:** generar un plan nuevo → platillos caseros mexicanos, cada comida con macros distintos que sumen el total del día. Pedir alternativa de desayuno y de colación → solo platillos de ese momento, con kcal y macros visibles.
- [ ] **Dominio:** abrir https://fittrackpro.store y https://www.fittrackpro.store (debe redirigir), iniciar sesión, y probar que el regreso de pago de Mercado Pago (`?pago=exitoso`) cae en el dominio.
- [ ] **Limpiar cuenta de prueba:** proyecto.fittrackpro@gmail.com quedó premium por la prueba de "Compra aprobada" de Hotmart; quitárselo desde el panel admin si no debe serlo. Borrar en Firestore `premiumPendiente/testeComprador271101postman15@example.com` si existe.
- [ ] **Webhook Mercado Pago:** cambiar la URL en el panel de MP a `/api/webhook` y hacer un pago/suscripción de prueba → el usuario queda premium y recibe el correo.
- [ ] **Hotmart con compra real:** comprar con un correo que ya tenga cuenta en FitTrack → queda premium y llega el correo. (El panel de Hotmart ya responde 200.)
- [ ] **Crons:** revisar en Cloudflare → Workers → fittrackpro-web → Logs, después de las 21:00 CDMX, que aparezca "⏰ Cron 21h CDMX" y lleguen los recordatorios.
- [ ] **Mensaje de bienvenida:** crear una cuenta nueva y terminar el onboarding → aparece el mensaje del Coach FitTrack y llega el correo.

## 🐞 Bugs conocidos sin arreglar

- **El progreso del día se reinicia a las 6 pm (CDMX)** (detectado 2026-11-04). El frontend guarda `dailyProgress` y `dayReviews` con la fecha ISO en UTC (`toISOString().split('T')[0]`), y en CDMX el día UTC cambia a las 18:00. El cron del servidor ya usa la misma convención para no desfasarse; cuando se arregle en el frontend hay que cambiar también `marcarPreguntaDelDia` y `lastReminderDate` en `worker/crons.js`.
- **Clave con letras cirílicas `entrenarонHoy`** en `/coach/dashboard-metricas` y en el frontend que la lee. Funciona porque ambos lados usan la misma clave rara; arreglar los dos a la vez.

## 2026-11-04

### ✅ Dominio fittrackpro.store → Cloudflare Worker
- **Hallazgo:** el dominio (Namecheap) apuntaba con registros A a `31.97.115.207`, el VPS que ya no existe → `fittrackpro.store` no abría la app. Tenía reenvío de correo de Namecheap (MX `eforward`), que Jesús confirmó que no usa.
- **Cambio:** nameservers de Namecheap → Cloudflare (zona activa 2026-11-04). Se borraron los A del VPS. `wrangler.jsonc`: `routes` con `custom_domain` para `fittrackpro.store` y `www.fittrackpro.store` (respaldo `wrangler.backup.dominio.jsonc`). Redirección www → raíz con una Redirect Rule de Cloudflare (corre antes del Worker; el Worker solo ve `/api/*` primero).
- **Resultado (Jesús, 18:25):** deploy, Redirect Rule y prueba en el dominio salieron bien ✅.
- **Pendiente:** borrar los servicios de Render. Opcional: borrar los MX/TXT de Namecheap en el DNS de Cloudflare.

### ⚠️ Macros por comida reales + alternativas según el momento del día
- **Problema (reportado por Jesús con captura):** desayuno y media mañana mostraban los mismos macros (32/29/12). `estimarMacrosComida` dividía los macros del día entre el número de comidas y buscaba "desayuno" dentro del texto del platillo (casi nunca estaba) → todas iguales. Además "Ver alternativa" solo mandaba el texto del platillo: la IA no sabía si era desayuno o cena ni qué macros cumplir.
- **Cambio:**
  - `worker/prompts.js`: reglas nuevas en el bloque de cocina — cada platillo propio de su momento (desayuno, colación ligera, plato fuerte, cena ligera); cada comida trae `kcal/proteina/carbs/grasas`; la suma del día debe cuadrar (±5%); reparto orientativo 25/35/25 + colaciones. Ejemplos de JSON con macros por comida también en `OnboardingFlow.jsx` y `CoachDashboard.jsx`.
  - `src/utils/metrics.js`: `macrosDeComida(comida, dieta)` usa los macros de la IA si existen; en planes viejos reparte los del día según el momento (ya no salen iguales).
  - `DietaTab.jsx`: la alternativa manda el momento, la meta de macros de esa comida y lo que ya come ese día (para no repetir); pide solo platillos de ese momento; muestra kcal y macros de cada opción y los guarda en el plan al elegirla.
  - `ClientDashboard.jsx`: si la alternativa ya trae macros, se registra sin otra llamada a la IA.
  - Respaldos: `*.backup.macros.*`.
- **Prueba local:** plan viejo de 5 comidas → desayuno 40/36/15, media mañana 13/11/5, comida 55/50/21, colación 13/11/5, cena 40/36/15; la suma cuadra con el día ✅ · plan nuevo usa los de la IA ✅ · los prompts incluyen las reglas ✅ · todo compila ✅.
- **Falta prueba real:** pedir alternativa de desayuno y de colación (que no salga un plato fuerte) y regenerar un plan (que cada comida traiga macros distintos y sumen el total del día).

### 🔄 Comidas: platillos mexicanos caseros en la IA
- **Problema (reportado por Jesús):** la IA proponía comida "fitness" genérica, no platillos típicos mexicanos. Los prompts solo decían "alimentos accesibles en México" y el único ejemplo era "3 huevos con avena".
- **Cambio:**
  - `worker/prompts.js`: nuevo bloque `COCINA_MEXICANA` (ejemplos por tiempo de comida, ingredientes base, cómo ajustarlo a macros sin freír, cantidades, presupuesto, no repetir más de 2 veces por semana). Se agrega al agente de nutrición y al del plan semanal; el ejemplo del JSON ahora es "Huevos a la mexicana con tortillas y frijoles".
  - `src/config/constants.js` (MEAL_SWAPPER), `DietaTab.jsx` (alternativas) y `MealSwapModal.jsx`: piden platillos caseros mexicanos con cantidades.
  - Respaldos: `*.backup.mx.*`.
- **Prueba local:** los prompts cargan y ambos agentes incluyen el bloque ✅ (se detectó y corrigió un error de orden: el bloque se usaba antes de definirse). Frontend compila ✅.
- **Falta prueba real:** ver qué responde la IA (no se puede llamar a Gemini desde la sesión).

### ⚠️ Premium centralizado (H1) + reglas de Firestore endurecidas (H2)
- **H1 — quien pagaba por webhook se quedaba con 3 días:** nuevo `worker/lib/premium.js` (`aplicarPremium`), único lugar que activa/quita premium. Siempre ajusta `plans.daysUnlocked` (7 premium / 3 gratis; a clientes de coach no les baja los días). Lo usan los webhooks de Hotmart y MP, `/verificar-pago`, `/admin/activar-premium` y `/admin/actualizar-plan-premium`.
  - De paso: el correo "¡Ya eres Premium!" ya no se repite en cada cobro mensual; solo sale cuando el usuario pasa de gratis a premium.
  - `ClientDashboard.jsx`: un usuario premium ve 7 días aunque su plan guardado diga 3 (arregla a los que ya pagaron y quedaron atorados).
- **H2 — cualquier usuario podía darse premium, admin o coach:** las reglas de Firestore dejaban al dueño editar todo su documento `users`, incluidos `premium`, `admin` y `role`, y poner `daysUnlocked: 7` en su plan.
  - `firestore.rules` (nuevo en el repo; antes solo vivían en la consola): `premium*`, `admin`, `role`, `mpSubscriptionId`, `mpPayerId` y `hotmartTransactionId` solo los cambia el servidor o el admin. Al registrarse solo se puede nacer como `client`. `daysUnlocked` solo lo cambian servidor, coach o admin. Lo demás quedó igual.
  - `AdminPanel.jsx`: premium se cambia por el Worker (antes escribía directo en Firestore).
  - `OnboardingFlow.jsx`: el premium pendiente de Hotmart lo reclama el Worker (`/reclamar-premium-pendiente`). **Hallazgo:** el código anterior leía `premiumPendiente` desde el navegador, pero las reglas solo dejaban leerlo al admin → quien pagaba en Hotmart antes de registrarse **nunca** recibió premium.
  - Respaldos: `*.backup.premium.jsx` de los 3 archivos.
- **Prueba local (Worker):** 12 casos ✅ — compra Hotmart (7 días, 1 correo), renovación (sin correo), reembolso (3 días), cliente de coach cancela (se queda en 7), reclamar pendiente, MP alta/cobro mensual/cancelación, admin activa/quita, no-admin rechazado (403). Frontend compila ✅.
- **Reglas publicadas en la consola** 2026-11-04 17:45. No se pudieron probar en emulador (red bloqueada). Se revisaron contra todas las escrituras de la app a `users` y `plans`. Si algo falla al publicarlas: consola → Reglas → versión anterior (9 jun 2026) → restaurar.

### 🔄 Documento de lógica comercial
- **Nuevo:** `docs/LOGICA_COMERCIAL.md` — tipos de usuario, gratis vs premium (promesa contra lo que aplica el código), cobro por MP y Hotmart, retención, medición, hallazgos y preguntas abiertas. Se irá completando.
- **Hallazgos registrados ahí (sin arreglar aún):** H1 webhooks no desbloquean los 7 días · H2 el navegador puede escribir `premium` en Firestore · H3 promesas de premium sin candado · H4 modalidad coach sin cobro · H5 precio fijo en 4 lugares.

### ✅ Gmail funcionando + cancelación de suscripción en Hotmart no quitaba premium
- **Gmail (prueba real):** `enviar-plan-email` a pruebacoach01@gmail.com y correo de premium de Hotmart a proyecto.fittrackpro@gmail.com, sin errores SMTP en `wrangler tail` ✅. Remitente: proyecto.fittrackpro@gmail.com.
- **Bug (venía del backend original):** en `SUBSCRIPTION_CANCELLATION` Hotmart manda el correo en `data.subscriber.email`, no en `data.buyer.email` → el log mostraba `null` y la cancelación nunca quitaba premium.
- **Cambio:** `worker/routes/webhooks.js` toma el correo de `buyer`, `subscriber` o `subscription.subscriber`.
- **Prueba local:** cancelación con `subscriber` → premium false ✅. Reenviar "Cancelación de suscripción" desde Hotmart tras el deploy: el log debe mostrar el correo, no `null`.
- **Nota:** `PURCHASE_CANCELED` (compra no pagada) no quita premium a propósito: esa compra nunca lo activó.

### ✅ Hotmart: contracargo y disputa ahora quitan premium
- **Decisión de Jesús:** si hay contracargo (`PURCHASE_CHARGEBACK`) o disputa (`PURCHASE_PROTEST`), se retira premium. Antes solo lo quitaban cancelación y reembolso.
- **Cambio:** `worker/routes/webhooks.js`, lista `QUITAN_PREMIUM` con los 4 eventos. Si el comprador aún no tiene cuenta, se borra su `premiumPendiente` para que no quede premium al registrarse.
- **Prueba local:** contracargo y disputa → premium false ✅ · disputa sin cuenta → pendiente borrado ✅ · evento ajeno (primer acceso) no cambia nada ✅.

### ✅ Webhook Hotmart respondía 401 a los eventos de prueba
- **Síntoma:** en Hotmart → Webhook, los envíos de prueba ("Primer acceso", "Módulo completo") salían con 401.
- **Cambio:** `worker/routes/webhooks.js` ahora acepta el hottok en el header `X-HOTMART-HOTTOK`, en el cuerpo (`hottok`, JSON o formulario del postback 1.0) o en la URL, y le quita espacios/saltos de línea al comparar. Si falla, el log dice de dónde llegó y la longitud (sin mostrar el valor).
- **Prueba local:** header, cuerpo JSON, formulario y URL → 200; hottok incorrecto → 401 ✅.
- **Causa real:** el secreto `HOTMART_HOTTOK` quedó guardado con 45 caracteres y el hottok de Hotmart tiene 38 (se coló texto extra al pegarlo). El log de diagnóstico lo mostró (`esperado len45 | cuerpo=len38`). Se volvió a guardar con `printf '%s' '<hottok>' | npx wrangler secret put HOTMART_HOTTOK` desde `~/FittrackPro`.
- **Prueba real:** curl al Worker publicado con el hottok en el cuerpo → 200 ✅.
- **Lección:** cargar secretos con `printf '%s' ... |` y siempre desde la carpeta del proyecto; si un webhook da 401, `npx wrangler tail` muestra las longitudes.

### ⚠️ Fase 2: correos, pagos y tareas programadas en el Worker
- **Correo:** `worker/lib/email.js` usa `worker-mailer` (SMTP de Gmail, puerto 465 con TLS; Cloudflare bloquea el 25). Requiere los secretos `GMAIL_USER` y `GMAIL_PASS` (contraseña de aplicación de Google). Sin ellos responde error claro en vez de fallar en silencio.
- **Rutas nuevas** (`worker/routes/comms.js`): `/send-email` y `/mensaje-bienvenida`.
  - **Arreglo de seguridad:** en el backend original `/send-email` dejaba a cualquiera mandar correos a cualquier dirección usando la cuenta de FitTrack. Ahora: un usuario solo a su propio correo, un coach solo a sus clientes, el admin a cualquiera.
  - `/mensaje-bienvenida` exige token y que el uid sea el del usuario. `OnboardingFlow.jsx` ahora manda el token (antes no lo mandaba).
- **Webhooks** (`worker/routes/webhooks.js`): `/webhook` (Mercado Pago) y `/webhook-hotmart`.
  - **Arreglo de seguridad:** el webhook de Hotmart original no verificaba nada; cualquiera podía activarse premium con un POST. Ahora exige el header `X-HOTMART-HOTTOK` igual al secreto `HOTMART_HOTTOK`.
  - Mercado Pago: se consulta el pago/suscripción en la API de MP con `MP_ACCESS_TOKEN` antes de activar premium (no se confía en lo que dice el aviso).
- **Crons** (`worker/crons.js`, cada 15 min, `wrangler.jsonc`): recordatorio de comidas y pregunta del día (21h), mensajes del coach por ausencia (20–23h), inactividad (10–13h) y primera semana (11–14h), limpieza de demos.
  - Cloudflare gratis permite ~50 peticiones por ejecución: cada corrida tiene presupuesto de 42; si hay más usuarios de los que caben, sigue en la siguiente corrida (las marcas evitan repetir).
  - **Arreglo:** el recordatorio de comidas original buscaba en la colección `activity` (que la app ya no usa) y con fecha UTC → mandaba recordatorio aunque sí hubieras registrado comida. Ahora revisa `logs` con la fecha de CDMX.
- **Prueba local (servicios simulados):** permisos de `/send-email` (5 casos) ✅ · Hotmart sin hottok 401 / con hottok activa premium ✅ · MP consulta `/preapproval` y activa ✅ · cron 21:05 con 23 usuarios: 34 peticiones (límite 50), recordatorio solo a quien no registró comida, ausencia en tandas sin repetir ✅.
- **Pendiente:** cargar secretos, cambiar URLs de webhooks y probar en real (ver Pruebas pendientes).

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
