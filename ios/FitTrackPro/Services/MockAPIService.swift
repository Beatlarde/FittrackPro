import Foundation
import Combine

/// In-memory implementation of `APIServiceProtocol`. Seeds three demo accounts
/// (cliente@demo.com, coach@demo.com, admin@demo.com — any password works) plus a
/// "probar como coach demo" flow mirroring `/demo/crear-sesion`. All async methods add a small
/// artificial delay so loading states behave like a real network call.
@MainActor
final class MockAPIService: ObservableObject, APIServiceProtocol {
    @Published private(set) var users: [String: AppUser] = [:]
    @Published private(set) var plans: [String: TrainingPlan] = [:]
    @Published private(set) var planHistorial: [String: [TrainingPlan]] = [:]
    @Published private(set) var logs: [String: [LogEntry]] = [:]
    @Published private(set) var photos: [String: [PhotoEntry]] = [:]
    @Published private(set) var messages: [String: [AppChatMessage]] = [:]
    @Published private(set) var coachRequests: [CoachRequest] = MockData.sampleCoachRequests()
    @Published private(set) var coaches: [CoachSummary] = MockData.sampleCoaches()
    @Published var currentUserId: String? = nil

    private let coachName = "Coach Ivan"

    init() { seed() }

    func currentUserPublisher() -> AppUser? {
        guard let id = currentUserId else { return nil }
        return users[id]
    }

    private func delay(_ seconds: Double = 0.35) async throws {
        try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
    }

    private func seed() {
        var client = AppUser(id: "client_demo", email: "cliente@demo.com", name: "Jesús Carbajal", role: .client)
        client.onboardingComplete = true
        client.modalidad = .ia
        client.premium = true
        client.premiumSource = "hotmart"
        client.planStatus = "active"
        client.goals = Goals(name: "Jesús Carbajal", age: 29, objective: .recomposicion, targetKcal: 2200, weight: 78, height: 178, proteina: 165, carbs: 220, grasas: 65)
        users[client.id] = client
        plans[client.id] = MockData.samplePlan(daysUnlocked: 7)
        logs[client.id] = MockData.sampleLogs(userId: client.id, userName: client.name)
        photos[client.id] = MockData.samplePhotos(userId: client.id)
        messages[client.id] = MockData.sampleMessages(userId: client.id, coachName: coachName)

        var freeClient = AppUser(id: "client_free_demo", email: "cliente.free@demo.com", name: "Vale Ortega", role: .client)
        freeClient.onboardingComplete = true
        freeClient.modalidad = .ia
        freeClient.premium = false
        freeClient.planStatus = "active"
        freeClient.goals = Goals(name: "Vale Ortega", age: 24, objective: .perdidaGrasa)
        users[freeClient.id] = freeClient
        plans[freeClient.id] = MockData.samplePlan(daysUnlocked: 3)
        logs[freeClient.id] = MockData.sampleLogs(userId: freeClient.id, userName: freeClient.name)
        photos[freeClient.id] = []
        messages[freeClient.id] = []

        var coach = AppUser(id: "coach_demo", email: "coach@demo.com", name: coachName, role: .coach)
        coach.onboardingComplete = true
        coach.premium = true
        coach.coachCode = "IVAN482"
        users[coach.id] = coach

        var admin = AppUser(id: "admin_demo", email: "admin@demo.com", name: "Admin FitTrack", role: .client)
        admin.admin = true
        admin.onboardingComplete = true
        users[admin.id] = admin
    }

    // MARK: - Auth

    func login(email: String, password: String) async throws -> AppUser {
        try await delay()
        let lowered = email.lowercased()
        if let match = users.values.first(where: { $0.email.lowercased() == lowered }) {
            currentUserId = match.id
            return match
        }
        throw APIError.notFound("No existe una cuenta con ese correo. Prueba cliente@demo.com, coach@demo.com o admin@demo.com.")
    }

