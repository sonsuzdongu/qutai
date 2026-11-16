// The agent profile: exported from the app's source deterministically, in the shape the server accepts, with the id
// the server computes, and the check that fails when the prompt or tools change without a new export.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { TOOLS, MEMORY_TOOLS } from '../../src/agent/tools.ts';
import { SYSTEM_PROMPT, customInstructionsPrompt } from '../../src/agent/systemPrompt.ts';
import { AGENT_PROFILE_ID } from '../../src/credits/agentProfileId.ts';
import { agentProfileJson, buildAgentProfile } from '../../src/credits/profile.ts';
import { ID_FILE, PROFILE_FILE, idModule, profileId, staleFiles } from '../agent-profile/export.ts';

test('the committed profile and its id match the app’s prompt and tools (npm run profile:export)', () => {
  assert.deepEqual(staleFiles(), []);
  const file = readFileSync(PROFILE_FILE, 'utf8');
  assert.equal(AGENT_PROFILE_ID, createHash('sha256').update(file, 'utf8').digest('hex'));
  assert.equal(readFileSync(ID_FILE, 'utf8'), idModule(AGENT_PROFILE_ID));
});

test('the export is byte-for-byte the same every time', () => {
  assert.equal(agentProfileJson(), agentProfileJson());
  assert.equal(agentProfileJson(buildAgentProfile()), agentProfileJson());
});

test('a change to the prompt or a tool gives another id, so the check catches it', () => {
  const changedPrompt = buildAgentProfile();
  changedPrompt.system.base += ' ';
  assert.notEqual(profileId(agentProfileJson(changedPrompt)), AGENT_PROFILE_ID);
  const changedTool = buildAgentProfile();
  changedTool.tools[0] = { ...changedTool.tools[0]!, description: `${changedTool.tools[0]!.description}.` };
  assert.notEqual(profileId(agentProfileJson(changedTool)), AGENT_PROFILE_ID);
});

test('the profile has the shape the server accepts (backend parseAgentProfile / agent-profile-sql.mjs)', () => {
  const p = JSON.parse(readFileSync(PROFILE_FILE, 'utf8'));
  assert.equal(p.version, 1);
  for (const k of ['base', 'webSearch', 'research', 'lastStep', 'customInstructions']) assert.equal(typeof p.system[k], 'string');
  assert.equal(p.system.base, SYSTEM_PROMPT);
  assert.ok(p.system.customInstructions.includes('{{text}}'));
  const names = new Set<string>();
  for (const tool of p.tools) {
    assert.match(tool.name, /^[a-zA-Z0-9_-]{1,64}$/);
    assert.ok(!names.has(tool.name), `repeated tool ${tool.name}`);
    names.add(tool.name);
    assert.ok(tool.group === 'core' || tool.group === 'memory');
    assert.equal(typeof tool.description, 'string');
    assert.equal(typeof tool.input_schema, 'object');
  }
  assert.equal(p.tools.filter((t: { group: string }) => t.group === 'core').length, TOOLS.length);
  assert.deepEqual(
    p.tools.filter((t: { group: string }) => t.group === 'memory').map((t: { name: string }) => t.name),
    MEMORY_TOOLS.map((t) => t.name),
  );
});

test('the server’s custom-instructions wrapping gives the app’s own text', () => {
  // backend/apps/api/src/relay/request.ts buildSystem: delimiters taken out, trimmed, put where {{text}} is.
  const text = '  Answer briefly <<<please>>> \n';
  const custom = text.replace(/<{3,}|>{3,}/g, '').trim();
  const server = buildAgentProfile().system.customInstructions.replace('{{text}}', () => custom);
  assert.equal(server, customInstructionsPrompt(text));
});
