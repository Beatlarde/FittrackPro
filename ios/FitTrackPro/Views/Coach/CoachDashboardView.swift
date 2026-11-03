import SwiftUI

/// Matches `components/coach/CoachDashboard.jsx` — root tab container for the coach role.
struct CoachDashboardView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        TabView {
            NavigationStack { CoachClientListView().navigationTitle("Clientes") }
                .tabItem { Label("Clientes", systemImage: "person.2.fill") }

            NavigationStack { HistorialPlanesView().navigationTitle("Historial") }
                .tabItem { Label("Historial", systemImage: "clock.arrow.circlepath") }

            NavigationStack { ReferidoWidgetView().navigationTitle("Referidos") }
                .tabItem { Label("Referidos", systemImage: "person.badge.plus") }

            NavigationStack { coachProfile.navigationTitle("Perfil") }
                .tabItem { Label("Perfil", systemImage: "person.fill") }
        }
    }

    private var coachProfile: some View {
        Form {
            if let user = appState.currentUser {
                Section("Cuenta") {
                    LabeledContent("Nombre", value: user.name)
                    LabeledContent("Correo", value: user.email)
                    if user.isDemo {
                        Label("Modo demo activo", systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(AppTheme.premiumAmber)
                    }
                }
            }
            Section {
                Button("Cerrar sesión", role: .destructive) { appState.logout() }
            }
        }
    }
}

/// Matches `components/coach/CoachDashboard.jsx`'s client list + `components/admin/CoachClientCount.jsx` style summary.
struct CoachClientListView: View {
    @EnvironmentObject var appState: AppState
    @State private var clients: [CoachClientSummary] = []
    @State private var metrics: CoachDashboardMetrics?
    @State private var isLoading = true

    private var dark: Bool { appState.currentUser?.darkMode ?? false }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if appState.currentUser?.isDemo == true {
                    Label("MODO DEMO — datos de ejemplo, no reales", systemImage: "sparkles")
                        .font(.system(size: 11, weight: .black))
                        .padding(10)
                        .frame(maxWidth: .infinity)
                        .background(AppTheme.premiumAmber.opacity(0.2))
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }

                if let metrics {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        statCard("Clientes", "\(metrics.totalClientes)")
                        statCard("Activos", "\(metrics.activos)")
                        statCard("Entrenaron hoy", "\(metrics.entrenaronHoy)")
                        statCard("Adherencia prom.", "\(metrics.adherenciaPromedio)%")
                    }
                }

                Text("Tus clientes").font(.system(size: 17, weight: .black))

                if isLoading {
                    SkeletonCardView(dark: dark)
                    SkeletonCardView(dark: dark)
                } else {
                    ForEach(clients) { client in
                        NavigationLink(destination: CoachClientDetailView(client: client)) {
                            clientRow(client)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(16)
        }
        .themedBackground(dark: dark)
        .task { await load() }
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

    private func clientRow(_ client: CoachClientSummary) -> some View {
        HStack(spacing: 12) {
            Circle().fill(AppTheme.accent(dark: dark).opacity(0.15))
                .frame(width: 40, height: 40)
                .overlay(Text(String(client.name.prefix(1))).font(.system(size: 15, weight: .black)).foregroundStyle(AppTheme.accent(dark: dark)))
            VStack(alignment: .leading, spacing: 2) {
                Text(client.name).font(.system(size: 14, weight: .black))
                Text(client.goals?.objective.rawValue ?? "").font(.system(size: 11)).foregroundStyle(.secondary)
            }
            Spacer()
            if client.planStatus == "pending", let deadline = client.coachDeadline {
                CountdownTimerView(deadline: deadline)
            } else {
                Text(client.premium ? "Premium" : "Gratis")
                    .font(.system(size: 10, weight: .black))
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(client.premium ? AppTheme.premiumAmber.opacity(0.2) : AppTheme.bgSurface2(dark: dark))
                    .clipShape(Capsule())
            }
        }
        .padding(12)
        .cardStyle(dark: dark)
    }

    private func load() async {
        guard let coachId = appState.currentUser?.id else { return }
        isLoading = true
        async let c = appState.api.coachClientes(coachId: coachId)
        async let m = appState.api.coachDashboardMetricas(coachId: coachId)
        clients = (try? await c) ?? []
        metrics = try? await m
        isLoading = false
    }
}
