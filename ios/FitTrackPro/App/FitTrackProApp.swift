import SwiftUI

@main
struct FitTrackProApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootRouterView()
                .environmentObject(appState)
                .preferredColorScheme(appState.isDarkMode ? .dark : .light)
                .tint(AppTheme.accent(dark: appState.isDarkMode))
        }
    }
}
