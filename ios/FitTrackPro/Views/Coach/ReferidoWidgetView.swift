import SwiftUI

/// Matches `components/coach/ReferidoWidget.jsx` — coach referral code + shareable link.
struct ReferidoWidgetView: View {
    @EnvironmentObject var appState: AppState
    @State private var code: String = ""
    @State private var isLoading = true

    private var dark: Bool { appState.currentUser?.darkMode ?? false }
    private var shareURL: String { "https://fittrackpro.store?ref=\(code)" }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Tu código de referido").font(.system(size: 15, weight: .black))
                    if isLoading {
                        ProgressView()
                    } else {
                        Text(code)
                            .font(.system(size: 28, weight: .black, design: .monospaced))
                            .foregroundStyle(AppTheme.accent(dark: dark))
                        Text(shareURL)
                            .font(.system(size: 12))
                            .foregroundStyle(.secondary)
                        ShareLink(item: shareURL) {
                            Label("Compartir link", systemImage: "square.and.arrow.up")
                                .font(.system(size: 13, weight: .black))
                                .frame(maxWidth: .infinity).padding(.vertical, 12)
                                .background(AppTheme.accent(dark: dark)).foregroundStyle(.white)
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                    }
                }
                .padding(16)
                .cardStyle(dark: dark)

                Text("Cada persona que se registre con tu link queda vinculada a ti automáticamente como su coach.")
                    .font(.system(size: 12)).foregroundStyle(.secondary)
            }
            .padding(16)
        }
        .themedBackground(dark: dark)
        .task { await loadCode() }
    }

    private func loadCode() async {
        guard let coachId = appState.currentUser?.id else { return }
        isLoading = true
        code = (try? await appState.api.coachGenerarCodigo(coachId: coachId)) ?? ""
        isLoading = false
    }
}
