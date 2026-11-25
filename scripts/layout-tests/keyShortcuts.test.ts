// Keyboard shortcuts on a Mac and an iPad (UI-76): src/ui/keyShortcuts.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isShortcutEvent, isShortcutId, SHORTCUTS, shortcutTab, TEXT_EDITING } from '../../src/ui/keyShortcuts';

const combo = (s: { input: string; modifiers: string[] }) => `${[...s.modifiers].sort().join('+')}+${s.input}`;

test('the shortcuts are the agreed keys', () => {
  const byId = Object.fromEntries(SHORTCUTS.map((s) => [s.id, combo(s)]));
  assert.equal(byId.newTab, 'command+t');
  assert.equal(byId.closeTab, 'command+w');
  assert.equal(byId.reopenTab, 'command+shift+t');
  assert.equal(byId.reload, 'command+r');
  assert.equal(byId.focusAddress, 'command+l');
  assert.equal(byId.find, 'command+f');
  assert.equal(byId.back, 'command+[');
  assert.equal(byId.forward, 'command+]');
  assert.equal(byId.nextTab, 'control+tab');
  assert.equal(byId.prevTab, 'control+shift+tab');
  assert.equal(byId.newIncognitoTab, 'command+shift+n');
  assert.equal(byId.voice, 'alternate+ ');
  for (let n = 1; n <= 9; n++) assert.equal(byId[`tab${n}`], `command+${n}`);
});

test('no two shortcuts share a key, and none takes a text editing key', () => {
  const combos = SHORTCUTS.map(combo);
  assert.equal(new Set(combos).size, combos.length);
  for (const key of TEXT_EDITING) assert.ok(!combos.includes(combo(key)), combo(key));
});

test('every shortcut has a title for the ⌘-hold overlay', () => {
  for (const s of SHORTCUTS) assert.ok(s.title.key.length > 0, s.id);
  assert.deepEqual(SHORTCUTS.find((s) => s.id === 'tab3')?.title, { key: 'shortcuts.tab', values: { n: 3 } });
  assert.deepEqual(SHORTCUTS.find((s) => s.id === 'tab9')?.title, { key: 'shortcuts.lastTab' });
});

test('only known ids are accepted from the native side', () => {
  assert.ok(isShortcutId('newTab'));
  assert.ok(isShortcutId('tab9'));
  assert.ok(!isShortcutId('tab0'));
  assert.ok(!isShortcutId('copy'));
  assert.ok(!isShortcutId(undefined));
});

test('the voice key arrives as its press and release, never as itself', () => {
  assert.ok(isShortcutEvent('voiceDown'));
  assert.ok(isShortcutEvent('voiceUp'));
  assert.ok(isShortcutEvent('voiceCancel'));
  assert.ok(isShortcutEvent('reload'));
  assert.ok(!isShortcutEvent('voice'));
  assert.ok(!isShortcutEvent('paste'));
});

const ids = ['a', 'b', 'c', 'd'];

test('⌘1…⌘8 pick that tab, ⌘9 the last one', () => {
  assert.equal(shortcutTab('tab1', ids, 'c'), 'a');
  assert.equal(shortcutTab('tab4', ids, 'a'), 'd');
  assert.equal(shortcutTab('tab5', ids, 'a'), null);
  assert.equal(shortcutTab('tab9', ids, 'a'), 'd');
  assert.equal(shortcutTab('tab9', ['a'], 'a'), null);
});

test('the active tab is not switched to again', () => {
  assert.equal(shortcutTab('tab2', ids, 'b'), null);
});

test('⌃Tab and ⌃⇧Tab go to the next and previous tab, wrapping around', () => {
  assert.equal(shortcutTab('nextTab', ids, 'b'), 'c');
  assert.equal(shortcutTab('nextTab', ids, 'd'), 'a');
  assert.equal(shortcutTab('prevTab', ids, 'a'), 'd');
  assert.equal(shortcutTab('prevTab', ids, 'c'), 'b');
  assert.equal(shortcutTab('nextTab', ['a'], 'a'), null);
});

test('with no tabs, or an active tab not in the list, nothing odd happens', () => {
  assert.equal(shortcutTab('nextTab', [], 'a'), null);
  assert.equal(shortcutTab('nextTab', ids, 'zz'), 'a');
  assert.equal(shortcutTab('reload', ids, 'a'), null);
});
