// One newId / newNonce on a cryptographically secure source (DATA-27, 20 Nov 2026 code review; src/utils/ids.ts):
// nonces are 128 bits of hex, ids keep the shape stored ids always had, and no Math.random is left in the app's code.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { newId, newNonce, randomBase36 } from '../../src/utils/ids';
import { fillRandom } from '../../src/utils/secureRandom';
import { newAgentName } from '../../src/browser/agentScript';

test('nonces: 32 hex characters, never repeated', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    const n = newNonce();
    assert.match(n, /^[0-9a-f]{32}$/);
    assert.ok(!seen.has(n));
    seen.add(n);
  }
  assert.match(newNonce(4), /^[0-9a-f]{8}$/);
  assert.match(newAgentName(), /^__q[0-9a-f]{32}$/);
});

test('ids keep the stored shape: time in base 36, then base-36 characters', () => {
  const id = newId(8);
  assert.match(id, /^[0-9a-z]{16,}$/);
  assert.ok(id.startsWith(Date.now().toString(36).slice(0, 4)));
  assert.match(randomBase36(6), /^[0-9a-z]{6}$/);
  // Every character comes up (rejection sampling, no bias towards the first ones).
  const counts = new Map<string, number>();
  for (const c of randomBase36(36_000)) counts.set(c, (counts.get(c) ?? 0) + 1);
  assert.equal(counts.size, 36);
  for (const n of counts.values()) assert.ok(n > 700 && n < 1300, String(n));
});

test('the secure source refuses to run without crypto instead of falling back', () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto')!;
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
  try {
    assert.throws(() => fillRandom(new Uint8Array(4)), /No secure random source/);
  } finally {
    Object.defineProperty(globalThis, 'crypto', saved);
  }
});

test('no Math.random in the app code', () => {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.generated.json')) {
        readFileSync(path, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (/Math\.random\s*\(/.test(line)) found.push(`${path}:${i + 1}`);
          });
      }
    }
  };
  walk('src');
  for (const line of readFileSync('App.tsx', 'utf8').split('\n')) if (/Math\.random\s*\(/.test(line)) found.push('App.tsx');
  assert.deepEqual(found, []);
});
