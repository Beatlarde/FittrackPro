import Foundation

struct CoachSummary: Codable, Identifiable, Equatable {
    var id: String
    var name: String
    var email: String
    var coachCode: String
    var premium: Bool
    var clientCount: Int = 0
    var createdAt: Date
}

struct CoachRequest: Codable, Identifiable, Equatable {
    enum Status: String, Codable, Equatable { case pending, approved, rejected }
    var id: String
    var nombre: String
    var email: String
    var telefono: String
    var especialidad: String
    var experiencia: String
    var status: Status
    var createdAt: Date
}
