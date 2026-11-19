import { BridgeError, checkCall, LIMITS, permissionStates, type BridgeAnswer, type BridgeRequest, type Grant, type Grants } from './contract';
import { CONTRACT_VERSION, utf8Length, type AppManifest, type AppPermission } from './manifest';
import type { AppStore } from './store';

/**
 * The phase-1 bridge (docs/mini-apps.md › The bridge contract): one per open app. Every request goes through
 * checkCall (known, implemented, declared, granted — asking first where the contract says so), then its own argument
 * checks, then runs against this app's rows only: the app id comes from the runner, never from the message.
 */

export type ThemeInfo = {
  dark: boolean;
  colors: Record<'bg' | 'surface' | 'sunken' | 'text' | 'textSecondary' | 'tint' | 'onTint' | 'danger' | 'separator' | 'border', string>;
  fontScale: number;
};
export type Insets = { top: number; right: number; bottom: number; left: number };
export type HapticKind = 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';
export const HAPTIC_KINDS: HapticKind[] = ['selection', 'light', 'medium', 'heavy', 'success', 'warning', 'error'];

/** What the runner gives the bridge: Qutai's own dialogs and the phone's services. */
export type BridgeHost = {
  appId: string;
  manifest: () => AppManifest;
  store: AppStore;
  uiLanguage: () => string;
  platform: string;
  theme: () => ThemeInfo;
  insets: () => Insets;
  toast: (text: string) => void;
  alert: (o: { title: string; message?: string }) => Promise<void>;
  /** null: dismissed. */
  confirm: (o: { title: string; message?: string; confirmText?: string; destructive?: boolean }) => Promise<boolean | null>;
  prompt: (o: { title: string; message?: string; label?: string; initial?: string; placeholder?: string; maxLength?: number }) => Promise<string | null>;
  /** Qutai's permission dialog; null: dismissed (not an answer). */
  askPermission: (permission: AppPermission) => Promise<Grant | null>;
  haptic: (kind: HapticKind) => void;
  setTitle: (title: string) => void;
  setBackHandler: (enabled: boolean) => void;
  close: () => void;
  clipboardWrite: (text: string) => Promise<void>;
  clipboardRead: () => Promise<string>;
};

function text(value: unknown, what: string, max: number, optional = false): string | undefined {
  if (value === undefined || value === null) {
    if (optional) return undefined;
    throw new BridgeError('E_BAD_ARGS', `${what} is missing`);
  }
  if (typeof value !== 'string') throw new BridgeError('E_BAD_ARGS', `${what} must be text`);
  if ([...value].length > max) throw new BridgeError('E_TOO_LARGE', `${what} is longer than ${max} characters`);
  return value;
}

export class Bridge {
  private inFlight = 0;
  private dialogOpen = false;
  /** Requests dropped as malformed, for the diagnostics. */
  dropped = 0;

  constructor(private host: BridgeHost) {}

  private async grants(): Promise<Grants> {
    return this.host.store.grants(this.host.appId);
  }

  /** One dialog at a time: a second one while the first is open fails with E_BUSY. */
  private async dialog<T>(open: () => Promise<T>): Promise<T> {
    if (this.dialogOpen) throw new BridgeError('E_BUSY', 'A dialog is already open.');
    this.dialogOpen = true;
    try {
      return await open();
    } finally {
      this.dialogOpen = false;
    }
  }

