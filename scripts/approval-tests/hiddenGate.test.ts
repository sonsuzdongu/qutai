// A hidden saved value (an ID number, a locked memory) on a site: asked once per site and task, and only the answer
// just given counts as "the user was asked about this action" (src/agent/tools/gates.ts hiddenGate, TOOL-34).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hiddenGate } from '../../src/agent/tools/gates.ts';

const memory = { id: 'm1', text: 'secret', category: 'identity', createdAt: 0, updatedAt: 0, sensitive: true, label: 'Passport number' };

function setup(answer: boolean, personal: 'ask' | 'allow' | 'block' = 'ask') {
  let asked = 0;
  const ctx = {
    sites: { personalFor: () => personal, levelFor: () => 'default' },
    personalGrants: { allowed: new Set<string>(), declined: new Set<string>() },
    confirmHidden: async () => {
      asked++;
      return answer;
    },
  };
  const tab = { incognito: false, run: async () => 'Passport no.' };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gate = (url = 'https://visa.test/form', host = 'visa.test') => hiddenGate(memory as any, { ref: 3 }, url, host, ctx as any, tab as any);
  return { gate, asked: () => asked };
}

test('the first use on a site asks and says so; later uses in the task run on the grant without having asked', async () => {
  const s = setup(true);
  assert.deepEqual(await s.gate(), { kind: 'asked' });
  assert.deepEqual(await s.gate(), { kind: 'run' });
  assert.equal(s.asked(), 1);
  // Another site is asked again.
  assert.deepEqual(await s.gate('https://other.test/x', 'other.test'), { kind: 'asked' });
  assert.equal(s.asked(), 2);
});

test('declined stays declined for the task; http and blocked sites are refused without asking', async () => {
  const no = setup(false);
  assert.equal((await no.gate()).kind, 'refuse');
  assert.equal((await no.gate()).kind, 'refuse');
  assert.equal(no.asked(), 1);
  const plain = setup(true);
  assert.equal((await plain.gate('http://visa.test/form')).kind, 'refuse');
  const blocked = setup(true, 'block');
  assert.equal((await blocked.gate()).kind, 'refuse');
  assert.equal(plain.asked() + blocked.asked(), 0);
});
