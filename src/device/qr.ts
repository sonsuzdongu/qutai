import createQr from 'qrcode-generator';

/** QR code modules (true = dark) for a text, UTF-8 encoded, medium error correction. */
export function qrMatrix(text: string): boolean[][] {
  const factory = createQr;
  // The library's ES build (what Metro loads) has no UTF-8 encoder and its default keeps only the
  // low byte of each character, so it gets one of its own.
  factory.stringToBytes = utf8Bytes;
  const code = factory(0, 'M');
  code.addData(text);
  code.make();
  const size = code.getModuleCount();
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => code.isDark(row, col)));
}

/** What a scanned code should do: open a web address, or search for anything else. */
export function scannedTarget(data: string): { kind: 'url' | 'search'; value: string } {
  const text = data.trim();
  if (/^https?:\/\/\S+$/i.test(text)) return { kind: 'url', value: text };
  return { kind: 'search', value: text };
}

/** UTF-8 bytes of a string, with lone surrogates as U+FFFD (like TextEncoder). */
export function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    let code = char.codePointAt(0) ?? 0xfffd;
    if (code >= 0xd800 && code <= 0xdfff) code = 0xfffd;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return bytes;
}
