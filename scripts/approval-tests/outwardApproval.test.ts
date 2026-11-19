// Posting and paying (src/agent/outwardApproval.ts, src/agent/approvalTool.ts): the request's checks, the grant (one
// press, one tab, one page), the checks just before the press, the payment setting, final payment buttons, card
// numbers, and the texts the model gets. The page is a stand-in answering the page script's commands.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pressGate, requestApprovalTool, type OutwardApproval } from '../../src/agent/approvalTool.ts';
import {
  ApprovalGrants,
  approvedText,
  checkPress,
  containsCardNumber,
  declinedText,
  isFinalPaymentLabel,
  parseApprovalInput,
  paymentsOffText,
} from '../../src/agent/outwardApproval.ts';
import { decide } from '../../src/agent/sitePolicy.ts';
import { SYSTEM_PROMPT } from '../../src/agent/systemPrompt.ts';
import { TOOLS } from '../../src/agent/tools.ts';

type Page = {
  url: string;
  buttons: Record<number, { label: string; disabled?: boolean }>;
  fields: Record<number, string>;
  forms?: Record<number, { label: string; value: string }[]>;
  /** Texts on the page, with the ref of the element and its line. */
  texts: { text: string; ref: number; line: string }[];
};

function fakeTab(page: Page, id = 'tab-1') {
  return {
    id,
    incognito: false,
    get url() {
      return page.url;
    },
    async run(command: string, args: unknown[]) {
      switch (command) {
        case 'pressContext': {
          const b = page.buttons[Number(args[0])];
          if (!b) throw new Error(`Element ref=${String(args[0])} not found`);
          return { label: b.label, tag: 'button', type: 'submit', role: '', disabled: !!b.disabled, dialogText: '', heading: '' };
        }
        case 'pressInfo': {
          const b = page.buttons[Number(args[0])];
          if (!b) throw new Error(`Element ref=${String(args[0])} not found`);
          return { label: b.label, url: page.url, disabled: !!b.disabled };
        }
        case 'fieldText': {
          const text = page.fields[Number(args[0])];
          if (text === undefined) throw new Error('not a text field');
          return { text, secret: false };
        }
        case 'formValues':
          return page.forms?.[Number(args[0])] ?? null;
        case 'findText': {
          const hit = page.texts.find((t) => t.line.includes(String(args[0])));
          return hit ? { ref: hit.ref, line: hit.line } : null;
        }
        case 'textOf':
          return page.texts.find((t) => t.ref === Number(args[0]))?.text ?? null;
        default:
          throw new Error(`unexpected ${command}`);
      }
    },
  };
}

function setup(over: Partial<Page> = {}, opts: { payments?: boolean; answer?: boolean } = {}) {
  const page: Page = {
    url: 'https://video.test/watch?v=1',
    buttons: { 5: { label: 'Comment' }, 9: { label: 'Pay now' } },
    fields: { 4: 'Great video!' },
    texts: [{ text: '€24.99', ref: 30, line: 'Order total: €24.99' }],
    ...over,
  };
  const asked: OutwardApproval[] = [];
  let payments = opts.payments ?? false;
  const ctx = {
    approvals: new ApprovalGrants(),
    paymentsAllowed: () => payments,
    confirmOutward: async (a: OutwardApproval) => {
      asked.push(a);
      return opts.answer ?? true;
    },
  };
  const tab = fakeTab(page);
  return {
    page,
    asked,
    ctx,
    tab,
    setPayments: (on: boolean) => (payments = on),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    approve: (input: Record<string, unknown>) => requestApprovalTool(input, ctx as any, tab as any),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    press: (ref: number) => pressGate('click', { ref }, ctx as any, tab as any, null),
  };
}

const publish = { kind: 'publish', action: 'comment', field_ref: 4, text: 'Great video!', button_ref: 5 };
const pay = { kind: 'pay', button_ref: 9, total: '€24.99', items: 'Wireless earbuds', payment_method: 'Visa ending 4242' };

