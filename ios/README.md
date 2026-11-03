# FitTrack Pro — iOS (SwiftUI)

App nativa iOS para FitTrack Pro, construida con SwiftUI (iOS 17+) y arquitectura MVVM. Cubre los tres roles de la plataforma: **Cliente**, **Coach** y **Admin**.

## Abrir el proyecto

Abre `FitTrackPro.xcodeproj` con Xcode 15 o superior y ejecuta el target `FitTrackPro` en un simulador o dispositivo con iOS 17+.

No requiere instalar dependencias externas (sin SPM/CocoaPods) — todo es Swift + SwiftUI + frameworks del sistema (PhotosUI, Combine).

## Cuentas demo (datos mock)

Ahora mismo la app corre 100% con datos de ejemplo en memoria (`Services/MockAPIService.swift`), sin conexión al backend real. Usa cualquier contraseña con:

- `cliente@demo.com` — cliente Premium con plan de 7 días
- `cliente.free@demo.com` — cliente gratis con plan de 3 días
- `coach@demo.com` — coach con 5 clientes de ejemplo
- `admin@demo.com` — panel de administración

También hay un botón "Probar como Coach (demo)" en el login, igual que el flujo `/demo/crear-sesion` de la web.

## Estructura

```
FitTrackPro/
├── App/            # Entry point, AppState (sesión/rol), enrutador raíz
├── Models/         # Structs Codable — User, Plan, Log, Chat, Coach, Admin…
├── Services/       # APIServiceProtocol + MockAPIService + mapa de endpoints reales
├── Theme/          # Colores/tokens de marca (tomados de src/utils/theme.js)
└── Views/
    ├── Auth/           # Login, solicitud para ser coach
    ├── Onboarding/     # Wizard multi-paso + fotos iniciales
    ├── Client/         # Dashboard, dieta, ejercicio, planes/premium, chat, progreso
    ├── Coach/          # Dashboard de clientes, detalle, mensajería, historial, referidos
    ├── Admin/          # Métricas, gestión de coaches, activación manual de premium
    └── Shared/         # Componentes reutilizables (ring, HUD, chat bubble, etc.)
```

## Conectar al backend real

`Services/APIService.swift` define el contrato completo; `Services/Endpoints.swift` documenta, método por método, a qué ruta real de `backend/routes/*.js` corresponde cada función (auth, planes, premium, IA, coach, admin…).

Para pasar de mock a real:

1. Crear `LiveAPIService: APIServiceProtocol` usando `URLSession` contra `BACKEND_URL` (ver `.env.example` del repo).
2. Integrar Firebase Auth para iOS (SDK `FirebaseAuth`) y adjuntar el ID token como `Authorization: Bearer <token>` en cada request, igual que hace `services/api.js` en el frontend web.
3. Sustituir `MockAPIService()` por `LiveAPIService()` en `App/FitTrackProApp.swift` (una sola línea).

Todos los modelos (`Models/*.swift`) ya están alineados con las formas de datos reales de Firestore/Express documentadas en el research inicial, así que el `Codable` debería mapear directo una vez conectado.

## Pendiente para producción

- Subida real de fotos/video a Cloudinary vía `/upload-photo` (hoy es un stub local).
- Checkout real de MercadoPago/Hotmart (hoy "Activar Premium" solo actualiza el estado local).
- Push notifications, Google Calendar sync y exportación `.ics`.
- Tests unitarios sobre `MockAPIService` y los ViewModels antes de escalar.
