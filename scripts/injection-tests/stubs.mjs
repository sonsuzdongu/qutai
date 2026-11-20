// Stand-ins for the app modules that only talk to native code (./loader.mjs).
export const STUBBED = {
  '/src/pdf/reader.ts': `
    export class PdfReadError extends Error { constructor(message, reason) { super(message); this.reason = reason; } }
    const open = new Map();
    function find(key) {
      const all = globalThis.__qutaiPdfs || {};
      const id = key.replace(/^(att|[in]):/, '');
      return all[id] || null;
    }
    export function readerMounted() { return true; }
    export function subscribeReader() { return () => {}; }
    export function attachReaderWebView() {}
    export function handleReaderMessage() { return false; }
    export function readerFailed() {}
    export async function openPdf(key, load) {
      await load();
      const pdf = find(key);
      if (!pdf) throw new PdfReadError('The file is not a PDF.', 'invalid');
      open.set(key, pdf);
      return { pages: pdf.pages.length, info: pdf.info || {} };
    }
    export async function pdfText(key, from, to) {
      const pdf = open.get(key);
      return pdf.pages.slice(from - 1, to).map((text, i) => ({ page: from + i, text }));
    }
    export async function pdfRender() { throw new PdfReadError('Rendering is not available in the measurement.', 'unavailable'); }
    export function closePdf() {}
  `,
  '/src/pdf/fetchPdf.ts': `
    export async function fetchPdfData(tab, url) {
      if (!(globalThis.__qutaiPdfs || {})[url]) throw new Error('Not a PDF: ' + url);
      return { base64: 'JVBERi0=', name: url.split(/[?#]/)[0].split('/').pop() || 'document.pdf' };
    }
    export function looksLikePdf() { return true; }
    export function toBase64() { return ''; }
  `,
  '/src/device/attachments.ts': `
    export class AttachmentError extends Error {}
    export const MAX_PDF_BYTES = 30000000;
    export function originalFile(id) { return { size: 1000, base64: async () => 'JVBERi0=' }; }
    export function modelFile() { return null; }
    export function attachmentAvailable() { return true; }
    export async function modelImageData() { return null; }
    export async function manipulator() { throw new Error('unavailable'); }
    export async function makeModelCopy() { throw new Error('unavailable'); }
    export async function pickImages() { return []; }
    export async function takePhoto() { return null; }
    export async function pickPdf() { return null; }
    export function importFile() { throw new Error('unavailable'); }
    export async function storeEditedImage() { throw new Error('unavailable'); }
    export function storeMadePdf() { throw new Error('unavailable'); }
    export function deleteAttachment() {}
    export function pruneAttachments() {}
    export function forgetIncognitoAttachments() {}
    export async function shareAttachment() {}
    export async function saveAttachmentToFolder() { return false; }
    export async function saveImageFileToPhotos() { return ''; }
    export async function saveAttachmentToPhotos() { return ''; }
  `,
};
