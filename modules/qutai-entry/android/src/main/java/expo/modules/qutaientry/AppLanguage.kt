package expo.modules.qutaientry

import android.app.LocaleManager
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.content.res.Resources
import android.net.Uri
import android.os.Build
import android.os.LocaleList
import android.util.Log
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat

/**
 * Keeps the launcher shortcuts and the home screen widget in Qutai's language.
 *
 * Qutai's language: on Android 13+ the per-app language Android keeps for it (Settings › Apps › Qutai › Language, or
 * Qutai's own Settings › Language, which hands its choice to the system); on earlier Android the choice stored here
 * by setAppLanguage. Neither set means Qutai follows the phone. Strings the system resolves for the app itself
 * (manifest shortcut labels, layout texts drawn by the launcher) come out in the PHONE's language, so everything shown
 * outside the app is built here, with labels read through a context configured for that language (localized):
 *
 * - The four launcher shortcuts (long-press the icon: New tab, Incognito tab, Ask Qutai, Scan QR code, in that order)
 *   are DYNAMIC shortcuts published by this module, with ids new_tab, new_private_tab, ask, scan. They are published
 *   when the app starts (QutaiEntryModule's OnCreate), right after the language is changed in Qutai's settings (set),
 *   on ACTION_LOCALE_CHANGED (the phone's language or Qutai's per-app language changed; also delivered while the app
 *   is not running) and on ACTION_MY_PACKAGE_REPLACED (after an update), so they are in the right language without
 *   opening the app. setDynamicShortcuts replaces the whole set, so there are never duplicates.
 * - From 17 Nov to 20 Nov 2026 (builds e38c806 to 0.1.4) the four were STATIC manifest shortcuts (ids static_new_tab, …) in
 *   the phone's language, chosen because they exist right after install and Android lets an app neither change nor
 *   hide them. The owner reversed that: with the phone in English and Qutai in Turkish the menu was English. The cost,
 *   accepted by the owner: after a fresh install the menu is empty until Qutai is opened once (an update publishes
 *   them from ACTION_MY_PACKAGE_REPLACED; no boot receiver or background start is added for this).
 * - Shortcuts pinned to the home screen: pinned copies of these ids (from the builds between cc84a36 and e38c806,
 *   16–17 Nov 2026, which published the same ids dynamically) are updated together with the dynamic ones and follow the language. Pinned copies of the
 *   removed static_* shortcuts are disabled by Android when the update drops them from the manifest; they stay
 *   immutable, so the app can neither re-enable nor update them, and publishing a dynamic shortcut with a static_*
 *   id throws. That is why the ids are not static_*: the user removes the greyed icon and pins it again.
 * - The widget's texts are set on its RemoteViews rather than taken from the layout, so they follow the app too.
 * What stays in the phone's language: the widget's name and description in the launcher's widget list, and the
 * app's name.
 *
 * Every launcher call is guarded: a launcher without shortcut support, a locked user (shortcuts live in
 * credential-encrypted storage) or the background rate limit only leaves the shortcuts as they were.
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
      // ACTION_LOCALE_CHANGED follows, but can take seconds; the launcher is told now (the call comes from the app in
      // the foreground, so the rate limit does not apply).
      apply(context, tag)
      return true
    }
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(APP_LANGUAGE, tag).commit()
    apply(context)
    return true
  }

  /**
   * A context whose resources are in Qutai's language: the chosen language when there is one, otherwise the phone's
   * (the system's locales, not the app context's, so a per-app change still on its way to this process cannot leave
   * the labels in the previous language).
   */
  fun localized(context: Context, tag: String = get(context)): Context {
    val config = Configuration(context.resources.configuration)
    config.setLocales(labelLocales(tag))
    return context.createConfigurationContext(config)
  }

  /** The languages the shortcut and widget labels are resolved in: the chosen one, or the phone's when "" (system). */
  private fun labelLocales(tag: String): LocaleList =
    if (tag.isEmpty()) Resources.getSystem().configuration.locales else LocaleList.forLanguageTags(tag)

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

  /** Shortcuts and widget in Qutai's language (`tag`, "" = the phone's). */
  fun apply(context: Context, tag: String = get(context)) {
    publishShortcuts(context, tag)
    refreshWidgets(context)
  }

  /**
   * Publishes the four as the app's dynamic shortcuts, replacing whatever dynamic set was there (and with it the pinned
   * copies of the same ids). Never throws.
   */
  private fun publishShortcuts(context: Context, tag: String) {
    try {
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)?.component ?: return
      val text = localized(context, tag)
      // Launchers allow a few static plus dynamic shortcuts per activity (usually 4 shown, 15 accepted); the four fit,
      // and if a launcher reports fewer the first ones by rank are kept.
      val max = ShortcutManagerCompat.getMaxShortcutCountPerActivity(context)
      val items = SHORTCUTS.take(max.coerceAtLeast(0)).mapIndexed { rank, s ->
        ShortcutInfoCompat.Builder(context, s.id)
          .setShortLabel(text.getString(s.short))
          .setLongLabel(text.getString(s.long))
          .setIcon(IconCompat.createWithResource(context, s.icon))
          .setActivity(launch)
          .setRank(rank)
          // The same qutai:// link the static shortcuts carried: JavaScript handles it behind the app lock (and an
          // incognito tab behind the incognito lock), exactly as before.
          .setIntent(Intent(Intent.ACTION_VIEW, Uri.parse(s.url)).setComponent(launch))
          .build()
      }
      if (!ShortcutManagerCompat.setDynamicShortcuts(context, items)) {
        // Rate-limited in the background; the next app start (foreground, no limit) publishes them.
        Log.i(TAG, "Launcher shortcuts rate-limited; published at the next start")
      }
    } catch (e: RuntimeException) {
      // No shortcut support, the user is locked (IllegalStateException), or the launcher refused an id.
      Log.w(TAG, "Launcher shortcuts not published", e)
    }
  }

  private fun refreshWidgets(context: Context) {
    val manager = AppWidgetManager.getInstance(context) ?: return
    val ids = manager.getAppWidgetIds(ComponentName(context, QutaiWidgetProvider::class.java))
    if (ids.isNotEmpty()) QutaiWidgetProvider().onUpdate(context, manager, ids)
  }
}

/**
 * ACTION_LOCALE_CHANGED (the phone's language or Qutai's own language changed) and ACTION_MY_PACKAGE_REPLACED (an
 * update: the shortcuts are published in the new build's form, and an update from a build with static shortcuts gets
 * its dynamic ones without the app being opened). Declared by plugins/withEntryPoints.js.
 */
class QutaiLocaleReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_LOCALE_CHANGED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
      AppLanguage.apply(context)
    }
  }
}
