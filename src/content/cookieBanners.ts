/** Consent banners of common consent platforms (and generic cookie-banner containers). */
export const COOKIE_BANNER_SELECTORS = [
  '#onetrust-banner-sdk',
  '#onetrust-consent-sdk',
  '.onetrust-pc-dark-filter',
  '#CybotCookiebotDialog',
  '#CybotCookiebotDialogBodyUnderlay',
  '#qc-cmp2-container',
  '.qc-cmp2-container',
  '#didomi-host',
  '.didomi-popup-backdrop',
  '#usercentrics-root',
  '#truste-consent-track',
  '#consent_blackbar',
  '.truste_overlay',
  '.cc-window',
  '#cookie-law-info-bar',
  '#cookie-notice',
  '#iubenda-cs-banner',
  '.fc-consent-root',
  '#cmpbox',
  '#cmpbox2',
  '.cmpboxBG',
  '[id^="sp_message_container_"]',
  '.cky-consent-container',
  '.cky-overlay',
  '#BorlabsCookieBox',
  '#cookiescript_injected',
  '.osano-cm-window',
  '#moove_gdpr_cookie_info_bar',
  '[id*="cookie-banner"]',
  '[class*="cookie-banner"]',
  '[id*="cookie-consent"]',
  '[class*="cookie-consent"]',
];

/**
 * Hides consent banners. Many of them also lock scrolling; when a banner was hidden, scrolling
 * is unlocked again. Pages keep working with their defaults (usually only necessary cookies,
 * or whatever the site decides when nothing is chosen).
 */
export function cookieBannerScript(selectors: string[] = COOKIE_BANNER_SELECTORS): string {
  const list = selectors.join(',');
  return `(function () {
  if (window.__kutaiCookies) return;
  window.__kutaiCookies = true;
  var SELECTOR = ${JSON.stringify(list)};
  var timer = null;
  function check() {
    timer = null;
    try {
      if (document.querySelector(SELECTOR)) {
        document.documentElement.classList.add('kutai-cmp-hidden');
        if (document.body) document.body.classList.remove('didomi-popup-open', 'sp-message-open');
      }
    } catch (e) {}
  }
  function start() {
    var style = document.createElement('style');
    style.textContent = SELECTOR + '{display:none!important;visibility:hidden!important}' +
      'html.kutai-cmp-hidden,html.kutai-cmp-hidden body{overflow:auto!important;position:static!important}';
    (document.head || document.documentElement).appendChild(style);
    check();
    new MutationObserver(function () { if (!timer) timer = setTimeout(check, 300); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }
  // At document start the root element may not exist yet.
  if (document.documentElement) start();
  else new MutationObserver(function (_, observer) {
    if (!document.documentElement) return;
    observer.disconnect();
    start();
  }).observe(document, { childList: true });
})(); true;`;
}
