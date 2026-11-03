import SwiftUI

/// Matches `components/shared/PremiumBanner.jsx` — small upsell strip.
struct PremiumBannerView: View {
    var dark: Bool
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                Image(systemName: "sparkles")
                VStack(alignment: .leading, spacing: 2) {
                    Text("Hazte Premium")
                        .font(.system(size: 14, weight: .black))
                    Text("Desbloquea los 7 días de tu plan por $99 MXN/mes")
                        .font(.system(size: 11, weight: .medium))
                        .opacity(0.9)
                }
                Spacer()
                Image(systemName: "chevron.right")
            }
            .padding(14)
            .foregroundStyle(.white)
            .background(LinearGradient(colors: [AppTheme.premiumAmber, AppTheme.premiumOrange], startPoint: .leading, endPoint: .trailing))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}
