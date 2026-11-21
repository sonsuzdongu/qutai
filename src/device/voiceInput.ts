import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import type { ExpoSpeechRecognitionErrorCode } from 'expo-speech-recognition';
import { onPageMicrophone, pageMicrophoneLive } from '../browser/mediaCapture';
import { dialog, dialogState } from '../components/Dialog';
import { t } from '../i18n';
import { shouldKeepListening, voiceErrorOutcome } from './voiceError';
import { languageName, languageOf } from './voiceLanguage';
import { offerSettings } from './settings';
import { isSpeaking, setMicrophoneGuard, stopSpeaking } from './speech';

/**
 * Voice input for the assistant panel: the phone's own speech recogniser (iOS SFSpeechRecognizer,
 * Android SpeechRecognizer, through expo-speech-recognition) turns speech into text in the message
 * field. Nothing is recorded to disk and no audio reaches Qutai's servers or the AI provider; the
 * recognised text is sent like a typed message, and only when the user sends it (or turned on
 * "send automatically").
 *
 * Where the audio goes: recognition runs on the phone when the device and the language allow it
 * (iOS: on-device dictation for that language; Android 13+: the on-device recogniser with that
 * language downloaded). Otherwise the phone's speech service (Apple's or Google's) receives the audio,
 * which the user agrees to once before first use; incognito conversations never use it.
 */

type SpeechModule = typeof import('expo-speech-recognition');

/** The user's answer about the phone's online speech service: not asked yet, allowed, or refused. */
export type VoiceOnline = 'ask' | 'allowed' | 'declined';

export type VoiceState = 'idle' | 'preparing' | 'listening' | 'stopping';

/**
 * Who started listening: the panel's microphone, holding the Qutai button (push-to-talk), or "Tell me about yourself"
 * (setup and Settings › Memory; components/VoiceIntro.tsx).
 */
export type VoiceOwner = 'panel' | 'hold' | 'intro';

/** How recognition will run on this phone. */
export type VoicePlan = {
  /** The BCP 47 tag handed to the recogniser, e.g. "tr-TR" or "en-GB". */
  lang: string;
  /** Audio stays on the phone (enforced by the recogniser, not only preferred). */
  onDevice: boolean;
  /** Android 13+: the on-device model for this language can be downloaded (then onDevice works). */
  downloadable: string | null;
  /** The language wanted first, when it isn't available on this phone and a later one in the order is used. */
  fellBackFrom: string | null;
  /** The languages after the one used, to try if the recogniser turns it down when it starts (Android). */
  rest: string[];
};

/** None of the languages is offered by the recogniser on this phone. */
class LanguageUnavailable extends Error {
  constructor(readonly language: string) {
    super(language);
  }
}

/** A build made before voice input was added: the native module isn't there. */
export class VoiceNeedsBuildError extends Error {}

/** The tag used for a language when the phone has no regional variant of it among its own languages. */
const DEFAULT_TAGS: Record<string, string> = {
  en: 'en-US',
  tr: 'tr-TR',
  de: 'de-DE',
  es: 'es-ES',
  pt: 'pt-BR',
  fr: 'fr-FR',
  ja: 'ja-JP',
  ko: 'ko-KR',
  ru: 'ru-RU',
  id: 'id-ID',
};
/** If stop() gets no "end" from the recogniser in time, the session is aborted. */
const STOP_TIMEOUT_MS = 2500;
const LOCALES_TIMEOUT_MS = 3000;
/** The recogniser's language lists are read once and kept this long (a downloaded language clears them). */
const LOCALES_CACHE_MS = 10 * 60 * 1000;

let module: SpeechModule | null = null;

// Loaded on first use, so a build without the native module still starts.
async function load(): Promise<SpeechModule> {
  if (module) return module;
  try {
    module = await import('expo-speech-recognition');
    return module;
  } catch {
    throw new VoiceNeedsBuildError(t('voice.needsBuild'));
  }
}

// ---- Start-up timings ---------------------------------------------------------------------------

/**
 * Where the time goes between the press and the recogniser listening (18 Nov 2026: listening started 2-3 s late on
 * the owner's Android phone). One line per session in the log ("[voice-timing] press +0 · hold +400 · …"), release
 * builds included (adb logcat -s ReactNativeJS); timings only, never words.
 */
let markStart = 0;
let marks: string[] = [];
/** The latest session's milestones, for tests and a debugging look. */
export let lastVoiceTimings: readonly string[] = [];

function mark(stage: string) {
  if (!markStart) markStart = Date.now();
  marks.push(`${stage} +${Date.now() - markStart}`);
}

