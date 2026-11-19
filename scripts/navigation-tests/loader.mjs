// Lets Node run the app's real Tab and Browser classes (src/browser/) for the navigation tests, without a device.
// Relative imports without an extension resolve to `.ts` or a folder's `index.ts`; native modules and the app's .tsx
// files (Node can't read JSX) become inert stand-ins exporting the names the app imports: functions that do nothing
// and return another stand-in. react-native's Platform.OS is QUTAI_TEST_OS (default ios); react is the real package.
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';

const NATIVE = [
  'react-native',
  'expo',
  'expo-localization',
  'expo-file-system',
  'expo-sharing',
  'expo-haptics',
  'expo-symbols',
  'expo-sqlite',
  'react-native-safe-area-context',
  'react-native-view-shot',
  'react-native-webview',
  '@shopify/react-native-skia',
];

// App modules that only matter for the assistant (and import types without \`import type\`, which Node can't strip).
// Page features a tab owns, as plain stand-ins (their booleans must be false, not a stand-in).
const CUSTOM = {
  '/src/browser/geolocation.ts':
    "export class PageGeolocation { nonce = 'g'; inUse = false; reset() {} handleMessage() { return false; } } export function geolocationScript() { return ''; }",
  '/src/browser/mediaCapture.ts':
    "export class PageMediaCapture { nonce = 'm'; capturing = false; camera = false; microphone = false; grant = undefined; playbackUnlocked = false; reset() {} applied() {} setShown() {} handleMessage() { return false; } } export function mediaCaptureScript() { return ''; }",
  '/src/browser/playback.ts':
    "export class PagePlayback { nonce = 'p'; audible = false; reset() {} handleMessage() { return false; } } export function playbackScript() { return ''; }",
  '/src/device/backgroundTask.ts':
    "export class NeedsForegroundError extends Error {} export function isRunningInBackground() { return false; } export async function backgroundGoBack() {} export async function backgroundPageState() { return null; } export async function evaluateInPage() { return null; } export const BackgroundPageState = undefined;",
};

const LOCAL_STUBS = [...Object.keys(CUSTOM), '/src/chat/Conversation.ts', '/src/device/attachments.ts', '/src/device/outgoing.ts', '/src/device/composedFile.ts', '/src/pdf/reader.ts', '/src/device/webviewProfile.ts'];

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { readFileSync } from 'node:fs';
      import { fileURLToPath } from 'node:url';
      const NATIVE = new Set(${JSON.stringify(NATIVE)});
      const LOCAL_STUBS = ${JSON.stringify(LOCAL_STUBS)};
      const CUSTOM = ${JSON.stringify(CUSTOM)};
      const STUB = "const handler = { get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : k === 'OS' ? (globalThis.process?.env?.QUTAI_TEST_OS || 'ios') : stub, apply: () => stub, construct: () => stub }; const stub = new Proxy(function () {}, handler);";
      function names(source) {
        const found = new Set();
        for (const m of source.matchAll(/\\bimport\\s+(?!type\\b)([\\s\\S]*?)\\s+from\\s+['"]([^'"]+)['"]/g)) {
          const brace = /\\{([\\s\\S]*)\\}/.exec(m[1]);
          if (brace) for (const part of brace[1].split(',')) { const n = part.trim().replace(/^type\\s+/, '').split(/\\s+as\\s+/)[0]; if (n && !/^type\\s/.test(part.trim())) found.add(n); }
        }
        return found;
      }
      function LOCAL_URL(url, specifier, context) {
        const custom = Object.keys(CUSTOM).find((k) => url.endsWith(k));
        if (custom) return { url: 'qutai-custom:' + custom, shortCircuit: true };
        return { url: 'qutai-stub:' + specifier + '?from=' + encodeURIComponent(context.parentURL || ''), shortCircuit: true };
      }
      export async function resolve(specifier, context, next) {
        if (NATIVE.has(specifier) || [...NATIVE].some((n) => specifier.startsWith(n + '/'))) {
          return { url: 'qutai-stub:' + specifier + '?from=' + encodeURIComponent(context.parentURL || ''), shortCircuit: true };
        }
        try {
          const r = await next(specifier, context);
          if (LOCAL_STUBS.some((l) => r.url.endsWith(l))) return LOCAL_URL(r.url, specifier, context);
          if (r.url.endsWith('.tsx')) return { url: 'qutai-tsx:' + r.url, shortCircuit: true };
          return r;
        } catch (error) {
          if (!specifier.startsWith('.') || /\\.[cm]?[jt]sx?$/.test(specifier)) throw error;
          for (const ext of ['.ts', '/index.ts', '.tsx']) {
            try {
              const r = await next(specifier + ext, context);
              if (LOCAL_STUBS.some((l) => r.url.endsWith(l))) return LOCAL_URL(r.url, specifier, context);
              if (r.url.endsWith('.tsx')) return { url: 'qutai-tsx:' + r.url, shortCircuit: true };
              return r;
            } catch {}
          }
          throw error;
        }
      }
      export async function load(url, context, next) {
        if (url.startsWith('qutai-stub:')) {
          const spec = url.slice(11, url.indexOf('?from='));
          // Every name any app file imports from this module (collected from the importing file).
          const from = decodeURIComponent(url.slice(url.indexOf('?from=') + 6));
          const wanted = new Set();
          if (from.startsWith('file:')) {
            const src = readFileSync(fileURLToPath(from), 'utf8');
            for (const m of src.matchAll(/\\bimport\\s+(?!type\\b)([\\s\\S]*?)\\s+from\\s+['"]([^'"]+)['"]/g)) {
              if (m[2] !== spec) continue;
              const brace = /\\{([\\s\\S]*)\\}/.exec(m[1]);
              if (brace) for (const part of brace[1].split(',')) { const p = part.trim(); if (!p || p.startsWith('type ')) continue; wanted.add(p.split(/\\s+as\\s+/)[0]); }
            }
          }
          const body = STUB + [...wanted].filter((n) => n !== 'default').map((n) => 'export const ' + n + ' = stub;').join('') + 'export default stub;';
          return { format: 'module', source: body, shortCircuit: true };
        }
        if (url.startsWith('qutai-custom:')) return { format: 'module', source: CUSTOM[url.slice(13)], shortCircuit: true };
        if (url.startsWith('qutai-tsx:')) {
          const src = readFileSync(fileURLToPath(url.slice(10)), 'utf8');
          const exported = new Set();
          for (const m of src.matchAll(/^export\\s+(?:async\\s+)?(?:function|const|let|class)\\s+([A-Za-z_$][\\w$]*)/gm)) exported.add(m[1]);
          const body = STUB + [...exported].map((n) => 'export const ' + n + ' = stub;').join('') + 'export default stub;';
          return { format: 'module', source: body, shortCircuit: true };
        }
        return next(url, context);
      }
    `),
);
