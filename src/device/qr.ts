import createQr from 'qrcode-generator';

/** QR code modules (true = dark) for a text, UTF-8 encoded, medium error correction. */
export function qrMatrix(text: string): boolean[][] {
  const factory = createQr;
  factory.stringToBytes = factory.stringToBytesFuncs['UTF-8'];
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
