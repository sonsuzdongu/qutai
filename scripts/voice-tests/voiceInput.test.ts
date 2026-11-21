// Voice input sessions (src/device/voiceInput.ts) against a stand-in recogniser (./fakes.mjs): what reaches the
// message field, what ends a session, which errors are told to the user, a held session going on after the
// recogniser ends it, the online recogniser after the on-device one fails, and the next language after a refusal.
// Tests marked `todo` describe a known bug: they fail today without failing the suite, and wait for the owner.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
// @ts-expect-error the harness's stand-in (./loader.mjs) exports the test handle
import { __speech } from 'expo-speech-recognition';
// @ts-expect-error the harness's stand-in (./loader.mjs) exports the test handle
import { __dialog } from '../../src/components/Dialog.tsx';
import { t } from '../../src/i18n/index.ts';
import {
  abortVoiceInput,
  hasVoiceSession,
  isListening,
  startVoiceInput,
  stopVoiceInput,
  voiceModeSummary,
  voicePlan,
  type VoiceOptions,
  type VoiceResult,
} from '../../src/device/voiceInput.ts';
import { MAX_RESTARTS } from '../../src/device/voiceError.ts';

type Log = { writes: string[]; notes: string[]; ends: VoiceResult[]; finals: string[]; started: string[]; online: string[] };

function options(over: Partial<VoiceOptions> = {}): { o: VoiceOptions; log: Log } {
  const log: Log = { writes: [], notes: [], ends: [], finals: [], started: [], online: [] };
  const o: VoiceOptions = {
    languages: ['en'],
    owner: 'panel',
    incognito: false,
    online: 'allowed',
    onOnlineChange: (v) => log.online.push(v),
    draft: '',
    write: (text) => log.writes.push(text),
    onFinal: (text) => log.finals.push(text),
    notify: (m) => log.notes.push(m),
    onStarted: (lang) => log.started.push(lang),
    onEnd: (r) => log.ends.push(r),
    ...over,
  };
  return { o, log };
}

/** Lets the restarts finish() starts (not awaited by anyone) run to the recogniser's start. */
async function settle() {
  for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r));
}

// The timing line voiceInput logs at each session's end is left out of the test output.
const log = console.log;
console.log = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].startsWith('[voice-timing]')) return;
  log(...args);
};

const result = (transcript: string, isFinal = false) => __speech.emit('result', { results: [{ transcript }], isFinal });
const error = (code: string) => __speech.emit('error', { error: code });

beforeEach(() => {
  __speech.reset();
  __dialog.reset();
  delete process.env.QUTAI_TEST_OS;
});

afterEach(async () => {
  // Every test leaves voice input idle for the next one.
  if (isListening()) abortVoiceInput();
  await settle();
  if (isListening()) abortVoiceInput();
  delete process.env.QUTAI_TEST_OS;
});

// ---- A session from start to end -----------------------------------------------------------------

test('tap to talk: listening shows at "start", words are written after the draft, the final text is sent', async () => {
  const { o, log } = options({ draft: 'Hi' });
  assert.equal(await startVoiceInput(o), true);
  assert.equal(isListening(), true);
  assert.equal(hasVoiceSession(), true);
  const [started] = __speech.started();
  assert.equal(started.lang, 'en-US');
  assert.equal(started.continuous, false);
  assert.equal(started.requiresOnDeviceRecognition, false);
  assert.deepEqual(started.recordingOptions, { persist: false });
  assert.deepEqual(log.started, []);
  __speech.emit('start');
  assert.deepEqual(log.started, ['en-US']);
  result('hello');
  result('hello world', true);
  assert.deepEqual(log.writes, ['Hi hello', 'Hi hello world']);
  __speech.emit('end');
  assert.equal(isListening(), false);
  assert.deepEqual(log.finals, ['Hi hello world']);
  assert.deepEqual(log.ends, [{ text: 'hello world', interrupted: false, failed: false, timedOut: false }]);
});

