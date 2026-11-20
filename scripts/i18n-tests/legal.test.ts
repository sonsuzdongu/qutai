// The privacy policy and terms in all ten interface languages (src/legal/): English and Turkish are originals, the
// other eight are translated from English (src/legal/translations/). Every language has the same documents with the
// same sections in the same order, the same bullets and line breaks, the same names, addresses and numbers in each
// section, no empty text and no English left in; each translation says the English version prevails; and no
// language falls back to English any more.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  legalDocumentFor,
  provideLegalTranslation,
  type LegalBuild,
  type LegalDocument,
  type LegalKind,
  type LegalTranslation,
  type TranslatedLegalLanguage,
} from '../../src/legal/documents.ts';
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
  'osmanyuksel@gmail.com',
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
  for (const build of BUILDS) {
    for (const kind of KINDS) {
      const english = legalDocumentFor(build, kind, 'en');
      const englishParts = parts(english);
      for (const language of LANGUAGES) {
        if (language === 'en') continue;
        const doc = legalDocumentFor(build, kind, language);
        const label = `${build} ${kind} (${language})`;
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
  for (const build of BUILDS) {
    for (const kind of KINDS) {
      const english = legalDocumentFor(build, kind, 'en');
      const sentences = englishSentences(english);
      for (const language of Object.keys(TRANSLATIONS) as TranslatedLegalLanguage[]) {
        const doc = legalDocumentFor(build, kind, language);
        const label = `${build} ${kind} (${language})`;
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
