// The assistant's site-rule tools: three of them, in the tool list (and so in the agent profile), with the system
// prompt telling how to find, try and save a rule.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOOLS } from '../../src/agent/tools.ts';
import { SYSTEM_PROMPT } from '../../src/agent/systemPrompt.ts';

test('try_hide, save_site_rules and site_rules are offered', () => {
  const names = TOOLS.map((t) => t.name);
  for (const name of ['try_hide', 'save_site_rules', 'site_rules']) assert.ok(names.includes(name), name);
  assert.equal(new Set(names).size, names.length, 'no duplicate tool names');
});

test('the system prompt says to try before saving and to prefer stable selectors', () => {
  assert.match(SYSTEM_PROMPT, /try_hide find/);
  assert.match(SYSTEM_PROMPT, /view_screenshot that the gap closed/);
  assert.match(SYSTEM_PROMPT, /save_site_rules/);
  assert.match(SYSTEM_PROMPT, /generated class names/);
});
