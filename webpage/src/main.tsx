import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { I18nProvider } from './lib/i18n';
import { startMotion } from './lib/motion';
import './styles.css';

// The page was prerendered in one language: load only that language's strings, then hydrate.
const lang = document.documentElement.lang === 'tr' ? 'tr' : 'en';
const messages = lang === 'tr' ? (await import('./i18n/tr')).tr : (await import('./i18n/en')).en;
const root = document.getElementById('root');

const app = (
  <StrictMode>
    <I18nProvider lang={lang} messages={messages}>
      <App />
    </I18nProvider>
  </StrictMode>
);
// `npm run dev` serves the template without prerendered markup; the built pages always hydrate.
if (root?.firstElementChild) hydrateRoot(root, app);
else if (root) createRoot(root).render(app);
startMotion();
