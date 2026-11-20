// Lets Node run the assistant's real loop for the prompt-injection measurement (README.md in this folder): runAgent,
// executeTool, the Browser and Tab classes and every guard they call, unchanged. Like ../navigation-tests/loader.mjs:
// relative imports without an extension resolve to `.ts` or a folder's `index.ts`; native modules (every bare
// specifier of React Native, Expo, Skia and friends) and the app's .tsx files become inert stand-ins exporting the
// names the importing file asks for; react is the real package. A few app modules that only talk to native code are
// replaced by small stand-ins (./stubs.mjs), so the harness can feed them fixtures:
// - src/pdf/reader.ts and src/pdf/fetchPdf.ts: PDF text comes from globalThis.__qutaiPdfs (url or attachment id);
// - src/device/attachments.ts: an attachment's original file is a stand-in whose bytes are never read.
// Language: English unless QUTAI_TEST_LANG says otherwise.
import { createRequire, register } from 'node:module';

const i18nRequire = createRequire(new URL('../../src/i18n/index.ts', import.meta.url));
globalThis.require ??= (path) => i18nRequire(/\.[cm]?[jt]s$/.test(path) ? path : `${path}.ts`);

register(new URL('./hooks.mjs', import.meta.url));
