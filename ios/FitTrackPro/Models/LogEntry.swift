import Foundation

enum LogType: String, Codable, Equatable {
    case meal
    case workout
    case weight
}

struct AIMetadata: Codable, Equatable {
    var kcal: Double? = nil
    var protein: Double? = nil
    var carbs: Double? = nil
    var fats: Double? = nil
    var name: String? = nil
    var volume: Double? = nil
    var projected1RM: Double? = nil
}

struct LogEntry: Codable, Identifiable, Equatable {
    var id: String = UUID().uuidString
    var userId: String
    var userName: String
    var type: LogType
    var content: String
    var aiMetadata: AIMetadata? = nil
    var timestamp: Date = Date()
    var esGustito: Bool = false
    var esAlternativa: Bool = false
    var momento: String? = nil
}
