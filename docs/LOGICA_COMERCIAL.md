# Lógica comercial — FitTrack Pro

Documento vivo: cómo gana dinero la app, quién paga qué, y qué aplica realmente el código.
Se actualiza conforme avanzamos. Última revisión: 2026-11-04 (levantado leyendo el código, no supuesto).

Estado de cada regla: ✅ aplicada en el código · ⚠️ prometida pero no aplicada / incompleta · ❓ por definir

---

## 1. Modelo en una línea

Freemium por suscripción: el usuario entra gratis con un plan de IA limitado y paga **$99 MXN/mes** (Mercado Pago o Hotmart) para desbloquear todo. Los coaches humanos atienden clientes dentro de la app, pero hoy **no existe un esquema de cobro para ellos ni comisión** (❓).

## 2. Tipos de usuario

| Tipo | Cómo entra | Qué obtiene | Paga |
|---|---|---|---|
| **Cliente IA** | Registro normal, elige "Plan con IA" en el onboarding | Plan de entrenamiento + dieta generado por IA al instante | Gratis → Premium $99/mes |
| **Cliente con coach** | Link de referido de un coach (`/join/:code`) o elige "Coach Humano" en el onboarding | El coach tiene 24 h (`coachDeadline`) para entregarle el plan; el coach se lo publica con 7 días desbloqueados | ❓ Hoy no paga nada (la opción dice "Premium" pero no cobra) |
| **Coach** | Llena la solicitud pública → el admin la aprueba | Panel con sus clientes referidos, métricas, editor de planes, historial | ❓ No paga ni cobra a través de la app |
| **Admin** | `users/{uid}.admin = true` | Panel admin: usuarios, premium manual, coaches, mensajes masivos | — |
| **Demo** | Botón de demo en el login (cuenta anónima) | Panel de coach con 5 clientes de ejemplo; se borra solo (cron) | — |

## 3. Gratis vs Premium

Lo que dice la pantalla de planes (`PlanesScreen.jsx`) contra lo que hace el código:

| Función | Gratis (promesa) | Premium (promesa) | ¿Se aplica? |
|---|---|---|---|
| Días visibles del plan | 3 días | 7 días | ✅ `plans.daysUnlocked` 3 ó 7 · ⚠️ ver hallazgo H1 |
| Alternativas de comida | 1 por semana | Ilimitadas | ⚠️ El código cuenta **1 en total**, no por semana (`DietaTab.jsx`) |
| Lista del súper | No | Sí | ✅ |
| Fotos de progreso + análisis IA | No | Sí | ✅ |
| Regenerar plan con IA | No | Sí | ❓ por verificar |
| Chat ilimitado con coach | (implícito: limitado) | Ilimitado | ⚠️ No hay límite para gratis en el código |
| Videos de ejercicios | No | Sí | ⚠️ Se muestran a todos (GIF/video sin candado) |
| Acceso al plan | "Durante 1 mes" | Mientras pague | ⚠️ No hay caducidad para gratis |
| Banner de upgrade | Se muestra a clientes IA no premium | — | ✅ |

Una sola fuente de verdad para premium: `users/{uid}.premium === true` (`utils/metrics.js → isPremium`).

## 4. Cómo se cobra

### Mercado Pago (suscripción mensual)
1. El usuario toca "Pagar con Mercado Pago" → se registra el intento (`/registrar-intento-pago`) y se abre el checkout de suscripción (`preapproval_plan_id = VITE_MP_PLAN_ID`).
2. Al pagar, MP regresa a `fittrackpro.store?pago=exitoso&uid=...` → la app llama `/verificar-pago`, que consulta MP y activa premium **y desbloquea los 7 días**.
3. En paralelo MP avisa al webhook `/api/webhook`; el Worker consulta la suscripción/pago en la API de MP (no confía en el aviso) y activa premium por correo o `payerId`, y manda el correo "Ya eres Premium".
- Pendiente: cambiar la URL del webhook en el panel de MP y cargar `MP_ACCESS_TOKEN`.

