import SwiftUI

/// Generic progress ring, matching `components/shared/Ring.jsx`.
struct RingView: View {
    var progress: Double // 0...1
    var color: Color
    var lineWidth: CGFloat = 10
    var label: String? = nil

    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.15), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: min(1, max(0, progress)))
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.5), value: progress)
            if let label {
                Text(label)
                    .font(.system(size: 13, weight: .black))
            }
        }
    }
}
