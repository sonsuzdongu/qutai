package expo.modules.qutaidownloads

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.util.Base64
import android.util.Log
import android.webkit.CookieManager
import com.reactnativecommunity.webview.RNCWebViewProfiles
import okhttp3.Call
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.io.InterruptedIOException
import java.io.OutputStream
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.zip.GZIPInputStream

/**
 * Qutai's own downloads on Android (instead of the system DownloadManager): fetched with OkHttp using the tab's
 * context (user agent, referrer, the cookies of the tab's own WebView profile, read again for every host a redirect
 * leads to), written to the public Downloads collection through [DownloadSink], listed for the app's Downloads screen
 * and shown in one notification ([DownloadNotifications]) while [DownloadKeeper] keeps the process running in the
 * background (a user-initiated data transfer job on Android 14+, a dataSync foreground service before).
 *
 * At most [MAX_PARALLEL] run at once, the rest queue. Pause / resume use a range request guarded by If-Range with the
 * stored validator; without range support or when the file changed, the download starts again from zero and says so.
 * Network errors retry with backoff, and wait for a network instead of failing while offline. The list is kept in a
 * small JSON file (incognito downloads only in memory), so after the process is killed or the phone restarts the
 * downloads that were running show as interrupted and resumable.
 */
object DownloadEngine {
  private const val TAG = "QutaiDownloads"
  private const val MAX_PARALLEL = 3
  private const val MAX_REDIRECTS = 10
  private const val MAX_ATTEMPTS = 6
  /** Kept free on top of the file itself. */
  private const val SPACE_MARGIN = 20L * 1024 * 1024
  private const val EMIT_MS = 300L
  private const val SAVE_MS = 4000L
  private const val BUFFER = 64 * 1024

  lateinit var appContext: Context
    private set
  private var ready = false
  private val records = LinkedHashMap<String, DownloadRecord>()
  private val workers = ConcurrentHashMap<String, Worker>()
  /** Page downloads (blob: / data:) the app is writing chunk by chunk. */
  private val writers = ConcurrentHashMap<String, OutputStream>()
  private val pool = Executors.newCachedThreadPool()
  private lateinit var handler: Handler
  private lateinit var sink: DownloadSink
  private lateinit var listFile: File
  private lateinit var cleanupFile: File
  private var listener: ((List<Map<String, Any?>>) -> Unit)? = null
  private var emitPending = false
  private var lastSave = 0L
  @Volatile var online = true
    private set

  private val client: OkHttpClient by lazy {
    OkHttpClient.Builder()
      .followRedirects(false)
      .followSslRedirects(false)
      .connectTimeout(20, TimeUnit.SECONDS)
      .readTimeout(30, TimeUnit.SECONDS)
      .retryOnConnectionFailure(true)
      .build()
  }

  private class Worker(val rec: DownloadRecord) {
    @Volatile var stop: String? = null
    @Volatile var call: Call? = null
    @Volatile var thread: Thread? = null
    fun halt(reason: String) {
      stop = reason
      call?.cancel()
      thread?.interrupt()
    }
  }

  private class Stopped(val reason: String) : Exception()
  private class Fatal(val code: String) : Exception(code)
  private class Retryable(message: String) : IOException(message)

  @Synchronized
  fun init(context: Context) {
    if (ready) return
    appContext = context.applicationContext
    val thread = HandlerThread("qutai-downloads").apply { start() }
    handler = Handler(thread.looper)
    sink = DownloadSink(appContext)
    val dir = File(appContext.filesDir, "qutai-downloads").apply { mkdirs() }
    listFile = File(dir, "list.json")
    cleanupFile = File(dir, "incognito-partials.json")
    load()
    watchNetwork()
    ready = true
  }

  fun setListener(l: ((List<Map<String, Any?>>) -> Unit)?) {
    listener = l
  }

  // ---------- Public operations (any thread) ----------

  fun list(): List<Map<String, Any?>> = synchronized(this) { records.values.reversed().map { it.toMap() } }

