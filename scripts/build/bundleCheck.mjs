/**
 * What a store package's JavaScript bundle must and must not contain (scripts/build/release.mjs). Pure, so it is tested
 * on fabricated bundles: `node --test scripts/build/bundleCheck.test.mjs`.
 *
 * - A pro-mode bundle contains the server's host; a plain one contains no server address at all.
 * - No bundle contains the test sign-in secret (whatever value .env or the shell has), nor a reference to the test
 *   sign-in variables that was left for runtime (the build sets them to off, so the bundler inlines them away).
 *
 * Problems name what was found, never a secret's value.
 */
const TEST_SIGN_IN_NAMES = ['EXPO_PUBLIC_DEV_LOGIN_SECRET', 'EXPO_PUBLIC_DEV_LOGIN'];

/**
 * @param {Buffer} bundle
 * @param {{ pro: boolean, apiHost: string | null, serverHosts?: string[], secrets?: { name: string, value: string }[] }} expect
 * @returns {string[]} problems, empty when the bundle is fine
 */
export function bundleProblems(bundle, { pro, apiHost, serverHosts = [], secrets = [] }) {
  const has = (text) => typeof text === 'string' && text.length > 0 && bundle.includes(Buffer.from(text));
  const problems = [];
  if (pro && !has(apiHost)) problems.push('the bundle does not contain the server address: this is not a pro-mode build');
  if (!pro) {
    for (const host of new Set(serverHosts.filter(Boolean))) if (has(host)) problems.push(`a plain (not pro-mode) bundle contains a server address (${host})`);
  }
  for (const s of secrets) {
    // Too short a value would match by chance; the server refuses test secrets under 32 characters anyway.
    if (s.value && s.value.length >= 16 && has(s.value)) problems.push(`the bundle contains the value of ${s.name} (the test sign-in secret)`);
  }
  for (const name of TEST_SIGN_IN_NAMES) if (has(name)) problems.push(`the bundle still refers to ${name} (not replaced at build time)`);
  return problems;
}

/** The host of an http(s) address, or null. */
export function hostOf(url) {
  try {
    return /^https?:\/\//.test(url ?? '') ? new URL(url).host : null;
  } catch {
    return null;
  }
}
