import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Tab } from '../browser/Tab';

type Snapshot = {
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
      return 'sayfa';
    }
  })();
  const base = (title || fallback)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${base || 'sayfa'}.pdf`;
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
