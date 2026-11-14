package expo.modules.qutaientry

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.net.Uri
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat

/**
 * "Add to home screen" for a page: a pinned launcher shortcut whose intent is the page's own http(s) URL addressed
 * to Qutai, so it opens like any link handed to the app (in a normal tab). The icon is the site's letter badge in
 * its colour, as on the new tab page; Qutai keeps no favicons to use instead.
 */
internal object SiteShortcut {
  fun isSupported(context: Context) = ShortcutManagerCompat.isRequestPinShortcutSupported(context)

  fun request(context: Context, url: String, label: String, letter: String, color: String): Boolean {
    val uri = Uri.parse(url)
    if (uri.scheme != "https" && uri.scheme != "http") return false
    if (!isSupported(context)) return false
    val intent = Intent(Intent.ACTION_VIEW, uri).setPackage(context.packageName)
    val name = label.trim().ifEmpty { uri.host ?: url }.take(MAX_LABEL)
    val info = ShortcutInfoCompat.Builder(context, "site:${url.hashCode()}:${url.length}")
      .setShortLabel(name)
      .setLongLabel(name)
      .setIcon(IconCompat.createWithAdaptiveBitmap(badge(letter, color)))
      .setIntent(intent)
      .build()
    return ShortcutManagerCompat.requestPinShortcut(context, info, null)
  }

  /** An adaptive icon (108dp canvas, 72dp visible) with a white letter on the site's colour. */
  private fun badge(letter: String, color: String): Bitmap {
    val size = 432
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    canvas.drawColor(runCatching { Color.parseColor(color) }.getOrDefault(Color.parseColor("#4a4458")))
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      this.color = Color.WHITE
      textSize = size * 0.30f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      textAlign = Paint.Align.CENTER
    }
    val text = letter.trim().take(2).uppercase().ifEmpty { "•" }
    val y = size / 2f - (paint.descent() + paint.ascent()) / 2f
    canvas.drawText(text, size / 2f, y, paint)
    return bitmap
  }

  private const val MAX_LABEL = 40
}
