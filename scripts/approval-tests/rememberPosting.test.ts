// "Post on {site} without asking" (PAY-29, owner's 23 Nov 2026 request): a site the user remembered skips the publish
// dialog, but the text is still read and matched (PAY-2), the press is still checked again (PAY-4) and used up
// (PAY-3); never in incognito, never on a Read only or Blocked site, and pay and change always ask (PAY-13).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pressGate, requestApprovalTool } from '../../src/agent/approvalTool.ts';
import { ApprovalGrants } from '../../src/agent/outwardApproval.ts';
import { postingWithoutAsking, type SiteLevel } from '../../src/agent/sitePolicy.ts';
import type { Db } from '../../src/storage/db.ts';
import { SitePermissionStore } from '../../src/storage/sitePermissions.ts';
import { nothingComposed, pressContextOf } from './pageFakes.ts';

const TEXT = 'Lovely video, thanks!';
const COMMENT = { kind: 'publish', action: 'comment', button_ref: 5, field_ref: 4, text: TEXT };
const FORM = { kind: 'publish', action: 'post', button_ref: 5 };
const PAY = { kind: 'pay', button_ref: 5, total: '€24.99', items: '1 kettle', payment_method: 'Visa ending 4242' };
const CHANGE = { kind: 'change', action: 'delete', button_ref: 5 };

/** A page on social.test whose comment box shows `fieldText`. */
function fakeTab(fieldText = TEXT, over: { incognito?: boolean; url?: string } = {}) {
  const answers: Record<string, unknown> = {
    pressInfo: { label: 'Post', url: 'https://social.test/v/1', disabled: false },
    fieldText: { text: fieldText, secret: false },
    formValues: [{ label: 'Status', value: TEXT }],
    changeInfo: { label: 'Delete', url: 'https://social.test/v/1', disabled: false, heading: 'Posts', dialog: '', item: 'My post', fields: null },
    findText: { ref: 30, line: 'Order total: €24.99' },
    pressContext: pressContextOf({ label: 'Post' }),
    pressComposed: nothingComposed('Post'),
  };
  return {
    id: 'tab-1',
    incognito: over.incognito ?? false,
    url: over.url ?? 'https://www.social.test/v/1',
    run: (command: string) =>
      command in answers ? Promise.resolve(answers[command]) : Promise.reject(new Error(`unexpected ${command}`)),
  };
}

