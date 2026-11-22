import type { RequestTarget } from '../ai/providers';
import type { Provider } from '../ai/types';
import { type Extraction, extractionPrompt, parseExtraction, parseServerExtraction } from './extract';
import type { FollowUpId } from './followUps';

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

/**
 * Qutai Credits: the free introduction (`POST /relay/intro`, backend README › Relay › Introduction), where the server
 * owns the instructions and the app sends only the user's words. `call` is null when there is no signed-in client.
 */
export type FreeIntro = {
  call: ((body: FreeIntroBody, signal: AbortSignal) => Promise<unknown>) | null;
  body: FreeIntroBody;
};

export type FreeIntroBody =
  | { round: 'introduction'; language: string; text: string }
  | { round: 'answers'; language: string; answers: { about: FollowUpId; text: string }[] };

export async function understand(
  target: IntroTarget,
  text: string,
  language: string,
  signal: AbortSignal,
  /** `getProvider(target.provider)` in the app (a parameter, so tests need none of the app's storage). */
  provider: Provider,
  /** What the quotes must be found in, when not all of `text` is the user's words (round 2: the answers alone). */
  quotesFrom: string = text,
  /**
   * Qutai Credits only: tried first; on any refusal (free requests used, switched off, no key on the server, an older
   * server, an unreadable answer, no connection) the request goes through the credits relay as before.
   */
  free?: FreeIntro,
): Promise<Extraction> {
  const prompt = extractionPrompt(language);
  const credits = target.provider === 'qutai';
  if (credits && free?.call) {
    try {
      return parseServerExtraction(await free.call(free.body, signal), quotesFrom);
    } catch (e) {
      if (signal.aborted) throw e;
      // Falls through to the credits relay.
    }
  }
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
