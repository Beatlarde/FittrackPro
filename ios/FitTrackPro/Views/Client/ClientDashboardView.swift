import SwiftUI

/// Matches `components/client/ClientDashboard.jsx` — root tab container for the client role.
struct ClientDashboardView: View {
    @EnvironmentObject var appState: AppState
    @State private var plan: TrainingPlan?
    @State private var selectedDayIndex: Int = 0
    @State private var isLoadingPlan = true

    var dark: Bool { appState.currentUser?.darkMode ?? false }

    var body: some View {
        TabView {
            NavigationStack {
                todayView
                    .navigationTitle("Hoy")
            }
            .tabItem { Label("Hoy", systemImage: "sun.max.fill") }

            NavigationStack {
                ProgresoFotosView()
                    .navigationTitle("Progreso")
            }
            .tabItem { Label("Progreso", systemImage: "chart.line.uptrend.xyaxis") }

            NavigationStack {
                ChatConCoachView()
                    .navigationTitle("Chat")
            }
            .tabItem { Label("Chat", systemImage: "message.fill") }

            NavigationStack {
                PlanesScreenView()
                    .navigationTitle("Planes")
            }
            .tabItem { Label("Planes", systemImage: "crown.fill") }

            NavigationStack {
                ClientProfileView()
                    .navigationTitle("Perfil")
            }
            .tabItem { Label("Perfil", systemImage: "person.fill") }
        }
        .task { await loadPlan() }
    }

    private var todayView: some View {
        ScrollView {
            VStack(spacing: 16) {
                if isLoadingPlan {
                    SkeletonCardView(dark: dark)
                    SkeletonCardView(dark: dark)
                } else if let plan {
                    DailyHUDView(
                        dark: dark,
                        ejerciciosDone: completedCount(isExercise: true),
                        ejerciciosTotal: currentDay(plan)?.entrenamiento.ejercicios.count ?? 0,
                        comidasDone: completedCount(isExercise: false),
                        comidasTotal: currentDay(plan)?.dieta.comidas.count ?? 0,
                        streakDays: 5
                    )

                    if appState.currentUser?.premium != true {
                        PremiumBannerView(dark: dark) {}
                    }

                    dayPicker(plan)

                    if let day = currentDay(plan), isDayUnlocked(index: selectedDayIndex, plan: plan) {
                        AchievementsBoardView(compact: true)
                        EjercicioTabView(day: day, dateKey: dateKey(for: selectedDayIndex), plan: plan, onUpdate: { self.plan = $0 })
                        DietaTabView(day: day, dateKey: dateKey(for: selectedDayIndex), plan: plan, onUpdate: { self.plan = $0 })
                    } else {
                        lockedDayCard
                    }
                } else {
                    Text("Aún no tienes un plan asignado.")
                        .foregroundStyle(.secondary)
                        .padding(.top, 40)
                }
            }
            .padding(16)
        }
        .themedBackground(dark: dark)
    }

    private func dayPicker(_ plan: TrainingPlan) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Array(plan.plan.enumerated()), id: \.offset) { idx, day in
                    let unlocked = isDayUnlocked(index: idx, plan: plan)
                    Button {
                        selectedDayIndex = idx
                    } label: {
                        VStack(spacing: 4) {
                            if !unlocked { Image(systemName: "lock.fill").font(.system(size: 10)) }
                            Text(String(day.dia.prefix(3)))
                                .font(.system(size: 12, weight: .black))
                        }
                        .frame(width: 52, height: 44)
                        .background(selectedDayIndex == idx ? AppTheme.accent(dark: dark) : AppTheme.bgSurface2(dark: dark))
                        .foregroundStyle(selectedDayIndex == idx ? .white : (unlocked ? AppTheme.textPrimary(dark: dark) : AppTheme.textMuted(dark: dark)))
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                }
            }
        }
    }

    private var lockedDayCard: some View {
        VStack(spacing: 10) {
            Image(systemName: "lock.fill").font(.system(size: 26)).foregroundStyle(AppTheme.premiumAmber)
            Text("Este día está bloqueado").font(.system(size: 15, weight: .black))
            Text("Hazte Premium para desbloquear los 7 días de tu plan.")
                .font(.system(size: 12)).foregroundStyle(.secondary).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .cardStyle(dark: dark)
    }

    private func currentDay(_ plan: TrainingPlan) -> PlanDay? {
        guard selectedDayIndex < plan.plan.count else { return nil }
        return plan.plan[selectedDayIndex]
    }

    private func isDayUnlocked(index: Int, plan: TrainingPlan) -> Bool {
        let relative = ((index - plan.startDayIndex) % 7 + 7) % 7
        return relative < plan.daysUnlocked
    }

    private func dateKey(for index: Int) -> String {
        "day-\(index)"
    }

    private func completedCount(isExercise: Bool) -> Int {
        guard let progress = appState.currentUser?.dailyProgress[dateKey(for: selectedDayIndex)] else { return 0 }
        return isExercise ? progress.ejercicios.count : progress.comidas.count
    }

    private func loadPlan() async {
        guard let userId = appState.currentUser?.id else { return }
        isLoadingPlan = true
        plan = try? await appState.api.fetchPlan(userId: userId)
        isLoadingPlan = false
    }
}