function flushMarks() {
  if (!marks.length) return;
  lastVoiceTimings = marks;
  console.log(`[voice-timing] ${Platform.OS} ${marks.join(' · ')}`);
  marks = [];
  markStart = 0;
}

// ---- State shown by the panel -------------------------------------------------------------------

let state: VoiceState = 'idle';
/** Input level 0–1 while listening (0 when the recogniser gives none). */
let level = 0;
const listeners = new Set<() => void>();
const levelListeners = new Set<() => void>();

/** What the listening UI shows besides the state: who listens, in which language, and a fallback. */
export type VoiceInfo = { owner: VoiceOwner | null; lang: string | null; fellBackFrom: string | null };
const NO_INFO: VoiceInfo = { owner: null, lang: null, fellBackFrom: null };
let info: VoiceInfo = NO_INFO;

function setState(next: VoiceState) {
  if (state === next) return;
  state = next;
  if (next !== 'listening') setLevel(0);
  if (next === 'idle') info = NO_INFO;
  listeners.forEach((l) => l());
}

function setInfo(next: VoiceInfo) {
  info = next;
  listeners.forEach((l) => l());
}

function setLevel(next: number) {
  if (level === next) return;
  level = next;
  levelListeners.forEach((l) => l());
}

export function useVoiceState(): VoiceState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

export function useVoiceLevel(): number {
  return useSyncExternalStore(
    (listener) => {
      levelListeners.add(listener);
      return () => levelListeners.delete(listener);
    },
    () => level,
  );
}

export function useVoiceInfo(): VoiceInfo {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => info,
  );
}

export function isListening() {
  return state !== 'idle';
}

/** The recogniser has been started (until its end); false while still preparing (questions, permission). */
export function hasVoiceSession() {
  return session !== null || continuing;
}

// ---- Language and on-device support -------------------------------------------------------------

const norm = (tag: string) => tag.replace(/_/g, '-').toLowerCase();

/**
 * The tags to try for a language ("tr") or a tag picked by hand ("en-GB"): that tag, the phone's own regional
 * variants of the language (so an English phone set to the UK gets en-GB), then a default.
 */
function preferredTags(code: string): string[] {
  const language = languageOf(code);
  const exact = code.includes('-') || code.includes('_') ? [code.replace(/_/g, '-')] : [];
  const own = getLocales()
    .filter((locale) => locale.languageCode?.toLowerCase() === language && locale.languageTag)
    .map((locale) => locale.languageTag);
  return [...new Set([...exact, ...own, DEFAULT_TAGS[language] ?? language])];
}

/** The best entry of `available` for these preferences: an exact tag, else the same language. */
function pick(preferred: string[], available: string[], language: string): string | null {
  for (const tag of preferred) {
    const exact = available.find((x) => norm(x) === norm(tag));
    if (exact) return exact;
  }
  const regional = preferred.map((tag) => norm(tag).split('-')[1]).filter(Boolean);
  const sameLanguage = available.filter((x) => languageOf(x) === language);
  return sameLanguage.find((x) => regional.includes(norm(x).split('-')[1])) ?? sameLanguage[0] ?? null;
}

type Locales = { locales: string[]; installedLocales: string[] };
let localesCache: { at: number; value: Promise<Locales> } | null = null;
/** When the recogniser service last didn't answer the language question in time. */
let noAnswerAt = 0;
const NO_ANSWER_MS = 2 * 60 * 1000;

/**
 * The recogniser's languages (iOS: all it supports; Android 13+: those of the on-device recogniser, installed or
 * downloadable). Kept for a while, so pressing the Qutai button doesn't wait for the recogniser service each time.
 */
function supportedLocales(M: SpeechModule['ExpoSpeechRecognitionModule']): Promise<Locales> {
  if (localesCache && Date.now() - localesCache.at < LOCALES_CACHE_MS) return localesCache.value;
  // A service that didn't answer a moment ago won't now: not asked again for a while (each ask waited 3 s).
  if (noAnswerAt && Date.now() - noAnswerAt < NO_ANSWER_MS) return Promise.resolve({ locales: [], installedLocales: [] });
  const none: Locales = { locales: [], installedLocales: [] };
  // Android asks the recogniser service, which may never answer: then nothing counts as on-device.
  const value = Promise.race([
    M.getSupportedLocales({}).catch(() => none),
    new Promise<Locales>((resolve) => setTimeout(() => resolve(none), LOCALES_TIMEOUT_MS)),
  ]);
  const entry = { at: Date.now(), value };
  localesCache = entry;
  // An empty answer (no on-device service, or none in time) is asked again later.
  const startedAt = Date.now();
  value.then((v) => {
    if (v.locales.length || v.installedLocales.length || localesCache !== entry) return;
    localesCache = null;
    if (Date.now() - startedAt >= LOCALES_TIMEOUT_MS - 50) noAnswerAt = Date.now();
  });
  return value;
}

