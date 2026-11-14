import * as Speech from 'expo-speech';
import { useSyncExternalStore } from 'react';
import type { Tab } from '../browser/Tab';
import { t } from '../i18n';

/** Upper bound per utterance; Android's engine rejects long inputs. */
const CHUNK_CHARS = 3000;

let speaking = false;
let session = 0;
const listeners = new Set<() => void>();

/**
 * Reading a reader mode article block by block: which tab, which block is being read (for the
 * highlight), and whether it is paused there. null when reading anything else, or nothing.
 */
export type ReaderReading = { tabId: string; index: number; paused: boolean };
let reading: ReaderReading | null = null;
const readingListeners = new Set<() => void>();

/** Turns the microphone off (voice input) before anything is read aloud: the two never overlap. */
let microphoneGuard: () => void = () => {};

export function setMicrophoneGuard(guard: () => void) {
  microphoneGuard = guard;
}

function setSpeaking(value: boolean) {
  if (speaking === value) return;
  speaking = value;
  listeners.forEach((l) => l());
}

function setReading(value: ReaderReading | null) {
  if (reading === value) return;
  reading = value;
  readingListeners.forEach((l) => l());
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
  microphoneGuard();
  setReading(null);
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

/**
 * Reads a reader mode article aloud from block `from` (0 is the title), one utterance per block
 * (long blocks in several), so the block being read can be highlighted: both platforms report
 * when each utterance starts, while word boundaries depend on the Android speech engine.
 */
export async function speakReader(tab: Tab, from = 0): Promise<{ chars: number; truncated: boolean }> {
  const article = tab.reader?.article;
  if (!article) throw new Error(t('error.nothingToRead'));
  microphoneGuard();
  await Speech.stop();
  const blocks = article.speech;
  const start = Math.max(0, Math.min(from, blocks.length - 1));
  const current = ++session;
  const owned = () => current === session;
  const finish = () => {
    if (!owned()) return;
    setSpeaking(false);
    setReading(null);
  };
  // Pausing stops the engine (Android has no pause), keeping the place to start again from.
  const stopped = () => {
    if (owned()) setSpeaking(false);
  };
  const queue: { index: number; chunk: string; first: boolean }[] = [];
  for (let i = start; i < blocks.length; i++) {
    splitForSpeech(blocks[i]).forEach((chunk, j) => queue.push({ index: i, chunk, first: j === 0 }));
  }
  if (queue.length === 0) throw new Error(t('error.nothingToRead'));
  setSpeaking(true);
  setReading({ tabId: tab.id, index: start, paused: false });
  const language = article.lang || undefined;
  queue.forEach((item, k) => {
    Speech.speak(item.chunk, {
      language,
      onStart: item.first
        ? () => {
            if (owned()) setReading({ tabId: tab.id, index: item.index, paused: false });
          }
        : undefined,
      onDone: k === queue.length - 1 ? finish : undefined,
      onStopped: stopped,
      onError: finish,
    });
  });
  const chars = blocks.slice(start).reduce((sum, block) => sum + block.length, 0);
  return { chars, truncated: false };
}

/** Pauses reading a reader mode article where it is; `resumeReader` goes on from that block. */
export async function pauseReader(): Promise<void> {
  if (!reading || reading.paused) return;
  const at = reading;
  session++;
  setSpeaking(false);
  setReading({ ...at, paused: true });
  await Speech.stop();
}

export async function resumeReader(tab: Tab): Promise<void> {
  const from = reading?.tabId === tab.id ? reading.index : 0;
  await speakReader(tab, from);
}

/**
 * Reads the main content of the page (article or main area, without menus and footers);
 * in reader mode, exactly the article shown.
 */
export async function speakPage(tab: Tab): Promise<{ chars: number; truncated: boolean }> {
  if (tab.reader) return speakReader(tab);
  const page = await tab.run<{ lang: string; truncated: boolean; text: string }>('readableText', [20000]);
  if (!page.text.trim()) throw new Error(t('error.nothingToRead'));
  await speak(page.text, page.lang || undefined);
  return { chars: page.text.length, truncated: page.truncated };
}

export async function stopSpeaking(): Promise<void> {
  session++;
  setSpeaking(false);
  setReading(null);
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

/** Where reading a reader mode article is (or is paused), or null. */
export function useReaderReading(): ReaderReading | null {
  return useSyncExternalStore(
    (listener) => {
      readingListeners.add(listener);
      return () => readingListeners.delete(listener);
    },
    () => reading,
  );
}

export function readerReading(): ReaderReading | null {
  return reading;
}
