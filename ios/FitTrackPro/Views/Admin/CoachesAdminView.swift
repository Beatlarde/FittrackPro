import SwiftUI

/// Matches `components/admin/CoachesAdmin.jsx` — approve/reject coach applications, list active
/// coaches with client counts, manual promote/revoke.
struct CoachesAdminView: View {
    @EnvironmentObject var appState: AppState
    @State private var coaches: [CoachSummary] = []
    @State private var requests: [CoachRequest] = []
    @State private var isLoading = true
    @State private var manualEmail = ""
    @State private var manualNombre = ""

    private var dark: Bool { appState.currentUser?.darkMode ?? false }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if requests.contains(where: { $0.status == .pending }) {
                    Text("Solicitudes pendientes").font(.system(size: 15, weight: .black))
                    ForEach(requests.filter { $0.status == .pending }) { req in
                        requestCard(req)
                    }
                }

                Text("Coaches activos").font(.system(size: 15, weight: .black))
                if isLoading {
                    SkeletonCardView(dark: dark)
                } else {
                    ForEach(coaches) { coach in
                        CoachClientCountRow(coach: coach) {
                            Task {
                                try? await appState.api.adminRevocarCoach(uid: coach.id)
                                await load()
                            }
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Dar de alta manualmente").font(.system(size: 13, weight: .black))
                    TextField("Correo", text: $manualEmail).keyboardType(.emailAddress).textFieldStyle(.roundedBorder)
                    TextField("Nombre", text: $manualNombre).textFieldStyle(.roundedBorder)
                    Button("Promover a Coach") {
                        Task {
                            try? await appState.api.adminDarAltaCoach(email: manualEmail, nombre: manualNombre)
                            manualEmail = ""; manualNombre = ""
                            await load()
                        }
                    }
                    .disabled(manualEmail.isEmpty || manualNombre.isEmpty)
                }
                .padding(12)
                .cardStyle(dark: dark)
            }
            .padding(16)
        }
        .themedBackground(dark: dark)
        .task { await load() }
    }

    private func requestCard(_ req: CoachRequest) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(req.nombre).font(.system(size: 14, weight: .black))
            Text(req.especialidad).font(.system(size: 12)).foregroundStyle(.secondary)
            Text(req.experiencia).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(2)
            HStack {
                Button("Aprobar") {
                    Task { try? await appState.api.adminAprobarCoach(requestId: req.id); await load() }
                }
                .font(.system(size: 12, weight: .black))
                Spacer()
                Button("Rechazar", role: .destructive) {
                    Task { try? await appState.api.adminRechazarCoach(requestId: req.id, motivo: "No cumple perfil"); await load() }
                }
                .font(.system(size: 12, weight: .black))
            }
        }
        .padding(12)
        .cardStyle(dark: dark)
    }

    private func load() async {
        isLoading = true
        async let c = appState.api.adminCoaches()
        async let r = appState.api.adminSolicitudesCoach()
        coaches = (try? await c) ?? []
        requests = (try? await r) ?? []
        isLoading = false
    }
}
