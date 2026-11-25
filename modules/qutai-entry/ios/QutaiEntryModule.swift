import ExpoModulesCore
import ObjectiveC
import UIKit

/// Home Screen quick actions (long-press the app icon; declared in Info.plist by plugins/withEntryPoints.js). Each
/// item's type is a qutai:// link; JavaScript takes them from here (each once) and handles them like any link to
/// the app (src/device/entryPoints.ts). Cold start: Expo's scene delegate forwards the launch shortcut to the app
/// delegate subscribers before JavaScript runs, so the queue keeps it until JavaScript asks.
public class QutaiEntryModule: Module {
  public func definition() -> ModuleDefinition {
    Name("QutaiEntry")
    Events("onEntry", "onShortcut")

    // On a Mac: no phantom status-bar / home-indicator insets (UI-79). Before JavaScript lays anything out.
    OnCreate {
      MacSafeArea.installIfNeeded()
    }

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

    /// Keyboard shortcuts on a Mac and an iPad with a hardware keyboard (UI-76; the list and its titles come from
    /// src/ui/keyShortcuts.ts). Each item: id, input ("tab" for the Tab key), modifiers (command, shift, control,
    /// alternate), the title iPad shows while ⌘ is held and `hidden` (a second key for the same shortcut, not listed
    /// again). An empty list removes them.
    Function("setKeyShortcuts") { (items: [[String: Any]]) in
      // UIKit state: on the main thread (a sync function runs on the JavaScript thread).
      DispatchQueue.main.async { KeyShortcuts.shared.set(items) }
    }

    OnStartObserving("onEntry") {
      EntryQueue.shared.setListener { [weak self] in
        self?.sendEvent("onEntry", [:])
      }
    }

    OnStopObserving("onEntry") {
      EntryQueue.shared.setListener(nil)
    }

    OnStartObserving("onShortcut") {
      KeyShortcuts.shared.listener = { [weak self] id in
        self?.sendEvent("onShortcut", ["id": id])
      }
    }

    OnStopObserving("onShortcut") {
      KeyShortcuts.shared.listener = nil
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

/// The app's keyboard shortcuts (UI-76). They are given to UIKit through the app delegate's `keyCommands`: the app
/// delegate is the last responder of every chain (after the window and UIApplication), so they work whatever has focus,
/// a page, a text field, a modal screen or nothing at all, while a focused text field still handles its own editing
/// keys first (⌘C, ⌘V, ⌘X, ⌘A, ⌘Z are never registered here). No change to ios/ or the AppDelegate source: the getter
/// is added to the delegate's class at run time, keeping any commands it or its superclass already gives.
final class KeyShortcuts {
  static let shared = KeyShortcuts()
  var listener: ((String) -> Void)?
  private(set) var commands: [UIKeyCommand] = []
  private var installed = false

  func set(_ items: [[String: Any]]) {
    install()
    // ⌥Space (id "voice", UI-81) is the keyboard's Qutai button: its press and release are watched in sendEvent below;
    // its key command only lists it in iPad's ⌘-hold overlay and keeps the key from typing into a field.
    voiceEnabled = items.contains { $0["id"] as? String == "voice" }
    if voiceEnabled { installPressWatch() } else { voiceDown = false }
    commands = items.compactMap { item in
      guard let id = item["id"] as? String, let input = item["input"] as? String, !input.isEmpty else { return nil }
      var flags: UIKeyModifierFlags = []
      for modifier in item["modifiers"] as? [String] ?? [] {
        switch modifier {
        case "command": flags.insert(.command)
        case "shift": flags.insert(.shift)
        case "control": flags.insert(.control)
        case "alternate": flags.insert(.alternate)
        default: break
        }
      }
      let command = UIKeyCommand(
        title: item["title"] as? String ?? "",
        image: nil,
        action: #selector(UIResponder.qutaiKeyShortcut(_:)),
        input: input == "tab" ? "\t" : input,
        modifierFlags: flags,
        propertyList: id
      )
      // A second key for the same shortcut (⌘= for ⌘+): works, but isn't listed again in iPad's ⌘-hold overlay.
      if item["hidden"] as? Bool == true { command.attributes = .hidden }
      if #available(iOS 15.0, *) {
        // Ours wins over the system's own use of a key (⌃Tab, ⌘[), as in desktop browsers.
        command.wantsPriorityOverSystemBehavior = true
      }
      return command
    }
  }

  fileprivate func fire(_ id: String) {
    // The voice key's own command: its press and release come from watch(_:).
    if id == "voice" { return }
    listener?(id)
  }

  private var voiceEnabled = false
  private var voiceDown = false
  private var pressWatchInstalled = false

  /// Sees every key press on its way in (without taking it): ⌥Space down reports "voiceDown", the Space key coming up
  /// afterwards (whether or not ⌥ is still held) "voiceUp".
  private func installPressWatch() {
    guard !pressWatchInstalled else { return }
    pressWatchInstalled = true
    // The window losing focus (another app, a Mac's menu, the app going away) ends a held ⌥Space: its key-up may
    // never come here (UI-81).
    for name in [UIApplication.willResignActiveNotification, UIScene.willDeactivateNotification] {
      NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { _ in
        KeyShortcuts.shared.voiceLost()
      }
    }
    let selector = #selector(UIApplication.sendEvent(_:))
    guard let method = class_getInstanceMethod(UIApplication.self, selector) else { return }
    typealias Send = @convention(c) (UIApplication, Selector, UIEvent) -> Void
    let original = unsafeBitCast(method_getImplementation(method), to: Send.self)
    let block: @convention(block) (UIApplication, UIEvent) -> Void = { app, event in
      if let presses = event as? UIPressesEvent { KeyShortcuts.shared.watch(presses) }
      original(app, selector, event)
    }
    method_setImplementation(method, imp_implementationWithBlock(block))
  }

  fileprivate func voiceLost() {
    guard voiceDown else { return }
    voiceDown = false
    listener?("voiceCancel")
  }

  private func watch(_ event: UIPressesEvent) {
    guard voiceEnabled else { return }
    for press in event.allPresses {
      guard let key = press.key, key.keyCode == .keyboardSpacebar else { continue }
      switch press.phase {
      case .began:
        let others = key.modifierFlags.subtracting([.alternate, .alphaShift, .numericPad])
        if !voiceDown, key.modifierFlags.contains(.alternate), others.isEmpty {
          voiceDown = true
          listener?("voiceDown")
        }
      case .ended, .cancelled:
        if voiceDown {
          voiceDown = false
          listener?("voiceUp")
        }
      default:
        break
      }
    }
  }

  private func install() {
    guard !installed, let delegate = UIApplication.shared.delegate as? UIResponder else { return }
    installed = true
    let cls: AnyClass = type(of: delegate)
    let selector = #selector(getter: UIResponder.keyCommands)
    typealias Getter = @convention(c) (AnyObject, Selector) -> NSArray?
    // What the class gives today (its own getter, or the inherited one): kept in front of ours.
    let previous = class_getMethodImplementation(cls, selector).map { unsafeBitCast($0, to: Getter.self) }
    let block: @convention(block) (AnyObject) -> NSArray? = { object in
      let existing = (previous?(object, selector) as? [UIKeyCommand]) ?? []
      return (existing + KeyShortcuts.shared.commands) as NSArray
    }
    let imp = imp_implementationWithBlock(block)
    if let method = class_getInstanceMethod(cls, selector), !class_addMethod(cls, selector, imp, method_getTypeEncoding(method)) {
      // The class defines keyCommands itself: replace it with ours, which still calls the original first.
      method_setImplementation(method, imp)
    }
  }
}

extension UIResponder {
  /// The action of every shortcut: found on the first responder, wherever focus is, and handed to JavaScript.
  @objc func qutaiKeyShortcut(_ sender: UIKeyCommand) {
    guard let id = sender.propertyList as? String else { return }
    KeyShortcuts.shared.fire(id)
  }
}

/// On a Mac ("Designed for iPad"), UIKit still reports top and bottom safe-area insets for a status bar and a home
/// indicator the window doesn't have, which left an empty band under the macOS title bar (UI-79). Every view's
/// `safeAreaInsets` getter drops them there, so React Native's SafeAreaView and SafeAreaProvider (and so every inset the
/// app reads), modal screens and web pages' `env(safe-area-inset-*)` start right under the title bar. Left and right
/// insets are kept. iPhone and iPad: not installed. The window's raw insets are logged once per value ("Qutai Mac safe
/// area"), to check what macOS reports.
enum MacSafeArea {
  private static var installed = false
  private static var logged = Set<String>()

  static func installIfNeeded() {
    guard ProcessInfo.processInfo.isiOSAppOnMac, !installed else { return }
    installed = true
    let selector = #selector(getter: UIView.safeAreaInsets)
    guard let method = class_getInstanceMethod(UIView.self, selector) else { return }
    typealias Getter = @convention(c) (UIView, Selector) -> UIEdgeInsets
    let original = unsafeBitCast(method_getImplementation(method), to: Getter.self)
    let block: @convention(block) (UIView) -> UIEdgeInsets = { view in
      var insets = original(view, selector)
      if view is UIWindow || view.window?.rootViewController?.view === view { note(insets) }
      insets.top = 0
      insets.bottom = 0
      return insets
    }
    method_setImplementation(method, imp_implementationWithBlock(block))
  }

  private static func note(_ insets: UIEdgeInsets) {
    let key = "top=\(insets.top) left=\(insets.left) bottom=\(insets.bottom) right=\(insets.right)"
    guard !logged.contains(key) else { return }
    logged.insert(key)
    NSLog("Qutai Mac safe area (window or root view, before UI-79): %@", key)
  }
}
