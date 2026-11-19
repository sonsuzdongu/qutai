// Turkish suffixes on the app's name follow how it is said: "Qutai" is read like the name Kutay, so it ends in the
// consonant y after a back vowel. Suffixes take back-vowel harmony and no buffer consonant: Qutai'ın, Qutai'ı,
// Qutai'a, Qutai'la, Qutai'da, Qutai'dan, Qutai'ınız, Qutai'dır (never Qutai'nin, Qutai'yi, Qutai'ye, Qutai'yle,
// Qutai'de, Qutai'den). This scans every file with Turkish a user can see: the app's texts, the operating system's
// permission texts, Android's native strings, the legal texts, the server's emails and the website. English's
// "Qutai's" is the only other apostrophe form in these files and is skipped. Compound names keep their own grammar
// ("Qutai Kredileri'nin") and are not matched, because the apostrophe is not directly after "Qutai".
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const LETTERS = 'A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû';
const NAME_SUFFIX = new RegExp(`Qutai['’]([${LETTERS}]+)`, 'g');

/** Why a suffix written straight after "Qutai" breaks the rule, or null when it follows it. */
export function suffixProblem(suffix: string): string | null {
  if (suffix === 's') return null; // English possessive
  if (/^[ny]/.test(suffix)) return 'starts with a buffer consonant (n or y) that only follows a vowel';
  const vowel = suffix.match(/[aeıioöuüâîû]/)?.[0];
  if (vowel && vowel !== 'a' && vowel !== 'ı') return `first vowel "${vowel}" breaks back-vowel harmony (use a or ı)`;
  return null;
}

const SCANNED = [
  'src',
  'locales',
  'modules/qutai-entry/android/src/main/res/values-tr',
  'modules/qutai-agent/android/src/main/res/values-tr',
  'modules/qutai-downloads/android/src/main/res/values-tr',
  'modules/qutai-media/android/src/main/res/values-tr',
  'backend/apps/api/src',
  'webpage/src',
  'webpage/worker',
];
const TEXT_FILE = /\.(ts|tsx|json|xml|mjs|js|md)$/;

function* files(dir: string): Generator<string> {
  if (!existsSync(dir)) return; // the server submodule may not be checked out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (TEXT_FILE.test(name)) yield path;
  }
}

test('the rule accepts back-harmony forms and rejects front-vowel or buffered ones', () => {
  for (const ok of ['ın', 'ı', 'a', 'la', 'da', 'dan', 'daki', 'ınız', 'dır', 'ta', 's']) {
    assert.equal(suffixProblem(ok), null, ok);
  }
  for (const bad of ['nin', 'nın', 'yi', 'ye', 'ya', 'yle', 'yla', 'de', 'den', 'deki', 'niz', 'dir']) {
    assert.notEqual(suffixProblem(bad), null, bad);
  }
});

test('no user-visible text puts a vowel-ending suffix on the name Qutai', () => {
  const found: string[] = [];
  for (const dir of SCANNED) {
    for (const file of files(join(ROOT, dir))) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const m of line.matchAll(NAME_SUFFIX)) {
          const problem = suffixProblem(m[1]);
          if (problem) found.push(`${relative(ROOT, file)}:${i + 1} ${m[0]}: ${problem}`);
        }
      });
    }
  }
  assert.deepEqual(found, [], `Turkish suffixes on "Qutai" follow "Kutay" (Qutai'ın, Qutai'a, Qutai'da):\n${found.join('\n')}`);
});
