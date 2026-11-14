import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import type { ExpoSpeechRecognitionErrorCode } from 'expo-speech-recognition';
import { onPageMicrophone, pageMicrophoneLive } from '../browser/mediaCapture';
import { dialog, dialogState } from '../components/Dialog';
import { Language, t } from '../i18n';
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

/** How recognition will run for a language on this phone. */
export type VoicePlan = {
  /** The BCP 47 tag handed to the recogniser, e.g. "tr-TR" or "en-GB". */
  lang: string;
  /** Audio stays on the phone (enforced by the recogniser, not only preferred). */
  onDevice: boolean;
  /** Android 13+: the on-device model for this language can be downloaded (then onDevice works). */
  downloadable: string | null;
};

/** The language isn't offered by the recogniser on this phone at all. */
class LanguageUnavailable extends Error {}

/** A build made before voice input was added: the native module isn't there. */
export class VoiceNeedsBuildError extends Error {}

const DEFAULT_TAGS: Record<Language, string> = { en: 'en-US', tr: 'tr-TR' };
/** If stop() gets no "end" from the recogniser in time, the session is aborted. */
const STOP_TIMEOUT_MS = 2500;
const LOCALES_TIMEOUT_MS = 3000;

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

// ---- State shown by the panel -------------------------------------------------------------------

let state: VoiceState = 'idle';
/** Input level 0–1 while listening (0 when the recogniser gives none). */
let level = 0;
const listeners = new Set<() => void>();
const levelListeners = new Set<() => void>();

function setState(next: VoiceState) {
  if (state === next) return;
  state = next;
  if (next !== 'listening') setLevel(0);
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

export function isListening() {
  return state !== 'idle';
}

// ---- Language and on-device support -------------------------------------------------------------

const norm = (tag: string) => tag.replace(/_/g, '-').toLowerCase();
const languageOf = (tag: string) => norm(tag).split('-')[0];

/** The tags to try for a UI language: the device's own regional variants first, then a default. */
function preferredTags(language: Language): string[] {
  const own = getLocales()
    .filter((locale) => locale.languageCode?.toLowerCase() === language && locale.languageTag)
    .map((locale) => locale.languageTag);
  return [...new Set([...own, DEFAULT_TAGS[language]])];
}

/** The best entry of `available` for these preferences: an exact tag, else the same language. */
function pick(preferred: string[], available: string[], language: Language): string | null {
  for (const tag of preferred) {
    const exact = available.find((x) => norm(x) === norm(tag));
    if (exact) return exact;
  }
  const regional = preferred.map((tag) => norm(tag).split('-')[1]).filter(Boolean);
  const sameLanguage = available.filter((x) => languageOf(x) === language);
  return sameLanguage.find((x) => regional.includes(norm(x).split('-')[1])) ?? sameLanguage[0] ?? null;
}

/**
 * Works out the recogniser language and whether recognition stays on the phone.
 *
 * iOS: the supported list is the recogniser's own, so a missing language is known up front. On-device
 * support can only be read for the phone's own language (the module asks a recogniser made for the
 * current locale), so another language counts as online: Qutai never claims on-device without knowing.
 * Android: the lists cover only the on-device recogniser (Android 13+); the online recogniser's
 * languages can't be listed, so a missing language shows up as an error when listening starts.
 */
export async function voicePlan(language: Language): Promise<VoicePlan> {
  const M = (await load()).ExpoSpeechRecognitionModule;
  const preferred = preferredTags(language);
  const none = { locales: [] as string[], installedLocales: [] as string[] };
  // Android asks the recogniser service, which may never answer: then nothing counts as on-device.
  const supported = await Promise.race([
    M.getSupportedLocales({}).catch(() => none),
    new Promise<typeof none>((resolve) => setTimeout(() => resolve(none), LOCALES_TIMEOUT_MS)),
  ]);

  if (Platform.OS === 'ios') {
    const lang = supported.locales.length ? pick(preferred, supported.locales, language) : preferred[0];
    if (!lang) throw new LanguageUnavailable();
    const phoneLanguage = getLocales()[0]?.languageCode?.toLowerCase();
    let onDevice = false;
    try {
      onDevice = phoneLanguage === language && M.supportsOnDeviceRecognition();
    } catch {}
    return { lang, onDevice, downloadable: null };
  }

  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);
  let canOnDevice = false;
  try {
    // Before Android 13 the module can only hint "prefer offline", which doesn't keep audio on the phone.
    canOnDevice = apiLevel >= 33 && M.supportsOnDeviceRecognition();
  } catch {}
  const installed = canOnDevice ? pick(preferred, supported.installedLocales, language) : null;
  if (installed) return { lang: installed, onDevice: true, downloadable: null };
  const downloadable = canOnDevice ? pick(preferred, supported.locales, language) : null;
  return { lang: preferred[0], onDevice: false, downloadable };
}

/** Android 13+: asks the system to download the on-device model (it shows its own dialog or progress). */
export async function downloadVoiceModel(lang: string): Promise<void> {
  const M = (await load()).ExpoSpeechRecognitionModule;
  await M.androidTriggerOfflineModelDownload({ locale: lang });
}

/** For Settings: how voice input would run now, or why it can't. */
export type VoiceModeSummary = 'onDevice' | 'online' | 'onlineDeclined' | 'onlineAsk' | 'needsBuild' | 'unavailable';

