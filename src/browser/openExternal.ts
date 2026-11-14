import { Linking } from 'react-native';
import { dialog } from '../components/Dialog';
import { t } from '../i18n';
import { declineExternal } from './externalGuard';
import { describeExternalUrl, parseIntentUrl } from './navigation';
import type { Tab } from './Tab';

/**
 * Opens a link meant for another app (tel:, mailto:, whatsapp:, intent://) after asking the
 * user, like Safari does, so pages can't throw them into other apps on their own. Callers check
 * mayOfferExternal first; declining here means the tab won't ask about this link again.
 */
export function openExternal(url: string, tab: Tab, onNoApp: (message: string) => void) {
  const { appUrl, fallbackUrl } = parseIntentUrl(url);
  dialog.alert(t('external.title'), describeExternalUrl(url), [
    { text: t('common.cancel'), style: 'cancel', onPress: () => declineExternal(tab, url) },
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
