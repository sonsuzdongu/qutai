import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Tab } from '../browser/Tab';
import { t } from '../i18n';
import { pieceBase64, withFullPage } from './fullPage';

export type Snapshot = {
  title: string;
  url: string;
  images: number;
  inlined: number;
  failed: number;
  html: string;
};

// A4 at 72 PPI.
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

export type PdfResult = { pages: number; fileName: string; imagesMissing: number };

/** Turns a page title into a safe, readable file name. */
export function pdfFileName(title: string, url: string): string {
  const fallback = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return t('pdf.fallbackName');
    }
  })();
  const base = (title || fallback)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${base || t('pdf.fallbackName')}.pdf`;
}

/** Opens the system print dialog (AirPrint on iOS) for the current page. */
export async function printPage(tab: Tab): Promise<void> {
  const snapshot = await tab.run<Snapshot>('snapshotHtml', [], 60000);
  await Print.printAsync({ html: snapshot.html, width: PAGE_WIDTH, height: PAGE_HEIGHT });
}

/**
 * Renders the current page to an A4 PDF and opens the share sheet, from which the
 * user can save it to Files or send it. The temporary file is removed afterwards,
 * so nothing from incognito tabs stays on the device.
 */
export async function savePagePdf(tab: Tab): Promise<PdfResult> {
  // Snapshotting fetches images, so it gets more time than ordinary page commands.
  const snapshot = await tab.run<Snapshot>('snapshotHtml', [], 60000);

  const printed = await Print.printToFileAsync({
    html: snapshot.html,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    margins: { top: 34, bottom: 34, left: 28, right: 28 },
  });

  const fileName = pdfFileName(snapshot.title, snapshot.url);
  const file = new File(Paths.cache, fileName);
  try {
    await new File(printed.uri).move(file, { overwrite: true });
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: fileName,
    });
  } finally {
    if (file.exists) file.delete();
  }

  return { pages: printed.numberOfPages, fileName, imagesMissing: snapshot.failed };
}

/** Escapes text for an HTML attribute or element. */
function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/**
 * The other way to make a PDF, for pages the HTML snapshot gets wrong (content drawn by
 * scripts, canvas, maps): the page is captured screen by screen and each screen becomes one
 * PDF page whose size matches the screen's shape, so nothing is cut in the middle of a line.
 * Images are inlined as data URIs, which expo-print supports on both platforms (iOS can't
 * load local files from print HTML). Shared like the ordinary PDF; temporary files are removed.
 */
export async function savePdfFromScreenshots(tab: Tab): Promise<PdfResult & { truncated: boolean }> {
  const title = tab.title;
  const url = tab.url;
  // The capture overlay stays up while the PDF is made, and goes before the share sheet opens.
  const { printed, truncated } = await withFullPage(tab, async (capture) => {
    const pageHeight = Math.round((PAGE_WIDTH * capture.height) / capture.width);
    const pages: string[] = [];
    for (const piece of capture.pieces) {
      const base64 = await pieceBase64(piece, capture.width, capture.height);
      pages.push(`<div class="page"><img src="data:image/jpeg;base64,${base64}"></div>`);
    }
    const html =
      '<!DOCTYPE html><html><head><meta charset="utf-8">' +
      `<title>${escapeHtml(title || url)}</title><style>` +
      `@page { size: ${PAGE_WIDTH}px ${pageHeight}px; margin: 0; }` +
      'html, body { margin: 0; padding: 0; background: #fff; }' +
      // A hair under the page height so rounding never spills onto an empty extra page.
      `.page { width: ${PAGE_WIDTH}px; height: ${pageHeight - 1}px; overflow: hidden; page-break-after: always; break-after: page; }` +
      '.page:last-child { page-break-after: auto; break-after: auto; }' +
      `img { display: block; width: ${PAGE_WIDTH}px; height: auto; }` +
      `</style></head><body>${pages.join('')}</body></html>`;

    const printed = await Print.printToFileAsync({
      html,
      width: PAGE_WIDTH,
      height: pageHeight,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    return { printed, truncated: capture.truncated };
  });

  const fileName = pdfFileName(title, url);
  const file = new File(Paths.cache, fileName);
  try {
    await new File(printed.uri).move(file, { overwrite: true });
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: fileName,
    });
  } finally {
    if (file.exists) file.delete();
    const original = new File(printed.uri);
    if (original.exists) original.delete();
  }
  return { pages: printed.numberOfPages, fileName, imagesMissing: 0, truncated };
}
