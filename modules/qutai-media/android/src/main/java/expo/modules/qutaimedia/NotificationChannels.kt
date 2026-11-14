package expo.modules.qutaimedia

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build

/**
 * Notification channel setup shared by Qutai's foreground services (media playback here, the assistant's background
 * task in modules/qutai-agent). Each service keeps its own channel, notification id and state; only this helper is
 * shared.
 */
object NotificationChannels {
  /**
   * Creates the channel, or renames it when the app's language changed (Android keeps the user's own settings for an
   * existing channel, such as its importance; only the name and description are updated).
   */
  fun ensure(
    context: Context,
    id: String,
    name: String,
    importance: Int,
    lockscreenVisibility: Int = Notification.VISIBILITY_PUBLIC,
    showBadge: Boolean = false,
  ) {
    if (Build.VERSION.SDK_INT < 26) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(id)?.name == name) return
    manager.createNotificationChannel(
      NotificationChannel(id, name, importance).apply {
        setShowBadge(showBadge)
        this.lockscreenVisibility = lockscreenVisibility
      },
    )
  }
}
