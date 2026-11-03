import SwiftUI

/// Matches `components/auth/LoginScreen.jsx`.
struct LoginView: View {
    @EnvironmentObject var appState: AppState
    @State private var email = ""
    @State private var password = ""
    @State private var isRegisterMode = false
    @State private var name = ""
    @State private var showCoachApplication = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    VStack(spacing: 8) {
                        Image(systemName: "figure.strengthtraining.functional")
                            .font(.system(size: 42, weight: .black))
                            .foregroundStyle(AppTheme.accent(dark: false))
                        Text("FitTrack Pro")
                            .font(.system(size: 30, weight: .black))
                        Text("Coaching de fitness y nutrición, asistido por IA")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 40)

                    VStack(spacing: 12) {
                        if isRegisterMode {
                            TextField("Nombre completo", text: $name)
                                .textFieldStyle(.roundedBorder)
                        }
                        TextField("Correo electrónico", text: $email)
                            .textFieldStyle(.roundedBorder)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                        SecureField("Contraseña", text: $password)
                            .textFieldStyle(.roundedBorder)

                        if let error = appState.errorMessage {
                            Text(error)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(AppTheme.destructiveRed)
                        }

                        Button {
                            Task {
                                if isRegisterMode {
                                    await appState.register(email: email, password: password, name: name)
                                } else {
                                    await appState.login(email: email, password: password)
                                }
                            }
                        } label: {
                            HStack {
                                if appState.isBusy { ProgressView().tint(.white) }
                                Text(isRegisterMode ? "Crear cuenta" : "Iniciar sesión")
                                    .font(.system(size: 15, weight: .black))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(AppTheme.accent(dark: false))
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }
                        .disabled(email.isEmpty || password.isEmpty || appState.isBusy)

                        Button(isRegisterMode ? "¿Ya tienes cuenta? Inicia sesión" : "¿Nuevo aquí? Crea tu cuenta") {
                            isRegisterMode.toggle()
                        }
                        .font(.system(size: 13, weight: .semibold))
                    }
                    .padding(20)
                    .cardStyle(dark: false)

                    Button {
                        Task { await appState.loginDemoCoach() }
                    } label: {
                        Label("Probar como Coach (demo)", systemImage: "person.badge.clock")
                            .font(.system(size: 13, weight: .black))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                    }
                    .buttonStyle(.bordered)

                    Button("¿Eres entrenador? Solicita ser Coach") {
                        showCoachApplication = true
                    }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AppTheme.coachPurple)

                    VStack(spacing: 4) {
                        Text("Cuentas demo").font(.system(size: 11, weight: .black)).foregroundStyle(.secondary)
                        Text("cliente@demo.com · coach@demo.com · admin@demo.com").font(.system(size: 11)).foregroundStyle(.secondary)
                    }
                    .padding(.bottom, 24)
                }
                .padding(.horizontal, 20)
            }
            .themedBackground(dark: false)
            .sheet(isPresented: $showCoachApplication) {
                SolicitudCoachView()
            }
        }
    }
}
