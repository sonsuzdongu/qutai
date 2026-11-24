package expo.modules.qutaimedia

import android.app.Activity
import android.app.PendingIntent
import android.app.PictureInPictureParams
import android.app.RemoteAction
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Rect
import android.graphics.drawable.Icon
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.util.Rational
import android.view.InputDevice
import android.view.MotionEvent
import android.view.View
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
 * Picture-in-picture for a playing video (Android 8+), when the user goes home or to another app.
 *
 * Two cases:
 * - The page shows the video full screen (the WebView's custom view covers the whole window, so the PiP window shows
 *   the video and none of Qutai's own UI): offered while it plays.
 * - The video plays inline, with sound, on screen in the tab being shown: the PiP window would show the whole app
 *   shrunk, so the video is made full screen as PiP starts. The Fullscreen API needs a user activation, so the page
 *   script is armed ("pipEnter", see src/browser/playback.ts) and one tap is sent to the WebView natively (a real
 *   input event); the script swallows it before the page's own listeners and makes the video full screen. When the
 *   user expands the window again, or closes it, that full screen is left, so the browser is where it was.
 *
 * Never for an incognito tab, with the app lock on or the setting off (see App.tsx), for a paused video, (inline)
 * for a muted one (silent autoplay), or where the site refuses it (YouTube without Premium, see PageState.noPip).
 * Android 12+ enters PiP by itself (setAutoEnterEnabled, kept in step with the state, with the video's area as the
 * source rect hint); the inline video's full screen starts as the PiP animation starts (Android 15+, from
 * MainActivity) or once PiP has entered (12-14). Android 8-11 enters it from onUserLeaveHint. A page that doesn't
 * show its video in PiP (leaves full screen, pauses itself) ends PiP and its sound goes on. The PiP window has a
 * play/pause action; closing it pauses the video.
 */
object PictureInPicture {
  private const val TAG = "QutaiMedia"
  private const val ACTION_TOGGLE = "expo.modules.qutaimedia.PIP_PLAY_PAUSE"
  private const val MAX_RATIO = 2.39
  private const val RATIO_SCALE = 10000
  /** ceil(10000 / 2.39) and floor(10000 * 2.39): the limits as fractions of RATIO_SCALE, never outside Android's. */
  private const val MIN_RATIO_PARTS = 4185
  private const val MAX_RATIO_PARTS = 23900
  /** An inline video smaller than this (dp, its visible width) isn't offered (a thumbnail, an ad corner). */
  private const val MIN_INLINE_DP = 120

  /** From the app: the setting is on and the app lock is off and the active tab is not incognito. */
  var allowed = false
    private set
  /** The activity is in picture-in-picture now. */
  var active = false
    private set
  private val main = Handler(Looper.getMainLooper())
  private var fullscreen: WeakReference<WebView>? = null
  /** The view whose video PiP shows (or would show now). */
  private var pipView: WeakReference<WebView>? = null
  /** The view whose inline video was made full screen for PiP, and when that was asked. */
  private var madeFullscreen: WeakReference<WebView>? = null
  private var madeFullscreenAt = 0L
  /** When PiP was entered, and when the user last used the PiP window's play/pause action. */
  private var enteredAt = 0L
  private var toggledAt = 0L
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
      val view = pipView?.get() ?: return
      val state = PlaybackHub.stateOf(view)
      val playing = state != null && state.playing && !state.paused
      toggledAt = SystemClock.elapsedRealtime()
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

  /** The app's activity (FullscreenOrientation). */
  internal fun currentActivity(): Activity? = activity?.get()

  /** The view's full screen was made for picture-in-picture (not the user's own). */
  internal fun madeFullscreenFor(view: WebView): Boolean = madeFullscreen?.get() === view

  fun setAllowed(value: Boolean) {
    allowed = value
    update()
  }

  fun onFullscreenChanged(view: WebView, on: Boolean) {
    if (on) fullscreen = WeakReference(view)
    else if (fullscreen?.get() === view || fullscreen?.get() == null) fullscreen = null
    if (!on && madeFullscreen?.get() === view) madeFullscreen = null
    // In PiP the page left full screen (it ended, or the site refuses PiP: YouTube's mobile site does without
    // Premium): the window would show Qutai shrunk, so PiP ends and the sound goes on.
    if (!on && active && pipView?.get() === view) main.post(leaveWithSound)
    update()
  }

  private class Target(val view: WebView, val state: PageState, val inline: Boolean)

  /** The video PiP would show now: the full-screen one, else a playing inline one on screen. */
  private fun target(): Target? {
    fullscreen?.get()?.let { view ->
      if (RNCWebViewPlayback.isPrivate(view)) return null
      val state = PlaybackHub.stateOf(view) ?: return null
      return if (state.playing && !state.paused && !state.noPip) Target(view, state, false) else null
    }
    val state = PlaybackHub.owner ?: return null
    val view = state.view.get() ?: return null
    if (state.isPrivate || RNCWebViewPlayback.isPrivate(view)) return null
    if (!state.audible || !state.playing || state.paused || state.noPip) return null
    if (state.videoWidth <= 0 || state.videoHeight <= 0) return null
    val rect = state.videoRect ?: return null
    if (rect[2] < MIN_INLINE_DP * view.resources.displayMetrics.density || rect[3] <= 0) return null
    if (!onScreen(view)) return null
    return Target(view, state, true)
  }

