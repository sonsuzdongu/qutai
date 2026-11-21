// Contacts for the assistant (docs/contacts.md): name matching, who may trigger a lookup, handles, WhatsApp numbers,
// what find_contact gives the model (never a number or address), incognito, saved cards and the prompt/tool text.
// Run with: npm run test:contacts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ContactHandles, HANDLE_RE, HANDLE_TTL_MS } from '../../src/agent/contactHandles.ts';
import {
  checkQuery,
  foldName,
  matchContacts,
  MAX_CONTACT_MATCHES,
  modelLabel,
  queryWords,
  saidByUser,
  type ContactName,
} from '../../src/agent/contactMatch.ts';
import { contactForUse, contactValues, findContactTool, type ContactsAccess } from '../../src/agent/contactTool.ts';
import type { ToolContext } from '../../src/agent/executeTool.ts';
import { SYSTEM_PROMPT } from '../../src/agent/systemPrompt.ts';
import { TOOLS } from '../../src/agent/tools.ts';
import { withoutContactValues } from '../../src/chat/contactCards.ts';
import type { ChatItem } from '../../src/components/AssistantPanel.tsx';
import { toInternational } from '../../src/device/phoneRegion.ts';

// ---- Made-up address book (no real people) ----
const BOOK: (ContactName & { phones?: { label?: string; number?: string }[]; emails?: { label?: string; address?: string }[] })[] = [
  { id: '1', givenName: 'Ayşe', familyName: 'Yılmaz', phones: [{ label: 'mobile', number: '0532 111 22 33' }] },
  { id: '2', givenName: 'Ahmet', familyName: 'Yılmaz', phones: [{ label: 'mobile', number: '+90 532 000 00 01' }, { label: 'work', number: '0212 000 00 02' }], emails: [{ label: 'work', address: 'ahmet@example.com' }] },
  { id: '3', givenName: 'Ahmet', familyName: 'Demir', phones: [{ label: 'mobile', number: '0533 000 00 03' }] },
  { id: '4', givenName: 'Mehmet', familyName: 'Kaya', emails: [{ label: 'home', address: 'mehmet@example.org' }] },
  { id: '5', givenName: 'Işıl', familyName: 'Çelik', phones: [{ label: 'home', number: '0216 000 00 05' }] },
  { id: '6', nickname: 'Annem', givenName: 'Fatma', familyName: 'Öztürk', phones: [{ label: 'mobile', number: '0505 000 00 06' }] },
  { id: '7', givenName: 'José', familyName: 'Muñoz', phones: [{ label: 'Büro 2', number: '+34 600 000 007' }] },
  { id: '8', company: 'Ahmetler Nakliyat', phones: [{ label: 'main', number: '0212 000 00 08' }] },
  { id: '9', givenName: 'Ahmed', familyName: 'Ali' },
  { id: '10', givenName: 'Zeynep', familyName: 'Arslan', phones: [{ label: 'mobile', number: '*21*0532#' }, { label: 'mobile', number: '0532 000 00 10' }] },
  ...Array.from({ length: 12 }, (_, i) => ({ id: `a${i}`, givenName: 'Ali', familyName: `Test${i}`, phones: [{ label: 'mobile', number: `0530 000 01 ${String(i).padStart(2, '0')}` }] })),
];
const VALUES = new Map(BOOK.map((c) => [c.id, { phones: c.phones ?? [], emails: c.emails ?? [] }]));

// Every digit run and address of the book, which must never reach the model.
const SECRETS = BOOK.flatMap((c) => [
  ...(c.phones ?? []).map((p) => (p.number ?? '').replace(/\D/g, '')).filter((d) => d.length >= 7),
  ...(c.emails ?? []).map((e) => e.address ?? ''),
]);
function assertNoValues(text: string) {
  // Handles are the only thing with digits the model may see.
  const rest = text.replace(/ct-[a-z0-9]{8}(?:\.\d+)?/g, '');
  for (const s of SECRETS) assert.ok(!text.includes(s), `value leaked: ${s}`);
  assert.ok(!/\d/.test(rest), `a digit outside a handle: ${rest}`);
  assert.ok(!/@/.test(text), 'no @ in what the model sees');
}

