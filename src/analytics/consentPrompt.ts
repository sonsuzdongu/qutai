import { dialog } from '../components/Dialog';
import { t } from '../i18n';
import { analyticsConsent, analyticsOffered, setAnalyticsConsent } from './index';

let asked = false;

/**
 * The one-time question (pro builds; `SRV-31`): asked once setup and the legal texts are done, only while the server
 * collects, never in incognito. Allow and Don't allow have equal weight and nothing is chosen in advance; closing the
 * dialog without an answer asks again on a later start (nothing is sent until Allow).
 */
export async function askAnalyticsConsentOnce(isIncognito: () => boolean): Promise<void> {
  if (asked) return;
  asked = true;
  if ((await analyticsConsent()) !== 'ask' || !(await analyticsOffered()) || isIncognito()) {
    if (isIncognito()) asked = false;
    return;
  }
  const result = await dialog.show({
    title: t('analytics.consentTitle'),
    message: t('analytics.consentMessage'),
    lines: {
      spaced: true,
      lines: [
        { icon: 'check', text: t('analytics.collected') },
        { icon: 'close', text: t('analytics.notCollected') },
      ],
    },
    buttons: [{ text: t('analytics.deny') }, { text: t('analytics.allow') }],
    equalButtons: true,
  });
  if (result.button === 1) await setAnalyticsConsent(true);
  else if (result.button === 0) await setAnalyticsConsent(false);
}
