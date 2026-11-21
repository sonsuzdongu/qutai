// A reply cut off in the middle of a tool call (max_tokens) leaves half a JSON text as the call's input: the stream
// reader gives the call no input instead of throwing, so runAgent can answer "Not executed: the response was cut off".
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseToolInput } from '../../src/ai/anthropic.ts';

test('a cut-off or odd tool input is an empty input, never a thrown error', () => {
  assert.deepEqual(parseToolInput('{"url": "https://exam'), {});
  assert.deepEqual(parseToolInput(undefined), {});
  assert.deepEqual(parseToolInput(''), {});
  assert.deepEqual(parseToolInput('[1]'), {});
  assert.deepEqual(parseToolInput('{"ref": 12}'), { ref: 12 });
});
