/**
 * The dynamic parts of the site: `/` sends the visitor to `/en/` or `/tr/`, and `/intent/sign-in/email` hands the
 * sign-in email's link to the app (worker/intent.ts).
 *
 * 1. A `lang` cookie (set by the language switch on the page) wins.
 * 2. Otherwise the Accept-Language header, in the visitor's order of preference: the first Turkish or
 *    English entry decides; other languages are skipped.
 * 3. Otherwise English.
 *
 * Everything else is a static asset served without running this code (`run_worker_first`).
 */
import { INTENT_PATH, intentConfig, intentPage } from './intent';
import { pickLanguage } from './language';

interface Env {
  ASSETS: Fetcher;
  /** The app's URL scheme for the sign-in link (wrangler.jsonc `vars`): `qutai`. */
  SCHEME?: string;
  /** The Android package the sign-in link opens: `com.sonsuzdongu.qutai`. */
  ANDROID_PACKAGE?: string;
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === INTENT_PATH || url.pathname === `${INTENT_PATH}/`) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
      return intentPage(request, intentConfig(env));
    }
    if (url.pathname !== '/') return env.ASSETS.fetch(request);

    const lang = pickLanguage(request.headers.get('Cookie'), request.headers.get('Accept-Language'));
    const target = new URL(`/${lang}/`, url);
    target.search = url.search;
    return new Response(null, {
      status: 302,
      headers: {
        Location: target.toString(),
        // The answer depends on these two headers, so shared caches must not reuse it for others.
        Vary: 'Accept-Language, Cookie',
        'Cache-Control': 'private, no-store',
        'Content-Language': lang,
      },
    });
  },
} satisfies ExportedHandler<Env>;
