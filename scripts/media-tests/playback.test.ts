// Media playing in pages (src/browser/playback.ts): the page script, run against a small stand-in DOM, reports what
// is audible and runs only the app's own commands; the app side (PagePlayback) keeps each tab's state from those
// reports, with a report that stops counting as silence.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';

(globalThis as { __DEV__?: boolean }).__DEV__ = false;
const { PagePlayback, pauseAllPages, playbackScript } = await import('../../src/browser/playback.ts');

// ---- A stand-in page ------------------------------------------------------------------------------

type Listener = (e: { type: string; target: unknown }) => void;

class Target {
  listeners = new Map<string, Listener[]>();
  addEventListener(type: string, fn: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  fire(type: string, target: unknown = this) {
    for (const fn of this.listeners.get(type) ?? []) fn({ type, target });
  }
}

/** A page with its own media element classes (the script patches their prototypes), timers run by hand. */
function page(os: 'ios' | 'android' = 'ios', incognito = false) {
  const posted: Record<string, unknown>[] = [];
  const timers: { fn: () => void; repeat: boolean; id: number }[] = [];
  let nextId = 1;
  const doc = new Target() as Target & { title: string };
  doc.title = 'Page title';

  class HTMLMediaElement extends Target {
    _paused = true;
    _ended = false;
    _muted = false;
    _volume = 1;
    _ready = 4;
    _time = 0;
    isConnected = true;
    get paused() { return this._paused; }
    get ended() { return this._ended; }
    get muted() { return this._muted; }
    get volume() { return this._volume; }
    get readyState() { return this._ready; }
    get duration() { return 120; }
    get playbackRate() { return 1; }
    get currentTime() { return this._time; }
    set currentTime(v: number) { this._time = v; }
    play() {
      this._paused = false;
      this.fire('play');
      this.fire('playing');
      return Promise.resolve();
    }
    pause() {
      this._paused = true;
      this.fire('pause');
    }
  }
  class HTMLVideoElement extends HTMLMediaElement {
    get videoWidth() { return 640; }
    get videoHeight() { return 360; }
    getBoundingClientRect() { return { left: 0, top: 0, right: 320, bottom: 180, width: 320, height: 180 }; }
  }
  // Element events also reach the document's capture listeners, as in a browser.
  const fireOn = HTMLMediaElement.prototype.fire;
  HTMLMediaElement.prototype.fire = function (type: string) {
    for (const fn of doc.listeners.get(type) ?? []) fn({ type, target: this });
    fireOn.call(this, type, this);
  };
  class Navigator {}
  const navigator = new Navigator();
  const win = new Target() as Target & Record<string, unknown>;
  Object.assign(win, {
    HTMLMediaElement,
    HTMLVideoElement,
    Navigator,
    ReactNativeWebView: { postMessage: (s: string) => posted.push(JSON.parse(s)) },
    setTimeout: (fn: () => void) => { timers.push({ fn, repeat: false, id: nextId }); return nextId++; },
    clearTimeout: (id: number) => { const i = timers.findIndex((x) => x.id === id); if (i >= 0) timers.splice(i, 1); },
    setInterval: (fn: () => void) => { timers.push({ fn, repeat: true, id: nextId }); return nextId++; },
    clearInterval: (id: number) => { const i = timers.findIndex((x) => x.id === id); if (i >= 0) timers.splice(i, 1); },
    frames: [],
    innerWidth: 400,
    innerHeight: 800,
    devicePixelRatio: 2,
  });
  win.top = win;
  win.parent = win;
  const location = { hostname: 'example.com', href: 'https://example.com/' };
  process.env.QUTAI_TEST_OS = os;
  const nonce = 'n'.repeat(32);
  const source = playbackScript(nonce, incognito, 'Private tab');
  const run = () => new Function('window', 'document', 'navigator', 'location', 'Navigator', source)(win, doc, navigator, location, Navigator);
  run();
  return {
    win,
    doc,
    navigator: navigator as Record<string, any>,
    nonce,
    posted,
    run,
    media: (video = false) => (video ? new HTMLVideoElement() : new HTMLMediaElement()),
    /** Runs the timers due once (a report's 150 ms delay; one heartbeat). */
    tick() {
      for (const t of timers.splice(0, timers.length)) {
        if (t.repeat) timers.push(t);
        t.fn();
      }
    },
    last: () => posted.at(-1) as Record<string, any>,
    command: (action: string, seconds?: number, n = nonce) => (win.__qutaiPlayback as (...a: unknown[]) => void)(n, action, seconds),
  };
}

afterEach(() => {
  delete process.env.QUTAI_TEST_OS;
});

test('a loud element playing makes the page audible; the report names the page and the media', () => {
  const p = page();
  const el = p.media();
  p.doc.fire('play', el);
  el.play();
  p.tick();
  const r = p.last();
  assert.equal(r.__qutaiPlayback, p.nonce);
  assert.equal(r.audible, true);
  assert.equal(r.playing, true);
  assert.equal(r.paused, false);
  assert.equal(r.title, 'Page title');
  assert.equal(r.duration, 120);
  assert.equal(r.video, null);
});

test('an element never added to the page (new Audio()) is seen through play()', () => {
  const p = page();
  const el = p.media();
  el.play(); // the patched play() tracks it
  p.tick();
  assert.equal(p.last().audible, true);
});

test('a muted element plays but is not audible; a paused one does not play', () => {
  const p = page();
  const muted = p.media();
  muted._muted = true;
  muted.play();
  p.tick();
  assert.deepEqual([p.last().audible, p.last().playing], [false, true]);
  muted.pause();
  p.tick();
  assert.deepEqual([p.last().audible, p.last().playing], [false, false]);
});

test('media with no data yet (readyState < 2) does not count', () => {
  const p = page();
  const el = p.media();
  el._ready = 1;
  el.play();
  p.tick();
  assert.equal(p.last().playing, false);
});

test('a playing video reports its size and its place on screen in device pixels', () => {
  const p = page();
  const v = p.media(true);
  v.play();
  p.tick();
  assert.deepEqual(p.last().video, [640, 360]);
  assert.deepEqual(p.last().rect, [0, 0, 640, 360]);
});

test('the script installs once per page', () => {
  const p = page();
  const before = p.win.listeners.get('message')?.length;
  p.run();
  assert.equal(p.win.listeners.get('message')?.length, before);
});

test('commands run only with the page\'s nonce: pause, play and seeking act on the current media', () => {
  const p = page();
  const el = p.media();
  el.play();
  p.command('pause', undefined, 'x'.repeat(32));
  assert.equal(el.paused, false, 'someone else\'s nonce: ignored');
  p.command('pause');
  assert.equal(el.paused, true);
  p.command('play');
  assert.equal(el.paused, false);
  el._time = 30;
  p.command('seekforward');
  assert.equal(el.currentTime, 40);
  p.command('seekbackward');
  p.command('seekbackward');
  p.command('seekbackward');
  p.command('seekbackward');
  assert.equal(el.currentTime, 0, 'never before the start');
  p.command('seekto', 75);
  assert.equal(el.currentTime, 75);
});

test('pauseAll pauses every element except a video the user put in picture-in-picture', () => {
  const p = page();
  const a = p.media();
  const b = p.media(true) as ReturnType<typeof p.media> & { webkitPresentationMode?: string };
  a.play();
  b.play();
  b.webkitPresentationMode = 'picture-in-picture';
  p.command('pauseAll');
  assert.equal(a.paused, true);
  assert.equal(b.paused, false);
});

test('Android: the stand-in Media Session gives the page\'s title and buttons; a button runs the page\'s handler', () => {
  const p = page('android');
  const ms = p.navigator.mediaSession;
  assert.ok(ms, 'navigator.mediaSession provided');
  const seen: unknown[] = [];
  ms.setActionHandler('nexttrack', (d: unknown) => seen.push(d));
  ms.setActionHandler('seekto', (d: unknown) => seen.push(d));
  ms.metadata = new (p.win.MediaMetadata as new (i: object) => object)({
    title: 'Song',
    artist: 'Band',
    artwork: [{ src: '/small.png', sizes: '96x96' }, { src: '/big.png', sizes: '512x512' }],
  });
  p.media().play();
  p.tick();
  const r = p.last();
  assert.equal(r.title, 'Song');
  assert.equal(r.artist, 'Band');
  assert.equal(r.artwork, 'https://example.com/big.png');
  assert.deepEqual(r.actions.sort(), ['nexttrack', 'seekto']);
  p.command('nexttrack');
  p.command('seekto', 12);
  assert.deepEqual(seen, [{ action: 'nexttrack' }, { action: 'seekto', seekTime: 12 }]);
});

test('iOS: no stand-in Media Session (WebKit has its own)', () => {
  const p = page('ios');
  assert.equal(p.navigator.mediaSession, undefined);
});

test('nothing playing: no heartbeat; while playing the same state is reported again on each heartbeat', () => {
  const p = page();
  const el = p.media();
  el.play();
  p.tick();
  const n = p.posted.length;
  p.tick(); // the heartbeat
  assert.equal(p.posted.length, n + 1);
  el.pause();
  p.tick();
  const after = p.posted.length;
  p.tick();
  p.tick();
  assert.equal(p.posted.length, after, 'silent and unchanged: nothing more');
});

// ---- The app side ---------------------------------------------------------------------------------

function tab() {
  const injected: string[] = [];
  let changes = 0;
  return {
    t: {
      webview: { injectJavaScript: (s: string) => injected.push(s) } as never,
      notifyPlaybackChange: () => changes++,
    },
    injected,
    changes: () => changes,
  };
}

beforeEach(() => mock.timers.reset());

test('PagePlayback: only its own reports count; a change of state notifies the tab once', () => {
  const { t, changes } = tab();
  const pp = new PagePlayback(t);
  assert.equal(pp.handleMessage('{"other":1}'), false);
  assert.equal(pp.handleMessage(JSON.stringify({ __qutaiPlayback: 'not-mine', audible: true, playing: true })), true);
  assert.equal(pp.audible, false);
  assert.equal(pp.handleMessage('{"__qutaiPlayback": broken'), true);
  const mine = JSON.stringify({ __qutaiPlayback: pp.nonce, audible: true, playing: true, title: 'x'.repeat(300), artist: 7 });
  pp.handleMessage(mine);
  assert.equal(pp.audible, true);
  assert.equal(pp.playing, true);
  assert.equal(pp.title.length, 200);
  assert.equal(pp.artist, '');
  assert.equal(changes(), 1);
  pp.handleMessage(mine); // the heartbeat: same state
  assert.equal(changes(), 1);
  pp.reset();
  assert.equal(pp.audible, false);
  assert.equal(pp.title, '');
  assert.equal(changes(), 2);
});

test('PagePlayback: reports that stop for 15 s count as silence', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { t } = tab();
    const pp = new PagePlayback(t);
    pp.handleMessage(JSON.stringify({ __qutaiPlayback: pp.nonce, audible: true, playing: true }));
    mock.timers.tick(14_000);
    pp.handleMessage(JSON.stringify({ __qutaiPlayback: pp.nonce, audible: true, playing: true }));
    mock.timers.tick(14_000);
    assert.equal(pp.audible, true, 'a heartbeat in time keeps it playing');
    mock.timers.tick(2_000);
    assert.equal(pp.audible, false);
    assert.equal(pp.playing, false);
  } finally {
    mock.timers.reset();
  }
});

test('PagePlayback: commands carry the nonce; a bad number of seconds is sent as null', () => {
  const { t, injected } = tab();
  const pp = new PagePlayback(t);
  pp.command('seekto', 42);
  pp.command('seekto', Number.NaN);
  assert.match(injected[0], new RegExp(`window.__qutaiPlayback\\("${pp.nonce}", "seekto", 42\\)`));
  assert.match(injected[1], /"seekto", null\)/);
});

test('pauseAllPages reaches the pages with media playing, not the others', () => {
  const a = tab();
  const b = tab();
  const playing = new PagePlayback(a.t);
  new PagePlayback(b.t);
  playing.handleMessage(JSON.stringify({ __qutaiPlayback: playing.nonce, audible: false, playing: true }));
  pauseAllPages();
  assert.equal(a.injected.length, 1);
  assert.match(a.injected[0], /"pauseAll"/);
  assert.equal(b.injected.length, 0);
  playing.reset();
});
