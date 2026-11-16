package expo.modules.qutaientry

import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
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
 */
internal object AppLanguage {
  private const val TAG = "QutaiEntry"

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
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)?.component ?: return
    val items = SHORTCUTS.mapIndexed { rank, s ->
      ShortcutInfoCompat.Builder(context, s.id)
        .setShortLabel(context.getString(s.short))
        .setLongLabel(context.getString(s.long))
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
