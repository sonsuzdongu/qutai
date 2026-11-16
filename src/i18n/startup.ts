// Imported first by the entry file (index.ts), before App and everything it imports: the language chosen in Qutai's
// settings (Android before 13) applies before any module reads a string.
import { startInstallCheck } from '../storage/installCheck';
import { initAppLanguage } from './appLanguage';

// iOS: on the first launch after a reinstall, clear the Keychain items the earlier installation left, before any
// module opens the database or reads secure storage (storage/installCheck.ts).
startInstallCheck();
initAppLanguage();
