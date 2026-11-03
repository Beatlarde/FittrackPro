import SwiftUI
import Combine

/// Matches `components/shared/CountdownTimer.jsx` — 24h coach SLA countdown, turns red under 3h.
struct CountdownTimerView: View {
    var deadline: Date
    @State private var now: Date = Date()

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private var remaining: TimeInterval { max(0, deadline.timeIntervalSince(now)) }
    private var isUrgent: Bool { remaining < 3 * 3600 }

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "clock.fill")
            Text(formatted)
                .font(.system(size: 13, weight: .black, design: .monospaced))
        }
        .foregroundStyle(isUrgent ? AppTheme.destructiveRed : AppTheme.infoBlue)
        .onReceive(timer) { value in now = value }
    }

    private var formatted: String {
        let total = Int(remaining)
        let h = total / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        return String(format: "%02d:%02d:%02d", h, m, s)
    }
}