    func loginDemoCoach() async throws -> AppUser {
        try await delay()
        let id = "coach_demo_session_\(Int(Date().timeIntervalSince1970))"
        var demoCoach = AppUser(id: id, email: "demo+\(id)@fittrackpro.store", name: "Coach (Demo)", role: .coach)
        demoCoach.onboardingComplete = true
        demoCoach.premium = true
        demoCoach.isDemo = true
        demoCoach.coachCode = "DEMO\(Int.random(in: 100...999))"
        users[id] = demoCoach
        currentUserId = id
        return demoCoach
    }

    func register(email: String, password: String, name: String) async throws -> AppUser {
        try await delay()
        let id = "client_\(UUID().uuidString.prefix(8))"
        let user = AppUser(id: id, email: email, name: name, role: .client)
        users[id] = user
        currentUserId = id
        logs[id] = []
        photos[id] = []
        messages[id] = []
        return user
    }

    func logout() {
        currentUserId = nil
    }

    // MARK: - Onboarding

    func calcularMacros(goals: Goals) async throws -> (kcal: Int, proteina: Int, carbs: Int, grasas: Int) {
        try await delay(0.2)
        // Simplified Mifflin-St Jeor, mirroring the backend's `/calcular-macros` fallback.
        let bmr = goals.gender == .masculino
            ? 10 * goals.weight + 6.25 * goals.height - 5 * Double(goals.age) + 5
            : 10 * goals.weight + 6.25 * goals.height - 5 * Double(goals.age) - 161
        let activityFactor: Double = {
            switch goals.activity {
            case .sedentario: return 1.2
            case .pocaActividad: return 1.375
            case .moderado: return 1.55
            case .activo: return 1.725
            case .atleta: return 1.9
            }
        }()
        var tdee = bmr * activityFactor
        switch goals.objective {
        case .perdidaGrasa: tdee -= 400
        case .gananciaMuscular: tdee += 300
        case .recomposicion: tdee -= 100
        case .mantenimiento: break
        }
        let kcal = Int(tdee)
        let proteina = Int(goals.weight * 2.0)
        let grasas = Int(goals.weight * 0.9)
        let carbs = max(0, (kcal - proteina * 4 - grasas * 9) / 4)
        return (kcal, proteina, carbs, grasas)
    }

    func completeOnboarding(userId: String, goals: Goals, modalidad: Modalidad, coachNotes: String?, mealTimes: MealTimes) async throws -> AppUser {
        try await delay()
        guard var user = users[userId] else { throw APIError.notFound("Usuario no encontrado") }
        user.goals = goals
        user.modalidad = modalidad
        user.coachNotes = coachNotes
        user.mealTimes = mealTimes
        user.onboardingComplete = true
        user.showPhotoStep = true
        user.planStatus = modalidad == .coach ? "pending" : "active"
        user.coachDeadline = modalidad == .coach ? Date().addingTimeInterval(3600 * 24) : nil
        users[userId] = user
        if logs[userId] == nil { logs[userId] = [] }
        if photos[userId] == nil { photos[userId] = [] }
        if messages[userId] == nil { messages[userId] = [] }
        return user
    }

    func generarPlanIA(for userId: String) async throws -> TrainingPlan {
        try await delay(1.2)
        let dayIndex = Calendar.current.component(.weekday, from: Date())
        let plan = MockData.samplePlan(startDayIndex: (dayIndex + 5) % 7, daysUnlocked: users[userId]?.premium == true ? 7 : 3)
        plans[userId] = plan
        return plan
    }

    func uploadOnboardingPhotos(userId: String) async throws {
        try await delay()
        guard var user = users[userId] else { return }
        user.showPhotoStep = false
        users[userId] = user
    }

    // MARK: - Plans

    func fetchPlan(userId: String) async throws -> TrainingPlan? {
        try await delay(0.2)
        return plans[userId]
    }

    func guardarPlan(userId: String, plan: TrainingPlan) async throws {
        try await delay()
        plans[userId] = plan
    }

    func coachGuardarPlanCliente(clienteId: String, plan: TrainingPlan) async throws {
        try await delay()
        if let existing = plans[clienteId] {
            planHistorial[clienteId, default: []].append(existing)
        }
        plans[clienteId] = plan
        if var user = users[clienteId] {
            user.planStatus = "active"
            user.coachDeadline = nil
            users[clienteId] = user
        }
    }

