import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickVoice, speechLanguage, textLanguage, type VoiceInfo } from '../../src/chat/speechLanguage';

const TURKISH =
  'Siparişi onaylamadım ve ödeme yapmadım. Bütçeniz kesinse sepetten çıkarıp 1000 TL altındaki ürünlere bakabilirim. Bu ikisinde de 42 numarayı kontrol etmem gerekir.';
const ENGLISH = 'I did not confirm the order and nothing was paid. If your budget is fixed, I can look at the cheaper ones for you.';

test('the text decides, whatever the app or phone language is', () => {
  assert.equal(speechLanguage(TURKISH), 'tr-TR');
  assert.equal(speechLanguage(ENGLISH), 'en-US');
});

test('each of the ten languages gets a voice code', () => {
  const samples: [string, string][] = [
    [TURKISH, 'tr-TR'],
    [ENGLISH, 'en-US'],
    ['Das ist nicht das, was ich für die Straße gesucht habe, aber es ist auch schön.', 'de-DE'],
    ['No sé si el pedido está en la cesta, pero los zapatos no son los que quería.', 'es-ES'],
    ['Não sei se você já viu isso, mas as lojas não estão abertas hoje.', 'pt-BR'],
    ["Je n'ai pas confirmé la commande et vous n'avez rien payé pour les chaussures.", 'fr-FR'],
    ['Saya tidak mengonfirmasi pesanan dan belum ada yang dibayar untuk sepatu itu.', 'id-ID'],
    ['Я не подтвердил заказ, и ничего не было оплачено.', 'ru-RU'],
    ['注文は確定していません。お支払いもまだです。', 'ja-JP'],
    ['주문을 확정하지 않았고 결제도 하지 않았습니다.', 'ko-KR'],
  ];
  for (const [text, code] of samples) assert.equal(speechLanguage(text), code, text);
});

test('a wrong hint loses to a clear text (the assistant named en-US for a Turkish answer, a Turkish page says "en")', () => {
  assert.equal(speechLanguage(TURKISH, 'en-US'), 'tr-TR');
  assert.equal(speechLanguage(TURKISH, 'en'), 'tr-TR');
  assert.equal(speechLanguage(ENGLISH, 'tr'), 'en-US');
});

test('a hint in the same language keeps its region', () => {
  assert.equal(speechLanguage(ENGLISH, 'en-GB'), 'en-GB');
  assert.equal(speechLanguage(TURKISH, 'tr'), 'tr');
  assert.equal(speechLanguage('Não sei se você já viu isso, mas as lojas não estão abertas hoje.', 'pt_PT'), 'pt-PT');
});

test('an unclear text falls back to the hint, then to the phone default', () => {
  assert.equal(speechLanguage('OK 42', 'tr-TR'), 'tr-TR');
  assert.equal(speechLanguage('iPhone 16 Pro Max — 1.034,91 TL'), undefined);
  assert.equal(speechLanguage('OK 42'), undefined);
  assert.equal(speechLanguage(''), undefined);
});

test('unusable hints are ignored', () => {
  for (const hint of ['', '  ', 'und', 'Turkish language', null, undefined]) assert.equal(speechLanguage('OK 42', hint), undefined);
});

test('a mostly Turkish answer with English names, a quoted English sentence and an English paragraph is Turkish', () => {
  const answer = [
    'En uygun seçenekler',
    'iPhone 16 Pro Max için en düşük fiyat 1.034,91 TL, Hepsiburada’da. Apple Store’da biraz daha pahalı ama teslimat daha hızlı.',
    'Hepsiburada: ürün sayfası. Trendyol: aynı model, kargo ücretsiz.',
    '"The best phone of the year," says The Verge.',
    'The camera is great in low light and the battery lasts all day.',
    'İsterseniz sepete ekleyebilirim; ödeme yapmadan önce size soracağım.',
  ].join('\n');
  // The detector alone gives up on the whole text: both languages reach its cap.
  assert.equal(textLanguage(answer), 'tr');
  assert.equal(speechLanguage(answer, 'en-US'), 'tr-TR');
});

