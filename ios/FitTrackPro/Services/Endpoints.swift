import Foundation

/// Reference map from `APIServiceProtocol` methods to the real backend routes, extracted from
/// `backend/routes/*.js` and `src/services/api.js` in the main FitTrack Pro repo. Use this when
/// writing `LiveAPIService`. All paths are relative to `BACKEND_URL` (already includes `/api`).
/// Auth: Firebase ID token as `Authorization: Bearer <token>` unless noted "no auth".
enum Endpoints {
    static let health = "GET /health"                                   // no auth
    static let join = "GET /join/:code"                                 // no auth — resolve referral code
    static let demoCrearSesion = "POST /demo/crear-sesion"               // no auth — body { uid }

    static let gemini = "POST /gemini"                                   // { prompt, systemInstruction, model }
    static let geminiImages = "POST /gemini-images"                      // { prompt, imageUrls | images }
    static let agenteNutricion = "POST /agente-nutricion"                // { prompt, contextoUsuario, uid }
    static let agenteEntrenamiento = "POST /agente-entrenamiento"        // { prompt, contextoUsuario, uid }

    static let guardarPlan = "POST /guardar-plan"                        // { plan, daysUnlocked, startDayIndex }
    static let coachGuardarPlanCliente = "POST /coach/guardar-plan-cliente" // { clienteId, plan, daysUnlocked }
    static let enviarPlanEmail = "POST /enviar-plan-email"                // { clienteId }

    static let verificarPremiumGet = "GET /verificar-premium"
    static let verificarPremiumPost = "POST /verificar-premium"          // no auth, { uid }
    static let verificarPago = "POST /verificar-pago"
    static let registrarIntentoPago = "POST /registrar-intento-pago"     // { email }
    static let suscripcion = "POST /suscripcion"                         // no auth, { uid }
    static let adminActualizarPlanPremium = "POST /admin/actualizar-plan-premium" // { uid, premium }
    static let adminActivarPremium = "POST /admin/activar-premium"       // { email, motivo }
    static let webhookMercadoPago = "POST /webhook"                      // no auth
    static let webhookHotmart = "POST /webhook-hotmart"                  // no auth

    static let uploadPhoto = "POST /upload-photo"                        // multipart { file, uid, category }
    static let foodImage = "GET /food-image?q="
    static let youtube = "GET /youtube?q=&equipo="
    static let ejercicio = "GET /ejercicio?q="                           // no auth

    static let sendEmail = "POST /send-email"                           // { to, subject, html }
    static let mensajeBienvenida = "POST /mensaje-bienvenida"            // { uid }
    static let notificarNuevoCliente = "POST /notificar-nuevo-cliente"   // no auth

    static let calcularMacros = "POST /calcular-macros"                  // { weight, height, age, gender, activity, objective, bodyType }
    static let registrarEsfuerzo = "POST /registrar-esfuerzo"            // { ejercicioKey, ejercicio, rpe, rir }

    static let coachGenerarCodigo = "POST /coach/generar-codigo"
    static let coachClientes = "GET /coach/clientes?page=&limit="
    static let coachClienteMetricas = "GET /coach/cliente-metricas/:clienteId"
    static let coachDashboardMetricas = "GET /coach/dashboard-metricas"

    static let adminCoaches = "GET /admin/coaches"
    static let adminSolicitudesCoach = "GET /admin/solicitudes-coach"
    static let adminAprobarCoach = "POST /admin/aprobar-coach"           // { requestId }
    static let adminRechazarCoach = "POST /admin/rechazar-coach"         // { requestId, motivo }
    static let adminDarAltaCoach = "POST /admin/dar-alta-coach"          // { email, nombre }
    static let adminRevocarCoach = "POST /admin/revocar-coach"           // { uid }

    static let solicitudCoach = "POST /solicitud-coach"                  // no auth
    static let wallpaperResumenDia = "GET /wallpaper/resumen-dia"
}
