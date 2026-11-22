// The privacy policy and terms in all ten interface languages (src/legal/): English and Turkish are originals, the
// other eight are translated from English (src/legal/translations/). Every language has the same documents with the
// same sections in the same order, the same bullets and line breaks, the same names, addresses and numbers in each
// section, no empty text and no English left in; each translation says the English version prevails; no language
// falls back to English any more; and each platform's texts name only its own store and services (Apple 2.3.10).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  DOCUMENTS,
  legalDocumentFor,
  provideLegalTranslation,
  textForPlatform,
  type LegalBuild,
  type LegalDocument,
  type LegalKind,
  type LegalPlatform,
  type LegalTranslation,
  type TranslatedLegalLanguage,
} from '../../src/legal/documents.ts';
import { PRO_DOCUMENTS } from '../../src/legal/proDocuments.ts';
import { LANGUAGES, type Language } from '../../src/i18n/languages.ts';
import { de } from '../../src/legal/translations/de.ts';
import { es } from '../../src/legal/translations/es.ts';
import { ptBR } from '../../src/legal/translations/pt-BR.ts';
import { fr } from '../../src/legal/translations/fr.ts';
import { ja } from '../../src/legal/translations/ja.ts';
import { ko } from '../../src/legal/translations/ko.ts';
import { ru } from '../../src/legal/translations/ru.ts';
import { id } from '../../src/legal/translations/id.ts';

const TRANSLATIONS: Record<TranslatedLegalLanguage, LegalTranslation> = { de, es, 'pt-BR': ptBR, fr, ja, ko, ru, id };
for (const [language, translation] of Object.entries(TRANSLATIONS)) {
  provideLegalTranslation(language as TranslatedLegalLanguage, translation);
}

const BUILDS: LegalBuild[] = ['openSource', 'pro'];
const PLATFORMS: LegalPlatform[] = ['ios', 'android'];
const KINDS: LegalKind[] = ['privacy', 'terms'];

/** The word for "English" each translation's prevail sentence uses. */
const ENGLISH_WORD: Record<TranslatedLegalLanguage, RegExp> = {
  de: /englisch/i,
  es: /inglés/i,
  'pt-BR': /inglês/i,
  fr: /anglais/i,
  ja: /英語/,
  ko: /영어|영문/,
  ru: /английск/i,
  id: /Inggris/,
};

/** Names, addresses and terms that stay as written in every language. Turkish has its own "Qutai Kredileri". */
const KEPT = [
  'Qutai Credits',
  'Osman Yuksel',
  'qutai@sonsuzdongu.com',
  'Anthropic',
  'OpenAI',
  'OpenRouter',
  'Google Play',
  'Google',
  'Apple',
  'iPhone',
  'Android',
  'Cloudflare',
  'Mailjet',
  'RevenueCat',
  'EasyList',
  'AdGuard',
  'App Store',
  'HTTPS',
  'IBAN',
  'API',
];

function kept(text: string, language: Language): string[] {
  const names = KEPT.filter((name) => text.includes(name) && !(language === 'tr' && name === 'Qutai Credits'));
  const numbers = text.match(/\d+/g) ?? [];
  return [...names, ...numbers];
}

const count = (text: string, char: string) => text.split(char).length - 1;

/** The parts of a document in order: title, intro, then each section's heading and body. */
function parts(doc: LegalDocument): { where: string; text: string }[] {
  return [
    { where: 'title', text: doc.title },
    { where: 'intro', text: doc.intro },
    ...doc.sections.flatMap((s, i) => [
      { where: `section ${i + 1} heading`, text: s.heading },
      { where: `section ${i + 1} body`, text: s.body },
    ]),
  ];
}

/** English sentences long enough to be prose (not a lone name), as the interface's left-in-English check looks for. */
function englishSentences(doc: LegalDocument): string[] {
  return parts(doc)
    .flatMap((p) => p.text.split(/(?<=[.!?:;])\s+|\n/))
    .map((s) => s.replace(/^•\s*/, '').trim())
    .filter((s) => s.length >= 25 && /[a-z]{3,}\s+[a-z]{3,}/.test(s));
}

test('every language has its own documents; none falls back to English', () => {
  const source = readFileSync(new URL('../../src/legal/documents.ts', import.meta.url), 'utf8');
  for (const language of Object.keys(TRANSLATIONS)) {
    assert.match(source, new RegExp(`require\\('\\./translations/${language}'\\)`), `${language} is loaded in the app`);
  }
  assert.doesNotMatch(source, /englishOnly/);
  for (const build of BUILDS) {
    for (const kind of KINDS) {
      const english = legalDocumentFor(build, kind, 'en');
      for (const language of LANGUAGES) {
        if (language === 'en') continue;
        const doc = legalDocumentFor(build, kind, language);
        assert.notEqual(doc.title, english.title, `${build} ${kind} in ${language} is not the English document`);
      }
    }
  }
});

test('same sections in the same order, bullets, line breaks, names and numbers in every language', () => {
  for (const platform of PLATFORMS) for (const build of BUILDS) {
    for (const kind of KINDS) {
      const english = legalDocumentFor(build, kind, 'en', platform);
      const englishParts = parts(english);
      for (const language of LANGUAGES) {
        if (language === 'en') continue;
        const doc = legalDocumentFor(build, kind, language, platform);
        const label = `${build} ${kind} (${language}, ${platform})`;
        assert.equal(doc.sections.length, english.sections.length, `${label}: number of sections`);
        parts(doc).forEach((part, i) => {
          const source = englishParts[i];
          assert.ok(part.text.trim().length > 0, `${label} ${part.where} is empty`);
          assert.equal(count(part.text, '•'), count(source.text, '•'), `${label} ${part.where}: bullets`);
          assert.equal(count(part.text, '\n'), count(source.text, '\n'), `${label} ${part.where}: line breaks`);
          const missing = kept(source.text, language).filter((name) => !part.text.includes(name));
          assert.deepEqual(missing, [], `${label} ${part.where}: kept as in English`);
        });
      }
    }
  }
});

