import Foundation

struct CoachClientSummary: Codable, Identifiable, Equatable {
    var id: String
    var name: String
    var email: String
    var goals: Goals?
    var planStatus: String
    var coachDeadline: Date?
    var modalidad: Modalidad
    var premium: Bool
    var lastOpenTimestamp: Date?
    var coachNotes: String?
    var photoRequest: String?
    var meetLink: String?
    var createdAt: Date
}

struct CoachClientMetrics: Codable, Equatable {
    var racha: Int
    var adherenciaSemana: Int
    var ultimoAcceso: Date?
    var ejerciciosCompletadosHoy: Int
    var totalEjerciciosHoy: Int
    var comidasRegistradasHoy: Int
    var totalComidasHoy: Int
    var kcalRegistradas: Int
    var kcalMeta: Int
    var actividadSemana: [Int]
    var pesos: [Double]
    var totalLogs: Int
}

struct CoachDashboardMetrics: Codable, Equatable {
    var totalClientes: Int
    var activos: Int
    var pendientes: Int
    var entrenaronHoy: Int
    var registraronComidaHoy: Int
    var sinActividad: Int
    var adherenciaPromedio: Int
}
