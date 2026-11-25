import type { DeviceWords } from '../deviceWords';

/**
 * The iPad and Mac forms of the device phrases in src/i18n/tr.ts (see src/i18n/deviceWords.ts). Suffixes follow how the
 * names are said: iPad ("aypet", ends in a voiced d: iPad’de, iPad’den, iPad’e, iPad’in) and Mac ("mek", ends in k:
 * Mac’te, Mac’ten, Mac’e, Mac’in), as Apple writes them in Turkish.
 */
export const trDevice: DeviceWords = {
  Telefon: { tablet: 'iPad', mac: 'Mac' },
  telefon: { tablet: 'iPad', mac: 'Mac' },
  'Bu telefon': { tablet: 'Bu iPad', mac: 'Bu Mac' },
  'bu telefon': { tablet: 'bu iPad', mac: 'bu Mac' },
  'Bu telefona': { tablet: 'Bu iPad’e', mac: 'Bu Mac’e' },
  'bu telefona': { tablet: 'bu iPad’e', mac: 'bu Mac’e' },
  telefona: { tablet: 'iPad’e', mac: 'Mac’e' },
  'Bu telefonda': { tablet: 'Bu iPad’de', mac: 'Bu Mac’te' },
  'bu telefonda': { tablet: 'bu iPad’de', mac: 'bu Mac’te' },
  Telefonda: { tablet: 'iPad’de', mac: 'Mac’te' },
  telefonda: { tablet: 'iPad’de', mac: 'Mac’te' },
  'telefonda#other': { tablet: 'cihazda', mac: 'cihazda' },
  'Bu telefondaki': { tablet: 'Bu iPad’deki', mac: 'Bu Mac’teki' },
  'bu telefondaki': { tablet: 'bu iPad’deki', mac: 'bu Mac’teki' },
  Telefondaki: { tablet: 'iPad’deki', mac: 'Mac’teki' },
  telefondaki: { tablet: 'iPad’deki', mac: 'Mac’teki' },
  'Bu telefondakilerin': { tablet: 'Bu iPad’dekilerin', mac: 'Bu Mac’tekilerin' },
  'Bu telefondakilerle': { tablet: 'Bu iPad’dekilerle', mac: 'Bu Mac’tekilerle' },
  'bu telefondakilerle': { tablet: 'bu iPad’dekilerle', mac: 'bu Mac’tekilerle' },
  'bu telefondakileri': { tablet: 'bu iPad’dekileri', mac: 'bu Mac’tekileri' },
  'Bu telefondan': { tablet: 'Bu iPad’den', mac: 'Bu Mac’ten' },
  'bu telefondan': { tablet: 'bu iPad’den', mac: 'bu Mac’ten' },
  telefondan: { tablet: 'iPad’den', mac: 'Mac’ten' },
  'Bu telefonun': { tablet: 'Bu iPad’in', mac: 'Bu Mac’in' },
  'bu telefonun': { tablet: 'bu iPad’in', mac: 'bu Mac’in' },
  Telefonun: { tablet: 'iPad’in', mac: 'Mac’in' },
  telefonun: { tablet: 'iPad’in', mac: 'Mac’in' },
  telefonunuz: { tablet: 'iPad’iniz', mac: 'Mac’iniz' },
  telefonunuza: { tablet: 'iPad’inize', mac: 'Mac’inize' },
  Telefonunuzda: { tablet: 'iPad’inizde', mac: 'Mac’inizde' },
  telefonunuzda: { tablet: 'iPad’inizde', mac: 'Mac’inizde' },
  Telefonunuzdaki: { tablet: 'iPad’inizdeki', mac: 'Mac’inizdeki' },
  telefonunuzdaki: { tablet: 'iPad’inizdeki', mac: 'Mac’inizdeki' },
  Telefonunuzun: { tablet: 'iPad’inizin', mac: 'Mac’inizin' },
  telefonunuzun: { tablet: 'iPad’inizin', mac: 'Mac’inizin' },
  'bir telefonda': { tablet: 'bir cihazda', mac: 'bir cihazda' },
  'her telefonda': { tablet: 'her cihazda', mac: 'her cihazda' },
  'tüm telefonlarda': { tablet: 'tüm cihazlarda', mac: 'tüm cihazlarda' },
  'o telefona': { tablet: 'o cihaza', mac: 'o cihaza' },
  'Bu iPhone’da': { tablet: 'Bu iPad’de', mac: 'Bu Mac’te' },
  // On a Mac the online speech service is on from the start (src/device/voiceOnlineDefault.ts), so the promise to ask first
  // doesn't hold there.
  'Qutai bundan önce size sorar': {
    tablet: 'Qutai bundan önce size sorar',
    mac: 'Mac’te her zaman bu hizmet kullanılır; Ayarlar › Asistan › Sesle yazma bölümünden kapatmadıkça açıktır',
  },
  'Apple’ın konuşma hizmeti kullanılmadan önce Qutai size ayrıca sorar.': {
    tablet: 'Apple’ın konuşma hizmeti kullanılmadan önce Qutai size ayrıca sorar.',
    mac: 'Mac’te konuşmanızı Apple’ın çevrim içi konuşma hizmeti metne çevirir; Ayarlar › Asistan › Sesle yazma bölümünden kapatabilirsiniz.',
  },
};
