import type { DeviceWords } from '../deviceWords';
import type { Language } from '../languages';
import { deDevice } from './de';
import { enDevice } from './en';
import { esDevice } from './es';
import { frDevice } from './fr';
import { idDevice } from './id';
import { jaDevice } from './ja';
import { koDevice } from './ko';
import { ptBRDevice } from './pt-BR';
import { ruDevice } from './ru';
import { trDevice } from './tr';

/** Each language's device phrases (src/i18n/deviceWords.ts). Small, so all are loaded with the app. */
export const DEVICE_WORDS: Record<Language, DeviceWords> = {
  en: enDevice,
  tr: trDevice,
  de: deDevice,
  es: esDevice,
  'pt-BR': ptBRDevice,
  fr: frDevice,
  ja: jaDevice,
  ko: koDevice,
  ru: ruDevice,
  id: idDevice,
};
