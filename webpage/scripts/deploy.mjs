// Deploys the built site with `wrangler deploy`, adding the values that are never committed.
//
// The App Link / Universal Link files (worker/wellKnown.ts; the app repository's docs/app-links.md) are served from
// two Worker variables, APPLE_APP_IDS and ANDROID_CERT_SHA256. A plain `wrangler deploy` replaces the Worker's
// variables with those in wrangler.jsonc, so a deploy without them would switch both files back to 404. This script
// reads them from the environment or from .deploy.local.env (git-ignored, KEY=value lines) and passes them on every
// deploy. Without them it deploys as before and says that the two files answer 404.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const KEYS = ['APPLE_APP_IDS', 'ANDROID_CERT_SHA256', 'APP_LINK_PATH'];
const file = fileURLToPath(new URL('../.deploy.local.env', import.meta.url));
const local = {};
if (existsSync(file)) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) local[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const args = ['wrangler', 'deploy', ...process.argv.slice(2)];
const set = [];
for (const key of KEYS) {
  const value = (process.env[key] || local[key] || '').trim();
  if (!value) continue;
  if (/\s/.test(value)) {
    console.error(`${key} must not contain spaces.`);
    process.exit(1);
  }
  args.push('--var', `${key}:${value}`);
  set.push(key);
}
console.log(
  set.includes('APPLE_APP_IDS') && set.includes('ANDROID_CERT_SHA256')
    ? `App link variables: ${set.join(', ')}`
    : 'App link variables are not all set (.deploy.local.env): a /.well-known file without its variable answers 404.',
);
const result = spawnSync('npx', args, { stdio: 'inherit', cwd: fileURLToPath(new URL('..', import.meta.url)) });
process.exit(result.status ?? 1);
