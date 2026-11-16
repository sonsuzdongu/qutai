// Regression test for the crash when "Qutai" was picked on setup's AI step (pro mode, 16 Nov 2026).
//
// Picking Qutai Credits opens the disclosure, the first dialog setup ever shows. DialogView reads the safe-area insets
// (useSafeAreaInsets), which throws without a <SafeAreaProvider> above it, and the only provider was inside the
// browser (BrowserApp), not above setup (Onboarding). The fix moved the provider to App's root. Rendering App needs
// the native modules, so this checks the source: App's returned tree starts with the provider and holds both the
// screen content (setup or the browser) and the launch intro.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const app = readFileSync(new URL('App.tsx', root), 'utf8');

/** The body of `export default function App()`, up to the next top-level function. */
function appBody(): string {
  const start = app.indexOf('export default function App(');
  assert.ok(start >= 0, 'App.tsx has `export default function App()`');
  const next = app.indexOf('\nfunction ', start + 1);
  return app.slice(start, next < 0 ? undefined : next);
}

test('App wraps setup and the browser in one SafeAreaProvider', () => {
  const body = appBody();
  const ret = body.lastIndexOf('\n  return (');
  assert.ok(ret >= 0, "App's last return");
  const tree = body.slice(ret);
  const open = tree.indexOf('<SafeAreaProvider>');
  const close = tree.indexOf('</SafeAreaProvider>');
  assert.ok(open >= 0 && close > open, 'App returns a <SafeAreaProvider>');
  // Nothing but whitespace and comments before it: it is the outermost element.
  assert.match(tree.slice('\n  return ('.length, open), /^\s*$/);
  const inside = tree.slice(open, close);
  assert.ok(inside.includes('{content}'), 'setup (Onboarding) and the browser are rendered inside the provider');
  assert.ok(inside.includes('<LaunchIntro'), 'the launch intro is inside the provider');
});

test('setup still draws its dialogs itself (so it needs the provider)', () => {
  const onboarding = readFileSync(new URL('src/components/Onboarding.tsx', root), 'utf8');
  assert.ok(onboarding.includes('<DialogHost root />'));
  const dialog = readFileSync(new URL('src/components/Dialog.tsx', root), 'utf8');
  assert.ok(dialog.includes('useSafeAreaInsets()'), 'if DialogView stops reading insets, this test can be revisited');
});
