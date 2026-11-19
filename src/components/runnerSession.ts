import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo, AppState, Platform } from 'react-native';
import type { PreviewReport } from '../agent/appTool';
import { appStore, appsChanged } from '../apps/appStore';
import { Bridge, type BridgeHost, type HapticKind, type Insets, type ThemeInfo } from '../apps/bridge';
import { parseBridgeRequest, permissionStates } from '../apps/contract';
import { appNavigationAllowed, buildAppDocument, formatDiagnostics, parseAppMessage, type BuiltDocument, type Diagnostic } from '../apps/document';
import { CONTRACT_VERSION, type AppPermission } from '../apps/manifest';
import { appRunner, type RunnerRequest } from '../apps/runnerState';
import type { LoadedApp } from '../apps/store';
import { getLanguage, t } from '../i18n';
import { formatDateTime, formatSize } from '../i18n/format';
import { dialog } from './Dialog';
import { deleteApp, renameApp } from './appActions';

/**
 * One open app (docs/mini-apps.md › The runtime, Lifecycle, Errors and diagnostics): its loaded version, the document,
 * the bridge, diagnostics, the preview's report, the hang watchdog, back handling and the menu's actions. The runner
 * component draws its snapshot; nothing here is React state.
 */

const MAX_DIAGNOSTICS = 50;
const PREVIEW_SETTLE_MS = 3000;
const PREVIEW_AFTER_ERROR_MS = 1000;
const PREVIEW_TIMEOUT_MS = 12000;
const PING_MS = 5000;
const HANG_MS = 12000;

export type Overlay = { kind: 'error'; diagnostics: Diagnostic[] } | { kind: 'crash' } | { kind: 'hang' } | null;

export type RunnerSnapshot = {
  app: LoadedApp | null | 'missing';
  runnable: boolean;
  built: BuiltDocument | null;
  /** Changes on every reload, so the WebView is made again. */
  reload: number;
  title: string;
  overlay: Overlay;
};

export type RunnerCallbacks = {
  onEdit: (app: { id: string; name: string }) => void;
  onFix: (app: { id: string; name: string; version: number }, errors: string) => void;
  onNotice: (text: string) => void;
  toast: (text: string) => void;
};

type WebViewHandle = { injectJavaScript(code: string): void; stopLoading(): void };

function playHaptic(kind: HapticKind) {
  const run = (): Promise<void> => {
    switch (kind) {
      case 'success':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'warning':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      case 'error':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      case 'light':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'medium':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'heavy':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      default:
        return Haptics.selectionAsync();
    }
  };
  run().catch(() => {});
}

function permissionLabel(permission: string): string {
  if (permission === 'clipboard-read') return t('apps.perm.clipboardRead');
  if (permission === 'clipboard-write') return t('apps.perm.clipboardWrite');
  return permission;
}

export class RunnerSession {
  private snap: RunnerSnapshot = { app: null, runnable: false, built: null, reload: 0, title: '', overlay: null };
  private listeners = new Set<() => void>();
  private webview: WebViewHandle | null = null;
  private bridge: Bridge | null = null;
  private diagnostics: Diagnostic[] = [];
  private errorShown = false;
  private ready = false;
  private back = false;
  private lastPong = 0;
  private ping = 0;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private timers: ReturnType<typeof setTimeout | typeof setInterval>[] = [];
  private closed = false;
  private disposers: (() => void)[] = [];
  private theme: ThemeInfo;
  private insets: Insets;

