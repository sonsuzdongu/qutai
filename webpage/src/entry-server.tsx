import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { App } from './App';
import { FeaturesPage } from './components/FeaturesPage';
import { PricingPage } from './components/PricingPage';
import { GuidePage, VsPage, guideFaq } from './components/SeoPages';
import { FEATURES_CHECKED, GROUPS, PAGE as FEATURES_PAGE } from './data/features';
import { CHECKED, COMPETITORS } from './data/comparison';
import { GUIDE, VS } from './data/guide';
import { PACKS } from './data/pricing';
import { PAGE as PRICING_PAGE, PRICING_CHECKED } from './data/pricing';
import { en } from './i18n/en';
import { tr } from './i18n/tr';
import { I18nProvider, formatDate } from './lib/i18n';
import { CONTACT_EMAIL, PLAY_URL, REPO_URL, SITE_URL, TESTFLIGHT_URL } from './lib/site';

export const messages = { en, tr };
export { CHECKED, CONTACT_EMAIL, SITE_URL, formatDate, FEATURES_CHECKED, FEATURES_PAGE, GROUPS, PRICING_PAGE, PRICING_CHECKED, GUIDE, VS, COMPETITORS, PACKS, guideFaq, PLAY_URL, REPO_URL, TESTFLIGHT_URL };

/** The page body for one language; scripts/prerender.mjs puts it into index.html with the head tags. */
export function render(lang: 'en' | 'tr'): string {
  return renderToString(
    <StrictMode>
      <I18nProvider lang={lang} messages={messages[lang]}>
        <App />
      </I18nProvider>
    </StrictMode>,
  );
}

/** The /<lang>/features/ page body: static, no script (scripts/prerender.mjs). */
export function renderFeatures(lang: 'en' | 'tr'): string {
  return renderToString(
    <I18nProvider lang={lang} messages={messages[lang]}>
      <FeaturesPage />
    </I18nProvider>,
  );
}

/** The /<lang>/pricing/ page body: static, no script (scripts/prerender.mjs). */
export function renderPricing(lang: 'en' | 'tr'): string {
  return renderToString(
    <I18nProvider lang={lang} messages={messages[lang]}>
      <PricingPage />
    </I18nProvider>,
  );
}

/** A /<lang>/vs/<id>/ comparison page body: static, no script (scripts/prerender.mjs). */
export function renderVs(lang: 'en' | 'tr', id: string): string {
  return renderToString(
    <I18nProvider lang={lang} messages={messages[lang]}>
      <VsPage id={id} />
    </I18nProvider>,
  );
}

/** The /<lang>/agentic-browser/ guide body: static, no script (scripts/prerender.mjs). */
export function renderGuide(lang: 'en' | 'tr'): string {
  return renderToString(
    <I18nProvider lang={lang} messages={messages[lang]}>
      <GuidePage />
    </I18nProvider>,
  );
}
