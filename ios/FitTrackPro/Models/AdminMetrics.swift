import Foundation

struct DailyPoint: Codable, Equatable, Identifiable {
    var id: String { date }
    var date: String
    var value: Int
}

struct AdminMetrics: Codable, Equatable {
    var totalUsers: Int
    var premiumUsers: Int
    var freeUsers: Int
    var activePlanUsers: Int
    var noPlanUsers: Int
    var totalCoaches: Int
    var newToday: Int
    var signupsSeries: [DailyPoint]
    var premiumConversionsSeries: [DailyPoint]
    var objectiveDistribution: [String: Int]
}