  /** Checks that finished files still exist (the user may have deleted them in a file manager). */
  fun refresh() {
    val done = synchronized(this) { records.values.filter { it.state == DlState.DONE } }
    pool.execute {
      var changed = false
      for (rec in done) {
        val missing = !sink.exists(rec)
        if (missing != rec.missing) {
          rec.missing = missing
          changed = true
        }
      }
      if (changed) emitNow()
    }
  }

  data class Start(
    val url: String,
    val name: String,
    val nameFixed: Boolean,
    val mime: String?,
    val site: String,
    val incognito: Boolean,
    val profile: String?,
    val userAgent: String?,
    val referrer: String?,
    val length: Long,
  )

  fun start(req: Start): String {
    val (name, mime) = FileNames.reconcile(FileNames.safe(req.name), req.mime)
    val rec = DownloadRecord(
      id = newId(), url = req.url, name = name, mime = mime, site = req.site, kind = "http",
      incognito = req.incognito, profile = req.profile, userAgent = req.userAgent, referrer = req.referrer,
      createdAt = System.currentTimeMillis(),
    ).apply {
      nameFixed = req.nameFixed
      if (req.length > 0) total = req.length
    }
    synchronized(this) { records[rec.id] = rec }
    changed(rec, save = true)
    schedule()
    return rec.id
  }

  /** A blob: or data: download the app writes in chunks (beginWrite, writeChunk..., endWrite). */
  fun beginWrite(name: String, mime: String?, site: String, url: String, total: Long, incognito: Boolean): String {
    val (fixed, type) = FileNames.reconcile(FileNames.safe(name), mime)
    val rec = DownloadRecord(
      id = newId(), url = url, name = fixed, mime = type, site = site, kind = "page", incognito = incognito,
      profile = null, userAgent = null, referrer = null, createdAt = System.currentTimeMillis(),
    ).apply {
      this.total = total
      state = DlState.DOWNLOADING
    }
    if (total > 0 && sink.freeBytes() < total + SPACE_MARGIN) {
      rec.state = DlState.FAILED
      rec.error = "space"
      synchronized(this) { records[rec.id] = rec }
      changed(rec, save = true)
      return rec.id
    }
    synchronized(this) { records[rec.id] = rec }
    try {
      writers[rec.id] = sink.open(rec, append = false)
      if (incognito) rememberIncognitoPartial(rec)
    } catch (e: Exception) {
      rec.state = DlState.FAILED
      rec.error = "file"
    }
    changed(rec, save = true)
    DownloadKeeper.update()
    return rec.id
  }

  /** Appends base64 bytes; false when the download was cancelled or failed meanwhile (the app stops sending). */
  fun writeChunk(id: String, base64: String): Boolean {
    val rec = get(id) ?: return false
    val out = writers[id] ?: return false
    if (rec.state != DlState.DOWNLOADING) return false
    return try {
      val bytes = Base64.decode(base64, Base64.DEFAULT)
      out.write(bytes)
      rec.received += bytes.size
      changed(rec)
      true
    } catch (e: Exception) {
      failWrite(id, "file")
      false
    }
  }

  fun endWrite(id: String): Boolean {
    val rec = get(id) ?: return false
    val out = writers.remove(id) ?: return false
    try {
      out.close()
    } catch (_: IOException) {
    }
    if (rec.total > 0 && rec.received != rec.total) {
      sink.delete(rec)
      return fail(rec, "size").let { false }
    }
    if (rec.total < 0) rec.total = rec.received
    return complete(rec)
  }

  fun failWrite(id: String, code: String) {
    val rec = get(id) ?: return
    writers.remove(id)?.let { try { it.close() } catch (_: IOException) {} }
    sink.delete(rec)
    rec.uri = null
    rec.path = null
    fail(rec, code)
  }

