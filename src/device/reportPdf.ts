import { File, Paths } from 'expo-file-system';
import { marked } from 'marked';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { t } from '../i18n';
import { pdfFileName } from './pdf';

const STYLE = `
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #222; }
  h1, h2, h3 { line-height: 1.25; } h1 { font-size: 18pt; } h2 { font-size: 14pt; margin-top: 18pt; } h3 { font-size: 12pt; }
  a { color: #1460b4; } code { font-family: Menlo, monospace; background: #f1efe8; padding: 0 2pt; }
  pre { background: #f1efe8; padding: 8pt; white-space: pre-wrap; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; } th, td { border: 0.5pt solid #ccc; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  th { background: #f5f4ef; } blockquote { border-left: 3pt solid #e0ddd4; margin: 0; padding-left: 10pt; color: #555; }
  footer { margin-top: 24pt; font-size: 9pt; color: #999; }
`;

/** The report's title: its first heading, or its first line. */
export function reportTitle(markdown: string): string {
  const heading = /^#{1,3}\s+(.+)$/m.exec(markdown)?.[1];
  const first = markdown
    .split('\n')
    .find((l) => l.trim())
    ?.replace(/[#*_`>]/g, '')
    .trim();
  return (heading ?? first ?? '').replace(/[*_`]/g, '').trim().slice(0, 80) || t('report.fallbackTitle');
}

/** A printable HTML document for an answer written in Markdown. Raw HTML in the answer is escaped. */
export function reportHtml(markdown: string, date = new Date()): string {
  const escaped = markdown.replace(/</g, '&lt;');
  const body = marked.parse(escaped, { async: false, gfm: true }) as string;
  const stamp = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(date);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>${body}<footer>${t('report.footer', { date: stamp })}</footer></body></html>`;
}

/** Saves an answer as a PDF and opens the share sheet; the temporary file is removed afterwards. */
export async function shareReportPdf(markdown: string): Promise<void> {
  const printed = await Print.printToFileAsync({
    html: reportHtml(markdown),
    width: 595,
    height: 842,
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
  });
  const fileName = pdfFileName(reportTitle(markdown), '');
  const file = new File(Paths.cache, fileName);
  try {
    await new File(printed.uri).move(file, { overwrite: true });
    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: fileName });
  } finally {
    if (file.exists) file.delete();
  }
}
