import Foundation
import SwiftUI

/// Single source of truth for "who is logged in" + role-based routing, mirroring the
/// `onAuthStateChanged` + Firestore `onSnapshot(users/{uid})` pattern in the web app's `App.jsx`.
@MainActor
final class AppState: ObservableObject {
    @Published var currentUser: AppUser?
    @Published var isBusy: Bool = false
    @Published var errorMessage: String?

    let api: MockAPIService

    init(api: MockAPIService = MockAPIService()) {
        self.api = api
    }

    var isDarkMode: Bool { currentUser?.darkMode ?? false }

    func login(email: String, password: String) async {
        errorMessage = nil
        isBusy = true
        defer { isBusy = false }
        do {
            currentUser = try await api.login(email: email, password: password)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loginDemoCoach() async {
        errorMessage = nil
        isBusy = true
        defer { isBusy = false }
        do {
            currentUser = try await api.loginDemoCoach()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func register(email: String, password: String, name: String) async {
        errorMessage = nil
        isBusy = true
        defer { isBusy = false }
        do {
            currentUser = try await api.register(email: email, password: password, name: name)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func logout() {
        api.logout()
        currentUser = nil
    }

    func setCurrentUser(_ user: AppUser) {
        currentUser = user
    }

    func toggleDarkMode() {
        guard var user = currentUser else { return }
        user.darkMode.toggle()
        currentUser = user
    }
}
