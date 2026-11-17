import { useEffect } from 'react';
import { Linking } from 'react-native';
import { accountErrorDetails, accountErrorMessage, accountSession, emailSignIn } from '../account';
import { isAuthReturnLink } from '../account/appleWeb';
import { NoPendingEmailSignIn, isSignInLink, parseEmailSignInLink } from '../account/emailSignIn';
import { takeEmailProofLink } from '../account/methodRules';
import { t } from '../i18n';
import { providersText } from './accountLabels';
import { dialog } from './Dialog';

// The launch link belongs to the process: a remounted root must not verify it again.
let launchLinkTaken = false;

/**
 * A sign-in link (`qutai://sign-in/email?token=…` or the website page the mail links to) reached the app: finishes the
 * waiting email sign-in with it. Also called by a tab that was about to load such a link (BrowserView), so the page is
 * never loaded and its token never reaches the history. True when it was a sign-in link (taken here).
 */
export function takeSignInLink(url: string | null | undefined): boolean {
  if (!url || !isSignInLink(url)) return false;
  // The return from Apple's web sign-in (Android): the auth session that opened it reads it; nothing to do here.
  if (isAuthReturnLink(url)) return true;
  // A confirm link for an address being added (or checked) while signed in: the waiting proof takes it.
  const proofToken = parseEmailSignInLink(url);
  if (proofToken && takeEmailProofLink(proofToken)) return true;
  const flow = emailSignIn();
  if (!flow) return false;
  const token = parseEmailSignInLink(url);
  if (token) void flow.verifyLink(token);
  else flow.reportMalformedLink();
  return true;
}

/**
 * Mounted once at the app's root, above setup and the browser (pro mode only; a no-op otherwise):
 * - opens sign-in links from the mail, `qutai://sign-in/email?token=…`, at a cold start and while running, and
 *   finishes the waiting email sign-in with them. The browser's entry points ignore these links
 *   (src/device/entryPoints.ts), so the token never reaches a tab, the history or the AI. Nothing here logs it.
 * - says how a link ended when no email sign-in screen is open to say it (Settings › Account and setup's sign-in
 *   step show it themselves);
 * - after any sign-in that added its method to an existing account (`emailLink: "linked"`), says once which
 *   methods the account now has. `untrusted` and `conflict` sign in as usual, with nothing to alarm the user: the
 *   account screen lists the real methods.
 */
export function useAccountLinks() {
  useEffect(() => {
    const session = accountSession();
    const flow = emailSignIn();
    if (!session || !flow) return;

    const handle = (url: string | null | undefined) => void takeSignInLink(url);
    if (!launchLinkTaken) {
      launchLinkTaken = true;
      Linking.getInitialURL().then(handle, () => {});
    }
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));

    const offEvent = flow.onEvent((event) => {
      if (event.type === 'linkFailed') {
        if (flow.screenShown) return;
        // A second tap on a link that already signed this phone in: nothing went wrong.
        if (event.error instanceof NoPendingEmailSignIn && session.getState().status === 'signedIn') {
          dialog.alert(t('account.email.alreadySignedInTitle'), t('account.email.alreadySignedIn'));
          return;
        }
        dialog.alert(t('account.email.linkFailedTitle'), accountErrorMessage(event.error), undefined, accountErrorDetails(event.error));
        return;
      }
      // On the code screen the account (Settings) or setup's account step replaces it: that says enough.
      if (event.via === 'link' && !event.onScreen && event.response.emailLink !== 'linked') {
        dialog.alert(
          t('account.email.signedInTitle'),
          t(event.response.created ? 'account.email.createdBody' : 'account.email.signedInBody'),
        );
      }
    });

    const offSignIn = session.onSignIn((response) => {
      if (response.emailLink !== 'linked') return;
      dialog.alert(t('account.linkedTitle'), t('account.linkedBody', { providers: providersText(response.user) }));
    });

    return () => {
      sub.remove();
      offEvent();
      offSignIn();
    };
  }, []);
}