  /** The view is in the window and not hidden (other tabs are kept with opacity 0, see BrowserView.tsx). */
  private fun onScreen(view: View): Boolean {
    if (!view.isAttachedToWindow || !view.isShown) return false
    var v: View? = view
    while (v != null) {
      if (v.alpha <= 0.01f) return false
      v = v.parent as? View
    }
    return view.getGlobalVisibleRect(Rect())
  }

  /** Keeps the activity's PiP parameters (auto-enter, aspect ratio, source rect, play/pause action) in step. */
  fun update() {
    if (Build.VERSION.SDK_INT < 26) return
    val current = activity?.get() ?: return
    refusedInPip()
    // In PiP the target stays the video already shown (the inline one may be on its way to full screen).
    val target = if (active) pipView?.get()?.let { v -> PlaybackHub.stateOf(v)?.let { Target(v, it, false) } } else target()
    val state = target?.state
    if (state != null && state.videoWidth > 0 && state.videoHeight > 0) {
      val r = (state.videoWidth.toDouble() / state.videoHeight).coerceIn(1 / MAX_RATIO, MAX_RATIO)
      // Android accepts ratios from 1:2.39 to 2.39:1 inclusive and throws outside them. Truncating to thousandths put
      // the lower limit (0.41841…) at 0.418, just outside, so no tall video could enter picture-in-picture: round, and
      // keep the fraction itself inside the limits.
      ratio = Rational(Math.round(r * RATIO_SCALE).toInt().coerceIn(MIN_RATIO_PARTS, MAX_RATIO_PARTS), RATIO_SCALE)
    }
    if (!active) pipView = target?.let { WeakReference(it.view) }
    val ok = allowed && target != null
    val playing = state != null && state.playing && !state.paused
    val hint = if (ok && !active) sourceRect(current, target!!) else null
    val key = "$ok|$ratio|$playing|$active|$hint"
    if (key == lastKey) return
    lastKey = key
    try {
      current.setPictureInPictureParams(params(current, ok, playing, hint))
    } catch (e: Exception) {
      // No supportsPictureInPicture in this build's manifest (an older development build).
      Log.w(TAG, "Picture-in-picture parameters not accepted", e)
    }
  }

  /**
   * Back in the app without PiP (Recents and back, or PiP refused): a full screen made for PiP that never started is
   * left again.
   */
  fun onForeground() {
    if (active) return
    madeFullscreen?.get()?.let { RNCWebViewPlayback.command(it, "pipExit", Double.NaN) }
    madeFullscreen = null
  }

  /** The video's area in the window: the inline video's rect, or the full-screen video letterboxed in the window. */
  private fun sourceRect(current: Activity, target: Target): Rect? {
    if (target.inline) {
      val r = target.state.videoRect ?: return null
      val loc = IntArray(2)
      target.view.getLocationInWindow(loc)
      val rect = Rect(loc[0] + r[0], loc[1] + r[1], loc[0] + r[0] + r[2], loc[1] + r[1] + r[3])
      val visible = Rect()
      if (!target.view.getGlobalVisibleRect(visible) || !rect.intersect(visible)) return null
      return rect
    }
    val decor = current.window?.decorView ?: return null
    val w = decor.width
    val h = decor.height
    if (w <= 0 || h <= 0) return null
    val r = ratio.toDouble()
    return if (w.toDouble() / h > r) {
      val vw = (h * r).toInt()
      Rect((w - vw) / 2, 0, (w - vw) / 2 + vw, h)
    } else {
      val vh = (w / r).toInt()
      Rect(0, (h - vh) / 2, w, (h - vh) / 2 + vh)
    }
  }

  /**
   * The user is leaving with Home or Recents (onUserLeaveHint; Android 12+ doesn't call it when it enters PiP by
   * itself). An inline video is made full screen now, while the window still has its size, and Android 8-11 enters
   * PiP here.
   */
  fun onUserLeaveHint() {
    if (Build.VERSION.SDK_INT < 26 || !allowed || active) return
    val current = activity?.get() ?: return
    val target = target() ?: return
    if (target.inline) makeFullscreen(target)
    if (Build.VERSION.SDK_INT <= 30) {
      try {
        current.enterPictureInPictureMode(params(current, true, true, sourceRect(current, target)))
      } catch (e: Exception) {
        Log.w(TAG, "Could not enter picture-in-picture", e)
      }
    }
  }

  /**
   * Android 15+: the PiP animation starts (MainActivity, see plugins/withPictureInPicture.js). The inline video goes
   * full screen now rather than once the animation has ended, so the window shows the page shrunk for less time.
   */
  fun onUiStateChanged(transitioningToPip: Boolean) {
    if (!transitioningToPip || active || !allowed) return
    val target = target() ?: return
    if (target.inline) makeFullscreen(target)
  }