/** A plan worked out ahead of the start (warmVoice), for the same languages. */
let warm: { key: string; at: number; plan: Promise<VoicePlan | null> } | null = null;
const WARM_MS = 60 * 1000;

/**
 * Gets everything ready that listening needs before the recogniser starts, so the start itself waits for nothing on
 * the JavaScript side: the native module, the recogniser's language lists (Android asks a service that may take
 * seconds) and the plan (language, on-device or online). Called when the Qutai button is touched (a press that may
 * become a hold) and when the assistant panel opens. The microphone stays off: Android and iOS offer no way to load a
 * recogniser without listening, and the microphone indicator must not light up for a tap.
 */
export function warmVoice(languages: string[], press = false): void {
  if (state !== 'idle') return;
  if (press) {
    marks = [];
    markStart = Date.now();
    mark('press');
  }
  const key = languages.join(',');
  if (warm && warm.key === key && Date.now() - warm.at < WARM_MS) return;
  const plan = load()
    .then(() => voicePlan(languages))
    .catch(() => null);
  warm = { key, at: Date.now(), plan };
  // A plan with nothing in it (the service didn't answer) isn't kept.
  void plan.then((p) => {
    if (!p && warm?.plan === plan) warm = null;
  });
}

/** The plan warmVoice worked out for these languages, if it is fresh. */
async function warmPlan(languages: string[]): Promise<VoicePlan | null> {
  const w = warm;
  if (!w || w.key !== languages.join(',') || Date.now() - w.at >= WARM_MS) return null;
  return w.plan;
}

/** The languages the phone's recogniser lists, for "More languages…" (empty when it lists none). */
export async function voiceLanguages(): Promise<string[]> {
  try {
    const M = (await load()).ExpoSpeechRecognitionModule;
    const { locales, installedLocales } = await supportedLocales(M);
    return [...new Set([...installedLocales, ...locales].map((x) => x.replace(/_/g, '-')))];
  } catch {
    return [];
  }
}

/**
 * Works out the recogniser language and whether recognition stays on the phone, trying `languages` in order
 * (see voiceLanguage.ts for the order): a language the phone doesn't offer is skipped, and the plan says so.
 *
 * iOS: the supported list is the recogniser's own, so a missing language is known up front. On-device
 * support can only be read for the phone's own language (the module asks a recogniser made for the
 * current locale), so another language counts as online: Qutai never claims on-device without knowing.
 * Android: the lists cover only the on-device recogniser (Android 13+); the online recogniser's
 * languages can't be listed, so a missing language shows up as an error when listening starts (and the
 * next language in the order is tried then).
 */
export async function voicePlan(languages: string[]): Promise<VoicePlan> {
  const M = (await load()).ExpoSpeechRecognitionModule;
  const supported = await supportedLocales(M);
  let skipped: string | null = null;

  for (let i = 0; i < languages.length; i++) {
    const code = languages[i];
    const language = languageOf(code);
    const preferred = preferredTags(code);
    const rest = languages.slice(i + 1);

    if (Platform.OS === 'ios') {
      const lang = supported.locales.length ? pick(preferred, supported.locales, language) : preferred[0];
      if (!lang) {
        skipped ??= code;
        continue;
      }
      const phoneLanguage = getLocales()[0]?.languageCode?.toLowerCase();
      let onDevice = false;
      try {
        onDevice = phoneLanguage === language && M.supportsOnDeviceRecognition();
      } catch {}
      return { lang, onDevice, downloadable: null, fellBackFrom: skipped, rest };
    }

    const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);
    let canOnDevice = false;
    try {
      // Before Android 13 the module can only hint "prefer offline", which doesn't keep audio on the phone.
      canOnDevice = apiLevel >= 33 && M.supportsOnDeviceRecognition();
    } catch {}
    const installed = canOnDevice ? pick(preferred, supported.installedLocales, language) : null;
    if (installed) return { lang: installed, onDevice: true, downloadable: null, fellBackFrom: skipped, rest };
    const downloadable = canOnDevice ? pick(preferred, supported.locales, language) : null;
    return { lang: preferred[0], onDevice: false, downloadable, fellBackFrom: skipped, rest };
  }
  throw new LanguageUnavailable(skipped ?? languages[0] ?? '');
}

