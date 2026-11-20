/**
 * What an option card's picture really is, from its first bytes (never the server's Content-Type alone): JPEG, PNG,
 * GIF or WebP, and its size in pixels. Anything else (SVG, HTML, AVIF, HEIC, a script) is refused, and so is a
 * picture whose pixel count would need a lot of memory to decode. Pure (scripts/assistant-tests/optionCards.test.ts).
 */

export type ImageFormat = 'jpeg' | 'png' | 'gif' | 'webp';
export type ImageInfo = { format: ImageFormat; mime: string; width: number; height: number };

/** About 6000 x 4000: enough for any product photo, small enough to decode safely on a phone. */
export const MAX_IMAGE_PIXELS = 24_000_000;

const MIME: Record<ImageFormat, string> = { jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    // Start of frame (baseline, progressive, ...): not DHT (C4), JPG (C8) or DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: u16be(b, i + 5), width: u16be(b, i + 7) };
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    i += 2 + u16be(b, i + 2);
  }
  return null;
}

function webpSize(b: Uint8Array): { width: number; height: number } | null {
  const chunk = ascii(b, 12, 4);
  if (chunk === 'VP8 ' && b.length >= 30) return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  if (chunk === 'VP8L' && b.length >= 25) {
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X' && b.length >= 30) return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  return null;
}

/** The picture's format and size, or null when it is not an acceptable picture. */
export function sniffImage(bytes: Uint8Array): ImageInfo | null {
  const b = bytes;
  if (b.length < 16) return null;
  let format: ImageFormat | null = null;
  let size: { width: number; height: number } | null = null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    format = 'jpeg';
    size = jpegSize(b);
  } else if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a && b.length >= 24) {
    format = 'png';
    size = { width: u32be(b, 16), height: u32be(b, 20) };
  } else if (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a') {
    format = 'gif';
    size = { width: u16le(b, 6), height: u16le(b, 8) };
  } else if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    format = 'webp';
    size = webpSize(b);
  }
  if (!format || !size || size.width < 1 || size.height < 1) return null;
  if (size.width * size.height > MAX_IMAGE_PIXELS) return null;
  return { format, mime: MIME[format], ...size };
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 of the bytes, for a data: address (no Buffer or btoa needed). */
export function toBase64(bytes: Uint8Array): string {
  const out: string[] = [];
  let chunk = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    chunk +=
      B64[(n >> 18) & 63] +
      B64[(n >> 12) & 63] +
      (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') +
      (i + 2 < bytes.length ? B64[n & 63] : '=');
    if (chunk.length >= 8192) {
      out.push(chunk);
      chunk = '';
    }
  }
  out.push(chunk);
  return out.join('');
}
