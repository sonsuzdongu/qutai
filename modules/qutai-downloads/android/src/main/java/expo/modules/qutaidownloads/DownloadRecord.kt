package expo.modules.qutaidownloads

import android.webkit.MimeTypeMap
import org.json.JSONObject
import java.net.URLDecoder
import java.util.Locale

/** States a download can be in, as the JavaScript side names them. */
object DlState {
  const val QUEUED = "queued"
  const val DOWNLOADING = "downloading"
  const val PAUSED = "paused"
  /** Offline: continues by itself when a network is back. */
  const val WAITING = "waiting"
  const val FAILED = "failed"
  const val DONE = "done"
  /** The app was closed or the phone restarted while it ran; resumable. */
  const val INTERRUPTED = "interrupted"

  val ACTIVE = setOf(QUEUED, DOWNLOADING, WAITING)
}

/**
 * One download. `kind` "http" is fetched by the engine (resumable); "page" is written by the app from a blob: or data:
 * address the page holds (not resumable: only the page has the bytes). Cookies are never stored here: they are read
 * from the tab's WebView profile for every request.
 */
class DownloadRecord(
  val id: String,
  var url: String,
  var name: String,
  var mime: String,
  /** The page's or file's site, for the list. */
  val site: String,
  val kind: String,
  val incognito: Boolean,
  /** WebView profile (null: the default one), whose cookies go with every request. */
  val profile: String?,
  val userAgent: String?,
  val referrer: String?,
  val createdAt: Long,
) {
  @Volatile var state: String = DlState.QUEUED
  @Volatile var received: Long = 0
  /** -1 while unknown. */
  @Volatile var total: Long = -1
  /** Error code for the app to word ("network", "http:404", "space", ...). */
  var error: String? = null
  /** Why the download started again from zero: "noRange" (the server can't resume) or "changed" (the file changed). */
  var restarted: String? = null
  /** content:// of the MediaStore row (pending while downloading on Android 10+), or of the scanned file below. */
  var uri: String? = null
  /** Android 9 and older: the partial file, then the final file in the public Downloads directory. */
  var path: String? = null
  var etag: String? = null
  var lastModified: String? = null
  /** The user named the file (Content-Disposition from the WebView), so response headers don't rename it. */
  var nameFixed: Boolean = false
  var finishedAt: Long = 0

  // Runtime only.
  @Volatile var speed: Double = 0.0
  @Volatile var userPaused: Boolean = false
  /** The system stopped the background job: queued again once it runs. */
  @Volatile var held: Boolean = false
  var missing: Boolean = false

  val resumable: Boolean get() = kind == "http"

  fun toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "url" to if (incognito && kind == "page") "" else url,
    "name" to name,
    "mime" to mime,
    "site" to site,
    "state" to state,
    "received" to received.toDouble(),
    "total" to if (total >= 0) total.toDouble() else null,
    "speed" to if (state == DlState.DOWNLOADING && speed > 0) speed else null,
    "error" to error,
    "restarted" to restarted,
    "uri" to if (state == DlState.DONE) uri else null,
    "createdAt" to createdAt.toDouble(),
    "finishedAt" to if (finishedAt > 0) finishedAt.toDouble() else null,
    "incognito" to incognito,
    "resumable" to resumable,
    "missing" to missing,
  )

  fun toJson(): JSONObject = JSONObject().apply {
    put("id", id); put("url", url); put("name", name); put("mime", mime); put("site", site); put("kind", kind)
    put("profile", profile ?: JSONObject.NULL); put("userAgent", userAgent ?: JSONObject.NULL)
    put("referrer", referrer ?: JSONObject.NULL); put("createdAt", createdAt)
    put("state", state); put("received", received); put("total", total); put("error", error ?: JSONObject.NULL)
    put("restarted", restarted ?: JSONObject.NULL); put("uri", uri ?: JSONObject.NULL); put("path", path ?: JSONObject.NULL)
    put("etag", etag ?: JSONObject.NULL); put("lastModified", lastModified ?: JSONObject.NULL)
    put("nameFixed", nameFixed); put("finishedAt", finishedAt); put("userPaused", userPaused)
  }

  companion object {
    fun fromJson(o: JSONObject): DownloadRecord {
      fun str(k: String) = if (o.isNull(k)) null else o.optString(k)
      return DownloadRecord(
        id = o.getString("id"), url = o.getString("url"), name = o.getString("name"),
        mime = o.optString("mime", "application/octet-stream"), site = o.optString("site"),
        kind = o.optString("kind", "http"), incognito = false, profile = str("profile"),
        userAgent = str("userAgent"), referrer = str("referrer"), createdAt = o.optLong("createdAt"),
      ).apply {
        state = o.optString("state", DlState.INTERRUPTED); received = o.optLong("received")
        total = o.optLong("total", -1); error = str("error"); restarted = str("restarted"); uri = str("uri")
        path = str("path"); etag = str("etag"); lastModified = str("lastModified")
        nameFixed = o.optBoolean("nameFixed"); finishedAt = o.optLong("finishedAt"); userPaused = o.optBoolean("userPaused")
      }
    }
  }
}

