import SwiftUI
import PhotosUI

/// Matches `components/shared/PhotosSection.jsx` + `MultiPhotoModal.jsx` — categorized progress
/// photo galleries, plus the Premium-gated "Analizar mi progreso con IA" feature.
struct ProgresoFotosView: View {
    @EnvironmentObject var appState: AppState
    @State private var photos: [PhotoEntry] = []
    @State private var isLoading = true
    @State private var pickerItem: PhotosPickerItem?
    @State private var analysis: String?
    @State private var isAnalyzing = false

    private var dark: Bool { appState.currentUser?.darkMode ?? false }
    private var grouped: [String: [PhotoEntry]] { Dictionary(grouping: photos, by: { $0.category }) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                AchievementsBoardView()

                PremiumGateView(isPremium: appState.currentUser?.premium ?? false, dark: dark, message: "Analiza tu progreso físico con IA comparando tus fotos.") {} content: {
                    VStack(alignment: .leading, spacing: 10) {
                        Button {
                            Task { await analyze() }
                        } label: {
                            HStack {
                                if isAnalyzing { ProgressView() }
                                Text("✨ Analizar mi progreso con IA").font(.system(size: 13, weight: .black))
                            }
                            .frame(maxWidth: .infinity).padding(.vertical, 12)
                            .background(AppTheme.bgSurface2(dark: dark))
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        if let analysis {
                            Text(analysis).font(.system(size: 12)).foregroundStyle(.secondary)
                        }
                    }
                    .cardStyle(dark: dark)
                }

                HStack {
                    Text("Tus fotos").font(.system(size: 17, weight: .black))
                    Spacer()
                    PhotosPicker(selection: $pickerItem, matching: .images) {
                        Label("Agregar", systemImage: "plus.circle.fill").font(.system(size: 13, weight: .black))
                    }
                }

                if isLoading {
                    SkeletonCardView(dark: dark)
                } else if photos.isEmpty {
                    Text("Aún no has subido fotos de progreso.").font(.system(size: 13)).foregroundStyle(.secondary)
                } else {
                    ForEach(grouped.keys.sorted(), id: \.self) { category in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(category).font(.system(size: 13, weight: .black)).foregroundStyle(.secondary)
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                                ForEach(grouped[category] ?? []) { _ in
                                    RoundedRectangle(cornerRadius: 12).fill(AppTheme.bgSurface2(dark: dark))
                                        .aspectRatio(3/4, contentMode: .fit)
                                        .overlay(Image(systemName: "photo.fill").foregroundStyle(.secondary))
                                }
                            }
                        }
                    }
                }
            }
            .padding(16)
        }
        .themedBackground(dark: dark)
        .task { await load() }
        .onChange(of: pickerItem) { _, _ in Task { await uploadPhoto() } }
    }

    private func load() async {
        guard let userId = appState.currentUser?.id else { return }
        isLoading = true
        photos = (try? await appState.api.fetchPhotos(userId: userId)) ?? []
        isLoading = false
    }

    private func uploadPhoto() async {
        guard let userId = appState.currentUser?.id else { return }
        if let entry = try? await appState.api.addPhoto(userId: userId, category: "Progreso") {
            photos.append(entry)
        }
    }

    private func analyze() async {
        guard let userId = appState.currentUser?.id else { return }
        isAnalyzing = true
        analysis = try? await appState.api.analizarProgresoIA(userId: userId)
        isAnalyzing = false
    }
}
