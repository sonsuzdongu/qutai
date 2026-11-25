import ExpoModulesCore
import UIKit

/// Home Screen quick actions (long-press the app icon; declared in Info.plist by plugins/withEntryPoints.js). Each
/// item's type is a qutai:// link; JavaScript takes them from here (each once) and handles them like any link to
/// the app (src/device/entryPoints.ts). Cold start: Expo's scene delegate forwards the launch shortcut to the app
/// delegate subscribers before JavaScript runs, so the queue keeps it until JavaScript asks.
public class QutaiEntryModule: Module {
  public func definition() -> ModuleDefinition {
    Name("QutaiEntry")
    Events("onEntry")

    Function("takePending") { () -> [[String: Any]] in
      EntryQueue.shared.take()
    }

    /// Whether this iPhone/iPad build runs on an Apple Silicon Mac ("Designed for iPad"): the address bar starts at the
    /// top there and wide windows get the tab strip (UI-73, UI-74; src/device/macDevice.ts).
    Function("isiOSAppOnMac") { () -> Bool in
      ProcessInfo.processInfo.isiOSAppOnMac
    }

    /// Shares prepared files and/or text to another app after the user's tap on a card: the system share sheet
    /// (UIActivityViewController) with the text and every file, where the user picks the app (and in it the chat).
    /// Whether an app keeps the text next to a file is up to that app's share extension; the JavaScript side copies
    /// the text as well where it may not travel. Resolves with the chosen activity type, or "cancelled".
    AsyncFunction("shareFiles") { (options: [String: Any], promise: Promise) in
      let paths = options["paths"] as? [String] ?? []
      let text = options["text"] as? String
      let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].standardizedFileURL.path
      let subject = options["subject"] as? String ?? ""
      var items: [Any] = []
      if let text = text, !text.isEmpty {
        items.append(SharedText(text: text, subject: subject))
      }
      for path in paths {
        guard let url = URL(string: path), url.isFileURL else {
          promise.reject("ERR_SHARE_FILE", "Not a file URL")
          return
        }
        let standard = url.standardizedFileURL
        let parent = standard.deletingLastPathComponent().deletingLastPathComponent().lastPathComponent
        guard standard.path.hasPrefix(caches + "/"), parent == "outgoing" || parent == "outgoing-incognito",
              FileManager.default.fileExists(atPath: standard.path) else {
          promise.reject("ERR_SHARE_FILE", "Only prepared hand-out files can be shared")
          return
        }
        items.append(standard)
      }
      guard !items.isEmpty, let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject("ERR_SHARE_UNAVAILABLE", "Nothing to share, or no screen to show the share sheet on")
        return
      }
      let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
      if let popover = controller.popoverPresentationController {
        popover.sourceView = presenter.view
        popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.maxY - 80, width: 0, height: 0)
        popover.permittedArrowDirections = []
      }
      controller.completionWithItemsHandler = { activityType, completed, _, _ in
        promise.resolve(completed ? (activityType?.rawValue ?? "completed") : "cancelled")
      }
      presenter.present(controller, animated: true)
    }
    .runOnQueue(.main)

    OnStartObserving {
      EntryQueue.shared.setListener { [weak self] in
        self?.sendEvent("onEntry", [:])
      }
    }

    OnStopObserving {
      EntryQueue.shared.setListener(nil)
    }
  }
}

/// The shared text, with an email subject for apps that ask for one (UIActivityItemSource).
final class SharedText: NSObject, UIActivityItemSource {
  let text: String
  let subject: String

  init(text: String, subject: String) {
    self.text = text
    self.subject = subject
  }

  func activityViewControllerPlaceholderItem(_ activityViewController: UIActivityViewController) -> Any {
    text
  }

  func activityViewController(_ activityViewController: UIActivityViewController, itemForActivityType activityType: UIActivity.ActivityType?) -> Any? {
    text
  }

  func activityViewController(_ activityViewController: UIActivityViewController, subjectForActivityType activityType: UIActivity.ActivityType?) -> String {
    subject
  }
}

public class QutaiEntryAppDelegate: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    let handled = shortcutItem.type.hasPrefix("qutai://")
    if handled {
      EntryQueue.shared.add(["url": shortcutItem.type])
    }
    completionHandler(handled)
  }
}

final class EntryQueue {
  static let shared = EntryQueue()

  private let lock = NSLock()
  private var items: [[String: Any]] = []
  private var listener: (() -> Void)?

  func setListener(_ listener: (() -> Void)?) {
    lock.lock()
    self.listener = listener
    lock.unlock()
  }

  func add(_ entry: [String: Any]) {
    lock.lock()
    items.append(entry)
    if items.count > 5 {
      items.removeFirst(items.count - 5)
    }
    let notify = listener
    lock.unlock()
    notify?()
  }

  func take() -> [[String: Any]] {
    lock.lock()
    defer { lock.unlock() }
    let taken = items
    items = []
    return taken
  }
}
