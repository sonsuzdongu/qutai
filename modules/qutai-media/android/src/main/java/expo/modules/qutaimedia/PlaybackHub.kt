package expo.modules.qutaimedia

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.webkit.WebView
import androidx.core.content.ContextCompat
import com.reactnativecommunity.webview.RNCWebViewPlayback
import org.json.JSONObject
import java.lang.ref.WeakReference

/** What one page's playback script last reported (see src/browser/playback.ts). */
class PageState(view: WebView, val isPrivate: Boolean) {
  val view = WeakReference(view)
  var audible = false
  var playing = false
  var paused = true
  var title = ""
  var artist = ""
  var album = ""
  var artwork = ""
  var host = ""
  var actions: Set<String> = emptySet()
  var duration = 0.0
  var position = 0.0
  var rate = 1.0
  var videoWidth = 0
  var videoHeight = 0
  /** elapsedRealtime of the last report and of the moment the page became audible. */
  var reportedAt = 0L
  var audibleSince = 0L
}

/**
 * Background playback for media in web pages (Android): knows every tab's playback state, picks the tab that owns
 * the media controls (the one that most recently started playing sound), and runs the mediaPlayback foreground
 * service while that tab plays. Everything runs on the main thread, fed by the patched WebView
 * (RNCWebViewPlayback), so it works while React Native is paused in the background.
 *
 * Not spoofable into running forever: a page counts as playing only from the app's own script (nonce-keyed
 * messages), only while an element is playing unmuted and its time advances, and only while reports keep coming
 * (every 5 s); after 15 s without one the page is silent. When nothing is audible the service shows the paused
 * state for [PAUSED_GRACE_MS] (so play from the lock screen or headphones still works), then stops.
 */
object PlaybackHub : RNCWebViewPlayback.Listener {
  private const val TAG = "QutaiMedia"
  private const val STALE_MS = 15_000L
  private const val PAUSED_GRACE_MS = 120_000L
  private const val WATCHDOG_MS = 5_000L

  private val main = Handler(Looper.getMainLooper())
  private val pages = ArrayList<PageState>()
  private var context: Context? = null

  /** Settings from the app (configure()). */
  var backgroundPlayback = true
    private set
  var labels = Labels()
    private set

  /** The page whose media the notification and media session control. */
  var owner: PageState? = null
    private set
  /** The app's activity is in the foreground (resumed). */
  var foreground = true
    private set
  private var silentSince = 0L
  private var service: MediaPlaybackService? = null
  private var serviceRequested = false
  /** When Android last refused to start the service (from the background); not retried on every report. */
  private var refusedAt = 0L

  data class Labels(
    val channel: String = "Playing media",
    val privateTab: String = "Private tab",
    val play: String = "Play",
    val pause: String = "Pause",
    val next: String = "Next",
    val previous: String = "Previous",
  )

  fun init(appContext: Context) {
    context = appContext.applicationContext
    RNCWebViewPlayback.setListener(this)
  }

  fun configure(background: Boolean, newLabels: Labels) = main.post {
    labels = newLabels
    if (backgroundPlayback == background) return@post
    backgroundPlayback = background
    update()
  }

  // RNCWebViewPlayback.Listener (main thread)

  override fun onPlaybackState(view: WebView, isPrivate: Boolean, json: String) {
    val msg = try { JSONObject(json) } catch (e: Exception) { return }
    val state = pages.firstOrNull { it.view.get() === view } ?: PageState(view, isPrivate).also { pages.add(it) }
    val now = SystemClock.elapsedRealtime()
    val audible = msg.optBoolean("audible")
    if (audible && !state.audible) state.audibleSince = now
    state.audible = audible
    state.playing = msg.optBoolean("playing")
    state.paused = msg.optBoolean("paused", true)
    state.title = msg.optString("title").take(200)
    state.artist = msg.optString("artist").take(200)
    state.album = msg.optString("album").take(200)
    state.artwork = msg.optString("artwork").take(2000)
    state.host = view.url?.let { Uri.parse(it).host }?.removePrefix("www.") ?: ""
    val actions = msg.optJSONArray("actions")
    state.actions = (0 until (actions?.length() ?: 0)).map { actions!!.optString(it) }.toSet()
    state.duration = msg.optDouble("duration", 0.0).takeIf { it.isFinite() && it > 0 } ?: 0.0
    state.position = msg.optDouble("position", 0.0).takeIf { it.isFinite() && it >= 0 } ?: 0.0
    state.rate = msg.optDouble("rate", 1.0).takeIf { it.isFinite() && it > 0 } ?: 1.0
    val video = msg.optJSONArray("video")
    state.videoWidth = video?.optInt(0) ?: 0
    state.videoHeight = video?.optInt(1) ?: 0
    state.reportedAt = now
    update()
  }

