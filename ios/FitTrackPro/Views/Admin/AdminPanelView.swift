import SwiftUI

/// Matches `components/admin/AdminPanel.jsx` — root tab container for the admin role.
struct AdminPanelView: View {
    @EnvironmentObject var appState: AppState
    @State private var metrics: AdminMetrics?
    @State private var isLoading = true
    @State private var manualEmail = ""
    @State private var manualMotivo = ""
    @State private var manualMessage: String?

    private var dark: Bool { appState.currentUser?.darkMode ?? false }

    var body: some View {
        TabView {
            NavigationStack { metricsTab.navigationTitle("Métricas") }
                .tabItem { Label("Métricas", systemImage: "chart.bar.fill") }

            NavigationStack { CoachesAdminView().navigationTitle("Coaches") }
                .tabItem { Label("Coaches", systemImage: "person.2.badge.gearshape.fill") }

            NavigationStack { firewallTab.navigationTitle("Ajustes") }
                .tabItem { Label("Ajustes", systemImage: "gearshape.fill") }
        }
    }

    private var metricsTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if isLoading {
                    SkeletonCardView(dark: dark)
                } else if let metrics {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        statCard("Usuarios totales", "\(metrics.totalUsers)")
                        statCard("Premium", "\(metrics.premiumUsers)")
                        statCard("Gratis", "\(metrics.freeUsers)")
                        statCard("Nuevos hoy", "\(metrics.newToday)")
                        statCard("Con plan activo", "\(metrics.activePlanUsers)")
                        statCard("Sin plan", "\(metrics.noPlanUsers)")
                        statCard("Coaches", "\(metrics.totalCoaches)")
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Registros (14 días)").font(.system(size: 13, weight: .black))
                        barRow(metrics.signupsSeries)
                    }
                    .padding(12).cardStyle(dark: dark)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Conversiones a Premium (14 días)").font(.system(size: 13, weight: .black))
                        barRow(metrics.premiumConversionsSeries)
                    }
                    .padding(12).cardStyle(dark: dark)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Distribución por objetivo").font(.system(size: 13, weight: .black))
                        ForEach(metrics.objectiveDistribution.sorted(by: { $0.value > $1.value }), id: \.key) { key, value in
                            HStack {
                                Text(key).font(.system(size: 12, weight: .semibold))
                                Spacer()
                                Text("\(value)").font(.system(size: 12, weight: .black))
                            }
                        }
                    }
                    .padding(12).cardStyle(dark: dark)
                }
            }
            .padding(16)
        }
        .themedBackground(dark: dark)
        .task { await loadMetrics() }
    }

    private func barRow(_ points: [DailyPoint]) -> some View {
        let maxVal = max(points.map(\.value).max() ?? 1, 1)
        return HStack(alignment: .bottom, spacing: 3) {
            ForEach(points) { p in
                RoundedRectangle(cornerRadius: 3)
                    .fill(AppTheme.accent(dark: dark))
                    .frame(height: max(4, CGFloat(p.value) / CGFloat(maxVal) * 60))
                    .frame(maxWidth: .infinity)
            }
        }
        .frame(height: 60)
    }

    private func statCard(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.system(size: 20, weight: .black))
            Text(label).font(.system(size: 11, weight: .semibold)).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .cardStyle(dark: dark)
    }

    private var firewallTab: some View {
        Form {
            Section("Activar Premium manualmente (cortafuego)") {
                TextField("Correo del usuario", text: $manualEmail).keyboardType(.emailAddress)
                TextField("Motivo", text: $manualMotivo)
                Button("Activar Premium") {
                    Task {
                        try? await appState.api.adminActivarPremiumManual(email: manualEmail, motivo: manualMotivo)
                        manualMessage = "Premium activado para \(manualEmail)."
                    }
                }
                .disabled(manualEmail.isEmpty)
                if let manualMessage { Text(manualMessage).font(.system(size: 12, weight: .semibold)).foregroundStyle(.green) }
            }
            Section {
                Button("Cerrar sesión", role: .destructive) { appState.logout() }
            }
        }
    }

    private func loadMetrics() async {
        isLoading = true
        metrics = try? await appState.api.adminMetrics()
        isLoading = false
    }
}
