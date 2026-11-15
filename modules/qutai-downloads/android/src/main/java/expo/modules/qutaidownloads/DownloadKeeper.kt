package expo.modules.qutaidownloads

import android.app.Service
import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.core.content.ContextCompat

/**
 * Keeps the process running while downloads are active and the app is in the background.
 *
 * Android 14+ (API 34): one user-initiated data transfer job ([DownloadJobService]) runs while any download is active
 * and shows the ongoing notification ([JobService.setNotification]); it ends when nothing is left. It must be scheduled
 * while the app is visible, which it is when the user starts a download. Its network constraint means the system stops
 * it while offline and runs it again when a network is back. If scheduling is refused (for example "Resume" pressed in
 * the notification with the app in the background), the dataSync foreground service is used instead, which a
 * notification action may start.
 *
 * Android 8 to 13: the dataSync foreground service ([DownloadService]), which has no time limit on those versions.
 * (On Android 15+, where dataSync is limited to 6 hours a day, it only runs as the fallback above; its onTimeout
 * pauses the downloads.)
 */
object DownloadKeeper {
  private const val TAG = "QutaiDownloads"
  const val JOB_ID = 0x51B0
  private val main = Handler(Looper.getMainLooper())

  @Volatile private var job: DownloadJobService? = null
  @Volatile private var jobParams: JobParameters? = null
  @Volatile private var jobScheduled = false
  @Volatile private var service: DownloadService? = null
  @Volatile private var serviceStarting = false
  /** The system stopped the job (thermal, quota): wait for it to run the job again, or for the app to come back. */
  @Volatile private var systemStopped = false

  fun holdsNotification() = job != null || service != null

  fun update() {
    main.post { apply() }
  }

  private fun apply() {
    val ctx = DownloadEngine.appContext
    val work = DownloadEngine.activeCount() > 0
    if (!work) {
      job?.let { j -> jobParams?.let { j.jobFinished(it, false) } }
      job = null
      jobParams = null
      if (jobScheduled && Build.VERSION.SDK_INT >= 34) {
        ctx.getSystemService(JobScheduler::class.java)?.cancel(JOB_ID)
      }
      jobScheduled = false
      service?.finish()
      return
    }
    if (job != null || service != null || serviceStarting || systemStopped) return
    if (Build.VERSION.SDK_INT >= 34 && (jobScheduled || scheduleJob(ctx))) return
    startService(ctx)
  }

  @RequiresApi(34)
  private fun scheduleJob(ctx: Context): Boolean {
    val remaining = DownloadEngine.snapshot().filter { it.state in DlState.ACTIVE && it.total > 0 }
      .sumOf { it.total - it.received }.coerceAtLeast(0)
    return try {
      val info = JobInfo.Builder(JOB_ID, ComponentName(ctx, DownloadJobService::class.java))
        .setUserInitiated(true)
        .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
        .setEstimatedNetworkBytes(if (remaining > 0) remaining else JobInfo.NETWORK_BYTES_UNKNOWN.toLong(), 0L)
        .build()
      val ok = ctx.getSystemService(JobScheduler::class.java)?.schedule(info) == JobScheduler.RESULT_SUCCESS
      jobScheduled = ok
      ok
    } catch (e: Exception) {
      Log.w(TAG, "The download job couldn't be scheduled", e)
      false
    }
  }

  private fun startService(ctx: Context) {
    try {
      serviceStarting = true
      ContextCompat.startForegroundService(ctx, Intent(ctx, DownloadService::class.java))
    } catch (e: Exception) {
      // Not allowed from the background right now: downloads go on while the process lives.
      serviceStarting = false
      Log.w(TAG, "The download service couldn't start", e)
    }
  }

  /** The app came back on screen: anything the system held can run again. */
  fun foreground() {
    main.post {
      if (systemStopped) {
        systemStopped = false
        jobScheduled = false
        DownloadEngine.releaseHeld()
      }
      apply()
    }
  }

