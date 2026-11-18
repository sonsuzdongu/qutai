// Step lines name the element a page step acts on (18 Nov 2026: the owner saw "Tıklanıyor (ref 1)"): its name and kind
// in the language's own grammar, never the model's ref. Display only; the model's input is untouched.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { setLanguage } from '../../src/i18n/index.ts';
import { LANGUAGES } from '../../src/i18n/languages.ts';
import { t, type MessageKey } from '../../src/i18n/index.ts';
import {
  capitalizeFirst,
  prepareStepTarget,
  shownName,
  stepTabTitle,
  targetKind,
  targetPhrase,
  targetWords,
} from '../../src/agent/stepTarget.ts';

/** describeToolCall's lines for the page and tab steps (executeTool.ts pulls in the whole app, so it is mirrored). */
function describeToolCall(name: string, input: Record<string, unknown>): string {
  const on = (key: MessageKey, params: Record<string, string> = {}) =>
    capitalizeFirst(t(key, { ...params, target: targetWords(name, input) }));
  const tab = (key: 'action.switchTab' | 'action.readTab') =>
    stepTabTitle(input) ? t(key, { title: stepTabTitle(input) }) : t(`${key}Plain`);
  switch (name) {
    case 'click':
      return on('action.click');
    case 'type':
      return on('action.type', { text: String(input.text) });
    case 'select_option':
      return on('action.select', { value: String(input.value) });
    case 'scroll_to':
      return on('action.scrollTo');
    case 'switch_tab':
      return tab('action.switchTab');
    case 'read_tab':
      return tab('action.readTab');
  }
  throw new Error(name);
}

afterEach(() => setLanguage('en'));

const button = { name: 'Add to cart', tag: 'button' };

test('kinds come from the role first, then the tag and input type', () => {
  assert.equal(targetKind({ tag: 'button' }), 'button');
  assert.equal(targetKind({ tag: 'div', role: 'button' }), 'button');
  assert.equal(targetKind({ tag: 'a' }), 'link');
  assert.equal(targetKind({ tag: 'a', role: 'button' }), 'button');
  assert.equal(targetKind({ tag: 'input', type: 'email' }), 'field');
  assert.equal(targetKind({ tag: 'input', type: 'password' }), 'field');
  assert.equal(targetKind({ tag: 'input', type: 'submit' }), 'button');
  assert.equal(targetKind({ tag: 'input', type: 'checkbox' }), 'checkbox');
  assert.equal(targetKind({ tag: 'input', type: 'radio' }), 'option');
  assert.equal(targetKind({ tag: 'input', type: 'file' }), 'file');
  assert.equal(targetKind({ tag: 'input', role: 'combobox' }), 'field');
  assert.equal(targetKind({ tag: 'div', role: 'combobox' }), 'list');
  assert.equal(targetKind({ tag: 'select' }), 'list');
  assert.equal(targetKind({ tag: 'textarea' }), 'field');
  assert.equal(targetKind({ tag: 'div', editable: true }), 'field');
  assert.equal(targetKind({ tag: 'img' }), 'image');
  assert.equal(targetKind({ tag: 'div', role: 'switch' }), 'switch');
  assert.equal(targetKind({ tag: 'div' }), 'element');
  assert.equal(targetKind(null), 'element');
});

test('names are shortened at a word, and machine words are never shown', () => {
  assert.equal(shownName('  Add\n to   cart '), 'Add to cart');
  const long = shownName('Free delivery on all orders over fifty pounds placed before noon today');
  assert.ok(long.endsWith('…') && Array.from(long).length <= 40, long);
  assert.ok(!long.includes(' …'), long);
  assert.equal(shownName('ref 12'), '');
  assert.equal(shownName('ref=3'), '');
  assert.equal(shownName('#submit-btn'), '');
  assert.equal(shownName('div.nav > a'), '');
  assert.equal(shownName('→'), '');
  assert.equal(shownName('Say "hi"'), 'Say hi');
});

test('English: name and kind together, the kind alone without a name', () => {
  assert.equal(targetPhrase(button, 'on', 'en'), 'the “Add to cart” button');
  assert.equal(targetPhrase({ tag: 'input', type: 'text' }, 'into', 'en'), 'a text field');
  assert.equal(targetPhrase({ tag: 'img' }, 'on', 'en'), 'an image');
  assert.equal(targetPhrase({ tag: 'div', name: 'Daily deals' }, 'on', 'en'), '“Daily deals”');
  assert.equal(targetPhrase(null, 'on', 'en'), 'an element on the page');
});

test('Turkish puts the case on the kind noun, never on the quoted name', () => {
  assert.equal(targetPhrase({ name: 'Sepete ekle', tag: 'button' }, 'on', 'tr'), '“Sepete ekle” düğmesine');
  assert.equal(targetPhrase({ tag: 'button' }, 'on', 'tr'), 'bir düğmeye');
  assert.equal(targetPhrase({ name: 'Ülke', tag: 'select' }, 'in', 'tr'), '“Ülke” listesinden');
  assert.equal(targetPhrase({ tag: 'input', type: 'radio' }, 'in', 'tr'), 'bir seçenekten');
  assert.equal(targetPhrase({ name: 'E-posta', tag: 'input', type: 'email' }, 'into', 'tr'), '“E-posta” alanına');
});

