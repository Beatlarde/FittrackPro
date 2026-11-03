import SwiftUI

/// Matches `components/client/PlanesScreen.jsx` — Free vs Premium comparison + checkout CTAs.
/// Real checkout needs the live backend (MercadoPago subscription URL / Hotmart pay-link); here
/// "Activar Premium" flips the mock flag so the rest of the app can be exercised end-to-end.
struct PlanesScreenView: View {
    @EnvironmentObject var appState: AppState
    @State private var isActivating = false

    private var dark: Bool { appState.currentUser?.darkMode ?? false }
    private var isPremium: Bool { appState.currentUser?.premium ?? false }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                VStack(spacing: 6) {
                    Text(isPremium ? "Ya eres Premium 🎉" : "$99 MXN / mes")
                        .font(.system(size: 26, weight: .black))
                    Text(isPremium ? "Disfruta acceso completo a tu plan y a la IA." : "Cancela cuando quieras.")
                        .font(.system(size: 13)).foregroundStyle(.secondary)
                }
                .padding(.top, 12)

                HStack(alignment: .top, spacing: 12) {
                    planCard(title: "Gratis", features: ["3 días de plan visibles", "1 cambio de comida/semana", "Registro básico de progreso"], highlighted: false)
                    planCard(title: "Premium", features: ["Los 7 días desbloqueados", "Cambios de comida ilimitados", "Análisis de fotos con IA", "Chat directo con tu coach"], highlighted: true)
                }

                if !isPremium {
                    VStack(spacing: 10) {
                        Button {
                            Task { await activate() }
                        } label: {
                            HStack {
                                if isActivating { ProgressView().tint(.white) }
                                Text("Suscribirme con MercadoPago").font(.system(size: 14, weight: .black))
                            }
                            .frame(maxWidth: .infinity).padding(.vertical, 14)
                            .background(AppTheme.infoBlue).foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }
                        Button {
                            Task { await activate() }
                        } label: {
                            Text("Comprar en Hotmart").font(.system(size: 14, weight: .black))
                                .frame(maxWidth: .infinity).padding(.vertical, 14)
                                .background(AppTheme.premiumOrange).foregroundStyle(.white)
                                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }
                        Text("Modo mock: estos botones activan Premium localmente para que puedas probar el resto de la app.")
                            .font(.system(size: 10)).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    }
                }
            }
            .padding(16)
        }
        .themedBackground(dark: dark)
    }

    private func planCard(title: String, features: [String], highlighted: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.system(size: 16, weight: .black))
                .foregroundStyle(highlighted ? AppTheme.premiumOrange : AppTheme.textPrimary(dark: dark))
            ForEach(features, id: \.self) { f in
                Label(f, systemImage: "checkmark").font(.system(size: 11, weight: .semibold))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(highlighted ? AppTheme.premiumAmber.opacity(0.12) : AppTheme.bgSurface2(dark: dark))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(highlighted ? AppTheme.premiumOrange : AppTheme.borderColor(dark: dark), lineWidth: highlighted ? 2 : 1))
    }

    private func activate() async {
        guard let userId = appState.currentUser?.id else { return }
        isActivating = true
        if let updated = try? await appState.api.activarPremiumMock(userId: userId) {
            appState.setCurrentUser(updated)
        }
        isActivating = false
    }
}
