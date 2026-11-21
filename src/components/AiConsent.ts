import { aiConsent } from '../ai/consent';
import type { ConsentSubject, ConsentTarget } from '../ai/consentLogic';
import { t } from '../i18n';
import { dialog } from './Dialog';

/**
 * The own-key consent screen (AI-32), drawn like the Qutai Credits disclosure (CreditsDisclosure.ts): before the
 * first request goes to a provider the user chose with their own key, it names where the data goes and what goes
 * there, links the provider's privacy policy (none for a custom endpoint), and asks Accept / Cancel. Cancel sends
 * nothing. Registered as the consent store's only way to accept (the assistant has none).
 */
async function showConsent(subject: ConsentSubject, signal?: AbortSignal): Promise<boolean> {
  const custom = subject.provider === 'custom';
  const name = subject.name;
  const result = await dialog.show({
    title: t('aiConsent.title', { name }),
    lines: {
      spaced: true,
      lines: [
        { icon: 'globe', text: t(custom ? 'aiConsent.routeCustom' : 'aiConsent.route', { name }) },
        { icon: 'document', text: t('aiConsent.what') },
        { icon: 'location', text: t('aiConsent.confirmed') },
        { icon: 'history', text: t('aiConsent.log') },
        { icon: 'secure', text: t(custom ? 'aiConsent.policyCustom' : 'aiConsent.policy', { name }) },
      ],
    },
    ...(subject.privacyUrl ? { link: { label: t('aiConsent.policyLink', { name }), url: subject.privacyUrl } } : {}),
    buttons: [
      { text: t('aiConsent.cancel'), style: 'cancel' },
      { text: t('aiConsent.accept'), primary: true },
    ],
    signal,
  });
  return result.button === 1;
}

aiConsent.setAsker(showConsent);

/**
 * Asks now (setup, Settings, a message about to be sent) unless already accepted. True when the target may be sent
 * to. Waits for the same screen when a request is already asking for it.
 */
export function ensureAiConsent(target: ConsentTarget): Promise<boolean> {
  return aiConsent.ensure(target);
}
