import Foundation

struct AchievementStats: Equatable {
    var streakDays: Int
    var totalLogs: Int
    var maxSquat: Double

    var xp: Int { streakDays * 150 + totalLogs * 50 }

    var rank: String {
        switch xp {
        case 0: return "Principiante"
        case 1..<500: return "Novato"
        case 500..<1500: return "Atleta de Bronce"
        case 1500..<3000: return "Atleta de Plata"
        case 3000..<6000: return "Atleta de Oro"
        default: return "Élite"
        }
    }

    var nextRankThreshold: Int {
        switch xp {
        case 0..<500: return 500
        case 500..<1500: return 1500
        case 1500..<3000: return 3000
        case 3000..<6000: return 6000
        default: return xp
        }
    }

    var progressToNextRank: Double {
        guard nextRankThreshold > 0 else { return 1 }
        return min(1, Double(xp) / Double(nextRankThreshold))
    }

    var adherencia: Int {
        streakDays == 0 ? 0 : min(100, Int(Double(totalLogs) / Double(streakDays) * 100))
    }
}
