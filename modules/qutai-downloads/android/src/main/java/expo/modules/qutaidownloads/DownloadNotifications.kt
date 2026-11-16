package expo.modules.qutaidownloads

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.SystemClock
import android.text.format.Formatter
import androidx.core.app.NotificationCompat
import expo.modules.qutaimedia.NotificationChannels
import java.util.Locale

/**
 * The downloads' notifications: one ongoing notification summarising the active downloads (name, progress, speed or
 * time left; Pause / Resume and Cancel; a tap opens the Downloads screen), which the background job or service shows
 * while it runs; a dismissible "paused" one when only paused downloads are left; and one per finished file (a tap
 * opens it), grouped when several are shown. Texts come from this module's resources in the app's language.
 */
object DownloadNotifications {
  const val CHANNEL = "qutai_downloads"
  const val DONE_CHANNEL = "qutai_downloads_done"
  const val ONGOING_ID = 0x51B0
  private const val PAUSED_ID = 0x51B2
  private const val GROUP_SUMMARY_ID = 0x51B1
  private const val GROUP = "qutai.downloads.done"
  const val EXTRA_OPEN = "qutai.openDownloads"
  /** The id of a finished download the app should open (a tap on its notification when no app resolved it). */
  const val EXTRA_OPEN_FILE = "qutai.openDownloadFile"
  private const val PREFS = "qutai_downloads"
  private const val MIN_UPDATE_MS = 800L

  private var lastUpdate = 0L
  private var updatePending = false
  private val shownDone = LinkedHashSet<String>()

  fun setLanguage(context: Context, language: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("language", language).apply()
  }

  /** The module's strings in the app's own language (not necessarily the phone's). */
  private fun res(context: Context): Context {
    val language = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("language", null) ?: return context
    val config = Configuration(context.resources.configuration)
    config.setLocale(Locale.forLanguageTag(language))
    return context.createConfigurationContext(config)
  }

  private fun channels(context: Context) {
    val r = res(context)
    NotificationChannels.ensure(context, CHANNEL, r.getString(R.string.qutai_dl_channel), NotificationManager.IMPORTANCE_LOW)
    NotificationChannels.ensure(
      context, DONE_CHANNEL, r.getString(R.string.qutai_dl_done_channel), NotificationManager.IMPORTANCE_DEFAULT,
      lockscreenVisibility = Notification.VISIBILITY_PRIVATE,
    )
  }

  private fun manager(context: Context) = context.getSystemService(NotificationManager::class.java)