  fun pause(id: String) {
    val rec = get(id) ?: return
    if (rec.kind != "http") return
    when (rec.state) {
      DlState.DOWNLOADING -> workers[id]?.halt(DlState.PAUSED)
      DlState.QUEUED, DlState.WAITING -> setState(rec, DlState.PAUSED)
      else -> return
    }
    rec.userPaused = true
  }

  fun resume(id: String) {
    val rec = get(id) ?: return
    if (rec.kind != "http") return
    if (rec.state !in setOf(DlState.PAUSED, DlState.INTERRUPTED, DlState.FAILED, DlState.WAITING)) return
    rec.userPaused = false
    rec.error = null
    setState(rec, DlState.QUEUED)
    schedule()
  }

  /** Starts again from zero (a failed download whose partial file is gone, or a page download is not retried here). */
  fun retry(id: String) {
    val rec = get(id) ?: return
    if (rec.kind != "http") return
    if (rec.state == DlState.FAILED && !sink.exists(rec)) {
      rec.received = 0
      rec.uri = null
      rec.path = null
    }
    resume(id)
  }

  fun cancel(id: String) {
    val rec = get(id) ?: return
    if (rec.state == DlState.DONE) return
    val worker = workers[id]
    if (worker != null) {
      worker.halt("cancel")
      return
    }
    if (writers.containsKey(id)) {
      failWrite(id, "cancelled")
      removeRecord(rec)
      return
    }
    pool.execute {
      sink.delete(rec)
      removeRecord(rec)
    }
  }

  fun pauseAll() = synchronized(this) { records.values.filter { it.state in DlState.ACTIVE }.map { it.id } }.forEach(::pause)

  fun resumeAll() = synchronized(this) {
    records.values.filter { it.state == DlState.PAUSED || it.state == DlState.INTERRUPTED }.map { it.id }
  }.forEach(::resume)

  fun cancelActive() = synchronized(this) {
    records.values.filter { it.state in DlState.ACTIVE || it.state == DlState.PAUSED }.map { it.id }
  }.forEach(::cancel)

  /** Removes the entry from the list; the file stays (a running download is cancelled first). */
  fun remove(id: String) {
    val rec = get(id) ?: return
    if (rec.state != DlState.DONE && rec.state != DlState.FAILED) return cancel(id)
    if (rec.state == DlState.FAILED) pool.execute { sink.delete(rec) }
    removeRecord(rec)
  }

  /** Deletes the finished file and its entry. */
  fun deleteFile(id: String): Boolean {
    val rec = get(id) ?: return false
    if (rec.state != DlState.DONE) {
      cancel(id)
      return true
    }
    val removed = sink.delete(rec) || !sink.exists(rec)
    if (removed) removeRecord(rec)
    return removed
  }

  /** "Clear finished": the list only, files stay. */
  fun clearFinished() {
    val done = synchronized(this) { records.values.filter { it.state == DlState.DONE || it.state == DlState.FAILED } }
    done.forEach { if (it.state == DlState.FAILED) pool.execute { sink.delete(it) } }
    synchronized(this) { done.forEach { records.remove(it.id) } }
    emitNow()
    save()
  }

  /** Clear browsing data: running downloads stop, the list empties; finished files stay in Downloads. */
  fun clearAll() {
    cancelActive()
    clearFinished()
  }

  /**
   * The incognito session ended: its running downloads are cancelled (partial files removed) and its finished ones
   * leave the list. The finished files themselves stay in Downloads: the user asked for them.
   */
  fun forgetIncognito() {
    val ids = synchronized(this) { records.values.filter { it.incognito }.map { it.id } }
    for (id in ids) {
      val rec = get(id) ?: continue
      if (rec.state == DlState.DONE) removeRecord(rec) else cancel(id)
    }
  }

  fun find(id: String): DownloadRecord? = get(id)

  fun activeCount(): Int = synchronized(this) { records.values.count { it.state in DlState.ACTIVE } }

  fun snapshot(): List<DownloadRecord> = synchronized(this) { records.values.toList() }

  /** The background job was stopped by the system: running downloads wait until it runs again. */
  fun holdForSystem() {
    workers.values.forEach { it.halt("held") }
  }

