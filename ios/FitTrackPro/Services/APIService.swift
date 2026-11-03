import Foundation

/// Abstraction over the FitTrack Pro backend (Node/Express, mounted at `/api`, see
/// `backend/routes/*.js` in the main repo). `MockAPIService` implements this with in-memory
/// sample data so the app is fully interactive without a live server. Swap in a
/// `LiveAPIService` (URLSession + Firebase Auth token) later without touching any View code —
/// every method name/signature below is meant to map 1:1 onto a real endpoint documented in
/// `Endpoints.swift`.
protocol APIServiceProtocol: AnyObject {
    // Auth
    func login(email: String, password: String) async throws -> AppUser
    func loginDemoCoach() async throws -> AppUser
    func register(email: String, password: String, name: String) async throws -> AppUser
    func currentUserPublisher() -> AppUser?
    func logout()

    // Onboarding
    func calcularMacros(goals: Goals) async throws -> (kcal: Int, proteina: Int, carbs: Int, grasas: Int)
    func completeOnboarding(userId: String, goals: Goals, modalidad: Modalidad, coachNotes: String?, mealTimes: MealTimes) async throws -> AppUser
    func generarPlanIA(for userId: String) async throws -> TrainingPlan
    func uploadOnboardingPhotos(userId: String) async throws

    // Plans
    func fetchPlan(userId: String) async throws -> TrainingPlan?
    func guardarPlan(userId: String, plan: TrainingPlan) async throws
    func coachGuardarPlanCliente(clienteId: String, plan: TrainingPlan) async throws
    func toggleProgress(userId: String, dateKey: String, itemKey: String, isExercise: Bool) async throws -> AppUser
    func registrarEsfuerzo(userId: String, ejercicioKey: String, ejercicio: String, rpe: Int, rir: Int) async throws

    // Logs
    func fetchLogs(userId: String) async throws -> [LogEntry]
    func addLog(_ log: LogEntry) async throws -> LogEntry
    func generarAlternativa(momento: String, macros: (kcal: Int, proteina: Int, carbs: Int, grasas: Int)) async throws -> [String]

    // Photos
    func fetchPhotos(userId: String) async throws -> [PhotoEntry]
    func addPhoto(userId: String, category: String) async throws -> PhotoEntry
    func analizarProgresoIA(userId: String) async throws -> String

    // Chat
    func fetchMessages(userId: String) async throws -> [AppChatMessage]
    func sendMessage(userId: String, text: String, fromCoach: Bool, coachName: String?) async throws -> AppChatMessage

    // Premium
    func verificarPremium(userId: String) async throws -> Bool
    func activarPremiumMock(userId: String) async throws -> AppUser

    // Coach
    func coachGenerarCodigo(coachId: String) async throws -> String
    func coachClientes(coachId: String) async throws -> [CoachClientSummary]
    func coachClienteMetricas(clienteId: String) async throws -> CoachClientMetrics
    func coachDashboardMetricas(coachId: String) async throws -> CoachDashboardMetrics
    func coachHistorialPlanes(clienteId: String) async throws -> [TrainingPlan]
    func updateCoachNotes(clienteId: String, notes: String) async throws
    func requestClientPhotos(clienteId: String, category: String) async throws
    func setMeetLink(clienteId: String, link: String) async throws

    // Admin
    func adminMetrics() async throws -> AdminMetrics
    func adminCoaches() async throws -> [CoachSummary]
    func adminSolicitudesCoach() async throws -> [CoachRequest]
    func adminAprobarCoach(requestId: String) async throws
    func adminRechazarCoach(requestId: String, motivo: String) async throws
    func adminDarAltaCoach(email: String, nombre: String) async throws
    func adminRevocarCoach(uid: String) async throws
    func adminActivarPremiumManual(email: String, motivo: String) async throws

    // Public
    func solicitudCoach(nombre: String, email: String, telefono: String, especialidad: String, experiencia: String) async throws
}
