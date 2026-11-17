/**
 * Page snapshots in read_page's exact format (src/agent/executeTool.ts formatPage + src/browser/pageScript.ts readPage):
 * the header, then one line per block of text, heading or interactive element ([ref=N] kind "label" ...), at most
 * 20,000 characters per call. The text is generated from a fixed word list with a seeded generator, so every run gives
 * the same pages and the same token counts.
 */

const WORDS = (
  'the of and to in a is that for it as was with be by on not he this are or his from at which but have an they ' +
  'you were her she there been one all we their has would when if so no will more about up out who them some could ' +
  'what into than other time only new people year also two may first then do any like my now over such our man me ' +
  'even most made after well where many before must through back years much your way down should because each just ' +
  'those how too little state good very make world still own see men work long get here between both life being under ' +
  'never day same another know while last might us great old off come since against go came right used take three ' +
  'price delivery battery screen camera storage warranty order review customers shipping available colour size ' +
  'government council report minister energy climate prices market growth research university hospital service ' +
  'company students policy average percent million billion measure transport railway airport weather forecast'
).split(' ');

/** A seeded generator (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sentence(r: () => number, min = 8, max = 22): string {
  const n = min + Math.floor(r() * (max - min));
  const words: string[] = [];
  for (let i = 0; i < n; i++) {
    const w = WORDS[Math.floor(r() * WORDS.length)];
    words.push(r() < 0.04 ? String(Math.floor(r() * 2000)) : w);
  }
  const s = words.join(' ');
  return s[0].toUpperCase() + s.slice(1) + (r() < 0.1 ? ',' : '.');
}

export function paragraph(r: () => number, sentences = 4): string {
  return Array.from({ length: sentences }, () => sentence(r)).join(' ');
}

type PageOpts = { tab: string; url: string; title: string; offset?: number; pageHeight?: number };

function header(o: PageOpts, scrollY = 0): string {
  return [
    `Tab: ${o.tab}`,
    `URL: ${o.url}`,
    `Title: ${o.title}`,
    `Scroll: y=${scrollY}, viewport=780, page height=${o.pageHeight ?? 9400}`,
  ].join('\n');
}

/** Cuts body lines at read_page's 20,000 characters and adds its "Content truncated" note. */
function snapshot(o: PageOpts, lines: string[], tool: 'read_page' | 'read_tab' = 'read_page', errors: string[] = []): string {
  const start = o.offset ?? 0;
  const kept: string[] = [];
  let total = 0;
  let i = start;
  for (; i < lines.length; i++) {
    if (total + lines[i].length > 20000) break;
    total += lines[i].length + 1;
    kept.push(lines[i]);
  }
  const more = tool === 'read_tab' ? `read_tab with tab_id=${o.tab} and` : 'read_page with';
  const note = i < lines.length ? `\n[Content truncated. Call ${more} offset=${i} to read the rest.]` : '';
  const errs = errors.length ? `\nForm errors:\n${errors.map((e) => `- ${e}`).join('\n')}` : '';
  return `${header(o)}${errs}\n\n${kept.join('\n')}${note}`;
}

/** Site chrome every page has: a menu, a search field, a dozen navigation links. */
function chrome(r: () => number, refStart: number): string[] {
  const lines = [
    `[ref=${refStart}] button "Menu" (expanded=false)`,
    `[ref=${refStart + 1}] a "Home" href=/`,
    `[ref=${refStart + 2}] input:search "Search" placeholder="Search"`,
  ];
  for (let i = 0; i < 12; i++) {
    const w = sentence(r, 1, 3).replace(/[.,]$/, '');
    lines.push(`[ref=${refStart + 3 + i}] a "${w}" href=/section/${w.toLowerCase().replace(/\s+/g, '-')}`);
  }
  return lines;
}

/** A long news article (about 32,000 characters of body: two read_page calls). */
export function articlePage(seed: number, o: Omit<PageOpts, 'title'> & { title?: string }): { lines: string[]; opts: PageOpts } {
  const r = rng(seed);
  const title = o.title ?? sentence(r, 6, 10).replace(/\.$/, '');
  const lines = [...chrome(r, 1), `# ${title}`, `By ${sentence(r, 2, 3)} Updated 3 hours ago`];
  let ref = 40;
  for (let p = 0; p < 60; p++) {
    if (p % 8 === 0) lines.push(`## ${sentence(r, 3, 7).replace(/\.$/, '')}`);
    lines.push(paragraph(r, 4));
    if (p % 10 === 5) lines.push(`[ref=${ref++}] a "${sentence(r, 4, 9)}" href=https://news.example/story/${seed}-${p}`);
  }
  for (let i = 0; i < 25; i++) lines.push(`[ref=${ref++}] a "${sentence(r, 5, 10)}" href=/related/${seed}-${i}`);
  return { lines, opts: { ...o, title, pageHeight: 21000 } };
}