  @RequiresApi(34)
  internal fun jobStarted(service: DownloadJobService, params: JobParameters) {
    job = service
    jobParams = params
    jobScheduled = true
    systemStopped = false
    DownloadEngine.releaseHeld()
    update()
  }

  internal fun jobUnneeded() {
    jobScheduled = false
    update()
  }

  @RequiresApi(34)
  internal fun jobStopped(params: JobParameters): Boolean {
    job = null
    jobParams = null
    val reason = params.stopReason
    if (reason == JobParameters.STOP_REASON_USER) {
      jobScheduled = false
      return false
    }
    if (reason != JobParameters.STOP_REASON_CONSTRAINT_CONNECTIVITY && reason != JobParameters.STOP_REASON_CANCELLED_BY_APP) {
      systemStopped = true
      DownloadEngine.holdForSystem()
    }
    val again = DownloadEngine.activeCount() > 0 && reason != JobParameters.STOP_REASON_CANCELLED_BY_APP
    jobScheduled = again
    return again
  }

  internal fun serviceStarted(s: DownloadService) {
    service = s
    serviceStarting = false
    update()
  }

  internal fun serviceEnded(s: DownloadService) {
    if (service === s) service = null
    serviceStarting = false
  }
}

/** Android 14+: the user-initiated data transfer job that keeps downloads going in the background. */
@RequiresApi(34)
class DownloadJobService : JobService() {
  override fun onStartJob(params: JobParameters): Boolean {
    DownloadEngine.init(this)
    val notification = DownloadNotifications.ongoing(this) ?: run {
      // Nothing to do any more (the downloads ended before the job ran).
      DownloadKeeper.jobUnneeded()
      return false
    }
    setNotification(params, DownloadNotifications.ONGOING_ID, notification, JOB_END_NOTIFICATION_POLICY_REMOVE)
    DownloadKeeper.jobStarted(this, params)
    return true
  }

  override fun onStopJob(params: JobParameters): Boolean = DownloadKeeper.jobStopped(params)
}

/** The dataSync foreground service: Android 8 to 13, and the fallback on Android 14+. */
class DownloadService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    DownloadEngine.init(this)
    val notification = DownloadNotifications.ongoing(this)
    if (notification == null) {
      // Started, but the downloads ended meanwhile: startForeground is still required before stopping.
      startForegroundCompat(placeholder())
      finish()
      return START_NOT_STICKY
    }
    startForegroundCompat(notification)
    DownloadKeeper.serviceStarted(this)
    return START_NOT_STICKY
  }

  private fun placeholder() = androidx.core.app.NotificationCompat.Builder(this, DownloadNotifications.CHANNEL)
    .setSmallIcon(android.R.drawable.stat_sys_download_done)
    .setSilent(true)
    .build()

  private fun startForegroundCompat(n: android.app.Notification) {
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(DownloadNotifications.ONGOING_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      startForeground(DownloadNotifications.ONGOING_ID, n)
    }
  }

  /** Android 15+: dataSync's daily limit was reached. Downloads pause (resumable) and the service stops. */
  override fun onTimeout(startId: Int, fgsType: Int) {
    DownloadEngine.pauseAll()
    finish()
  }

  fun finish() {
    DownloadKeeper.serviceEnded(this)
    if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE) else @Suppress("DEPRECATION") stopForeground(true)
    stopSelf()
  }

  override fun onDestroy() {
    DownloadKeeper.serviceEnded(this)
    super.onDestroy()
  }
}

/** Pause / Resume / Cancel from the notifications. */
class DownloadActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    DownloadEngine.init(context)
    when (intent.action) {
      PAUSE -> DownloadEngine.pauseAll()
      RESUME -> DownloadEngine.resumeAll()
      CANCEL -> DownloadEngine.cancelActive()
    }
  }

  companion object {
    const val PAUSE = "expo.modules.qutaidownloads.PAUSE"
    const val RESUME = "expo.modules.qutaidownloads.RESUME"
    const val CANCEL = "expo.modules.qutaidownloads.CANCEL"
  }
}
