import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { App } from './App';
import { FeaturesPage } from './components/FeaturesPage';
import { FEATURES_CHECKED, GROUPS, PAGE as FEATURES_PAGE } from './data/features';
import { CHECKED } from './data/comparison';
import { en } from './i18n/en';
import { tr } from './i18n/tr';
import { I18nProvider, formatDate } from './lib/i18n';
import { CONTACT_EMAIL, SITE_URL } from './lib/site';

export const messages = { en, tr };
export { CHECKED, CONTACT_EMAIL, SITE_URL, formatDate, FEATURES_CHECKED, FEATURES_PAGE, GROUPS };

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
