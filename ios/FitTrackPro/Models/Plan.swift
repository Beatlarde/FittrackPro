import Foundation

struct Calentamiento: Codable, Identifiable, Equatable {
    var id = UUID()
    var nombre: String
    var duracion: String
    enum CodingKeys: String, CodingKey { case nombre, duracion }
}

struct PlanEjercicio: Codable, Identifiable, Equatable {
    var id = UUID()
    var nombre: String
    var series: Int
    var reps: String
    var nota: String?
    enum CodingKeys: String, CodingKey { case nombre, series, reps, nota }
}

struct Entrenamiento: Codable, Equatable {
    var tipo: String? = nil
    var calentamiento: [Calentamiento] = []
    var ejercicios: [PlanEjercicio] = []
}

struct Comida: Codable, Identifiable, Equatable {
    var id = UUID()
    var momento: String
    var descripcion: String
    enum CodingKeys: String, CodingKey { case momento, descripcion }
}

struct DietaDia: Codable, Equatable {
    var kcal: Int
    var proteina: Int
    var carbs: Int
    var grasas: Int
    var comidas: [Comida] = []
}

struct PlanDay: Codable, Identifiable, Equatable {
    var id: String { dia }
    var dia: String
    var entrenamiento: Entrenamiento
    var dieta: DietaDia
}

struct TrainingPlan: Codable, Equatable {
    var plan: [PlanDay]
    var daysUnlocked: Int
    var startDayIndex: Int
    var updatedAt: Date = Date()
}

extension TrainingPlan {
    static let diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
}