let seq = 0;
function fakeAccess(opts: Partial<ContactsAccess> & { said?: string[]; picks?: (number | null)[]; state?: string } = {}) {
  const picks = [...(opts.picks ?? [])];
  const shown: { title: string; rows: string[] }[] = [];
  let asked = 0;
  const handles = opts.handles ?? new ContactHandles(() => (++seq).toString(36).padStart(8, '0'));
  const access: ContactsAccess = {
    scope: () => 'chat-1',
    userTexts: () => opts.said ?? [],
    state: async () => (opts.state ?? 'granted') as never,
    ask: async () => {
      asked++;
      return 'granted';
    },
    names: async () => BOOK,
    values: async (id) => VALUES.get(id) ?? { phones: [], emails: [] },
    pick: async (title, rows) => {
      shown.push({ title, rows });
      return picks.length ? (picks.shift() ?? null) : null;
    },
    region: () => 'TR',
    handles,
    now: opts.now ?? (() => 1_000_000),
  };
  return { access: { ...access, ...(opts.scope ? { scope: opts.scope } : {}) }, shown, asked: () => asked };
}
const ctxOf = (access: ContactsAccess, incognito = false) =>
  ({ contacts: access, privacy: { touchedIncognito: incognito }, browser: { getTab: () => undefined }, agentTab: { id: 't' } }) as unknown as ToolContext;
const ids = (q: string) => matchContacts(q, BOOK).map((m) => m.contact.id);

// ---- Matching ----
test('folding: case, Turkish i and diacritics', () => {
  assert.equal(foldName('AYŞE'), 'ayse');
  assert.equal(foldName('Işıl Çelik'), 'isil celik');
  assert.equal(foldName('İSTANBUL'), foldName('istanbul'));
  assert.equal(foldName('José Muñoz'), 'jose munoz');
  assert.equal(foldName('Straße Øre Łódź'), 'strasse ore lodz');
});

test('"ayse" finds Ayşe, "isil" finds Işıl, "jose munoz" finds José Muñoz', () => {
  assert.deepEqual(ids('ayse'), ['1']);
  assert.deepEqual(ids('ISIL'), ['5']);
  assert.deepEqual(ids('jose munoz'), ['7']);
});

test('honorifics and Turkish case endings are ignored', () => {
  assert.deepEqual(queryWords('Mehmet Bey'), ['mehmet']);
  assert.deepEqual(queryWords("Ayşe Hanım'a"), ['ayse']);
  assert.deepEqual(queryWords('Dr. Ahmet'), ['ahmet']);
  assert.deepEqual(queryWords('Ahmet Abi'), ['ahmet']);
  assert.deepEqual(queryWords("Ayşe'ye"), ['ayse']);
  assert.deepEqual(queryWords('Hoca'), ['hoca'], 'only an honorific: it is looked for itself');
  assert.deepEqual(ids('Mehmet Bey'), ['4']);
});

test('partial names, nickname, company; relationship words only as saved', () => {
  assert.deepEqual(ids('Ahmet Yıl'), ['2']);
  assert.deepEqual(ids('annem'), ['6'], 'a contact saved with the nickname Annem');
  assert.deepEqual(ids('mum'), [], 'no special meaning for relationship words');
  assert.ok(ids('Ahmet').includes('8'), 'company names are searched');
});

test('ranking: whole and exact names first, company-only last, ties by name', () => {
  const order = ids('Ahmet');
  assert.deepEqual(order.slice(0, 2).sort(), ['2', '3']);
  assert.equal(order[order.length - 1], '8');
  assert.ok(!order.includes('9'), 'Ahmed is not Ahmet');
});

