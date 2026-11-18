import * as Speech from 'expo-speech';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import type { Tab } from '../browser/Tab';
import { pickVoice, speechLanguage, type VoiceChoice, type VoiceInfo } from '../chat/speechLanguage';
import { t } from '../i18n';
import { languageName } from './voiceLanguage';
import { getDb, getJson, setJson } from '../storage/db';

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

/** Shows a short message (a toast); set by the app. */
let notice: (message: string) => void = () => {};

export function setSpeechNotice(show: (message: string) => void) {
  notice = show;
}

/** The phone's voices, kept for a while (a voice may be installed meanwhile). Empty lists aren't kept. */
let voiceCache: { voices: VoiceInfo[]; at: number } | null = null;
const VOICE_CACHE_MS = 10 * 60 * 1000;
/** How long reading waits for the voice list the first time; after that it reads without it. */
const VOICE_WAIT_MS = 1500;
/** Languages the user was already told have no voice (once per app run). */
const toldMissing = new Set<string>();
/** The voice chosen per language this run (iOS), so it never changes between sentences or answers. */
const chosen = new Map<string, string>();
/** Rate and pitch of every utterance: the engine's natural ones (1 = AVSpeechUtteranceDefaultSpeechRate on iOS). */
const VOICE_RATE = 1;
const VOICE_PITCH = 1;
/** Languages the user was told how to get a more natural voice for (once per install). */
const BETTER_VOICE_KEY = 'speech.betterVoiceTold';
let betterVoiceTold: Promise<Set<string>> | null = null;

function toldBetterVoice(): Promise<Set<string>> {
  betterVoiceTold ??= getDb()
    .then((db) => getJson<string[]>(db, BETTER_VOICE_KEY))
    .then((list) => new Set(list ?? []))
    .catch(() => new Set<string>());
  return betterVoiceTold;
}

/** Once per language and install: how to get a more natural voice than the basic one installed. Never waits. */
function offerBetterVoice(base: string) {
  void toldBetterVoice().then((told) => {
    if (told.has(base)) return;
    told.add(base);
    notice(t(Platform.OS === 'ios' ? 'speech.betterVoiceIos' : 'speech.betterVoiceAndroid', { language: languageName(base) }));
    void getDb()
      .then((db) => setJson(db, BETTER_VOICE_KEY, [...told]))
      .catch(() => {});
  });
}

async function phoneVoices(): Promise<VoiceInfo[]> {
  if (voiceCache && Date.now() - voiceCache.at < VOICE_CACHE_MS) return voiceCache.voices;
  const listed = Speech.getAvailableVoicesAsync()
    .then((voices) => {
      // Android engines may answer with nothing before they are ready: unknown, asked again next time.
      if (voices.length) voiceCache = { voices, at: Date.now() };
      return voices as VoiceInfo[];
    })
    .catch(() => [] as VoiceInfo[]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<VoiceInfo[]>((resolve) => (timer = setTimeout(() => resolve([]), VOICE_WAIT_MS)));
  const voices = await Promise.race([listed, late]);
  clearTimeout(timer);
  return voices;
}

/**
 * The speech options for a text: the voice of the language it is written in (chat/speechLanguage.ts), `hint` (a
 * page's `lang`, or what the assistant named) only where the text doesn't say. Without a voice for that language
 * the phone's default voice reads, and the user is told once.
 */
async function voiceFor(text: string, hint?: string): Promise<VoiceChoice> {
  const language = speechLanguage(text, hint);
  const base = language ? language.toLowerCase().split(/[-_]/)[0] : '';
  const choice = pickVoice(language, language ? await phoneVoices() : [], Platform.OS, chosen.get(base));
  if (choice.voice) chosen.set(base, choice.voice);
  if (choice.lowQuality && base) offerBetterVoice(base);
  if (__DEV__) console.log(`[speech] text language ${language ?? 'unknown'} → ${JSON.stringify(choice)}`);
  if (choice.missing && !toldMissing.has(choice.missing)) {
    toldMissing.add(choice.missing);
    notice(t('speech.noVoice', { language: languageName(choice.missing) }));
  }
  return choice;
}

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

/**
 * Reads text aloud, replacing anything currently being read, in the voice of the language the text is written in;
 * `hint` (a page's `lang`, or what the assistant named) counts only where the text's language isn't clear.
 */
export async function speak(text: string, hint?: string): Promise<void> {
  microphoneGuard();
  setReading(null);
  await Speech.stop();
  const chunks = splitForSpeech(text);
  if (chunks.length === 0) return;

  const current = ++session;
  const { language, voice } = await voiceFor(text, hint);
  // Stopped, or something else started reading, while the voices were looked up.
  if (current !== session) return;
  setSpeaking(true);
  const finish = () => {
    // A newer speak() or stop() may already own the state.
    if (current === session) setSpeaking(false);
  };
  chunks.forEach((chunk, i) => {
    const last = i === chunks.length - 1;
    Speech.speak(chunk, {
      language,
      voice,
      rate: VOICE_RATE,
      pitch: VOICE_PITCH,
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
  // The article's own text decides; the page's `lang` is often missing or wrong (a Turkish article on an "en" page).
  const { language, voice } = await voiceFor(blocks.join('\n'), article.lang);
  // Stopped, or something else started reading, while the voices were looked up.
  if (!owned()) return { chars: 0, truncated: false };
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
  queue.forEach((item, k) => {
    Speech.speak(item.chunk, {
      language,
      voice,
      rate: VOICE_RATE,
      pitch: VOICE_PITCH,
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