test('a second start while one is running is turned down', async () => {
  const { o } = options();
  assert.equal(await startVoiceInput(o), true);
  assert.equal(await startVoiceInput(options().o), false);
  assert.equal(__speech.started().length, 1);
});

test('the user stops: the recogniser is asked to stop and the final result is still sent', async () => {
  const { o, log } = options();
  await startVoiceInput(o);
  __speech.emit('start');
  result('book a table', true);
  stopVoiceInput(false);
  assert.equal(__speech.calls.filter((c: { name: string }) => c.name === 'stop').length, 1);
  error('client'); // Android's late error after a stop, words in: ignored
  __speech.emit('end');
  assert.deepEqual(log.notes, []);
  assert.deepEqual(log.finals, ['book a table']);
  assert.equal(log.ends[0].failed, false);
});

test('no "end" after a stop in time: the session is aborted with the last interim words, marked timed out', async () => {
  const { o, log } = options();
  await startVoiceInput(o);
  __speech.emit('start');
  result('half a sen');
  stopVoiceInput(false, 5);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(__speech.calls.some((c: { name: string }) => c.name === 'abort'), true);
  assert.equal(isListening(), false);
  assert.deepEqual(log.ends, [{ text: 'half a sen', interrupted: false, failed: false, timedOut: true }]);
  assert.deepEqual(log.finals, []);
});

test('stopped by something else (a dialog opening): interrupted, nothing is sent automatically', async () => {
  const { o, log } = options();
  await startVoiceInput(o);
  __speech.emit('start');
  result('words', true);
  __dialog.setOpen(true);
  assert.equal(__speech.calls.some((c: { name: string }) => c.name === 'stop'), true);
  __speech.emit('end');
  assert.deepEqual(log.finals, []);
  assert.equal(log.ends[0].interrupted, true);
  assert.equal(log.ends[0].text, 'words');
});

test('abort ends at once, interrupted, with the words so far', async () => {
  const { o, log } = options();
  await startVoiceInput(o);
  result('so far');
  abortVoiceInput();
  assert.equal(isListening(), false);
  assert.deepEqual(log.ends, [{ text: 'so far', interrupted: true, failed: false, timedOut: false }]);
});

test('events of an ended session are not heard any more', async () => {
  const { o, log } = options();
  await startVoiceInput(o);
  __speech.emit('end');
  result('late');
  error('network');
  assert.deepEqual(log.writes, []);
  assert.deepEqual(log.notes, []);
  assert.equal(log.ends.length, 1);
});

// ---- Errors ---------------------------------------------------------------------------------------

test('nothing heard: "no speech" is told, the session failed', async () => {
  const { o, log } = options();
  await startVoiceInput(o);
  error('no-speech');
  __speech.emit('end');
  assert.deepEqual(log.notes, [t('voice.error.noSpeech')]);
  assert.equal(log.ends[0].failed, true);
});

test('each meaningful error with nothing heard has its own notice; unknown ones the generic one', async () => {
  const cases: [string, string][] = [
    ['network', 'voice.error.network'],
    ['audio-capture', 'voice.error.microphoneBusy'],
    ['busy', 'voice.error.microphoneBusy'],
    ['service-not-allowed', 'voice.error.unavailable'],
    ['client', 'voice.error.generic'],
    ['unknown', 'voice.error.generic'],
  ];
  for (const [code, key] of cases) {
    const { o, log } = options();
    await startVoiceInput(o);
    error(code);
    __speech.emit('end');
    assert.deepEqual(log.notes, [t(key as Parameters<typeof t>[0])], code);
  }
});

test('a late "client" error once the words are in is ignored: no notice, the text is sent', async () => {
  const { o, log } = options();
  await startVoiceInput(o);
  result('send this', true);
  error('client');
  __speech.emit('end');
  assert.deepEqual(log.notes, []);
  assert.deepEqual(log.finals, ['send this']);
  assert.equal(log.ends[0].failed, false);
});