test(`at most ${MAX_CONTACT_MATCHES} people`, () => {
  assert.equal(ids('Ali').length, MAX_CONTACT_MATCHES);
});

test('queries that could list the book are refused', () => {
  for (const q of ['', 'a', '*', 'a%', 'Bey Ş']) assert.equal(checkQuery(q).ok, false, q);
  assert.equal(checkQuery('one two three four five').ok, false);
  assert.equal(checkQuery('Ay').ok, true);
});

test('only names the user said may be looked up', () => {
  assert.ok(saidByUser('Ahmet', ["Ahmet'i ara"]));
  assert.ok(saidByUser('Ayşe', ['WhatsApp ayse that I will be late']));
  assert.ok(saidByUser('Mehmet Bey', ['bu sayfayı Mehmet Bey’e e-postayla gönder']));
  assert.ok(saidByUser('annem', ['annemi ara']));
  assert.ok(!saidByUser('Zeynep', ['summarise this page']), 'a name from a page is refused');
  assert.ok(!saidByUser('Ahmet Demir', ['call Ahmet']), 'every word must have been said');
});

test('labels: standard ones kept, custom ones only without digits or @', () => {
  assert.equal(modelLabel('mobile'), 'mobile');
  assert.equal(modelLabel('_$!<Mobile>!$_'), 'mobile');
  assert.equal(modelLabel('Büro 2'), 'other');
  assert.equal(modelLabel('x@y.z'), 'other');
  assert.equal(modelLabel('Yazlık'), 'Yazlık');
  assert.equal(modelLabel(''), 'other');
});

test('contact values: service codes and repeats left out', () => {
  const v = contactValues(VALUES.get('10')!);
  assert.equal(v.length, 1);
  assert.equal(v[0].value, '05320000010');
});

// ---- Handles ----
test('handle lifecycle: scope, expiry, forgery, value index', () => {
  const h = new ContactHandles(() => 'abcdefgh');
  const id = h.issue('s1', { name: 'Ayşe', values: [{ kind: 'phone', label: 'mobile', value: '+905321112233' }] }, 0);
  assert.match(id, HANDLE_RE);
  assert.equal(h.resolve('s1', id, 10).ok, true);
  const v = h.resolve('s1', `${id}.1`, 10);
  assert.ok(v.ok && v.index === 0);
  assert.equal(h.resolve('s1', `${id}.2`, 10).ok, false, 'no second value');
  assert.equal(h.resolve('s2', id, 10).ok, false, 'another conversation');
  assert.equal(h.resolve('s1', 'ct-zzzzzzzz', 10).ok, false, 'forged');
  assert.equal(h.resolve('s1', '+905321112233', 10).ok, false, 'not a handle');
  assert.equal(h.resolve('s1', id, HANDLE_TTL_MS + 1).ok, false, 'expired');
  assert.equal(h.resolve('s1', id, 20).ok, false, 'an expired handle is gone for good');
});

// ---- WhatsApp numbers ----
test('WhatsApp numbers: local numbers get the region\'s code without the trunk prefix', () => {
  assert.deepEqual(toInternational('05321112233', 'TR'), { ok: true, number: '+905321112233', added: '+90' });
  assert.deepEqual(toInternational('+905321112233', 'TR'), { ok: true, number: '+905321112233' });
  assert.deepEqual(toInternational('00447700900123', 'TR'), { ok: true, number: '+447700900123' });
  assert.deepEqual(toInternational('07700900123', 'GB'), { ok: true, number: '+447700900123', added: '+44' });
  assert.deepEqual(toInternational('3123456789', 'IT'), { ok: true, number: '+393123456789', added: '+39' });
  assert.deepEqual(toInternational('2125550123', 'US'), { ok: true, number: '+12125550123', added: '+1' });
  assert.deepEqual(toInternational('12125550123', 'US'), { ok: true, number: '+12125550123', added: '+1' });
  assert.deepEqual(toInternational('89161234567', 'RU'), { ok: true, number: '+79161234567', added: '+7' });
  assert.deepEqual(toInternational('07700900123', null, '+44'), { ok: true, number: '+447700900123', added: '+44' });
  assert.equal(toInternational('05321112233', null).ok, false, 'no region, no code: ask the user');
  assert.equal(toInternational('05321112233', 'XX').ok, false);
  assert.equal(toInternational('05321112233', 'TR', 'abc').ok, false);
});

