// Copies the app's privacy policy into the site: src/data/privacy.json, from ../src/legal/proDocuments.ts (the
// policy of the store builds, which have the Qutai account and Qutai Credits; it also covers using your own AI key).
// The site never edits the text: change it in the app, then run `npm run legal` and commit the JSON.
// `npm run check` fails when the JSON no longer matches the app.
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const SOURCE = fileURLToPath(new URL('../../src/legal/proDocuments.ts', import.meta.url));
export const OUT = fileURLToPath(new URL('../src/data/privacy.json', import.meta.url));

/** The policy as the site stores it: { updated, en: {title, intro, sections}, tr: {…} }. */
export async function policyFromApp() {
  const js = ts.transpileModule(await readFile(SOURCE, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const dir = await mkdtemp(join(tmpdir(), 'qutai-legal-'));
  try {
    const file = join(dir, 'proDocuments.mjs');
    await writeFile(file, js);
    const { PRO_DOCUMENTS, PRO_LEGAL_UPDATED } = await import(pathToFileURL(file).href);
    return { updated: PRO_LEGAL_UPDATED, en: PRO_DOCUMENTS.en.privacy, tr: PRO_DOCUMENTS.tr.privacy };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const policy = await policyFromApp();
  await writeFile(OUT, `${JSON.stringify(policy, null, 2)}\n`);
  console.log(`src/data/privacy.json: privacy policy of ${policy.updated} (en, tr)`);
}
