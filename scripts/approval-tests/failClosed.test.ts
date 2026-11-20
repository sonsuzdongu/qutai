// The checks before paying, deleting, publishing and typing into secret fields fail closed (PAY-28, 20 Nov 2026 code
// review): when the page query behind a check throws, never answers or answers something of the wrong shape, the
// press or the typing is refused (or no approval is granted); it never goes ahead as "nothing to approve".
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { enterGate, pressGate, requestApprovalTool, secretFieldGate } from '../../src/agent/approvalTool.ts';
import { ApprovalGrants } from '../../src/agent/outwardApproval.ts';
import { gateTiming, PageQueryError, parsePressContext, queryPage } from '../../src/agent/pageFacts.ts';
import { nothingComposed, pressContextOf } from './pageFakes.ts';

type Mode = 'ok' | 'throw' | 'hang' | 'malformed' | 'null' | 'wrongType';
const MODES: Exclude<Mode, 'ok'>[] = ['throw', 'hang', 'malformed', 'null', 'wrongType'];

const GOOD: Record<string, unknown> = {
  pressContext: pressContextOf({ label: 'Send' }),
  pressComposed: nothingComposed('Send'),
  pressInfo: { label: 'Send', url: 'https://shop.test/cart', disabled: false },
  enterFacts: {
    ref: 4, tag: 'textarea', type: '', editable: false, role: '', inSearch: false, formGet: false, loginForm: false,
    autocomplete: '', inputMode: '', hints: 'comment', maxLength: null, text: '', label: 'Comment',
  },
  fieldText: { text: 'Lovely video, thanks!', secret: false },
  formValues: [{ label: 'Comment', value: 'Lovely video, thanks!' }],
  changeInfo: { label: 'Delete', url: 'https://shop.test/cart', disabled: false, heading: 'Photos', dialog: '', item: 'beach.jpg', fields: null },
  findText: { ref: 30, line: 'Order total: €24.99' },
  textOf: '€24.99',
  secretField: null,
};

/** A page whose answer to `broken` fails the given way; every other command answers like the real page script. */
function fakeTab(broken: string, mode: Mode) {
  return {
    id: 'tab-1',
    incognito: false,
    url: 'https://shop.test/cart',
    run(command: string): Promise<unknown> {
      if (command !== broken || mode === 'ok') {
        if (!(command in GOOD)) return Promise.reject(new Error(`unexpected ${command}`));
        return Promise.resolve(GOOD[command]);
      }
      switch (mode) {
        case 'throw':
          return Promise.reject(new Error('Element ref=5 not found (page changed?). Call read_page again.'));
        case 'hang':
          return new Promise(() => {});
        case 'malformed':
          return Promise.resolve({ label: 42, fields: 'none', link: 'no' });
        case 'null':
          return Promise.resolve(null);
        case 'wrongType':
          return Promise.resolve('all clear');
      }
    },
  };
}

function ctxOf(payments = true) {
  const asked: unknown[] = [];
  return {
    asked,
    approvals: new ApprovalGrants(),
    paymentsAllowed: () => payments,
    confirmOutward: async (a: unknown) => {
      asked.push(a);
      return true;
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const any = (x: unknown) => x as any;

let saved = 0;
beforeEach(() => {
  saved = gateTiming.maxMs;
  gateTiming.maxMs = 30;
});
afterEach(() => {
  gateTiming.maxMs = saved;
});

test('queryPage turns an error, no answer and a wrong shape into PageQueryError', async () => {
  for (const [mode, reason] of [['throw', 'error'], ['hang', 'timeout'], ['malformed', 'malformed'], ['null', 'malformed'], ['wrongType', 'malformed']] as const) {
    await assert.rejects(
      queryPage(any(fakeTab('pressContext', mode)), 'pressContext', [5], parsePressContext),
      (e: unknown) => e instanceof PageQueryError && e.reason === reason,
      mode,
    );
  }
  // Tab.run's own timeout message counts as no answer.
  const slow = { run: () => Promise.reject(new Error('The page did not respond (it may still be loading).')) };
  await assert.rejects(queryPage(any(slow), 'pressContext', [5], parsePressContext), (e: unknown) => e instanceof PageQueryError && e.reason === 'timeout');
  // A whole answer passes.
  assert.equal((await queryPage(any(fakeTab('x', 'ok')), 'pressContext', [5], parsePressContext)).label, 'Send');
});

test('a click is refused when the press context or the composed text cannot be read', async () => {
  for (const command of ['pressContext', 'pressComposed']) {
    for (const mode of MODES) {
      const ctx = ctxOf();
      const gate = await pressGate('click', { ref: 5 }, any(ctx), any(fakeTab(command, mode)), null);
      assert.equal(gate.kind, 'refuse', `${command} ${mode}`);
      assert.match(any(gate).output.content, /couldn't check what this press does.*Nothing was done/s, `${command} ${mode}`);
      // The same at a point on the screen.
      const at = await pressGate('click_at', {}, any(ctx), any(fakeTab(command, mode)), { fx: 0.5, fy: 0.5 });
      assert.equal(at.kind, 'refuse', `click_at ${command} ${mode}`);
    }
  }
  // With whole answers the ordinary press goes ahead.
  assert.deepEqual(await pressGate('click', { ref: 5 }, any(ctxOf()), any(fakeTab('x', 'ok')), null), { kind: 'none' });
});

test('an approved press is refused when the page cannot confirm it is still what the user approved', async () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ kind: 'publish', action: 'comment', button_ref: 5, field_ref: 4, text: 'Lovely video, thanks!' }, 'fieldText'],
    [{ kind: 'publish', action: 'post', button_ref: 5 }, 'formValues'],
    [{ kind: 'change', action: 'delete', button_ref: 5 }, 'changeInfo'],
    [{ kind: 'pay', button_ref: 5, total: '€24.99', items: '1 kettle', payment_method: 'Visa ending 4242' }, 'textOf'],
    [{ kind: 'pay', button_ref: 5, total: '€24.99', items: '1 kettle', payment_method: 'Visa ending 4242' }, 'findText'],
  ];
  for (const [request, command] of cases) {
    for (const mode of MODES) {
      // null (the element left the page) and any text are real answers for textOf; findText then confirms the total.
      if (command === 'textOf' && (mode === 'null' || mode === 'wrongType')) continue;
      if (command === 'findText' && mode === 'null') continue; // null: not on the page (checked by textOf then).
      if (command === 'formValues' && mode === 'null') continue; // null: no form, the check fails on the form itself.
      const ctx = ctxOf();
      const approved = await requestApprovalTool(request, any(ctx), any(fakeTab('none', 'ok')));
      assert.equal(approved.isError, false, `${command}: ${approved.content}`);
      const gate = await pressGate('click', { ref: 5 }, any(ctx), any(fakeTab(command, mode)), null);
      assert.equal(gate.kind, 'refuse', `${command} ${mode}`);
      // Used up: a second try is checked from the start, not let through.
      assert.notEqual((await pressGate('click', { ref: 5 }, any(ctx), any(fakeTab(command, mode)), null)).kind, 'approved');
    }
  }
});