  async handle(req: BridgeRequest): Promise<BridgeAnswer> {
    if (this.inFlight >= LIMITS.inFlight) return { id: req.id, ok: false, error: { code: 'E_BUSY', message: 'Too many calls at once.' } };
    this.inFlight++;
    try {
      return { id: req.id, ok: true, value: await this.run(req.call, req.args) };
    } catch (e) {
      const error =
        e instanceof BridgeError
          ? { code: e.code, message: e.message }
          : { code: 'E_INTERNAL' as const, message: `Qutai could not do this: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300) };
      return { id: req.id, ok: false, error };
    } finally {
      this.inFlight--;
    }
  }

  private async permissionState(permission: AppPermission): Promise<Grant> {
    const manifest = this.host.manifest();
    const check = checkCall(permissionCall(permission), manifest.permissions, await this.grants());
    if (check.ok === true) return 'granted';
    if (check.ok === false) {
      if (check.code === 'E_DENIED') return 'denied';
      throw new BridgeError(check.code, check.message);
    }
    const answer = await this.dialog(() => this.host.askPermission(permission));
    if (!answer) throw new BridgeError('E_CANCELLED', 'The user closed the question without answering.');
    await this.host.store.setGrant(this.host.appId, permission, answer);
    return answer;
  }

  private async run(call: string, a: Record<string, unknown>): Promise<unknown> {
    const { host } = this;
    const manifest = host.manifest();
    const check = checkCall(call, manifest.permissions, await this.grants());
    if (check.ok === false) throw new BridgeError(check.code, check.message);
    if (check.ok === 'ask') {
      if ((await this.permissionState(check.permission)) !== 'granted')
        throw new BridgeError('E_DENIED', `The user did not allow "${check.permission}" for this app.`);
    }
    const id = host.appId;
    const store = host.store;
    switch (call) {
      case 'app.info':
        return {
          id,
          name: manifest.name,
          version: manifest.version,
          contract: CONTRACT_VERSION,
          language: manifest.language,
          uiLanguage: host.uiLanguage(),
          platform: host.platform,
          permissions: manifest.permissions,
          granted: permissionStates(manifest.permissions, await this.grants()),
          theme: host.theme(),
        };
      case 'app.permissions':
        return { declared: manifest.permissions, granted: permissionStates(manifest.permissions, await this.grants()) };
      case 'app.requestPermission': {
        const permission = a.permission as AppPermission;
        if (typeof permission !== 'string') throw new BridgeError('E_BAD_ARGS', 'permission is missing');
        if (!manifest.permissions.includes(permission))
          throw new BridgeError('E_NOT_DECLARED', `"${permission}" is not in the app's manifest.`);
        return this.permissionState(permission);
      }
      case 'app.close':
        host.close();
        return true;
      case 'storage.get':
        return store.kvGet(id, a.key);
      case 'storage.getMany':
        return store.kvGetMany(id, a.keys);
      case 'storage.set':
        return store.kvSet(id, a.key, a.value);
      case 'storage.setMany':
        return store.kvSetMany(id, a.entries);
      case 'storage.remove':
        return store.kvRemove(id, a.key);
      case 'storage.keys':
        return store.kvKeys(id, a.prefix);
      case 'storage.usage':
        return { used: await store.usage(id), quota: LIMITS.quotaBytes };
      case 'storage.batch':
        return store.batch(id, a.ops);
      case 'docs.add':
        return (await store.batch(id, [{ op: 'add', collection: a.collection, doc: a.doc }]))[0];
      case 'docs.put':
        return (await store.batch(id, [{ op: 'put', collection: a.collection, id: a.id, doc: a.doc }]))[0];
      case 'docs.update':
        return (await store.batch(id, [{ op: 'update', collection: a.collection, id: a.id, patch: a.patch }]))[0];
      case 'docs.delete':
        return (await store.batch(id, [{ op: 'delete', collection: a.collection, id: a.id }]))[0];
      case 'docs.get':
        return store.docGet(id, a.collection, a.id);
      case 'docs.query': {
        const { collection, ...query } = a;
        return store.docQuery(id, collection, query);
      }
      case 'docs.count': {
        const { collection, ...query } = a;
        return store.docCount(id, collection, query);
      }
      case 'docs.clear':
        return store.docClear(id, a.collection);
      case 'docs.collections':
        return store.collections(id);
      case 'ui.theme':
        return host.theme();
      case 'ui.insets':
        return host.insets();
      case 'ui.toast':
        host.toast(text(a.text, 'text', LIMITS.toast)!);
        return true;
      case 'ui.alert': {
        const title = text(a.title, 'title', LIMITS.title * 2)!;
        const message = text(a.message, 'message', LIMITS.dialogText, true);
        await this.dialog(() => host.alert({ title, message }));
        return true;
      }
      case 'ui.confirm': {
        const options = {
          title: text(a.title, 'title', LIMITS.title * 2)!,
          message: text(a.message, 'message', LIMITS.dialogText, true),
          confirmText: text(a.confirmText, 'confirmText', 30, true),
          destructive: a.destructive === true,
        };
        return (await this.dialog(() => host.confirm(options))) === true;
      }
      case 'ui.prompt': {
        const maxLength = a.maxLength === undefined ? 500 : Number(a.maxLength);
        if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 2000) throw new BridgeError('E_BAD_ARGS', 'maxLength is 1 to 2000');
        const options = {
          title: text(a.title, 'title', LIMITS.title * 2)!,
          message: text(a.message, 'message', LIMITS.dialogText, true),
          label: text(a.label, 'label', 60, true),
          initial: text(a.initial, 'initial', maxLength, true),
          placeholder: text(a.placeholder, 'placeholder', 60, true),
          maxLength,
        };
        return this.dialog(() => host.prompt(options));
      }
      case 'ui.haptic': {
        const kind = (a.kind ?? 'selection') as HapticKind;
        if (!HAPTIC_KINDS.includes(kind)) throw new BridgeError('E_BAD_ARGS', `kind is one of ${HAPTIC_KINDS.join(', ')}`);
        host.haptic(kind);
        return true;
      }
      case 'ui.setTitle':
        host.setTitle(text(a.title ?? '', 'title', LIMITS.title)!.replace(/[\u0000-\u001f]+/g, ' ').trim());
        return true;
      case 'ui.setBackHandler':
        host.setBackHandler(a.enabled === true);
        return true;
      case 'clipboard.write': {
        const value = text(a.text, 'text', Number.MAX_SAFE_INTEGER)!;
        if (utf8Length(value) > LIMITS.clipboardBytes) throw new BridgeError('E_TOO_LARGE', 'text is larger than 100 KB');
        await host.clipboardWrite(value);
        return true;
      }
      case 'clipboard.read':
        return host.clipboardRead();
      default:
        throw new BridgeError('E_NOT_AVAILABLE', `${call} is not available in this version of Qutai.`);
    }
  }
}

/** A call that needs the permission, to run the same checks for app.requestPermission. */
function permissionCall(permission: AppPermission): string {
  const map: Record<AppPermission, string> = {
    'clipboard-write': 'clipboard.write',
    'clipboard-read': 'clipboard.read',
    share: 'share.text',
    files: 'files.pick',
    location: 'location.current',
    notifications: 'notifications.schedule',
    camera: 'camera.takePhoto',
    photos: 'photos.pick',
    links: 'app.openLink',
    assistant: 'assistant.ask',
    network: 'network.fetch',
  };
  return map[permission];
}
