package expo.modules.qutaimedia

import android.content.pm.ActivityInfo
import android.webkit.WebView
import java.lang.ref.WeakReference

/**
 * A page's video shown full screen turns the screen to landscape when the video is wider than it is tall, as in
 * Chrome: the activity follows the sensor between the two landscape sides (also with auto-rotate off) until the
 * video leaves full screen, when the patched WebView puts back the orientation the app had (RNCWebViewManagerImpl's
 * onHideCustomView). A portrait or square video, or one whose size isn't known yet, keeps the WebView's own choice
 * (the system's rotation setting). The size comes from the page's playback script ("full", src/browser/playback.ts),
 * so it can change once the video's data arrives. Not in picture-in-picture, nor for the full screen made for it. Main thread.
 */
object FullscreenOrientation {
  private var view: WeakReference<WebView>? = null
  private var turned = false

  fun onFullscreenChanged(webView: WebView, on: Boolean) {
    if (on) {
      view = WeakReference(webView)
      turned = false
      apply()
    } else if (view?.get() === webView || view?.get() == null) {
      // The WebView restores the app's orientation itself as the full screen ends.
      view = null
      turned = false
    }
  }

  fun onState(webView: WebView) {
    if (view?.get() === webView) apply()
  }

  /** Whether a full-screen video of this size turns the screen to landscape. */
  fun wantsLandscape(width: Int, height: Int): Boolean = width > 0 && height > 0 && width > height

  private fun apply() {
    val webView = view?.get() ?: return
    if (PictureInPicture.active || PictureInPicture.madeFullscreenFor(webView)) return
    val state = PlaybackHub.stateOf(webView) ?: return
    val activity = PictureInPicture.currentActivity() ?: return
    if (wantsLandscape(state.fullWidth, state.fullHeight)) {
      if (turned) return
      turned = true
      activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
    } else if (turned && state.fullWidth > 0 && state.fullHeight > 0) {
      // The video turned out not to be landscape after all (its real size arrived).
      turned = false
      activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
    }
  }
}
