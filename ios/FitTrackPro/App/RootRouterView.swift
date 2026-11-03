import SwiftUI

/// Mirrors the routing decision tree in the web app's `App.jsx`:
/// no user -> Login · admin -> AdminPanel · role==coach -> CoachDashboard ·
/// !onboardingComplete -> OnboardingFlow · showPhotoStep -> OnboardingPhotos · else -> ClientDashboard.
struct RootRouterView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        Group {
            if let user = appState.currentUser {
                if user.admin {
                    AdminPanelView()
                } else if user.role == .coach {
                    CoachDashboardView()
                } else if !user.onboardingComplete {
                    OnboardingFlowView()
                } else if user.showPhotoStep {
                    OnboardingPhotosView()
                } else {
                    ClientDashboardView()
                }
            } else {
                LoginView()
            }
        }
        .animation(.easeInOut(duration: 0.25), value: appState.currentUser?.id)
        .animation(.easeInOut(duration: 0.25), value: appState.currentUser?.onboardingComplete)
        .animation(.easeInOut(duration: 0.25), value: appState.currentUser?.showPhotoStep)
    }
}