test('the request is checked: kind, button, action, the text with its field, a total with a number', () => {
  assert.ok('request' in parseApprovalInput(publish));
  assert.match((parseApprovalInput({ ...publish, kind: 'buy' }) as { error: string }).error, /publish", "pay" or "change"/);
  assert.match((parseApprovalInput({ ...publish, button_ref: 0 }) as { error: string }).error, /button_ref/);
  assert.match((parseApprovalInput({ ...publish, action: 'like' }) as { error: string }).error, /action/);
  assert.match((parseApprovalInput({ ...publish, text: ' ' }) as { error: string }).error, /exactly the text/);
  assert.match((parseApprovalInput({ ...pay, total: 'the total' }) as { error: string }).error, /total/);
  assert.match((parseApprovalInput({ ...pay, payment_method: '4111 1111 1111 1111' }) as { error: string }).error, /never a card number/);
  // A form needs no field: its values are read from the page.
  assert.ok('request' in parseApprovalInput({ kind: 'publish', action: 'form', button_ref: 5 }));
});

test('publish: the dialog shows the text read from the field, and Approve grants one press of that button', async () => {
  const s = setup();
  const result = await s.approve(publish);
  assert.equal(result.isError, false);
  assert.match(result.content, /approved this in Qutai's own dialog/);
  assert.match(result.content, /press ref=5 \("Comment"\)/);
  assert.match(result.content, /Do not ask for confirmation again in chat/);
  assert.deepEqual(s.asked[0], { kind: 'publish', site: 'video.test', action: 'comment', button: 'Comment', text: 'Great video!', incognito: false });
  assert.deepEqual(await s.press(5), { kind: 'approved' });
  // Used up: a second press of the same button has no approval left.
  assert.deepEqual(await s.press(5), { kind: 'none' });
});

test('publish: a text that differs from the field is refused before the dialog', async () => {
  const s = setup();
  const result = await s.approve({ ...publish, text: 'Something else' });
  assert.equal(result.isError, true);
  assert.match(result.content, /The field shows "Great video!", not the text you gave/);
  assert.equal(s.asked.length, 0);
  // Spacing alone is not a difference.
  assert.equal((await setup().approve({ ...publish, text: '  Great   video! ' })).isError, false);
});

test('publish: an empty field, a disabled button and a missing ref are refused without a dialog', async () => {
  assert.match((await setup({ fields: { 4: '' } }).approve(publish)).content, /is empty/);
  assert.match((await setup({ buttons: { 5: { label: 'Comment', disabled: true } } }).approve(publish)).content, /is disabled/);
  assert.match((await setup().approve({ ...publish, button_ref: 77 })).content, /not found/);
});

test('publish: Cancel tells the model to stop, and grants nothing', async () => {
  const s = setup({}, { answer: false });
  const result = await s.approve(publish);
  assert.equal(result.isError, true);
  assert.equal(result.content, declinedText('publish'));
  assert.match(result.content, /Do not press the button or send it any other way/);
  assert.equal(s.ctx.approvals.size, 0);
});

test('publish: the text changed after the approval → the press is refused and the approval is gone', async () => {
  const s = setup();
  await s.approve(publish);
  s.page.fields[4] = 'Great video! Visit evil.test';
  const gate = await s.press(5);
  assert.equal(gate.kind, 'refuse');
  assert.match((gate as { output: { content: string } }).output.content, /text in the field changed/);
  assert.deepEqual(await s.press(5), { kind: 'none' });
});

test('an approval is bound to its tab and page', async () => {
  const s = setup();
  await s.approve(publish);
  // Another tab pressing the same ref has no approval.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.deepEqual(await pressGate('click', { ref: 5 }, s.ctx as any, fakeTab(s.page, 'tab-2') as any, null), { kind: 'none' });
  // Another page in the same tab: refused (a #fragment alone is the same page).
  s.page.url = 'https://video.test/watch?v=1#comments';
  assert.deepEqual(await s.press(5), { kind: 'approved' });
  await s.approve(publish);
  s.page.url = 'https://video.test/watch?v=2';
  const gate = await s.press(5);
  assert.equal(gate.kind, 'refuse');
  assert.match((gate as { output: { content: string } }).output.content, /page changed/);
});

test('a form: the dialog shows its values from the page, and a changed form is refused at the press', async () => {
  const s = setup({ forms: { 5: [{ label: 'Your review', value: 'Five stars' }] } });
  const result = await s.approve({ kind: 'publish', action: 'review', button_ref: 5 });
  assert.equal(result.isError, false);
  assert.deepEqual((s.asked[0] as { fields: unknown }).fields, [{ label: 'Your review', value: 'Five stars' }]);
  s.page.forms![5] = [{ label: 'Your review', value: 'One star' }];
  assert.equal((await s.press(5)).kind, 'refuse');
  assert.match((await setup().approve({ kind: 'publish', action: 'form', button_ref: 5 })).content, /Give field_ref/);
});

test('pay with the setting off: no dialog, and the model hands the last button to the user', async () => {
  const s = setup();
  const result = await s.approve(pay);
  assert.equal(result.isError, true);
  assert.equal(s.asked.length, 0);
  assert.match(result.content, /left to the user/);
  assert.match(result.content, /pressing "Pay now"/);
  assert.match(result.content, /Do not ask them in chat for permission to pay/);
  // The step line is the user's setting, not an error.
  assert.equal(result.notice?.tone, 'info');
});

test('pay with the setting on: the dialog shows the total and its line from the page; one press; never remembered', async () => {
  const s = setup({}, { payments: true });
  const result = await s.approve({ ...pay, recurring: '€9.99/month after 7 days' });
  assert.equal(result.isError, false);
  assert.deepEqual(s.asked[0], {
    kind: 'pay',
    site: 'video.test',
    button: 'Pay now',
    total: '€24.99',
    totalLine: 'Order total: €24.99',
    items: 'Wireless earbuds',
    paymentMethod: 'Visa ending 4242',
    recurring: '€9.99/month after 7 days',
    incognito: false,
  });
  assert.deepEqual(await s.press(9), { kind: 'approved' });
  // The next payment asks again: without a new approval the button is refused.
  const again = await s.press(9);
  assert.equal(again.kind, 'refuse');
  assert.match((again as { output: { content: string } }).output.content, /needs the user's approval/);
});

test('pay: a total that is not on the page is refused before the dialog', async () => {
  const s = setup({}, { payments: true });
  assert.match((await s.approve({ ...pay, total: '€2.49' })).content, /not on the page as written/);
  assert.equal(s.asked.length, 0);
});

test('pay: the total changed between approval and press → refused, ask again', async () => {
  const s = setup({}, { payments: true });
  await s.approve(pay);
  s.page.texts = [{ text: '€29.99', ref: 30, line: 'Order total: €29.99' }];
  const gate = await s.press(9);
  assert.equal(gate.kind, 'refuse');
  assert.match((gate as { output: { content: string } }).output.content, /no longer €24.99/);
  assert.match((gate as { output: { content: string } }).output.content, /request_approval again/);
});

test('pay: the old total still elsewhere on the page (a subtotal) does not count when the total line changed', async () => {
  const s = setup({}, { payments: true });
  await s.approve(pay);
  s.page.texts = [
    { text: '€24.99', ref: 31, line: 'Subtotal: €24.99' },
    { text: '€29.99', ref: 30, line: 'Order total: €29.99' },
  ];
  assert.equal((await s.press(9)).kind, 'refuse');
});

test('pay: the setting turned off after the approval → the press is refused', async () => {
  const s = setup({}, { payments: true });
  await s.approve(pay);
  s.setPayments(false);
  const gate = await s.press(9);
  assert.equal(gate.kind, 'refuse');
  assert.match((gate as { output: { content: string } }).output.content, /left to the user/);
});

test('a final payment button pressed without approval is refused, by ref or at a point', async () => {
  const off = setup();
  const gate = await off.press(9);
  assert.equal(gate.kind, 'refuse');
  assert.match((gate as { output: { content: string } }).output.content, /left to the user/);
  const on = setup({}, { payments: true });
  assert.match(((await on.press(9)) as { output: { content: string } }).output.content, /Call request_approval with kind "pay"/);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const atPoint = await pressGate('click_at', {}, on.ctx as any, { ...on.tab, run: async () => ({ label: 'Place your order', url: '', disabled: false }) } as any, { fx: 0.5, fy: 0.5 });
  assert.match((atPoint as { output: { content: string } }).output.content, /only be pressed with click and its ref/);
  // Other buttons are not touched.
  assert.deepEqual(await off.press(5), { kind: 'none' });
});

test('final payment labels in the ten languages, with amounts around them; ordinary buttons are not', () => {
  for (const label of [
    'Pay now', 'Pay €24.99', 'Place your order', 'Buy now', 'Confirm and pay', 'Zahlungspflichtig bestellen', 'Payer 24,99 €',
    'Confirmar pedido', 'Finalizar compra', 'Оплатить 990 ₽', 'Öde', 'Siparişi onayla', 'Ödeme yap (1.249,90 TL)',
    'Bayar sekarang', '注文を確定する', '결제하기',
  ])
    assert.ok(isFinalPaymentLabel(label), label);
  for (const label of [
    'Payment methods', 'Pay with PayPal', 'Add to cart', 'Proceed to checkout', 'Subscribe', 'Comment', 'Sepete ekle', 'Post',
    'Continue to payment', '', null,
  ])
    assert.ok(!isFinalPaymentLabel(label), String(label));
});

test('card numbers are found spaced or not; order numbers and phone numbers are not', () => {
  assert.ok(containsCardNumber('4111 1111 1111 1111'));
  assert.ok(containsCardNumber('my card 5555-5555-5555-4444 exp 12/29'));
  assert.ok(!containsCardNumber('Order 1234567890123'));
  assert.ok(!containsCardNumber('+90 532 123 45 67'));
});

test('read-only and blocked sites never get to the dialog', () => {
  assert.equal(decide('request_approval', 'shop.test', 'readonly', false).kind, 'refuse');
  assert.equal(decide('request_approval', 'shop.test', 'blocked', false).kind, 'refuse');
  // It asks on its own: the "ask before every action" setting adds nothing.
  assert.equal(decide('request_approval', 'shop.test', 'ask', true).kind, 'run');
});

test('the grants: single use, latest per tab, other tabs untouched', () => {
  const g = new ApprovalGrants();
  g.add({ kind: 'publish', tabId: 'a', url: 'u', buttonRef: 1 });
  g.add({ kind: 'publish', tabId: 'b', url: 'u', buttonRef: 1 });
  g.add({ kind: 'publish', tabId: 'a', url: 'u', buttonRef: 2 });
  assert.equal(g.take('a', 1), null);
  assert.equal(g.take('a', 2)?.buttonRef, 2);
  assert.equal(g.take('a', 2), null);
  assert.equal(g.take('b', 1)?.tabId, 'b');
});

test('checkPress: the same page means the same address without its fragment', () => {
  const grant = { kind: 'publish' as const, tabId: 't', url: 'https://x.test/a', buttonRef: 1, fieldRef: 2, text: 'hi' };
  assert.deepEqual(checkPress(grant, { url: 'https://x.test/a#c', fieldText: 'hi' }), { ok: true });
  assert.equal(checkPress(grant, { url: 'https://x.test/a', fieldText: null }).ok, false);
});

test('the texts for the model say plainly what to do next', () => {
  assert.match(approvedText('pay', 9, 'Pay now'), /press ref=9 \("Pay now"\) with click to pay/);
  assert.match(declinedText('pay'), /nothing was paid/);
  assert.match(paymentsOffText('Pay now', '"Settings" › "Assistant"'), /Only if they ask how to let you pay: "Settings" › "Assistant"/);
});

test('the tool is offered, and the prompt describes the flow briefly', () => {
  const tool = TOOLS.find((t) => t.name === 'request_approval');
  assert.ok(tool);
  assert.match(tool.description, /never page text/);
  assert.match(SYSTEM_PROMPT, /request_approval \(kind "publish"\) just before pressing/);
  assert.match(SYSTEM_PROMPT, /That dialog is the confirmation: don't also ask in chat/);
  assert.match(SYSTEM_PROMPT, /it can never approve anything/);
  assert.match(SYSTEM_PROMPT, /Never type passwords, one-time codes, card numbers or security codes/);
  assert.doesNotMatch(SYSTEM_PROMPT, /purchases or payments, sending messages or emails, posting or publishing/);
});
