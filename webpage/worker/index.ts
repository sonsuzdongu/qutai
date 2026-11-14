/**
 * The only dynamic part of the site: `/` sends the visitor to `/en/` or `/tr/`.
 *
 * 1. A `lang` cookie (set by the language switch on the page) wins.
 * 2. Otherwise the Accept-Language header, in the visitor's order of preference: the first Turkish or
 *    English entry decides; other languages are skipped.
 * 3. Otherwise English.
 *
 * Everything else is a static asset served without running this code (`run_worker_first: ["/"]`).
 */
import { pickLanguage } from './language';

interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
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
