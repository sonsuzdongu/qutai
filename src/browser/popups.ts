/**
 * Windows a page opens (window.open, target=_blank links) as real pop-ups that keep their opener (TABS-xx in
 * docs/design): the patched WebView holds the page's new-window request under an id (onOpenWindow's popupId) until
 * the new tab's WebView takes it (its popupId prop), so the page in it has window.opener, can post its result back and
 * close itself. That is what sign-in with Google, Apple, Facebook, Microsoft or GitHub on a website, PayPal and 3-D
 * Secure windows need. The engine itself honours noopener (no window.opener then).
 */

/** The address a pop-up tab starts with when the WebView doesn't say yet (Android, a window.open). */
export const POPUP_BLANK_URL = 'about:blank';

export type PopupOpen =
  | { kind: 'refuse'; release: string | null }
  | { kind: 'open'; url: string; popupId: string | undefined };

/**
 * What to do with a page's new window. An ad or tracker address (when blocking applies) is refused, and a waiting
 * request is let go so it never opens. Otherwise a tab opens: with the request's id when there is one, at its address
 * (or about:blank until the WebView says where it goes).
 */
export function planPopupOpen(
  targetUrl: string | undefined,
  popupId: string | undefined,
  refused: (url: string) => boolean,
): PopupOpen {
  const url = targetUrl ?? '';
  const id = popupId ? popupId : undefined;
  if (url && refused(url)) return { kind: 'refuse', release: id ?? null };
  return { kind: 'open', url: url || POPUP_BLANK_URL, popupId: id };
}

/**
 * Whether a page's window.close() closes its tab: only a tab a page opened (it has an opener). The engines report it
 * only for windows a script may close; a tab the user opened from the address bar never closes itself.
 */
export function closesOnWindowClose(tab: { openerId: string | undefined }): boolean {
  return tab.openerId !== undefined;
}

/**
 * Android only knows where a window.open goes once its own WebView starts loading: an ad address refused there, as
 * the pop-up's first page, closes the pop-up tab (nothing else would ever show in it).
 */
export function closesRefusedPopup(tab: { popupId: string | undefined; popupLoaded: boolean }, isTopFrame: boolean): boolean {
  return tab.popupId !== undefined && !tab.popupLoaded && isTopFrame;
}

/**
 * The opener of the pop-up on screen stays awake: a sleeping tab loses its page, and with it the window the pop-up
 * posts its result to (a sign-in would end on a blank page).
 */
export function popupOpenerToKeep(active: { popupId: string | undefined; openerId: string | undefined } | undefined): string | undefined {
  return active?.popupId !== undefined ? active.openerId : undefined;
}
