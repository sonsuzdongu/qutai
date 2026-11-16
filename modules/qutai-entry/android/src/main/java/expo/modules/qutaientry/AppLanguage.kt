package expo.modules.qutaientry

import android.app.LocaleManager
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.LocaleList
import android.util.Log
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat

/**
 * Keeps the launcher shortcuts and the home screen widget in the app's language.
 *
 * Qutai's language is the per-app language Android keeps for it (Android 13+: Settings › Apps › Qutai › Language,
 * declared through expo-localization's supportedLocales; earlier Android: the phone's language). The system reads
 * strings it shows for the app itself (manifest shortcut labels, layout texts drawn by the launcher) in the PHONE's
 * language, so a Turkish Qutai on an English phone had English shortcuts. Here the app resolves the strings in its
 * own process, where its resources already follow the per-app language, and hands the system finished text:
 * - the four launcher shortcuts are dynamic shortcuts (the manifest no longer declares them), published on every
 *   start and on every language change;
 * - the widget's texts are set on its RemoteViews rather than taken from the layout.
 * Android sends ACTION_LOCALE_CHANGED to the app when its own language or the phone's changes, also while it is not
 * running, so both follow without opening the app. What stays in the phone's language: the widget's name and
 * description in the launcher's widget list, and the app's name.
 *
 * The language chosen in Qutai's own settings (src/i18n/appLanguage.ts):
 * - Android 13+: handed to the system as the per-app language (LocaleManager), the same setting as Settings › Apps ›
 *   Qutai › Language, so either place changes both. The system then sends ACTION_LOCALE_CHANGED as above.
 * - earlier Android, which has no per-app language: kept here and applied to the strings this module resolves (the
 *   shortcuts and the widget); the JavaScript interface applies it itself.
 */
internal object AppLanguage {
  private const val TAG = "QutaiEntry"
  private const val PREFS = "qutai_entry"
  private const val APP_LANGUAGE = "app_language"

  /** Whether the system keeps a per-app language (Android 13+). */
  val systemPerApp: Boolean get() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU

  /** The chosen language as a BCP 47 tag, "" when Qutai follows the system. */
  fun get(context: Context): String =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.getSystemService(LocaleManager::class.java)?.applicationLocales?.toLanguageTags() ?: ""
    } else {
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(APP_LANGUAGE, "") ?: ""
    }

  /** Sets the chosen language ("" for the system's); returns false when nothing could be set. */
  fun set(context: Context, tag: String): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val manager = context.getSystemService(LocaleManager::class.java) ?: return false
      // The system recreates nothing (the activity handles `locale` changes itself) and sends ACTION_LOCALE_CHANGED.
      manager.applicationLocales = if (tag.isEmpty()) LocaleList.getEmptyLocaleList() else LocaleList.forLanguageTags(tag)
      return true
    }
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(APP_LANGUAGE, tag).commit()
    apply(context)
    return true
  }

  /**
   * A context whose resources are in Qutai's language: the app context itself on Android 13+ (the system applies the
   * per-app language to it), one configured with the stored choice before that.
   */
  fun localized(context: Context): Context {
    if (systemPerApp) return context
    val tag = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(APP_LANGUAGE, "") ?: ""
    if (tag.isEmpty()) return context
    val config = Configuration(context.resources.configuration)
    config.setLocales(LocaleList.forLanguageTags(tag))
    return context.createConfigurationContext(config)
  }

  private data class Shortcut(val id: String, val url: String, val icon: Int, val short: Int, val long: Int)

  private val SHORTCUTS = listOf(
    Shortcut("new_tab", "qutai://new-tab", R.drawable.qutai_shortcut_new_tab, R.string.qutai_shortcut_new_tab, R.string.qutai_shortcut_new_tab),
    Shortcut(
      "new_private_tab",
      "qutai://new-private-tab",
      R.drawable.qutai_shortcut_private_tab,
      R.string.qutai_shortcut_private_tab_short,
      R.string.qutai_shortcut_private_tab,
    ),
    Shortcut("ask", "qutai://ask", R.drawable.qutai_shortcut_ask, R.string.qutai_shortcut_ask, R.string.qutai_shortcut_ask),
    Shortcut("scan", "qutai://scan", R.drawable.qutai_shortcut_scan, R.string.qutai_shortcut_scan_short, R.string.qutai_shortcut_scan),
  )

  /** Shortcuts and widget in the language the app's resources resolve to now. */
  fun apply(context: Context) {
    publishShortcuts(context)
    refreshWidgets(context)
  }

  private fun publishShortcuts(context: Context) {
    val text = localized(context)
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)?.component ?: return
    val items = SHORTCUTS.mapIndexed { rank, s ->
      ShortcutInfoCompat.Builder(context, s.id)
        .setShortLabel(text.getString(s.short))
        .setLongLabel(text.getString(s.long))
        .setIcon(IconCompat.createWithResource(context, s.icon))
        .setActivity(launch)
        .setRank(rank)
        .setIntent(Intent(Intent.ACTION_VIEW, Uri.parse(s.url)).setComponent(launch))
        .build()
    }
    try {
      ShortcutManagerCompat.setDynamicShortcuts(context, items)
      // A shortcut the user pinned to the home screen from an earlier build keeps its label until updated.
      ShortcutManagerCompat.updateShortcuts(context, items)
    } catch (e: RuntimeException) {
      // The launcher refused (rate limit while in the background, or a pinned shortcut it will not let change).
      Log.w(TAG, "Launcher shortcuts not updated", e)
    }
  }

  private fun refreshWidgets(context: Context) {
    val manager = AppWidgetManager.getInstance(context) ?: return
    val ids = manager.getAppWidgetIds(ComponentName(context, QutaiWidgetProvider::class.java))
    if (ids.isNotEmpty()) QutaiWidgetProvider().onUpdate(context, manager, ids)
  }
}

/** ACTION_LOCALE_CHANGED: the phone's language or Qutai's own language changed (declared by plugins/withEntryPoints.js). */
class QutaiLocaleReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_LOCALE_CHANGED) AppLanguage.apply(context)
  }
}
