import { requireOptionalNativeModule } from 'expo';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { isIncomingWebLink } from './defaultBrowser';

/**
 * Ways into Qutai from outside the app: links handed to it as the default browser, and (Android, the local module
 * modules/qutai-entry) text and links shared to Qutai, "Qutai" in other apps' text-selection menu and web searches.
 *
 * Everything arriving this way is untrusted: another app or a web page chose it. So nothing is searched with a
 * remote engine, submitted or sent to the AI provider by itself. A web link opens in a normal tab like any link;
 * any other text goes to a chooser where the user decides (open, search, ask with the text as an unsent draft).
 * Only http(s) URLs are ever opened as pages; other schemes are just text.
 */
export type Entry =
  /** An http(s) page to open in a normal tab. */
  | { kind: 'open'; url: string }
  /** Text from another app: the user picks what to do with it. `url` is the one web link in it, if any. */
  | { kind: 'shared'; text: string; url: string | null };

type RawEntry = { source?: string; text?: string; subject?: string | null };

type QutaiEntryModule = {
  takePending(): RawEntry[];
  addListener(event: 'onEntry', listener: () => void): { remove(): void };
};

const native = requireOptionalNativeModule<QutaiEntryModule>('QutaiEntry');

export const MAX_TEXT = 10_000;
const MAX_URL = 4096;

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

/** A link opened in Qutai from outside: only http(s) pages. */
export function entryFromLink(url: string | null | undefined): Entry | null {
  if (!url) return null;
  if (isIncomingWebLink(url) && url.length <= MAX_URL && !/\s/.test(url)) return { kind: 'open', url };
  return null;
}

/** Text shared or handed to Qutai by another app (Android). */
export function entryFromShared(raw: RawEntry): Entry | null {
  const text = cleanText(typeof raw.text === 'string' ? raw.text : '');
  if (!text) return null;
  return { kind: 'shared', text, url: webLinkIn(text) };
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
