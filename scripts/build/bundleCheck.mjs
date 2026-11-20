/**
 * What a store package's JavaScript bundle must and must not contain (scripts/build/release.mjs). Pure, so it is tested
 * on fabricated bundles: `node --test scripts/build/bundleCheck.test.mjs`.
 *
 * - A pro-mode bundle contains the server's host; a plain one contains no server address at all.
 * - No bundle contains the test sign-in secret (whatever value .env or the shell has), nor a reference to the test
 *   sign-in variables that was left for runtime (the build sets them to off, so the bundler inlines them away).
 * - A plain bundle contains no code of RevenueCat's SDK (metro.config.js resolves it to an empty module); a bundle meant
 *   to sell credits (`purchases`) does.
 *
 * Problems name what was found, never a secret's value.
 */
const TEST_SIGN_IN_NAMES = ['EXPO_PUBLIC_DEV_LOGIN_SECRET', 'EXPO_PUBLIC_DEV_LOGIN'];
/** A text only RevenueCat's react-native-purchases carries (its log prefix); Qutai's own code never writes it. */
export const REVENUECAT_MARK = '[RevenueCat]';
/** The Play Billing permission as it appears in a bundle's (binary) AndroidManifest.xml. */
export const BILLING_PERMISSION = 'com.android.vending.BILLING';

/**
 * @param {Buffer} bundle
 * @param {{ pro: boolean, apiHost: string | null, serverHosts?: string[], secrets?: { name: string, value: string }[], purchases?: boolean }} expect
 *   `purchases`: true when the build must be able to sell credits (RevenueCat's SDK in the bundle)
 * @returns {string[]} problems, empty when the bundle is fine
 */
export function bundleProblems(bundle, { pro, apiHost, serverHosts = [], secrets = [], purchases = false }) {
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
  if (!pro && has(REVENUECAT_MARK)) problems.push('a plain (not pro-mode) bundle contains RevenueCat’s SDK');
  if (purchases && !has(REVENUECAT_MARK)) problems.push('the bundle does not contain RevenueCat’s SDK, so it cannot sell credits');
  return problems;
}

/**
 * What an Android App Bundle's manifest (`base/manifest/AndroidManifest.xml`, protobuf, read as bytes) must and must not
 * contain: the Play Billing permission in a build that sells credits, never in a plain one.
 * @param {Buffer} manifest
 * @param {{ pro: boolean, purchases: boolean }} expect
 * @returns {string[]}
 */
export function manifestProblems(manifest, { pro, purchases }) {
  const billing = manifest.includes(Buffer.from(BILLING_PERMISSION));
  if (!pro && billing) return [`a plain (not pro-mode) bundle declares ${BILLING_PERMISSION}`];
  if (purchases && !billing) return [`the bundle does not declare ${BILLING_PERMISSION}, so Google Play would not sell credits`];
  return [];
}

/** The host of an http(s) address, or null. */
export function hostOf(url) {
  try {
    return /^https?:\/\//.test(url ?? '') ? new URL(url).host : null;
  } catch {
    return null;
  }
}