    func toggleProgress(userId: String, dateKey: String, itemKey: String, isExercise: Bool) async throws -> AppUser {
        guard var user = users[userId] else { throw APIError.notFound("Usuario no encontrado") }
        var progress = user.dailyProgress[dateKey] ?? DayProgress()
        if isExercise {
            if let idx = progress.ejercicios.firstIndex(of: itemKey) { progress.ejercicios.remove(at: idx) }
            else { progress.ejercicios.append(itemKey) }
        } else {
            if let idx = progress.comidas.firstIndex(of: itemKey) { progress.comidas.remove(at: idx) }
            else { progress.comidas.append(itemKey) }
        }
        user.dailyProgress[dateKey] = progress
        users[userId] = user
        return user
    }

    func registrarEsfuerzo(userId: String, ejercicioKey: String, ejercicio: String, rpe: Int, rir: Int) async throws {
        guard var user = users[userId] else { return }
        let today = DateFormatter.shortDate.string(from: Date())
        var todayMap = user.esfuerzo[today] ?? [:]
        todayMap[ejercicioKey] = EsfuerzoEntry(ejercicio: ejercicio, rpe: rpe, rir: rir, ts: Date())
        user.esfuerzo[today] = todayMap
        users[userId] = user
    }

    // MARK: - Logs

    func fetchLogs(userId: String) async throws -> [LogEntry] {
        try await delay(0.2)
        return (logs[userId] ?? []).sorted { $0.timestamp > $1.timestamp }
    }

    func addLog(_ log: LogEntry) async throws -> LogEntry {
        try await delay()
        logs[log.userId, default: []].insert(log, at: 0)
        return log
    }

    func generarAlternativa(momento: String, macros: (kcal: Int, proteina: Int, carbs: Int, grasas: Int)) async throws -> [String] {
        try await delay(0.8)
        return [
            "Tazón de pavo molido con quinoa y pico de gallo (\(macros.kcal) kcal aprox.)",
            "Tofu salteado con vegetales y arroz integral, alto en proteína",
            "Wrap integral de atún con aguacate y espinaca"
        ]
    }

    // MARK: - Photos

    func fetchPhotos(userId: String) async throws -> [PhotoEntry] {
        try await delay(0.2)
        return (photos[userId] ?? []).sorted { $0.createdAt > $1.createdAt }
    }

    func addPhoto(userId: String, category: String) async throws -> PhotoEntry {
        try await delay(0.5)
        let entry = PhotoEntry(userId: userId, url: "photo_\(UUID().uuidString.prefix(6))", category: category)
        photos[userId, default: []].append(entry)
        return entry
    }

    func analizarProgresoIA(userId: String) async throws -> String {
        try await delay(1.5)
        return "Comparando tus fotos, se nota una reducción visible de grasa abdominal y mayor definición en hombros y espalda. Sigue así: tu adherencia a la dieta está dando resultado. Para las próximas 4 semanas, sugiero mantener el déficit actual y priorizar el sueño para mejorar la recuperación."
    }

    // MARK: - Chat

    func fetchMessages(userId: String) async throws -> [AppChatMessage] {
        try await delay(0.2)
        return (messages[userId] ?? []).sorted { $0.createdAt < $1.createdAt }
    }

    func sendMessage(userId: String, text: String, fromCoach: Bool, coachName: String?) async throws -> AppChatMessage {
        try await delay(0.3)
        let msg = AppChatMessage(userId: userId, coachName: fromCoach ? coachName : nil, text: text, isFromCoach: fromCoach)
        messages[userId, default: []].append(msg)
        return msg
    }

    // MARK: - Premium

    func verificarPremium(userId: String) async throws -> Bool {
        try await delay(0.2)
        return users[userId]?.premium ?? false
    }

