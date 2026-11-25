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
      let source = PreviewSource(url: url)
      let controller = QLPreviewController()
      controller.dataSource = source
      controller.delegate = source
      PreviewSource.active = source
      presentWhenSettled(controller, fallback: self.appContext?.utilities?.currentViewController()) { shown in
        if shown {
          promise.resolve("shown")
        } else {
          PreviewSource.active = nil
          promise.reject("ERR_NO_SCREEN", "No screen to show the preview on")
        }
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
      // Only one save dialog at a time: one still open answers "cancelled" first.
      ExportDelegate.active?.finish("cancelled")
      let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
      let delegate = ExportDelegate { result in
        promise.resolve(result)
      }
      picker.delegate = delegate
      // Closed without an answer (the screen under it went away): "cancelled", never a promise left waiting.
      picker.presentationController?.delegate = delegate
      ExportDelegate.active = delegate
      presentWhenSettled(picker, fallback: self.appContext?.utilities?.currentViewController()) { shown in
        if !shown { delegate.finish("failed") }
      }
    }
    .runOnQueue(.main)
  }
}

/// Presents a system screen (the save dialog, Quick Look) once nothing is opening or closing, on the top screen that
/// is still up. The Downloads screen's ⋯ sheet starts closing as its "Save…" or "Open" runs: presented on that closing
/// sheet, the save dialog went with it at once, its answer never came, and on a Mac the window stopped responding
/// (owner, 26 Nov 2026; DL-19). Waits up to about 2 s for the transitions to end; `done(false)` when there is no screen.
func presentWhenSettled(_ controller: UIViewController, fallback: UIViewController?, attempt: Int = 0,
                        done: @escaping (Bool) -> Void) {
  let top = settledTopController() ?? fallback
  guard let presenter = top else { return done(false) }
  if isTransitioning(presenter), attempt < 20 {
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
      presentWhenSettled(controller, fallback: fallback, attempt: attempt + 1, done: done)
    }
    return
  }
  presenter.present(controller, animated: true) {
    done(true)
  }
}

/// The key window's top presented screen, skipping one that is being dismissed.
private func settledTopController() -> UIViewController? {
  let windows = UIApplication.shared.connectedScenes
    .compactMap { $0 as? UIWindowScene }
    .filter { $0.activationState == .foregroundActive || $0.activationState == .foregroundInactive }
    .flatMap { $0.windows }
  guard let root = (windows.first { $0.isKeyWindow } ?? windows.first)?.rootViewController else { return nil }
  var top = root
  while let next = top.presentedViewController, !next.isBeingDismissed {
    top = next
  }
  return top
}

private func isTransitioning(_ controller: UIViewController) -> Bool {
  if controller.isBeingPresented || controller.isBeingDismissed || controller.transitionCoordinator != nil { return true }
  // A screen above it still on its way out.
  if let above = controller.presentedViewController, above.isBeingDismissed { return true }
  return false
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
final class ExportDelegate: NSObject, UIDocumentPickerDelegate, UIAdaptivePresentationControllerDelegate {
  static var active: ExportDelegate?
  private var done: ((String) -> Void)?

  init(done: @escaping (String) -> Void) {
    self.done = done
  }

  func finish(_ result: String) {
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

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    finish("cancelled")
  }
}
