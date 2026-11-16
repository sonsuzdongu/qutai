import {
  customInstructionsPrompt,
  LAST_STEP_PROMPT,
  RESEARCH_PROMPT,
  SYSTEM_PROMPT,
  WEB_SEARCH_PROMPT,
} from '../agent/systemPrompt';
import { MEMORY_TOOLS, TOOLS } from '../agent/tools';
import type { AgentProfile } from './types';

/**
 * The agent profile for Qutai Credits (pro mode): the parts of the system prompt and the tool list the app's agent
 * sends, exported as one JSON file that Qutai's server registers (backend/README.md › Agent profiles). With credits
 * the server, not the app, adds them to each request, so the relay can't be used with other prompts or tools; the
 * app names the profile by the SHA-256 of the file's bytes (`AGENT_PROFILE_ID`).
 *
 * Pure code (no React Native), so `scripts/agent-profile/` can build it in Node. The JSON must come out the same,
 * byte for byte, every time the same source is built: key order is the order written here and in tools.ts.
 *
 * What stays out: everything that changes per request. The memory section and the user's custom instructions go as
 * the relay's `context` (the server puts them where the app does); the current tab, time and interface language are
 * in the user's message, as in own-key mode.
 */

/** Where the server puts the user's custom instructions inside the wrapper. */
export const CUSTOM_INSTRUCTIONS_SLOT = '{{text}}';

export function buildAgentProfile(): AgentProfile {
  return {
    version: 1,
    system: {
      base: SYSTEM_PROMPT,
      webSearch: WEB_SEARCH_PROMPT,
      research: RESEARCH_PROMPT,
      lastStep: LAST_STEP_PROMPT,
      customInstructions: customInstructionsPrompt(CUSTOM_INSTRUCTIONS_SLOT),
    },
    tools: [
      ...TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema, group: 'core' as const })),
      ...MEMORY_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
        group: 'memory' as const,
      })),
    ],
  };
}

/** The file's text, exactly as it is hashed and registered: indented JSON with a final newline. */
export function agentProfileJson(profile: AgentProfile = buildAgentProfile()): string {
  return `${JSON.stringify(profile, null, 2)}\n`;
}
