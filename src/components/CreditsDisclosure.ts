import { setCreditsConsent } from '../credits';
import { t } from '../i18n';
import { dialog } from './Dialog';

/**
 * Before Qutai Credits is used for the first time on this phone: what changes about where data goes, with an explicit
 * choice. With an own key, requests go from the phone straight to the AI provider; with credits they pass through
 * Qutai's server on the way (not stored, not logged: backend/DESIGN.md). Declining leaves everything as it was.
 * Resolves true when the user agreed (and remembers it).
 */
export async function askCreditsDisclosure(): Promise<boolean> {
  const result = await dialog.show({
    title: t('credits.disclosure.title'),
    lines: {
      spaced: true,
      lines: [
        { icon: 'globe', text: t('credits.disclosure.route') },
        { icon: 'secure', text: t('credits.disclosure.notKept') },
        { icon: 'wallet', text: t('credits.disclosure.paid') },
        { icon: 'settings', text: t('credits.disclosure.ownKey') },
      ],
    },
    buttons: [
      { text: t('credits.disclosure.decline'), style: 'cancel' },
      { text: t('credits.disclosure.accept'), primary: true },
    ],
  });
  const accepted = result.button === 1;
  if (accepted) await setCreditsConsent(true);
  return accepted;
}