  fun releaseHeld() {
    synchronized(this) { records.values.filter { it.held } }.forEach { it.held = false }
    schedule()
  }

  // ---------- Scheduling ----------

  @Synchronized
  private fun schedule() {
    if (!ready) return
    val running = workers.size
    var free = MAX_PARALLEL - running
    if (free > 0 && online) {
      for (rec in records.values) {
        if (free <= 0) break
        if (rec.state != DlState.QUEUED || rec.held || workers.containsKey(rec.id)) continue
        val worker = Worker(rec)
        workers[rec.id] = worker
        rec.state = DlState.DOWNLOADING
        pool.execute { run(worker) }
        free--
      }
    }
    DownloadKeeper.update()
    emitSoon()
  }

  private fun run(worker: Worker) {
    val rec = worker.rec
    worker.thread = Thread.currentThread()
    var attempt = 0
    try {
      while (true) {
        try {
          transfer(worker)
          complete(rec)
          return
        } catch (e: Stopped) {
          stopped(rec, e.reason)
          return
        } catch (e: Fatal) {
          if (worker.stop != null) {
            stopped(rec, worker.stop!!)
            return
          }
          fail(rec, e.code)
          return
        } catch (e: IOException) {
          worker.stop?.let {
            stopped(rec, it)
            return
          }
          if (e is DownloadSink.SinkGone) {
            rec.received = 0
            rec.uri = null
            rec.path = null
            continue
          }
          Log.w(TAG, "Download error (attempt ${attempt + 1})", e)
          if (!isOnline()) {
            online = false
            setState(rec, DlState.WAITING)
            return
          }
          if (++attempt >= MAX_ATTEMPTS) {
            fail(rec, "network")
            return
          }
          try {
            Thread.sleep(minOf(30_000L, 1000L shl attempt))
          } catch (_: InterruptedException) {
            stopped(rec, worker.stop ?: DlState.PAUSED)
            return
          }
          worker.stop?.let {
            stopped(rec, it)
            return
          }
        } catch (e: Exception) {
          Log.w(TAG, "Download failed", e)
          fail(rec, "file")
          return
        }
      }
    } finally {
      workers.remove(rec.id)
      Thread.interrupted()
      schedule()
    }
  }

  private fun stopped(rec: DownloadRecord, reason: String) {
    rec.speed = 0.0
    when (reason) {
      "cancel" -> {
        sink.delete(rec)
        removeRecord(rec)
      }
      "held" -> {
        rec.held = true
        setState(rec, DlState.QUEUED)
      }
      else -> setState(rec, DlState.PAUSED)
    }
  }

  // ---------- The transfer ----------