test('a real error after words: they stay in the field, no notice, not sent automatically', async () => {
  const { o, log } = options();
  await startVoiceInput(o);
  result('half');
  error('network');
  __speech.emit('end');
  assert.deepEqual(log.notes, []);
  assert.deepEqual(log.finals, []);
  assert.deepEqual(log.ends[0], { text: 'half', interrupted: false, failed: true, timedOut: false });
});

test('"aborted" is never an error', async () => {
  const { o, log } = options();
  await startVoiceInput(o);
  error('aborted');
  __speech.emit('end');
  assert.deepEqual(log.notes, []);
  assert.equal(log.ends[0].failed, false);
});

test('"interrupted" ends quietly, marked interrupted', async () => {
  const { o, log } = options();
  await startVoiceInput(o);
  error('interrupted');
  __speech.emit('end');
  assert.deepEqual(log.notes, []);
  assert.equal(log.ends[0].interrupted, true);
});

test('microphone refused during the session: the settings offer, not a toast', async () => {
  const { o, log } = options();
  await startVoiceInput(o);
  error('not-allowed');
  __speech.emit('end');
  assert.deepEqual(log.notes, []);
  assert.equal(__dialog.alerts.length, 1);
  assert.equal(__dialog.alerts[0].message, t('voice.permissionDenied'));
});

test('network trouble in incognito (on-device only) says voice input is unavailable', async () => {
  __speech.onDevice = true;
  const { o, log } = options({ incognito: true });
  await startVoiceInput(o);
  assert.equal(__speech.started()[0].requiresOnDeviceRecognition, true);
  error('network');
  __speech.emit('end');
  assert.deepEqual(log.notes, [t('voice.error.unavailable')]);
});

test('"nomatch" with nothing heard says no speech; with words, or while held, nothing', async () => {
  let { o, log } = options();
  await startVoiceInput(o);
  __speech.emit('nomatch');
  __speech.emit('end');
  assert.deepEqual(log.notes, [t('voice.error.noSpeech')]);

  ({ o, log } = options());
  await startVoiceInput(o);
  result('words');
  __speech.emit('nomatch');
  __speech.emit('end');
  assert.deepEqual(log.notes, []);

  ({ o, log } = options({ hold: true }));
  await startVoiceInput(o);
  __speech.emit('nomatch');
  stopVoiceInput(false);
  __speech.emit('end');
  assert.deepEqual(log.notes, []);
});

// ---- Held sessions ------------------------------------------------------------------------------

test('held: the recogniser ending by itself starts it again, the words heard so far stay in front', async () => {
  const { o, log } = options({ hold: true, draft: 'Note:' });
  await startVoiceInput(o);
  assert.equal(__speech.started()[0].continuous, true);
  __speech.emit('start');
  result('one', true);
  __speech.emit('end'); // the recogniser ended it while the finger is still down
  assert.equal(hasVoiceSession(), true);
  await settle();
  assert.equal(__speech.started().length, 2);
  assert.deepEqual(log.ends, []);
  __speech.emit('start');
  assert.deepEqual(log.started, ['en-US'], 'listening is announced once per hold');
  result('two', true);
  assert.equal(log.writes.at(-1), 'Note: one two');
  stopVoiceInput(false);
  __speech.emit('end');
  assert.deepEqual(log.finals, ['Note: one two']);
  assert.deepEqual(log.ends, [{ text: 'one two', interrupted: false, failed: false, timedOut: false }]);
});

test(`held: a recogniser that keeps ending is started again at most ${MAX_RESTARTS} times`, async () => {
  const { o, log } = options({ hold: true });
  await startVoiceInput(o);
  for (let i = 0; i < MAX_RESTARTS + 2; i++) {
    __speech.emit('end');
    await settle();
  }
  assert.equal(__speech.started().length, MAX_RESTARTS + 1);
  assert.equal(log.ends.length, 1);
  assert.equal(isListening(), false);
});

test('held: a real error ends the hold (no restart) and is told', async () => {
  const { o, log } = options({ hold: true });
  await startVoiceInput(o);
  error('network');
  __speech.emit('end');
  await settle();
  assert.equal(__speech.started().length, 1);
  assert.deepEqual(log.notes, [t('voice.error.network')]);
  assert.equal(log.ends[0].failed, true);
});