  /** Opens the app at the Downloads screen. */
  private fun openDownloads(context: Context, request: Int): PendingIntent? {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    launch.putExtra(EXTRA_OPEN, true)
    launch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, request, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun action(context: Context, action: String): PendingIntent =
    PendingIntent.getBroadcast(
      context, action.hashCode(),
      Intent(context, DownloadActionReceiver::class.java).setAction(action).setPackage(context.packageName),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  private fun size(context: Context, bytes: Long) = Formatter.formatShortFileSize(context, bytes)

  /** The ongoing summary, or null when nothing is active. */
  fun ongoing(context: Context): Notification? {
    channels(context)
    val r = res(context)
    val all = DownloadEngine.snapshot()
    val active = all.filter { it.state in DlState.ACTIVE }
    if (active.isEmpty()) return null
    val running = active.filter { it.state == DlState.DOWNLOADING }
    val known = active.all { it.total > 0 }
    val received = active.sumOf { it.received }
    val total = active.sumOf { maxOf(it.total, 0) }
    val percent = if (known && total > 0) ((received * 100) / total).toInt().coerceIn(0, 100) else -1
    val speed = running.sumOf { it.speed }
    val title = if (active.size == 1) active[0].name else r.getString(R.string.qutai_dl_downloading_many, active.size)
    val parts = mutableListOf<String>()
    when {
      running.isEmpty() && active.any { it.state == DlState.WAITING } -> parts += r.getString(R.string.qutai_dl_waiting)
      received == 0L -> parts += r.getString(R.string.qutai_dl_starting)
      else -> {
        if (percent >= 0) parts += "$percent%"
        parts += if (known) r.getString(R.string.qutai_dl_of, size(context, received), size(context, total)) else size(context, received)
        if (speed > 0) {
          if (known && total > received) {
            val secs = ((total - received) / speed).toLong()
            parts += if (secs >= 60) r.getString(R.string.qutai_dl_left_min, ((secs + 59) / 60).toInt())
            else r.getString(R.string.qutai_dl_left_sec, secs.toInt().coerceAtLeast(1))
          } else {
            parts += r.getString(R.string.qutai_dl_speed, size(context, speed.toLong()))
          }
        }
      }
    }
    val queued = active.count { it.state == DlState.QUEUED }
    if (queued > 0 && running.isNotEmpty()) parts += r.getString(R.string.qutai_dl_queued, queued)
    val pausable = active.any { it.resumable }
    return NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(android.R.drawable.stat_sys_download)
      .setContentTitle(title)
      .setContentText(parts.joinToString(" · "))
      .setProgress(100, maxOf(percent, 0), percent < 0)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setShowWhen(false)
      .setCategory(NotificationCompat.CATEGORY_PROGRESS)
      .setVisibility(if (active.any { it.incognito }) NotificationCompat.VISIBILITY_PRIVATE else NotificationCompat.VISIBILITY_PUBLIC)
      .setContentIntent(openDownloads(context, ONGOING_ID))
      .apply {
        if (pausable) addAction(0, r.getString(R.string.qutai_dl_pause), action(context, DownloadActionReceiver.PAUSE))
        addAction(0, r.getString(R.string.qutai_dl_cancel), action(context, DownloadActionReceiver.CANCEL))
      }
      .build()
  }

  /** Called after every change (throttled): refreshes the ongoing or paused notification. */
  fun updateOngoing(context: Context) {
    val now = SystemClock.elapsedRealtime()
    if (now - lastUpdate < MIN_UPDATE_MS) {
      if (!updatePending) {
        updatePending = true
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
          updatePending = false
          updateOngoing(context)
        }, MIN_UPDATE_MS)
      }
      return
    }
    lastUpdate = now
    val nm = manager(context) ?: return
    val ongoing = ongoing(context)
    if (ongoing != null) {
      nm.cancel(PAUSED_ID)
      // While the background job or service runs, this is its notification; otherwise a plain one.
      try {
        nm.notify(ONGOING_ID, ongoing)
      } catch (_: SecurityException) {
      }
      return
    }
    if (!DownloadKeeper.holdsNotification()) nm.cancel(ONGOING_ID)
    val paused = DownloadEngine.snapshot().filter { it.state == DlState.PAUSED }
    if (paused.isEmpty()) {
      nm.cancel(PAUSED_ID)
      return
    }
    val r = res(context)
    val n = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(android.R.drawable.stat_sys_download_done)
      .setContentTitle(if (paused.size == 1) paused[0].name else r.getString(R.string.qutai_dl_paused_many, paused.size))
      .setContentText(r.getString(R.string.qutai_dl_paused))
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setShowWhen(false)
      .setVisibility(if (paused.any { it.incognito }) NotificationCompat.VISIBILITY_PRIVATE else NotificationCompat.VISIBILITY_PUBLIC)
      .setContentIntent(openDownloads(context, PAUSED_ID))
      .addAction(0, r.getString(R.string.qutai_dl_resume), action(context, DownloadActionReceiver.RESUME))
      .addAction(0, r.getString(R.string.qutai_dl_cancel), action(context, DownloadActionReceiver.CANCEL))
      .build()
    try {
      nm.notify(PAUSED_ID, n)
    } catch (_: SecurityException) {
    }
  }

  private fun idFor(rec: DownloadRecord) = 0x52000 + (rec.id.hashCode() and 0xFFFF)