/** Android 13+: asks the system to download the on-device model (it shows its own dialog or progress). */
export async function downloadVoiceModel(lang: string): Promise<void> {
  const M = (await load()).ExpoSpeechRecognitionModule;
  localesCache = null;
  await M.androidTriggerOfflineModelDownload({ locale: lang });
}

/** For Settings: how voice input would run now, or why it can't. */
export type VoiceModeSummary = 'onDevice' | 'online' | 'onlineDeclined' | 'onlineAsk' | 'needsBuild' | 'unavailable';

export async function voiceModeSummary(language: string, online: VoiceOnline): Promise<VoiceModeSummary> {
  try {
    const plan = await voicePlan([language]);
    if (plan.onDevice) return 'onDevice';
    return online === 'allowed' ? 'online' : online === 'declined' ? 'onlineDeclined' : 'onlineAsk';
  } catch (e) {
    return e instanceof VoiceNeedsBuildError ? 'needsBuild' : 'unavailable';
  }
}

// ---- A listening session ------------------------------------------------------------------------

export type VoiceOptions = {
  /** The languages to listen in, best first (voiceLanguage.ts `listeningOrder`); the first available one is used. */
  languages: string[];
  owner: VoiceOwner;
  /** The conversation is incognito: on-device recognition only. */
  incognito: boolean;
  online: VoiceOnline;
  onOnlineChange: (online: VoiceOnline) => void;
  /** The draft when listening starts; recognised words are appended to it. */
  draft: string;
  /** Writes the message field (bound to the conversation that was on screen when listening started). */
  write: (text: string) => void;
  /** Called with the final text when the user wants it sent automatically. */
  onFinal?: (text: string) => void;
  /** A short message for a toast. */
  notify: (message: string) => void;
  /**
   * Push-to-talk (holding the Qutai button): listening goes on through pauses until stopped, and a question that
   * has to be asked first (microphone permission, the online speech service) is asked instead of listening.
   */
  hold?: boolean;
  /**
   * Listens through pauses until stopped, like `hold`, but asks what has to be asked first and then listens (a tap,
   * not a finger held down): "Tell me about yourself", where the user talks for a while.
   */
  continuous?: boolean;
  /** Listening has started, in this recogniser language (e.g. "tr-TR"). */
  onStarted?: (lang: string) => void;
  /** The session is over, however it ended; `text` is what was recognised in it (without the draft). */
  onEnd?: (result: VoiceResult) => void;
  /** Internal: what earlier recogniser runs of the same hold heard (a restart after the recogniser ended). */
  carried?: string;
  /** Internal: recogniser restarts so far in this hold. */
  restarts?: number;
  /** Internal: the on-device recogniser failed to start; this run uses the online one. */
  forceOnline?: boolean;
};

export type VoiceResult = {
  text: string;
  /** Stopped by something other than the user (background, a call, a dialog…). */
  interrupted: boolean;
  /** The recogniser reported an error (no speech, network…). */
  failed: boolean;
  /** No final result came in time after stopping: `text` is the last interim result. */
  timedOut: boolean;
};

type Session = {
  options: VoiceOptions;
  plan: VoicePlan;
  base: string;
  /** Final results so far (several in continuous mode: one per stretch of speech). */
  committed: string;
  /** The latest interim result after them. */
  interim: string;
  final: string | null;
  /** Stopped by something other than the user (panel closed, background, a call…): nothing is sent. */
  interrupted: boolean;
  failed: boolean;
  timedOut: boolean;
  /** The recogniser turned the language down at the start: listening starts again with the next one. */
  retry: boolean;
  /** The on-device recogniser couldn't start: listening starts again online, same language. */
  retryOnline: boolean;
  /** Earlier runs of the same hold (a restart): their words come first. */
  carried: string;
  /** The error the recogniser ended with. */
  lastError: ExpoSpeechRecognitionErrorCode | null;
  /** Listening has been reported (the audio is being heard): onStarted is called once. */
  started: boolean;
  subscriptions: { remove(): void }[];
  stopTimer: ReturnType<typeof setTimeout> | null;
};

let session: Session | null = null;
/**
 * A held session is being started again after the recogniser ended it by itself (or online after the on-device
 * recogniser failed): it still counts as a session, so lifting the finger now sends what was heard.
 */
let continuing = false;
/** Set when listening is called off while it is still being prepared (prompts, permission). */
let cancelled = false;

function join(base: string, words: string): string {
  if (!words) return base;
  if (!base) return words;
  return /\s$/.test(base) ? base + words : `${base} ${words}`;
}

