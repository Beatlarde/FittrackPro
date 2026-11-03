import SwiftUI

/// Client-side settings/profile — surfaces `goals`, dark mode toggle, referral linkage, and logout.
struct ClientProfileView: View {
    @EnvironmentObject var appState: AppState

    private var dark: Bool { appState.currentUser?.darkMode ?? false }

    var body: some View {
        Form {
            if let user = appState.currentUser {
                Section("Cuenta") {
                    LabeledContent("Nombre", value: user.name)
                    LabeledContent("Correo", value: user.email)
                    LabeledContent("Modalidad", value: user.modalidad == .ia ? "100% IA" : "Coach humano")
                    LabeledContent("Membresía", value: user.premium ? "Premium" : "Gratis")
                }
                if let goals = user.goals {
                    Section("Objetivos") {
                        LabeledContent("Objetivo", value: goals.objective.rawValue)
                        LabeledContent("Peso", value: "\(String(format: "%.1f", goals.weight)) kg")
                        LabeledContent("Meta calórica", value: "\(goals.targetKcal) kcal")
                        LabeledContent("Macros", value: "P\(goals.proteina) / C\(goals.carbs) / G\(goals.grasas)")
                    }
                }
                Section("Preferencias") {
                    Toggle("Modo oscuro", isOn: Binding(
                        get: { user.darkMode },
                        set: { _ in appState.toggleDarkMode() }
                    ))
                }
                if let code = user.refCoachCode {
                    Section("Coach") {
                        LabeledContent("Vinculado con", value: code)
                    }
                }
            }
            Section {
                Button("Cerrar sesión", role: .destructive) { appState.logout() }
            }
        }
    }
}
