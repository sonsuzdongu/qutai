import type { DeviceWords } from '../deviceWords';

/** The iPad and Mac forms of the device phrases in src/i18n/de.ts (see src/i18n/deviceWords.ts). */
export const deDevice: DeviceWords = {
  'Das Telefon': { tablet: 'Das iPad', mac: 'Der Mac' },
  'das Telefon': { tablet: 'das iPad', mac: 'der Mac' },
  'das Telefon#acc': { tablet: 'das iPad', mac: 'den Mac' },
  'Dieses Telefon': { tablet: 'Dieses iPad', mac: 'Dieser Mac' },
  'diesem Telefon': { tablet: 'diesem iPad', mac: 'diesem Mac' },
  'diesem iPhone': { tablet: 'diesem iPad', mac: 'diesem Mac' },
  'dieses Telefons': { tablet: 'dieses iPads', mac: 'dieses Macs' },
  'dem Telefon': { tablet: 'dem iPad', mac: 'dem Mac' },
  'vom Telefon': { tablet: 'vom iPad', mac: 'vom Mac' },
  'des Telefons': { tablet: 'des iPads', mac: 'des Macs' },
  'Ihr Telefon': { tablet: 'Ihr iPad', mac: 'Ihr Mac' },
  'Ihr Telefon#acc': { tablet: 'Ihr iPad', mac: 'Ihren Mac' },
  'Ihrem Telefon': { tablet: 'Ihrem iPad', mac: 'Ihrem Mac' },
  'Ihres Telefons': { tablet: 'Ihres iPads', mac: 'Ihres Macs' },
  Telefoneinstellungen: { tablet: 'iPad-Einstellungen', mac: 'Mac-Einstellungen' },
  'Telefon und Server': { tablet: 'iPad und Server', mac: 'Mac und Server' },
  'sie es verlassen': { tablet: 'sie es verlassen', mac: 'sie ihn verlassen' },
  'ein englischsprachiges Telefon': { tablet: 'ein auf Englisch eingestelltes iPad', mac: 'ein auf Englisch eingestellter Mac' },
  'dem Telefon#other': { tablet: 'dem Gerät', mac: 'dem Gerät' },
  'diesem Telefon#other': { tablet: 'diesem Gerät', mac: 'diesem Gerät' },
  'einem anderen Telefon': { tablet: 'einem anderen Gerät', mac: 'einem anderen Gerät' },
  'einem neuen Telefon': { tablet: 'einem neuen Gerät', mac: 'einem neuen Gerät' },
  'jedem Telefon': { tablet: 'jedem Gerät', mac: 'jedem Gerät' },
  'angemeldete Telefon': { tablet: 'angemeldete Gerät', mac: 'angemeldete Gerät' },
  // On a Mac the online speech service is on from the start (src/device/voiceOnlineDefault.ts), so the promise to ask
  // first doesn't hold there.
  'Qutai fragt, bevor dieser verwendet wird': {
    tablet: 'Qutai fragt, bevor dieser verwendet wird',
    mac: 'auf einem Mac ist das immer so, und er ist eingeschaltet, solange Sie ihn nicht unter Einstellungen › Assistent › Spracheingabe ausschalten',
  },
  'Bevor Apples Sprachdienst je genutzt wird, fragt Qutai Sie gesondert.': {
    tablet: 'Bevor Apples Sprachdienst je genutzt wird, fragt Qutai Sie gesondert.',
    mac: 'Auf einem Mac wandelt Apples Online-Sprachdienst Ihre Sprache in Text um; Sie können ihn unter Einstellungen › Assistent › Spracheingabe ausschalten.',
  },
};
