import SwiftUI

/// Matches `components/client/DietaTab.jsx` — meals for the selected day, with check-off,
/// "me di un gustito" logging, and an AI meal-swap sheet.
struct DietaTabView: View {
    @EnvironmentObject var appState: AppState
    var day: PlanDay
    var dateKey: String
    var plan: TrainingPlan
    var onUpdate: (TrainingPlan) -> Void

    @State private var swapTarget: Comida?
    @State private var alternatives: [String] = []
    @State private var isLoadingAlternatives = false
    @State private var gustitoTarget: Comida?
    @State private var gustitoText = ""

    private var dark: Bool { appState.currentUser?.darkMode ?? false }
    private var progress: DayProgress { appState.currentUser?.dailyProgress[dateKey] ?? DayProgress() }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Nutrición").font(.system(size: 17, weight: .black))

            MacroRingView(
                kcalConsumed: Int(Double(day.dieta.kcal) * (Double(progress.comidas.count) / Double(max(day.dieta.comidas.count, 1)))),
                kcalGoal: day.dieta.kcal,
                proteina: day.dieta.proteina,
                carbs: day.dieta.carbs,
                grasas: day.dieta.grasas,
                dark: dark
            )

            ForEach(Array(day.dieta.comidas.enumerated()), id: \.offset) { idx, comida in
                let key = "\(dateKey)-comida-\(idx)"
                let done = progress.comidas.contains(key)
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .top) {
                        Button {
                            Task { await toggle(key: key) }
                        } label: {
                            Image(systemName: done ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 22))
                                .foregroundStyle(done ? AppTheme.accent(dark: dark) : .secondary)
                        }
                        .buttonStyle(.plain)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(comida.momento).font(.system(size: 13, weight: .black)).foregroundStyle(AppTheme.accent(dark: dark))
                            Text(comida.descripcion).font(.system(size: 13, weight: .medium)).strikethrough(done)
                        }
                        Spacer()
                    }
                    HStack(spacing: 12) {
                        Button("🔄 Cambiar") {
                            swapTarget = comida
                            Task { await loadAlternatives() }
                        }
                        .font(.system(size: 11, weight: .black))

                        Button("😋 Me di un gustito") {
                            gustitoTarget = comida
                            gustitoText = ""
                        }
                        .font(.system(size: 11, weight: .black))
                        .foregroundStyle(AppTheme.gustitoPink)
                    }
                    .padding(.leading, 34)
                }
                .padding(12)
                .background(AppTheme.bgSurface(dark: dark))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(AppTheme.borderColor(dark: dark), lineWidth: 1))
            }
        }
        .padding(16)
        .cardStyle(dark: dark)
        .sheet(item: $swapTarget) { comida in
            swapSheet(comida)
        }
        .sheet(item: $gustitoTarget) { comida in
            gustitoSheet(comida)
        }
    }

    private func toggle(key: String) async {
        guard let userId = appState.currentUser?.id else { return }
        if let updated = try? await appState.api.toggleProgress(userId: userId, dateKey: dateKey, itemKey: key, isExercise: false) {
            appState.setCurrentUser(updated)
        }
    }

    private func loadAlternatives() async {
        isLoadingAlternatives = true
        alternatives = (try? await appState.api.generarAlternativa(momento: swapTarget?.momento ?? "", macros: (day.dieta.kcal, day.dieta.proteina, day.dieta.carbs, day.dieta.grasas))) ?? []
        isLoadingAlternatives = false
    }

    private func swapSheet(_ comida: Comida) -> some View {
        NavigationStack {
            List {
                if isLoadingAlternatives {
                    ProgressView("Generando alternativas con IA…")
                } else {
                    ForEach(alternatives, id: \.self) { alt in
                        Button {
                            swapTarget = nil
                        } label: {
                            Text(alt).font(.system(size: 13, weight: .medium))
                        }
                    }
                }
            }
            .navigationTitle("Cambiar \(comida.momento)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cerrar") { swapTarget = nil } }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func gustitoSheet(_ comida: Comida) -> some View {
        NavigationStack {
            Form {
                Section("¿Qué te comiste?") {
                    TextField("Ej. 2 tacos al pastor", text: $gustitoText, axis: .vertical)
                        .lineLimit(2...5)
                }
            }
            .navigationTitle("Me di un gustito")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Registrar") {
                        Task {
                            if let userId = appState.currentUser?.id, let name = appState.currentUser?.name {
                                let log = LogEntry(userId: userId, userName: name, type: .meal, content: gustitoText, aiMetadata: AIMetadata(kcal: 450, protein: 12, carbs: 40, fats: 22, name: gustitoText), esGustito: true, momento: comida.momento)
                                _ = try? await appState.api.addLog(log)
                            }
                            gustitoTarget = nil
                        }
                    }
                    .disabled(gustitoText.isEmpty)
                }
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { gustitoTarget = nil } }
            }
        }
        .presentationDetents([.medium])
    }
}