const ERROR_KEYS: Partial<Record<ExpoSpeechRecognitionErrorCode, Parameters<typeof t>[0]>> = {
  'no-speech': 'voice.error.noSpeech',
  'speech-timeout': 'voice.error.noSpeech',
  network: 'voice.error.network',
  'service-not-allowed': 'voice.error.unavailable',
  'audio-capture': 'voice.error.microphoneBusy',
  busy: 'voice.error.microphoneBusy',
  'too-many-requests': 'voice.error.microphoneBusy',
  interrupted: 'voice.error.interrupted',
};

function finish() {
  const s = session;
  if (!s) return;
  const asked = state === 'stopping';
  session = null;
  mark('end');
  flushMarks();
  if (s.stopTimer) clearTimeout(s.stopTimer);
  s.subscriptions.forEach((sub) => sub.remove());
  setState('idle');
  // iOS: give the audio back to other apps (music, a page's video) now that the microphone is off.
  if (Platform.OS === 'ios' && module) {
    try {
      module.ExpoSpeechRecognitionModule.setAudioSessionActiveIOS(false, { notifyOthersOnDeactivation: true });
    } catch {}
  }
  const heard = join(s.carried, join(s.committed, s.interim));
  const again = (options: VoiceOptions, fellBackFrom: string | null) => {
    continuing = true;
    void startVoiceInput(options, fellBackFrom).then((started) => {
      continuing = false;
      if (!started) s.options.onEnd?.({ text: heard.trim(), interrupted: false, failed: true, timedOut: false });
    });
  };
  if (s.retryOnline && !cancelled) {
    // The on-device recogniser couldn't start: the same language with the online one.
    mark('online instead');
    again({ ...s.options, draft: s.base, carried: heard, forceOnline: true }, s.plan.fellBackFrom);
    return;
  }
  if (s.retry && !cancelled) {
    // The next language in the order, saying which one wasn't available.
    const fellBackFrom = s.plan.fellBackFrom ?? s.options.languages[0];
    again({ ...s.options, languages: s.plan.rest, draft: s.base }, fellBackFrom);
    return;
  }
  const restarts = s.options.restarts ?? 0;
  if (
    !cancelled &&
    AppState.currentState === 'active' &&
    shouldKeepListening({
      continuous: !!s.options.hold || !!s.options.continuous,
      asked,
      interrupted: s.interrupted,
      restarting: false,
      error: s.failed ? s.lastError : null,
      restarts,
    })
  ) {
    // The recogniser ended a held session by itself (a silence, its time limit): the hold goes on, with what was
    // heard so far kept in front of what comes next.
    again({ ...s.options, draft: s.base, carried: heard, restarts: restarts + 1, onStarted: undefined }, s.plan.fellBackFrom);
    return;
  }
  const ok = !s.interrupted && !s.failed && !s.timedOut;
  if (s.final && ok && s.options.onFinal) s.options.onFinal(s.final);
  s.options.onEnd?.({
    text: heard.trim(),
    interrupted: s.interrupted,
    failed: s.failed,
    timedOut: s.timedOut,
  });
}

function handleError(s: Session, code: ExpoSpeechRecognitionErrorCode) {
  const outcome = voiceErrorOutcome({
    code,
    stopping: state === 'stopping',
    // The words of earlier runs of this hold count too: after an automatic restart the recogniser's late trouble
    // (client, no-speech) comes before any new words, and what was heard is already in the field.
    hasText: !!(s.carried || s.committed || s.interim),
    interrupted: s.interrupted,
    canRetry: s.plan.rest.length > 0,
    canGoOnline: s.plan.onDevice && !s.options.incognito && s.options.online === 'allowed' && !s.options.forceOnline,
  });
  mark(`error ${code} → ${outcome}`);
  s.lastError = code;
  if (outcome === 'ignore') return;
  if (outcome === 'online') {
    s.retryOnline = true;
    return;
  }
  if (outcome === 'retry') {
    s.retry = true;
    return;
  }
  if (code === 'interrupted') s.interrupted = true;
  else s.failed = true;
  if (outcome === 'quiet') return;
  if (code === 'not-allowed') {
    offerSettings(t('voice.permissionDenied'));
  } else if (code === 'language-not-supported') {
    const language = languageName(languageOf(s.plan.lang));
    dialog.alert(t('voice.title'), t('voice.languageUnavailable', { language }));
  } else if (code === 'network' && s.options.incognito) {
    s.options.notify(t('voice.error.unavailable'));
  } else {
    const key = ERROR_KEYS[code];
    s.options.notify(key ? t(key) : t('voice.error.generic'));
  }
}

