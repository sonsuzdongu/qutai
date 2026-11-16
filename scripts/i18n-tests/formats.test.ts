// The ten-language layer (src/i18n/index.ts, languages.ts, format.ts): region variants, plural blocks, the English
// fallback, and numbers, percentages, dollars and lists written the way each language writes them.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { detectLanguage, format, provideDictionary, setLanguage, t } from '../../src/i18n/index.ts';
import { LANGUAGE_INFO, matchLanguage } from '../../src/i18n/languages.ts';
import { firstDayOfWeek, formatList, formatPercent, formatUsdAmount, numberSeparators } from '../../src/i18n/format.ts';
import { separators } from '../../src/credits/format.ts';

afterEach(() => setLanguage('en'));

test('region variants map to the language Qutai has', () => {
  assert.equal(matchLanguage('es-MX'), 'es');
  assert.equal(matchLanguage('pt-PT'), 'pt-BR');
  assert.equal(matchLanguage('pt_BR'), 'pt-BR');
  assert.equal(matchLanguage('fr-CA'), 'fr');
  assert.equal(matchLanguage('in-ID'), 'id');
  assert.equal(matchLanguage('it-IT'), null);
  assert.equal(detectLanguage([{ languageTag: 'it-IT' }, { languageTag: 'de-AT' }]), 'de');
  assert.equal(detectLanguage([{ languageTag: 'nl-NL' }]), 'en');
});

test('Russian plural blocks pick one, few and many', () => {
  const tpl = '{count} {count|one:вкладка|few:вкладки|many:вкладок|other:вкладки}';
  const say = (count: number) => format(tpl, { count }, 'ru');
  assert.equal(say(1), '1 вкладка');
  assert.equal(say(3), '3 вкладки');
  assert.equal(say(5), '5 вкладок');
  assert.equal(say(11), '11 вкладок');
  assert.equal(say(21), '21 вкладка');
  assert.equal(say(22), '22 вкладки');
  assert.equal(say(112), '112 вкладок');
  // A number already formatted for the language still selects the form.
  assert.equal(format(tpl, { count: '1 021' }, 'ru'), '1 021 вкладка');
});

test('French and Brazilian Portuguese count 0 as singular; Japanese has one form', () => {
  assert.equal(format('{n} {n|one:onglet|other:onglets}', { n: 0 }, 'fr'), '0 onglet');
  assert.equal(format('{n} {n|one:onglet|other:onglets}', { n: 2 }, 'fr'), '2 onglets');
  assert.equal(format('{n} {n|one:guia|other:guias}', { n: 0 }, 'pt-BR'), '0 guia');
  assert.equal(LANGUAGE_INFO.ja.plural(1), 'other');
});

test('a key missing from a language falls back to English', () => {
  provideDictionary('de', { 'common.cancel': 'Abbrechen' });
  setLanguage('de');
  assert.equal(t('common.cancel'), 'Abbrechen');
  assert.equal(t('common.save'), 'Save');
});

test('percentages, separators, dollars, lists and week start follow the language', () => {
  const cases = [
    ['en', '120%', '.', '$0.01', 'a, b', 1],
    ['tr', '%120', ',', '$0,01', 'a, b', 2],
    ['de', '120 %', ',', '0,01 $', 'a, b', 2],
    ['fr', '120 %', ',', '0,01 $US', 'a, b', 2],
    ['pt-BR', '120%', ',', 'US$ 0,01', 'a, b', 1],
    ['ja', '120%', '.', '$0.01', 'a、b', 1],
    ['ru', '120 %', ',', '0,01 $', 'a, b', 2],
    ['id', '120%', ',', 'US$0,01', 'a, b', 1],
  ] as const;
  for (const [language, percent, decimal, usd, list, firstDay] of cases) {
    setLanguage(language);
    assert.equal(formatPercent(120), percent, language);
    assert.equal(numberSeparators().decimal, decimal, language);
    assert.equal(separators(language).decimal, decimal, language);
    assert.equal(formatUsdAmount(`0${decimal}01`), usd, language);
    assert.equal(formatList(['a', 'b']), list, language);
    assert.equal(firstDayOfWeek(), firstDay, language);
  }
});
