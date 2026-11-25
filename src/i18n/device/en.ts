import type { DeviceWords } from '../deviceWords';

/** The iPad and Mac forms of the device phrases in src/i18n/en.ts (see src/i18n/deviceWords.ts). */
export const enDevice: DeviceWords = {
  'this phone': { tablet: 'this iPad', mac: 'this Mac' },
  'This phone': { tablet: 'This iPad', mac: 'This Mac' },
  "this phone's": { tablet: "this iPad's", mac: "this Mac's" },
  'this phone’s': { tablet: 'this iPad’s', mac: 'this Mac’s' },
  'This phone’s': { tablet: 'This iPad’s', mac: 'This Mac’s' },
  'this iPhone': { tablet: 'this iPad', mac: 'this Mac' },
  'the phone': { tablet: 'the iPad', mac: 'the Mac' },
  'The phone': { tablet: 'The iPad', mac: 'The Mac' },
  'the phone#other': { tablet: 'the device', mac: 'the device' },
  "the phone's": { tablet: "the iPad's", mac: "the Mac's" },
  'the phone’s': { tablet: 'the iPad’s', mac: 'the Mac’s' },
  'the phone itself': { tablet: 'the iPad itself', mac: 'the Mac itself' },
  'your phone': { tablet: 'your iPad', mac: 'your Mac' },
  'Your phone': { tablet: 'Your iPad', mac: 'Your Mac' },
  "your phone's": { tablet: "your iPad's", mac: "your Mac's" },
  "Your phone's": { tablet: "Your iPad's", mac: "Your Mac's" },
  'your phone’s': { tablet: 'your iPad’s', mac: 'your Mac’s' },
  'Your phone’s': { tablet: 'Your iPad’s', mac: 'Your Mac’s' },
  'phone settings': { tablet: 'iPad settings', mac: 'Mac settings' },
  'that phone': { tablet: 'that device', mac: 'that device' },
  'another phone': { tablet: 'another device', mac: 'another device' },
  'any phone': { tablet: 'any device', mac: 'any device' },
  'a new phone': { tablet: 'a new device', mac: 'a new device' },
  'Every phone': { tablet: 'Every device', mac: 'Every device' },
  'an English phone': { tablet: 'an iPad set to English', mac: 'a Mac set to English' },
  // On a Mac the online speech service is on from the start (src/device/voiceOnlineDefault.ts), so the promise to ask first
  // doesn't hold there.
  'Qutai asks before that is used': {
    tablet: 'Qutai asks before that is used',
    mac: 'on a Mac that is always the case, and it is on unless you turn it off in Settings › Assistant › Voice input',
  },
  'Before Apple’s speech service is ever used, Qutai asks you separately.': {
    tablet: 'Before Apple’s speech service is ever used, Qutai asks you separately.',
    mac: 'On a Mac, Apple’s online speech service turns your speech into text; you can turn it off in Settings › Assistant › Voice input.',
  },
};
