package expo.modules.qutaiagent

import android.app.Activity
import android.app.Application
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.core.content.ContextCompat
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import com.reactnativecommunity.webview.RNCWebView
import expo.modules.kotlin.Promise
import expo.modules.qutaimedia.NotificationChannels

/**
 * Lets an assistant task that is already running go on while Qutai is in the background (Android, opt-in).
 *
 * React Native pauses itself with the activity: JS timers stop (JavaTimerManager), view commands such as the
 * WebView's injectJavaScript and every prop change wait for the next frame of the paused UI manager. So while the
 * user is away:
 * - the specialUse foreground service ([AgentTaskService]) keeps the process at foreground priority, with an ongoing
 *   notification (task title, current step, Stop and Open);
 * - a headless JS task (no work of its own, see src/device/backgroundTask.ts) makes JavaTimerManager keep firing
 *   timers, so the task's waits and timeouts work; networking and module promises never needed the activity;
 * - page commands go through [evaluate] here, straight to the tab's WebView on the main thread, instead of the
 *   paused view-command path; replies are read back from the page by polling, not through WebView events;
 * - a partial wake lock (renewed while the task makes progress, released as soon as it pauses or ends) lets it go
 *   on with the screen off.
 *
 * The service is started only at the moment the activity leaves the foreground (Android allows a foreground service
 * start while the app is still visible) and only while JS has said a task is running and may continue
 * ([setTask]); it stops when the user returns (the task simply goes on in the app), when the task ends, when the
 * task pauses for the user, when it stalls, and after [LIMIT_MS] in the background.
 */
object AgentHub {
  private const val TAG = "QutaiAgent"
  const val KEEP_ALIVE_TASK = "QutaiAgentKeepAlive"
  const val ONGOING_ID = 0x51A2
  const val ALERT_ID = 0x51A3
  const val CHANNEL_ID = "qutai_agent_task"
  const val ALERT_CHANNEL_ID = "qutai_agent_alerts"
  const val EXTRA_OPEN = "expo.modules.qutaiagent.OPEN_TASK"

  /** No step, page reply or provider answer for this long: the task is stuck, so it pauses instead of spinning. */
  private const val STALL_MS = 4 * 60_000L
  /** At most this long in the background in one go (the specialUse type has no system limit; this is Qutai's). */
  private const val LIMIT_MS = 30 * 60_000L
  /** The wake lock times out on its own unless progress renews it. */
  private const val WAKE_MS = 5 * 60_000L
  private const val WATCHDOG_MS = 15_000L
  /** Page commands that time out in a row before the page counts as stalled. */
  private const val MAX_PAGE_TIMEOUTS = 2
  /** The notification's step text changes at most this often. */
  private const val STEP_MIN_MS = 2_000L

  enum class State { IDLE, RUNNING, PAUSED }

  data class Labels(
    val channel: String,
    val alertsChannel: String,
    val working: String,
    val workingPublic: String,
    val stop: String,
    val open: String,
    val publicAlert: String,
    val paused: String,
    val stalled: String,
    val timeLimit: String,
  )

  private val main = Handler(Looper.getMainLooper())
  private var context: Context? = null
  private var emit: ((String, Map<String, Any?>) -> Unit)? = null
  var labels: Labels? = null
    private set

  /** The running task's title (from the user's own message), or null: no task, or one that must not continue. */
  @Volatile var title: String? = null
    private set
  var step: String = ""
    private set
  // Read from the JS thread (isActive), written on the main thread.
  @Volatile var state = State.IDLE
    private set
  @Volatile private var foreground = true
  private var service: AgentTaskService? = null
  private var runningSince = 0L
  private var lastProgress = 0L
  private var pageTimeouts = 0
  private var headlessTaskId = -1
  private var wakeLock: PowerManager.WakeLock? = null
  private var lastStepAt = 0L

  fun init(appContext: Context, emitter: (String, Map<String, Any?>) -> Unit) {
    context = appContext.applicationContext
    emit = emitter
  }

