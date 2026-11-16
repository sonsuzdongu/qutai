// Lets Node run the app's TypeScript for the Qutai Credits tests (see README.md in this folder): relative imports
// without an extension resolve to `.ts` or a folder's `index.ts` (as in ../account-tests/resolve-ts.mjs), and the two native modules the
// request code touches are replaced by small stand-ins, so the real adapters (src/ai/anthropic.ts, openai.ts,
// gemini.ts) can run outside the app:
// - react-native: Platform.OS (https checks) and AppState (the foreground tracker), always "active";
// - expo-localization: the language, English unless QUTAI_TEST_LANG says otherwise; the calendar's time zone, UTC.
// It also gives src/i18n/index.ts a `require` for its per-language dictionaries (below).
import { createRequire, register } from 'node:module';

// src/i18n/index.ts loads each language's dictionary with Metro's lazy `require('./de')`. Node's ES modules have no
// `require`, so the same lazy loading gets one here that resolves those dictionary files.
const i18nRequire = createRequire(new URL('../../src/i18n/index.ts', import.meta.url));
globalThis.require ??= (path) => i18nRequire(/\.[cm]?[jt]s$/.test(path) ? path : `${path}.ts`);

const stubs = {
  'react-native': `
    export const Platform = { OS: 'ios' };
    export const AppState = { currentState: 'active', addEventListener() { return { remove() {} }; } };
  `,
  'expo-localization': `
    const code = (globalThis.process?.env?.QUTAI_TEST_LANG) || 'en';
    export function getLocales() { return [{ languageCode: code }]; }
    export function useLocales() { return getLocales(); }
    export function getCalendars() { return [{ timeZone: 'UTC' }]; }
  `,
};

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      const stubs = ${JSON.stringify(stubs)};
      export async function resolve(specifier, context, next) {
        if (specifier in stubs) {
          return { url: 'data:text/javascript,' + encodeURIComponent(stubs[specifier]), shortCircuit: true };
        }
        try {
          return await next(specifier, context);
        } catch (error) {
          if (!specifier.startsWith('.') || /\\.[cm]?[jt]s$/.test(specifier)) throw error;
          try {
            return await next(specifier + '.ts', context);
          } catch {
            return next(specifier + '/index.ts', context);
          }
        }
      }
    `),
);