### Hotmart
1. "Pagar con Hotmart" abre `pay.hotmart.com/U106114157J` con el correo y nombre precargados.
2. Hotmart avisa a `/api/webhook-hotmart` (firmado con hottok ✅ probado).
3. Si el comprador ya tiene cuenta → premium + correo. Si no → `premiumPendiente/{correo}` y se le activa al terminar su onboarding con ese correo.

### Eventos que cambian premium

| Activan | Quitan |
|---|---|
| Hotmart `PURCHASE_APPROVED`, `SUBSCRIPTION_REACTIVATED` · MP suscripción `authorized` / pago `approved` · Admin manual | Hotmart `SUBSCRIPTION_CANCELLATION`, `PURCHASE_REFUNDED`, `PURCHASE_CHARGEBACK`, `PURCHASE_PROTEST` (decisión 2026-11-04) · MP suscripción cancelada/pausada · Admin manual |

`PURCHASE_CANCELED` (compra no pagada) no quita premium porque nunca lo activó.

## 5. Retención (automática, crons)

Para que el usuario no abandone y llegue a pagar / siga pagando:
- 21 h: recordatorio si no registró comidas hoy · pregunta del día.
- 20–23 h: mensaje del coach IA si lleva días sin abrir la app.
- 10–13 h: mensaje por inactividad · 11–14 h: acompañamiento la primera semana.
- Correo de bienvenida al terminar el onboarding.

## 6. Medición

Eventos que ya se registran (`utils/analytics.js`): `checkout_started` (MP, valor 99), `checkout_hotmart`, `purchase` (MXN 99, `premium_monthly`), `onboarding_complete` (modalidad, objetivo, equipo), `app_open`, `session_start`, `lista_super_opened`.
Con esto se puede sacar: conversión onboarding → checkout → pago, y qué modalidad/objetivo convierte más.

---

## 7. Hallazgos (huecos comerciales), por impacto

- ✅ **H1 (arreglado 2026-11-04) — Quien paga por webhook no ve los 7 días.** Los webhooks de Hotmart y MP ponen `premium: true` pero **no** cambian `plans.daysUnlocked` a 7; solo lo hace `/verificar-pago` cuando el usuario regresa del checkout de MP. Un comprador de Hotmart queda premium con 3 días. Y al quitar premium no se vuelve a 3. **Arreglo propuesto:** que activar/quitar premium siempre actualice `daysUnlocked` (en el servidor, un solo lugar).
- ✅ **H2 (arreglado 2026-11-04, falta publicar reglas) — Cualquiera podía darse premium, y también admin o coach.** El onboarding escribe `premium: true` directo en Firestore desde el navegador (caso premium pendiente). Si las reglas de Firestore permiten eso, un usuario puede activarse premium desde la consola del navegador. No hay `firestore.rules` en el repo para revisarlo. **Arreglo propuesto:** mover esa activación al Worker y bloquear en las reglas que el cliente escriba `premium`, `premiumStatus`, `admin`, `role`.
- **H3 — Promesas sin candado:** videos para todos, chat sin límite, "1 alternativa por semana" que en realidad es 1 en total, "acceso 1 mes" sin caducidad. O se aplican o se cambia el texto de la pantalla de planes.
- **H4 — Modalidad coach sin modelo de cobro.** Se etiqueta "Premium" pero no cobra; el coach no paga ni recibe comisión. Es la parte de mayor valor (atención humana) y hoy genera $0.
- **H5 — Precio fijo en el código** ($99 en `PlanesScreen`, `PremiumBanner`, analítica, plan de MP). Cambiar precio o hacer promociones requiere tocar código en 4 lugares.

## 8. Preguntas abiertas (para definir con Jesús)

1. ¿El cliente con coach paga? ¿Cuánto, y a quién (a FitTrack o al coach)?
2. ¿El coach paga una membresía para usar la plataforma, o FitTrack cobra comisión por cliente?
3. ¿Qué pasa al mes del plan gratis: se bloquea, se reduce, o sigue igual?
4. ¿Habrá plan anual o descuentos (ej. 3 meses)?
5. ¿Prueba gratis de premium (ej. 7 días) antes de cobrar?
6. ¿Se mantiene Hotmart o solo Mercado Pago? (Hotmart cobra comisión mayor; MP es más directo en México.)
