import Foundation

struct AppChatMessage: Codable, Identifiable, Equatable {
    var id: String = UUID().uuidString
    var userId: String
    var coachName: String? = nil
    var from: String? = nil
    var fromName: String? = nil
    var text: String
    var createdAt: Date = Date()
    var read: Bool = false
    var isFromCoach: Bool
}
