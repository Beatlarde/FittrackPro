import SwiftUI

/// Matches `components/coach/CoachMessageWidget.jsx` — coach sends a message to a specific client.
struct CoachMessageWidgetView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) var dismiss
    var client: CoachClientSummary
    @State private var messages: [AppChatMessage] = []
    @State private var draft = ""
    @State private var isLoading = true

    private var dark: Bool { appState.currentUser?.darkMode ?? false }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollView {
                    LazyVStack(spacing: 10) {
                        if isLoading {
                            ProgressView().padding(.top, 30)
                        } else {
                            ForEach(messages) { msg in ChatBubbleView(message: msg, dark: dark) }
                        }
                    }
                    .padding(14)
                }
                Divider()
                HStack {
                    TextField("Responder a \(client.name)…", text: $draft, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                    Button {
                        Task { await send() }
                    } label: {
                        Image(systemName: "arrow.up.circle.fill").font(.system(size: 28))
                    }
                    .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(12)
            }
            .navigationTitle(client.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cerrar") { dismiss() } } }
            .task { await load() }
        }
    }

    private func load() async {
        isLoading = true
        messages = (try? await appState.api.fetchMessages(userId: client.id)) ?? []
        isLoading = false
    }

    private func send() async {
        let text = draft
        draft = ""
        let coachName = appState.currentUser?.name ?? "Coach"
        if let msg = try? await appState.api.sendMessage(userId: client.id, text: text, fromCoach: true, coachName: coachName) {
            messages.append(msg)
        }
    }
}
