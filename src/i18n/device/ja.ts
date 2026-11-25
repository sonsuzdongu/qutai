import type { DeviceWords } from '../deviceWords';

/** The iPad and Mac forms of the device phrases in src/i18n/ja.ts (see src/i18n/deviceWords.ts). */
export const jaDevice: DeviceWords = {
  'このスマートフォン': { tablet: 'このiPad', mac: 'このMac' },
  'この電話': { tablet: 'このiPad', mac: 'このMac' },
  'この iPhone': { tablet: 'この iPad', mac: 'この Mac' },
  'スマートフォン': { tablet: 'iPad', mac: 'Mac' },
  '電話': { tablet: 'iPad', mac: 'Mac' },
  'スマートフォン#other': { tablet: 'デバイス', mac: 'デバイス' },
  'そのスマートフォン': { tablet: 'そのデバイス', mac: 'そのデバイス' },
  'すべてのスマートフォン': { tablet: 'すべてのデバイス', mac: 'すべてのデバイス' },
  'どのスマートフォン': { tablet: 'どのデバイス', mac: 'どのデバイス' },
  'どの電話': { tablet: 'どのデバイス', mac: 'どのデバイス' },
  '別のスマートフォン': { tablet: '別のデバイス', mac: '別のデバイス' },
  '別の電話': { tablet: '別のデバイス', mac: '別のデバイス' },
  '新しい電話': { tablet: '新しいデバイス', mac: '新しいデバイス' },
  '英語のスマートフォン': { tablet: '英語に設定したiPad', mac: '英語に設定したMac' },
  // On a Mac the online speech service is on from the start (src/device/voiceOnlineDefault.ts), so the promise to ask
  // first doesn't hold there.
  'その前に Qutai が確認します。': {
    tablet: 'その前に Qutai が確認します。',
    mac: 'Mac では常にこのサービスが使われ、「設定 › アシスタント › 音声入力」でオフにしない限りオンです。',
  },
  'Apple の音声サービスを使う前には、Qutai が別途確認します。': {
    tablet: 'Apple の音声サービスを使う前には、Qutai が別途確認します。',
    mac: 'Mac では、Apple のオンライン音声サービスが音声を文字に変換します。「設定 › アシスタント › 音声入力」でオフにできます。',
  },
};
