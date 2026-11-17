// Which language the user writes in (src/chat/messageLanguage.ts), for voice input's "Automatic" listening language:
// it knew only Turkish and English; it now knows the app's ten interface languages.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectWritingLanguage, DETECTABLE, messageLanguage } from '../../src/chat/messageLanguage.ts';
import { LANGUAGES } from '../../src/i18n/languages.ts';

const SAMPLES: Record<string, string[]> = {
  tr: ['Bu sayfadaki en ucuz fiyatı bulur musun?', 'Google’da şunu ara lütfen', 'yarın için bir hatırlatma kur'],
  en: ['Can you find the cheapest price on this page?', "Please summarize what it's about", 'open my bookmarks'],
  de: ['Kannst du bitte den günstigsten Preis auf dieser Seite finden?', 'Fasse die Seite für mich zusammen', 'Was ist das hier?'],
  es: ['¿Puedes buscar el precio más barato en esta página?', 'Resume esta página, por favor', 'quiero ver mis marcadores'],
  pt: ['Você pode procurar o preço mais barato nesta página?', 'Resuma isso para mim, por favor', 'não quero isso agora'],
  fr: ['Peux-tu trouver le prix le moins cher sur cette page ?', 'Résume cette page pour moi, merci', 'Je veux ouvrir mes favoris'],
  id: ['Tolong cari harga yang paling murah di halaman ini', 'Ringkas halaman ini untuk saya', 'apa itu?'],
  ru: ['Найди самую низкую цену на этой странице', 'Перескажи кратко, пожалуйста'],
  ja: ['このページで一番安い値段を探してください', 'ブックマークを開いて'],
  ko: ['이 페이지에서 가장 싼 가격을 찾아 주세요', '요약해 줘'],
};

test('detection covers every interface language', () => {
  for (const language of LANGUAGES) assert.ok(DETECTABLE.includes(language.split('-')[0]), language);
});

for (const [language, messages] of Object.entries(SAMPLES)) {
  test(`messages in ${language} are recognised`, () => {
    for (const message of messages) assert.equal(messageLanguage(message), language, message);
  });
}

test('names, links and short replies say nothing; the latest clear message decides', () => {
  assert.equal(messageLanguage('ok'), null);
  assert.equal(messageLanguage('https://example.com/seite'), null);
  assert.equal(messageLanguage('iPhone 17 Pro'), null);
  assert.equal(detectWritingLanguage(['Bu sayfayı özetle', 'Kannst du das bitte übersetzen?', 'ok']), 'de');
});

test('Chinese characters alone are not taken for Japanese', () => {
  assert.equal(messageLanguage('这个页面最便宜的价格'), null);
});
