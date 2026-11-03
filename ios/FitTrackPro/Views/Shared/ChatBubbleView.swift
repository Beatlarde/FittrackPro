import SwiftUI

/// Matches `components/shared/ChatBubble.jsx`.
struct ChatBubbleView: View {
    var message: AppChatMessage
    var dark: Bool

    var body: some View {
        HStack {
            if message.isFromCoach { bubble.padding(.trailing, 60); Spacer(minLength: 0) }
            else { Spacer(minLength: 0); bubble.padding(.leading, 60) }
        }
    }

    private var bubble: some View {
        VStack(alignment: message.isFromCoach ? .leading : .trailing, spacing: 4) {
            if message.isFromCoach, let coachName = message.coachName {
                Text(coachName)
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(AppTheme.coachPurple)
            }
            Text(message.text)
                .font(.system(size: 14, weight: .medium))
                .padding(12)
                .foregroundStyle(message.isFromCoach ? AppTheme.textPrimary(dark: dark) : .white)
                .background(message.isFromCoach ? AppTheme.bgSurface2(dark: dark) : AppTheme.accent(dark: dark))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
    }
}
