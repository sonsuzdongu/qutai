package expo.modules.qutaimedia

import android.app.Activity
import android.app.PendingIntent
import android.app.PictureInPictureParams
import android.app.RemoteAction
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.drawable.Icon
import android.os.Build
import android.util.Log
import android.util.Rational
import android.webkit.WebView
import androidx.core.app.OnPictureInPictureModeChangedProvider
import androidx.core.app.PictureInPictureModeChangedInfo
import androidx.core.content.ContextCompat
import androidx.core.util.Consumer
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import com.reactnativecommunity.webview.RNCWebViewPlayback
import java.lang.ref.WeakReference

/**
 * Picture-in-picture for a playing full-screen video (Android 8+).
 *
 * Offered only while a page shows a video full screen (the WebView's custom view covers the whole window, so the
 * PiP window shows the video and none of Qutai's own UI), the video is playing, the tab is not incognito and the
 * app allows it (setting on, app lock off: see App.tsx). Android 12+ enters PiP by itself when the user goes home
 * (setAutoEnterEnabled, kept in step with the state); Android 8-11 enters it from onUserLeaveHint. The back gesture
 * leaves full screen as before. The PiP window has a play/pause action; closing the window pauses the video.
 */
object PictureInPicture {
  private const val TAG = "QutaiMedia"
  private const val ACTION_TOGGLE = "expo.modules.qutaimedia.PIP_PLAY_PAUSE"
  private const val MAX_RATIO = 2.39

  /** From the app: the setting is on and the app lock is off and the active tab is not incognito. */
  var allowed = false
    private set
  /** The activity is in picture-in-picture now. */
  var active = false
    private set
  private var fullscreen: WeakReference<WebView>? = null
  private var activity: WeakReference<Activity>? = null
  private var listeningTo: WeakReference<Activity>? = null
  private var receiverRegistered = false
  private var lastKey = ""
  private var ratio = Rational(16, 9)

  private val modeListener = Consumer<PictureInPictureModeChangedInfo> { info ->
    onModeChanged(info.isInPictureInPictureMode)
  }

  private val toggleReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      val view = fullscreen?.get() ?: return
      val state = PlaybackHub.stateOf(view)
      val playing = state != null && state.playing && !state.paused
      RNCWebViewPlayback.command(view, if (playing) "pause" else "play", Double.NaN)
    }
  }

  fun attach(current: Activity) {
    activity = WeakReference(current)
    if (listeningTo?.get() !== current) {
      (current as? OnPictureInPictureModeChangedProvider)?.addOnPictureInPictureModeChangedListener(modeListener)
      listeningTo = WeakReference(current)
      lastKey = ""
    }
    if (!receiverRegistered) {
      ContextCompat.registerReceiver(
        current.applicationContext, toggleReceiver, IntentFilter(ACTION_TOGGLE), ContextCompat.RECEIVER_NOT_EXPORTED,
      )
      receiverRegistered = true
    }
    update()
  }

  fun setAllowed(value: Boolean) {
    allowed = value
    update()
  }

  fun onFullscreenChanged(view: WebView, on: Boolean) {
    if (on) fullscreen = WeakReference(view)
    else if (fullscreen?.get() === view || fullscreen?.get() == null) fullscreen = null
    update()
  }

  /** The full-screen video's page, when PiP may show it. */
  private fun target(): PageState? {
    val view = fullscreen?.get() ?: return null
    if (RNCWebViewPlayback.isPrivate(view)) return null
    return PlaybackHub.stateOf(view)
  }

  private fun eligible(state: PageState?): Boolean =
    allowed && state != null && state.playing && !state.paused

  /** Keeps the activity's PiP parameters (auto-enter, aspect ratio, play/pause action) in step. */
  fun update() {
    if (Build.VERSION.SDK_INT < 26) return
    val current = activity?.get() ?: return
    val state = target()
    if (state != null && state.videoWidth > 0 && state.videoHeight > 0) {
      val r = (state.videoWidth.toDouble() / state.videoHeight).coerceIn(1 / MAX_RATIO, MAX_RATIO)
      ratio = Rational((r * 1000).toInt(), 1000)
    }
    val ok = eligible(state)
    val playing = state != null && state.playing && !state.paused
    val key = "$ok|$ratio|$playing|$active"
    if (key == lastKey) return
    lastKey = key
    try {
      current.setPictureInPictureParams(params(current, ok, playing))
    } catch (e: Exception) {
      // No supportsPictureInPicture in this build's manifest (an older development build).
      Log.w(TAG, "Picture-in-picture parameters not accepted", e)
    }
  }

  /** Android 8-11: the user is leaving with Home; enter PiP if a full-screen video is playing. */
  fun onUserLeaveHint() {
    if (Build.VERSION.SDK_INT !in 26..30) return
    val current = activity?.get() ?: return
    val state = target()
    if (!eligible(state)) return
    try {
      current.enterPictureInPictureMode(params(current, true, true))
    } catch (e: Exception) {
      Log.w(TAG, "Could not enter picture-in-picture", e)
    }
  }

  private fun onModeChanged(inPip: Boolean) {
    active = inPip
    if (!inPip) {
      // Closed (not expanded): the activity is already stopped. The video doesn't go on playing unseen.
      val stopped = (activity?.get() as? LifecycleOwner)?.lifecycle?.currentState?.isAtLeast(Lifecycle.State.STARTED) == false
      if (stopped) fullscreen?.get()?.let { RNCWebViewPlayback.command(it, "pause", Double.NaN) }
    }
    lastKey = ""
    PlaybackHub.update()
  }

  private fun params(context: Activity, autoEnter: Boolean, playing: Boolean): PictureInPictureParams {
    val labels = PlaybackHub.labels
    val intent = Intent(ACTION_TOGGLE).setPackage(context.packageName)
    val pending = PendingIntent.getBroadcast(
      context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val title = if (playing) labels.pause else labels.play
    val icon = Icon.createWithResource(
      context, if (playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
    )
    val builder = PictureInPictureParams.Builder()
      .setAspectRatio(ratio)
      .setActions(listOf(RemoteAction(icon, title, title, pending)))
    if (Build.VERSION.SDK_INT >= 31) builder.setAutoEnterEnabled(autoEnter)
    return builder.build()
  }
}
