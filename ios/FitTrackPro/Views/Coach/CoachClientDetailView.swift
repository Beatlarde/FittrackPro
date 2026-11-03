import SwiftUI

/// Matches the per-client detail view driven by `GET /coach/cliente-metricas/:clienteId` —
/// racha, adherencia, actividad semanal, pesos, notas, y acciones rápidas (plan/foto/meet).
struct CoachClientDetailView: View {
    @EnvironmentObject var appState: AppState
    var client: CoachClientSummary
    @State private var metrics: CoachClientMetrics?
    @State private var notes: String = ""
    @State private var meetLink: String = ""
    @State private var isSavingPlan = false
    @State private var planSavedMessage: String?
    @State private var showMessages = false

    private var dark: Bool { appState.currentUser?.darkMode ?? false }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(client.name).font(.system(size: 20, weight: .black))
                        Text(client.email).font(.system(size: 12)).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button { showMessages = true } label: {
                        Image(systemName: "message.fill")
                    }
                    if client.planStatus == "pending", let deadline = client.coachDeadline {
                        CountdownTimerView(deadline: deadline)
                    }
                }

                if let metrics {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        metricCard("Racha", "\(metrics.racha)d")
                        metricCard("Adherencia", "\(metrics.adherenciaSemana)%")
                        metricCard("Logs totales", "\(metrics.totalLogs)")
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Actividad semanal").font(.system(size: 13, weight: .black))
                        HStack(spacing: 6) {
                            ForEach(Array(metrics.actividadSemana.enumerated()), id: \.offset) { _, val in
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(val > 0 ? AppTheme.accent(dark: dark) : AppTheme.bgSurface2(dark: dark))
                                    .frame(height: val > 0 ? 36 : 16)
                                    .frame(maxWidth: .infinity)
                            }
                        }
                    }
                    .padding(12)
                    .cardStyle(dark: dark)

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Hoy").font(.system(size: 13, weight: .black))
                        Text("\(metrics.ejerciciosCompletadosHoy)/\(metrics.totalEjerciciosHoy) ejercicios · \(metrics.comidasRegistradasHoy)/\(metrics.totalComidasHoy) comidas")
                            .font(.system(size: 12)).foregroundStyle(.secondary)
                        Text("\(metrics.kcalRegistradas)/\(metrics.kcalMeta) kcal")
                            .font(.system(size: 12)).foregroundStyle(.secondary)
                    }
                    .padding(12)
                    .cardStyle(dark: dark)
                } else {
                    SkeletonCardView(dark: dark)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Notas del coach").font(.system(size: 13, weight: .black))
                    TextField("Notas privadas sobre este cliente…", text: $notes, axis: .vertical)
                        .textFieldStyle(.roundedBorder).lineLimit(3...6)
                    Button("Guardar notas") {
                        Task { try? await appState.api.updateCoachNotes(clienteId: client.id, notes: notes) }
                    }
                    .font(.system(size: 12, weight: .black))
                }
                .padding(12)
                .cardStyle(dark: dark)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Plan de entrenamiento").font(.system(size: 13, weight: .black))
                    if let msg = planSavedMessage {
                        Text(msg).font(.system(size: 11, weight: .semibold)).foregroundStyle(.green)
                    }
                    Button {
                        Task { await generateAndSavePlan() }
                    } label: {
                        HStack {
                            if isSavingPlan { ProgressView() }
                            Text("✨ Generar plan con IA y enviar").font(.system(size: 13, weight: .black))
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 12)
                        .background(AppTheme.accent(dark: dark)).foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                }
                .padding(12)
                .cardStyle(dark: dark)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Videollamada").font(.system(size: 13, weight: .black))
                    TextField("Link de Meet/Zoom", text: $meetLink).textFieldStyle(.roundedBorder)
                    Button("Guardar link") {
                        Task { try? await appState.api.setMeetLink(clienteId: client.id, link: meetLink) }
                    }
                    .font(.system(size: 12, weight: .black))
                }
                .padding(12)
                .cardStyle(dark: dark)
            }
            .padding(16)
        }
        .themedBackground(dark: dark)
        .navigationTitle(client.name)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            notes = client.coachNotes ?? ""
            meetLink = client.meetLink ?? ""
            metrics = try? await appState.api.coachClienteMetricas(clienteId: client.id)
        }
        .sheet(isPresented: $showMessages) {
            CoachMessageWidgetView(client: client)
        }
    }

    private func metricCard(_ label: String, _ value: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.system(size: 17, weight: .black))
            Text(label).font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(10)
        .cardStyle(dark: dark)
    }

    private func generateAndSavePlan() async {
        isSavingPlan = true
        let plan = MockData.samplePlan(daysUnlocked: client.premium ? 7 : 3)
        try? await appState.api.coachGuardarPlanCliente(clienteId: client.id, plan: plan)
        planSavedMessage = "Plan guardado y enviado a \(client.name) ✅"
        isSavingPlan = false
    }
}
