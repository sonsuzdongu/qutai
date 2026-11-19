package expo.modules.qutaidownloads

import android.Manifest
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.content.ContextCompat
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Android: Qutai's own downloads ([DownloadEngine]) for the app's Downloads screen. The JavaScript side is
 * src/storage/androidDownloads.ts.
 */
class QutaiDownloadsModule : Module() {
  private val context: Context get() = appContext.currentActivity ?: appContext.reactContext ?: DownloadEngine.appContext

  override fun definition() = ModuleDefinition {
    Name("QutaiDownloads")

    Events("onChange", "onOpenRequested", "onOpenFileRequested")

    OnCreate {
      appContext.reactContext?.let { ctx ->
        DownloadEngine.init(ctx)
        DownloadEngine.setListener { items -> sendEvent("onChange", mapOf("items" to items)) }
      }
    }

    OnDestroy {
      DownloadEngine.setListener(null)
    }

    /** "en" / "tr": the notifications follow the app's language. */
    Function("setLanguage") { language: String ->
      DownloadNotifications.setLanguage(context, language)
    }

    Function("list") { DownloadEngine.list() }

    /** Checks that finished files still exist; the result arrives as an onChange event. */
    Function("refresh") { DownloadEngine.refresh() }

    /**
     * Starts an http(s) download with the tab's context. Fields: url, name, nameFixed, mime, site, incognito, profile,
     * userAgent, userAgentSuffix, referrer, length. Resolves with the download's id once it is listed (queued).
     */
    AsyncFunction("start") { req: Map<String, Any?> ->
      val url = req["url"] as? String ?: throw IllegalArgumentException("No address")
      val scheme = Uri.parse(url).scheme?.lowercase()
      if (scheme != "http" && scheme != "https") throw IllegalArgumentException("Only http(s) addresses are downloaded here")
      DownloadEngine.start(
        DownloadEngine.Start(
          url = url,
          name = (req["name"] as? String)?.takeIf { it.isNotBlank() } ?: FileNames.fromUrl(url),
          nameFixed = req["nameFixed"] as? Boolean ?: false,
          mime = (req["mime"] as? String)?.takeIf { it.isNotBlank() },
          site = req["site"] as? String ?: (Uri.parse(url).host ?: ""),
          incognito = req["incognito"] as? Boolean ?: false,
          profile = (req["profile"] as? String)?.takeIf { it.isNotBlank() },
          // The WebView's own user agent when the app doesn't know the tab's (never OkHttp's), with the same
          // " qutai.<build>" ending the tab's WebView adds through applicationNameForUserAgent (userAgentSuffix).
          userAgent = (req["userAgent"] as? String)?.takeIf { it.isNotBlank() }
            ?: try {
              val suffix = (req["userAgentSuffix"] as? String)?.takeIf { it.isNotBlank() }
              android.webkit.WebSettings.getDefaultUserAgent(context).let { if (suffix != null) "$it $suffix" else it }
            } catch (_: Exception) { null },
          referrer = (req["referrer"] as? String)?.takeIf { it.isNotBlank() },
          length = (req["length"] as? Number)?.toLong() ?: -1L,
        ),
      )
    }

    /** A blob: / data: download the app writes in chunks. total -1 when unknown. */
    AsyncFunction("beginWrite") { name: String, mime: String?, site: String, url: String, total: Double, incognito: Boolean ->
      DownloadEngine.beginWrite(name, mime, site, url, total.toLong(), incognito)
    }

    AsyncFunction("writeChunk") { id: String, base64: String ->
      DownloadEngine.writeChunk(id, base64)
    }

    AsyncFunction("endWrite") { id: String ->
      DownloadEngine.endWrite(id)
    }

    AsyncFunction("failWrite") { id: String, code: String ->
      DownloadEngine.failWrite(id, code)
    }

    Function("pause") { id: String -> DownloadEngine.pause(id) }
    Function("resume") { id: String -> DownloadEngine.resume(id) }
    Function("retry") { id: String -> DownloadEngine.retry(id) }
    Function("cancel") { id: String -> DownloadEngine.cancel(id) }
    Function("remove") { id: String -> DownloadEngine.remove(id) }
    Function("pauseAll") { DownloadEngine.pauseAll() }
    Function("resumeAll") { DownloadEngine.resumeAll() }
    Function("clearFinished") { DownloadEngine.clearFinished() }
    Function("clearAll") { DownloadEngine.clearAll() }
    Function("forgetIncognito") { DownloadEngine.forgetIncognito() }
    Function("isMetered") { DownloadEngine.isMetered() }

    /** The Downloads screen is open: the "finished" notifications have been seen. */
    Function("seen") { DownloadNotifications.clearFinished(context) }

    AsyncFunction("deleteFile") { id: String ->
      DownloadEngine.deleteFile(id)
    }

    /**
     * "opened"; "noApp" (nothing on the phone opens this type); "gone" (the file was deleted elsewhere); "denied" (it is
     * there, but Qutai may no longer read it); "failed" (anything else the system refused). An APK goes to the system's
     * installer, which needs REQUEST_INSTALL_PACKAGES (plugins/withDownloads.js) and asks "allow from this source"
     * itself the first time; without that permission it closed again at once and the tap did nothing.
     */
    AsyncFunction("open") { id: String ->
      val rec = DownloadEngine.find(id) ?: return@AsyncFunction "gone"
      val uri = rec.uri ?: return@AsyncFunction "gone"
      val access = DownloadSink(context).access(rec)
      if (access != "ok") return@AsyncFunction access
      val intent = Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse(uri), rec.mime)
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        // The system's own "Open with" picker appears when several apps can open it.
        context.startActivity(intent)
        "opened"
      } catch (_: ActivityNotFoundException) {
        "noApp"
      } catch (_: SecurityException) {
        "denied"
      } catch (_: Exception) {
        "failed"
      }
    }.runOnQueue(Queues.MAIN)

    /** The share sheet with the file. "shared" or "gone". */
    AsyncFunction("share") { id: String, title: String ->
      val rec = DownloadEngine.find(id) ?: return@AsyncFunction "gone"
      val uri = rec.uri?.let(Uri::parse) ?: return@AsyncFunction "gone"
      if (!DownloadSink(context).exists(rec)) return@AsyncFunction "gone"
      val send = Intent(Intent.ACTION_SEND).setType(rec.mime).putExtra(Intent.EXTRA_STREAM, uri)
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      send.clipData = ClipData.newRawUri(rec.name, uri)
      context.startActivity(Intent.createChooser(send, title).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      "shared"
    }.runOnQueue(Queues.MAIN)

    /** Opens the system's Downloads view (the Files app at Downloads); false if the phone has none. */
    AsyncFunction("showFolder") {
      try {
        context.startActivity(Intent(DownloadManager.ACTION_VIEW_DOWNLOADS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
      } catch (_: ActivityNotFoundException) {
        false
      }
    }.runOnQueue(Queues.MAIN)

    /** Android 9 and older write to the public Downloads directory only with WRITE_EXTERNAL_STORAGE. */
    Function("needsStoragePermission") {
      Build.VERSION.SDK_INT < 29 &&
        ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED
    }

    /** The download whose notification opened the app to open that file (cold start), or null; clears the request. */
    Function("consumeOpenFileRequest") {
      val intent = appContext.currentActivity?.intent ?: return@Function null
      val id = intent.getStringExtra(DownloadNotifications.EXTRA_OPEN_FILE)
      if (id != null) intent.removeExtra(DownloadNotifications.EXTRA_OPEN_FILE)
      id
    }

    /** Whether the app was opened from a download notification (cold start); clears the request. */
    Function("consumeOpenRequest") {
      val intent = appContext.currentActivity?.intent ?: return@Function false
      val asked = intent.getBooleanExtra(DownloadNotifications.EXTRA_OPEN, false)
      if (asked) intent.removeExtra(DownloadNotifications.EXTRA_OPEN)
      asked
    }

    OnNewIntent { intent ->
      intent.getStringExtra(DownloadNotifications.EXTRA_OPEN_FILE)?.let { id ->
        intent.removeExtra(DownloadNotifications.EXTRA_OPEN_FILE)
        sendEvent("onOpenFileRequested", mapOf("id" to id))
      }
      if (intent.getBooleanExtra(DownloadNotifications.EXTRA_OPEN, false)) {
        intent.removeExtra(DownloadNotifications.EXTRA_OPEN)
        sendEvent("onOpenRequested", emptyMap<String, Any>())
      }
    }

    OnActivityEntersForeground {
      DownloadKeeper.foreground()
    }
  }
}
