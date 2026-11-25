// Imported first by the entry file (index.ts), before App and everything it imports: the language chosen in Qutai's
// settings (Android before 13) applies before any module reads a string.
import { stripDevice } from '../device/macDevice';
import { startInstallCheck } from '../storage/installCheck';
import { initAppLanguage } from './appLanguage';
import { deviceKindOf } from './deviceWords';
import { setDeviceKind } from './index';

// iOS: on the first launch after a reinstall, clear the Keychain items the earlier installation left, before any
// module opens the database or reads secure storage (storage/installCheck.ts).
startInstallCheck();
initAppLanguage();
// "this phone" / "this iPad" / "this Mac" (src/i18n/deviceWords.ts), before any module reads a string.
setDeviceKind(deviceKindOf(stripDevice));
