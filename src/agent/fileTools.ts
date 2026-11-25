import { MODEL_LONG_EDGE, type AttachmentInfo } from '../chat/attachments';
import { MAX_PDF_BYTES, modelImageData, originalFile } from '../device/attachments';
import { fetchPdfData } from '../pdf/fetchPdf';
import { t } from '../i18n';
import { formatPdfText, parsePageRange, parseViewPages, PDF_CHAR_BUDGET } from '../pdf/format';
import { openPdf, PdfReadError, pdfRender, pdfText } from '../pdf/reader';
import type { ToolContext, ToolOutput } from './executeTool';
import { siteKey } from './sitePolicy';
import { settingNotice } from './stepLine';
import { deviceName } from './uiLabels';

/** Tools that work on files: the user's attachments (view_attachment) and PDFs (read_pdf). */

/** An attachment of this conversation by the id the model gives, or an error result listing the ids there are. */
export function findAttachment(
  input: Record<string, unknown>,
  ctx: ToolContext,
  kind: AttachmentInfo['kind'],
): AttachmentInfo | ToolOutput {
  const id = String(input.id ?? input.attachment_id ?? '').trim();
  const all = ctx.attachments?.() ?? [];
  const found = all.find((a) => a.id === id);
  const listed = all.filter((a) => a.kind === kind).map((a) => `${a.id} "${a.name}"`);
  const known = listed.length ? `Attachments of that kind in this conversation: ${listed.join(', ')}.` : 'There are none.';
  if (!found) return { content: `No attachment with id=${id || '(none)'} in this conversation. ${known}`, isError: true };
  if (found.kind !== kind) return { content: `${id} is not ${kind === 'pdf' ? 'a PDF' : 'an image'}. ${known}`, isError: true };
  return found;
}

/** Sends an image the user attached earlier again (its model copy), for one no longer in the history. */
export async function viewAttachmentTool(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  const found = findAttachment(input, ctx, 'image');
  if ('content' in found) return found;
  const data = found.model ? await modelImageData(found.id).catch(() => null) : null;
  if (!data || !found.model)
    return { content: `The image ${found.id} "${found.name}" is no longer on this ${deviceName()}.`, isError: true };
  const size = found.width && found.height ? `${found.width}×${found.height}, ` : '';
  return {
    content: `Image ${found.id} "${found.name}" (${size}shown at ${found.model.width}×${found.model.height}), attached by the user.`,
    isError: false,
    images: [{ mediaType: found.model.mimeType, data }],
  };
}

type PdfSource = {
  /** Identifies the document in the reader (so follow-up calls don't fetch it again). */
  key: string;
  name: string;
  origin: string;
  /** The arguments that name this PDF in a follow-up call. */
  again: string;
  load: () => Promise<string>;
};

/** The tab the agent works in; undefined when the user closed it (never the tab on screen instead). */
function agentTab(ctx: ToolContext) {
  return ctx.browser.getTab(ctx.agentTab.id);
}

const TAB_CLOSED =
  'The tab you were working in was closed, so there is no link or open PDF to read there. Give the url, or call ' +
  'list_tabs and switch_tab to the tab with the PDF.';