  private fun transfer(worker: Worker) {
    val rec = worker.rec
    var offset = if (rec.received > 0 && sink.exists(rec)) rec.received else 0L
    if (offset == 0L) rec.received = 0
    val canResume = rec.etag?.takeIf { !it.startsWith("W/") } ?: rec.lastModified
    if (offset > 0 && canResume == null) {
      // Nothing tells whether the file on the server is still the same: start again.
      offset = 0
      rec.received = 0
      rec.restarted = "noRange"
    }
    val response = request(worker, rec.url, offset, canResume)
    response.use { res ->
      val code = res.code
      if (code == 416 && offset > 0) {
        if (rec.total in 1..offset) return
        throw restartFromZero(rec, "changed")
      }
      if (code == 429 || code in 500..599) throw Retryable("HTTP $code")
      if (code !in 200..299) throw Fatal("http:$code")
      var append = false
      if (offset > 0) {
        val start = Regex("bytes (\\d+)-").find(res.header("Content-Range") ?: "")?.groupValues?.get(1)?.toLongOrNull()
        if (code == 206 && start == offset) {
          append = true
        } else {
          // The server sent the whole file: it can't resume or the file changed (If-Range didn't match).
          rec.restarted = if (res.header("Accept-Ranges")?.contains("bytes") == true) "changed" else "noRange"
          rec.received = 0
          offset = 0
        }
      }
      val encoded = res.header("Content-Encoding")?.lowercase(Locale.ROOT)?.let { it != "identity" } ?: false
      if (!append) adoptHeaders(rec, res, encoded)
      val length = if (encoded) -1L else res.body?.contentLength() ?: -1L
      if (!append) rec.total = length
      val need = if (rec.total > 0) rec.total - offset else 0L
      if (need > 0 && sink.freeBytes() < need + SPACE_MARGIN) throw Fatal("space")
      val body = res.body ?: throw Retryable("No body")
      val out = sink.open(rec, append)
      if (rec.incognito) rememberIncognitoPartial(rec)
      changed(rec, save = true)
      val input = if (encoded && res.header("Content-Encoding")?.contains("gzip") == true) GZIPInputStream(body.byteStream()) else body.byteStream()
      val buffer = ByteArray(BUFFER)
      var windowStart = SystemClock.elapsedRealtime()
      var windowBytes = 0L
      out.use {
        input.use {
          while (true) {
            worker.stop?.let { reason -> throw Stopped(reason) }
            val n = try {
              input.read(buffer)
            } catch (e: InterruptedIOException) {
              worker.stop?.let { reason -> throw Stopped(reason) }
              throw e
            }
            if (n < 0) break
            out.write(buffer, 0, n)
            rec.received += n
            windowBytes += n
            val now = SystemClock.elapsedRealtime()
            if (now - windowStart >= 1000) {
              val current = windowBytes * 1000.0 / (now - windowStart)
              rec.speed = if (rec.speed <= 0) current else rec.speed * 0.6 + current * 0.4
              windowStart = now
              windowBytes = 0
            }
            changed(rec)
          }
        }
      }
      if (rec.total > 0 && rec.received != rec.total) {
        // Short or overlong: a short one resumes on the next attempt, an overlong one starts over.
        if (rec.received > rec.total) throw restartFromZero(rec, "changed")
        throw Retryable("Got ${rec.received} of ${rec.total} bytes")
      }
      if (rec.total < 0) rec.total = rec.received
    }
  }

  private fun restartFromZero(rec: DownloadRecord, why: String): Retryable {
    rec.received = 0
    rec.restarted = why
    return Retryable("Restarting: $why")
  }

  /** The final response's name, type and validators (first byte of a new transfer). */
  private fun adoptHeaders(rec: DownloadRecord, res: Response, encoded: Boolean) {
    val disposition = FileNames.fromDisposition(res.header("Content-Disposition"))
    val type = res.header("Content-Type")
    if (rec.uri == null && rec.path == null) {
      val base = if (disposition != null && !rec.nameFixed) disposition else rec.name
      val (name, mime) = FileNames.reconcile(base, type ?: rec.mime)
      rec.name = name
      rec.mime = mime
    }
    rec.etag = if (encoded) null else res.header("ETag")
    rec.lastModified = if (encoded) null else res.header("Last-Modified")
  }

  /** GET with the tab's context; follows redirects itself so each host gets only its own cookies. */
  private fun request(worker: Worker, startUrl: String, offset: Long, validator: String?): Response {
    var url = startUrl
    var referrer = worker.rec.referrer
    val cookies = cookieManager(worker.rec)
    repeat(MAX_REDIRECTS + 1) {
      // Read as a browser reads an address (OkHttp's HttpUrl), not java.net.URI: that one refuses "|", "[" or a space
      // in a path or query, which real download links carry, and the download ended as "the file couldn't be saved".
      val target = url.toHttpUrlOrNull() ?: throw Fatal("unsupported")
      val builder = Request.Builder().url(target).get()
        // Bytes as the server stores them, so lengths and ranges match the file.
        .header("Accept-Encoding", "identity")
      worker.rec.userAgent?.let { builder.header("User-Agent", it) }
      referrerFor(referrer, url)?.let { builder.header("Referer", it) }
      cookies?.getCookie(url)?.takeIf { it.isNotBlank() }?.let { builder.header("Cookie", it) }
      if (offset > 0) {
        builder.header("Range", "bytes=$offset-")
        validator?.let { builder.header("If-Range", it) }
      }
      val call = client.newCall(builder.build())
      worker.call = call
      worker.stop?.let { throw Stopped(it) }
      val res = call.execute()
      res.headers("Set-Cookie").forEach { cookies?.setCookie(url, it) }
      if (res.code in setOf(301, 302, 303, 307, 308)) {
        val location = res.header("Location")
        res.close()
        if (location.isNullOrBlank()) throw Fatal("http:${res.code}")
        referrer = url
        url = target.resolve(location)?.toString() ?: throw Fatal("unsupported")
        return@repeat
      }
      return res
    }
    throw Fatal("redirects")
  }

