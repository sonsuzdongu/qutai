// The page script's secret name (UNTR-26, browser/agentScript.ts): a new one for every document on Android, where the
// early script may run after the page's own scripts, so a page never knows the name before Qutai installs it there;
// stable on iOS, where it is installed before any page script and a new name would only miss the early install.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { Tab } from '../../src/browser/Tab.ts';

afterEach(() => {
  delete process.env.QUTAI_TEST_OS;
});

function loadTwice(os: 'ios' | 'android') {
  process.env.QUTAI_TEST_OS = os;
  const tab = new Tab('t', 'https://a.test/', false, undefined, () => {});
  const names = [tab.agentName];
  tab.handleLoadStart('https://a.test/one', true);
  names.push(tab.agentName);
  tab.handleLoadStart('https://a.test/two', true);
  names.push(tab.agentName);
  return { tab, names };
}

test('Android: a new secret name for every document; the scripts and commands follow it', () => {
  const { tab, names } = loadTwice('android');
  assert.equal(new Set(names).size, 3);
  for (const n of names) assert.match(n, /^__q[0-9a-f]{32}$/);
  assert.ok(tab.agentInstallScript.includes(JSON.stringify(tab.agentName)));
});

test('iOS: one name for the tab, installed at document start in every document', () => {
  const { names } = loadTwice('ios');
  assert.equal(new Set(names).size, 1);
});

test('two tabs never share a name', () => {
  const a = new Tab('a', 'https://a.test/', false, undefined, () => {});
  const b = new Tab('b', 'https://a.test/', false, undefined, () => {});
  assert.notEqual(a.agentName, b.agentName);
});