test('German and Russian take the case of the preposition', () => {
  assert.equal(targetPhrase(button, 'on', 'de'), 'die Schaltfläche „Add to cart“');
  assert.equal(targetPhrase({ name: 'Land', tag: 'select' }, 'in', 'de'), 'der Liste „Land“');
  assert.equal(targetPhrase({ tag: 'a' }, 'on', 'de'), 'einen Link');
  assert.equal(targetPhrase({ tag: 'a' }, 'to', 'de'), 'einem Link');
  assert.equal(targetPhrase(button, 'on', 'ru'), 'кнопку «Add to cart»');
  assert.equal(targetPhrase({ tag: 'select' }, 'in', 'ru'), 'списке');
  assert.equal(targetPhrase({ tag: 'input' }, 'to', 'ru'), 'текстовому полю');
});

test('every language has every kind in every slot, with or without a name', () => {
  const kinds = [
    { tag: 'button' }, { tag: 'a' }, { tag: 'input' }, { tag: 'input', type: 'checkbox' }, { tag: 'input', type: 'radio' },
    { role: 'switch' }, { tag: 'select' }, { tag: 'img' }, { tag: 'input', type: 'file' }, { tag: 'div' },
  ];
  for (const code of LANGUAGES) {
    for (const facts of kinds) {
      for (const slot of ['on', 'into', 'in', 'to', 'alone'] as const) {
        const plain = targetPhrase(facts, slot, code);
        const named = targetPhrase({ ...facts, name: 'Zed' }, slot, code);
        assert.ok(plain && !plain.includes('{'), `${code} ${slot} ${JSON.stringify(facts)}: ${plain}`);
        assert.ok(named.includes('Zed') && !named.includes('{'), `${code} ${slot}: ${named}`);
      }
    }
  }
});

test('Turkish lines that start with the element begin with a capital (dotted İ too)', () => {
  assert.equal(capitalizeFirst('bir düğmeye dokunuluyor', 'tr'), 'Bir düğmeye dokunuluyor');
  assert.equal(capitalizeFirst('istek', 'tr'), 'İstek');
  assert.equal(capitalizeFirst('“Sepete ekle” düğmesine dokunuluyor', 'tr'), '“Sepete ekle” düğmesine dokunuluyor');
});

/** A page whose script answers targetInfo with `facts`. */
const browserWith = (facts: unknown, tabs: Record<string, { title: string; url: string }> = {}) =>
  ({
    getTab: (id: string) =>
      id === 'agent'
        ? { run: async (command: string) => (command === 'targetInfo' ? facts : null) }
        : tabs[id] ?? undefined,
  }) as never;

test('the step line names the element and never shows the ref; the model input is unchanged', async () => {
  for (const code of LANGUAGES) {
    setLanguage(code);
    const input = { ref: 7 };
    await prepareStepTarget('click', input, browserWith({ name: 'Sepete ekle', tag: 'button' }), 'agent');
    const line = describeToolCall('click', input);
    assert.ok(line.includes('Sepete ekle'), `${code}: ${line}`);
    assert.ok(!/\bref\b|7/i.test(line), `${code}: ${line}`);
    assert.deepEqual(input, { ref: 7 });
  }
  setLanguage('tr');
  const input = { ref: 1 };
  await prepareStepTarget('click', input, browserWith({ name: 'Sepete ekle', tag: 'button' }), 'agent');
  assert.equal(describeToolCall('click', input), '“Sepete ekle” düğmesine dokunuluyor');
  const field = { ref: 2, text: 'merhaba' };
  await prepareStepTarget('type', field, browserWith({ tag: 'input', type: 'text' }), 'agent');
  assert.equal(describeToolCall('type', field), 'Bir metin alanına yazılıyor: "merhaba"');
  const list = { ref: 3, value: 'Türkiye' };
  await prepareStepTarget('select_option', list, browserWith({ name: 'Ülke', tag: 'select' }), 'agent');
  assert.equal(describeToolCall('select_option', list), '“Ülke” listesinden seçiliyor: Türkiye');
  setLanguage('en');
  const plain = { ref: 4 };
  await prepareStepTarget('click', plain, browserWith({ tag: 'a' }), 'agent');
  assert.equal(describeToolCall('click', plain), 'Tapping a link');
});

test('a page that does not answer still gives a readable line', async () => {
  const input = { ref: 9 };
  await prepareStepTarget('click', input, { getTab: () => ({ run: () => Promise.reject(new Error('timeout')) }) } as never, 'agent');
  assert.equal(describeToolCall('click', input), 'Tapping an element on the page');
  assert.equal(describeToolCall('scroll_to', { ref: 3 }), 'Scrolling to an element on the page');
  setLanguage('tr');
  assert.equal(describeToolCall('click', { ref: 3 }), 'Sayfadaki bir öğeye dokunuluyor');
});

test('tab steps name the tab by its title, not its id', async () => {
  const browser = browserWith(null, { '5': { title: 'Hava durumu', url: 'https://www.example.com/x' } });
  const input = { tab_id: '5' };
  await prepareStepTarget('switch_tab', input, browser, 'agent');
  assert.equal(describeToolCall('switch_tab', input), 'Switching to tab “Hava durumu”');
  setLanguage('tr');
  assert.equal(describeToolCall('switch_tab', input), '“Hava durumu” sekmesine geçiliyor');
  assert.equal(describeToolCall('read_tab', { tab_id: '99' }), 'Başka bir sekme okunuyor');
});
