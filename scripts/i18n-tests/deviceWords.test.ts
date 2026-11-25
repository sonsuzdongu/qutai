// Device-aware wording (src/i18n/deviceWords.ts): a phrase marked {@this phone} reads exactly as before on a phone and
// is replaced by its iPad or Mac form from src/i18n/device/<code>.ts. Every marked phrase has both forms, no table
// entry is left over, and no "phone" is left in an iPad or Mac string of English.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEVICE_WORDS } from '../../src/i18n/device/index.ts';
import { DEVICE_PHRASE, deviceKindOf, deviceNameEn, fillDeviceWords, phoneForm } from '../../src/i18n/deviceWords.ts';
import { deviceName, interfaceLanguageNote } from '../../src/agent/uiLabels.ts';
import { agentProfileJson } from '../../src/credits/profile.ts';
import { en } from '../../src/i18n/en.ts';
import { LANGUAGES, type Language } from '../../src/i18n/languages.ts';
import { provideDictionary, setDeviceKind, setLanguage, t, tIn } from '../../src/i18n/index.ts';

async function load(language: Language): Promise<Record<string, string>> {
  if (language === 'en') return en;
  const mod = await import(`../../src/i18n/${language}.ts`);
  return mod[language.replace('-', '')];
}

test('a phone keeps the text, braces removed; iPad and Mac get their forms', () => {
  const words = { 'this phone': { tablet: 'this iPad', mac: 'this Mac' }, 'the phone#other': { tablet: 'the device', mac: 'the device' } };
  const text = 'Saved on {@this phone}. Use {@the phone#other} for {name}.';
  assert.equal(fillDeviceWords(text, words, 'phone'), 'Saved on this phone. Use the phone for {name}.');
  assert.equal(fillDeviceWords(text, words, 'tablet'), 'Saved on this iPad. Use the device for {name}.');
  assert.equal(fillDeviceWords(text, words, 'mac'), 'Saved on this Mac. Use the device for {name}.');
  // A phrase missing from the table falls back to the phone text rather than showing braces.
  assert.equal(fillDeviceWords('On {@that phone}', words, 'mac'), 'On that phone');
  assert.equal(phoneForm('Ihr Telefon#acc'), 'Ihr Telefon');
});

test('the device kind: Mac, iPad, and everything else a phone (Android included)', () => {
  assert.equal(deviceKindOf('mac'), 'mac');
  assert.equal(deviceKindOf('tablet'), 'tablet');
  assert.equal(deviceKindOf('android'), 'phone');
  assert.equal(deviceKindOf('phone'), 'phone');
});

test('t() and tIn() fill device phrases for the device set at startup', async () => {
  const tr = await load('tr');
  provideDictionary('tr', tr);
  try {
    setDeviceKind('mac');
    assert.equal(tIn('en', 'memory.hint').includes('this Mac'), true);
    assert.equal(tIn('tr', 'settings.phoneDataSection'), 'Mac’inizdeki veriler');
    setLanguage('en');
    setDeviceKind('tablet');
    assert.match(t('backup.replaceConfirmTitle'), /this iPad's data/);
    setDeviceKind('phone');
    assert.equal(t('backup.replaceConfirmTitle'), "Replace this phone's data?");
  } finally {
    setDeviceKind('phone');
  }
});

for (const language of LANGUAGES) {
  test(`${language}: every device phrase has iPad and Mac forms, and every table entry is used`, async () => {
    const dict = await load(language);
    const table = DEVICE_WORDS[language];
    const used = new Set<string>();
    const missing: string[] = [];
    for (const [key, value] of Object.entries(dict)) {
      for (const m of value.matchAll(DEVICE_PHRASE)) {
        used.add(m[1]);
        const entry = table[m[1]];
        if (!entry?.tablet?.trim() || !entry?.mac?.trim()) missing.push(`${key}: {@${m[1]}}`);
      }
      assert.ok(!/\{@[^}]*$|\{@\s*\}/.test(value), `${key}: broken device phrase`);
    }
    assert.deepEqual(missing, [], `no iPad/Mac form in src/i18n/device/${language}.ts:\n${missing.join('\n')}`);
    const unused = Object.keys(table).filter((phrase) => !used.has(phrase));
    assert.deepEqual(unused, [], `unused in src/i18n/device/${language}.ts: ${unused.join(' | ')}`);
  });
}

// Words that mean the telephone itself, or text shown only on Android (always a phone), keep "phone" on every device.
const PHONE_MEANS_TELEPHONE = new Set([
  'suggest.callPrompt', 'settings.memoryHint', 'memory.empty', 'profile.offerLead', 'profile.phone', 'profile.phoneHint',
  'profile.fact.phone', 'site.personalHint.ask', 'personal.kind.phone', 'call.failed', 'sms.failed',
  'settings.backgroundPlaybackBattery', 'profile.locationPrivacy',
]);

test('en: on an iPad or a Mac, no text says "phone" unless it means the telephone or is Android-only', () => {
  for (const device of ['tablet', 'mac'] as const) {
    const left = Object.entries(en)
      .filter(([key]) => !PHONE_MEANS_TELEPHONE.has(key) && !/Android/.test(key))
      .map(([key, value]) => [key, fillDeviceWords(value, DEVICE_WORDS.en, device)] as const)
      .filter(([, value]) => /\bphones?\b|phone’s|phone's/.test(value.replace(/Android System WebView/g, '')))
      .map(([key]) => key);
    assert.deepEqual(left, [], `${device}: still says phone: ${left.join(', ')}`);
  }
});

test('the assistant is told the device, and tool results name it', () => {
  assert.equal(deviceNameEn('phone'), 'phone');
  assert.equal(deviceNameEn('tablet', true), 'an iPad');
  assert.equal(deviceNameEn('mac', true), 'a Mac');
  try {
    setDeviceKind('mac');
    assert.equal(deviceName(), 'Mac');
    assert.match(interfaceLanguageNote(), /The user's device: a Mac\.$/);
    setDeviceKind('tablet');
    assert.match(interfaceLanguageNote(), /The user's device: an iPad\.$/);
  } finally {
    setDeviceKind('phone');
  }
  assert.match(interfaceLanguageNote(), /The user's device: a phone\.$/);
});

test('the agent profile is the same on every device and never calls the device a phone', () => {
  const profile = agentProfileJson();
  setDeviceKind('mac');
  try {
    assert.equal(agentProfileJson(), profile, 'the profile must not depend on the device (one registered profile)');
  } finally {
    setDeviceKind('phone');
  }
  // "phone" may appear only as the telephone (numbers, the phone app, account settings) or in the device rule itself.
  const device = /\b(this|the|their|your) phone\b|phone's|phone’s|on the phone\b/i;
  assert.equal(device.test(profile), false, profile.match(device)?.[0]);
});