test('held: lifting the finger (asked to stop) does not start it again', async () => {
  const { o, log } = options({ hold: true });
  await startVoiceInput(o);
  result('done', true);
  stopVoiceInput(false);
  __speech.emit('end');
  await settle();
  assert.equal(__speech.started().length, 1);
  assert.deepEqual(log.finals, ['done']);
});

test(
  'held, after a restart: a late recogniser error before new words, with the earlier words kept, is not told',
  async () => {
    const { o, log } = options({ hold: true });
    await startVoiceInput(o);
    __speech.emit('start');
    result('remember the milk', true);
    __speech.emit('end'); // the recogniser ends the run by itself; the hold goes on
    await settle();
    error('client'); // the recogniser's own late trouble, before any new words in the new run
    assert.deepEqual(log.notes, [], 'the words were heard: no "didn\'t work" notice');
    stopVoiceInput(false);
    __speech.emit('end');
    assert.deepEqual(log.finals, ['remember the milk']);
  },
);

test(
  'the recogniser throwing at start: the usual error, the session dropped, and the next press starts',
  async () => {
    __speech.startThrows = new Error('native start failed');
    const { o, log } = options();
    const started = await startVoiceInput(o);
    assert.deepEqual(log.notes, [t('voice.error.generic')]);
    assert.equal(started, false, 'reported as not started');
    assert.equal(isListening(), false, 'back to idle, so the next press can start');
    assert.equal(__speech.listenerCount('end'), 0, 'its listeners are removed');
    __speech.startThrows = null;
    assert.equal(await startVoiceInput(options().o), true, 'the next press starts listening');
    assert.equal(__speech.started().length, 2);
  },
);

// ---- On-device, online, next language -----------------------------------------------------------

test('the on-device recogniser failing to start: the same language again online, once, without a notice', async () => {
  __speech.onDevice = true;
  const { o, log } = options();
  await startVoiceInput(o);
  assert.equal(__speech.started()[0].requiresOnDeviceRecognition, true);
  error('service-not-allowed');
  __speech.emit('end');
  await settle();
  const runs = __speech.started();
  assert.equal(runs.length, 2);
  assert.equal(runs[1].lang, runs[0].lang);
  assert.equal(runs[1].requiresOnDeviceRecognition, false);
  assert.deepEqual(log.notes, []);
  assert.deepEqual(log.ends, []);
  // A second failure online is a real one.
  error('service-not-allowed');
  __speech.emit('end');
  await settle();
  assert.equal(__speech.started().length, 2);
  assert.deepEqual(log.notes, [t('voice.error.unavailable')]);
  assert.equal(log.ends.length, 1);
});

test('no online fallback when the user has not allowed the online service, nor in incognito', async () => {
  for (const over of [{ online: 'declined' as const }, { incognito: true }]) {
    __speech.reset();
    __speech.onDevice = true;
    const { o, log } = options(over);
    await startVoiceInput(o);
    error('service-not-allowed');
    __speech.emit('end');
    await settle();
    assert.equal(__speech.started().length, 1, JSON.stringify(over));
    assert.deepEqual(log.notes, [t('voice.error.unavailable')]);
  }
});

test('Android: the recogniser turning the language down at the start tries the next language', async () => {
  process.env.QUTAI_TEST_OS = 'android';
  const { o, log } = options({ languages: ['tr', 'en'] });
  await startVoiceInput(o);
  assert.equal(__speech.started()[0].lang, 'tr-TR');
  error('language-not-supported');
  __speech.emit('end');
  await settle();
  assert.equal(__speech.started()[1].lang, 'en-US');
  assert.deepEqual(log.notes, []);
  __speech.emit('end');
  assert.equal(log.ends.length, 1);
});

test('the last language turned down: told which language is unavailable', async () => {
  process.env.QUTAI_TEST_OS = 'android';
  const { o } = options({ languages: ['tr'] });
  await startVoiceInput(o);
  error('language-not-supported');
  __speech.emit('end');
  assert.equal(__dialog.alerts.length, 1);
  assert.match(__dialog.alerts[0].message, /Turkish|Türkçe/);
});

