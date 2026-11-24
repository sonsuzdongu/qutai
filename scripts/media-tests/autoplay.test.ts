// Autoplay with sound (src/browser/autoplay.ts): until the user touches the page, media that would be heard doesn't
// start, muted media does, and Qutai's own playback commands still work; run against a small stand-in page.
import assert from 'node:assert/strict';
import { test } from 'node:test';

(globalThis as { __DEV__?: boolean }).__DEV__ = false;
const { AUTOPLAY_RULE, autoplayGuardScript } = await import('../../src/browser/autoplay.ts');
const { playbackScript } = await import('../../src/browser/playback.ts');

const rule = new Function(`${AUTOPLAY_RULE}; return qutaiMayStart;`)() as (m: boolean, v: number, s: boolean, a: boolean) => boolean;

test('the rule: sound needs a touch; muted, silent and camera streams never do', () => {
  assert.equal(rule(false, 1, false, false), false);
  assert.equal(rule(false, 1, false, true), true);
  assert.equal(rule(true, 1, false, false), true);
  assert.equal(rule(false, 0, false, false), true);
  assert.equal(rule(false, 1, true, false), true);
});

type Listener = (e: Record<string, unknown>) => void;
class Target {
  listeners = new Map<string, Listener[]>();
  addEventListener(type: string, fn: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  fire(type: string, e: Record<string, unknown> = {}) {
    for (const fn of this.listeners.get(type) ?? []) fn({ type, target: this, ...e });
  }
}

function page(browserActivation = false) {
  const doc = new Target() as Target & { title: string };
  doc.title = 't';
  class MediaStream {}
  class HTMLMediaElement extends Target {
    _paused = true;
    _muted = false;
    _volume = 1;
    _src: unknown = null;
    get paused() { return this._paused; }
    get ended() { return false; }
    get muted() { return this._muted; }
    set muted(v: boolean) { this._muted = v; this.fire('volumechange'); }
    get volume() { return this._volume; }
    get readyState() { return 4; }
    get duration() { return 60; }
    get playbackRate() { return 1; }
    get currentTime() { return 0; }
    set currentTime(_v: number) {}
    get srcObject() { return this._src; }
    play() { this._paused = false; this.fire('play'); this.fire('playing'); return Promise.resolve(); }
    pause() { this._paused = true; this.fire('pause'); }
    /** The autoplay attribute: starts without play(). */
    autoplay() { this._paused = false; this.fire('play'); }
    override fire(type: string) {
      for (const fn of doc.listeners.get(type) ?? []) fn({ type, target: this });
      super.fire(type);
    }
  }
  class AudioContext {
    state = 'running';
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    resume() { this.state = 'running'; return Promise.resolve(); }
  }
  const win = new Target() as Target & Record<string, unknown>;
  Object.assign(win, {
    HTMLMediaElement,
    MediaStream,
    AudioContext,
    Promise,
    DOMException,
    ReactNativeWebView: { postMessage: () => {} },
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    length: 0,
  });
  win.top = win;
  win.parent = win;
  const navigator = { userActivation: { hasBeenActive: false } };
  const nonce = 'n'.repeat(32);
  const run = (src: string) =>
    new Function('window', 'document', 'navigator', 'location', src)(win, doc, navigator, { hostname: 'e.com', href: 'https://e.com/' });
  run(autoplayGuardScript(nonce, browserActivation));
  run(playbackScript(nonce, false, 'Private tab'));
  return {
    win,
    navigator,
    media: () => new HTMLMediaElement(),
    touch: () => win.fire('pointerdown', { isTrusted: true }),
    command: (action: string) => (win.__qutaiPlayback as (...a: unknown[]) => void)(nonce, action, null),
    AudioContext: () => new (win.AudioContext as new () => AudioContext)(),
    MediaStream,
  };
}

test('sound before a touch is refused; muted plays; after a touch sound plays', async () => {
  const p = page();
  const loud = p.media();
  await assert.rejects(loud.play(), { name: 'NotAllowedError' });
  assert.equal(loud.paused, true);
  const quiet = p.media();
  quiet._muted = true;
  await quiet.play();
  assert.equal(quiet.paused, false);
  p.touch();
  await loud.play();
  assert.equal(loud.paused, false);
});

test("Android: the browser's own sticky activation also counts; iOS: it doesn't (WebKit counts Qutai's own scripts)", async () => {
  const android = page(true);
  android.navigator.userActivation.hasBeenActive = true;
  const el = android.media();
  await el.play();
  assert.equal(el.paused, false);
  const ios = page(false);
  ios.navigator.userActivation.hasBeenActive = true;
  await assert.rejects(ios.media().play(), { name: 'NotAllowedError' });
});

test('an element that starts by itself with sound, or unmutes itself, is paused', async () => {
  const p = page();
  const auto = p.media();
  auto.autoplay();
  assert.equal(auto.paused, true);
  const muted = p.media();
  muted._muted = true;
  await muted.play();
  muted.muted = false;
  assert.equal(muted.paused, true);
});

test('camera and microphone streams are never held back', async () => {
  const p = page();
  const el = p.media();
  el._src = new p.MediaStream();
  await el.play();
  assert.equal(el.paused, false);
});

test("Qutai's own play command (lock screen, notification) still plays", async () => {
  const p = page();
  const el = p.media();
  el._muted = true;
  await el.play(); // tracked as the page's media
  el._muted = false;
  el._paused = true;
  p.command('play');
  assert.equal(el.paused, false);
});

test('Web Audio starts suspended and resumes at the first touch', async () => {
  const p = page();
  const ctx = p.AudioContext();
  assert.equal(ctx.state, 'suspended');
  await ctx.resume();
  assert.equal(ctx.state, 'suspended');
  p.touch();
  assert.equal(ctx.state, 'running');
});
