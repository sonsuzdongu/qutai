import { requireOptionalNativeModule } from 'expo';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { siteColor } from '../ui/siteColor';
import { isIncomingWebLink } from './defaultBrowser';
import { onTaskReminderTapped } from './taskSchedule';

/**
 * Ways into Qutai from outside the app: links handed to it as the default browser; qutai:// links (launcher shortcuts
 * and iOS quick actions, automation such as the Shortcuts app's "Open URL"); and (Android, the local module
 * modules/qutai-entry) text and links shared to Qutai, "Qutai" in other apps' text-selection menu and web searches.
 *
 * Everything arriving this way is untrusted: another app or a web page chose it. So nothing is searched with a
 * remote engine, submitted or sent to the AI provider by itself. A web link opens in a normal tab like any link;
 * other text goes to a chooser where the user decides (open, search, ask), into the address field or into the
 * assistant's input, unsent. Only http(s) URLs are ever opened as pages; other schemes are just text. Incognito only
 * through the explicit "new private tab" action.
 *
 * The qutai:// scheme (documented in the README), parsed strictly: exact names, no unknown or repeated parameters.
 *   qutai://open?url=<http(s) URL>   open the page in a normal tab (any other scheme: the chooser, as text)
 *   qutai://search?q=<text>          a new tab with the text in the address field, not submitted
 *   qutai://ask?text=<text>          the assistant with the text in its input, not sent (no text: just open it)
 *   qutai://new-tab                  a new tab with the address field ready
 *   qutai://new-private-tab          a new incognito tab (behind the incognito lock if that is on)
 *   qutai://scan                     the QR code scanner
 *
 * Also a tap on a saved task's reminder (src/device/taskSchedule.ts): only the task's id, read from the database.
 */
export type Entry =
  /** An http(s) page to open in a normal tab. */
  | { kind: 'open'; url: string }
  /** Text from another app: the user picks what to do with it. `url` is the one web link in it, if any. */
  | { kind: 'shared'; text: string; url: string | null }
  /** A new tab with the address field ready, holding `query` (not submitted). */
  | { kind: 'newTab'; incognito: boolean; query: string }
  /** The assistant panel of a normal tab with `text` in its input, unsent. */
  | { kind: 'ask'; text: string }
  | { kind: 'scan' }
  /** The user tapped the reminder of the saved task with this id. */
  | { kind: 'task'; id: string };

/** From the native module: shared text (Android) or a quick action's qutai:// link (iOS). */
type RawEntry = { source?: string; text?: string; subject?: string | null; url?: string };

type QutaiEntryModule = {
  takePending(): RawEntry[];
  isPinShortcutSupported?(): boolean;
  pinSiteShortcut?(url: string, label: string, letter: string, color: string): boolean;
  addListener(event: 'onEntry', listener: () => void): { remove(): void };
};

const native = requireOptionalNativeModule<QutaiEntryModule>('QutaiEntry');

export const MAX_TEXT = 10_000;
const MAX_URL = 4096;
const MAX_APP_LINK = 16_384;

/**
 * Text as it may be shown and edited: control characters (but line breaks and tabs) and the invisible
 * bidirectional overrides that could disguise it are dropped, and it is cut to a sane length.
 */
export function cleanText(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g, '')
    .trim()
    .slice(0, MAX_TEXT);
}

