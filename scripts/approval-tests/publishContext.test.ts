// Sending the assistant's own text needs a publish approval (decided 19 Nov 2026): recognised by context (the field
// the assistant typed into, and a press of its form's button, a button in the same composer, or Enter in it), with the
// exceptions for searches, filters, sign-in, codes, quantities and personal details. The page is a stand-in.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enterGate, pressGate, requestApprovalTool } from '../../src/agent/approvalTool.ts';
import {
  ApprovalGrants,
  contentToApprove,
  isPublicText,
  publishEnterFirstText,
  publishFirstText,
  type FieldFacts,
  type PressFacts,
} from '../../src/agent/outwardApproval.ts';
import { nothingComposed, pressContextOf } from './pageFakes.ts';

function field(over: Partial<FieldFacts> = {}): FieldFacts {
  return {
    ref: 4,
    tag: 'textarea',
    type: '',
    editable: false,
    role: '',
    inSearch: false,
    formGet: false,
    loginForm: false,
    autocomplete: '',
    inputMode: '',
    hints: 'add a comment…',
    maxLength: null,
    text: 'Lovely video, thanks!',
    label: 'Add a comment…',
    ...over,
  };
}
const input = (over: Partial<FieldFacts> = {}) => field({ tag: 'input', type: 'text', hints: 'write a message', ...over });

function press(fields: FieldFacts[], over: Partial<PressFacts> = {}): PressFacts {
  return {
    label: 'Send',
    tag: 'button',
    type: 'submit',
    role: '',
    field: false,
    link: false,
    toggle: false,
    fields: fields.map((f) => ({ ...f, sameForm: true, near: false })),
    ...over,
  };
}

test('free text that goes to people counts: a comment box, an editor, a sentence in a one-line chat input', () => {
  assert.ok(isPublicText(field()));
  assert.ok(isPublicText(field({ tag: 'div', editable: true, role: 'textbox' })));
  assert.ok(isPublicText(input({ text: 'See you at eight tonight' })));
  assert.ok(isPublicText(field({ hints: 'message to the shop' })));
});

test('never: search, filter, sign-in, codes, quantities, personal details, delivery notes, short words, empty fields', () => {
  const no: [string, FieldFacts][] = [
    ['type=search', input({ type: 'search', text: 'funny cats compilation' })],
    ['type=email', input({ type: 'email', text: 'someone at example dot com' })],
    ['role=searchbox', field({ role: 'searchbox' })],
    ['role=combobox', input({ role: 'combobox', text: 'running shoes for men' })],
    ['inside role=search', field({ inSearch: true })],
    ['form method=get', field({ formGet: true })],
    ['login form', input({ loginForm: true, text: 'deniz yilmaz the second' })],
    ['autocomplete username', input({ autocomplete: 'username', text: 'deniz yilmaz the second' })],
    ['autocomplete one-time-code', input({ autocomplete: 'one-time-code', text: '123 456 789 012' })],
    ['autocomplete shipping street-address', field({ autocomplete: 'shipping street-address' })],
    ['inputmode numeric', input({ inputMode: 'numeric', text: '12 34 56 78 90 12' })],
    ['hint search', input({ hints: 'search videos', text: 'how to fold a fitted sheet' })],
    ['hint filter', input({ hints: 'filter results', text: 'red running shoes size 42' })],
    ['hint q', input({ hints: 'q', text: 'weather in istanbul tomorrow' })],
    ['hint promo code', input({ hints: 'promo code', text: 'SUMMER 2026 SALE CODE' })],
    ['Turkish hint ara', input({ hints: 'ürün ara', text: 'kırmızı koşu ayakkabısı' })],
    ['Japanese hint 検索', input({ hints: '動画を検索', text: '猫 の 動画 を 見たい です' })],
    ['delivery note at checkout', field({ hints: 'delivery note', text: 'Please leave it with the neighbour' })],
    ['Turkish order note', field({ hints: 'sipariş notu', text: 'Zile basmayın lütfen' })],
    ['short one-line field (maxlength 30)', input({ maxLength: 30, text: 'Deniz from Istanbul here' })],
    ['one word in a one-line input', input({ text: 'okay' })],
    ['under twelve characters', input({ text: 'ok thanks' })],
    ['empty', field({ text: '   ' })],
  ];
  for (const [why, f] of no) assert.equal(isPublicText(f), false, why);
});