/** File names: the same rules as src/device/download.ts (safeFileName), plus the type's extension when missing. */
object FileNames {
  private val RESERVED = Regex("[\\\\/:*?\"<>|\\u0000-\\u001f]")

  fun safe(raw: String, fallback: String = "download"): String {
    val clean = raw.replace(RESERVED, " ").replace(Regex("\\s+"), " ").trim().replace(Regex("^\\.+"), "").take(120).trim()
    return clean.ifEmpty { fallback }
  }

  /** The file name a Content-Disposition header gives (filename* first), or null. */
  fun fromDisposition(header: String?): String? {
    if (header.isNullOrBlank()) return null
    Regex("filename\\*\\s*=\\s*([^']*)'[^']*'([^;]+)", RegexOption.IGNORE_CASE).find(header)?.let { m ->
      try {
        val charset = m.groupValues[1].ifBlank { "UTF-8" }
        val value = URLDecoder.decode(m.groupValues[2].trim().trim('"').replace("+", "%2B"), charset)
        safe(value, "").takeIf { it.isNotEmpty() }?.let { return it }
      } catch (_: Exception) {
        // Falls through to the plain parameter.
      }
    }
    val plain = Regex("filename\\s*=\\s*(\"([^\"]*)\"|[^;]+)", RegexOption.IGNORE_CASE).find(header) ?: return null
    val value = (plain.groups[2]?.value ?: plain.groupValues[1]).trim()
    return safe(value, "").takeIf { it.isNotEmpty() }
  }

  fun fromUrl(url: String): String {
    val last = try {
      URLDecoder.decode(android.net.Uri.parse(url).lastPathSegment ?: "", "UTF-8")
    } catch (_: Exception) {
      ""
    }
    return safe(last)
  }

  fun extension(name: String): String? =
    Regex("\\.([A-Za-z0-9]{1,8})$").find(name)?.groupValues?.get(1)?.lowercase(Locale.ROOT)

  fun mimeForExtension(ext: String?): String? =
    ext?.let { MimeTypeMap.getSingleton().getMimeTypeFromExtension(it) }

  private val GENERIC = setOf("", "application/octet-stream", "binary/octet-stream", "application/download",
    "application/force-download", "application/x-download", "application/unknown")

  fun isGeneric(mime: String?): Boolean = mime == null || mime.lowercase(Locale.ROOT) in GENERIC

  /**
   * The name and type to save under: the name's own extension decides the type when Android knows it (so the Downloads
   * collection never appends a second extension), a specific server type adds its extension to a name without one or
   * with the WebView's ".bin" guess.
   */
  fun reconcile(name: String, serverMime: String?): Pair<String, String> {
    val mime = serverMime?.substringBefore(';')?.trim()?.lowercase(Locale.ROOT)
    val ext = extension(name)
    val extMime = mimeForExtension(ext)
    if (!isGeneric(mime) && (ext == null || ext == "bin")) {
      val wanted = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime)
      if (wanted != null) {
        val base = if (ext == "bin") name.dropLast(4) else name
        return safe("$base.$wanted") to mime!!
      }
    }
    return name to (extMime ?: if (ext == null && !isGeneric(mime)) mime!! else "application/octet-stream")
  }
}
