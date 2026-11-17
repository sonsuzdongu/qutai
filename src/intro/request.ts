import type { RequestTarget } from '../ai/providers';
import type { Provider } from '../ai/types';
import { type Extraction, extractionPrompt, parseExtraction } from './extract';

/** The conversation key in "What was sent to the AI". */
export const INTRO_AUDIT = 'memory:introduce';

/**
 * Sends one understanding request: the extraction prompt and `text` (the transcript, or the follow-up answers), no
 * tools, no web search, nothing from memory. Returns what passed validation; throws the provider's error, or an
 * ExtractionError when the answer could not be read.
 *
 * Qutai Credits: the relay answers only with the registered agent profile, whose system prompt and tools replace the
 * app's `system` (credits/provider.ts). The instructions then go at the start of the user turn, the only part the app
 * controls; the text after them is what the quotes are checked against either way.
 */
export type IntroTarget = Pick<RequestTarget, 'provider' | 'model' | 'apiKey' | 'endpoint' | 'extraHeaders'>;

export async function understand(
  target: IntroTarget,
  text: string,
  language: string,
  signal: AbortSignal,
  /** `getProvider(target.provider)` in the app (a parameter, so tests need none of the app's storage). */
  provider: Provider,
  /** What the quotes must be found in, when not all of `text` is the user's words (round 2: the answers alone). */
  quotesFrom: string = text,
): Promise<Extraction> {
  const prompt = extractionPrompt(language);
  const credits = target.provider === 'qutai';
  const reply = await provider.call({
    apiKey: target.apiKey,
    model: target.model,
    endpoint: target.endpoint,
    extraHeaders: target.extraHeaders,
    system: credits ? '' : prompt,
    tools: [],
    webSearch: false,
    turns: [{ role: 'user', text: credits ? `${prompt}\n\nThe text:\n${text}` : text }],
    signal,
    audit: { conversation: INTRO_AUDIT, incognito: false, host: null },
  });
  return parseExtraction(reply.text, quotesFrom);
}