/** The single http(s) link in a shared text ("Title https://…" from many apps), or null if none or several. */
export function webLinkIn(text: string): string | null {
  const found = new Set(
    (text.match(/https?:\/\/[^\s<>"'`]+/gi) ?? []).map((url) => url.replace(/[.,;:!?)\]}’”»]+$/, '')),
  );
  if (found.size !== 1) return null;
  const [url] = found;
  return isIncomingWebLink(url) && url.length <= MAX_URL ? url : null;
}

/** A link opened in Qutai from outside: an http(s) page, or one of the qutai:// actions. */
export function entryFromLink(url: string | null | undefined): Entry | null {
  if (!url) return null;
  if (isIncomingWebLink(url)) return url.length <= MAX_URL && !/\s/.test(url) ? { kind: 'open', url } : null;
  return entryFromAppLink(url);
}

const APP_LINK_PARAMS: Record<string, string[]> = {
  open: ['url'],
  search: ['q'],
  ask: ['text'],
  'new-tab': [],
  'new-private-tab': [],
  scan: [],
};

/** A qutai:// link, or null for anything else (including the development client's own links). */
export function entryFromAppLink(url: string): Entry | null {
  if (url.length > MAX_APP_LINK) return null;
  const match = /^qutai:\/\/([a-z-]+)\/?(?:\?([^#]*))?$/i.exec(url);
  if (!match) return null;
  const action = match[1].toLowerCase();
  const allowed = Object.hasOwn(APP_LINK_PARAMS, action) ? APP_LINK_PARAMS[action] : undefined;
  const params = allowed ? parseQuery(match[2] ?? '') : null;
  if (!allowed || !params || Object.keys(params).some((key) => !allowed.includes(key))) return null;
  switch (action) {
    case 'open': {
      const target = (params.url ?? '').trim();
      if (!target) return null;
      // Only web pages are opened; anything else (javascript:, file:, intent:, other apps' schemes…) is just text.
      return entryFromLink(target) ?? entryFromShared({ text: target });
    }
    case 'search':
      return { kind: 'newTab', incognito: false, query: cleanText(params.q ?? '').replace(/\s+/g, ' ') };
    case 'ask':
      return { kind: 'ask', text: cleanText(params.text ?? '') };
    case 'new-tab':
      return { kind: 'newTab', incognito: false, query: '' };
    case 'new-private-tab':
      return { kind: 'newTab', incognito: true, query: '' };
    default:
      return { kind: 'scan' };
  }
}

/** `a=1&b=2` decoded, or null when malformed or a name repeats. */
function parseQuery(query: string): Record<string, string> | null {
  const decode = (part: string) => {
    try {
      return decodeURIComponent(part.replace(/\+/g, ' '));
    } catch {
      return null;
    }
  };
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const at = pair.indexOf('=');
    const key = decode(at < 0 ? pair : pair.slice(0, at));
    const value = decode(at < 0 ? '' : pair.slice(at + 1));
    if (key === null || value === null || Object.hasOwn(params, key)) return null;
    params[key] = value;
  }
  return params;
}

/** Text shared or handed to Qutai by another app (Android), or an iOS quick action. */
export function entryFromShared(raw: RawEntry): Entry | null {
  if (typeof raw.url === 'string') return entryFromAppLink(raw.url);
  const text = cleanText(typeof raw.text === 'string' ? raw.text : '');
  if (!text) return null;
  return { kind: 'shared', text, url: webLinkIn(text) };
}

/**
 * Android "Add to home screen": asks the launcher to pin a shortcut that opens the page in Qutai, with the site's
 * letter badge. False when the launcher can't pin shortcuts or the build predates it. iOS has no such API for apps
 * (only Safari's own "Add to Home Screen"), so the menu item is Android-only.
 */
export function canPinSiteShortcut(): boolean {
  try {
    return Platform.OS === 'android' && !!native?.isPinShortcutSupported?.();
  } catch {
    return false;
  }
}

export function pinSiteShortcut(url: string, title: string): boolean {
  if (!isIncomingWebLink(url)) return false;
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return false;
  }
  try {
    return !!native?.pinSiteShortcut?.(url, title || host, host.charAt(0), hslToHex(siteColor(host)));
  } catch {
    return false;
  }
}

/** `hsl(h, s%, l%)` (siteColor's format) to `#rrggbb`. */
function hslToHex(hsl: string): string {
  const [h, s, l] = (hsl.match(/[\d.]+/g) ?? ['0', '0', '30']).map(Number);
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const value = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

// The launch link belongs to the process: a remounted browser must not open it again.
let launchLinkTaken = false;

/**
 * Collects entries (at launch, and while running) and hands each to `handle` once, only while `ready` (the app
 * lock is not showing): an entry arriving while the app is locked waits until it is unlocked.
 */
export function useEntryPoints(ready: boolean, handle: (entry: Entry) => void) {
  const queue = useRef<Entry[]>([]);
  const [version, setVersion] = useState(0);
  const handleRef = useRef(handle);
  useEffect(() => {
    handleRef.current = handle;
  });

  useEffect(() => {
    const push = (entries: (Entry | null)[]) => {
      const valid = entries.filter((e): e is Entry => e !== null);
      if (!valid.length) return;
      queue.current.push(...valid);
      setVersion((v) => v + 1);
    };
    const takeNative = () => {
      try {
        push((native?.takePending() ?? []).map(entryFromShared));
      } catch {
        // A build without the module's newest functions: nothing to take.
      }
    };
    if (!launchLinkTaken) {
      launchLinkTaken = true;
      Linking.getInitialURL().then((url) => push([entryFromLink(url)]), () => {});
    }
    takeNative();
    const subs = [
      Linking.addEventListener('url', ({ url }) => push([entryFromLink(url)])),
      native?.addListener('onEntry', takeNative),
      { remove: onTaskReminderTapped((id) => push([{ kind: 'task', id }])) },
      // Belt and braces for an event sent while JavaScript was not listening.
      AppState.addEventListener('change', (state) => state === 'active' && takeNative()),
    ];
    return () => subs.forEach((sub) => sub?.remove());
  }, []);

  useEffect(() => {
    if (!ready || !queue.current.length) return;
    queue.current.splice(0).forEach((entry) => handleRef.current(entry));
  }, [ready, version]);
}
