import Foundation

enum UserRole: String, Codable, Equatable, Hashable {
    case client
    case coach
}

enum Modalidad: String, Codable, Equatable, Hashable {
    case ia
    case coach
}

enum Objective: String, Codable, CaseIterable, Equatable, Hashable, Identifiable {
    case perdidaGrasa = "Pérdida de Grasa"
    case gananciaMuscular = "Ganancia Muscular"
    case recomposicion = "Recomposición"
    case mantenimiento = "Mantenimiento"
    var id: String { rawValue }
}

enum ActivityLevelOption: String, Codable, CaseIterable, Equatable, Hashable, Identifiable {
    case sedentario = "Sedentario"
    case pocaActividad = "Poca actividad"
    case moderado = "Moderado"
    case activo = "Activo"
    case atleta = "Atleta"
    var id: String { rawValue }
}

enum StressLevel: String, Codable, CaseIterable, Equatable, Hashable, Identifiable {
    case bajo = "Bajo"
    case medio = "Medio"
    case alto = "Alto"
    var id: String { rawValue }
}

enum Equipment: String, Codable, CaseIterable, Equatable, Hashable, Identifiable {
    case gymCompleto = "Gym Completo"
    case casaConPesas = "En casa (con pesas)"
    case casaSinEquipo = "En casa (sin equipo)"
    var id: String { rawValue }
}

enum BodyType: String, Codable, CaseIterable, Equatable, Hashable, Identifiable {
    case ectomorfo = "Ectomorfo"
    case mesomorfo = "Mesomorfo"
    case endomorfo = "Endomorfo"
    var id: String { rawValue }
}

enum Gender: String, Codable, CaseIterable, Equatable, Hashable, Identifiable {
    case masculino
    case femenino
    var id: String { rawValue }
}

struct Goals: Codable, Equatable {
    var name: String = ""
    var age: Int = 25
    var objective: Objective = .recomposicion
    var targetKcal: Int = 2000
    var weight: Double = 70
    var height: Double = 170
    var activity: ActivityLevelOption = .moderado
    var activityLevel: Int = 50
    var injuries: String = ""
    var stressLevel: StressLevel = .medio
    var equipment: Equipment = .gymCompleto
    var bodyType: BodyType = .mesomorfo
    var gender: Gender = .masculino
    var proteina: Int = 150
    var carbs: Int = 200
    var grasas: Int = 60
}

struct MealTimes: Codable, Equatable {
    var desayuno: String = "08:00"
    var comida: String = "14:00"
    var cena: String = "20:00"
}

struct DayProgress: Codable, Equatable {
    var ejercicios: [String] = []
    var comidas: [String] = []
}

struct DayReview: Codable, Equatable {
    var rating: Int
    var label: String
    var ts: Date
}

struct EsfuerzoEntry: Codable, Equatable {
    var ejercicio: String
    var rpe: Int
    var rir: Int
    var ts: Date
}

struct TecnicaVideo: Codable, Equatable, Identifiable {
    var id: String { url }
    var url: String
    var ts: Date
    var viewed: Bool
}

struct ListaSuperCategoria: Codable, Equatable, Identifiable {
    var id: String { nombre }
    var nombre: String
    var items: [String]
}

struct ListaSuper: Codable, Equatable {
    var categorias: [ListaSuperCategoria] = []
}

struct AppUser: Codable, Identifiable, Equatable {
    var id: String
    var email: String
    var name: String
    var role: UserRole
    var admin: Bool = false
    var onboardingComplete: Bool = false
    var showPhotoStep: Bool = false
    var modalidad: Modalidad = .ia
    var premium: Bool = false
    var premiumSource: String? = nil
    var premiumUntil: Date? = nil
    var planStatus: String = "pending"
    var darkMode: Bool = false
    var goals: Goals? = nil
    var coachNotes: String? = nil
    var mealTimes: MealTimes = MealTimes()
    var coachDeadline: Date? = nil
    var refCoachId: String? = nil
    var refCoachCode: String? = nil
    var coachCode: String? = nil
    var photoRequest: String? = nil
    var meetLink: String? = nil
    var tecnicaVideos: [TecnicaVideo] = []
    var listaSuper: ListaSuper? = nil
    var dailyProgress: [String: DayProgress] = [:]
    var dayReviews: [String: DayReview] = [:]
    var esfuerzo: [String: [String: EsfuerzoEntry]] = [:]
    var lastOpenTimestamp: Date? = nil
    var welcomeMsgSent: Bool = false
    var isDemo: Bool = false
    var createdAt: Date = Date()
}