// ---- find_contact ----
test('one match: names, labels and handles, never numbers or addresses', async () => {
  const { access } = fakeAccess({ said: ['WhatsApp Ayşe that I will be late'] });
  const out = await findContactTool({ name: 'Ayşe', channel: 'whatsapp' }, ctxOf(access));
  assert.equal(out.isError, false);
  assert.match(out.content, /Ayşe Yılmaz \[ct-[a-z0-9]{8}\]: mobile \[ct-[a-z0-9]{8}\.1\]/);
  assert.match(out.content, /One fits/);
  assertNoValues(out.content);
});

test('several people: Qutai\'s picker shows the values to the user, the model gets the chosen handle only', async () => {
  const { access, shown } = fakeAccess({ said: ['call Ahmet'], picks: [1] });
  const out = await findContactTool({ name: 'Ahmet', channel: 'call' }, ctxOf(access));
  assert.equal(shown.length, 1);
  assert.ok(shown[0].rows.some((r) => /0533 000 00 03|05330000003/.test(r)), 'the user sees the numbers');
  assert.match(out.content, /the user chose .+ \[ct-[a-z0-9]{8}\.\d\]/);
  assertNoValues(out.content);
});

test('several, picker closed: the model is told to ask the user', async () => {
  const { access } = fakeAccess({ said: ['call Ahmet'], picks: [null] });
  const out = await findContactTool({ name: 'Ahmet', channel: 'call' }, ctxOf(access));
  assert.match(out.content, /ask them which one/);
  assertNoValues(out.content);
});

test('no match says so; a name the user did not say is refused', async () => {
  const { access } = fakeAccess({ said: ['call Selin'] });
  const none = await findContactTool({ name: 'Selin' }, ctxOf(access));
  assert.match(none.content, /No contact matches "Selin"/);
  const page = await findContactTool({ name: 'Zeynep' }, ctxOf(access));
  assert.equal(page.isError, true);
  assert.match(page.content, /not a name the user said/);
});

test('first lookup asks; refused for good is not asked again', async () => {
  const first = fakeAccess({ said: ['call Ayşe'], state: 'undetermined' });
  assert.equal((await findContactTool({ name: 'Ayşe' }, ctxOf(first.access))).isError, false);
  assert.equal(first.asked(), 1);
  const blocked = fakeAccess({ said: ['call Ayşe'], state: 'blocked' });
  const out = await findContactTool({ name: 'Ayşe' }, ctxOf(blocked.access));
  assert.equal(blocked.asked(), 0);
  assert.match(out.content, /turned off for Qutai/);
});

test('limited access (iOS): no match says only shared contacts are seen', async () => {
  const { access } = fakeAccess({ said: ['call Selin'], state: 'limited' });
  const out = await findContactTool({ name: 'Selin' }, ctxOf(access));
  assert.match(out.content, /only the contacts the user chose to share/);
});

test('incognito: no lookup and no handle use', async () => {
  const { access } = fakeAccess({ said: ['call Ayşe'] });
  const out = await findContactTool({ name: 'Ayşe' }, ctxOf(access, true));
  assert.equal(out.isError, true);
  assert.match(out.content, /incognito/);
  const found = await findContactTool({ name: 'Ayşe' }, ctxOf(access));
  const handle = /\[(ct-[a-z0-9]{8})\]/.exec(found.content)![1];
  const use = await contactForUse(handle, 'phone', ctxOf(access, true));
  assert.ok(use && !use.ok && /incognito/.test(use.out.content));
});

