import { Linking } from 'react-native';
import { dialog } from '../components/Dialog';
import { t } from '../i18n';

/**
 * A permission the user denied. canAskAgain is false once the system will no longer show its
 * prompt (iOS after the first refusal, Android after "Don't allow" twice): only Settings helps then.
 */
export class PermissionDeniedError extends Error {
  constructor(
    message: string,
    readonly canAskAgain: boolean,
  ) {
    super(message);
  }
}

/** Opens Qutai's own page in the phone's system settings (permissions, notifications…). */
export async function openSystemSettings(): Promise<void> {
  await Linking.openSettings();
}

/** Opens the system settings, or explains where to go when the system refuses to open them. */
export function openSettingsOrExplain() {
  openSystemSettings().catch(() => dialog.alert(t('settings.openFailedTitle'), t('settings.openFailed')));
}

/** Shows why something failed, with an "Open settings" button since the permission prompt won't come back. */
export function offerSettings(message: string) {
  dialog.alert(t('settings.permissionTitle'), message, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('settings.openSystem'), onPress: openSettingsOrExplain },
  ]);
}