  fun configure(newLabels: Labels) {
    labels = newLabels
    service?.refresh()
  }

  fun labelsOrDefault(ctx: Context): Labels = labels ?: Labels(
    channel = ctx.getString(R.string.qutai_agent_channel),
    alertsChannel = ctx.getString(R.string.qutai_agent_alerts_channel),
    working = ctx.getString(R.string.qutai_agent_working),
    workingPublic = ctx.getString(R.string.qutai_agent_working_public),
    stop = ctx.getString(R.string.qutai_agent_stop),
    open = ctx.getString(R.string.qutai_agent_open),
    publicAlert = ctx.getString(R.string.qutai_agent_public_alert),
    paused = ctx.getString(R.string.qutai_agent_paused),
    stalled = ctx.getString(R.string.qutai_agent_stalled),
    timeLimit = ctx.getString(R.string.qutai_agent_time_limit),
  )

  /** Main thread. A task started (title) or ended / may no longer continue in the background (null). */
  fun setTask(newTitle: String?) {
    title = newTitle?.take(80)
    step = ""
    if (newTitle == null) {
      stopService()
      state = State.IDLE
    }
  }

  /** Main thread. The step shown in the ongoing notification, updated at a modest rate. */
  fun setStep(text: String) {
    step = text.take(120)
    progress()
    val wait = lastStepAt + STEP_MIN_MS - SystemClock.elapsedRealtime()
    main.removeCallbacks(refreshStep)
    if (wait <= 0) refreshStep.run() else main.postDelayed(refreshStep, wait)
  }

  private val refreshStep = Runnable {
    lastStepAt = SystemClock.elapsedRealtime()
    service?.refresh()
  }

  /** The task moved on (a step, a page reply, a provider answer): not stalled; keeps the wake lock. */
  fun progress() {
    lastProgress = SystemClock.elapsedRealtime()
    if (state == State.RUNNING) wakeLock?.acquire(WAKE_MS)
  }

  /** The task may go on right now although the app is not in the foreground. */
  val active: Boolean get() = state == State.RUNNING && !foreground

  fun setForeground(value: Boolean) {
    foreground = value
    if (value) {
      // Back in the app: the task simply goes on there (or shows what it waits for).
      val was = state
      stopService()
      state = State.IDLE
      cancelAlert()
      if (was != State.IDLE) emitState(null)
    } else if (title != null && state == State.IDLE) {
      startService()
    }
  }

  /**
   * The task needs the user (a confirmation, a tool that only works on screen) or cannot go on: stops the service
   * and says what is needed in a notification. JS waits for the app to come back.
   */
  fun pause(alertTitle: String, alertText: String, reason: String) {
    if (foreground) return
    val wasRunning = state == State.RUNNING
    stopService()
    state = State.PAUSED
    if (title != null) postAlert(alertTitle, alertText)
    if (wasRunning) emitState(reason)
  }

  /** The task ended while the app is in the background: one line about the result (null: none). */
  fun finish(alertTitle: String?, alertText: String?) {
    val notify = !foreground && alertTitle != null && title != null
    setTask(null)
    if (notify) postAlert(alertTitle!!, alertText ?: "")
  }

  /** The Stop button of the notification. */
  fun userStop() {
    setTask(null)
    emit?.invoke("onStopRequested", emptyMap())
  }

  /** Android's time limit for the service type ([AgentTaskService.onTimeout]). */
  fun systemTimeout() {
    val l = context?.let { labelsOrDefault(it) } ?: return
    pause(l.paused, l.timeLimit, "timeLimit")
  }

  fun serviceAttached(running: AgentTaskService?) {
    service = running
  }

  private fun emitState(reason: String?) {
    emit?.invoke("onStateChange", mapOf("state" to state.name.lowercase(), "reason" to reason))
  }

  // Service, headless task and wake lock

