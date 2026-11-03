import SwiftUI

/// Matches `components/client/ChatMensajesCoach.jsx` + `CoachMessageBanner.jsx`.
struct ChatConCoachView: View {
    @EnvironmentObject var appState: AppState
    @State private var messages: [AppChatMessage] = []
    @State private var draft = ""
    @State private var isLoading = true

    private var dark: Bool { appState.currentUser?.darkMode ?? false }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 10) {
                        if isLoading {
                            ProgressView().padding(.top, 40)
                        } else if messages.isEmpty {
                            Text("Aún no tienes mensajes con tu coach.")
                                .font(.system(size: 13))
                                .foregroundStyle(.secondary)
                                .padding(.top, 40)
                        } else {
                            ForEach(messages) { msg in
                                ChatBubbleView(message: msg, dark: dark).id(msg.id)
                            }
                        }
                    }
                    .padding(16)
                }
                .onChange(of: messages.count) { _, _ in
                    if let last = messages.last { withAnimation { proxy.scrollTo(last.id, anchor: .bottom) } }
                }
            }
            Divider()
            HStack(spacing: 10) {
                TextField("Escribe un mensaje…", text: $draft, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                Button {
                    Task { await send() }
                } label: {
                    Image(systemName: "arrow.up.circle.fill").font(.system(size: 30))
                }
                .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(12)
        }
        .themedBackground(dark: dark)
        .task { await load() }
    }

    private func load() async {
        guard let userId = appState.currentUser?.id else { return }
        isLoading = true
        messages = (try? await appState.api.fetchMessages(userId: userId)) ?? []
        isLoading = false
    }

    private func send() async {
        guard let userId = appState.currentUser?.id else { return }
        let text = draft
        draft = ""
        if let msg = try? await appState.api.sendMessage(userId: userId, text: text, fromCoach: false, coachName: nil) {
            messages.append(msg)
        }
    }
}
