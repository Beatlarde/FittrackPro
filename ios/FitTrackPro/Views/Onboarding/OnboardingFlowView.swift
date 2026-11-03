import SwiftUI

/// Matches `components/onboarding/OnboardingFlow.jsx` — multi-step wizard:
/// Modalidad -> Datos base -> Salud -> Entorno -> [Notas coach] -> Compromiso -> Horarios -> Generando.
struct OnboardingFlowView: View {
    @EnvironmentObject var appState: AppState
    @State private var step = 0
    @State private var modalidad: Modalidad = .ia
    @State private var goals = Goals()
    @State private var coachNotes = ""
    @State private var mealTimes = MealTimes()
    @State private var isGenerating = false
    @State private var committed = false

    private var totalSteps: Int { modalidad == .coach ? 7 : 6 }

    var body: some View {
        VStack(spacing: 0) {
            ProgressView(value: Double(step + 1), total: Double(totalSteps))
                .tint(AppTheme.accent(dark: false))
                .padding()

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    stepContent
                }
                .padding(20)
            }

            HStack {
                if step > 0 {
                    Button("Atrás") { withAnimation { step -= 1 } }
                        .buttonStyle(.bordered)
                }
                Spacer()
                Button(nextButtonTitle) {
                    if isLastStep {
                        Task { await finishOnboarding() }
                    } else {
                        withAnimation { step += 1 }
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!canAdvance || isGenerating)
            }
            .padding(20)
        }
        .themedBackground(dark: false)
        .navigationBarBackButtonHidden(true)
    }

    private var isLastStep: Bool {
        (modalidad == .coach && step == 6) || (modalidad == .ia && step == 5)
    }

    private var nextButtonTitle: String {
        if isGenerating { return "Generando…" }
        return isLastStep ? "Comenzar" : "Continuar"
    }

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case 0: modalidadStep
        case 1: datosBaseStep
        case 2: saludStep
        case 3: entornoStep
        case 4: modalidad == .coach ? AnyView(notasCoachStep) : AnyView(compromisoStep)
        case 5: modalidad == .coach ? AnyView(compromisoStep) : AnyView(horariosStep)
        case 6: horariosStep
        default: EmptyView()
        }
    }

    private var canAdvance: Bool {
        switch step {
        case 1: return !goals.name.isEmpty
        case 5 where modalidad == .coach: return committed
        case 4 where modalidad == .ia: return committed
        default: return true
        }
    }

    // MARK: Steps

    private var modalidadStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("¿Cómo quieres entrenar?").font(.system(size: 24, weight: .black))
            Text("Elige tu modalidad. Puedes cambiarla después.").foregroundStyle(.secondary)
            optionCard(title: "100% con IA", subtitle: "Tu plan se genera al instante con inteligencia artificial.", icon: "sparkles", selected: modalidad == .ia) { modalidad = .ia }
            optionCard(title: "Coach humano", subtitle: "Un coach certificado diseña tu plan en menos de 24h.", icon: "person.fill.checkmark", selected: modalidad == .coach) { modalidad = .coach }
        }
    }

    private var datosBaseStep: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Cuéntanos de ti").font(.system(size: 24, weight: .black))
            Picker("Género", selection: $goals.gender) {
                ForEach(Gender.allCases) { Text($0.rawValue.capitalized).tag($0) }
            }.pickerStyle(.segmented)
            Picker("Objetivo", selection: $goals.objective) {
                ForEach(Objective.allCases) { Text($0.rawValue).tag($0) }
            }
            TextField("Nombre", text: $goals.name).textFieldStyle(.roundedBorder)
            Stepper("Edad: \(goals.age)", value: $goals.age, in: 14...90)
            Stepper("Peso: \(String(format: "%.1f", goals.weight)) kg", value: $goals.weight, in: 35...180, step: 0.5)
            Stepper("Altura: \(String(format: "%.0f", goals.height)) cm", value: $goals.height, in: 130...220, step: 1)
            Text("Nivel de actividad").font(.system(size: 13, weight: .black))
            Picker("Actividad", selection: $goals.activity) {
                ForEach(ActivityLevelOption.allCases) { Text($0.rawValue).tag($0) }
            }.pickerStyle(.wheel).frame(height: 100)
        }
    }

    private var saludStep: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Salud y metabolismo").font(.system(size: 24, weight: .black))
            Picker("Tipo de cuerpo", selection: $goals.bodyType) {
                ForEach(BodyType.allCases) { Text($0.rawValue).tag($0) }
            }.pickerStyle(.segmented)
            Text("Lesiones o molestias").font(.system(size: 13, weight: .black))
            TextField("Ej. dolor de rodilla derecha", text: $goals.injuries, axis: .vertical)
                .textFieldStyle(.roundedBorder).lineLimit(2...4)
            Text("Nivel de estrés").font(.system(size: 13, weight: .black))
            Picker("Estrés", selection: $goals.stressLevel) {
                ForEach(StressLevel.allCases) { Text($0.rawValue).tag($0) }
            }.pickerStyle(.segmented)
        }
    }

    private var entornoStep: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("¿Dónde entrenarás?").font(.system(size: 24, weight: .black))
            ForEach(Equipment.allCases) { eq in
                optionCard(title: eq.rawValue, subtitle: nil, icon: "dumbbell.fill", selected: goals.equipment == eq) { goals.equipment = eq }
            }
        }
    }

    private var notasCoachStep: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Notas para tu coach").font(.system(size: 24, weight: .black))
            Text("Cuéntale a tu coach cualquier detalle extra que deba saber.").foregroundStyle(.secondary)
            TextField("Ej. entreno de noche, prefiero rutinas cortas…", text: $coachNotes, axis: .vertical)
                .textFieldStyle(.roundedBorder).lineLimit(4...8)
        }
    }

    private var compromisoStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("El Pacto del 1%").font(.system(size: 24, weight: .black))
            Text("Mejorar 1% cada día es todo lo que se necesita. Me comprometo a registrar mi progreso y confiar en el proceso.")
                .padding(16)
                .background(AppTheme.bgSurface2(dark: false))
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            Toggle("Firmo mi compromiso", isOn: $committed)
                .toggleStyle(.switch)
        }
    }

    private var horariosStep: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Horarios de comida").font(.system(size: 24, weight: .black))
            TextField("Desayuno (HH:mm)", text: $mealTimes.desayuno).textFieldStyle(.roundedBorder)
            TextField("Comida (HH:mm)", text: $mealTimes.comida).textFieldStyle(.roundedBorder)
            TextField("Cena (HH:mm)", text: $mealTimes.cena).textFieldStyle(.roundedBorder)
        }
    }

    private func optionCard(title: String, subtitle: String?, icon: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon).font(.system(size: 20)).frame(width: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.system(size: 15, weight: .black))
                    if let subtitle { Text(subtitle).font(.system(size: 12)).foregroundStyle(.secondary) }
                }
                Spacer()
                if selected { Image(systemName: "checkmark.circle.fill").foregroundStyle(AppTheme.accent(dark: false)) }
            }
            .padding(14)
            .background(selected ? AppTheme.accent(dark: false).opacity(0.1) : AppTheme.bgSurface2(dark: false))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func finishOnboarding() async {
        guard let userId = appState.currentUser?.id else { return }
        isGenerating = true
        do {
            let macros = try await appState.api.calcularMacros(goals: goals)
            goals.targetKcal = macros.kcal
            goals.proteina = macros.proteina
            goals.carbs = macros.carbs
            goals.grasas = macros.grasas
            let updated = try await appState.api.completeOnboarding(userId: userId, goals: goals, modalidad: modalidad, coachNotes: modalidad == .coach ? coachNotes : nil, mealTimes: mealTimes)
            appState.setCurrentUser(updated)
            if modalidad == .ia {
                _ = try? await appState.api.generarPlanIA(for: userId)
            }
        } catch {
            appState.errorMessage = error.localizedDescription
        }
        isGenerating = false
    }
}
