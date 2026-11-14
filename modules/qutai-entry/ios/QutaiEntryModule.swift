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
