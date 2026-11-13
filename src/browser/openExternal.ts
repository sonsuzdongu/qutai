import { Alert, Linking } from 'react-native';
import { t } from '../i18n';
import { describeExternalUrl, parseIntentUrl } from './navigation';
import type { Tab } from './Tab';

/**
 * Opens a link meant for another app (tel:, mailto:, whatsapp:, intent://) after asking the
 * user, like Safari does, so pages can't throw them into other apps on their own.
 */
export function openExternal(url: string, tab: Tab, onNoApp: (message: string) => void) {
  const { appUrl, fallbackUrl } = parseIntentUrl(url);
  Alert.alert(t('external.title'), describeExternalUrl(url), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('external.open'),
      onPress: () => {
        // openURL is called directly: canOpenURL returns false for schemes the app hasn't
        // declared (iOS) or can't see (Android 11+), which would silently drop working links.
        Linking.openURL(appUrl ?? url).catch(() => {
          if (fallbackUrl) tab.loadUrl(fallbackUrl);
          else onNoApp(t('external.noApp'));
        });
      },
    },
  ]);
}
