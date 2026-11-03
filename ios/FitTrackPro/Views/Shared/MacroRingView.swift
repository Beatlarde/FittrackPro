import SwiftUI

/// Matches `components/shared/MacroCircle.jsx` — kcal ring with protein/carbs/fat legend.
struct MacroRingView: View {
    var kcalConsumed: Int
    var kcalGoal: Int
    var proteina: Int
    var carbs: Int
    var grasas: Int
    var dark: Bool

    private var progress: Double {
        kcalGoal == 0 ? 0 : Double(kcalConsumed) / Double(kcalGoal)
    }

    var body: some View {
        HStack(spacing: 20) {
            ZStack {
                RingView(progress: progress, color: AppTheme.kcalOrange, lineWidth: 12)
                    .frame(width: 96, height: 96)
                VStack(spacing: 0) {
                    Text("\(kcalConsumed)")
                        .font(.system(size: 20, weight: .black))
                    Text("/ \(kcalGoal) kcal")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(AppTheme.textMuted(dark: dark))
                }
            }
            VStack(alignment: .leading, spacing: 8) {
                macroRow(color: AppTheme.proteinBlue, label: "Proteína", value: proteina)
                macroRow(color: AppTheme.carbsYellow, label: "Carbos", value: carbs)
                macroRow(color: AppTheme.fatPink, label: "Grasas", value: grasas)
            }
            Spacer()
        }
    }

    private func macroRow(color: Color, label: String, value: Int) -> some View {
        HStack(spacing: 8) {
            Circle().fill(color).frame(width: 10, height: 10)
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(AppTheme.textMuted(dark: dark))
            Text("\(value)g")
                .font(.system(size: 13, weight: .black))
                .foregroundStyle(AppTheme.textPrimary(dark: dark))
        }
    }
}
