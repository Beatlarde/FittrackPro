import SwiftUI

/// Matches `components/shared/DailyHUD.jsx` — today's exercise/meal completion summary.
struct DailyHUDView: View {
    var dark: Bool
    var ejerciciosDone: Int
    var ejerciciosTotal: Int
    var comidasDone: Int
    var comidasTotal: Int
    var streakDays: Int

    private var totalProgress: Double {
        let total = ejerciciosTotal + comidasTotal
        guard total > 0 else { return 0 }
        return Double(ejerciciosDone + comidasDone) / Double(total)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Hoy")
                    .font(.system(size: 22, weight: .black))
                    .foregroundStyle(AppTheme.textPrimary(dark: dark))
                Spacer()
                HStack(spacing: 4) {
                    Image(systemName: "flame.fill").foregroundStyle(AppTheme.premiumOrange)
                    Text("\(streakDays) días")
                        .font(.system(size: 13, weight: .black))
                        .foregroundStyle(AppTheme.textPrimary(dark: dark))
                }
            }
            HStack(spacing: 16) {
                RingView(progress: totalProgress, color: AppTheme.accent(dark: dark), lineWidth: 10, label: "\(Int(totalProgress * 100))%")
                    .frame(width: 64, height: 64)
                VStack(alignment: .leading, spacing: 6) {
                    Label("\(ejerciciosDone)/\(ejerciciosTotal) ejercicios", systemImage: "figure.strengthtraining.traditional")
                        .font(.system(size: 13, weight: .semibold))
                    Label("\(comidasDone)/\(comidasTotal) comidas", systemImage: "fork.knife")
                        .font(.system(size: 13, weight: .semibold))
                }
                .foregroundStyle(AppTheme.textMuted(dark: dark))
                Spacer()
            }
        }
        .cardStyle(dark: dark)
    }
}
