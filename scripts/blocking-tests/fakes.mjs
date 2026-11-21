// Stand-ins for this harness (./loader.mjs): expo-file-system as an in-memory folder tree, and the native content
// blocker (src/device/contentBlocker.ts) recording what it is handed. `__fs` and `__native` are the tests' handles.

export const FILE_SYSTEM = `
const files = new Map();
const dirs = new Set(['/doc', '/cache']);
export const __fs = { files, dirs, reset() { files.clear(); dirs.clear(); dirs.add('/doc'); dirs.add('/cache'); } };
const pathOf = (parent, name) => (typeof parent === 'string' ? parent : parent.path) + (name ? '/' + name : '');
export class Directory {
  constructor(parent, name) { this.path = pathOf(parent, name); this.uri = 'file://' + this.path; }
  get exists() { return dirs.has(this.path); }
  create() { dirs.add(this.path); }
  delete() {
    dirs.delete(this.path);
    for (const key of [...files.keys()]) if (key.startsWith(this.path + '/')) files.delete(key);
  }
}
export class File {
  constructor(parent, name) { this.path = pathOf(parent, name); this.uri = 'file://' + this.path; }
  get exists() { return files.has(this.path); }
  async text() { if (!files.has(this.path)) throw new Error('missing ' + this.path); return files.get(this.path); }
  async write(text) {
    const parent = this.path.slice(0, this.path.lastIndexOf('/'));
    if (!dirs.has(parent)) throw new Error('no folder ' + parent);
    files.set(this.path, String(text));
  }
  delete() { files.delete(this.path); }
  move(target) { files.set(target.path, files.get(this.path)); files.delete(this.path); this.path = target.path; }
}
export const Paths = { document: new Directory('/doc'), cache: new Directory('/cache') };
export default { Directory, File, Paths };
`;

export const CONTENT_BLOCKER = `
export const __native = {
  available: true,
  compiled: new Set(),
  calls: [],
  reset() { __native.available = true; __native.compiled = new Set(); __native.calls = []; },
};
export function hasNativeBlocking() { return __native.available; }
export async function loadAndroidBlocker(uri) {
  __native.calls.push(['loadAndroidBlocker', uri]);
  return uri ? 1 : 0;
}
export async function compileIosRuleList(identifier, uri) {
  __native.calls.push(['compileIosRuleList', identifier, uri]);
  __native.compiled.add(identifier);
}
export async function hasIosRuleList(identifier) { return __native.compiled.has(identifier); }
export async function removeIosRuleLists(prefix, keep) {
  __native.calls.push(['removeIosRuleLists', prefix, keep]);
  for (const id of [...__native.compiled]) if (id.startsWith(prefix) && !keep.includes(id)) __native.compiled.delete(id);
}
`;