test('a press sends the text when its button is in the field’s form or composer; not links, toggles, fields, cancel', () => {
  assert.equal(contentToApprove(press([field()]))?.ref, 4);
  assert.equal(contentToApprove(press([field()], { tag: 'div', role: 'button', type: '' }))?.ref, 4);
  for (const over of [
    { link: true },
    { toggle: true },
    { field: true },
    { type: 'reset' },
    { label: 'Cancel' },
    { label: 'Cancel reply' },
    { label: 'Add emoji' },
    { label: 'Attach a file' },
    { label: 'Bold' },
    { label: 'Vazgeç' },
    { label: 'Abbrechen' },
    { label: 'キャンセル' },
  ] as Partial<PressFacts>[])
    assert.equal(contentToApprove(press([field()], over)), null, JSON.stringify(over));
  // A form with only non-public fields (a name, an email) sends no free text to approve.
  assert.equal(contentToApprove(press([input({ autocomplete: 'name', text: 'Deniz Yilmaz from Istanbul' })])), null);
  // Nothing typed near the button.
  assert.equal(contentToApprove(press([])), null);
  assert.equal(contentToApprove(null), null);
});

test('the refusal texts say exactly what to do next', () => {
  const text = publishFirstText(7, 'Comment', field());
  assert.match(text, /Pressing ref=7 \("Comment"\) would send the text you typed into ref=4 \("Lovely video, thanks!"\)/);
  assert.match(text, /Nothing was pressed\. Call request_approval with kind "publish", field_ref 4, text exactly as the field shows it, and button_ref 7; once approved, press it with click\. Do not ask in chat\./);
  const enter = publishEnterFirstText(23);
  assert.match(enter, /Nothing was typed\. Type it without submit, then call request_approval/);
  assert.match(enter, /or 23 itself when Enter is the only way to send/);
  assert.match(enter, /call type again with the same text and submit true/);
});

// ---------- The gates, with a stand-in page ----------

