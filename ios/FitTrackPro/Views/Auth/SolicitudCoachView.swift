import SwiftUI

/// Matches `components/auth/SolicitudCoachForm.jsx` — apply to become a coach (`POST /solicitud-coach`).
struct SolicitudCoachView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) var dismiss
    @State private var nombre = ""
    @State private var email = ""
    @State private var telefono = ""
    @State private var especialidad = ""
    @State private var experiencia = ""
    @State private var isSubmitting = false
    @State private var didSubmit = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Datos de contacto") {
                    TextField("Nombre completo", text: $nombre)
                    TextField("Correo electrónico", text: $email).keyboardType(.emailAddress)
                    TextField("Teléfono", text: $telefono).keyboardType(.phonePad)
                }
                Section("Perfil profesional") {
                    TextField("Especialidad (ej. Fuerza, Nutrición)", text: $especialidad)
                    TextField("Experiencia", text: $experiencia, axis: .vertical)
                        .lineLimit(3...6)
                }
                if didSubmit {
                    Section {
                        Label("Solicitud enviada. Te contactaremos por correo.", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    }
                }
            }
            .navigationTitle("Solicitud para Coach")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cerrar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSubmitting ? "Enviando…" : "Enviar") {
                        Task {
                            isSubmitting = true
                            try? await appState.api.solicitudCoach(nombre: nombre, email: email, telefono: telefono, especialidad: especialidad, experiencia: experiencia)
                            isSubmitting = false
                            didSubmit = true
                        }
                    }
                    .disabled(nombre.isEmpty || email.isEmpty || isSubmitting)
                }
            }
        }
    }
}
