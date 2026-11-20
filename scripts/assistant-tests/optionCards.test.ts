// Option cards (show_options; UI-23 to UI-26 in docs/design/27-interface.md): the app's own checks on what the model and
// the page give (links, pictures, text, prices, how many), the picture bytes check, the message's storage and backup
// round trip, and the tool's answer to a malformed call.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  absoluteUrl,
  buildCards,
  cardLabel,
  cardsText,
  checkedOptionItem,
  displayHost,
  MAX_CARDS,
  MAX_TITLE,
  parseOptionsInput,
  plainField,
  priceSeen,
  numberIndex,
  safeHttpsUrl,
  storedCards,
  type OptionCard,
} from '../../src/chat/optionCards.ts';
import { MAX_IMAGE_PIXELS, sniffImage, toBase64 } from '../../src/chat/imageSniff.ts';
import { showOptions } from '../../src/agent/optionsTool.ts';
import { parseBackup, serializeBackup, type BackupPayload } from '../../src/backup/payload.ts';

test('links and pictures: https only, a real domain, no credentials, no spaces, not too long', () => {
  assert.equal(safeHttpsUrl('https://www.trendyol.com/kazak-p-1'), 'https://www.trendyol.com/kazak-p-1');
  assert.equal(safeHttpsUrl('  https://shop.example/a?b=1#c '), 'https://shop.example/a?b=1#c');
  assert.equal(safeHttpsUrl('https://shop.example:8443/x'), 'https://shop.example:8443/x');
  for (const bad of [
    'http://shop.example/a',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'blob:https://shop.example/1',
    'file:///etc/passwd',
    'https://shop.example@evil.example/',
    'https://user:pw@shop.example/',
    'https://192.168.1.1/router',
    'https://localhost/x',
    'https:///nohost',
    'https://shop.example/a b',
    'https://-bad.example/',
    '//shop.example/a',
    `https://shop.example/${'a'.repeat(2100)}`,
    42,
    null,
  ]) {
    assert.equal(safeHttpsUrl(bad), null, String(bad).slice(0, 60));
  }
});

test('the card names the host of its own link (www. dropped, IDN in punycode so look-alikes show)', () => {
  assert.equal(displayHost('https://www.trendyol.com/x'), 'trendyol.com');
  assert.equal(displayHost('https://m.hepsiburada.com/x'), 'm.hepsiburada.com');
  assert.equal(displayHost('https://xn--trndyol-p2a.com/'), 'xn--trndyol-p2a.com');
  const lookAlike = displayHost('https://tr\u0435ndyol.com/'); // Cyrillic е
  assert.ok(lookAlike.startsWith('xn--') && lookAlike.endsWith('.com') && lookAlike !== 'trendyol.com');
  // A title can say anything; the host comes from the link only.
  const { cards } = buildCards([{ title: 'Official Trendyol store', url: 'https://evil.example/p' }], [null], { readTexts: [] });
  assert.equal(cards[0].host, 'evil.example');
});

test('text fields are plain, single-line and cut', () => {
  assert.equal(plainField('  Red\u0000 sweater\n\twool ', 50), 'Red sweater wool');
  assert.equal(plainField('abc‮gnp.exe', 50), 'abc gnp.exe');
  assert.equal(plainField('a​b', 50), 'a b');
  const long = plainField('x'.repeat(500), MAX_TITLE);
  assert.equal(long.length, MAX_TITLE);
  assert.ok(long.endsWith('…'));
  assert.equal(plainField(12, 10), '');
  assert.equal(plainField('**bold** [link](https://x.example)', 100), '**bold** [link](https://x.example)'); // shown as text, never rendered
});

test('a malformed call gets an error the model can act on', () => {
  for (const input of [{}, { options: 'red sweater' }, { options: [] }, { items: [{ title: 'a', url: 'https://a.example' }] }]) {
    const r = parseOptionsInput(input as Record<string, unknown>);
    assert.ok('error' in r, JSON.stringify(input));
  }
  const none = parseOptionsInput({ options: [{ title: 'No link' }, { url: 'https://a.example' }, 'text', null] });
  assert.ok('error' in none && /title and/.test(none.error));
  const ok = parseOptionsInput({ options: [{ title: 'A', ref: 'ref=12' }, { title: 'B', ref: 7.5, url: 'https://b.example' }, { title: 'C', ref: -1 }] });
  assert.ok('requests' in ok);
  assert.deepEqual(ok.requests, [
    { title: 'A', ref: 12 },
    { title: 'B', url: 'https://b.example' },
  ]);
});