test('a paragraph mixed as a whole is judged sentence by sentence', () => {
  const paragraph =
    'Bu telefonun kamerası gerçekten çok iyi ve pil ömrü de uzun, ayrıca fiyatı da makul görünüyor. ' +
    'Ekranı parlak ve hızlı, oyun oynarken hiç takılmıyor. Reviewers say it is the best one this year. ' +
    'Kutusundan şarj aleti çıkmıyor, ayrıca almanız gerekir.';
  assert.equal(speechLanguage(paragraph), 'tr-TR');
});

test('an even split is unclear: the hint decides, else the phone default', () => {
  const half = `${TURKISH}\n${ENGLISH} ${ENGLISH}`;
  assert.equal(textLanguage(half), null);
  assert.equal(speechLanguage(half, 'en-GB'), 'en-GB');
  assert.equal(speechLanguage(half), undefined);
});

test('a long text is judged on its beginning, by the language most of it is written in', () => {
  const long = Array.from({ length: 60 }, () => TURKISH).join('\n\n');
  assert.equal(speechLanguage(long), 'tr-TR');
  // Only the first 6000 characters are scored: a long Turkish start decides, whatever comes much later.
  assert.equal(speechLanguage(`${long}\n${ENGLISH.repeat(200)}`), 'tr-TR');
  // A short Turkish heading over a long English article is English.
  assert.equal(speechLanguage(`Bugünkü haber özeti\n${Array.from({ length: 10 }, () => ENGLISH).join('\n')}`), 'en-US');
});

const ANDROID: VoiceInfo[] = [
  { identifier: 'en-us-x-iom-network', language: 'en-US', quality: 'Enhanced' },
  { identifier: 'en-us-x-iom-local', language: 'en-US', quality: 'Enhanced' },
  { identifier: 'en-gb-x-gba-local', language: 'en-GB', quality: 'Enhanced' },
  { identifier: 'tr-tr-x-cfs-network', language: 'tr-TR', quality: 'Enhanced' },
  { identifier: 'tr-tr-x-cfs-local', language: 'tr-TR', quality: 'Enhanced' },
  { identifier: 'pt-pt-x-sfs-local', language: 'pt-PT', quality: 'Default' },
];
const IOS: VoiceInfo[] = [
  { identifier: 'com.apple.voice.compact.en-US.Samantha', language: 'en-US', quality: 'Default' },
  { identifier: 'com.apple.voice.compact.tr-TR.Yelda', language: 'tr-TR', quality: 'Default' },
  { identifier: 'com.apple.voice.compact.pt-PT.Joana', language: 'pt-PT', quality: 'Default' },
];

test('Android gets the bare language code (expo-speech rejects "tr-TR" there and used the phone language)', () => {
  assert.deepEqual(pickVoice('tr-TR', ANDROID, 'android'), { language: 'tr' });
  assert.deepEqual(pickVoice('en-GB', ANDROID, 'android'), { language: 'en' });
  assert.deepEqual(pickVoice('tr', ANDROID, 'android'), { language: 'tr' });
});

test('iOS gets the language tag and the identifier of an installed voice', () => {
  const yelda = { language: 'tr-TR', voice: 'com.apple.voice.compact.tr-TR.Yelda', lowQuality: true };
  assert.deepEqual(pickVoice('tr-TR', IOS, 'ios'), yelda);
  assert.deepEqual(pickVoice('tr', IOS, 'ios'), yelda);
});

test('no exact region: the same language in another region', () => {
  assert.deepEqual(pickVoice('pt-BR', IOS, 'ios'), {
    language: 'pt-PT',
    voice: 'com.apple.voice.compact.pt-PT.Joana',
    lowQuality: true,
  });
  assert.deepEqual(pickVoice('pt-BR', ANDROID, 'android'), { language: 'pt', lowQuality: true });
  assert.equal(pickVoice('en-AU', [{ identifier: 'x', language: 'en_GB' }], 'ios').language, 'en-GB');
});

test('no voice for the language: the phone default reads, and the language is named for the notice', () => {
  assert.deepEqual(pickVoice('ko-KR', ANDROID, 'android'), { missing: 'ko' });
  assert.deepEqual(pickVoice('de-DE', IOS, 'ios'), { missing: 'de' });
});

