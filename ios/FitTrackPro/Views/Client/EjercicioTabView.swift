import SwiftUI

/// Matches `components/client/EjercicioTab.jsx` — warm-up + exercises for the selected day,
/// with per-exercise check-off and an RPE/RIR logging prompt right after checking.
struct EjercicioTabView: View {
    @EnvironmentObject var appState: AppState
    var day: PlanDay
    var dateKey: String
    var plan: TrainingPlan
    var onUpdate: (TrainingPlan) -> Void

    @State private var showRPEFor: PlanEjercicio?
    @State private var rpe: Double = 8
    @State private var rir: Double = 2

    private var dark: Bool { appState.currentUser?.darkMode ?? false }
    private var progress: DayProgress { appState.currentUser?.dailyProgress[dateKey] ?? DayProgress() }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Entrenamiento" + (day.entrenamiento.tipo.map { ": \($0)" } ?? ""))
                .font(.system(size: 17, weight: .black))

            if !day.entrenamiento.calentamiento.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Calentamiento").font(.system(size: 12, weight: .black)).foregroundStyle(.secondary)
                    ForEach(day.entrenamiento.calentamiento) { item in
                        HStack {
                            Image(systemName: "flame").foregroundStyle(AppTheme.premiumOrange)
                            Text(item.nombre).font(.system(size: 13, weight: .medium))
                            Spacer()
                            Text(item.duracion).font(.system(size: 12)).foregroundStyle(.secondary)
                        }
                    }
                }
                .padding(12)
                .background(AppTheme.bgSurface2(dark: dark))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }

            if day.entrenamiento.ejercicios.isEmpty {
                Text("Día de descanso. ¡Aprovecha para recuperar! 💤")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 8)
            }

            ForEach(Array(day.entrenamiento.ejercicios.enumerated()), id: \.offset) { idx, ejercicio in
                let key = "\(dateKey)-ej-\(idx)"
                let done = progress.ejercicios.contains(key)
                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .top) {
                        Button {
                            Task { await toggle(key: key, exercise: ejercicio) }
                        } label: {
                            Image(systemName: done ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 22))
                                .foregroundStyle(done ? AppTheme.accent(dark: dark) : .secondary)
                        }
                        .buttonStyle(.plain)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(ejercicio.nombre).font(.system(size: 14, weight: .black))
                                .strikethrough(done)
                            Text("\(ejercicio.series) series × \(ejercicio.reps)")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(.secondary)
                            if let nota = ejercicio.nota, !nota.isEmpty {
                                Text(nota).font(.system(size: 11)).foregroundStyle(.secondary).italic()
                            }
                            if let today = appState.currentUser?.esfuerzo[DateFormatter.shortDate.string(from: Date())]?[key] {
                                Text("RPE \(today.rpe) · RIR \(today.rir)")
                                    .font(.system(size: 11, weight: .black))
                                    .foregroundStyle(AppTheme.coachPurple)
                            }
                        }
                        Spacer()
                    }
                }
                .padding(12)
                .background(AppTheme.bgSurface(dark: dark))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(AppTheme.borderColor(dark: dark), lineWidth: 1))
            }
        }
        .padding(16)
        .cardStyle(dark: dark)
        .sheet(item: $showRPEFor) { ejercicio in
            rpeSheet(ejercicio)
        }
    }

    private func toggle(key: String, exercise: PlanEjercicio) async {
        guard let userId = appState.currentUser?.id else { return }
        let wasCompleted = progress.ejercicios.contains(key)
        if let updated = try? await appState.api.toggleProgress(userId: userId, dateKey: dateKey, itemKey: key, isExercise: true) {
            appState.setCurrentUser(updated)
        }
        if !wasCompleted {
            showRPEFor = exercise
        }
    }

    private func rpeSheet(_ ejercicio: PlanEjercicio) -> some View {
        NavigationStack {
            Form {
                Section("¿Qué tan difícil sintió \(ejercicio.nombre)?") {
                    VStack(alignment: .leading) {
                        Text("RPE (esfuerzo percibido): \(Int(rpe))")
                        Slider(value: $rpe, in: 6...10, step: 1)
                    }
                    VStack(alignment: .leading) {
                        Text("RIR (reps en reserva): \(Int(rir))")
                        Slider(value: $rir, in: 0...4, step: 1)
                    }
                }
            }
            .navigationTitle("Registrar esfuerzo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") {
                        Task {
                            if let userId = appState.currentUser?.id, let idx = day.entrenamiento.ejercicios.firstIndex(where: { $0.id == ejercicio.id }) {
                                let key = "\(dateKey)-ej-\(idx)"
                                try? await appState.api.registrarEsfuerzo(userId: userId, ejercicioKey: key, ejercicio: ejercicio.nombre, rpe: Int(rpe), rir: Int(rir))
                                if let updated = appState.api.currentUserPublisher() { appState.setCurrentUser(updated) }
                            }
                            showRPEFor = nil
                        }
                    }
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Omitir") { showRPEFor = nil }
                }
            }
        }
        .presentationDetents([.medium])
    }
}
