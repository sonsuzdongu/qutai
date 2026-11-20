/**
 * "Send the form again?" (`TABS-25` in docs/design/14-tabs-and-conversations.md). iOS: the app sees the resubmission
 * as a navigation (navigationType "formresubmit") and refuses or repeats it. Android: the WebView asks through
 * onFormResubmission (patched react-native-webview) and waits for the app's answer in the formResubmissionAnswer prop;
 * this file makes and reads that answer. Pure, tested in scripts/navigation-tests/formResubmission.test.ts.
 */

/** Set before any question: tells the Android WebView that the app asks the user (instead of the platform default). */
export const FORM_ANSWER_IDLE = '0 none';

/** The native side's limit: unanswered for this long, the form is not sent again (RNCWebView.java). */
export const FORM_ANSWER_TIMEOUT_MS = 30000;

/** The prop value answering question `id`. */
export function formAnswer(id: number, resend: boolean): string {
  return `${Math.trunc(id)} ${resend ? 'resend' : 'keep'}`;
}

/**
 * How the native side reads the prop (mirror of RNCWebView.setFormResubmissionAnswer): the answer counts only for the
 * question still open; anything else is ignored, which leaves the 30 s "don't send again" fallback.
 */
export function readFormAnswer(value: string | null | undefined, openId: number): 'resend' | 'keep' | null {
  if (value == null) return null;
  const parts = value.trim().split(' ');
  if (parts.length !== 2 || !/^-?\d+$/.test(parts[0])) return null;
  if (Number(parts[0]) !== openId) return null;
  return parts[1] === 'resend' ? 'resend' : 'keep';
}
