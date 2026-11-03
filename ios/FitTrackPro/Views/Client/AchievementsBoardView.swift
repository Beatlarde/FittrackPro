import SwiftUI

/// Matches `components/client/AchievementsBoard.jsx` — XP/rank computed client-side from logs.
struct AchievementsBoardView: View {
    @EnvironmentObject var appState: AppState
    var compact: Bool = false
    @State private var stats: AchievementStats = AchievementStats(streakDays: 0, totalLogs: 0, maxSquat: 0)

    private var dark: Bool { appState.currentUser?.darkMode ?? false }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(stats.rank).font(.system(size: 16, weight: .black))
                    Text("\(stats.xp) XP").font(.system(size: 12, weight: .semibold)).foregroundStyle(.secondary)
                }
                Spacer()
                if !compact {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("\(stats.adherencia)% adherencia").font(.system(size: 12, weight: .black))
                        if stats.maxSquat > 0 {
                            Text("Sentadilla est. \(Int(stats.maxSquat)) kg").font(.system(size: 11)).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            ProgressView(value: stats.progressToNextRank)
                .tint(AppTheme.accent(dark: dark))
        }
        .padding(14)
        .cardStyle(dark: dark)
        .task { await loadStats() }
    }

    private func loadStats() async {
        guard let userId = appState.currentUser?.id else { return }
        let logs = (try? await appState.api.fetchLogs(userId: userId)) ?? []
        let streak = min(30, logs.count)
        let maxSquat = logs.compactMap { $0.aiMetadata?.projected1RM }.max() ?? 0
        stats = AchievementStats(streakDays: max(1, streak), totalLogs: logs.count, maxSquat: maxSquat)
    }
}
