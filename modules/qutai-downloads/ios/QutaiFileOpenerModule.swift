import ExpoModulesCore
import QuickLook
import UIKit

/// Opening and saving finished downloads on iPhone, iPad and a Mac running the iOS build (DL-19,
/// src/storage/iosDownloads.ts). Only files in Qutai's own Downloads folder (Documents/Downloads) are accepted, and
/// every call follows the user's tap on Open or Save. Android's downloads module (same package) is separate.
public class QutaiFileOpenerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("QutaiFileOpener")

    /// Whether Quick Look can show this file.
    Function("canPreview") { (uri: String) -> Bool in
      guard let url = downloadURL(uri) else { return false }
      return QLPreviewController.canPreview(url as NSURL)
    }

    /// Shows the file in Quick Look (with its own share button). "shown", "unsupported" (Quick Look can't show the
    /// type) or "gone" (not a file in the Downloads folder any more).
    AsyncFunction("preview") { (uri: String, promise: Promise) in
      guard let url = downloadURL(uri) else { return promise.resolve("gone") }
      guard QLPreviewController.canPreview(url as NSURL) else { return promise.resolve("unsupported") }
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        return promise.reject("ERR_NO_SCREEN", "No screen to show the preview on")
      }
      let source = PreviewSource(url: url)
      let controller = QLPreviewController()
      controller.dataSource = source
      controller.delegate = source
      PreviewSource.active = source
      presenter.present(controller, animated: true) {
        promise.resolve("shown")
      }
    }
    .runOnQueue(.main)

    /// Hands the file to the app the system picks for its type (on a Mac: the Mac's default app, as Finder would).
    /// Resolves with whether the system opened it.
    AsyncFunction("openInApp") { (uri: String, promise: Promise) in
      guard let url = downloadURL(uri) else { return promise.resolve(false) }
      UIApplication.shared.open(url, options: [:]) { opened in
        promise.resolve(opened)
      }
    }
    .runOnQueue(.main)

    /// The system's export picker, which saves a copy where the user chooses (the Mac's Downloads folder, or any
    /// folder in Files). "saved", "cancelled" or "gone".
    AsyncFunction("saveCopy") { (uri: String, promise: Promise) in
      guard let url = downloadURL(uri) else { return promise.resolve("gone") }
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        return promise.reject("ERR_NO_SCREEN", "No screen to show the save dialog on")
      }
      let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
      let delegate = ExportDelegate { result in
        promise.resolve(result)
      }
      picker.delegate = delegate
      ExportDelegate.active = delegate
      presenter.present(picker, animated: true)
    }
    .runOnQueue(.main)
  }
}

/// The file URL for a download, only when it is an existing file inside Documents/Downloads (symlinks resolved).
private func downloadURL(_ uri: String) -> URL? {
  guard let url = URL(string: uri), url.isFileURL else { return nil }
  let file = url.standardizedFileURL.resolvingSymlinksInPath()
  let folder = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    .appendingPathComponent("Downloads", isDirectory: true).standardizedFileURL.resolvingSymlinksInPath()
  var isDirectory: ObjCBool = false
  guard file.path.hasPrefix(folder.path + "/"),
        FileManager.default.fileExists(atPath: file.path, isDirectory: &isDirectory), !isDirectory.boolValue else {
    return nil
  }
  return file
}

/// Quick Look's data source for one file; kept alive while the preview is on screen (the controller holds it weakly).
final class PreviewSource: NSObject, QLPreviewControllerDataSource, QLPreviewControllerDelegate {
  static var active: PreviewSource?
  let url: URL

  init(url: URL) {
    self.url = url
  }

  func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
    1
  }

  func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
    url as NSURL
  }

  /// Read-only: the downloaded file is never changed in place (markup saves a copy through the share button).
  func previewController(_ controller: QLPreviewController, editingModeFor previewItem: QLPreviewItem) -> QLPreviewItemEditingMode {
    .disabled
  }

  func previewControllerDidDismiss(_ controller: QLPreviewController) {
    if PreviewSource.active === self {
      PreviewSource.active = nil
    }
  }
}

/// The export picker's answer, reported once; kept alive while the picker is on screen.
final class ExportDelegate: NSObject, UIDocumentPickerDelegate {
  static var active: ExportDelegate?
  private var done: ((String) -> Void)?

  init(done: @escaping (String) -> Void) {
    self.done = done
  }

  private func finish(_ result: String) {
    done?(result)
    done = nil
    if ExportDelegate.active === self {
      ExportDelegate.active = nil
    }
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    finish("saved")
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    finish("cancelled")
  }
}
