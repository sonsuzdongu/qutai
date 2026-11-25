import type { DeviceWords } from '../deviceWords';

/** The iPad and Mac forms of the device phrases in src/i18n/fr.ts (see src/i18n/deviceWords.ts). */
export const frDevice: DeviceWords = {
  'ce téléphone': { tablet: 'cet iPad', mac: 'ce Mac' },
  'Ce téléphone': { tablet: 'Cet iPad', mac: 'Ce Mac' },
  'cet iPhone': { tablet: 'cet iPad', mac: 'ce Mac' },
  'le téléphone': { tablet: 'l’iPad', mac: 'le Mac' },
  'Le téléphone': { tablet: 'L’iPad', mac: 'Le Mac' },
  'le téléphone lui-même': { tablet: 'l’iPad lui-même', mac: 'le Mac lui-même' },
  'du téléphone': { tablet: 'de l’iPad', mac: 'du Mac' },
  'votre téléphone': { tablet: 'votre iPad', mac: 'votre Mac' },
  'Votre téléphone': { tablet: 'Votre iPad', mac: 'Votre Mac' },
  'le téléphone#other': { tablet: 'l’appareil', mac: 'l’appareil' },
  'ce téléphone#other': { tablet: 'cet appareil', mac: 'cet appareil' },
  'tout téléphone': { tablet: 'tout appareil', mac: 'tout appareil' },
  'un nouveau téléphone': { tablet: 'un nouvel appareil', mac: 'un nouvel appareil' },
  'Tous les téléphones': { tablet: 'Tous les appareils', mac: 'Tous les appareils' },
  'un téléphone en anglais': { tablet: 'un iPad configuré en anglais', mac: 'un Mac configuré en anglais' },
  // On a Mac the online speech service is on from the start (src/device/voiceOnlineDefault.ts), so the promise to ask
  // first doesn't hold there.
  'Qutai vous demande avant de l’utiliser': {
    tablet: 'Qutai vous demande avant de l’utiliser',
    mac: 'sur un Mac c’est toujours le cas, et il est activé sauf si vous le désactivez dans Paramètres › Assistant › Saisie vocale',
  },
  'Avant toute utilisation du service vocal d’Apple, Qutai vous le demande séparément.': {
    tablet: 'Avant toute utilisation du service vocal d’Apple, Qutai vous le demande séparément.',
    mac: 'Sur un Mac, le service vocal en ligne d’Apple transforme votre voix en texte ; vous pouvez le désactiver dans Paramètres › Assistant › Saisie vocale.',
  },
};
