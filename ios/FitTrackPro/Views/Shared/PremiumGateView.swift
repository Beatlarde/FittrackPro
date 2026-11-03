import SwiftUI

/// Matches `components/shared/PremiumGate.jsx` — blocks a feature behind a lock + CTA.
struct PremiumGateView<Content: View>: View {
    var isPremium: Bool
    var dark: Bool
    var message: String
    var onUpgrade: () -> Void
    var content: () -> Content

    init(isPremium: Bool, dark: Bool, message: String = "Esta función es exclusiva para miembros Premium.", onUpgrade: @escaping () -> Void, @ViewBuilder content: @escaping () -> Content) {
        self.isPremium = isPremium
        self.dark = dark
        self.message = message
        self.onUpgrade = onUpgrade
        self.content = content
    }

    var body: some View {
        if isPremium {
            content()
        } else {
            VStack(spacing: 12) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(AppTheme.premiumAmber)
                Text(message)
                    .font(.system(size: 14, weight: .semibold))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(AppTheme.textMuted(dark: dark))
                Button(action: onUpgrade) {
                    Text("Desbloquear Premium")
                        .font(.system(size: 14, weight: .black))
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(
                            LinearGradient(colors: [AppTheme.premiumAmber, AppTheme.premiumOrange], startPoint: .leading, endPoint: .trailing)
                        )
                        .foregroundStyle(.white)
                        .clipShape(Capsule())
                }
            }
            .frame(maxWidth: .infinity)
            .padding(24)
            .cardStyle(dark: dark)
        }
    }
}