test('request_approval grants nothing when the page cannot say what is approved', async () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ kind: 'publish', action: 'comment', button_ref: 5, field_ref: 4, text: 'Lovely video, thanks!' }, 'pressInfo'],
    [{ kind: 'publish', action: 'comment', button_ref: 5, field_ref: 4, text: 'Lovely video, thanks!' }, 'fieldText'],
    [{ kind: 'publish', action: 'post', button_ref: 5 }, 'formValues'],
    [{ kind: 'change', action: 'delete', button_ref: 5 }, 'changeInfo'],
    [{ kind: 'pay', button_ref: 5, total: '€24.99', items: '1 kettle', payment_method: 'Visa ending 4242' }, 'findText'],
  ];
  for (const [request, command] of cases) {
    for (const mode of MODES) {
      const ctx = ctxOf();
      const out = await requestApprovalTool(request, any(ctx), any(fakeTab(command, mode)));
      assert.equal(out.isError, true, `${command} ${mode}: ${out.content}`);
      assert.equal(ctx.asked.length, 0, `${command} ${mode}: no dialog for facts Qutai couldn't read`);
      assert.equal(ctx.approvals.take('tab-1', 5), null, `${command} ${mode}: nothing granted`);
    }
  }
});

test('Enter is refused when the field it would send from cannot be read', async () => {
  for (const mode of MODES) {
    if (mode === 'null') continue; // null: no text field at that ref, so type itself fails and nothing is sent.
    const gate = await enterGate({ ref: 4, text: 'Lovely video, thanks!', submit: true }, any(ctxOf()), any(fakeTab('enterFacts', mode)));
    assert.equal(gate.kind, 'refuse', mode);
  }
  // An approved Enter whose field can't be read again is refused too.
  for (const mode of MODES) {
    const ctx = ctxOf();
    const ok = await requestApprovalTool(
      { kind: 'publish', action: 'comment', button_ref: 4, field_ref: 4, text: 'Lovely video, thanks!' },
      any(ctx),
      any(fakeTab('none', 'ok')),
    );
    assert.equal(ok.isError, false);
    const gate = await enterGate({ ref: 4, text: 'Lovely video, thanks!', submit: true }, any(ctx), any(fakeTab('fieldText', mode)));
    assert.equal(gate.kind, 'refuse', `approved ${mode}`);
  }
});

test('typing is refused when the page cannot say whether the field is a secret one', async () => {
  for (const mode of MODES) {
    if (mode === 'null') continue; // null: an ordinary field.
    const out = await secretFieldGate(any(fakeTab('secretField', mode)), 4);
    assert.ok(out?.isError, mode);
    assert.match(out!.content, /couldn't check the field/);
  }
  assert.equal(await secretFieldGate(any(fakeTab('x', 'ok')), 4), null);
  const otp = await secretFieldGate(any({ run: async () => 'oneTimeCode' }), 4);
  assert.ok(otp?.isError);
});