test('at most eight cards', () => {
  const options = Array.from({ length: 20 }, (_, i) => ({ title: `Item ${i}`, url: `https://shop.example/p/${i}` }));
  const r = parseOptionsInput({ options });
  assert.ok('requests' in r);
  assert.equal(r.requests.length, MAX_CARDS);
  const built = buildCards(r.requests, [], { readTexts: [] });
  assert.equal(built.cards.length, MAX_CARDS);
  assert.equal(storedCards(Array.from({ length: 20 }, (_, i) => ({ title: 't', url: `https://a.example/${i}` }))).length, MAX_CARDS);
});

test("links: the page's own address wins; a relative link is made absolute; http and duplicates are left out", () => {
  const requests = [
    { title: 'From ref', ref: 3 },
    { title: 'Relative', url: '/kazak-p-2' },
    { title: 'Plain http', url: 'http://shop.example/3' },
    { title: 'Same again', url: 'https://www.trendyol.com/kazak-p-2#reviews' },
    { title: 'Ref not found', ref: 99 },
  ];
  const details = [{ href: 'https://www.trendyol.com/kazak-p-1?boutiqueId=5', image: '', text: '' }, null, null, null, { href: '', image: '' }];
  const { cards, dropped } = buildCards(requests, details, { pageUrl: 'https://www.trendyol.com/sr?q=kazak', readTexts: [] });
  assert.deepEqual(
    cards.map((c) => c.url),
    ['https://www.trendyol.com/kazak-p-1?boutiqueId=5', 'https://www.trendyol.com/kazak-p-2'],
  );
  assert.equal(dropped.length, 2); // http and the ref not found; the duplicate is left out silently
  assert.ok(dropped.some((d) => d.includes('Plain http')));
  assert.ok(dropped.some((d) => d.includes('Ref not found') && d.includes('ref')));
  assert.equal(absoluteUrl('//cdn.example/a.jpg', 'https://shop.example/x'), 'https://cdn.example/a.jpg');
  assert.equal(absoluteUrl('p/1', 'https://shop.example/x'), 'p/1');
});

test('pictures come only from the page, https only', () => {
  const requests = [
    { title: 'A', url: 'https://a.example/1' },
    { title: 'B', url: 'https://a.example/2' },
    { title: 'C', url: 'https://a.example/3' },
  ];
  const details = [
    { href: 'https://a.example/1', image: 'https://img.a.example/1.jpg' },
    { href: 'https://a.example/2', image: 'http://img.a.example/2.jpg' },
    { href: 'https://a.example/3', image: 'data:image/svg+xml,<svg onload=alert(1)>' },
  ];
  const { cards } = buildCards(requests, details, { readTexts: [] });
  assert.equal(cards[0].image, 'https://img.a.example/1.jpg');
  assert.equal(cards[1].image, undefined);
  assert.equal(cards[2].image, undefined);
  // The model has no image field: one it adds anyway is ignored.
  const r = parseOptionsInput({ options: [{ title: 'X', url: 'https://a.example/x', image: 'https://evil.example/pixel.gif' }] });
  assert.ok('requests' in r);
  assert.equal(buildCards(r.requests, [null], { readTexts: [] }).cards[0].image, undefined);
});

test('a price is shown only when its number was in what the task read', () => {
  const read = ['Kırmızı Kazak 4.5 (123) 1.299,99 TL', 'Başka ürün 299 ,90 TL', 'Ücretsiz kargo'];
  const numbers = numberIndex(read);
  const lower = read.join('\n').toLowerCase();
  assert.ok(priceSeen('1.299,99 TL', numbers, lower));
  assert.ok(priceSeen('₺1299.99', numbers, lower));
  assert.ok(priceSeen('299,90 TL', numbers, lower));
  assert.ok(priceSeen('ücretsiz kargo', numbers, lower));
  assert.ok(!priceSeen('999 TL', numbers, lower));
  assert.ok(!priceSeen('1.199,99 TL', numbers, lower));
  assert.ok(!priceSeen('Cheap', numbers, lower));
  const built = buildCards(
    [
      { title: 'A', url: 'https://a.example/1', price: '1.299,99 TL' },
      { title: 'B', url: 'https://a.example/2', price: '79 TL' },
      { title: 'C', url: 'https://a.example/3', price: '450 TL' },
    ],
    [null, null, { href: 'https://a.example/3', text: 'C model 450 TL kargo bedava' }],
    { readTexts: read },
  );
  assert.deepEqual(
    built.cards.map((c) => c.price),
    ['1.299,99 TL', undefined, '450 TL'],
  );
  assert.equal(built.pricesDropped, 1);
});

const card = (over: Partial<OptionCard> = {}): OptionCard => ({
  title: 'Kırmızı kazak',
  url: 'https://www.trendyol.com/kazak-p-1',
  host: 'trendyol.com',
  image: 'https://cdn.dsmcdn.com/1.jpg',
  price: '299,99 TL',
  detail: '4.5 · 1200 reviews',
  ...over,
});