/**
 * Asks for the microphone (and on iOS speech recognition) the first time; false if not allowed. With `askOnly`
 * (push-to-talk: the finger is up by the time the question is answered) a question asked means false this time.
 */
async function ensurePermission(
  M: SpeechModule['ExpoSpeechRecognitionModule'],
  onDevice: boolean,
  askOnly = false,
): Promise<boolean> {
  // On-device recognition needs only the microphone; online recognition on iOS also needs speech recognition.
  const get = () => (onDevice ? M.getMicrophonePermissionsAsync() : M.getPermissionsAsync());
  let status = await get();
  if (!status.granted && status.canAskAgain) {
    // The first time, both are asked on iOS, so switching to online later doesn't prompt mid-sentence.
    await requestAll(M);
    if (askOnly) return false;
    status = await get();
  }
  if (status.granted) return true;
  if (!status.canAskAgain) offerSettings(t('voice.permissionDenied'));
  return false;
}

/**
 * Asks for everything voice input uses, in one go: the microphone (Android RECORD_AUDIO, iOS AVAudioSession record
 * permission) and on iOS also speech recognition (SFSpeechRecognizer authorization, needed when Apple's speech service
 * recognises the audio). iOS asks speech recognition first and skips the microphone when that is refused, so the
 * microphone is then asked on its own: on-device recognition needs only the microphone.
 */
async function requestAll(M: SpeechModule['ExpoSpeechRecognitionModule']): Promise<void> {
  await M.requestPermissionsAsync().catch(() => null);
  if (Platform.OS !== 'ios') return;
  const mic = await M.getMicrophonePermissionsAsync().catch(() => null);
  if (mic && mic.status === 'undetermined') await M.requestMicrophonePermissionsAsync().catch(() => null);
}

/**
 * Voice input's permissions for setup's "What Qutai may use" step (device/permissionStatus.ts): 'granted' when
 * everything is allowed; on iOS 'limited' when the microphone is allowed but speech recognition isn't (only languages
 * the phone recognises itself work); 'blocked' when only the phone's settings can change it.
 */
export async function voicePermissionState(): Promise<'granted' | 'limited' | 'undetermined' | 'denied' | 'blocked' | 'unavailable'> {
  let M: SpeechModule['ExpoSpeechRecognitionModule'];
  try {
    M = (await load()).ExpoSpeechRecognitionModule;
  } catch {
    return 'unavailable';
  }
  const mic = await M.getMicrophonePermissionsAsync();
  if (!mic.granted) return mic.status === 'undetermined' ? 'undetermined' : mic.canAskAgain ? 'denied' : 'blocked';
  if (Platform.OS !== 'ios') return 'granted';
  const speech = await M.getSpeechRecognizerPermissionsAsync();
  if (speech.granted) return 'granted';
  return speech.status === 'undetermined' ? 'undetermined' : 'limited';
}

/** Setup's microphone switch: the same requests voice input makes on first use, so it asks nothing more later. */
export async function requestVoicePermissions(): Promise<void> {
  const M = (await load()).ExpoSpeechRecognitionModule;
  await requestAll(M);
}

/** The one-time question about the phone's online speech service; the answer is remembered. */
async function askOnline(options: VoiceOptions, plan: VoicePlan): Promise<boolean> {
  const service = t(Platform.OS === 'ios' ? 'voice.serviceApple' : 'voice.serviceGoogle');
  type Choice = 'decline' | 'download' | 'allow';
  const choices: { choice: Choice; text: string; style?: 'cancel'; primary?: boolean }[] = [
    { choice: 'decline', text: t('voice.onlineDecline'), style: 'cancel' },
    ...(plan.downloadable ? [{ choice: 'download' as const, text: t('voice.download') }] : []),
    { choice: 'allow', text: t('voice.onlineAllow'), primary: true },
  ];
  const result = await dialog.show({
    title: t('voice.onlineTitle'),
    message: t('voice.onlineBody', { service }),
    buttons: choices.map(({ text, style, primary }) => ({ text, style, primary })),
  });
  // Dismissed without an answer: asked again next time.
  const choice = result.button === null ? null : choices[result.button]?.choice;
  if (!choice) return false;
  if (choice === 'download') {
    if (plan.downloadable) await startDownload(options, plan.downloadable);
    return false;
  }
  options.onOnlineChange(choice === 'allow' ? 'allowed' : 'declined');
  return choice === 'allow';
}