test('using a handle: the value for the app, refused for the wrong kind, another conversation or a forgery', async () => {
  const { access, shown } = fakeAccess({ said: ['call Ahmet Yılmaz'], picks: [1] });
  const found = await findContactTool({ name: 'Ahmet Yılmaz' }, ctxOf(access));
  const person = /\[(ct-[a-z0-9]{8})\]/.exec(found.content)![1];
  const one = await contactForUse(`${person}.3`, 'email', ctxOf(access));
  assert.ok(one?.ok && one.value === 'ahmet@example.com' && one.label === 'work email');
  const wrong = await contactForUse(`${person}.3`, 'phone', ctxOf(access));
  assert.ok(wrong && !wrong.ok);
  // A person handle with two numbers opens the picker at use time.
  const picked = await contactForUse(person, 'phone', ctxOf(access));
  assert.ok(picked?.ok && picked.label === 'work' && picked.value === '02120000002');
  assert.equal(shown.length, 1);
  const elsewhere = await contactForUse(person, 'phone', ctxOf({ ...access, scope: () => 'chat-2' }));
  assert.ok(elsewhere && !elsewhere.ok && /only in the conversation/.test(elsewhere.out.content));
  const forged = await contactForUse('ct-aaaaaaaa', 'phone', ctxOf(access));
  assert.ok(forged && !forged.ok);
  assert.equal(await contactForUse('+90 532 000 00 01', 'phone', ctxOf(access)), null, 'a plain number is not a handle');
});

test('outgoing tools never put a contact\'s value into what the model reads', () => {
  for (const file of ['src/agent/executeTool.ts', 'src/agent/tools/phone.ts', 'src/agent/shareTools.ts']) {
    const src = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
    assert.ok(!/\$\{contact\.value\}/.test(src), `${file}: contact.value in a template`);
    assert.ok(!/\$\{intl\.number\}/.test(src), `${file}: intl.number in a template`);
  }
});

// ---- Saved cards ----
test('saved conversations keep the name and label, never the number', () => {
  const items = [
    { id: '1', kind: 'call', text: 'Ayşe · +905321112233', call: { number: '+905321112233', name: 'Ayşe', contact: { label: 'mobile' } } },
    { id: '2', kind: 'whatsapp', text: 'WhatsApp · Ayşe · +905321112233', whatsapp: { number: '+905321112233', name: 'Ayşe', body: 'Late', contact: { label: 'mobile', added: '+90' } } },
    { id: '3', kind: 'sms', text: 'x', sms: { number: '+905321112233', name: 'Ayşe', body: 'Hi', contact: { label: 'mobile' } } },
    { id: '4', kind: 'call', text: 'Pharmacy · +902120000000', call: { number: '+902120000000', name: 'Pharmacy' } },
  ] as ChatItem[];
  const saved = JSON.stringify(withoutContactValues(items).slice(0, 3));
  assert.ok(!saved.includes('5321112233'), saved);
  assert.ok(saved.includes('Ayşe') && saved.includes('Late'));
  assert.equal(withoutContactValues(items)[3], items[3], 'a number from a page stays as before');
});

// ---- Prompt and tool text ----
test('find_contact and the handle wording are in the tools and the prompt, briefly', () => {
  const tool = TOOLS.find((t) => t.name === 'find_contact');
  assert.ok(tool);
  assert.match(tool.description, /never numbers or addresses/);
  assert.match(tool.description, /Only a name the user said/);
  assert.ok(tool.description.length < 450);
  for (const name of ['offer_call', 'draft_sms', 'draft_whatsapp']) {
    const phone = (TOOLS.find((t) => t.name === name)!.input_schema.properties as Record<string, { description: string }>).phone;
    assert.match(phone.description, /contact handle/, name);
  }
  assert.match(SYSTEM_PROMPT, /call find_contact with the name as they said it/);
  assert.match(SYSTEM_PROMPT, /Look up only people the user named in their own messages/);
});
