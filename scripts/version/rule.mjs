/**
 * Version and build number rule (docs/versioning.md). Pure functions, tested in rule.test.mjs.
 *
 * The build number is a function of the version, never a separate counter:
 *   "major.minor.patch" → major*10000 + minor*100 + patch   (0.1.7 → 107, 1.2 → 10200)
 * so it never goes backwards as long as the version goes forwards, and Android and iOS always carry the same one.
 */

const NUMBER = /^\d+$/;

/** The version's parts as numbers, or null when a part isn't a plain non-negative integer. */
function parts(version) {
  if (typeof version !== 'string') return null;
  const split = version.trim().split('.');
  if (split.some((p) => !NUMBER.test(p))) return null;
  return split.map((p) => Number.parseInt(p, 10));
}

/** "0.1.6" → "0.1.7"; null when the version isn't dotted numbers. */
export function nextVersion(version) {
  const n = parts(version);
  if (!n) return null;
  n[n.length - 1] += 1;
  return n.join('.');
}

/**
 * The build number of a version, or null when the rule can't give one: more than three parts, or a minor or patch
 * above 99 (numbers would collide or go backwards; raise the minor by hand instead: 0.1.99 → 0.2.0).
 * A missing part counts as 0 (1.2 → 10200).
 */
export function buildNumber(version) {
  const n = parts(version);
  if (!n || n.length > 3) return null;
  const [major, minor = 0, patch = 0] = n;
  if (minor > 99 || patch > 99) return null;
  return major * 10000 + minor * 100 + patch;
}

/** The larger of the two stores' current build numbers (they should be equal; unreadable ones count as 0). */
export function currentBuild(androidVersionCode, iosBuildNumber) {
  const android = Number.isInteger(androidVersionCode) ? androidVersionCode : 0;
  const ios = typeof iosBuildNumber === 'string' && NUMBER.test(iosBuildNumber) ? Number.parseInt(iosBuildNumber, 10) : 0;
  return Math.max(android, ios);
}

/**
 * What a bump would do. `to` is an explicit target version, or undefined for "raise the last part".
 * Returns { ok: false, error } or { ok: true, from, to, fromBuild, toBuild, warning? }.
 */
export function plan({ version, androidVersionCode, iosBuildNumber, to }) {
  const target = to === undefined ? nextVersion(version) : to.trim();
  if (target === null) return { ok: false, error: `The current version "${version}" is not dotted numbers; set it by hand.` };
  const toBuild = buildNumber(target);
  if (toBuild === null) {
    return {
      ok: false,
      error: `"${target}" has no build number: at most three parts, minor and patch at most 99. Raise the minor by hand (for example 0.1.99 → 0.2.0).`,
    };
  }
  const fromBuild = currentBuild(androidVersionCode, iosBuildNumber);
  const result = { ok: true, from: version, to: target, fromBuild, toBuild };
  if (toBuild <= fromBuild) result.warning = `Build ${toBuild} is not larger than the current ${fromBuild}; a store that already has ${fromBuild} will refuse it.`;
  return result;
}