  /** strict-origin-when-cross-origin, like a browser: full address on the same origin, the origin elsewhere, none on https -> http. */
  private fun referrerFor(referrer: String?, target: String): String? {
    if (referrer.isNullOrBlank()) return null
    return try {
      val from = referrer.toHttpUrlOrNull() ?: return null
      val to = target.toHttpUrlOrNull() ?: return null
      if (from.scheme == "https" && to.scheme == "http") return null
      if (from.scheme == to.scheme && from.host == to.host && from.port == to.port) referrer.substringBefore('#')
      else from.resolve("/")?.newBuilder()?.username("")?.password("")?.build()?.toString()
    } catch (_: Exception) {
      null
    }
  }

  /** The tab's profile's cookie manager (looked up on the main thread, WebView's rule for profiles). */
  private fun cookieManager(rec: DownloadRecord): CookieManager? {
    if (rec.profile == null) return CookieManager.getInstance()
    val result = arrayOfNulls<CookieManager>(1)
    val latch = java.util.concurrent.CountDownLatch(1)
    android.os.Handler(android.os.Looper.getMainLooper()).post {
      try {
        result[0] = RNCWebViewProfiles.cookieManagerForProfile(rec.profile)
      } catch (e: Throwable) {
        // An incognito profile that no longer exists: no cookies, never the normal profile's.
        Log.w(TAG, "No cookies for the profile", e)
      }
      latch.countDown()
    }
    latch.await(5, TimeUnit.SECONDS)
    return result[0]
  }

  // ---------- Endings ----------

  private fun complete(rec: DownloadRecord): Boolean {
    if (!sink.finish(rec)) return fail(rec, "file").let { false }
    rec.speed = 0.0
    rec.error = null
    rec.finishedAt = System.currentTimeMillis()
    setState(rec, DlState.DONE)
    forgetIncognitoPartial(rec)
    DownloadNotifications.finished(appContext, rec)
    return true
  }

  private fun fail(rec: DownloadRecord, code: String) {
    rec.speed = 0.0
    rec.error = code
    setState(rec, DlState.FAILED)
    if (code != "cancelled") DownloadNotifications.failed(appContext, rec)
  }

  // ---------- State, events, persistence ----------

  private fun get(id: String): DownloadRecord? = synchronized(this) { records[id] }

  private fun setState(rec: DownloadRecord, state: String) {
    rec.state = state
    changed(rec, save = true)
    DownloadKeeper.update()
  }

  private fun removeRecord(rec: DownloadRecord) {
    synchronized(this) { records.remove(rec.id) }
    forgetIncognitoPartial(rec)
    DownloadNotifications.dismiss(appContext, rec)
    emitNow()
    save()
    DownloadKeeper.update()
  }

  private fun changed(rec: DownloadRecord, save: Boolean = false) {
    if (save || SystemClock.elapsedRealtime() - lastSave > SAVE_MS) save()
    if (save) emitNow() else emitSoon()
  }

  private fun emitSoon() {
    synchronized(this) {
      if (emitPending) return
      emitPending = true
    }
    handler.postDelayed({
      synchronized(this) { emitPending = false }
      emit()
    }, EMIT_MS)
  }

