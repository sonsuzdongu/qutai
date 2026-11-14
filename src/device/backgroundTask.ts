import { requireOptionalNativeModule } from 'expo';
import { AppRegistry, AppState, Platform } from 'react-native';
import { t } from '../i18n';

/**
 * "Keep working in the background" (Android, opt-in): an assistant task the user started goes on when they leave
 * Qutai, behind an ongoing notification (modules/qutai-agent).
 *
 * On Android React Native pauses with the activity: JS timers stop and WebView view commands (injectJavaScript, prop
 * changes) wait for the app to come back. While the native side keeps the task alive (a specialUse foreground
 * service), it also runs a headless JS task so timers keep firing, and page commands go through the module straight
 * to the tab's WebView (Tab.ts). Steps that need the user, or a tab that has no live WebView, pause the task with a
 * notification instead (runAgent.ts).
 *
 * iOS: not offered. iOS gives an app only a short time to finish work after it leaves the screen, and WebKit pages
 * stop with it, so tasks pause there as before. Missing in builds made before the module was added: nothing happens.
 */
export type BackgroundPageState = {
  url: string;
  title: string;
  progress: number;
  canGoBack: boolean;
  canGoForward: boolean;
};

type Subscription = { remove(): void };

type QutaiAgentModule = {
  configure(labels: Record<string, string>): void;
  setTask(title: string | null): Promise<void>;
  setStep(text: string): Promise<void>;
  progress(): Promise<void>;
  isActive(): boolean;
  pause(title: string, text: string, reason: string): Promise<void>;
  finish(title: string | null, text: string | null): Promise<void>;
  evaluate(key: string, script: string, poll: string | null, timeoutMs: number): Promise<string | null>;
  pageState(key: string): Promise<BackgroundPageState | null>;
  goBack(key: string): Promise<boolean>;
  addListener(event: 'onStateChange', listener: (e: { state: string; reason: string | null }) => void): Subscription;
  addListener(event: 'onStopRequested' | 'onOpenRequested', listener: () => void): Subscription;
};

const native = Platform.OS === 'android' ? requireOptionalNativeModule<QutaiAgentModule>('QutaiAgent') : null;

/** Must match AgentHub.KEEP_ALIVE_TASK. */
const KEEP_ALIVE_TASK = 'QutaiAgentKeepAlive';

/** Whether this build can keep tasks running in the background (Android with the native module). */
export function backgroundTasksSupported(): boolean {
  return native != null;
}

/** Why a task paused instead of going on in the background. */
export type PauseNeed = 'confirm' | 'onScreen' | 'tab';

let needsForeground = false;

/** A page command could not run because the app is in the background (nothing was run on the page). */
export class NeedsForegroundError extends Error {
  constructor() {
    super('This step needs Qutai on screen.');
    needsForeground = true;
  }
}

/** Whether a NeedsForegroundError was raised since the last call (tools turn errors into text results). */
export function takeNeedsForeground(): boolean {
  const raised = needsForeground;
  needsForeground = false;
  return raised;
}

let pauseCount = 0;
let waitingForUser = 0;
let releaseKeepAlive: (() => void) | null = null;
let lastProgress = 0;
let taskSet = false;

native?.addListener('onStateChange', ({ state }) => {
  if (state === 'paused') pauseCount++;
  if (state !== 'running') {
    releaseKeepAlive?.();
    releaseKeepAlive = null;
  }
});

// Leaving the app while a confirmation is open: the background run pauses at once and says what it waits for.
AppState.addEventListener('change', (next) => {
  if (next !== 'active' && waitingForUser > 0 && isRunningInBackground()) pauseForUser('confirm');
});

/** Runs `ask` (a dialog waiting for the user's answer); leaving the app meanwhile pauses the background run. */
export async function whileWaitingForUser<T>(ask: () => Promise<T>): Promise<T> {
  waitingForUser++;
  try {
    return await ask();
  } finally {
    waitingForUser--;
  }
}

/**
 * Registers the headless JS task the native side starts while a task runs in the background. It does no work: while
 * it is active, React Native keeps JS timers running although the activity is paused. Call before the app renders.
 */
export function registerBackgroundTaskRunner() {
  if (!native) return;
  AppRegistry.registerHeadlessTask(KEEP_ALIVE_TASK, () => () =>
    new Promise<void>((resolve) => {
      if (!native.isActive()) return resolve();
      releaseKeepAlive = resolve;
    }),
  );
}