  private fun startService() {
    val ctx = context ?: return
    try {
      ContextCompat.startForegroundService(ctx, Intent(ctx, AgentTaskService::class.java))
    } catch (e: Exception) {
      // Not allowed right now (e.g. Android refuses a start from the background): the task pauses as without the
      // setting.
      Log.w(TAG, "Could not start the assistant task service", e)
      return
    }
    state = State.RUNNING
    runningSince = SystemClock.elapsedRealtime()
    lastProgress = runningSince
    pageTimeouts = 0
    startHeadlessTask(ctx)
    acquireWakeLock(ctx)
    main.removeCallbacks(watchdog)
    main.postDelayed(watchdog, WATCHDOG_MS)
    emitState(null)
  }

  private fun stopService() {
    main.removeCallbacks(watchdog)
    main.removeCallbacks(refreshStep)
    finishHeadlessTask()
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    // A service that was requested but has not started yet finishes itself as soon as it starts (it must call
    // startForeground first), see AgentTaskService.onStartCommand.
    service?.finish()
    service = null
  }

  private val watchdog = object : Runnable {
    override fun run() {
      if (state != State.RUNNING) return
      val ctx = context ?: return
      val now = SystemClock.elapsedRealtime()
      val l = labelsOrDefault(ctx)
      when {
        now - lastProgress > STALL_MS -> pause(l.paused, l.stalled, "stalled")
        now - runningSince > LIMIT_MS -> pause(l.paused, l.timeLimit, "timeLimit")
        else -> main.postDelayed(this, WATCHDOG_MS)
      }
    }
  }

  private fun reactContext(ctx: Context): ReactContext? {
    val app = ctx.applicationContext as? Application ?: return null
    val reactApp = app as? ReactApplication ?: return null
    // New architecture (bridgeless): the ReactHost's context is the one JavaTimerManager listens on.
    return try {
      reactApp.reactHost?.currentReactContext
    } catch (e: Exception) {
      null
    }
  }

  /**
   * A headless JS task makes JavaTimerManager keep posting its frame callback while the activity is paused, so
   * setTimeout keeps working. Started without HeadlessJsTaskService, whose wake lock never times out.
   */
  private fun startHeadlessTask(ctx: Context) {
    if (headlessTaskId != -1) return
    val react = reactContext(ctx) ?: return
    try {
      val config = HeadlessJsTaskConfig(KEEP_ALIVE_TASK, Arguments.createMap(), 0, true)
      headlessTaskId = HeadlessJsTaskContext.getInstance(react).startTask(config)
    } catch (e: Exception) {
      Log.w(TAG, "Could not start the keep-alive JS task", e)
      headlessTaskId = -1
    }
  }

  private fun finishHeadlessTask() {
    val id = headlessTaskId
    headlessTaskId = -1
    if (id == -1) return
    val react = context?.let { reactContext(it) } ?: return
    val tasks = HeadlessJsTaskContext.getInstance(react)
    if (tasks.isTaskRunning(id)) tasks.finishTask(id)
  }

