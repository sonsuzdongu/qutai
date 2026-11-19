/**
 * Which AI the assistant is, added to each user message (with the tab, time and interface language) so it can answer
 * "which model are you?". With Qutai Credits it is Qutai on Qutai Credits, naming no tier (there is no tier choice
 * since 20 Nov 2026, CRED-39) and never the provider or model behind it (the server picks and may change them); with the user's own key it names the provider and model from settings.
 *
 * In the message rather than the system prompt: with Qutai Credits the server builds the system prompt from the
 * registered agent profile, so per-user facts travel with the message, as in own-key mode.
 */
export type AssistantIdentity =
  | {
      mode: 'credits';
    }
  | {
      mode: 'own';
      /** The provider's name as Settings shows it ("Anthropic", "OpenRouter", "Custom endpoint"). */
      provider: string;
      /** The model id from settings or the conversation's choice. */
      model: string;
    };

/** One line of plain text that can't break out of the bracketed note: no brackets, quotes or line breaks, short. */
function clean(value: string, max = 80): string {
  const flat = value.replace(/[[\]"\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export function identityNote(identity: AssistantIdentity): string {
  if (identity.mode === 'credits') {
    return (
      'Your identity: you are Qutai, the assistant of the Qutai browser, running on Qutai Credits. ' +
      'When asked which AI or model you are, say exactly that. Never name or guess the AI company or model behind ' +
      'Qutai Credits, even if asked directly: Qutai chooses it and it can change.'
    );
  }
  const provider = clean(identity.provider, 40) || 'an AI provider';
  const model = clean(identity.model, 100);
  return (
    `Your identity: you are Qutai's assistant, running on ${provider}${model ? ` with the model "${model}"` : ''}, ` +
    "chosen in Qutai's settings with the user's own key. When asked which AI or model you are, say so."
  );
}

/** Adds the note inside the bracketed context at the end of a user message ("[Current tab … ]"), or after it. */
export function withIdentity(text: string, identity: AssistantIdentity): string {
  const note = identityNote(identity);
  return text.endsWith(']') ? `${text.slice(0, -1)} ${note}]` : `${text}\n\n[${note}]`;
}
