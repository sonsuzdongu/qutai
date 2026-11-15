package expo.modules.qutaientry

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File

/**
 * Hands files and text that the user chose to share to another app, with the standard Android sharing contract
 * (developer.android.com, "Send simple data to other apps"): ACTION_SEND for one file or none, ACTION_SEND_MULTIPLE
 * for several, the files as content URIs from this module's FileProvider in EXTRA_STREAM (and in ClipData, so the
 * read grant reaches the receiver also through the chooser), the text in EXTRA_TEXT, an email subject and addresses
 * in EXTRA_SUBJECT / EXTRA_EMAIL.
 *
 * `targets` are package names tried in order (WhatsApp, then WhatsApp Business): the intent is sent to the first one
 * installed (Intent.setPackage), which WhatsApp's own FAQ documents for sharing to WhatsApp. Without targets, or
 * when none is installed, the system chooser opens. No recipient is chosen here: there is no documented extra for
 * that, so the user picks the chat (or contact) in the receiving app. Nothing is sent by Qutai.
 *
 * Only files in the hand-out folders of the cache (src/device/outgoing.ts) are accepted.
 */
internal object OutgoingShare {
  fun share(
    activity: Activity,
    paths: List<String>,
    mimeType: String,
    text: String?,
    subject: String?,
    emails: List<String>?,
    targets: List<String>,
    chooserTitle: String?,
  ): String {
    val authority = "${activity.packageName}.qutai.share"
    val cache = activity.cacheDir.canonicalFile
    val uris = ArrayList<Uri>()
    for (path in paths) {
      val file = File(Uri.parse(path).path ?: path).canonicalFile
      val parent = file.parentFile?.parentFile?.name
      require(file.path.startsWith(cache.path + File.separator) && (parent == "outgoing" || parent == "outgoing-incognito")) {
        "Only prepared hand-out files can be shared"
      }
      require(file.exists()) { "The file is gone" }
      uris.add(FileProvider.getUriForFile(activity, authority, file))
    }

    val intent = Intent(if (uris.size > 1) Intent.ACTION_SEND_MULTIPLE else Intent.ACTION_SEND).apply {
      type = if (uris.isEmpty()) "text/plain" else mimeType
      if (!text.isNullOrEmpty()) putExtra(Intent.EXTRA_TEXT, text)
      if (!subject.isNullOrEmpty()) putExtra(Intent.EXTRA_SUBJECT, subject)
      if (!emails.isNullOrEmpty()) putExtra(Intent.EXTRA_EMAIL, emails.toTypedArray())
      when (uris.size) {
        0 -> {}
        1 -> putExtra(Intent.EXTRA_STREAM, uris[0])
        else -> putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
      }
      if (uris.isNotEmpty()) {
        val clip = ClipData.newRawUri(null, uris[0])
        for (i in 1 until uris.size) clip.addItem(ClipData.Item(uris[i]))
        clipData = clip
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
    }

    for (pkg in targets) {
      try {
        activity.startActivity(Intent(intent).setPackage(pkg))
        return pkg
      } catch (_: ActivityNotFoundException) {
        // Not installed (or it does not take this type): the next one, then the chooser.
      }
    }
    val chooser = Intent.createChooser(intent, chooserTitle).apply {
      if (uris.isNotEmpty()) addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    activity.startActivity(chooser)
    return "chooser"
  }
}

/** The FileProvider for hand-out files, under its own class so it never clashes with another library's provider. */
class QutaiShareFileProvider : FileProvider()
