import SwiftUI

extension Color {
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        var int: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&int)
        let r, g, b: UInt64
        (r, g, b) = (int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        self.init(.sRGB, red: Double(r) / 255, green: Double(g) / 255, blue: Double(b) / 255, opacity: 1)
    }
}

/// Mirrors the CSS custom properties in the web app's `src/utils/theme.js`.
enum AppTheme {
    static func accent(dark: Bool) -> Color { dark ? Color(hex: "FF5C00") : Color(hex: "10b981") }
    static func bgPrimary(dark: Bool) -> Color { dark ? Color(hex: "0B0F1A") : Color(hex: "FAFAF8") }
    static func bgSurface(dark: Bool) -> Color { dark ? Color(hex: "131929") : Color(hex: "FFFFFF") }
    static func bgSurface2(dark: Bool) -> Color { dark ? Color(hex: "1A2237") : Color(hex: "F3F2EE") }
    static func textPrimary(dark: Bool) -> Color { dark ? Color(hex: "F0F4F8") : Color(hex: "0F1117") }
    static func textMuted(dark: Bool) -> Color { dark ? Color(hex: "6B7E91") : Color(hex: "6B7280") }
    static func borderColor(dark: Bool) -> Color { (dark ? Color.white : Color.black).opacity(dark ? 0.07 : 0.08) }

    // Semantic colors reused across macro rings / badges (matched from the Tailwind classes in the web app).
    static let proteinBlue = Color(hex: "60a5fa")
    static let carbsYellow = Color(hex: "facc15")
    static let fatPink = Color(hex: "f472b6")
    static let kcalOrange = Color(hex: "f97316")
    static let premiumAmber = Color(hex: "fbbf24")
    static let premiumOrange = Color(hex: "f97316")
    static let coachPurple = Color(hex: "9333ea")
    static let gustitoPink = Color(hex: "ec4899")
    static let destructiveRed = Color(hex: "ef4444")
    static let infoBlue = Color(hex: "3b82f6")
}

struct ThemedBackground: ViewModifier {
    var dark: Bool
    func body(content: Content) -> some View {
        content.background(AppTheme.bgPrimary(dark: dark).ignoresSafeArea())
    }
}

extension View {
    func themedBackground(dark: Bool) -> some View {
        modifier(ThemedBackground(dark: dark))
    }

    /// Card style matching the app's flat, heavily-rounded card language.
    func cardStyle(dark: Bool) -> some View {
        self
            .padding(16)
            .background(AppTheme.bgSurface(dark: dark))
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(AppTheme.borderColor(dark: dark), lineWidth: 1)
            )
    }
}