  /**
   * Opens the app, which opens this file through the Downloads screen's "Open" (its messages: no app for this type,
   * file gone, no access).
   */
  private fun openFileInApp(context: Context, rec: DownloadRecord): PendingIntent? {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    launch.putExtra(EXTRA_OPEN_FILE, rec.id)
    launch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, idFor(rec), launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  fun finished(context: Context, rec: DownloadRecord) {
    channels(context)
    val r = res(context)
    // A tap opens the file directly when some app on the phone opens it (an APK: the system's installer, which asks
    // "allow from this source" itself); otherwise the tap goes through Qutai, which says why it can't, instead of a
    // tap that silently does nothing. The <queries> entry of plugins/withDownloads.js makes the viewers visible here.
    val open = rec.uri?.let { uri ->
      val view = Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse(uri), rec.mime)
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      if (view.resolveActivity(context.packageManager) == null) return@let openFileInApp(context, rec)
      PendingIntent.getActivity(context, idFor(rec), view, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    } ?: openDownloads(context, idFor(rec))
    post(context, rec, NotificationCompat.Builder(context, DONE_CHANNEL)
      .setSmallIcon(android.R.drawable.stat_sys_download_done)
      .setContentTitle(rec.name)
      .setContentText("${r.getString(R.string.qutai_dl_done)} · ${size(context, rec.received)}")
      .setContentIntent(open)
      .setPublicVersion(publicVersion(context, r.getString(R.string.qutai_dl_done)))
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .setAutoCancel(true)
      .setGroup(GROUP)
      .build())
  }

  fun failed(context: Context, rec: DownloadRecord) {
    channels(context)
    val r = res(context)
    post(context, rec, NotificationCompat.Builder(context, DONE_CHANNEL)
      .setSmallIcon(android.R.drawable.stat_notify_error)
      .setContentTitle(rec.name)
      .setContentText(r.getString(R.string.qutai_dl_failed))
      .setContentIntent(openDownloads(context, idFor(rec)))
      .setPublicVersion(publicVersion(context, r.getString(R.string.qutai_dl_failed)))
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .setAutoCancel(true)
      .setGroup(GROUP)
      .build())
  }

  private fun publicVersion(context: Context, text: String) = NotificationCompat.Builder(context, DONE_CHANNEL)
    .setSmallIcon(android.R.drawable.stat_sys_download_done)
    .setContentTitle(text)
    .build()

  private fun post(context: Context, rec: DownloadRecord, n: Notification) {
    val nm = manager(context) ?: return
    try {
      nm.notify(idFor(rec), n)
      synchronized(shownDone) { shownDone += rec.id }
      if (synchronized(shownDone) { shownDone.size } >= 2) {
        val r = res(context)
        val count = synchronized(shownDone) { shownDone.size }
        nm.notify(GROUP_SUMMARY_ID, NotificationCompat.Builder(context, DONE_CHANNEL)
          .setSmallIcon(android.R.drawable.stat_sys_download_done)
          .setContentTitle(r.getString(R.string.qutai_dl_done_many, count))
          .setContentIntent(openDownloads(context, GROUP_SUMMARY_ID))
          .setGroup(GROUP)
          .setGroupSummary(true)
          .setAutoCancel(true)
          .build())
      }
    } catch (_: SecurityException) {
      // No notification permission: the in-app list is the only display.
    }
  }

  fun dismiss(context: Context, rec: DownloadRecord) {
    synchronized(shownDone) { shownDone -= rec.id }
    manager(context)?.cancel(idFor(rec))
  }

  /** The app opened the Downloads screen: the "finished" notifications have been seen. */
  fun clearFinished(context: Context) {
    val nm = manager(context) ?: return
    val ids = synchronized(shownDone) { shownDone.toList().also { shownDone.clear() } }
    DownloadEngine.snapshot().filter { it.id in ids }.forEach { nm.cancel(idFor(it)) }
    nm.cancel(GROUP_SUMMARY_ID)
  }
}