  private fun emitNow() = handler.post { emit() }

  private fun emit() {
    listener?.invoke(list())
    DownloadNotifications.updateOngoing(appContext)
  }

  private fun save() {
    lastSave = SystemClock.elapsedRealtime()
    val json = JSONArray()
    synchronized(this) { records.values.filter { !it.incognito }.forEach { json.put(it.toJson()) } }
    handler.post {
      try {
        val tmp = File(listFile.parentFile, "list.json.tmp")
        tmp.writeText(json.toString())
        tmp.renameTo(listFile)
      } catch (e: IOException) {
        Log.w(TAG, "Couldn't save the downloads list", e)
      }
    }
  }

  private fun load() {
    try {
      if (listFile.exists()) {
        val json = JSONArray(listFile.readText())
        for (i in 0 until json.length()) {
          val rec = DownloadRecord.fromJson(json.getJSONObject(i))
          if (rec.state in DlState.ACTIVE) {
            // The process ended while it ran (killed, phone restarted): resumable from where it stopped.
            rec.state = if (rec.kind == "http") DlState.INTERRUPTED else DlState.FAILED
            if (rec.kind != "http") rec.error = "interrupted"
          }
          records[rec.id] = rec
        }
      }
    } catch (e: Exception) {
      Log.w(TAG, "Couldn't read the downloads list", e)
    }
    // Partial files of incognito downloads from an earlier run go (their entries were never written down).
    try {
      if (cleanupFile.exists()) {
        val left = JSONObject(cleanupFile.readText())
        left.keys().forEach { id ->
          val o = left.getJSONObject(id)
          val rec = DownloadRecord(id, "", "", "", "", "page", true, null, null, null, 0).apply {
            uri = if (o.isNull("uri")) null else o.getString("uri")
            path = if (o.isNull("path")) null else o.getString("path")
          }
          pool.execute { sink.delete(rec) }
        }
        cleanupFile.delete()
      }
    } catch (e: Exception) {
      Log.w(TAG, "Couldn't clean up incognito partial files", e)
    }
  }

  private val partials = JSONObject()

  /** An incognito download's partial file, removed at the next start if the app dies before it finishes. */
  private fun rememberIncognitoPartial(rec: DownloadRecord) = synchronized(partials) {
    if (partials.has(rec.id)) return@synchronized
    partials.put(rec.id, JSONObject().put("uri", rec.uri ?: JSONObject.NULL).put("path", rec.path ?: JSONObject.NULL))
    cleanupFile.writeText(partials.toString())
  }

  private fun forgetIncognitoPartial(rec: DownloadRecord) = synchronized(partials) {
    if (partials.remove(rec.id) == null) return@synchronized
    if (partials.length() == 0) cleanupFile.delete() else cleanupFile.writeText(partials.toString())
  }

  private fun newId(): String =
    java.lang.Long.toString(System.currentTimeMillis(), 36) + java.lang.Long.toString((Math.random() * 1e9).toLong(), 36)

  // ---------- Network ----------

  fun isOnline(): Boolean {
    val cm = appContext.getSystemService(ConnectivityManager::class.java) ?: return true
    val caps = cm.getNetworkCapabilities(cm.activeNetwork ?: return false) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
  }

  fun isMetered(): Boolean {
    val cm = appContext.getSystemService(ConnectivityManager::class.java) ?: return false
    return cm.isActiveNetworkMetered
  }

  private fun watchNetwork() {
    val cm = appContext.getSystemService(ConnectivityManager::class.java) ?: return
    online = isOnline()
    try {
      cm.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
          online = true
          // Downloads waiting for a network continue.
          synchronized(this@DownloadEngine) { records.values.filter { it.state == DlState.WAITING } }.forEach {
            it.state = DlState.QUEUED
          }
          schedule()
        }

        override fun onLost(network: Network) {
          online = isOnline()
        }
      })
    } catch (e: Exception) {
      Log.w(TAG, "No network callback", e)
    }
  }
}
