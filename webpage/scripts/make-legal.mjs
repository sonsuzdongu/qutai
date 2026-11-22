// Copies the app's privacy policy and terms of use into the site: src/data/privacy.json and src/data/terms.json, from
// ../src/legal/proDocuments.ts (the texts of the store builds, which have the Qutai account and Qutai Credits; they also
// cover using your own AI key). The site never edits the text: change it in the app, then run `npm run legal` and
// commit the JSON. `npm run check` fails when either JSON no longer matches the app. Wording the app shows per platform
// (`{{ios:…|android:…|web:…}}`, src/legal/documents.ts › textForPlatform) is copied as its `web` branch, which names
// both stores; a platform part without one stops the script.
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const SOURCE = fileURLToPath(new URL('../../src/legal/proDocuments.ts', import.meta.url));
export const OUT = fileURLToPath(new URL('../src/data/privacy.json', import.meta.url));
export const TERMS_OUT = fileURLToPath(new URL('../src/data/terms.json', import.meta.url));

/** The policy as the site stores it: { updated, en: {title, intro, sections}, tr: {…} }. */
export async function policyFromApp() {
  return legalFromApp('privacy');
}

/** The terms of use, stored the same way as the policy. */
export async function termsFromApp() {
  return legalFromApp('terms');
}

const PLATFORM_WORDING = /\{\{ios:([^{}|]*)\|android:([^{}|]*)(?:\|web:([^{}|]*))?\}\}/g;

/** A text with each platform part replaced by its `web` branch. */
export function textForWeb(text) {
  const out = text.replace(PLATFORM_WORDING, (part, ios, android, web) => {
    if (web === undefined) throw new Error(`No web wording in ${part}`);
    return web;
  });
  if (out.includes('{{') || out.includes('}}')) throw new Error(`Unreadable platform wording in: ${out}`);
  return out;
}

function forWeb(doc) {
  return {
    title: textForWeb(doc.title),
    intro: textForWeb(doc.intro),
    sections: doc.sections.map((s) => ({ heading: textForWeb(s.heading), body: textForWeb(s.body) })),
  };
}

async function legalFromApp(kind) {
  const js = ts.transpileModule(await readFile(SOURCE, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const dir = await mkdtemp(join(tmpdir(), 'qutai-legal-'));
  try {
    const file = join(dir, 'proDocuments.mjs');
    await writeFile(file, js);
    const { PRO_DOCUMENTS, PRO_LEGAL_UPDATED } = await import(pathToFileURL(file).href);
    return { updated: PRO_LEGAL_UPDATED, en: forWeb(PRO_DOCUMENTS.en[kind]), tr: forWeb(PRO_DOCUMENTS.tr[kind]) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const policy = await policyFromApp();
  await writeFile(OUT, `${JSON.stringify(policy, null, 2)}\n`);
  console.log(`src/data/privacy.json: privacy policy of ${policy.updated} (en, tr)`);
  const terms = await termsFromApp();
  await writeFile(TERMS_OUT, `${JSON.stringify(terms, null, 2)}\n`);
  console.log(`src/data/terms.json: terms of use of ${terms.updated} (en, tr)`);
}
