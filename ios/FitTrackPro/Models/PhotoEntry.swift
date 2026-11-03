import Foundation

struct PhotoEntry: Codable, Identifiable, Equatable {
    var id: String = UUID().uuidString
    var userId: String
    var url: String
    var category: String
    var createdAt: Date = Date()
}