test('voices not known yet (an empty list): the language is passed on, no notice', () => {
  assert.deepEqual(pickVoice('tr-TR', [], 'android'), { language: 'tr' });
  assert.deepEqual(pickVoice('tr-TR', [], 'ios'), { language: 'tr-TR' });
});

test('no language: nothing, the phone default voice', () => {
  assert.deepEqual(pickVoice(undefined, ANDROID, 'android'), {});
});

// 18 Nov 2026 (free speech improvements): the most natural installed voice reads, the same one every time, and only
// basic voices installed is said once.
const IOS_MANY: VoiceInfo[] = [
  { identifier: 'com.apple.speech.synthesis.voice.Bells', language: 'en-US', quality: 'Default' },
  { identifier: 'com.apple.eloquence.en-US.Eddy', language: 'en-US', quality: 'Default' },
  { identifier: 'com.apple.voice.compact.en-US.Samantha', language: 'en-US', quality: 'Default' },
  { identifier: 'com.apple.voice.enhanced.en-US.Evan', language: 'en-US', quality: 'Enhanced' },
  { identifier: 'com.apple.voice.premium.en-US.Zoe', language: 'en-US', quality: 'Default' },
  { identifier: 'com.apple.voice.enhanced.tr-TR.Yelda', language: 'tr-TR', quality: 'Enhanced' },
  { identifier: 'com.apple.voice.enhanced.de-DE.Anna', language: 'de-DE', quality: 'Enhanced' },
  { identifier: 'com.apple.voice.premium.de-DE.Petra', language: 'de-DE', quality: 'Default' },
];

test('iOS: Premium beats Enhanced beats compact; novelty and Eloquence voices come last', () => {
  assert.deepEqual(pickVoice('en-US', IOS_MANY, 'ios'), { language: 'en-US', voice: 'com.apple.voice.premium.en-US.Zoe' });
  assert.deepEqual(pickVoice('tr-TR', IOS_MANY, 'ios'), { language: 'tr-TR', voice: 'com.apple.voice.enhanced.tr-TR.Yelda' });
  const novelty = IOS_MANY.slice(0, 2);
  assert.equal(pickVoice('en-US', [...novelty, IOS_MANY[2]], 'ios').voice, 'com.apple.voice.compact.en-US.Samantha');
});

test('the voice chosen before stays while it is installed and as good as any (no change between sentences)', () => {
  const premiums = [
    { identifier: 'com.apple.voice.premium.en-US.Zoe', language: 'en-US', quality: 'Default' },
    { identifier: 'com.apple.voice.premium.en-US.Ava', language: 'en-US', quality: 'Default' },
  ];
  assert.equal(pickVoice('en-US', premiums, 'ios').voice, 'com.apple.voice.premium.en-US.Zoe');
  assert.equal(pickVoice('en-US', premiums, 'ios', 'com.apple.voice.premium.en-US.Ava').voice, 'com.apple.voice.premium.en-US.Ava');
  // A better voice installed since then wins; one that was removed is replaced.
  assert.equal(pickVoice('de-DE', IOS_MANY, 'ios', 'com.apple.voice.enhanced.de-DE.Anna').voice, 'com.apple.voice.premium.de-DE.Petra');
  assert.equal(pickVoice('de-DE', IOS_MANY, 'ios', 'com.apple.voice.compact.de-DE.Gone').voice, 'com.apple.voice.premium.de-DE.Petra');
});

test('only basic voices installed is flagged, so the user can be told once how to get a better one', () => {
  assert.equal(pickVoice('en-US', IOS, 'ios').lowQuality, true);
  assert.equal(pickVoice('en-US', IOS_MANY, 'ios').lowQuality, undefined);
  // Android: the engine's quality; a natural voice that needs the network still counts as natural.
  assert.equal(pickVoice('tr-TR', ANDROID, 'android').lowQuality, undefined);
  assert.equal(pickVoice('pt-PT', ANDROID, 'android').lowQuality, true);
  assert.equal(
    pickVoice('tr-TR', [{ identifier: 'tr-tr-x-cfs-network', language: 'tr-TR', quality: 'Enhanced' }], 'android').lowQuality,
    undefined,
  );
  // Android never gets a voice option (expo-speech's null voice list), only the bare language.
  assert.equal(pickVoice('tr-TR', ANDROID, 'android').voice, undefined);
});
