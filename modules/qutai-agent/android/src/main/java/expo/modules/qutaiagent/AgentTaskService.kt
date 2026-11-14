package expo.modules.qutaiagent

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.drawable.Icon
import android.os.Build
import android.os.IBinder
import expo.modules.qutaimedia.NotificationChannels

/**
 * The specialUse foreground service of an assistant task that goes on while Qutai is in the background. It does no
 * work itself: it keeps the process at foreground priority and shows the ongoing notification ("Qutai is working
 * on: …", the current step, Stop and Open). Started and stopped by [AgentHub] only, never while no task runs.
 *
 * Separate from the media playback service (modules/qutai-media): its own type, channel and notification id, so
 * both can run at once.
 */
class AgentTaskService : Service() {
  companion object {
    private const val ACTION_STOP = "expo.modules.qutaiagent.action.STOP"
  }

  private var finished = false

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    finished = false
    // Started with startForegroundService: it must go to the foreground right away, whatever happens next.
    goForeground()
    if (intent?.action == ACTION_STOP) {
      AgentHub.userStop()
      finish()
      return START_NOT_STICKY
    }
    if (AgentHub.state != AgentHub.State.RUNNING) {
      // The task ended or paused (or the user came back) before the service started.
      finish()
      return START_NOT_STICKY
    }
    AgentHub.serviceAttached(this)
    return START_NOT_STICKY
  }

  /** Android 15+: the time limit of a foreground service type was reached (not expected for specialUse). */
  override fun onTimeout(startId: Int, fgsType: Int) {
    AgentHub.systemTimeout()
    finish()
  }

  /** Qutai was swiped away in recents: the task ends with the app. */
  override fun onTaskRemoved(rootIntent: Intent?) {
    AgentHub.userStop()
    finish()
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    AgentHub.serviceAttached(null)
    super.onDestroy()
  }

  fun finish() {
    if (finished) return
    finished = true
    AgentHub.serviceAttached(null)
    if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE) else @Suppress("DEPRECATION") stopForeground(true)
    stopSelf()
  }

  /** Shows the current title and step. */
  fun refresh() {
    if (finished) return
    try {
      getSystemService(NotificationManager::class.java)?.notify(AgentHub.ONGOING_ID, build())
    } catch (e: SecurityException) {
      // Notifications not allowed: the service still runs (Android lists it in the task manager).
    }
  }

  private fun goForeground() {
    val notification = build()
    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(AgentHub.ONGOING_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(AgentHub.ONGOING_ID, notification)
    }
  }

  private fun build(): Notification {
    val labels = AgentHub.labelsOrDefault(this)
    // Private on the lock screen: the task title comes from the user's message.
    NotificationChannels.ensure(
      this, AgentHub.CHANNEL_ID, labels.channel, NotificationManager.IMPORTANCE_LOW, Notification.VISIBILITY_PRIVATE,
    )
    val title = AgentHub.title
    val heading = if (title.isNullOrBlank()) labels.workingPublic else formatWorking(labels.working, title)
    val public = newBuilder()
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle(labels.workingPublic)
      .build()
    val open = AgentHub.openAppIntent(this)
    val stop = PendingIntent.getService(
      this, 1, Intent(this, AgentTaskService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val builder = newBuilder()
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle(heading)
      .setContentText(AgentHub.step)
      .setContentIntent(open)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .setCategory(Notification.CATEGORY_PROGRESS)
      .setVisibility(Notification.VISIBILITY_PRIVATE)
      .setPublicVersion(public)
      .setProgress(0, 0, true)
      .addAction(Notification.Action.Builder(Icon.createWithResource(this, android.R.drawable.ic_menu_close_clear_cancel), labels.stop, stop).build())
    if (open != null) {
      builder.addAction(Notification.Action.Builder(Icon.createWithResource(this, android.R.drawable.ic_menu_view), labels.open, open).build())
    }
    // Android 12+ may hold back a new foreground service notification for up to 10 s; this one should show at once.
    if (Build.VERSION.SDK_INT >= 31) builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
    return builder.build()
  }

  private fun newBuilder(): Notification.Builder =
    if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, AgentHub.CHANNEL_ID) else
      @Suppress("DEPRECATION") Notification.Builder(this)

  private fun formatWorking(template: String, title: String): String =
    if (template.contains("%1\$s")) template.replace("%1\$s", title) else "$template $title"
}