test('no English left in a translation, and each says the English version prevails', () => {
  for (const platform of PLATFORMS) for (const build of BUILDS) {
    for (const kind of KINDS) {
      const english = legalDocumentFor(build, kind, 'en', platform);
      const sentences = englishSentences(english);
      for (const language of Object.keys(TRANSLATIONS) as TranslatedLegalLanguage[]) {
        const doc = legalDocumentFor(build, kind, language, platform);
        const label = `${build} ${kind} (${language}, ${platform})`;
        const text = parts(doc).map((p) => p.text).join('\n');
        const left = sentences.filter((s) => text.includes(s));
        assert.deepEqual(left, [], `${label}: English sentences left in`);
        parts(doc).forEach((part, i) => {
          // A heading that is only a brand ("Qutai Credits") stays as it is.
          if (i > 1 && !KEPT.includes(part.text)) assert.notEqual(part.text, parts(english)[i].text, `${label} ${part.where} is still English`);
        });
        const last = doc.sections[doc.sections.length - 1].body;
        assert.match(last, ENGLISH_WORD[language], `${label}: the last section says the English version prevails`);
      }
    }
  }
});

test('Turkish is an original: it does not say a translation prevails', () => {
  for (const build of BUILDS) {
    for (const kind of KINDS) {
      const last = legalDocumentFor(build, kind, 'tr').sections.at(-1)!.body;
      assert.doesNotMatch(last, /İngilizce/);
    }
  }
});

/** What a platform's texts must not name: the other platform and its store (Apple's guideline 2.3.10 for iOS). */
const OTHER_PLATFORM: Record<LegalPlatform, RegExp> = {
  ios: /Google Play|Play Store|Android|APK/,
  android: /App Store|iPhone|iPad|\biOS\b/,
};

test('each platform names only its own store and services, in every language and build', () => {
  for (const platform of PLATFORMS) {
    for (const build of BUILDS) {
      for (const kind of KINDS) {
        for (const language of LANGUAGES) {
          const doc = legalDocumentFor(build, kind, language, platform);
          for (const part of parts(doc)) {
            const label = `${build} ${kind} (${language}, ${platform}) ${part.where}`;
            assert.doesNotMatch(part.text, /\{\{|\}\}|\|android:|\|web:/, `${label}: platform wording left unresolved`);
            assert.doesNotMatch(part.text, OTHER_PLATFORM[platform], `${label}: names the other platform`);
          }
        }
      }
    }
  }
});

test('the platforms differ where the stores are named, and Sign in with Apple and Google stay on both', () => {
  const ios = parts(legalDocumentFor('pro', 'privacy', 'en', 'ios')).map((p) => p.text).join('\n');
  const android = parts(legalDocumentFor('pro', 'privacy', 'en', 'android')).map((p) => p.text).join('\n');
  assert.match(ios, /bought through the App Store; your payment details stay with Apple and/);
  assert.match(android, /bought through Google Play; your payment details stay with Google and/);
  for (const text of [ios, android]) assert.match(text, /You sign in with Apple, with Google or with your email address/);
  assert.match(ios, /Anthropic, OpenAI and Google \(the AI\)/);
  const iosTerms = parts(legalDocumentFor('openSource', 'terms', 'tr', 'ios')).map((p) => p.text).join('\n');
  assert.match(iosTerms, /Qutai hiçbir şeyi kendisi yüklemez\. İndirilen dosyalar/);
});

test('platform wording is well formed; English and Turkish carry the website’s branch', () => {
  const marks = (text: string) => text.match(/\{\{[^]*?\}\}/g) ?? [];
  const wellFormed = /^\{\{ios:[^{}|]*\|android:[^{}|]*(\|web:[^{}|]*)?\}\}$/;
  const written: { where: string; text: string; web: boolean }[] = [];
  for (const [name, set] of [['documents', DOCUMENTS], ['proDocuments', PRO_DOCUMENTS]] as const) {
    for (const language of ['en', 'tr'] as const) {
      for (const kind of KINDS) for (const p of parts(set[language][kind])) written.push({ where: `${name} ${language} ${kind} ${p.where}`, text: p.text, web: true });
    }
  }
  for (const [language, translation] of Object.entries(TRANSLATIONS)) {
    for (const build of BUILDS) for (const kind of KINDS) {
      for (const p of parts(translation[build][kind])) written.push({ where: `${language} ${build} ${kind} ${p.where}`, text: p.text, web: false });
    }
  }
  let count = 0;
  for (const { where, text, web } of written) {
    for (const mark of marks(text)) {
      count++;
      assert.match(mark, wellFormed, `${where}: ${mark}`);
      if (web) assert.match(mark, /\|web:/, `${where}: no website wording in ${mark}`);
    }
    assert.equal(text.split('{{').length, text.split('}}').length, `${where}: unbalanced braces`);
  }
  assert.ok(count > 100, `platform parts found: ${count}`);
  assert.equal(textForPlatform('a {{ios:b|android:c|web:d}} e {{ios:|android:f}}', 'ios'), 'a b e ');
  assert.equal(textForPlatform('a {{ios:b|android:c|web:d}} e {{ios:|android:f}}', 'android'), 'a c e f');
});
