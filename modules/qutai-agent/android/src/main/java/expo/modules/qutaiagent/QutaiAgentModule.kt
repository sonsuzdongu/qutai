package expo.modules.qutaiagent

import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Android: lets a running assistant task go on in the background (see [AgentHub]). The JavaScript side is
 * src/device/backgroundTask.ts.
 */
class QutaiAgentModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("QutaiAgent")

    Events("onStateChange", "onStopRequested", "onOpenRequested")

    OnCreate {
      appContext.reactContext?.let { context ->
        AgentHub.init(context) { name, body -> sendEvent(name, body) }
      }
    }

    OnDestroy {
      // The JS runtime is going away (reload): no task can go on.
      appContext.currentActivity?.runOnUiThread { AgentHub.setTask(null) } ?: AgentHub.setTask(null)
    }

    /** The notification labels in the app's language. */
    Function("configure") { options: Map<String, String> ->
      val ctx = appContext.reactContext ?: return@Function
      val d = AgentHub.labelsOrDefault(ctx)
      AgentHub.configure(
        AgentHub.Labels(
          channel = options["channel"] ?: d.channel,
          alertsChannel = options["alertsChannel"] ?: d.alertsChannel,
          working = options["working"] ?: d.working,
          workingPublic = options["workingPublic"] ?: d.workingPublic,
          stop = options["stop"] ?: d.stop,
          open = options["open"] ?: d.open,
          publicAlert = options["publicAlert"] ?: d.publicAlert,
          paused = options["paused"] ?: d.paused,
          stalled = options["stalled"] ?: d.stalled,
          timeLimit = options["timeLimit"] ?: d.timeLimit,
        ),
      )
    }

    /** A task that may continue in the background started (its title), or the task ended / may not (null). */
    AsyncFunction("setTask") { title: String? ->
      AgentHub.setTask(title)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setStep") { text: String ->
      AgentHub.setStep(text)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("progress") {
      AgentHub.progress()
    }.runOnQueue(Queues.MAIN)

    /** Whether the task may go on right now while the app is not in the foreground. */
    Function("isActive") {
      AgentHub.active
    }

    AsyncFunction("pause") { title: String, text: String, reason: String ->
      AgentHub.pause(title, text, reason)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("finish") { title: String?, text: String? ->
      AgentHub.finish(title, text)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("evaluate") { key: String, script: String, poll: String?, timeoutMs: Int, promise: Promise ->
      AgentHub.evaluate(appContext.currentActivity, key, script, poll, timeoutMs, promise)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("pageState") { key: String ->
      AgentHub.pageState(appContext.currentActivity, key)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("goBack") { key: String ->
      AgentHub.goBack(appContext.currentActivity, key)
    }.runOnQueue(Queues.MAIN)

    OnActivityEntersForeground {
      appContext.currentActivity?.runOnUiThread { AgentHub.setForeground(true) }
    }

    OnActivityEntersBackground {
      appContext.currentActivity?.runOnUiThread { AgentHub.setForeground(false) } ?: AgentHub.setForeground(false)
    }

    /** Opened from one of the task's notifications: the app shows the task's conversation. */
    OnNewIntent { intent ->
      if (intent.getBooleanExtra(AgentHub.EXTRA_OPEN, false)) {
        intent.removeExtra(AgentHub.EXTRA_OPEN)
        sendEvent("onOpenRequested", emptyMap<String, Any>())
      }
    }
  }
}