  override fun onFullscreenChanged(view: WebView, fullscreen: Boolean) {
    PictureInPicture.onFullscreenChanged(view, fullscreen)
  }

  override fun onWebViewGone(view: WebView) {
    pages.removeAll { it.view.get() === view || it.view.get() == null }
    PictureInPicture.onFullscreenChanged(view, false)
    update()
  }

  fun stateOf(view: WebView?): PageState? = view?.let { v -> pages.firstOrNull { it.view.get() === v } }

  /** A media control (notification, lock screen, headphones, PiP window) for the owning page. */
  fun command(action: String, seconds: Double = Double.NaN) = main.post {
    val view = owner?.view?.get() ?: return@post
    RNCWebViewPlayback.command(view, action, seconds)
  }

  /** Pauses every page's media (setting off and the app left, the app closed from recents). */
  fun pauseAll() = main.post {
    pages.forEach { page -> page.view.get()?.let { RNCWebViewPlayback.command(it, "pauseAll", Double.NaN) } }
  }

  fun setForeground(value: Boolean) = main.post {
    foreground = value
    // "Keep playing in the background" off: leaving the app pauses playback. Checked a moment later: entering
    // picture-in-picture also pauses the activity, and its mode change may arrive after onPause.
    main.removeCallbacks(pauseIfLeft)
    if (!value && !backgroundPlayback) main.postDelayed(pauseIfLeft, 700)
    update()
  }

  private val pauseIfLeft = Runnable {
    if (!foreground && !backgroundPlayback && !PictureInPicture.active) pauseAll()
  }

  internal fun attach(running: MediaPlaybackService?) {
    service = running
    if (running == null) serviceRequested = false
  }

  private val watchdog = Runnable { update() }

  /** Recomputes who owns the controls and whether the service runs. */
  fun update() {
    main.removeCallbacks(watchdog)
    val now = SystemClock.elapsedRealtime()
    pages.removeAll { it.view.get() == null }
    pages.forEach { page ->
      if ((page.audible || page.playing) && now - page.reportedAt > STALE_MS) {
        page.audible = false
        page.playing = false
      }
    }
    val audible = pages.filter { it.audible }.maxByOrNull { it.audibleSince }
    if (audible != null) {
      owner = audible
      silentSince = 0
    } else {
      if (owner != null && owner !in pages) owner = null
      if (silentSince == 0L) silentSince = now
    }
    val current = owner
    val keep = backgroundPlayback && current != null &&
      (current.audible || now - silentSince < PAUSED_GRACE_MS)
    if (keep) startService() else stopService()
    service?.render(current)
    PictureInPicture.update()
    if (pages.any { it.audible || it.playing } || service != null) main.postDelayed(watchdog, WATCHDOG_MS)
  }

  private fun startService() {
    if (service != null || serviceRequested) return
    // Only started when something is audible; Android allows it while the app is visible (playback was started
    // by the user in a tab) and refuses it from the background, which is caught here.
    if (owner?.audible != true) return
    val ctx = context ?: return
    val now = SystemClock.elapsedRealtime()
    if (!foreground && refusedAt != 0L && now - refusedAt < 60_000L) return
    try {
      ContextCompat.startForegroundService(ctx, Intent(ctx, MediaPlaybackService::class.java))
      serviceRequested = true
      refusedAt = 0
    } catch (e: Exception) {
      refusedAt = now
      Log.w(TAG, "Could not start the playback service", e)
    }
  }

  private fun stopService() {
    if (!serviceRequested && service == null) return
    service?.finish()
    serviceRequested = false
  }
}
