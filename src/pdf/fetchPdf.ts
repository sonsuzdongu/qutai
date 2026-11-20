import type { Tab } from '../browser/Tab';
import { MAX_PDF_BYTES } from '../device/attachments';
import { fileNameFromDisposition, fileNameFromUrl } from '../device/download';
import { parseDataUrl } from '../device/saveImage';
import { PdfReadError } from './reader';
import { shownHost } from '../utils/webUrl';

/**
 * Fetches a PDF to read it, the way downloads go but into memory only (nothing is written to the phone, nothing
 * lands in Downloads): first through the tab's page, so the site's cookies come along and PDFs behind a login work
 * (the same `fileData` command the iOS download path uses); if the page can't (another site's file refused by CORS,
 * or no page script, e.g. a PDF shown by iOS's own viewer), directly. On Android a direct request carries the
 * WebView's cookies too (React Native shares the WebView's cookie store there); on iOS it goes without them.
 */
export async function fetchPdfData(tab: Tab | null, url: string, pageTimeoutMs: number): Promise<{ base64: string; name: string }> {
  let name = fileNameFromUrl(url, 'document.pdf');
  let base64: string | null = null;
  if (tab && !tab.isNewTab) {
    const data = await tab.run<string>('fileData', [url], pageTimeoutMs).catch(() => null);
    const parsed = data ? parseDataUrl(data) : null;
    if (parsed && looksLikePdf(parsed.base64)) base64 = parsed.base64;
  }
  if (!base64) {
    const direct = await fetchDirect(url);
    base64 = direct.base64;
    if (direct.name) name = direct.name;
  }
  if (base64.length * 0.75 > MAX_PDF_BYTES) throw new PdfReadError('The PDF is larger than 30 MB, too large to read here.', 'failed');
  if (!/\.pdf$/i.test(name)) name = `${name}.pdf`;
  return { base64, name };
}

/** "%PDF-" within the first kilobyte (some files have a few bytes before it). */
export function looksLikePdf(base64: string): boolean {
  try {
    return atob(base64.slice(0, 1368)).includes('%PDF-');
  } catch {
    return false;
  }
}

async function fetchDirect(url: string): Promise<{ base64: string; name: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    let res: Response;
    try {
      res = await fetch(url, { credentials: 'include', signal: controller.signal });
    } catch {
      throw new PdfReadError(`The PDF could not be fetched from ${hostOf(url)}.`, 'failed');
    }
    if (!res.ok) throw new PdfReadError(`The server answered ${res.status} for the PDF.`, 'failed');
    const length = Number(res.headers.get('content-length'));
    if (Number.isFinite(length) && length > MAX_PDF_BYTES)
      throw new PdfReadError('The PDF is larger than 30 MB, too large to read here.', 'failed');
    const type = res.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > MAX_PDF_BYTES) throw new PdfReadError('The PDF is larger than 30 MB, too large to read here.', 'failed');
    const base64 = toBase64(bytes);
    if (!looksLikePdf(base64)) {
      throw new PdfReadError(
        `The address did not return a PDF${type ? ` (it returned ${type})` : ''}. If it is a web page, use read_page.`,
        'invalid',
      );
    }
    return { base64, name: fileNameFromDisposition(res.headers.get('content-disposition')) };
  } finally {
    clearTimeout(timer);
  }
}

const hostOf = (url: string) => shownHost(url) ?? url;

/** Base64 of bytes, in pieces whose size is a multiple of 3 so they join into one valid string. */
export function toBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  const step = 3 * 8192;
  for (let i = 0; i < bytes.length; i += step) {
    const chunk = bytes.subarray(i, i + step);
    let bin = '';
    for (let j = 0; j < chunk.length; j++) bin += String.fromCharCode(chunk[j]);
    parts.push(btoa(bin));
  }
  return parts.join('');
}
