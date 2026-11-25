import type { DeviceWords } from '../deviceWords';

/** The iPad and Mac forms of the device phrases in src/i18n/id.ts (see src/i18n/deviceWords.ts). */
export const idDevice: DeviceWords = {
  'ponsel': { tablet: 'iPad', mac: 'Mac' },
  'Ponsel': { tablet: 'iPad', mac: 'Mac' },
  'ponsel ini': { tablet: 'iPad ini', mac: 'Mac ini' },
  'Ponsel ini': { tablet: 'iPad ini', mac: 'Mac ini' },
  'iPhone ini': { tablet: 'iPad ini', mac: 'Mac ini' },
  'ponsel Anda': { tablet: 'iPad Anda', mac: 'Mac Anda' },
  'ponsel sendiri': { tablet: 'iPad sendiri', mac: 'Mac sendiri' },
  'ponsel itu sendiri': { tablet: 'iPad itu sendiri', mac: 'Mac itu sendiri' },
  'ponsel berbahasa Inggris': { tablet: 'iPad berbahasa Inggris', mac: 'Mac berbahasa Inggris' },
  'ponsel#other': { tablet: 'perangkat', mac: 'perangkat' },
  'ponsel itu': { tablet: 'perangkat itu', mac: 'perangkat itu' },
  'ponsel lain': { tablet: 'perangkat lain', mac: 'perangkat lain' },
  'ponsel mana pun': { tablet: 'perangkat mana pun', mac: 'perangkat mana pun' },
  'ponsel baru': { tablet: 'perangkat baru', mac: 'perangkat baru' },
  'Setiap ponsel': { tablet: 'Setiap perangkat', mac: 'Setiap perangkat' },
  // On a Mac the online speech service is on from the start (src/device/voiceOnlineDefault.ts), so the promise to ask
  // first doesn't hold there.
  'Qutai bertanya sebelum layanan itu digunakan': {
    tablet: 'Qutai bertanya sebelum layanan itu digunakan',
    mac: 'di Mac selalu demikian, dan layanan itu aktif kecuali Anda menonaktifkannya di Setelan › Asisten › Input suara',
  },
  'Sebelum layanan ucapan Apple digunakan, Qutai menanyakannya kepada Anda secara terpisah.': {
    tablet: 'Sebelum layanan ucapan Apple digunakan, Qutai menanyakannya kepada Anda secara terpisah.',
    mac: 'Di Mac, layanan ucapan online Apple mengubah ucapan Anda menjadi teks; Anda dapat menonaktifkannya di Setelan › Asisten › Input suara.',
  },
};
