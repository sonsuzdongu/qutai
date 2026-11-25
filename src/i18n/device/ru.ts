import type { DeviceWords } from '../deviceWords';

/** The iPad and Mac forms of the device phrases in src/i18n/ru.ts (see src/i18n/deviceWords.ts). */
export const ruDevice: DeviceWords = {
  'Телефон': { tablet: 'iPad', mac: 'Mac' },
  'телефон': { tablet: 'iPad', mac: 'Mac' },
  'телефона': { tablet: 'iPad', mac: 'Mac' },
  'телефоне': { tablet: 'iPad', mac: 'Mac' },
  'Этот телефон': { tablet: 'Этот iPad', mac: 'Этот Mac' },
  'этого телефона': { tablet: 'этого iPad', mac: 'этого Mac' },
  'этом телефоне': { tablet: 'этом iPad', mac: 'этом Mac' },
  'этом iPhone': { tablet: 'этом iPad', mac: 'этом Mac' },
  'вашем телефоне': { tablet: 'вашем iPad', mac: 'вашем Mac' },
  'включая этот': { tablet: 'включая этот iPad', mac: 'включая этот Mac' },
  'телефоне#other': { tablet: 'устройстве', mac: 'устройстве' },
  'том телефоне': { tablet: 'том устройстве', mac: 'том устройстве' },
  'всех телефонах': { tablet: 'всех устройствах', mac: 'всех устройствах' },
  'другом телефоне': { tablet: 'другом устройстве', mac: 'другом устройстве' },
  'любом телефоне': { tablet: 'любом устройстве', mac: 'любом устройстве' },
  'новом телефоне': { tablet: 'новом устройстве', mac: 'новом устройстве' },
  // On a Mac the online speech service is on from the start (src/device/voiceOnlineDefault.ts), so the promise to ask
  // first doesn't hold there.
  'Qutai спросит, прежде чем её использовать': {
    tablet: 'Qutai спросит, прежде чем её использовать',
    mac: 'на Mac так всегда, и она включена, пока вы не выключите её в разделе Настройки › Ассистент › Голосовой ввод',
  },
  'Прежде чем использовать службу распознавания речи Apple, Qutai отдельно спросит вас.': {
    tablet: 'Прежде чем использовать службу распознавания речи Apple, Qutai отдельно спросит вас.',
    mac: 'На Mac речь превращает в текст онлайн-служба распознавания речи Apple; её можно выключить в разделе Настройки › Ассистент › Голосовой ввод.',
  },
};
