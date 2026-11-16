// Imported first by the entry file (index.ts), before App and everything it imports: the language chosen in Qutai's
// settings (Android before 13) applies before any module reads a string.
import { initAppLanguage } from './appLanguage';

initAppLanguage();