test("the message's text for older versions, and what a screen reader says", () => {
  assert.equal(
    cardsText([card(), card({ title: 'B', price: undefined, host: 'b.example' })]),
    '1. Kırmızı kazak · 299,99 TL · trendyol.com\n2. B · b.example',
  );
  assert.equal(cardLabel(card()), 'Kırmızı kazak, 299,99 TL, 4.5 · 1200 reviews, trendyol.com');
});

test('storage round trip: cards come back as they were; a tampered record is checked again', () => {
  const item = { id: '7', kind: 'options', text: cardsText([card()]), cards: [card()] };
  assert.deepEqual(checkedOptionItem(JSON.parse(JSON.stringify(item))), item);
  const incognito = { ...item, imagesOnTap: true };
  assert.deepEqual(checkedOptionItem(JSON.parse(JSON.stringify(incognito))), incognito);
  const tampered = {
    ...item,
    cards: [
      { ...card(), url: 'javascript:alert(1)' },
      { ...card(), host: 'apple.com', image: 'http://x.example/a.svg', title: 'B‮' },
      'junk',
    ],
    imagesOnTap: 'yes',
  };
  const back = checkedOptionItem(tampered);
  assert.equal(back.cards?.length, 1);
  const { image: _image, ...withoutImage } = card();
  assert.deepEqual(back.cards?.[0], { ...withoutImage, title: 'B' });
  assert.equal('imagesOnTap' in back, false);
  // None left: the item keeps its text line and no cards.
  const empty = checkedOptionItem({ ...item, cards: [{ title: 'x', url: 'http://a.example' }] });
  assert.equal('cards' in empty, false);
  assert.equal(empty.text, item.text);
  // Other kinds are untouched.
  const other = { id: '1', kind: 'assistant', text: 'hi', cards: 'whatever' };
  assert.equal(checkedOptionItem(other), other);
});

test('backup: cards travel with the message and are checked on restore', () => {
  const payload = {
    app: 'qutai',
    payloadVersion: 1,
    createdAt: 1,
    appVersion: '0.1.3',
    schemaVersion: 20,
    chats: [
      {
        key: 'tab-1',
        items: [
          { id: '1', kind: 'user', text: 'bana kırmızı bir kazak bul' },
          { id: '2', kind: 'options', text: cardsText([card()]), cards: [card(), { ...card(), url: 'http://a.example' }], imagesOnTap: true },
        ],
        turns: [],
      },
    ],
  } as unknown as BackupPayload;
  const back = parseBackup(serializeBackup(payload));
  const items = back.chats?.[0].items as unknown as { kind: string; cards?: OptionCard[]; imagesOnTap?: boolean }[];
  assert.equal(items[1].kind, 'options');
  assert.deepEqual(items[1].cards, [card()]);
  assert.equal(items[1].imagesOnTap, undefined);
});

// ---------- Picture bytes ----------

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

function jpeg(width: number, height: number): Uint8Array {
  // SOI, an APP0 segment of 16 bytes, then SOF0 with the size.
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...Array(14).fill(0)];
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 3, ...Array(9).fill(0)];
  return Uint8Array.from([0xff, 0xd8, ...app0, ...sof]);
}