// ---- Before listening -----------------------------------------------------------------------------

test('the online service not asked yet: asked once; dismissing asks again next time and starts nothing', async () => {
  const { o, log } = options({ online: 'ask' });
  assert.equal(await startVoiceInput(o), false);
  assert.equal(__dialog.shows.length, 1);
  assert.deepEqual(log.online, []);
  assert.equal(__speech.started().length, 0);
  assert.equal(isListening(), false);
});

test('the online service allowed in the question: remembered, and listening starts (not when held)', async () => {
  __dialog.answer = 1; // [Decline, Allow]
  let { o, log } = options({ online: 'ask' });
  assert.equal(await startVoiceInput(o), true);
  assert.deepEqual(log.online, ['allowed']);
  abortVoiceInput();

  ({ o, log } = options({ online: 'ask', hold: true }));
  assert.equal(await startVoiceInput(o), false);
  assert.deepEqual(log.online, ['allowed']);
});

test('the online service declined in the question, or earlier: nothing starts', async () => {
  __dialog.answer = 0;
  let { o, log } = options({ online: 'ask' });
  assert.equal(await startVoiceInput(o), false);
  assert.deepEqual(log.online, ['declined']);

  ({ o, log } = options({ online: 'declined' }));
  assert.equal(await startVoiceInput(o), false);
  assert.equal(__dialog.alerts.at(-1).message, t('voice.onlineDeclined'));
  assert.equal(__speech.started().length, 0);
});

test('incognito without on-device recognition: explained, nothing starts', async () => {
  const { o } = options({ incognito: true });
  assert.equal(await startVoiceInput(o), false);
  assert.equal(__dialog.shows[0].message, t('voice.incognitoOff'));
  assert.equal(__speech.started().length, 0);
});

test('no recogniser on the phone: explained, nothing starts', async () => {
  __speech.available = false;
  const { o } = options();
  assert.equal(await startVoiceInput(o), false);
  assert.equal(__dialog.alerts[0].message, t('voice.unavailableIos'));
});

test('microphone refused for good: the settings offer, nothing starts', async () => {
  __speech.permission = { granted: false, canAskAgain: false, status: 'denied' };
  const { o } = options();
  assert.equal(await startVoiceInput(o), false);
  assert.equal(__dialog.alerts[0].message, t('voice.permissionDenied'));
  assert.equal(__speech.started().length, 0);
});

test('a dialog already open: nothing starts (it would hide the listening state)', async () => {
  __dialog.open = true;
  const { o } = options();
  assert.equal(await startVoiceInput(o), false);
  assert.equal(__speech.started().length, 0);
});

// ---- Plans ----------------------------------------------------------------------------------------

test('voicePlan on iOS: on-device only for the phone\'s own language; a language the recogniser lacks is skipped', async () => {
  __speech.onDevice = true;
  assert.deepEqual(await voicePlan(['en']), { lang: 'en-US', onDevice: true, downloadable: null, fellBackFrom: null, rest: [] });
  assert.equal((await voicePlan(['tr'])).onDevice, false, 'not the phone\'s language: never claimed on-device');
  __speech.locales = { locales: ['de-DE', 'en-GB'], installedLocales: [] };
  const plan = await voicePlan(['tr', 'en']);
  assert.equal(plan.lang, 'en-GB');
  assert.equal(plan.fellBackFrom, 'tr');
});

test('voiceModeSummary follows the plan and the online answer', async () => {
  __speech.onDevice = true;
  assert.equal(await voiceModeSummary('en', 'ask'), 'onDevice');
  __speech.onDevice = false;
  assert.equal(await voiceModeSummary('en', 'allowed'), 'online');
  assert.equal(await voiceModeSummary('en', 'declined'), 'onlineDeclined');
  assert.equal(await voiceModeSummary('en', 'ask'), 'onlineAsk');
});