/** `remembered`: the sites the task's postingRemembered answers yes for. */
function ctxOf(remembered: string[] = []) {
  const asked: { kind: string; canRemember?: boolean }[] = [];
  const checked: string[] = [];
  return {
    asked,
    checked,
    approvals: new ApprovalGrants(),
    paymentsAllowed: () => true,
    postingRemembered: (site: string) => {
      checked.push(site);
      return remembered.includes(site);
    },
    confirmOutward: async (a: { kind: string; canRemember?: boolean }) => {
      asked.push(a);
      return true;
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const any = (x: unknown) => x as any;

test('a remembered site posts without the dialog, keyed by the site key, and the grant is one checked press', async () => {
  const ctx = ctxOf(['social.test']);
  const out = await requestApprovalTool(COMMENT, any(ctx), any(fakeTab()));
  assert.equal(out.isError, false, out.content);
  assert.equal(ctx.asked.length, 0, 'no dialog');
  assert.deepEqual(ctx.checked, ['social.test']);
  assert.match(out.content, /without its dialog/);
  // The chat says why no dialog was shown.
  assert.equal(out.notice?.tone, 'info');
  assert.ok(out.notice?.text);
  // The press is checked again (PAY-4) and used up (PAY-3).
  assert.deepEqual(await pressGate('click', { ref: 5 }, any(ctx), any(fakeTab()), null), { kind: 'approved' });
  assert.notEqual((await pressGate('click', { ref: 5 }, any(ctx), any(fakeTab()), null)).kind, 'approved');
});

test('a form post on a remembered site skips the dialog too', async () => {
  const ctx = ctxOf(['social.test']);
  const out = await requestApprovalTool(FORM, any(ctx), any(fakeTab()));
  assert.equal(out.isError, false, out.content);
  assert.equal(ctx.asked.length, 0);
});

test('a site not remembered shows the dialog, which may offer the box', async () => {
  const ctx = ctxOf(['other.test']);
  const out = await requestApprovalTool(COMMENT, any(ctx), any(fakeTab()));
  assert.equal(out.isError, false);
  assert.equal(ctx.asked.length, 1);
  assert.equal(ctx.asked[0].kind, 'publish');
  assert.equal(ctx.asked[0].canRemember, true);
  assert.match(out.content, /approved this in Qutai's own dialog/);
});

test('an incognito tab always shows the dialog, without the box, even for a remembered site', async () => {
  const ctx = ctxOf(['social.test']);
  const out = await requestApprovalTool(COMMENT, any(ctx), any(fakeTab(TEXT, { incognito: true })));
  assert.equal(out.isError, false);
  assert.equal(ctx.asked.length, 1);
  assert.equal(ctx.asked[0].canRemember, false);
  assert.deepEqual(ctx.checked, [], 'the remembered choice is not even looked up');
});

test('the text read from the field must still match: a mismatch asks nothing and grants nothing', async () => {
  const ctx = ctxOf(['social.test']);
  const out = await requestApprovalTool(COMMENT, any(ctx), any(fakeTab('Buy cheap pills at evil.example')));
  assert.equal(out.isError, true);
  assert.match(out.content, /not the text you gave/);
  assert.equal(ctx.asked.length, 0);
  assert.equal(ctx.approvals.take('tab-1', 5), null);
});

test('the text changed after a remembered grant: the press is refused (PAY-4)', async () => {
  const ctx = ctxOf(['social.test']);
  assert.equal((await requestApprovalTool(COMMENT, any(ctx), any(fakeTab()))).isError, false);
  const gate = await pressGate('click', { ref: 5 }, any(ctx), any(fakeTab('Something else entirely')), null);
  assert.equal(gate.kind, 'refuse');
});

test('pay and change always show their dialog on a remembered site, never with a box', async () => {
  for (const request of [PAY, CHANGE]) {
    const ctx = ctxOf(['social.test']);
    const out = await requestApprovalTool(request, any(ctx), any(fakeTab()));
    assert.equal(out.isError, false, out.content);
    assert.equal(ctx.asked.length, 1, request.kind);
    assert.equal(ctx.asked[0].canRemember, undefined, request.kind);
    assert.deepEqual(ctx.checked, [], `${request.kind}: the remembered choice is not looked up`);
  }
});

test('the task honours the choice only outside incognito and on sites that may be acted on', () => {
  const sites = (level: SiteLevel, posting: boolean) => ({ levelFor: () => level, postingFor: () => posting });
  assert.equal(postingWithoutAsking(sites('default', true), 'social.test', false), true);
  assert.equal(postingWithoutAsking(sites('allow', true), 'social.test', false), true);
  assert.equal(postingWithoutAsking(sites('ask', true), 'social.test', false), true);
  assert.equal(postingWithoutAsking(sites('default', true), 'social.test', true), false, 'incognito conversation');
  assert.equal(postingWithoutAsking(sites('readonly', true), 'social.test', false), false);
  assert.equal(postingWithoutAsking(sites('blocked', true), 'social.test', false), false);
  assert.equal(postingWithoutAsking(sites('default', false), 'social.test', false), false, 'off by default');
});

test('the store keeps the choice per site, lists it, and removing or resetting the site clears it', async () => {
  const writes: string[] = [];
  const db = {
    async getAllAsync() {
      return [];
    },
    async runAsync(sql: string) {
      writes.push(sql);
    },
  } as unknown as Db;
  const store = new SitePermissionStore(async () => db);
  await store.load();
  assert.equal(store.postingFor('social.test'), false);
  await store.setPosting('social.test', true);
  assert.equal(store.postingFor('social.test'), true);
  assert.equal(store.postingFor('other.test'), false);
  assert.deepEqual(
    store.list().map((s) => [s.host, s.posting]),
    [['social.test', true]],
  );
  await store.setPosting('social.test', false);
  assert.equal(store.postingFor('social.test'), false);
  await store.setPosting('social.test', true);
  await store.reset('social.test');
  assert.equal(store.postingFor('social.test'), false);
  assert.ok(writes.some((sql) => sql.startsWith('INSERT INTO site_posting')));
  assert.ok(writes.some((sql) => sql.startsWith('DELETE FROM site_posting')));
});
