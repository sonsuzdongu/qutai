// Module hooks for ./loader.mjs (see there).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STUBBED } from './stubs.mjs';
const NATIVE = /^(react-native|expo|@react-native|@react-native-masked-view|@shopify|@expo|react-native-[a-z-]+|expo-[a-z-]+)(\/|$)/;
const STUB = "const handler = { get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : k === 'OS' ? 'ios' : k === 'currentState' ? 'active' : stub, apply: () => stub, construct: () => stub }; const stub = new Proxy(function () {}, handler);";
const stubbed = (url) => Object.keys(STUBBED).find((k) => url.endsWith(k));
function local(r) {
  const s = stubbed(r.url);
  if (s) return { url: 'qutai-local:' + s, shortCircuit: true };
  if (r.url.endsWith('.tsx')) return { url: 'qutai-tsx:' + r.url, shortCircuit: true };
  return r;
}
export async function resolve(specifier, context, next) {
  if (specifier !== 'react' && !specifier.startsWith('react/') && NATIVE.test(specifier)) {
    return { url: 'qutai-stub:' + specifier + '?from=' + encodeURIComponent(context.parentURL || ''), shortCircuit: true };
  }
  try {
    return local(await next(specifier, context));
  } catch (error) {
    if (!specifier.startsWith('.') || /\.[cm]?[jt]sx?$/.test(specifier)) throw error;
    for (const ext of ['.ts', '/index.ts', '.tsx']) {
      try {
        return local(await next(specifier + ext, context));
      } catch {}
    }
    throw error;
  }
}
export async function load(url, context, next) {
  if (url.startsWith('qutai-stub:')) {
    const spec = url.slice(11, url.indexOf('?from='));
    const from = decodeURIComponent(url.slice(url.indexOf('?from=') + 6));
    const wanted = new Set();
    if (from.startsWith('file:')) {
      const src = readFileSync(fileURLToPath(from), 'utf8');
      for (const m of src.matchAll(/\bimport\s+(?!type\b)([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
        if (m[2] !== spec) continue;
        const brace = /\{([\s\S]*)\}/.exec(m[1]);
        if (brace) for (const part of brace[1].split(',')) { const p = part.trim(); if (!p || p.startsWith('type ')) continue; wanted.add(p.split(/\s+as\s+/)[0]); }
        // import * as X: every X.name the file uses.
        const star = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(m[1]);
        if (star) for (const u of src.matchAll(new RegExp('\\b' + star[1] + '\\.([A-Za-z_$][\\w$]*)', 'g'))) wanted.add(u[1]);
      }
    }
    const body = STUB + [...wanted].filter((n) => n !== 'default').map((n) => 'export const ' + n + ' = stub;').join('') + 'export default stub;';
    return { format: 'module', source: body, shortCircuit: true };
  }
  if (url.startsWith('qutai-local:')) return { format: 'module', source: STUBBED[url.slice(12)], shortCircuit: true };
  if (url.startsWith('qutai-tsx:')) {
    const src = readFileSync(fileURLToPath(url.slice(10)), 'utf8');
    const exported = new Set();
    for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) exported.add(m[1]);
    const body = STUB + [...exported].map((n) => 'export const ' + n + ' = stub;').join('') + 'export default stub;';
    return { format: 'module', source: body, shortCircuit: true };
  }
  const r = await next(url, context);
  if (!url.startsWith('file:') || !url.includes('/src/') || !/\.ts$/.test(url) || r.source == null) return r;
  return { ...r, source: typeOnly(String(r.source), fileURLToPath(url)) };
}
// App files import some types without `import type` (Metro strips them; Node can't know): a name the imported
// file exports only as a type or interface is marked `type` here.
const typeCache = new Map();
function typeExports(file) {
  if (typeCache.has(file)) return typeCache.get(file);
  let names = new Set();
  try {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/^export\s+(?:declare\s+)?(?:type|interface)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
    for (const m of src.matchAll(/^export\s+type\s*\{([^}]*)\}/gm)) for (const p of m[1].split(',')) { const n = p.trim().split(/\s+as\s+/).pop(); if (n) names.add(n); }
  } catch {}
  typeCache.set(file, names);
  return names;
}
function targetFile(from, spec) {
  const base = new URL(spec, 'file://' + from).pathname;
  for (const c of [base, base + '.ts', base + '/index.ts', base + '.tsx']) { try { readFileSync(c); if (!c.endsWith('/')) return c; } catch {} }
  return null;
}
function typeOnly(src, file) {
  return src.replace(/\bimport\s+(?!type\b)([^;]*?)\{([^}]*)\}\s*from\s*(['"])(\.[^'"]+)\3/g, (all, head, list, q, spec) => {
    const target = targetFile(file, spec);
    if (!target) return all;
    const types = typeExports(target);
    const parts = list.split(',').map((p) => {
      const t = p.trim();
      if (!t || t.startsWith('type ')) return p;
      return types.has(t.split(/\s+as\s+/)[0]) ? ' type ' + t : p;
    });
    return 'import ' + head + '{' + parts.join(',') + '} from ' + q + spec + q;
  });
}