/** Where the PDF comes from: an attachment, a link on the page (ref), an address, or the current tab. */
async function pdfSource(input: Record<string, unknown>, ctx: ToolContext): Promise<PdfSource | ToolOutput> {
  if (input.attachment_id !== undefined && input.attachment_id !== '') {
    const found = findAttachment(input, ctx, 'pdf');
    if ('content' in found) return found;
    return {
      key: `att:${found.id}`,
      name: found.name,
      origin: `attachment ${found.id}`,
      again: `attachment_id="${found.id}"`,
      load: async () => {
        const file = originalFile(found.id);
        if (!file) throw new PdfReadError(`The attachment ${found.id} is no longer on this ${deviceName()}.`, 'failed');
        if (file.size > MAX_PDF_BYTES) throw new PdfReadError('The PDF is larger than 30 MB, too large to read here.', 'failed');
        return file.base64();
      },
    };
  }

  const tab = agentTab(ctx);
  if (tab?.incognito && ctx.privacy) ctx.privacy.touchedIncognito = true;
  const hasRef = input.ref !== undefined && input.ref !== null && input.ref !== '';
  let url = typeof input.url === 'string' ? input.url.trim() : '';
  let fromTab = false;
  if (!tab && (hasRef || !url)) return { content: TAB_CLOSED, isError: true };
  if (hasRef && tab) {
    if (tab.isNewTab) return { content: 'No web page is loaded in this tab, so there is no link to read.', isError: true };
    try {
      url = await tab.run<string>('linkHref', [input.ref]);
    } catch (e) {
      return { content: e instanceof Error ? e.message : String(e), isError: true };
    }
  } else if (!url && tab) {
    if (tab.isNewTab) {
      return {
        content: 'No PDF is open: this tab shows the new tab page. Give a url, a link ref or an attachment_id.',
        isError: true,
      };
    }
    url = tab.url;
    fromTab = true;
  }
  if (!/^https?:\/\//i.test(url))
    return { content: `Only http(s) addresses can be read (got ${url.slice(0, 60)}).`, isError: true };
  // The page's own site was checked like any read; the file's site must not be blocked either (read-only is fine).
  const host = siteKey(url);
  if (host && ctx.sites?.levelFor(host) === 'blocked') {
    return {
      content: `The PDF is on ${host}, where the user has blocked Qutai: don't read it. Tell the user if the task needs it.`,
      isError: true,
      notice: settingNotice(t('step.siteBlocked', { host })),
    };
  }
  const incognito = !!tab?.incognito || !!ctx.privacy?.touchedIncognito;
  let name = '';
  return {
    key: `${incognito ? 'i' : 'n'}:${url}`,
    get name() {
      return name || url.split(/[?#]/)[0].split('/').pop() || 'document.pdf';
    },
    origin: fromTab ? `the PDF open in the current tab, ${url}` : url,
    again: `url=${JSON.stringify(url)}`,
    load: async () => {
      const data = await fetchPdfData(tab ?? null, url, fromTab ? 15_000 : 60_000);
      name = data.name;
      return data.base64;
    },
  };
}

function pdfError(e: unknown, source: PdfSource, ctx: ToolContext): ToolOutput {
  if (e instanceof PdfReadError) {
    if (e.reason === 'password')
      return { content: `${source.name} is protected with a password, so it can't be read. Tell the user.`, isError: true };
    if (e.reason === 'invalid' && source.origin.startsWith('the PDF open'))
      return { content: 'The current page is not a PDF. Use read_page to read it.', isError: true };
    if (e.reason === 'unavailable') {
      const hint = ctx.imageInput === false ? '' : ' If the PDF is open in the tab, view_screenshot can show its visible page.';
      return { content: `${e.message}${hint}`, isError: true };
    }
    return { content: e.message, isError: true };
  }
  return { content: `The PDF could not be read: ${e instanceof Error ? e.message : String(e)}`, isError: true };
}

/**
 * read_pdf: the text of a PDF, page by page with page markers, read on the phone with PDF.js (a hidden WebView,
 * src/pdf/reader.ts), or chosen pages drawn as images for scanned PDFs. The text is page content: untrusted, like
 * read_page's.
 */
export async function readPdfTool(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  const source = await pdfSource(input, ctx);
  if ('content' in source) return source;
  try {
    const doc = await openPdf(source.key, source.load);
    if (input.view_pages !== undefined && input.view_pages !== null) {
      if (ctx.imageInput === false) {
        return {
          content: "This model can't take images, so the pages can't be shown. Tell the user these pages have no text.",
          isError: true,
        };
      }
      const pages = parseViewPages(input.view_pages, doc.pages);
      if (!pages) return { content: `view_pages takes page numbers from 1 to ${doc.pages}.`, isError: true };
      const images = await pdfRender(source.key, pages, MODEL_LONG_EDGE);
      return {
        content:
          `PDF: ${JSON.stringify(source.name)} (${source.origin}), ${doc.pages} page${doc.pages === 1 ? '' : 's'}. ` +
          `Page${images.length === 1 ? '' : 's'} ${images.map((i) => i.page).join(', ')} as image${images.length === 1 ? '' : 's'}, in that order.`,
        isError: false,
        images: images.map((i) => ({ mediaType: 'image/jpeg' as const, data: i.data })),
      };
    }
    const range = parsePageRange(input.pages, doc.pages);
    if (!range) {
      return {
        content: `pages must be one page or a range such as "3" or "2-5", within 1–${doc.pages} (this PDF has ${doc.pages}).`,
        isError: true,
      };
    }
    const read = await pdfText(source.key, range.from, range.to, PDF_CHAR_BUDGET);
    return {
      content: formatPdfText({
        name: source.name,
        origin: source.origin,
        pages: doc.pages,
        info: doc.info,
        from: range.from,
        to: range.to,
        read,
        imageInput: ctx.imageInput !== false,
        again: source.again,
      }),
      isError: false,
    };
  } catch (e) {
    return pdfError(e, source, ctx);
  }
}