async function startDownload(options: VoiceOptions, lang: string) {
  try {
    await downloadVoiceModel(lang);
    options.notify(t('voice.downloadStarted'));
  } catch {
    options.notify(t('voice.downloadFailed'));
  }
}

/**
 * Starts listening: works out the language and where the audio goes, asks what needs asking,
 * stops read-aloud (barge-in) and starts the recogniser. Errors are shown to the user here.
 * Resolves true when the recogniser was started (its "end" then always follows, with `onEnd`).
 */
export async function startVoiceInput(options: VoiceOptions, fellBackFrom: string | null = null): Promise<boolean> {
  if (state !== 'idle') return false;
  // A press long ago that never became a hold: this start is measured on its own.
  if (markStart && Date.now() - markStart > 5000) {
    marks = [];
    markStart = 0;
  }
  mark(fellBackFrom ? 'retry' : 'begin');
  cancelled = false;
  setState('preparing');
  setInfo({ owner: options.owner, lang: null, fellBackFrom: null });
  try {
    await begin(options, fellBackFrom);
  } catch (e) {
    if (e instanceof VoiceNeedsBuildError) dialog.alert(t('voice.title'), e.message);
    else if (e instanceof LanguageUnavailable)
      dialog.alert(t('voice.title'), t('voice.languageUnavailable', { language: languageName(e.language) }));
    else options.notify(t('voice.error.generic'));
  } finally {
    if (!session) {
      setState('idle');
      mark('not started');
      flushMarks();
    }
  }
  return !!session;
}

async function begin(options: VoiceOptions, fellBackFrom: string | null) {
  const lib = await load();
  const M = lib.ExpoSpeechRecognitionModule;
  mark('module');
  if (pageMicrophoneLive()) {
    dialog.alert(t('voice.title'), t('voice.siteUsingMicrophone'));
    return;
  }
  let available = true;
  try {
    available = M.isRecognitionAvailable();
  } catch {}
  if (!available) {
    dialog.alert(t('voice.title'), t(Platform.OS === 'ios' ? 'voice.unavailableIos' : 'voice.unavailableAndroid'));
    return;
  }

  mark('available');
  // Worked out while the finger was going down (warmVoice); otherwise now.
  const found = (await warmPlan(options.languages)) ?? (await voicePlan(options.languages));
  const plan: VoicePlan = {
    ...found,
    fellBackFrom: found.fellBackFrom ?? fellBackFrom,
    ...(options.forceOnline ? { onDevice: false, downloadable: null } : {}),
  };
  mark(`plan ${plan.lang}${plan.onDevice ? ' on-device' : ' online'}`);
  if (!plan.onDevice) {
    if (options.incognito) {
      const buttons = plan.downloadable
        ? [{ text: t('common.cancel'), style: 'cancel' as const }, { text: t('voice.download') }]
        : undefined;
      const result = await dialog.show({ title: t('voice.title'), message: t('voice.incognitoOff'), buttons });
      if (plan.downloadable && result.button === 1) await startDownload(options, plan.downloadable);
      return;
    }
    if (options.online === 'declined') {
      dialog.alert(t('voice.title'), t('voice.onlineDeclined'));
      return;
    }
    // Push-to-talk: the question comes up instead of listening (the finger is up by the time it's answered).
    if (options.online === 'ask' && (!(await askOnline(options, plan)) || options.hold)) return;
  }

  if (!(await ensurePermission(M, plan.onDevice, options.hold))) return;
  mark('permission');
  // Something may have changed while a prompt was up (a site took the microphone, the app was left).
  // ("inactive" is normal right after an iOS permission prompt, so only "background" counts here.)
  if (pageMicrophoneLive() || AppState.currentState === 'background') return;

  // Called off meanwhile (panel closed, tab switched…), or a dialog came up that would hide the listening state.
  if (cancelled || dialogState.isOpen()) return;

  // Barge-in: the assistant goes quiet as soon as the user wants to talk.
  if (isSpeaking()) await stopSpeaking();
  if (cancelled) return;

  const s: Session = {
    options,
    plan,
    base: options.draft,
    committed: '',
    interim: '',
    // After an automatic restart the words of the earlier runs are what was said, even if nothing new follows.
    final: options.carried ? join(options.draft, options.carried) : null,
    interrupted: false,
    failed: false,
    timedOut: false,
    retry: false,
    retryOnline: false,
    carried: options.carried ?? '',
    lastError: null,
    started: false,
    subscriptions: [],
    stopTimer: null,
  };
  session = s;
  // The words of this hold so far (a restart) stay in front of what comes next.
  const said = (words: string) => join(s.base, join(s.carried, words));
  setInfo({ owner: options.owner, lang: plan.lang, fellBackFrom: plan.fellBackFrom });
  s.subscriptions.push(
    M.addListener('audiostart', () => {
      if (session !== s) return;
      mark('audio');
      // Android 13+ with continuous listening: the module records the microphone itself and hands the audio to the
      // recogniser through a pipe that holds it until the recogniser reads it, so what is said from now on is heard
      // even while the recogniser is still loading. Listening is shown from here.
      if (capturesAhead) listeningNow();
    }),
    M.addListener('start', () => {
      if (session !== s) return;
      mark('ready');
      listeningNow();
    }),
    M.addListener('result', (event) => {
      if (session !== s) return;
      const words = event.results[0]?.transcript?.trim() ?? '';
      if (!s.committed && !s.interim && words) mark('words');
      // Continuous listening gives one final result per stretch of speech: they add up.
      if (event.isFinal) {
        s.committed = join(s.committed, words);
        s.interim = '';
      } else {
        s.interim = words;
      }
      s.options.write(said(join(s.committed, s.interim)));
      if (event.isFinal && s.committed) s.final = said(s.committed);
    }),
    M.addListener('nomatch', () => {
      // A silent stretch between two in continuous listening is nothing to report, nor is one after words came in.
      if (session === s && !s.final && !s.committed && !s.interim && !options.hold) {
        s.options.notify(t('voice.error.noSpeech'));
      }
    }),
    M.addListener('error', (event) => {
      if (session === s) handleError(s, event.error);
    }),
    M.addListener('volumechange', (event) => {
      // -2…10, where 0 and below is silence.
      if (session === s) setLevel(Math.max(0, Math.min(1, event.value / 10)));
    }),
    M.addListener('end', () => {
      if (session === s) finish();
    }),
  );
  function listeningNow() {
    if (s.started) return;
    s.started = true;
    setState('listening');
    options.onStarted?.(plan.lang);
  }
  const unsubscribeDialogs = dialogState.subscribe(() => {
    if (dialogState.isOpen()) stopVoiceInput();
  });
  s.subscriptions.push({ remove: unsubscribeDialogs });
  const continuous = !!options.hold || !!options.continuous;
  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);
  const capturesAhead = Platform.OS === 'android' && apiLevel >= 33 && continuous;
  mark('start');
  M.start({
    lang: plan.lang,
    interimResults: true,
    maxAlternatives: 1,
    // Tap to talk: a pause ends it (iOS 18+ and Android at the first final result; iOS 17 after a short silence).
    // Push-to-talk: it goes on until the finger is lifted (Android 12 and older: until a long silence).
    continuous,
    requiresOnDeviceRecognition: plan.onDevice,
    addsPunctuation: true,
    iosTaskHint: 'dictation',
    volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
    // Never written to disk.
    recordingOptions: { persist: false },
  });
}

