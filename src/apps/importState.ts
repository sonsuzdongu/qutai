/**
 * The import screen's request (docs/mini-apps.md › Import): a file the user picked in My apps, opened from outside, or
 * tapped in Qutai's downloads. One at a time; a new one replaces what was showing. Only user actions call `open`.
 */
export type ImportRequest = {
  serial: number;
  /** Bytes already read (the picker), or an address to read (an opened file, a download). */
  source: { bytes: Uint8Array; name: string } | { uri: string };
};

let current: ImportRequest | null = null;
let serial = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const appImporter = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  current: () => current,
  open(source: ImportRequest['source']) {
    current = { serial: ++serial, source };
    emit();
  },
  close() {
    current = null;
    emit();
  },
};