export async function voiceModeSummary(language: Language, online: VoiceOnline): Promise<VoiceModeSummary> {
  try {
    const plan = await voicePlan(language);
    if (plan.onDevice) return 'onDevice';
    return online === 'allowed' ? 'online' : online === 'declined' ? 'onlineDeclined' : 'onlineAsk';
  } catch (e) {
    return e instanceof VoiceNeedsBuildError ? 'needsBuild' : 'unavailable';
  }
}

// ---- A listening session ------------------------------------------------------------------------

export type VoiceOptions = {
  language: Language;
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
};

type Session = {
  options: VoiceOptions;
  base: string;
  final: string | null;
  /** Stopped by something other than the user (panel closed, background, a call…): nothing is sent. */
  interrupted: boolean;
  failed: boolean;
  subscriptions: { remove(): void }[];
  stopTimer: ReturnType<typeof setTimeout> | null;
};

let session: Session | null = null;
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

function languageName(language: Language) {
  return t(language === 'tr' ? 'voice.language.tr' : 'voice.language.en');
}

function finish() {
  const s = session;
  if (!s) return;
  session = null;
  if (s.stopTimer) clearTimeout(s.stopTimer);
  s.subscriptions.forEach((sub) => sub.remove());
  setState('idle');
  // iOS: give the audio back to other apps (music, a page's video) now that the microphone is off.
  if (Platform.OS === 'ios' && module) {
    try {
      module.ExpoSpeechRecognitionModule.setAudioSessionActiveIOS(false, { notifyOthersOnDeactivation: true });
    } catch {}
  }
  if (s.final && !s.interrupted && !s.failed && s.options.onFinal) s.options.onFinal(s.final);
}

function handleError(s: Session, code: ExpoSpeechRecognitionErrorCode) {
  if (code === 'aborted') return;
  // Qutai stopped it itself (panel closed, app left…): no message about what followed.
  const quiet = s.interrupted;
  if (code === 'interrupted') s.interrupted = true;
  else s.failed = true;
  if (quiet) return;
  const { language } = s.options;
  if (code === 'not-allowed') {
    offerSettings(t('voice.permissionDenied'));
  } else if (code === 'language-not-supported') {
    dialog.alert(t('voice.title'), t('voice.languageUnavailable', { language: languageName(language) }));
  } else if (code === 'network' && s.options.incognito) {
    s.options.notify(t('voice.error.unavailable'));
  } else {
    const key = ERROR_KEYS[code];
    s.options.notify(key ? t(key) : t('voice.error.generic'));
  }
}

/** Asks for the microphone (and on iOS speech recognition) the first time; false if not allowed. */
async function ensurePermission(M: SpeechModule['ExpoSpeechRecognitionModule'], onDevice: boolean): Promise<boolean> {
  // On-device recognition needs only the microphone; online recognition on iOS also needs speech recognition.
  const get = () => (onDevice ? M.getMicrophonePermissionsAsync() : M.getPermissionsAsync());
  let status = await get();
  if (!status.granted && status.canAskAgain) {
    // The first time, both are asked on iOS, so switching to online later doesn't prompt mid-sentence.
    await M.requestPermissionsAsync().catch(() => null);
    status = await get();
  }
  if (status.granted) return true;
  if (!status.canAskAgain) offerSettings(t('voice.permissionDenied'));
  return false;
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
 */
export async function startVoiceInput(options: VoiceOptions): Promise<void> {
  if (state !== 'idle') return;
  cancelled = false;
  setState('preparing');
  try {
    await begin(options);
  } catch (e) {
    if (e instanceof VoiceNeedsBuildError) dialog.alert(t('voice.title'), e.message);
    else if (e instanceof LanguageUnavailable)
      dialog.alert(t('voice.title'), t('voice.languageUnavailable', { language: languageName(options.language) }));
    else options.notify(t('voice.error.generic'));
  } finally {
    if (!session) setState('idle');
  }
}

async function begin(options: VoiceOptions) {
  const lib = await load();
  const M = lib.ExpoSpeechRecognitionModule;
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

  const plan = await voicePlan(options.language);
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
    if (options.online === 'ask' && !(await askOnline(options, plan))) return;
  }

  if (!(await ensurePermission(M, plan.onDevice))) return;
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
    base: options.draft,
    final: null,
    interrupted: false,
    failed: false,
    subscriptions: [],
    stopTimer: null,
  };
  session = s;
  s.subscriptions.push(
    M.addListener('start', () => {
      if (session === s) setState('listening');
    }),
    M.addListener('result', (event) => {
      if (session !== s) return;
      const words = event.results[0]?.transcript?.trim() ?? '';
      const text = join(s.base, words);
      s.options.write(text);
      if (event.isFinal && words) s.final = text;
    }),
    M.addListener('nomatch', () => {
      if (session === s && !s.final) s.options.notify(t('voice.error.noSpeech'));
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
  const unsubscribeDialogs = dialogState.subscribe(() => {
    if (dialogState.isOpen()) stopVoiceInput();
  });
  s.subscriptions.push({ remove: unsubscribeDialogs });
  M.start({
    lang: plan.lang,
    interimResults: true,
    maxAlternatives: 1,
    // A pause ends it (iOS 18+ and Android at the first final result; iOS 17 after a short silence).
    continuous: false,
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
 * the text is never sent automatically.
 */
export function stopVoiceInput(interrupted = true): void {
  if (state === 'preparing') cancelled = true;
  const s = session;
  if (!s) return;
  if (interrupted) s.interrupted = true;
  if (state === 'stopping') return;
  setState('stopping');
  try {
    module?.ExpoSpeechRecognitionModule.stop();
  } catch {}
  s.stopTimer = setTimeout(() => abortVoiceInput(), STOP_TIMEOUT_MS);
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