/**
 * Stops listening and keeps what was recognised. With `interrupted` (anything but the user's own tap)
 * the text is never sent automatically. `waitMs`: how long to wait for the final result before giving up on it
 * (then `onEnd` gets the last interim result, marked timedOut).
 */
export function stopVoiceInput(interrupted = true, waitMs = STOP_TIMEOUT_MS): void {
  if (state === 'preparing') cancelled = true;
  const s = session;
  if (!s) return;
  if (interrupted) s.interrupted = true;
  if (state === 'stopping') return;
  setState('stopping');
  try {
    module?.ExpoSpeechRecognitionModule.stop();
  } catch {}
  s.stopTimer = setTimeout(() => {
    if (session !== s) return;
    s.timedOut = true;
    try {
      module?.ExpoSpeechRecognitionModule.abort();
    } catch {}
    finish();
  }, waitMs);
}

/** Stops at once without waiting for a final result (the words so far are already in the field). */
export function abortVoiceInput(): void {
  if (state === 'preparing') cancelled = true;
  const s = session;
  if (!s) return;
  s.interrupted = true;
  try {
    module?.ExpoSpeechRecognitionModule.abort();
  } catch {}
  finish();
}

// The microphone is never on while Qutai isn't on screen (background, app switcher, a call coming in).
// ("inactive" alone is also what an iOS permission prompt causes, so it only ends a session already listening.)
AppState.addEventListener('change', (next) => {
  if (next === 'background' || (next !== 'active' && session)) stopVoiceInput();
});
// A site in a tab starting to capture the microphone takes it over.
onPageMicrophone(() => stopVoiceInput());
// Read-aloud never starts while the microphone is listening: the microphone is turned off first.
setMicrophoneGuard(() => abortVoiceInput());