test('pictures must be JPEG, PNG, GIF or WebP by their own bytes, at a sane size', () => {
  assert.deepEqual(sniffImage(png(800, 600)), { format: 'png', mime: 'image/png', width: 800, height: 600 });
  assert.deepEqual(sniffImage(jpeg(1200, 1800)), { format: 'jpeg', mime: 'image/jpeg', width: 1200, height: 1800 });
  const gif = Uint8Array.from([...Buffer.from('GIF89a'), 0x40, 0x01, 0xf0, 0x00, ...Array(10).fill(0)]);
  assert.deepEqual(sniffImage(gif), { format: 'gif', mime: 'image/gif', width: 320, height: 240 });
  const webp = new Uint8Array(30);
  webp.set(Buffer.from('RIFF'), 0);
  webp.set(Buffer.from('WEBPVP8X'), 8);
  webp.set([0xff, 0x01, 0x00, 0xff, 0x01, 0x00], 24); // 512 x 512
  assert.deepEqual(sniffImage(webp), { format: 'webp', mime: 'image/webp', width: 512, height: 512 });
  // Active or unknown formats: never shown.
  assert.equal(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>')), null);
  assert.equal(sniffImage(Buffer.from('<!doctype html><html><body>not a picture</body></html>')), null);
  assert.equal(sniffImage(Buffer.from('\0\0\0 ftypavif\0\0\0\0avifmif1miaf')), null);
  assert.equal(sniffImage(new Uint8Array(4)), null);
  // A decompression bomb: tiny file, huge picture.
  assert.equal(sniffImage(png(20000, 20000)), null);
  assert.ok(20000 * 20000 > MAX_IMAGE_PIXELS);
});

test('base64 matches Node for every length', () => {
  for (let n = 0; n < 40; n++) {
    const bytes = Uint8Array.from({ length: n * 997 }, (_, i) => (i * 31 + n) & 255);
    assert.equal(toBase64(bytes), Buffer.from(bytes).toString('base64'));
  }
});

// ---------- The tool ----------

type FakeTab = { id: string; url: string; incognito: boolean; groupId?: string; asleep: boolean; isNewTab: boolean; run: (cmd: string, args: unknown[]) => Promise<unknown> };

function browserWith(tabs: FakeTab[]) {
  return { tabs, getTab: (id: string) => tabs.find((t) => t.id === id) } as unknown as Parameters<typeof showOptions>[1]['browser'];
}

test('the tool: malformed calls and pages that give nothing end in a clear error, never a crash', async () => {
  const quiet: FakeTab = { id: 'a', url: 'https://shop.example/', incognito: false, asleep: false, isNewTab: false, run: async () => { throw new Error('no page'); } };
  const r1 = await showOptions({ options: 'nope' }, { browser: browserWith([quiet]), agentTabId: 'a', turns: [] });
  assert.equal(r1.isError, true);
  const r2 = await showOptions({ options: [{ title: 'Only a ref', ref: 4 }] }, { browser: browserWith([quiet]), agentTabId: 'a', turns: [] });
  assert.equal(r2.isError, true);
  assert.match(r2.content, /No card could be shown/);
  // No tab at all (closed meanwhile): cards from the model's own https links, without pictures.
  const r3 = await showOptions({ options: [{ title: 'A', url: 'https://a.example/1', price: '10 TL' }] }, { browser: browserWith([]), agentTabId: 'x', turns: [] });
  assert.equal(r3.isError, false);
  assert.deepEqual(r3.cards, [{ title: 'A', url: 'https://a.example/1', host: 'a.example' }]);
  assert.match(r3.content, /1 card \(0 with a picture/);
  assert.match(r3.content, /price was not found/);
});

test('the tool: the page gives links and pictures; other tabs of the group fill in what the agent tab lacks', async () => {
  const asked: unknown[] = [];
  const agent: FakeTab = {
    id: 'a',
    url: 'https://www.trendyol.com/sr?q=kirmizi+kazak',
    incognito: false,
    groupId: 'g',
    asleep: false,
    isNewTab: false,
    run: async (cmd, args) => {
      asked.push([cmd, args]);
      return [
        { href: 'https://www.trendyol.com/kazak-p-1', image: 'https://cdn.dsmcdn.com/1.jpg', text: 'Kırmızı kazak 299,99 TL' },
        { href: '', image: '', text: '' },
      ];
    },
  };
  const other: FakeTab = {
    id: 'b',
    url: 'https://www.hepsiburada.com/kazak-p-2',
    incognito: false,
    groupId: 'g',
    asleep: false,
    isNewTab: false,
    run: async () => [{ href: 'https://www.hepsiburada.com/kazak-p-2', image: 'https://productimages.hepsiburada.net/2.jpg', text: '' }],
  };
  const incognitoTab: FakeTab = { ...other, id: 'c', incognito: true, run: async () => { throw new Error('must not be asked'); } };
  const r = await showOptions(
    { options: [{ title: 'Kırmızı kazak', ref: 12, price: '299,99 TL' }, { title: 'Hepsiburada kazak', url: 'https://www.hepsiburada.com/kazak-p-2' }] },
    { browser: browserWith([agent, other, incognitoTab]), agentTabId: 'a', turns: [] },
  );
  assert.equal(r.isError, false);
  assert.deepEqual(asked, [['optionDetails', [[{ ref: 12, url: undefined }, { ref: undefined, url: 'https://www.hepsiburada.com/kazak-p-2' }]]]]);
  assert.deepEqual(r.cards, [
    { title: 'Kırmızı kazak', url: 'https://www.trendyol.com/kazak-p-1', host: 'trendyol.com', image: 'https://cdn.dsmcdn.com/1.jpg', price: '299,99 TL' },
    { title: 'Hepsiburada kazak', url: 'https://www.hepsiburada.com/kazak-p-2', host: 'hepsiburada.com', image: 'https://productimages.hepsiburada.net/2.jpg' },
  ]);
  assert.match(r.content, /2 cards \(2 with a picture from the page, 1 with a price\)/);
});
