/**
 * The text read_pdf returns: a header (where the PDF came from, page count, metadata), the pages' text with page
 * markers, and how to go on. Pure, so it can be exercised outside the app.
 */

export type PageText = { page: number; text: string };

/** Characters of page text in one result (about read_page's size); the rest comes with from_page. */
export const PDF_CHAR_BUDGET = 20_000;
/** A page with fewer visible characters than this has no usable text layer (a scanned image, a chart). */
const MIN_PAGE_CHARS = 15;
/** Pages read_pdf draws as images in one call. */
export const MAX_VIEW_PAGES = 3;

export type PdfTextResult = {
  /** "invoice.pdf" */
  name: string;
  /** Where it came from: "attachment att-…", "the current tab (https://…)", "https://…". */
  origin: string;
  pages: number;
  info: Record<string, string>;
  /** First and last page asked for (already within 1..pages). */
  from: number;
  to: number;
  /** What the reader returned, in order from `from`; it may stop early once the budget is used. */
  read: PageText[];
  /** The model can take images (for the hint about scanned pages). */
  imageInput: boolean;
  /** How to name this source again in a follow-up call, e.g. `attachment_id="att-…"`. */
  again: string;
};

const visible = (text: string) => text.replace(/\s+/g, '').length;

/** "3", "2-5", or a page range as numbers; null when it can't be read. */
export function parsePageRange(input: unknown, pages: number): { from: number; to: number } | null {
  if (input === undefined || input === null || input === '') return { from: 1, to: pages };
  const match = /^\s*(\d+)\s*(?:[-–]\s*(\d+)?\s*)?$/.exec(String(input));
  if (!match) return null;
  const from = Number(match[1]);
  const to = match[2] ? Number(match[2]) : String(input).includes('-') || String(input).includes('–') ? pages : from;
  if (from < 1 || from > pages || to < from) return null;
  return { from, to: Math.min(to, pages) };
}

/** Header lines: source, size, metadata. */
function header(r: PdfTextResult): string[] {
  const lines = [`PDF: ${JSON.stringify(r.name)} (${r.origin})`, `Pages: ${r.pages}`];
  for (const key of ['Title', 'Author', 'Subject', 'CreationDate']) {
    if (r.info[key]) lines.push(`${key}: ${r.info[key]}`);
  }
  return lines;
}

/** The result for the pages read, cut to the budget at a page boundary (a single huge page is cut inside). */
export function formatPdfText(r: PdfTextResult, budget = PDF_CHAR_BUDGET): string {
  const shown: string[] = [];
  let used = 0;
  let last = r.from - 1;
  let cutInside = false;
  const empty: number[] = [];
  for (const p of r.read) {
    if (used > 0 && used + p.text.length > budget) break;
    let text = p.text;
    if (visible(text) < MIN_PAGE_CHARS) {
      empty.push(p.page);
      text = '[No text on this page: probably a scanned image or a picture.]';
    } else if (text.length > budget) {
      text = `${text.slice(0, budget)}\n[The rest of page ${p.page} is cut: it is longer than one read allows.]`;
      cutInside = true;
    }
    shown.push(`--- Page ${p.page} ---\n${text}`);
    used += text.length;
    last = p.page;
  }

  const lines = header(r);
  const scannedHint = r.imageInput
    ? `call read_pdf with ${r.again} and view_pages (up to ${MAX_VIEW_PAGES} page numbers) to look at them as images`
    : "this model can't take images, so tell the user these pages can't be read as text";

  if (empty.length === r.read.length && r.read.length > 0) {
    lines.push(
      '',
      `Pages ${r.from}–${last} have no text layer: this PDF looks scanned (pages are images). To read it, ${scannedHint}.`,
    );
    if (last < r.to) lines.push(`[Pages ${last + 1}–${r.to} were not checked yet.]`);
    return lines.join('\n');
  }

  lines.push(`Showing pages ${r.from}–${last} of ${r.pages}.`, '', ...shown);
  if (empty.length) lines.push('', `[Pages without text: ${empty.join(', ')}. To read them, ${scannedHint}.]`);
  if (last < r.to) {
    lines.push(
      '',
      `[Pages ${last + 1}–${r.to} not shown yet${cutInside ? '' : ' (character limit)'}. Call read_pdf again with ${r.again} and pages="${last + 1}-${r.to}" to continue.]`,
    );
  }
  return lines.join('\n');
}

/** The page numbers to draw: valid, distinct, at most MAX_VIEW_PAGES; null when none is valid. */
export function parseViewPages(input: unknown, pages: number): number[] | null {
  const raw = Array.isArray(input) ? input : typeof input === 'number' || typeof input === 'string' ? [input] : [];
  const list = [...new Set(raw.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n >= 1 && n <= pages))];
  return list.length ? list.slice(0, MAX_VIEW_PAGES) : null;
}
