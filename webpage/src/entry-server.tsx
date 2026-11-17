import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { App } from './App';
import { CHECKED } from './data/comparison';
import { en } from './i18n/en';
import { tr } from './i18n/tr';
import { I18nProvider, formatDate } from './lib/i18n';
import { SITE_URL } from './lib/site';

export const messages = { en, tr };
export { CHECKED, SITE_URL, formatDate };

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
