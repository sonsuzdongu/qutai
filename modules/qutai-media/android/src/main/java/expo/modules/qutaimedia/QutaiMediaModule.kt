package expo.modules.qutaimedia

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Android background playback, media controls and picture-in-picture for media in web pages. The JavaScript side
 * (src/device/backgroundMedia.ts) only passes settings and labels; playback state comes natively from the patched
 * WebView (RNCWebViewPlayback), so it keeps working while React Native is paused.
 */
class QutaiMediaModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("QutaiMedia")

    OnCreate {
      appContext.reactContext?.let { PlaybackHub.init(it) }
      appContext.currentActivity?.let { activity -> activity.runOnUiThread { PictureInPicture.attach(activity) } }
    }

    /** Settings and the translated labels for the notification and the PiP window. */
    Function("configure") { options: Map<String, Any?> ->
      val labels = PlaybackHub.Labels(
        channel = options["channel"] as? String ?: "Playing media",
        privateTab = options["privateTab"] as? String ?: "Private tab",
        play = options["play"] as? String ?: "Play",
        pause = options["pause"] as? String ?: "Pause",
        next = options["next"] as? String ?: "Next",
        previous = options["previous"] as? String ?: "Previous",
      )
      PlaybackHub.configure(options["backgroundPlayback"] as? Boolean ?: true, labels)
    }

    /** Picture-in-picture may be offered (setting on, app lock off, the tab on screen is not incognito). */
    Function("setPictureInPictureAllowed") { allowed: Boolean ->
      appContext.currentActivity?.runOnUiThread { PictureInPicture.setAllowed(allowed) }
    }

    OnActivityEntersForeground {
      appContext.currentActivity?.let { activity ->
        activity.runOnUiThread {
          PictureInPicture.attach(activity)
          PictureInPicture.onForeground()
        }
      }
      PlaybackHub.setForeground(true)
    }

    OnActivityEntersBackground {
      PlaybackHub.setForeground(false)
    }

    OnUserLeavesActivity {
      appContext.currentActivity?.runOnUiThread { PictureInPicture.onUserLeaveHint() }
    }
  }
}
