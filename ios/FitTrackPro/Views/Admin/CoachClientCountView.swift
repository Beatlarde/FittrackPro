import SwiftUI

/// Matches `components/admin/CoachClientCount.jsx` — a coach row with client count + revoke action.
struct CoachClientCountRow: View {
    var coach: CoachSummary
    var onRevoke: () -> Void
    @EnvironmentObject var appState: AppState

    private var dark: Bool { appState.currentUser?.darkMode ?? false }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(coach.name).font(.system(size: 14, weight: .black))
                Text(coach.email).font(.system(size: 11)).foregroundStyle(.secondary)
                Text("Código: \(coach.coachCode)").font(.system(size: 10)).foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(coach.clientCount)").font(.system(size: 18, weight: .black))
                Text("clientes").font(.system(size: 10)).foregroundStyle(.secondary)
            }
            Button(role: .destructive, action: onRevoke) {
                Image(systemName: "xmark.circle.fill")
            }
        }
        .padding(12)
        .cardStyle(dark: dark)
    }
}
