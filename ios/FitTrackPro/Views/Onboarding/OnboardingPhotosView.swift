import SwiftUI
import PhotosUI

/// Matches `components/onboarding/OnboardingPhotos.jsx` — optional frente/perfil/espalda photos
/// before entering the dashboard (`POST /upload-photo`, category `onboarding_*`).
struct OnboardingPhotosView: View {
    @EnvironmentObject var appState: AppState
    @State private var frente: PhotosPickerItem?
    @State private var perfil: PhotosPickerItem?
    @State private var espalda: PhotosPickerItem?
    @State private var frenteImage: Image?
    @State private var perfilImage: Image?
    @State private var espaldaImage: Image?
    @State private var isSaving = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                VStack(spacing: 6) {
                    Text("Fotos de progreso")
                        .font(.system(size: 24, weight: .black))
                    Text("Opcional, pero muy recomendable para que tu coach y la IA puedan medir tu avance real.")
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 20)

                photoSlot(title: "Frente", item: $frente, image: $frenteImage)
                photoSlot(title: "Perfil", item: $perfil, image: $perfilImage)
                photoSlot(title: "Espalda", item: $espalda, image: $espaldaImage)

                Button {
                    Task { await finish() }
                } label: {
                    HStack {
                        if isSaving { ProgressView().tint(.white) }
                        Text("Ir a mi plan").font(.system(size: 15, weight: .black))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(AppTheme.accent(dark: false))
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .disabled(isSaving)

                Button("Omitir por ahora") { Task { await finish() } }
                    .font(.system(size: 13, weight: .semibold))
                    .disabled(isSaving)
            }
            .padding(20)
        }
        .themedBackground(dark: false)
    }

    private func photoSlot(title: String, item: Binding<PhotosPickerItem?>, image: Binding<Image?>) -> some View {
        PhotosPicker(selection: item, matching: .images) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 14).fill(AppTheme.bgSurface2(dark: false)).frame(width: 64, height: 64)
                    if let image = image.wrappedValue {
                        image.resizable().scaledToFill().frame(width: 64, height: 64).clipShape(RoundedRectangle(cornerRadius: 14))
                    } else {
                        Image(systemName: "camera.fill").foregroundStyle(.secondary)
                    }
                }
                Text(title).font(.system(size: 15, weight: .black))
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(.secondary)
            }
            .padding(14)
            .cardStyle(dark: false)
        }
        .buttonStyle(.plain)
        .onChange(of: item.wrappedValue) { _, newItem in
            Task {
                if let data = try? await newItem?.loadTransferable(type: Data.self), let uiImage = UIImage(data: data) {
                    image.wrappedValue = Image(uiImage: uiImage)
                }
            }
        }
    }

    private func finish() async {
        guard let userId = appState.currentUser?.id else { return }
        isSaving = true
        try? await appState.api.uploadOnboardingPhotos(userId: userId)
        if var user = appState.currentUser {
            user.showPhotoStep = false
            appState.setCurrentUser(user)
        }
        isSaving = false
    }
}
