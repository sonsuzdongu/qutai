import * as Speech from 'expo-speech';
import { useSyncExternalStore } from 'react';
import type { Tab } from '../browser/Tab';

/** Upper bound per utterance; Android's engine rejects long inputs. */
const CHUNK_CHARS = 3000;

let speaking = false;
let session = 0;
const listeners = new Set<() => void>();

function setSpeaking(value: boolean) {
  if (speaking === value) return;
  speaking = value;
  listeners.forEach((l) => l());
}

/** Splits text at sentence or line boundaries into chunks the speech engine accepts. */
export function splitForSpeech(text: string, maxChars = CHUNK_CHARS): string[] {
  const limit = Math.max(1, Math.min(maxChars, Speech.maxSpeechInputLength || maxChars));
  const chunks: string[] = [];
  let rest = text.replace(/[ \t]+/g, ' ').trim();
  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    const cut = Math.max(
      window.lastIndexOf('\n'),
      window.lastIndexOf('. '),
      window.lastIndexOf('! '),
      window.lastIndexOf('? '),
      window.lastIndexOf('; '),
    );
    const at = cut > limit * 0.5 ? cut + 1 : window.lastIndexOf(' ') > 0 ? window.lastIndexOf(' ') : limit;
    chunks.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/** Reads text aloud, replacing anything currently being read. */
export async function speak(text: string, language?: string): Promise<void> {
  await Speech.stop();
  const chunks = splitForSpeech(text);
  if (chunks.length === 0) return;

  const current = ++session;
  setSpeaking(true);
  const finish = () => {
    // A newer speak() or stop() may already own the state.
    if (current === session) setSpeaking(false);
  };
  chunks.forEach((chunk, i) => {
    const last = i === chunks.length - 1;
    Speech.speak(chunk, {
      language,
      onDone: last ? finish : undefined,
      onStopped: finish,
      onError: finish,
    });
  });
}

/** Reads the main content of the page (article or main area, without menus and footers). */
export async function speakPage(tab: Tab): Promise<{ chars: number; truncated: boolean }> {
  const page = await tab.run<{ lang: string; truncated: boolean; text: string }>('readableText', [20000]);
  if (!page.text.trim()) throw new Error('Sayfada okunacak metin bulunamadı.');
  await speak(page.text, page.lang || undefined);
  return { chars: page.text.length, truncated: page.truncated };
}

export async function stopSpeaking(): Promise<void> {
  session++;
  setSpeaking(false);
  await Speech.stop();
}

export function isSpeaking() {
  return speaking;
}

export function useIsSpeaking(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => speaking,
  );
}