function setup(facts: { press?: PressFacts | null; enter?: FieldFacts | null; fieldText?: string } = {}) {
  const page = { url: 'https://chat.test/room/1', fieldText: facts.fieldText ?? 'Lovely video, thanks!' };
  const tab = {
    id: 'tab-1',
    incognito: false,
    get url() {
      return page.url;
    },
    async run(command: string) {
      switch (command) {
        case 'pressInfo':
          return { label: facts.press?.label ?? 'Send', url: page.url, disabled: false };
        case 'pressContext':
          return pressContextOf({ label: facts.press?.label ?? 'Send' });
        case 'pressComposed':
          return facts.press ?? nothingComposed('Send');
        case 'enterFacts':
          return facts.enter ?? null;
        case 'fieldText':
          return { text: page.fieldText, secret: false };
        default:
          throw new Error(command);
      }
    },
  };
  const ctx = { approvals: new ApprovalGrants(), paymentsAllowed: () => false, confirmOutward: async () => true };
  return {
    page,
    ctx,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    click: (ref: number) => pressGate('click', { ref }, ctx as any, tab as any, null),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    clickAt: () => pressGate('click_at', {}, ctx as any, tab as any, { fx: 0.5, fy: 0.9 }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    enter: (args: Record<string, unknown>) => enterGate(args, ctx as any, tab as any),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    enterHidden: (args: Record<string, unknown>) => enterGate(args, ctx as any, tab as any, true),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    approve: (args: Record<string, unknown>) => requestApprovalTool(args, ctx as any, tab as any),
  };
}

const out = (g: { kind: string }) => (g as { output: { content: string; notice?: { tone: string } } }).output;

test('pressing Send after typing a comment, without an approval, is refused before anything is pressed', async () => {
  const s = setup({ press: press([field()]) });
  const gate = await s.click(7);
  assert.equal(gate.kind, 'refuse');
  assert.match(out(gate).content, /Call request_approval with kind "publish", field_ref 4/);
  // Shown as a rule, not as a failure.
  assert.equal(out(gate).notice?.tone, 'info');
  // The same at a point (click_at).
  assert.match(out(await s.clickAt()).content, /Pressing the button at that point would send/);
});

test('after the approval the same press goes ahead once; a search box press never asks', async () => {
  const s = setup({ press: press([field()]) });
  const approved = await s.approve({ kind: 'publish', action: 'comment', field_ref: 4, text: 'Lovely video, thanks!', button_ref: 7 });
  assert.equal(approved.isError, false);
  assert.deepEqual(await s.click(7), { kind: 'approved' });
  assert.equal((await s.click(7)).kind, 'refuse');
  const search = setup({ press: press([input({ type: 'search', text: 'funny cats compilation' })]) });
  assert.deepEqual(await search.click(7), { kind: 'none' });
});

test('Enter: refused without an approval, nothing typed; approved with button_ref = the field, once, same text only', async () => {
  const chat = input({ ref: 23, text: '' });
  const s = setup({ enter: chat, fieldText: 'Running ten minutes late, sorry' });
  const refused = await s.enter({ ref: 23, text: 'Running ten minutes late, sorry', submit: true });
  assert.equal(refused.kind, 'refuse');
  assert.match(out(refused).content, /Nothing was typed/);

  const approved = await s.approve({ kind: 'publish', action: 'message', field_ref: 23, text: 'Running ten minutes late, sorry', button_ref: 23 });
  assert.match(approved.content, /press Enter in ref=23: call type with ref=23, the same text and submit true/);
  // Another text is not what the user approved, and the approval is gone after it.
  assert.equal((await s.enter({ ref: 23, text: 'Something else', submit: true })).kind, 'refuse');
  await s.approve({ kind: 'publish', action: 'message', field_ref: 23, text: 'Running ten minutes late, sorry', button_ref: 23 });
  assert.deepEqual(await s.enter({ ref: 23, text: 'Running ten minutes late, sorry', submit: true }), { kind: 'approved' });
  assert.equal((await s.enter({ ref: 23, text: 'Running ten minutes late, sorry', submit: true })).kind, 'refuse');
});

test('Enter in a search box or a short word goes through without asking', async () => {
  const search = setup({ enter: input({ type: 'search' }) });
  assert.deepEqual(await search.enter({ ref: 4, text: 'how to fold a fitted sheet', submit: true }), { kind: 'none' });
  const short = setup({ enter: input() });
  assert.deepEqual(await short.enter({ ref: 4, text: 'ok', submit: true }), { kind: 'none' });
});

test('a hidden saved value is never sent with Enter from a field for free text, approved field or not (PAY-30)', async () => {
  // A comment box, a chat line: refused, whatever the value is (the gate never sees it) and without using an approval.
  for (const facts of [field({ ref: 23, text: '' }), input({ ref: 23, text: '' }), field({ ref: 23, tag: 'div', editable: true, text: '' })]) {
    const s = setup({ enter: facts });
    const gate = await s.enterHidden({ ref: 23, memory: 'm1', submit: true });
    assert.equal(gate.kind, 'refuse', facts.tag);
    assert.match(out(gate).content, /Nothing was typed\. A hidden saved value is never sent with Enter/);
  }
  // An approval for Enter in that field was for the text the user saw, not for a hidden value.
  const s = setup({ enter: input({ ref: 23, text: '' }), fieldText: 'Running ten minutes late, sorry' });
  await s.approve({ kind: 'publish', action: 'message', field_ref: 23, text: 'Running ten minutes late, sorry', button_ref: 23 });
  assert.equal((await s.enterHidden({ ref: 23, memory: 'm1', submit: true })).kind, 'refuse');
  assert.deepEqual(await s.enter({ ref: 23, text: 'Running ten minutes late, sorry', submit: true }), { kind: 'approved' }, 'the approval is still there');
});

test("a hidden saved value with Enter in a form's own field goes on: an ID field, a search, a short field", async () => {
  for (const facts of [
    input({ ref: 9, hints: 'tc kimlik no', maxLength: 11, text: '' }),
    input({ ref: 9, inSearch: true, text: '' }),
    input({ ref: 9, type: 'tel', text: '' }),
    input({ ref: 9, autocomplete: 'name', text: '' }),
  ]) {
    const s = setup({ enter: facts });
    assert.deepEqual(await s.enterHidden({ ref: 9, memory: 'm1', submit: true }), { kind: 'none' }, JSON.stringify(facts));
  }
  // No text field at the ref: type itself fails.
  assert.deepEqual(await setup({ enter: null }).enterHidden({ ref: 9, memory: 'm1', submit: true }), { kind: 'none' });
});
