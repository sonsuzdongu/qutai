import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/**
 * A value for one purpose made from a tab's nonce, which can't be turned back into the nonce. Injected scripts use it
 * wherever the page could read it: in messages between frames (any frame can listen to window messages) and in
 * names on `window` (a page can list them). The nonce itself only ever travels in a message to the app or as an
 * argument the app passes in, so a page that learns one of these can't speak to the app as the script (MEDIA-31).
 */
export function derivedKey(nonce: string, purpose: 'frames' | 'play' | 'share' | 'replies'): string {
  return bytesToHex(sha256(utf8ToBytes(`qutai:${purpose}:${nonce}`))).slice(0, 32);
}
