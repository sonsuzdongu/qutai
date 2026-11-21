import { Platform } from 'react-native';
import { accountSession } from '../account';
import { createApi } from '../account/api';
import { accountsEnabled, features } from '../config/features';
import { appVersion } from '../device/appVersion';
import { getLocale } from '../i18n';
import { reportBody, type Report } from './body';

export { REPORT_CONTENT_MAX, REPORT_NOTE_MAX, REPORT_REASONS, cut, type Report, type ReportKind, type ReportReason } from './body';

/**
 * Reporting an assistant answer or an app made in Qutai (design record SAFE-1 to SAFE-6): Google Play's AI-generated
 * content policy and Apple's guidelines 1.2 and 4.7 ask for a way to report offensive content without leaving the
 * app. The report goes to Qutai's server (`POST /reports`, backend README › Reports), so it exists only in builds
 * with a server (pro mode); signed in, it carries the account, signed out it doesn't.
 *
 * What is sent: the kind, the reason, the user's note (only for "Other"), the reported text only when the user
 * ticked "Include the text", whether the answer came from Qutai Credits or the user's own key, the app version, the
 * platform and the interface language. Nothing else from the conversation or the page.
 */

/** Whether this build can send reports (it has Qutai's server). */
export const reportsAvailable = accountsEnabled && !!features.apiUrl;

/** Sends the report; resolves when the server stored it, rejects with an AccountApiError otherwise. */
export async function sendReport(report: Report): Promise<void> {
  if (!reportsAvailable || !features.apiUrl) throw new Error('Reports need Qutai’s server');
  const session = accountSession();
  let accessToken: string | undefined;
  if (session?.getState().status === 'signedIn') {
    try {
      accessToken = await session.currentAccessToken();
    } catch {
      // Signed out meanwhile, or the session can't be renewed: the report goes without the account.
      accessToken = undefined;
    }
  }
  const body = reportBody(report, { version: appVersion().version, platform: Platform.OS, language: getLocale() });
  await createApi(features.apiUrl).request({ method: 'POST', path: '/reports', body, accessToken });
}