  /** Arms the page script, then taps the video once (see the class comment). */
  private fun makeFullscreen(target: Target) {
    val view = target.view
    madeFullscreen = WeakReference(view)
    madeFullscreenAt = SystemClock.elapsedRealtime()
    val rect = target.state.videoRect
    RNCWebViewPlayback.command(view, "pipEnter", Double.NaN) { _ ->
      if (madeFullscreen?.get() !== view || fullscreen?.get() === view) return@command
      // The middle of the video if the view still has the size the rect was measured in, else the middle of the view.
      var x = view.width / 2f
      var y = view.height / 2f
      if (rect != null && rect[0] + rect[2] <= view.width && rect[1] + rect[3] <= view.height) {
        x = rect[0] + rect[2] / 2f
        y = rect[1] + rect[3] / 2f
      }
      tap(view, x, y)
    }
  }

  private fun tap(view: View, x: Float, y: Float) {
    val time = SystemClock.uptimeMillis()
    for ((action, at) in listOf(MotionEvent.ACTION_DOWN to time, MotionEvent.ACTION_UP to time + 50)) {
      val event = MotionEvent.obtain(time, at, action, x, y, 0)
      event.source = InputDevice.SOURCE_TOUCHSCREEN
      view.dispatchTouchEvent(event)
      event.recycle()
    }
  }

  private fun onModeChanged(inPip: Boolean) {
    active = inPip
    main.removeCallbacks(checkFullscreen)
    if (inPip) {
      // Android 12-14: no earlier signal (auto-enter calls no onUserLeaveHint); the inline video goes full screen now.
      val view = pipView?.get()
      val recently = SystemClock.elapsedRealtime() - madeFullscreenAt < 2_000
      if (view != null && fullscreen?.get() !== view && !(recently && madeFullscreen?.get() === view)) {
        PlaybackHub.stateOf(view)?.let { makeFullscreen(Target(view, it, true)) }
      }
      enteredAt = SystemClock.elapsedRealtime()
      main.postDelayed(checkFullscreen, 2_500)
    } else {
      val view = pipView?.get()
      // Closed (not expanded): the activity is already stopped. The video doesn't go on playing unseen.
      val stopped = (activity?.get() as? LifecycleOwner)?.lifecycle?.currentState?.isAtLeast(Lifecycle.State.STARTED) == false
      if (stopped && !leavingWithSound) view?.let { RNCWebViewPlayback.command(it, "pause", Double.NaN) }
      leavingWithSound = false
      // Expanded or closed: the full screen made for PiP is left, so the browser is where it was.
      madeFullscreen?.get()?.let { RNCWebViewPlayback.command(it, "pipExit", Double.NaN) }
      madeFullscreen = null
    }
    lastKey = ""
    PlaybackHub.update()
  }

  private var leavingWithSound = false

  /**
   * The page paused its video by itself right after PiP began (not from the PiP window's action): the site refuses
   * PiP (YouTube's mobile site pauses in a small window without Premium). PiP ends and the sound goes on.
   */
  private fun refusedInPip() {
    if (!active || leavingWithSound) return
    val now = SystemClock.elapsedRealtime()
    if (now - enteredAt > 5_000 || now - toggledAt < 3_000) return
    val state = PlaybackHub.stateOf(pipView?.get()) ?: return
    if (state.paused && !state.ended) main.post(leaveWithSound)
  }

  /** In PiP without the video full screen (the page refused it, or the tap didn't arrive). */
  private val checkFullscreen: Runnable = Runnable {
    val view = pipView?.get()
    if (active && (view == null || fullscreen?.get() !== view)) leaveWithSound.run()
  }

  /**
   * Leaves PiP without pausing: the app goes to the background, as with Home without PiP, and the video goes on as
   * sound (background playback). A page that refused PiP may have paused its player meanwhile; it was playing when
   * PiP began, so it is played again once.
   */
  private val leaveWithSound: Runnable = Runnable {
    val current = activity?.get() ?: return@Runnable
    if (!active || leavingWithSound) return@Runnable
    Log.w(TAG, "The page doesn't show its video in picture-in-picture; leaving it, the sound goes on")
    leavingWithSound = true
    main.removeCallbacks(checkFullscreen)
    val view = pipView?.get()
    current.moveTaskToBack(true)
    view?.let { v ->
      main.postDelayed({
        val state = PlaybackHub.stateOf(v)
        if (state != null && state.paused && !state.ended) RNCWebViewPlayback.command(v, "play", Double.NaN)
      }, 700)
    }
  }

  private fun params(context: Activity, autoEnter: Boolean, playing: Boolean, hint: Rect?): PictureInPictureParams {
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
    if (hint != null && !hint.isEmpty) builder.setSourceRectHint(hint)
    if (Build.VERSION.SDK_INT >= 31) builder.setAutoEnterEnabled(autoEnter)
    return builder.build()
  }
}
