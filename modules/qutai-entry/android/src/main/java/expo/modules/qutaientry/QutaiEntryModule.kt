package expo.modules.qutaientry

import android.app.SearchManager
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Ways into Qutai from outside the app that are not plain links (those reach React Native's Linking: http(s) links
 * handed to Qutai as the default browser, and qutai:// links from the launcher shortcuts and automation).
 *
 * - Text and links shared to Qutai (ACTION_SEND text/plain), "Qutai" in other apps' text-selection menu
 *   (ACTION_PROCESS_TEXT) and web searches handed to Qutai (ACTION_WEB_SEARCH) are queued here as untrusted text.
 *   JavaScript takes the queue (each item once) and asks the user what to do with it; nothing is sent anywhere
 *   by itself (src/device/entryPoints.ts).
 * - "Add to home screen": a pinned launcher shortcut for a page (SiteShortcut).
 */
class QutaiEntryModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("QutaiEntry")
    Events("onEntry")

    /** Everything that arrived since the last call, oldest first; each item is returned once. */
    Function("takePending") {
      // The launch intent: read here because the activity may not exist yet when the module is created.
      appContext.currentActivity?.let { collect(it.intent) }
      EntryQueue.take()
    }

    OnNewIntent { intent ->
      if (collect(intent)) sendEvent("onEntry", emptyMap<String, Any>())
    }

    Function("isPinShortcutSupported") {
      val context = appContext.reactContext ?: return@Function false
      SiteShortcut.isSupported(context)
    }

    /** Asks the launcher to pin a shortcut that opens `url` in Qutai; the launcher shows its own confirmation. */
    Function("pinSiteShortcut") { url: String, label: String, letter: String, color: String ->
      val context = appContext.reactContext ?: return@Function false
      SiteShortcut.request(context, url, label, letter, color)
    }
  }

  /** Queues the text an intent carries and marks the intent handled, so a recreated activity does not repeat it. */
  private fun collect(intent: Intent?): Boolean {
    if (intent == null || intent.getBooleanExtra(HANDLED, false)) return false
    val entry = parse(intent) ?: return false
    intent.putExtra(HANDLED, true)
    EntryQueue.add(entry)
    return true
  }

  private fun parse(intent: Intent): Map<String, Any?>? {
    val (source, raw) = when (intent.action) {
      Intent.ACTION_SEND -> {
        // Text only: images and files are not taken (the intent filter is text/plain as well).
        if (intent.type?.startsWith("text/") != true) return null
        "share" to (intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString())
      }
      Intent.ACTION_PROCESS_TEXT -> "selection" to intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
      Intent.ACTION_WEB_SEARCH -> "webSearch" to intent.getStringExtra(SearchManager.QUERY)
      else -> return null
    }
    val text = raw?.trim()?.take(MAX_TEXT)
    if (text.isNullOrEmpty()) return null
    val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)?.trim()?.take(MAX_SUBJECT)
    return mapOf("source" to source, "text" to text, "subject" to subject)
  }

  companion object {
    private const val HANDLED = "expo.modules.qutaientry.HANDLED"
    private const val MAX_TEXT = 20_000
    private const val MAX_SUBJECT = 500
  }
}

/** Process-wide, so an intent that arrives before JavaScript listens is kept until it asks. */
internal object EntryQueue {
  private val items = mutableListOf<Map<String, Any?>>()

  @Synchronized
  fun add(entry: Map<String, Any?>) {
    items.add(entry)
    // A burst of shares is not a reason to keep more than a few.
    while (items.size > 5) items.removeAt(0)
  }

  @Synchronized
  fun take(): List<Map<String, Any?>> = items.toList().also { items.clear() }
}