export function readArticle(seed: number, o: Omit<PageOpts, 'title'>, tool: 'read_page' | 'read_tab' = 'read_page'): string {
  const { lines, opts } = articlePage(seed, o);
  return snapshot({ ...opts, offset: o.offset }, lines, tool);
}

/** A contact / sign-up form with a few validation rules. */
export function formPage(seed: number, state: { values?: Record<string, string>; errors?: string[]; ticked?: boolean } = {}): string {
  const r = rng(seed);
  const v = state.values ?? {};
  const val = (k: string) => (v[k] ? ` value="${v[k]}"` : '');
  const lines = [
    ...chrome(r, 1),
    '# Contact the service team',
    paragraph(r, 3),
    `[ref=20] input:text "Full name" (required)${val('name')} minlength=2`,
    `[ref=21] input:email "Email" (required)${val('email')}${state.errors?.some((e) => e.startsWith('ref=21')) ? ' (invalid: Please include an @ in the email address.)' : ''}`,
    `[ref=22] input:tel "Phone (optional)" pattern=[0-9 +]{6,20}${val('phone')}`,
    `[ref=23] select "Topic" selected="${v.topic ?? 'Choose a topic'}" options=[Choose a topic | Orders | Delivery | Returns | Warranty | Billing | Something else] (required)`,
    `[ref=24] input:text "Order number" pattern=[A-Z]{2}[0-9]{6} hint="Two letters and six digits, e.g. AB123456"${val('order')}`,
    `[ref=25] textarea "Your message" (required) maxlength=2000${val('message')}`,
    `[ref=26] input:checkbox "Send me offers and news by email" ${state.ticked === false ? '(unchecked, was pre-ticked)' : '(checked, pre-ticked)'}`,
    `[ref=27] input:checkbox "I agree to the privacy policy" (unchecked) (required)`,
    `[ref=28] button "Send message"`,
    paragraph(r, 2),
    ...Array.from({ length: 10 }, (_, i) => `[ref=${30 + i}] a "${sentence(r, 2, 4).replace(/\.$/, '')}" href=/help/${i}`),
  ];
  return snapshot({ tab: 't1', url: 'https://shop.example/contact', title: 'Contact us', pageHeight: 3800 }, lines, 'read_page', state.errors ?? []);
}

/** A search-results or product-list page: many short entries with links and prices. */
export function listPage(seed: number, o: Omit<PageOpts, 'title'> & { title: string }, entries = 40, tool: 'read_page' | 'read_tab' = 'read_page'): string {
  const r = rng(seed);
  const lines = [...chrome(r, 1), `# ${o.title}`, `[ref=18] button "Filter"`, `[ref=19] select "Sort by" selected="Relevance" options=[Relevance | Price: low to high | Price: high to low | Rating]`];
  let ref = 30;
  for (let i = 0; i < entries; i++) {
    const name = sentence(r, 3, 7).replace(/\.$/, '');
    lines.push(`[ref=${ref++}] a "${name}" href=https://shop.example/p/${seed}-${i}`);
    lines.push(`${(20 + r() * 400).toFixed(2)} EUR · ${(3 + r() * 2).toFixed(1)} stars · ${Math.floor(r() * 900)} reviews`);
    lines.push(sentence(r, 10, 20));
    lines.push(`[ref=${ref++}] button "Add to basket"`);
  }
  return snapshot({ ...o, pageHeight: 14000 }, lines, tool);
}

/** A product page: specs table, reviews. */
export function productPage(seed: number, o: Omit<PageOpts, 'title'> & { title: string }, tool: 'read_page' | 'read_tab' = 'read_page'): string {
  const r = rng(seed);
  const lines = [...chrome(r, 1), `# ${o.title}`, `${(80 + r() * 300).toFixed(2)} EUR`, `[ref=18] select "Colour" selected="Black" options=[Black | Silver | Blue]`, `[ref=19] button "Add to basket"`];
  lines.push('## Description', paragraph(r, 5), paragraph(r, 5));
  lines.push('## Specifications');
  for (let i = 0; i < 30; i++) lines.push(`${sentence(r, 1, 3).replace(/\.$/, '')}: ${sentence(r, 1, 4).replace(/\.$/, '')}`);
  lines.push('## Reviews');
  for (let i = 0; i < 25; i++) lines.push(`${(1 + Math.floor(r() * 5))} stars · ${sentence(r, 2, 3)}`, paragraph(r, 2));
  return snapshot({ ...o, pageHeight: 12000 }, lines, tool);
}

/** A short confirmation or result page. */
export function shortPage(seed: number, o: Omit<PageOpts, 'title'> & { title: string }): string {
  const r = rng(seed);
  return snapshot({ ...o, pageHeight: 1600 }, [...chrome(r, 1), `# ${o.title}`, paragraph(r, 3), `[ref=20] a "Back to the shop" href=/`]);
}