    func activarPremiumMock(userId: String) async throws -> AppUser {
        try await delay(0.6)
        guard var user = users[userId] else { throw APIError.notFound("Usuario no encontrado") }
        user.premium = true
        user.premiumSource = "mercadopago-implicit"
        user.premiumUntil = Calendar.current.date(byAdding: .month, value: 1, to: Date())
        users[userId] = user
        if var plan = plans[userId] {
            plan.daysUnlocked = 7
            plans[userId] = plan
        }
        return user
    }

    // MARK: - Coach

    func coachGenerarCodigo(coachId: String) async throws -> String {
        try await delay(0.3)
        guard var user = users[coachId] else { throw APIError.notFound("Coach no encontrado") }
        if let code = user.coachCode { return code }
        let code = "\(user.name.prefix(4).uppercased())\(Int.random(in: 1000...9999))"
        user.coachCode = code
        users[coachId] = user
        return code
    }

    func coachClientes(coachId: String) async throws -> [CoachClientSummary] {
        try await delay(0.4)
        return MockData.sampleClients(coachId: coachId)
    }

    func coachClienteMetricas(clienteId: String) async throws -> CoachClientMetrics {
        try await delay(0.3)
        let seed = abs(clienteId.hashValue) % 10
        return MockData.sampleClientMetrics(seed: seed)
    }

    func coachDashboardMetricas(coachId: String) async throws -> CoachDashboardMetrics {
        try await delay(0.3)
        return MockData.sampleCoachDashboardMetrics()
    }

    func coachHistorialPlanes(clienteId: String) async throws -> [TrainingPlan] {
        try await delay(0.3)
        return planHistorial[clienteId] ?? [MockData.samplePlan()]
    }

    func updateCoachNotes(clienteId: String, notes: String) async throws {
        try await delay(0.2)
    }

    func requestClientPhotos(clienteId: String, category: String) async throws {
        try await delay(0.2)
    }

    func setMeetLink(clienteId: String, link: String) async throws {
        try await delay(0.2)
    }

    // MARK: - Admin

    func adminMetrics() async throws -> AdminMetrics {
        try await delay(0.4)
        return MockData.sampleAdminMetrics()
    }

    func adminCoaches() async throws -> [CoachSummary] {
        try await delay(0.3)
        return coaches
    }

    func adminSolicitudesCoach() async throws -> [CoachRequest] {
        try await delay(0.3)
        return coachRequests
    }

    func adminAprobarCoach(requestId: String) async throws {
        try await delay(0.4)
        if let idx = coachRequests.firstIndex(where: { $0.id == requestId }) {
            coachRequests[idx].status = .approved
        }
    }

    func adminRechazarCoach(requestId: String, motivo: String) async throws {
        try await delay(0.4)
        if let idx = coachRequests.firstIndex(where: { $0.id == requestId }) {
            coachRequests[idx].status = .rejected
        }
    }

    func adminDarAltaCoach(email: String, nombre: String) async throws {
        try await delay(0.4)
        coaches.append(CoachSummary(id: "coach_\(UUID().uuidString.prefix(6))", name: nombre, email: email, coachCode: "\(nombre.prefix(4).uppercased())\(Int.random(in: 100...999))", premium: true, clientCount: 0, createdAt: Date()))
    }

    func adminRevocarCoach(uid: String) async throws {
        try await delay(0.4)
        coaches.removeAll { $0.id == uid }
    }

    func adminActivarPremiumManual(email: String, motivo: String) async throws {
        try await delay(0.4)
        if let idx = users.values.first(where: { $0.email == email })?.id {
            users[idx]?.premium = true
            users[idx]?.premiumSource = "manual-admin"
        }
    }

    // MARK: - Public

    func solicitudCoach(nombre: String, email: String, telefono: String, especialidad: String, experiencia: String) async throws {
        try await delay(0.5)
        coachRequests.append(CoachRequest(id: UUID().uuidString, nombre: nombre, email: email, telefono: telefono, especialidad: especialidad, experiencia: experiencia, status: .pending, createdAt: Date()))
    }
}

enum APIError: LocalizedError {
    case notFound(String)
    case network(String)

    var errorDescription: String? {
        switch self {
        case .notFound(let msg): return msg
        case .network(let msg): return msg
        }
    }
}
