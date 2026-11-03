import SwiftUI

/// Matches `components/coach/HistorialPlanes.jsx` — archived plan versions per client
/// (backend archives to `planHistorial/{clienteId_timestamp}` on every save).
struct HistorialPlanesView: View {
    @EnvironmentObject var appState: AppState
    @State private var clients: [CoachClientSummary] = []
    @State private var selectedClient: CoachClientSummary?
    @State private var historial: [TrainingPlan] = []
    @State private var isLoading = true

    private var dark: Bool { appState.currentUser?.darkMode ?? false }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if !clients.isEmpty {
                    Picker("Cliente", selection: $selectedClient) {
                        ForEach(clients) { c in Text(c.name).tag(Optional(c)) }
                    }
                    .pickerStyle(.menu)
                }

                if isLoading {
                    SkeletonCardView(dark: dark)
                } else if historial.isEmpty {
                    Text("Sin planes archivados para este cliente todavía.")
                        .font(.system(size: 13)).foregroundStyle(.secondary)
                } else {
                    ForEach(Array(historial.enumerated()), id: \.offset) { idx, plan in
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Versión \(idx + 1)").font(.system(size: 13, weight: .black))
                            Text("\(plan.plan.count) días · \(plan.daysUnlocked) desbloqueados")
                                .font(.system(size: 11)).foregroundStyle(.secondary)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .cardStyle(dark: dark)
                    }
                }
            }
            .padding(16)
        }
        .themedBackground(dark: dark)
        .task { await loadClients() }
        .onChange(of: selectedClient) { _, newValue in
            Task { await loadHistorial(newValue) }
        }
    }

    private func loadClients() async {
        guard let coachId = appState.currentUser?.id else { return }
        clients = (try? await appState.api.coachClientes(coachId: coachId)) ?? []
        selectedClient = clients.first
        await loadHistorial(selectedClient)
    }

    private func loadHistorial(_ client: CoachClientSummary?) async {
        guard let client else { return }
        isLoading = true
        historial = (try? await appState.api.coachHistorialPlanes(clienteId: client.id)) ?? []
        isLoading = false
    }
}

extension CoachClientSummary: Hashable {
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
