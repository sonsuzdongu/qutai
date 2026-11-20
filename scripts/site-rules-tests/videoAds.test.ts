// "Block video ads" (src/content/videoAds.ts): the cleaning function the page runs (tested as the same JavaScript
// that ships), the page script's host and off-site checks, the fallback when an ad plays anyway (muted, sent to its
// end, skipped, sound given back) and the setting's default (off, owner 21 Nov 2026). Hosts and addresses come from
// the rules table, never written out here.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { DEFAULT_SETTINGS } from '../../src/storage/settings.ts';
import { isVideoAdHost, pruneSource, VIDEO_AD_RULES, videoAdScript, videoAdsOffHere } from '../../src/content/videoAds.ts';

const prune = vm.runInNewContext(`${pruneSource(VIDEO_AD_RULES)}\nprune`) as (v: unknown) => boolean;

const withAds = () => ({
  responseContext: { serviceTrackingParams: [] },
  playabilityStatus: { status: 'OK' },
  streamingData: { formats: [{ itag: 18 }] },
  videoDetails: { videoId: 'abc', title: 'A video' },
  adPlacements: [{ adPlacementRenderer: { config: {} } }],
  playerAds: [{ playerLegacyDesktopWatchAdsRenderer: {} }],
  adSlots: [{ adSlotRenderer: {} }],
  adBreakHeartbeatParams: 'Q0FB',
});

test('the setting is off by default', () => {
  assert.equal(DEFAULT_SETTINGS.blockVideoAds, false);
});

test('ad fields are removed from a player response; playback data stays', () => {
  const r = withAds();
  assert.equal(prune(r), true);
  for (const k of VIDEO_AD_RULES.fields) assert.equal(k in r, false, k);
  assert.deepEqual(r.streamingData, { formats: [{ itag: 18 }] });
  assert.equal(r.videoDetails.videoId, 'abc');
  assert.equal(r.playabilityStatus.status, 'OK');
});

test('a nested playerResponse and arrays of responses (watch navigations) are cleaned', () => {
  const nested = { response: { contents: {} }, playerResponse: withAds() };
  assert.equal(prune(nested), true);
  assert.equal('adPlacements' in nested.playerResponse, false);
  assert.ok(nested.response.contents);
  const list = [{ page: 'watch' }, { playerResponse: withAds() }, withAds()];
  assert.equal(prune(list), true);
  assert.equal('playerAds' in (list[1] as { playerResponse: object }).playerResponse, false);
  assert.equal('adSlots' in list[2], false);
});

test('a response without ads is left exactly as it was', () => {
  const r = { playabilityStatus: { status: 'OK' }, streamingData: {}, playerResponse: { videoDetails: {} } };
  const before = JSON.stringify(r);
  assert.equal(prune(r), false);
  assert.equal(JSON.stringify(r), before);
});

test('malformed or unexpected values never throw', () => {
  for (const v of [null, undefined, 0, '', 'adPlacements', true, [], [null, 1, 'x'], { playerResponse: 'x' }, { playerResponse: null }])
    assert.equal(prune(v), false);
  const frozen = Object.freeze({ adPlacements: [] });
  assert.equal(prune(frozen), false);
  assert.equal('adPlacements' in frozen, true);
  const hostile = new Proxy({}, { has() { throw new Error('no'); } });
  assert.equal(prune(hostile), false);
});

const HOSTS = VIDEO_AD_RULES.hosts;
const [APEX, WWW, MOBILE] = HOSTS;
const PLAYER_URL = VIDEO_AD_RULES.urls[0];

test('only the listed hosts; off sites (the site or the page around an embedded player) are left alone', () => {
  for (const h of HOSTS) assert.ok(isVideoAdHost(h), h);
  for (const h of [`not${APEX}`, `${APEX}.evil.example`, `studio.${APEX}`, 'example.com']) assert.equal(isVideoAdHost(h), false, h);
  assert.ok(videoAdsOffHere(MOBILE, [APEX]));
  assert.ok(videoAdsOffHere(MOBILE, [MOBILE]));
  assert.equal(videoAdsOffHere(MOBILE, [WWW]), false);
});

type FakeVideo = { muted: boolean; duration: number; currentTime: number };
type FakePage = { adShowing: boolean; video: FakeVideo | null; skipVisible: boolean; skipClicks: number };

