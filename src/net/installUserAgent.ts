// Imported for its effect, right after the language in index.ts, so the fetch wrapper is in place before any other
// module (or its import-time code) sends a request.
import { installAppUserAgent } from './qutaiUserAgent';

installAppUserAgent();
