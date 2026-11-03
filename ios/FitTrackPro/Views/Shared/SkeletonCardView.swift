import SwiftUI

/// Matches `components/shared/SkeletonCard.jsx` — loading placeholder.
struct SkeletonCardView: View {
    var dark: Bool
    @State private var animate = false

    var body: some View {
        RoundedRectangle(cornerRadius: 24, style: .continuous)
            .fill(AppTheme.bgSurface2(dark: dark))
            .opacity(animate ? 0.5 : 1)
            .frame(height: 90)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) {
                    animate = true
                }
            }
    }
}