  private fun acquireWakeLock(ctx: Context) {
    if (wakeLock?.isHeld == true) return
    val power = ctx.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
    wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Qutai:assistantTask").apply {
      setReferenceCounted(false)
      acquire(WAKE_MS)
    }
  }

  // Notifications

  fun openAppIntent(ctx: Context): PendingIntent? {
    val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: return null
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
    launch.putExtra(EXTRA_OPEN, true)
    return PendingIntent.getActivity(
      ctx, ONGOING_ID, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
  }

  private fun postAlert(alertTitle: String, alertText: String) {
    val ctx = context ?: return
    val l = labelsOrDefault(ctx)
    NotificationChannels.ensure(
      ctx, ALERT_CHANNEL_ID, l.alertsChannel, NotificationManager.IMPORTANCE_HIGH, Notification.VISIBILITY_PRIVATE,
    )
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, ALERT_CHANNEL_ID) else
      @Suppress("DEPRECATION") Notification.Builder(ctx)
    // On the lock screen only a generic line; the task and its result show once the phone is unlocked.
    val public = (if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, ALERT_CHANNEL_ID) else
      @Suppress("DEPRECATION") Notification.Builder(ctx))
      .setSmallIcon(ctx.applicationInfo.icon)
      .setContentTitle(l.publicAlert)
      .build()
    val notification = builder
      .setSmallIcon(ctx.applicationInfo.icon)
      .setContentTitle(alertTitle)
      .setContentText(alertText)
      .setStyle(Notification.BigTextStyle().bigText(alertText))
      .setContentIntent(openAppIntent(ctx))
      .setAutoCancel(true)
      .setCategory(Notification.CATEGORY_STATUS)
      .setVisibility(Notification.VISIBILITY_PRIVATE)
      .setPublicVersion(public)
      .build()
    try {
      ctx.getSystemService(NotificationManager::class.java)?.notify(ALERT_ID, notification)
    } catch (e: SecurityException) {
      // Notifications not allowed: the conversation still shows why the task paused.
    }
  }

  private fun cancelAlert() {
    context?.getSystemService(NotificationManager::class.java)?.cancel(ALERT_ID)
  }

  // Page commands (main thread)

  /** The tab's WebView, found by the key the app gives each tab's WebView (the patched mediaPlayback prop). */
  private fun findWebView(activity: Activity?, key: String): RNCWebView? {
    val root = activity?.window?.decorView ?: return null
    return find(root, key)
  }

  private fun find(view: View, key: String): RNCWebView? {
    if (view is RNCWebView) return if (view.mediaPlaybackKey == key) view else null
    if (view is ViewGroup) {
      for (i in 0 until view.childCount) find(view.getChildAt(i), key)?.let { return it }
    }
    return null
  }

  /**
   * Runs `script` in the tab's page. With `poll`, then evaluates `poll` every ~120 ms until it returns something
   * other than null, and resolves with that (the WebView's JSON encoding of the value); rejects after `timeoutMs`.
   * Works while the activity is paused (evaluateJavascript goes straight to the WebView).
   */
  fun evaluate(activity: Activity?, key: String, script: String, poll: String?, timeoutMs: Int, promise: Promise) {
    val view = findWebView(activity, key)
    if (view == null) {
      promise.reject("ERR_NO_WEBVIEW", "The tab's page is not available in the background.", null)
      return
    }
    view.evaluateJavascript(script, null)
    if (poll == null) {
      progress()
      promise.resolve(null)
      return
    }
    var settled = false
    val timeout = Runnable {
      if (settled) return@Runnable
      settled = true
      promise.reject("ERR_TIMEOUT", "The page did not respond (it may still be loading).", null)
      pageTimedOut()
    }
    main.postDelayed(timeout, timeoutMs.toLong().coerceIn(500, 120_000))
    val tick = object : Runnable {
      override fun run() {
        if (settled) return
        view.evaluateJavascript(poll) { raw ->
          if (settled) return@evaluateJavascript
          if (raw != null && raw != "null") {
            settled = true
            main.removeCallbacks(timeout)
            pageTimeouts = 0
            progress()
            promise.resolve(raw)
          } else {
            main.postDelayed(this, 120)
          }
        }
      }
    }
    main.postDelayed(tick, 30)
  }

  private fun pageTimedOut() {
    if (state != State.RUNNING) return
    pageTimeouts++
    if (pageTimeouts >= MAX_PAGE_TIMEOUTS) {
      val ctx = context ?: return
      val l = labelsOrDefault(ctx)
      pause(l.paused, l.stalled, "stalled")
    }
  }

  fun pageState(activity: Activity?, key: String): Map<String, Any?>? {
    val view: WebView = findWebView(activity, key) ?: return null
    return mapOf(
      "url" to (view.url ?: ""),
      "title" to (view.title ?: ""),
      "progress" to view.progress,
      "canGoBack" to view.canGoBack(),
      "canGoForward" to view.canGoForward(),
    )
  }

  fun goBack(activity: Activity?, key: String): Boolean {
    val view = findWebView(activity, key) ?: return false
    if (!view.canGoBack()) return false
    view.goBack()
    progress()
    return true
  }
}
