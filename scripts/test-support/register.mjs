// The one module loader for every server-free test suite and the measuring scripts under scripts/ (README.md in
// this folder). It lets Node run the app's TypeScript as Metro would:
// - relative imports without an extension resolve to `.ts`, a folder's `index.ts`, or `.tsx`;
// - native modules (every bare specifier of React Native, Expo, Skia and friends; `react` stays real) and the app's
//   .tsx files become inert stand-ins exporting the names the importing file asks for; Platform.OS follows
//   QUTAI_TEST_OS (default ios), expo-localization's language follows QUTAI_TEST_LANG (default en);
// - names an app file imports without `import type` that the other file exports only as types are marked `type`;
// - src/i18n gets the `require` Metro gives it for the per-language dictionaries.
// Options: `stubs`, app files (by path suffix) a harness replaces with its own stand-ins (scripts/injection-tests);
// `natives`, native modules (by exact name) replaced with a harness's own source (scripts/voice-tests).
import { createRequire, register } from 'node:module';

export function registerTestLoader(options = {}) {
  const i18nRequire = createRequire(new URL('../../src/i18n/index.ts', import.meta.url));
  globalThis.require ??= (path) => i18nRequire(/\.[cm]?[jt]s$/.test(path) ? path : `${path}.ts`);
  register(new URL('./hooks.mjs', import.meta.url), { data: { stubs: options.stubs ?? {}, natives: options.natives ?? {} } });
}
