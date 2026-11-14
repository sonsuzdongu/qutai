package expo.modules.qutaimedia

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.drawable.Icon
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * The mediaPlayback foreground service: keeps Qutai's process alive while a tab plays sound in the background, and
 * shows the media notification with a MediaSession (lock screen, notification, headphone buttons, Android 13+ media
 * controls, and the PiP window's controls). Started and stopped by [PlaybackHub] only.
 *
 * Audio focus is left to the WebView: Chromium requests it when a page becomes audible and pauses the page on a
 * loss (a phone call), so the service never requests it (two owners in one app would pause each other).
 *
 * Other foreground services (the assistant's background task, modules/qutai-agent) are separate services with their
 * own type, channel and notification id; only the channel helper ([NotificationChannels]) is shared, no state, so
 * both can run at once.
 */
class MediaPlaybackService : Service() {
  companion object {
    const val CHANNEL_ID = "qutai_media_playback"
    const val NOTIFICATION_ID = 0x51A1
    private const val ACTION_PREFIX = "expo.modules.qutaimedia.action."
    private const val ART_MAX_BYTES = 2 * 1024 * 1024
    private const val ART_SIZE = 512
  }

  private val main = Handler(Looper.getMainLooper())
  private val artLoader = Executors.newSingleThreadExecutor()
  private lateinit var session: MediaSession
  private var finished = false
  private var artUrl = ""
  private var art: Bitmap? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    session = MediaSession(this, "Qutai").apply {
      setCallback(object : MediaSession.Callback() {
        override fun onPlay() = PlaybackHub.command("play").let {}
        override fun onPause() = PlaybackHub.command("pause").let {}
        override fun onStop() = PlaybackHub.command("pause").let {}
        override fun onSkipToNext() = PlaybackHub.command("nexttrack").let {}
        override fun onSkipToPrevious() = PlaybackHub.command("previoustrack").let {}
        override fun onFastForward() = PlaybackHub.command("seekforward").let {}
        override fun onRewind() = PlaybackHub.command("seekbackward").let {}
        override fun onSeekTo(pos: Long) = PlaybackHub.command("seekto", pos / 1000.0).let {}
      })
      openApp()?.let { setSessionActivity(it) }
      isActive = true
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // Started again after finish() but before onDestroy: it serves the new start.
    finished = false
    // Must go to the foreground right away after startForegroundService, whatever happens next.
    goForeground(build(PlaybackHub.owner))
    PlaybackHub.attach(this)
    when (intent?.action?.removePrefix(ACTION_PREFIX)) {
      "play" -> PlaybackHub.command("play")
      "pause" -> PlaybackHub.command("pause")
      "next" -> PlaybackHub.command("nexttrack")
      "previous" -> PlaybackHub.command("previoustrack")
    }
    PlaybackHub.update()
    return START_NOT_STICKY
  }

  /** Qutai was swiped away in recents: playback ends with it. */
  override fun onTaskRemoved(rootIntent: Intent?) {
    PlaybackHub.pauseAll()
    finish()
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    PlaybackHub.attach(null)
    session.isActive = false
    session.release()
    artLoader.shutdownNow()
    super.onDestroy()
  }

  fun finish() {
    if (finished) return
    finished = true
    PlaybackHub.attach(null)
    if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE) else @Suppress("DEPRECATION") stopForeground(true)
    stopSelf()
  }

  /** Shows the owning page's state in the session and the notification. */
  fun render(page: PageState?) {
    if (finished) return
    val labels = PlaybackHub.labels
    val isPrivate = page?.isPrivate ?: true
    val title = if (isPrivate) labels.privateTab else page!!.title.ifBlank { page.host }
    val artist = if (isPrivate) "" else page!!.artist.ifBlank { page.host }
    val playing = page?.audible == true || (page?.playing == true && !page.paused)
    val durationMs = if (page != null && page.duration > 0) (page.duration * 1000).toLong() else -1L

    loadArtwork(if (isPrivate) "" else page!!.artwork)
    session.setMetadata(
      MediaMetadata.Builder()
        .putString(MediaMetadata.METADATA_KEY_TITLE, title)
        .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
        .putString(MediaMetadata.METADATA_KEY_ALBUM, if (isPrivate) "" else page!!.album)
        .putLong(MediaMetadata.METADATA_KEY_DURATION, durationMs)
        .apply { art?.let { putBitmap(MediaMetadata.METADATA_KEY_ART, it) } }
        .build(),
    )
    var actions = PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE or
      PlaybackState.ACTION_STOP
    val pageActions = page?.actions ?: emptySet()
    if ("nexttrack" in pageActions) actions = actions or PlaybackState.ACTION_SKIP_TO_NEXT
    if ("previoustrack" in pageActions) actions = actions or PlaybackState.ACTION_SKIP_TO_PREVIOUS
    if (durationMs > 0) actions = actions or PlaybackState.ACTION_SEEK_TO
    session.setPlaybackState(
      PlaybackState.Builder()
        .setActions(actions)
        .setState(
          if (playing) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED,
          ((page?.position ?: 0.0) * 1000).toLong(),
          if (playing) (page?.rate ?: 1.0).toFloat() else 0f,
          page?.reportedAt ?: SystemClock.elapsedRealtime(),
        )
        .build(),
    )
    getSystemService(NotificationManager::class.java)?.notify(NOTIFICATION_ID, build(page, title, artist, playing))
  }

  private fun build(
    page: PageState?,
    title: String = PlaybackHub.labels.privateTab,
    artist: String = "",
    playing: Boolean = true,
  ): Notification {
    val labels = PlaybackHub.labels
    NotificationChannels.ensure(this, CHANNEL_ID, labels.channel, NotificationManager.IMPORTANCE_LOW)
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL_ID) else
      @Suppress("DEPRECATION") Notification.Builder(this)
    val pageActions = page?.actions ?: emptySet()
    val compact = ArrayList<Int>()
    var index = 0
    if ("previoustrack" in pageActions) {
      builder.addAction(action(android.R.drawable.ic_media_previous, labels.previous, "previous"))
      index++
    }
    builder.addAction(
      if (playing) action(android.R.drawable.ic_media_pause, labels.pause, "pause")
      else action(android.R.drawable.ic_media_play, labels.play, "play"),
    )
    compact.add(index++)
    if ("nexttrack" in pageActions) builder.addAction(action(android.R.drawable.ic_media_next, labels.next, "next"))
    return builder
      .setSmallIcon(if (playing) android.R.drawable.ic_media_play else android.R.drawable.ic_media_pause)
      .setContentTitle(title)
      .setContentText(artist)
      .setLargeIcon(art)
      .setContentIntent(openApp())
      .setOngoing(playing)
      .setShowWhen(false)
      .setCategory(Notification.CATEGORY_TRANSPORT)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setStyle(
        Notification.MediaStyle()
          .setMediaSession(session.sessionToken)
          .setShowActionsInCompactView(*compact.toIntArray()),
      )
      .build()
  }

  private fun goForeground(notification: Notification) {
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun action(icon: Int, title: String, name: String): Notification.Action {
    val intent = Intent(this, MediaPlaybackService::class.java).setAction(ACTION_PREFIX + name)
    val pending = PendingIntent.getService(
      this, name.hashCode(), intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    return Notification.Action.Builder(Icon.createWithResource(this, icon), title, pending).build()
  }

  private fun openApp(): PendingIntent? {
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return null
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
    return PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  /** The page's artwork (https only, normal tabs only, at most 2 MB, scaled to 512 px), loaded off the main thread. */
  private fun loadArtwork(url: String) {
    if (url == artUrl) return
    artUrl = url
    art = null
    if (!url.startsWith("https://")) return
    artLoader.execute {
      val bitmap = try {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 8000
        connection.readTimeout = 8000
        connection.instanceFollowRedirects = true
        val bytes = connection.inputStream.use { input ->
          val out = java.io.ByteArrayOutputStream()
          val buffer = ByteArray(16 * 1024)
          while (true) {
            val n = input.read(buffer)
            if (n < 0) break
            out.write(buffer, 0, n)
            if (out.size() > ART_MAX_BYTES) throw java.io.IOException("Artwork too large")
          }
          out.toByteArray()
        }
        connection.disconnect()
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        var sample = 1
        while (bounds.outWidth / (sample * 2) >= ART_SIZE && bounds.outHeight / (sample * 2) >= ART_SIZE) sample *= 2
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
      } catch (e: Exception) {
        null
      }
      main.post {
        if (url != artUrl || finished || bitmap == null) return@post
        art = bitmap
        render(PlaybackHub.owner)
      }
    }
  }
}