/** Runs the page script in a small fake page and returns what it left in place. */
function runPage(host: string, offSites: string[] = [], before?: object) {
  const window: Record<string, unknown> = {};
  const page: FakePage = { adShowing: false, video: null, skipVisible: false, skipClicks: 0 };
  const timers: (() => void)[] = [];
  const showing = VIDEO_AD_RULES.adShowing.join(',');
  const skip = { offsetWidth: 10, offsetHeight: 10, click: () => page.skipClicks++ };
  const player = { querySelector: (q: string) => (q === 'video' ? page.video : null) };
  class Resp {
    url: string;
    body: unknown;
    constructor(url: string, body: unknown) {
      this.url = url;
      this.body = body;
    }
    json() {
      return Promise.resolve(this.body);
    }
  }
  const ctx = vm.createContext({
    window,
    location: { hostname: host },
    JSON: { parse: JSON.parse, stringify: JSON.stringify },
    Response: Resp,
    XMLHttpRequest: function () {},
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    document: {
      documentElement: null,
      addEventListener() {},
      hidden: false,
      querySelector: (q: string) => {
        if (q === showing) return page.adShowing ? player : null;
        if (q === 'video') return page.video;
        if (VIDEO_AD_RULES.skipButtons.includes(q)) return page.skipVisible && q === VIDEO_AD_RULES.skipButtons[0] ? skip : null;
        return null;
      },
    },
    setInterval: (f: () => void) => timers.push(f),
    URL,
  });
  if (before) window[VIDEO_AD_RULES.embedded[0]] = before;
  vm.runInContext(`var self = window; Object.setPrototypeOf(window, this);`, ctx);
  vm.runInContext(videoAdScript(VIDEO_AD_RULES, offSites).replace(/window\./g, 'self.').replace(/window\[/g, 'self['), ctx);
  const tick = () => timers.forEach((f) => f());
  return { window, ctx, Resp, page, tick, timers };
}

const EMBEDDED = VIDEO_AD_RULES.embedded[0];

test('on a supported site: the embedded data, JSON.parse and fetch json() answers lose their ads', async () => {
  const { window, ctx, Resp } = runPage(WWW);
  window[EMBEDDED] = withAds();
  assert.equal('adPlacements' in (window[EMBEDDED] as object), false);
  const parsed = vm.runInContext(`JSON.parse('{"adSlots":[1],"videoDetails":{"videoId":"x"}}')`, ctx);
  assert.deepEqual(parsed, { videoDetails: { videoId: 'x' } });
  const answer = await new Resp(`https://${WWW}${PLAYER_URL}?prettyPrint=false`, withAds()).json();
  assert.equal('playerAds' in (answer as object), false);
  const other = await new Resp(`https://${WWW}/some/log_event`, withAds()).json();
  assert.equal('playerAds' in (other as object), true);
});

test('embedded data already there when the script comes late is cleaned too', () => {
  const { window } = runPage(MOBILE, [], withAds());
  assert.equal('adPlacements' in (window[EMBEDDED] as object), false);
});

test('other sites and off sites are untouched (no timer either)', () => {
  for (const [host, off] of [
    ['example.com', []],
    [WWW, [APEX]],
  ] as const) {
    const { window, ctx, timers } = runPage(host, [...off]);
    window[EMBEDDED] = withAds();
    assert.equal('adPlacements' in (window[EMBEDDED] as object), true, host);
    assert.equal('adSlots' in vm.runInContext(`JSON.parse('{"adSlots":[1]}')`, ctx), true, host);
    assert.equal(timers.length, 0, host);
  }
});

test('fallback: an ad on screen is muted, sent to its end and skipped; the sound comes back when it ends', () => {
  const { page, tick } = runPage(MOBILE);
  page.video = { muted: false, duration: 15, currentTime: 1 };
  tick();
  assert.equal(page.video.muted, false, 'no ad: nothing touched');
  page.adShowing = true;
  page.skipVisible = true;
  tick();
  assert.equal(page.video.muted, true);
  assert.equal(page.video.currentTime, 15);
  assert.equal(page.skipClicks, 1);
  tick();
  assert.equal(page.video.muted, true, 'stays muted while the ad shows');
  page.adShowing = false;
  page.skipVisible = false;
  tick();
  assert.equal(page.video.muted, false, 'sound back after the ad');
});

test('fallback: a video the user had muted stays muted after the ad; an unknown duration is not sought', () => {
  const { page, tick } = runPage(WWW);
  page.video = { muted: true, duration: NaN, currentTime: 0 };
  page.adShowing = true;
  tick();
  assert.equal(page.video.muted, true);
  assert.equal(page.video.currentTime, 0);
  assert.equal(page.skipClicks, 0, 'no skip button visible');
  page.adShowing = false;
  tick();
  assert.equal(page.video.muted, true);
});

test('the fallback checks as often as the rules say, never more than every 100 ms', () => {
  assert.equal(VIDEO_AD_RULES.checkEveryMs, 300);
  assert.match(videoAdScript(), /\}, 300\);\n\}\)\(\);$/);
  assert.match(videoAdScript({ ...VIDEO_AD_RULES, checkEveryMs: 5 }), /\}, 100\);\n\}\)\(\);$/);
});
