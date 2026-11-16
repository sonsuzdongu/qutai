package expo.modules.qutaientry

import android.app.SearchManager
import android.app.UiModeManager
import android.content.Context
import android.content.Intent
import android.os.Build
import expo.modules.kotlin.functions.Queues
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
 * - The launch appearance: the app's theme setting, kept by the system for the next cold start's splash screen.
 */
class QutaiEntryModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("QutaiEntry")
    Events("onEntry")

    // Launcher shortcuts and widget in the app's current language (also kept in step by QutaiLocaleReceiver).
    OnCreate {
      appContext.reactContext?.applicationContext?.let { context ->
        Thread { AppLanguage.apply(context) }.start()
      }
    }

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

    /**
     * Android 12+: the app's own light/dark setting ("system", "light" or "dark") is handed to the system, which keeps
     * it across restarts and draws the next launch's splash screen in it (UiModeManager.setApplicationNightMode).
     * Only called when it changed, as each call is a configuration change. Earlier Android: nothing to do, the
     * splash follows the system appearance. Returns whether the system took it.
     */
    Function("setLaunchAppearance") { theme: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function false
      val context = appContext.reactContext ?: return@Function false
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      if (prefs.getString(LAUNCH_APPEARANCE, "system") == theme) return@Function true
      val mode = when (theme) {
        "dark" -> UiModeManager.MODE_NIGHT_YES
        "light" -> UiModeManager.MODE_NIGHT_NO
        // Anything else: no app-specific mode, the system's appearance applies.
        else -> UiModeManager.MODE_NIGHT_AUTO
      }
      val uiModeManager = context.getSystemService(UiModeManager::class.java) ?: return@Function false
      uiModeManager.setApplicationNightMode(mode)
      prefs.edit().putString(LAUNCH_APPEARANCE, theme).apply()
      true
    }

    /**
     * Shares prepared files and/or text to another app after the user's tap on a card (OutgoingShare). Resolves with
     * the package it went to, or "chooser" when the system chooser opened.
     */
    AsyncFunction("shareFiles") { options: Map<String, Any?> ->
      val activity = appContext.currentActivity ?: throw IllegalStateException("No activity")
      @Suppress("UNCHECKED_CAST")
      OutgoingShare.share(
        activity,
        (options["paths"] as? List<String>) ?: emptyList(),
        (options["mimeType"] as? String) ?: "*/*",
        options["text"] as? String,
        options["subject"] as? String,
        options["emails"] as? List<String>,
        (options["targets"] as? List<String>) ?: emptyList(),
        options["chooserTitle"] as? String,
      )
    }.runOnQueue(Queues.MAIN)

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
    private const val PREFS = "qutai_entry"
    private const val LAUNCH_APPEARANCE = "launch_appearance"
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
