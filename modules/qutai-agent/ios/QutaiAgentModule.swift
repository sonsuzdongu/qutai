import ExpoModulesCore
import UIKit

/// iOS part of the assistant module: only `holdRequest`. While an own-key AI request is in flight it holds a
/// background task assertion (UIApplication.beginBackgroundTask), so leaving Qutai doesn't cut the request and the
/// app doesn't send it (and the provider bill it) again on return (src/device/requestHold.ts). Ended as soon as the
/// request ends, when iOS says the time is up, or after the same cap as Android. The task itself never goes on in
/// the background on iOS.
public class QutaiAgentModule: Module {
  /// Mirrors REQUEST_HOLD_MAX_MS (src/device/requestHoldLogic.ts); iOS usually allows far less anyway.
  private static let capSeconds: TimeInterval = 180
  private var task: UIBackgroundTaskIdentifier = .invalid
  private var cap: DispatchWorkItem?

  public func definition() -> ModuleDefinition {
    Name("QutaiAgent")

    AsyncFunction("holdRequest") { (inFlight: Bool) in
      if inFlight { self.begin() } else { self.end() }
    }.runOnQueue(.main)

    OnDestroy {
      DispatchQueue.main.async { self.end() }
    }
  }

  private func begin() {
    guard task == .invalid else { return }
    task = UIApplication.shared.beginBackgroundTask(withName: "QutaiAIRequest") { [weak self] in
      // Time is up: the request may still be cut; the app retries it on return as before.
      self?.end()
    }
    let item = DispatchWorkItem { [weak self] in self?.end() }
    cap = item
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.capSeconds, execute: item)
  }

  private func end() {
    cap?.cancel()
    cap = nil
    guard task != .invalid else { return }
    UIApplication.shared.endBackgroundTask(task)
    task = .invalid
  }
}
