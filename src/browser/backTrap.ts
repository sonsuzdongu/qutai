/**
 * Back-button traps (NAV-?? in docs/design/14-tabs-and-conversations.md): a page that adds history entries the user
 * never asked for (pushState, a #fragment, a script's own navigation to another page of the site) so that Back keeps
 * them on the site. Like Chrome's history manipulation intervention, an entry the user never interacted with, and
 * that the page left without a user gesture, is skipped when the user goes Back (Qutai's back button, Android's back
 * button and gesture, the error page's Back).
 *
 * The page script keeps the marks (installed with the main-frame page script at document start, before the page's
 * own scripts, agentScript.ts); when the user goes Back the app asks it (the `back` command) and it goes back itself,
 * past the marked entries; when it doesn't answer in time the WebView goes back one entry as before. iOS only:
 * Android's WebView already skips these entries in its own goBack (Chromium's history manipulation intervention). Only the main frame's history, only
 * entries of the site on screen (the Navigation API lists the current origin's entries only): the furthest it goes
 * is the entry just before the site's own entries, which is never skipped. A page can only mark its own entries, so
 * the worst a page can do with the marks is let the user leave it sooner. Without the Navigation API (older
 * WebViews), nothing changes: one entry back.
 *
 * Plain ES5 in strings, like the page script.
 */

/**
 * The rules, as the page runs them (tested in scripts/navigation-tests/backTrap.test.ts):
 * - qutaiLeftWithoutGesture(touched, active, userInitiated): an entry being left is marked when the user never
 *   touched or typed on the page while it was current, the navigation away has no transient user activation, and
 *   the browser doesn't call it user-initiated (a link tap, a form sent).
 * - qutaiBackSteps(keys, index, marked): how many entries back the user's Back goes from `index` in `keys` (the
 *   site's entries, oldest first): past every marked entry; `beyond` when all the site's earlier entries are marked,
 *   so the target is the entry before them (not listed; it may not exist).
 */
export const BACK_TRAP_RULE = String.raw`
function qutaiLeftWithoutGesture(touched, active, userInitiated) {
  return !touched && !active && !userInitiated;
}
function qutaiBackSteps(keys, index, marked) {
  var j = index - 1;
  while (j >= 0 && marked(keys[j])) j--;
  if (j >= 0) return { steps: index - j, beyond: false };
  return { steps: index + 1, beyond: index > 0 };
}
`;

/**
 * Inside the page script installer (agentScript.ts): fills `__qutaiAgent.back`. Marks are kept by entry key (the
 * Navigation API's key stays with an entry through replaceState and reloads) in memory and in the session storage of
 * the site, so entries of the site's earlier documents (a script's own navigation to another page) keep theirs.
 */
export const BACK_TRAP_SCRIPT = String.raw`
(function () {
  var agent = __qutaiAgent;
  var nav = window.navigation;
  if (!agent || agent.back || !nav || typeof nav.entries !== 'function') return;
  ${BACK_TRAP_RULE}
  var STORE = '__qutaiBackMarks';
  var MAX_MARKS = 50;
  var go = History.prototype.go;
  var hist = window.history;
  var setTimer = window.setTimeout;
  var marks = {};
  var touched = {};
  var left = false;
  var stored = null;
  try { stored = window.sessionStorage; } catch (e) {}
  try { var saved = stored && JSON.parse(stored.getItem(STORE) || '{}'); if (saved && typeof saved === 'object') marks = saved; } catch (e) {}
  function save() {
    if (!stored) return;
    try {
      var keys = Object.keys(marks);
      if (keys.length > MAX_MARKS) for (var i = 0; i < keys.length - MAX_MARKS; i++) delete marks[keys[i]];
      if (Object.keys(marks).length) stored.setItem(STORE, JSON.stringify(marks));
      else stored.removeItem(STORE);
    } catch (e) {}
  }
  function currentKey() {
    try { return nav.currentEntry ? nav.currentEntry.key : null; } catch (e) { return null; }
  }
  function onInput(e) {
    if (!e.isTrusted) return;
    var key = currentKey();
    if (!key) return;
    touched[key] = true;
    // The user interacted with this entry: it is never skipped, whatever happened before (a reload kept its mark).
    if (marks[key]) { delete marks[key]; save(); }
  }
  ['pointerdown', 'touchend', 'mousedown', 'keydown'].forEach(function (type) {
    window.addEventListener(type, onInput, { capture: true, passive: true });
  });
  window.addEventListener('pagehide', function () { left = true; }, true);
  window.addEventListener('pageshow', function () { left = false; }, true);
  nav.addEventListener('navigate', function (e) {
    if (e.navigationType !== 'push') return;
    var key = currentKey();
    if (!key) return;
    // Not navigator.userActivation: WebKit counts the app's own injected scripts as a user gesture (autoplay.ts).
    if (qutaiLeftWithoutGesture(!!touched[key], false, !!e.userInitiated)) marks[key] = 1;
    else delete marks[key];
    save();
  }, true);

  // Goes back itself and answers how many entries (0: nothing done, the app's WebView goes back instead). It goes
  // back one entry itself too: WebKit's own goBack doesn't move from an entry the user made with a tap.
  agent.back = function (deadline) {
    if (typeof deadline === 'number' && Date.now() > deadline) return 0;
    var entries = nav.entries();
    var here = nav.currentEntry;
    if (!here || here.index < 0) return 0;
    var keys = [];
    for (var i = 0; i < entries.length; i++) keys[i] = entries[i].key;
    var r = qutaiBackSteps(keys, here.index, function (k) { return marks[k] === 1; });
    go.call(hist, -r.steps);
    if (r.beyond) {
      // Nothing before the site's entries (its first page opened the tab): history.go out of range does nothing, so
      // back to the site's first entry instead.
      var from = here.key;
      var back = here.index;
      left = false;
      setTimer(function () { if (!left && currentKey() === from) go.call(hist, -back); }, 400);
    }
    return r.steps;
  };
})();
`;