  constructor(
    private request: RunnerRequest,
    private callbacks: RunnerCallbacks,
    environment: { theme: ThemeInfo; insets: Insets },
  ) {
    this.theme = environment.theme;
    this.insets = environment.insets;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  snapshot = () => this.snap;

  private set(patch: Partial<RunnerSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }

  private get loaded(): LoadedApp | null {
    return this.snap.app && this.snap.app !== 'missing' ? this.snap.app : null;
  }

  setWebView = (ref: WebViewHandle | null) => {
    this.webview = ref;
  };

  // ---------- Lifecycle ----------

  start() {
    void this.load();
    if (this.request.preview) this.timers.push(setTimeout(() => this.settle(this.ready), PREVIEW_TIMEOUT_MS));
    const sub = AppState.addEventListener('change', (state) => {
      if (!this.ready) return;
      if (state === 'active') {
        this.lastPong = Date.now();
        this.inject({ event: 'resume' });
      } else this.inject({ event: 'pause' });
    });
    this.disposers.push(() => sub.remove());
    this.timers.push(
      setInterval(() => {
        if (!this.ready || AppState.currentState !== 'active' || this.snap.overlay) return;
        if (Date.now() - this.lastPong > HANG_MS) this.set({ overlay: { kind: 'hang' } });
        else this.inject({ ping: ++this.ping });
      }, PING_MS),
    );
  }

  dispose() {
    this.timers.forEach((timer) => clearTimeout(timer as ReturnType<typeof setTimeout>));
    this.timers.forEach((timer) => clearInterval(timer as ReturnType<typeof setInterval>));
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.disposers.forEach((d) => d());
    this.settle(this.ready);
  }

  private async load() {
    const app = await appStore.load(this.request.appId).catch(() => null);
    if (!app) {
      this.set({ app: 'missing' });
      return this.settle(false);
    }
    const runnable = app.sealed && app.state === 'active' && app.pkg.manifest.contract <= CONTRACT_VERSION;
    this.bridge = new Bridge(this.host(app.id));
    this.set({ app, runnable, title: app.name, built: runnable ? this.build(app) : null });
    void appStore.markOpened(app.id).catch(() => {});
    if (!runnable) this.settle(false);
  }

  private build(app: LoadedApp): BuiltDocument {
    const m = app.pkg.manifest;
    return buildAppDocument(app.pkg, {
      id: m.id,
      name: m.name,
      version: m.version,
      language: m.language,
      uiLanguage: getLanguage(),
      platform: Platform.OS,
      permissions: m.permissions,
      theme: this.theme,
      insets: this.insets,
    });
  }

  /** The phone's theme, text size or safe areas changed while the app is open. */
  setEnvironment(theme: ThemeInfo, insets: Insets) {
    const themeChanged = JSON.stringify(theme) !== JSON.stringify(this.theme);
    const insetsChanged = JSON.stringify(insets) !== JSON.stringify(this.insets);
    this.theme = theme;
    this.insets = insets;
    if (!this.ready) return;
    if (themeChanged) this.inject({ event: 'theme', data: theme });
    if (insetsChanged) this.inject({ event: 'insets', data: insets });
  }

  close = () => {
    if (this.closed) return;
    this.closed = true;
    appRunner.close();
  };

  restart = () => {
    this.diagnostics = [];
    this.errorShown = false;
    this.ready = false;
    this.back = false;
    const app = this.loaded;
    this.set({ overlay: null, reload: this.snap.reload + 1, built: app && this.snap.runnable ? this.build(app) : null });
  };

  /** Android back and the header's close: the app's own back first when it asked for it. */
  onBack = () => {
    if (this.back && this.ready && !this.snap.overlay) return this.inject({ event: 'back' });
    this.close();
  };

  dismissOverlay = () => this.set({ overlay: null });
  crashed = () => this.set({ overlay: { kind: 'crash' } });

  // ---------- Messages ----------

  private inject(message: unknown) {
    this.webview?.injectJavaScript(`window.__qutaiReceive && window.__qutaiReceive(${JSON.stringify(message)}); true;`);
  }

  private report(loaded: boolean): PreviewReport {
    return { loaded, diagnostics: this.diagnostics.slice(), notes: this.snap.built?.notes ?? [], dropped: this.bridge?.dropped ?? 0 };
  }

  private settle(loaded: boolean) {
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = null;
    appRunner.settle(this.request, this.report(loaded));
  }

  private addDiagnostic(d: Diagnostic) {
    this.diagnostics.push(d);
    if (this.diagnostics.length > MAX_DIAGNOSTICS) this.diagnostics.shift();
    if (d.kind !== 'error') return;
    if (this.request.preview && !this.settleTimer) this.settleTimer = setTimeout(() => this.settle(true), PREVIEW_AFTER_ERROR_MS);
    if (!this.errorShown && !this.snap.overlay) {
      this.errorShown = true;
      this.set({ overlay: { kind: 'error', diagnostics: this.diagnostics.filter((x) => x.kind === 'error') } });
    }
  }

  onMessage = (data: string) => {
    const call = parseBridgeRequest(data);
    if (call) {
      void this.bridge?.handle(call).then((answer) => !this.closed && this.inject(answer));
      return;
    }
    const built = this.snap.built;
    if (!built) return;
    const msg = parseAppMessage(data, built.mapLine, Date.now());
    if (!msg) {
      if (this.bridge) this.bridge.dropped++;
      return;
    }
    if (msg.type === 'pong') this.lastPong = Date.now();
    else if (msg.type === 'ready') {
      this.ready = true;
      this.lastPong = Date.now();
      if (this.request.preview && !this.settleTimer) this.settleTimer = setTimeout(() => this.settle(true), PREVIEW_SETTLE_MS);
    } else this.addDiagnostic(msg.diag);
  };

  /** onShouldStartLoadWithRequest: only the app's own document. */
  allowNavigation = (url: string): boolean => {
    if (appNavigationAllowed(url)) return true;
    this.addDiagnostic({ kind: 'blocked', message: `Navigation refused: ${url.slice(0, 120)}`, at: Date.now() });
    return false;
  };

  /**
   * onLoadStart: Android lets a navigation through when the decision above takes over 250 ms (a busy JS thread). A
   * page that isn't the app's document is never shown: loading stops and the app is built again.
   */
  loadStarted = (url: string) => {
    if (appNavigationAllowed(url) || url.startsWith('data:')) return;
    this.webview?.stopLoading();
    this.addDiagnostic({ kind: 'blocked', message: `Navigation stopped: ${url.slice(0, 120)}`, at: Date.now() });
    this.restart();
  };

  // ---------- The bridge's host ----------

  private host(appId: string): BridgeHost {
    const name = () => this.loaded?.name ?? '';
    const fromApp = () => ({ icon: 'apps' as const, text: t('apps.fromApp', { name: name() }) });
    return {
      appId,
      manifest: () => this.loaded!.pkg.manifest,
      store: appStore,
      uiLanguage: getLanguage,
      platform: Platform.OS,
      theme: () => this.theme,
      insets: () => this.insets,
      toast: (text) => {
        this.callbacks.toast(text);
        AccessibilityInfo.announceForAccessibility(text);
      },
      alert: async ({ title, message }) => {
        await dialog.show({ title, message, lines: { lines: [fromApp()] } });
      },
      confirm: async ({ title, message, confirmText, destructive }) => {
        const result = await dialog.show({
          title,
          message,
          lines: { lines: [fromApp()] },
          buttons: [
            { text: t('common.cancel'), style: 'cancel' },
            { text: confirmText || t('common.ok'), style: destructive ? 'destructive' : 'default' },
          ],
        });
        return result.button === null ? null : result.button === 1;
      },
      prompt: async ({ title, message, label, initial, placeholder, maxLength }) => {
        const result = await dialog.show({
          title,
          message,
          lines: { lines: [fromApp()] },
          input: { label: label || title, initial, placeholder, maxLength },
          buttons: [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.ok') }],
        });
        return result.button === 1 ? result.text : null;
      },
      askPermission: async (permission: AppPermission) => {
        const result = await dialog.show({
          title:
            permission === 'clipboard-read' ? t('apps.askClipboardRead', { name: name() }) : t('apps.askPermission', { name: name(), permission }),
          message: permission === 'clipboard-read' ? t('apps.askClipboardReadBody') : undefined,
          buttons: [
            { text: t('apps.deny'), style: 'cancel' },
            { text: t('apps.allow'), primary: true },
          ],
        });
        // "Don't allow" is an answer; only a dismissal by the system is not.
        return result.button === null ? null : result.button === 1 ? 'granted' : 'denied';
      },
      haptic: playHaptic,
      setTitle: (title) => this.set({ title: title || name() }),
      setBackHandler: (enabled) => {
        this.back = enabled;
      },
      close: this.close,
      clipboardWrite: async (text) => {
        await Clipboard.setStringAsync(text);
        this.callbacks.toast(t('common.copied'));
      },
      clipboardRead: async () => (await Clipboard.getStringAsync()) ?? '',
    };
  }

  // ---------- The menu and the overlay's buttons ----------

  askFix = () => {
    const app = this.loaded;
    if (!app) return;
    const errors = formatDiagnostics(
      this.diagnostics.filter((d) => d.kind !== 'console' || d.level === 'error' || d.level === 'warn').slice(-15),
    );
    this.close();
    this.callbacks.onFix({ id: app.id, name: app.name, version: app.version }, errors);
  };

  edit = () => {
    const app = this.loaded;
    if (!app) return;
    this.close();
    this.callbacks.onEdit({ id: app.id, name: app.name });
  };

  showVersions = async () => {
    const app = this.loaded;
    if (!app) return;
    const versions = await appStore.versions(app.id);
    const options = versions.map(
      (v) =>
        `${t('apps.versionLine', { version: v.version, date: formatDateTime(new Date(v.createdAt)) })}` +
        `${v.version === app.version ? ` · ${t('apps.versionCurrent')}` : ''}${v.note ? ` · ${v.note}` : ''}`,
    );
    const result = await dialog.show({
      title: t('apps.versionsTitle', { name: app.name }),
      choices: { label: t('apps.versionsLabel'), options, initial: Math.max(0, versions.findIndex((v) => v.version === app.version)) },
      buttons: [{ text: t('common.cancel'), style: 'cancel' }, { text: t('apps.useVersion') }],
    });
    const chosen = result.button === 1 ? versions[result.choice] : undefined;
    if (!chosen || chosen.version === app.version) return;
    await appStore.setCurrent(app.id, chosen.version);
    appsChanged.emit();
    this.callbacks.onNotice(t('apps.versionUsed', { version: chosen.version }));
    // Opening again builds the chosen version.
    appRunner.open(app.id);
  };

  showPermissions = async () => {
    const app = this.loaded;
    if (!app) return;
    const declared = app.pkg.manifest.permissions;
    if (!declared.length) return void dialog.alert(t('apps.permissionsTitle', { name: app.name }), t('apps.noPermissions'));
    const states = permissionStates(declared, await appStore.grants(app.id));
    const stateText = (s: string) => t(s === 'granted' ? 'apps.permAllowed' : s === 'denied' ? 'apps.permDenied' : 'apps.permAsk');
    const result = await dialog.show({
      title: t('apps.permissionsTitle', { name: app.name }),
      message: t('apps.permissionsBody'),
      choices: { label: t('apps.permissions'), options: declared.map((p) => `${permissionLabel(p)}: ${stateText(states[p])}`) },
      buttons: [{ text: t('common.close'), style: 'cancel' }, { text: t('apps.askAgain') }],
    });
    if (result.button !== 1) return;
    await appStore.setGrant(app.id, declared[result.choice], null);
    this.callbacks.toast(t('apps.permissionReset'));
  };

  rename = async () => {
    const app = this.loaded;
    if (!app) return;
    const name = await renameApp(app);
    if (name) await this.load();
  };

  remove = async () => {
    const app = this.loaded;
    if (!app || !(await deleteApp(app))) return;
    this.close();
    this.callbacks.onNotice(t('apps.deleted', { name: app.name }));
  };

  approve = async () => {
    const app = this.loaded;
    if (!app) return;
    const ok = await dialog.confirm({
      title: t('apps.approveTitle', { name: app.name }),
      message: t('apps.approveBody', {
        files: Object.keys(app.pkg.files).join(', '),
        size: formatSize(Object.values(app.pkg.files).join('').length),
      }),
      confirmText: t('apps.turnOn'),
    });
    if (ok && (await appStore.approveCurrent(app.id))) await this.load();
  };
}
