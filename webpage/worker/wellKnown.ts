/**
 * The two files that make the sign-in link an App Link (Android) and a Universal Link (iOS), served from
 * configuration so no team id or certificate fingerprint is ever committed (app repository docs/app-links.md):
 *
 * - `/.well-known/apple-app-site-association` when APPLE_APP_IDS is set (`<Team ID>.<bundle id>`, comma-separated):
 *   the link's path for those apps;
 * - `/.well-known/assetlinks.json` when ANDROID_CERT_SHA256 is set (the signing certificates' SHA-256 fingerprints,
 *   `AA:BB:…`, comma-separated) for ANDROID_PACKAGE.
 *
 * Otherwise both answer 404, exactly as before. JSON, no redirect, short public cache: Apple's CDN and Android's
 * verifier fetch them directly.
 */
import { INTENT_PATH } from './intent';

export interface WellKnownEnv {
  /** `<Team ID>.<bundle id>`, comma-separated. */
  APPLE_APP_IDS?: string;
  /** The Android package (already a var for the sign-in page). */
  ANDROID_PACKAGE?: string;
  /** SHA-256 fingerprints of the app's signing certificates (Play app signing key, upload key, debug), comma-separated. */
  ANDROID_CERT_SHA256?: string;
  /** The link's path when the API's MAIL_INTENT_PATH is not the default. */
  APP_LINK_PATH?: string;
}

export const AASA_PATH = '/.well-known/apple-app-site-association';
export const ASSETLINKS_PATH = '/.well-known/assetlinks.json';

const APP_ID = /^[A-Z0-9]{10}\.[A-Za-z0-9.-]{3,155}$/;
const PACKAGE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const PATH = /^(\/[A-Za-z0-9._~-]+){1,8}$/;

const list = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && !v.startsWith('PLACEHOLDER'));

function linkPath(env: WellKnownEnv): string {
  const path = (env.APP_LINK_PATH ?? '').trim();
  return PATH.test(path) ? path : INTENT_PATH;
}

/** The apple-app-site-association document, or null when not configured. */
export function appleAppSiteAssociation(env: WellKnownEnv): unknown | null {
  const ids = list(env.APPLE_APP_IDS).filter((id) => APP_ID.test(id));
  if (ids.length === 0) return null;
  return {
    applinks: {
      details: [{ appIDs: ids, components: [{ '/': linkPath(env), comment: 'Qutai sign-in link' }] }],
    },
  };
}

/** The Digital Asset Links statement list, or null when not configured. */
export function assetLinks(env: WellKnownEnv): unknown | null {
  const pkg = (env.ANDROID_PACKAGE ?? '').trim();
  const fingerprints = list(env.ANDROID_CERT_SHA256)
    .map((f) => f.toUpperCase())
    .filter((f) => FINGERPRINT.test(f));
  if (!PACKAGE.test(pkg) || fingerprints.length === 0) return null;
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: fingerprints },
    },
  ];
}

export function wellKnown(pathname: string, env: WellKnownEnv): Response | null {
  const body = pathname === AASA_PATH ? appleAppSiteAssociation(env) : pathname === ASSETLINKS_PATH ? assetLinks(env) : undefined;
  if (body === undefined) return null;
  if (body === null) return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' },
  });
}
