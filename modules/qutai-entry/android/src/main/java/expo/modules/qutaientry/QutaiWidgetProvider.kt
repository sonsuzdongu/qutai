package expo.modules.qutaientry

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.SizeF
import android.widget.RemoteViews

/**
 * The home screen widget: a search bar that opens Qutai with the address field ready, the assistant button, and
 * New tab / Private tab / Scan QR. Every tap is a qutai:// link to the app (src/device/entryPoints.ts handles it
 * like any other, after the app lock). The widget shows no personal data (no history or tabs): a home screen is
 * seen by others. Nothing runs in the background; it is drawn once per placement or resize.
 */
class QutaiWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { manager.updateAppWidget(it, views(context)) }
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    manager.updateAppWidget(id, views(context))
  }

  private fun views(context: Context): RemoteViews {
    val compact = build(context, R.layout.qutai_widget_compact)
    val full = build(context, R.layout.qutai_widget)
    // Android 12+: the launcher picks the layout for the size the user gave the widget; one row of buttons
    // needs about two cells of height.
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      RemoteViews(mapOf(SizeF(110f, 40f) to compact, SizeF(180f, 100f) to full))
    } else {
      full
    }
  }

  private fun build(context: Context, layout: Int) = RemoteViews(context.packageName, layout).apply {
    // Texts set here, not left to the layout: the launcher would read the layout's strings in the phone's language,
    // while `context` resolves them in Qutai's own (per-app) language (AppLanguage).
    val hint = context.getString(R.string.qutai_widget_hint)
    setTextViewText(R.id.qutai_widget_hint_text, hint)
    setContentDescription(R.id.qutai_widget_search, hint)
    setContentDescription(R.id.qutai_widget_ask, context.getString(R.string.qutai_widget_ask))
    setOnClickPendingIntent(R.id.qutai_widget_search, link(context, "qutai://new-tab", 1))
    setOnClickPendingIntent(R.id.qutai_widget_ask, link(context, "qutai://ask", 2))
    if (layout == R.layout.qutai_widget) {
      setTextViewText(R.id.qutai_widget_new_tab_text, context.getString(R.string.qutai_widget_new_tab))
      setTextViewText(R.id.qutai_widget_private_tab_text, context.getString(R.string.qutai_widget_private_tab))
      setTextViewText(R.id.qutai_widget_scan_text, context.getString(R.string.qutai_widget_scan))
      setOnClickPendingIntent(R.id.qutai_widget_new_tab, link(context, "qutai://new-tab", 3))
      setOnClickPendingIntent(R.id.qutai_widget_private_tab, link(context, "qutai://new-private-tab", 4))
      setOnClickPendingIntent(R.id.qutai_widget_scan, link(context, "qutai://scan", 5))
    }
  }

  private fun link(context: Context, url: String, code: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(
      context,
      code,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }
}
