// Stand-ins for this harness (./loader.mjs): the speech recogniser's native module and the app's dialog, both
// recording what the code under test does and letting a test play the recogniser's events.

/** expo-speech-recognition: `__speech` is the test's handle (state, calls, emit, reset). */
export const SPEECH = `
const listeners = new Map();
const fake = {
  calls: [],
  locales: { locales: [], installedLocales: [] },
  onDevice: false,
  available: true,
  permission: { granted: true, canAskAgain: true, status: 'granted' },
  startThrows: null,
  emit(event, payload = {}) { for (const fn of [...(listeners.get(event) ?? [])]) fn(payload); },
  listenerCount(event) { return listeners.get(event)?.size ?? 0; },
  started() { return fake.calls.filter((c) => c.name === 'start').map((c) => c.args[0]); },
  reset() {
    fake.calls = [];
    fake.locales = { locales: [], installedLocales: [] };
    fake.onDevice = false;
    fake.available = true;
    fake.permission = { granted: true, canAskAgain: true, status: 'granted' };
    fake.startThrows = null;
  },
};
const record = (name, value) => (...args) => { fake.calls.push({ name, args }); return typeof value === 'function' ? value(...args) : value; };
export const ExpoSpeechRecognitionModule = {
  getSupportedLocales: record('getSupportedLocales', () => Promise.resolve(fake.locales)),
  supportsOnDeviceRecognition: record('supportsOnDeviceRecognition', () => fake.onDevice),
  isRecognitionAvailable: record('isRecognitionAvailable', () => fake.available),
  getPermissionsAsync: record('getPermissionsAsync', () => Promise.resolve(fake.permission)),
  getMicrophonePermissionsAsync: record('getMicrophonePermissionsAsync', () => Promise.resolve(fake.permission)),
  getSpeechRecognizerPermissionsAsync: record('getSpeechRecognizerPermissionsAsync', () => Promise.resolve(fake.permission)),
  requestPermissionsAsync: record('requestPermissionsAsync', () => Promise.resolve(fake.permission)),
  requestMicrophonePermissionsAsync: record('requestMicrophonePermissionsAsync', () => Promise.resolve(fake.permission)),
  androidTriggerOfflineModelDownload: record('androidTriggerOfflineModelDownload', () => Promise.resolve()),
  setAudioSessionActiveIOS: record('setAudioSessionActiveIOS'),
  start: record('start', () => { if (fake.startThrows) throw fake.startThrows; }),
  stop: record('stop'),
  abort: record('abort'),
  addListener(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return { remove: () => listeners.get(event)?.delete(fn) };
  },
};
export const __speech = fake;
export default { ExpoSpeechRecognitionModule };
`;

/** src/components/Dialog.tsx: alerts and shows are recorded; `__dialog.answer` is the button index show() resolves. */
export const DIALOG = `
const subscribers = new Set();
export const __dialog = {
  alerts: [],
  shows: [],
  answer: null,
  open: false,
  reset() { __dialog.alerts = []; __dialog.shows = []; __dialog.answer = null; __dialog.open = false; },
  setOpen(value) { __dialog.open = value; subscribers.forEach((fn) => fn()); },
};
export const dialog = {
  alert(title, message, buttons) { __dialog.alerts.push({ title, message, buttons }); },
  async show(options) { __dialog.shows.push(options); return { button: __dialog.answer }; },
};
export const dialogState = {
  isOpen: () => __dialog.open,
  subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
};
export default dialog;
`;