/** The notification labels in the app's language (call at start and when the language changes). */
export function configureBackgroundTasks() {
  native?.configure({
    channel: t('background.channel'),
    alertsChannel: t('background.alertsChannel'),
    working: t('background.working', { title: '%1$s' }),
    workingPublic: t('background.workingPublic'),
    stop: t('background.stop'),
    open: t('background.open'),
    publicAlert: t('background.publicAlert'),
    paused: t('background.pausedTitle'),
    stalled: t('background.stalled'),
    timeLimit: t('background.timeLimit'),
  });
}

/**
 * A task started. `title` (from the user's own message) when it may go on in the background: the setting is on and
 * the conversation is not incognito; null otherwise. The service only starts if the user then leaves the app.
 */
export function beginBackgroundTask(title: string | null) {
  if (!native) return;
  taskSet = title != null;
  native.setTask(title ? shortTitle(title) : null).catch(() => {});
}

/**
 * The task may no longer go on in the background (it touched an incognito tab): stops the service. The task then
 * pauses as without the setting, and nothing from it appears in a notification.
 */
export function forbidBackground() {
  if (!native || !taskSet) return;
  taskSet = false;
  native.setTask(null).catch(() => {});
}

export type TaskOutcome = { kind: 'done' | 'failed' | 'needsAnswer' | 'stopped'; text?: string };

/** The task ended: stops the service; in the background, a notification says how it ended. */
export function endBackgroundTask(outcome: TaskOutcome) {
  if (!native) return;
  const notify = taskSet && outcome.kind !== 'stopped';
  taskSet = false;
  if (!notify) {
    native.setTask(null).catch(() => {});
    return;
  }
  const line = oneLine(outcome.text ?? '');
  const title =
    outcome.kind === 'done'
      ? t('background.doneTitle')
      : outcome.kind === 'failed'
        ? t('background.failedTitle')
        : t('background.needsAnswerTitle');
  const text =
    outcome.kind === 'done'
      ? t('background.done', { result: line || t('background.doneNoText') })
      : outcome.kind === 'failed'
        ? t('background.failed', { error: line })
        : t('background.needsAnswer');
  native.finish(title, text).catch(() => {});
}

/** Whether the task may go on right now while Qutai is not on screen. */
export function isRunningInBackground(): boolean {
  return !!native && taskSet && native.isActive();
}

/** Increments every time the background run was paused (for the retry of read-only steps). */
export function getBackgroundPauseCount() {
  return pauseCount;
}

/** The step shown in the ongoing notification. */
export function setBackgroundStep(text: string) {
  if (native && taskSet) native.setStep(oneLine(text)).catch(() => {});
}

/** The task moved on (so it is not stalled). Cheap; sent at most every few seconds. */
export function noteBackgroundProgress() {
  const now = Date.now();
  if (!native || !taskSet || now - lastProgress < 5000) return;
  lastProgress = now;
  native.progress().catch(() => {});
}

/** Stops the background run because the next step needs the user, and says so in a notification. */
export async function pauseForUser(need: PauseNeed) {
  if (!native || !taskSet) return;
  const text =
    need === 'confirm' ? t('background.needConfirm') : need === 'tab' ? t('background.needTab') : t('background.needScreen');
  await native.pause(t('background.pausedTitle'), text, need).catch(() => {});
}

export function onBackgroundStopRequested(listener: () => void): Subscription | null {
  return native?.addListener('onStopRequested', listener) ?? null;
}

export function onBackgroundOpenRequested(listener: () => void): Subscription | null {
  return native?.addListener('onOpenRequested', listener) ?? null;
}

// Page commands while the task runs in the background (Tab.ts)

/** Runs `script` in the page of the tab whose WebView has `key`; with `poll`, resolves with its first non-null value. */
export async function evaluateInPage(
  key: string,
  script: string,
  poll: string | null,
  timeoutMs: number,
): Promise<string | null> {
  if (!native) throw new NeedsForegroundError();
  try {
    return await native.evaluate(key, script, poll, timeoutMs);
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_NO_WEBVIEW') throw new NeedsForegroundError();
    throw new Error((e as Error).message || 'The page did not respond.');
  }
}

export async function backgroundPageState(key: string): Promise<BackgroundPageState | null> {
  return native ? native.pageState(key).catch(() => null) : null;
}

export async function backgroundGoBack(key: string): Promise<boolean> {
  if (!native) throw new NeedsForegroundError();
  return native.goBack(key);
}

function oneLine(text: string): string {
  const line =
    text
      .replace(/[*_`#>]+/g, '')
      .split('\n')
      .map((l) => l.trim())
      .find(Boolean) ?? '';
  return line.length > 120 ? `${line.slice(0, 119)}…` : line;
}

function shortTitle(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > 60 ? `${line.slice(0, 59)}…` : line;
}
