package expo.modules.qutaidownloads

import android.content.ContentValues
import android.content.Context
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.provider.MediaStore
import androidx.annotation.RequiresApi
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.OutputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Where a download's bytes go: the public Downloads collection, so file managers and other apps see the file.
 *
 * Android 10+ (scoped storage): a MediaStore.Downloads row inserted with IS_PENDING = 1 (hidden from other apps while
 * it downloads), written through the content resolver, published by clearing IS_PENDING once every byte arrived.
 * MediaStore makes the name unique ("name (1).ext") by itself. No permission is needed.
 *
 * Android 9 and older: a hidden partial file in the public Downloads directory (WRITE_EXTERNAL_STORAGE, asked by the
 * app at the first download), renamed to a free name when complete and handed to the media scanner, whose content://
 * address is what the app opens and shares.
 */
class DownloadSink(private val context: Context) {
  private val resolver get() = context.contentResolver

  class SinkGone : IOException("The partial file is gone")

  /**
   * Before opening a finished file: "ok", "gone" (deleted elsewhere) or "denied" (it is there but Qutai may no longer
   * read it, e.g. Android 9's storage permission was taken back, or the row now belongs to another app).
   */
  fun access(rec: DownloadRecord): String {
    if (Build.VERSION.SDK_INT >= 29) {
      val uri = rec.uri ?: return "gone"
      return try {
        val found = resolver.query(Uri.parse(uri), arrayOf(MediaStore.MediaColumns._ID), null, null, null)?.use { it.count > 0 } ?: false
        if (found) "ok" else "gone"
      } catch (_: SecurityException) {
        "denied"
      } catch (_: Exception) {
        "gone"
      }
    }
    return if (exists(rec)) "ok" else "gone"
  }

  /** Whether the partial (or finished) file still exists. */
  fun exists(rec: DownloadRecord): Boolean {
    if (Build.VERSION.SDK_INT >= 29) {
      val uri = rec.uri ?: return false
      return try {
        resolver.query(Uri.parse(uri), arrayOf(MediaStore.MediaColumns._ID), null, null, null)?.use { it.count > 0 } ?: false
      } catch (_: Exception) {
        false
      }
    }
    if (rec.state == DlState.DONE && rec.path == null) return rec.uri != null
    return rec.path?.let { File(it).exists() } ?: false
  }

  /** Opens the file for writing: appending at the bytes already there, or from zero. Creates it when needed. */
  fun open(rec: DownloadRecord, append: Boolean): OutputStream {
    if (Build.VERSION.SDK_INT >= 29) return openMediaStore(rec, append)
    val dir = publicDir()
    if (!dir.exists() && !dir.mkdirs()) throw IOException("No Downloads directory")
    val part = rec.path?.let(::File) ?: File(dir, ".${rec.id}.qutai-part").also { rec.path = it.absolutePath }
    if (append && !part.exists()) throw SinkGone()
    return FileOutputStream(part, append)
  }

  @RequiresApi(29)
  private fun openMediaStore(rec: DownloadRecord, append: Boolean): OutputStream {
    var uri = rec.uri?.let(Uri::parse)
    if (uri == null || !exists(rec)) {
      if (append) throw SinkGone()
      val values = ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, rec.name)
        put(MediaStore.MediaColumns.MIME_TYPE, rec.mime)
        put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/")
        put(MediaStore.MediaColumns.IS_PENDING, 1)
      }
      uri = resolver.insert(MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), values)
        ?: throw IOException("Couldn't create the file in Downloads")
      rec.uri = uri.toString()
      displayName(uri)?.let { rec.name = it }
    }
    return resolver.openOutputStream(uri, if (append) "wa" else "wt") ?: throw IOException("Couldn't write the file")
  }

  /** Publishes the complete file under its final name; returns false if that failed. */
  fun finish(rec: DownloadRecord): Boolean {
    if (Build.VERSION.SDK_INT >= 29) {
      val uri = Uri.parse(rec.uri ?: return false)
      val values = ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }
      if (resolver.update(uri, values, null, null) < 1) return false
      displayName(uri)?.let { rec.name = it }
      return true
    }
    val part = File(rec.path ?: return false)
    val target = uniqueFile(part.parentFile ?: publicDir(), rec.name)
    if (!part.renameTo(target)) return false
    rec.path = target.absolutePath
    rec.name = target.name
    // Without the scanner's address the file is still in Downloads; Qutai just can't hand it to other apps.
    rec.uri = scan(target, rec.mime)
    return true
  }

  /** Removes the partial or finished file. */
  fun delete(rec: DownloadRecord): Boolean {
    var removed = false
    try {
      if (Build.VERSION.SDK_INT >= 29) {
        rec.uri?.let { removed = resolver.delete(Uri.parse(it), null, null) > 0 }
      } else {
        rec.path?.let { removed = File(it).delete() }
        rec.uri?.takeIf { it.startsWith("content:") }?.let { resolver.delete(Uri.parse(it), null, null) }
      }
    } catch (_: Exception) {
      // Not ours any more (for example after a reinstall) or already gone.
    }
    return removed
  }

  /** Free bytes where downloads are written. */
  fun freeBytes(): Long = try {
    StatFs(Environment.getExternalStorageDirectory().path).availableBytes
  } catch (_: Exception) {
    Long.MAX_VALUE
  }

  private fun displayName(uri: Uri): String? = try {
    resolver.query(uri, arrayOf(MediaStore.MediaColumns.DISPLAY_NAME), null, null, null)?.use {
      if (it.moveToFirst()) it.getString(0) else null
    }
  } catch (_: Exception) {
    null
  }

  @Suppress("DEPRECATION")
  private fun publicDir(): File = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)

  private fun uniqueFile(dir: File, name: String): File {
    var file = File(dir, name)
    if (!file.exists()) return file
    val dot = name.lastIndexOf('.')
    val base = if (dot > 0) name.substring(0, dot) else name
    val ext = if (dot > 0) name.substring(dot) else ""
    var i = 1
    while (file.exists()) file = File(dir, "$base (${i++})$ext")
    return file
  }

  /** Android 9 and older: adds the file to MediaStore and returns its content:// address (waits up to 5 s). */
  private fun scan(file: File, mime: String): String? {
    val latch = CountDownLatch(1)
    var result: String? = null
    MediaScannerConnection.scanFile(context, arrayOf(file.absolutePath), arrayOf(mime)) { _, uri ->
      result = uri?.toString()
      latch.countDown()
    }
    latch.await(5, TimeUnit.SECONDS)
    return result
  }
}
