// Every interface language (src/i18n/<code>.ts) carries exactly the keys of en.ts. TypeScript catches a missing key,
// but not an extra one (a renamed key left behind), a lost {placeholder} (which would show as "{host}" on screen), a
// broken plural block, or a string left in English by mistake. English stays the fallback at runtime.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { en } from '../../src/i18n/en.ts';
import { LANGUAGES, LANGUAGE_INFO, type Language } from '../../src/i18n/languages.ts';

// Every language in languages.ts must have its file; a missing one fails here (and English shows at runtime).
const OTHERS = LANGUAGES.filter((l): l is Exclude<Language, 'en'> => l !== 'en');
const fileOf = (language: string) => new URL(`../../src/i18n/${language}.ts`, import.meta.url);

test('every interface language has its dictionary file', () => {
  const missing = OTHERS.filter((language) => !existsSync(fileOf(language)));
  assert.deepEqual(missing, [], `no src/i18n/<code>.ts for: ${missing.join(', ')}`);
});
const exportName = (language: string) => language.replace('-', '');

async function load(language: Language): Promise<Record<string, string>> {
  const mod = await import(`../../src/i18n/${language}.ts`);
  return mod[exportName(language)];
}

/** Placeholder names, with plural blocks counted as their variable: "{count|one:…}" uses count. */
const names = (text: string) => [...new Set([...text.matchAll(/\{(\w+)(?:\|[^{}]*)?\}/g)].map((m) => m[1]))].sort().join(',');
const pluralBlocks = (text: string) => [...text.matchAll(/\{(\w+)\|([^{}]*)\}/g)].map((m) => ({ name: m[1], spec: m[2] }));
const lines = (text: string) => text.split('\n').length;
const bold = (text: string) => (text.match(/\*\*/g) ?? []).length;

/**
 * Values that may read the same as in English in every language: brand and product names, protocol words, codes.
 * Each language adds its own in scripts/i18n-tests/same-as-english/<code>.json (key list), e.g. a loanword that is the
 * normal term there ("OK", "Tabs").
 */
const BRANDS = new Set(
  'Qutai Credits Pro OpenRouter Anthropic OpenAI Google Gemini Claude ChatGPT Apple Android iOS DuckDuckGo Bing Brave Ecosia Yandex Startpage Kagi Qwant WhatsApp AdGuard EasyList uBlock Origin Face Touch ID PDF CSV QR URL API HTTP HTTPS https http OK MB KB GB'.split(' '),
);
/** Nothing to translate: placeholders, symbols, and brand or format names only. */
function nothingToTranslate(text: string): boolean {
  const words = text.replace(/\{\w+(?:\|[^{}]*)?\}/g, ' ').match(/[A-Za-z][A-Za-z-]*/g) ?? [];
  return words.every((word) => BRANDS.has(word));
}

function allowList(language: string): Set<string> {
  const path = new URL(`./same-as-english/${language}.json`, import.meta.url);
  return existsSync(path) ? new Set(JSON.parse(readFileSync(path, 'utf8'))) : new Set();
}

for (const language of OTHERS.filter((l) => existsSync(fileOf(l)))) {
  test(`${language}: same keys as en.ts, none empty`, async () => {
    const dict = await load(language);
    const missing = Object.keys(en).filter((key) => !(key in dict) || !dict[key]?.trim());
    assert.deepEqual(missing, [], `missing or empty in ${language}.ts: ${missing.join(', ')}`);
    const extra = Object.keys(dict).filter((key) => !(key in en));
    assert.deepEqual(extra, [], `only in ${language}.ts: ${extra.join(', ')}`);
  });

  test(`${language}: same placeholders, line breaks and bold markers as English`, async () => {
    const dict = await load(language);
    const differ = Object.entries(en).flatMap(([key, text]) => {
      const value = dict[key];
      if (value === undefined) return [];
      const problems: string[] = [];
      if (names(text) !== names(value)) problems.push(`placeholders en {${names(text)}} ${language} {${names(value)}}`);
      if (lines(text) !== lines(value)) problems.push(`line breaks en ${lines(text) - 1} ${language} ${lines(value) - 1}`);
      if (bold(text) !== bold(value)) problems.push('** markers differ');
      return problems.map((p) => `${key}: ${p}`);
    });
    assert.deepEqual(differ, [], differ.join('\n'));
  });

  test(`${language}: plural blocks name a number placeholder and only the language's categories`, async () => {
    const dict = await load(language);
    const plural = LANGUAGE_INFO[language].plural;
    const used = new Set([0, 1, 2, 3, 5, 11, 21, 22, 25, 101, 1.5].map(plural));
    const bad = Object.entries(dict).flatMap(([key, value]) =>
      pluralBlocks(value).flatMap(({ name, spec }) => {
        const problems: string[] = [];
        if (!names(en[key as keyof typeof en] ?? '').split(',').includes(name)) problems.push(`{${name}|…} is not an English placeholder`);
        const categories = spec.split('|').map((part) => part.split(':')[0].trim());
        for (const c of categories) if (!used.has(c as never)) problems.push(`category "${c}" never used in ${language}`);
        for (const c of used) if (c !== 'other' && !categories.includes(c)) problems.push(`no "${c}" form`);
        return problems.map((p) => `${key}: ${p}`);
      }),
    );
    assert.deepEqual(bad, [], bad.join('\n'));
  });

  test(`${language}: nothing left in English unless allowed`, async () => {
    const dict = await load(language);
    const allowed = allowList(language);
    const same = Object.entries(en).filter(
      ([key, text]) => dict[key] === text && !nothingToTranslate(text) && !allowed.has(key),
    );
    assert.deepEqual(
      same.map(([key]) => key),
      [],
      `identical to English in ${language}.ts (translate, or list the key in same-as-english/${language}.json):\n` +
        same.map(([key, text]) => `${key}: ${text}`).join('\n'),
    );
  });
}

test('the allow-lists only name keys that exist and are still identical', async () => {
  const stale: string[] = [];
  for (const language of OTHERS.filter((l) => existsSync(fileOf(l)))) {
    const dict = await load(language);
    for (const key of allowList(language)) {
      if (!(key in en) || dict[key] !== en[key as keyof typeof en]) stale.push(`${language}: ${key}`);
    }
  }
  assert.deepEqual(stale, [], `stale same-as-english entries:\n${stale.join('\n')}`);
});
