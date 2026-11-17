// Size of a backup with realistic data (docs/server-backup.md › Size). Run: npm run measure:backup
import { randomBytes } from 'node:crypto';
import { encryptBackup, decryptBackup } from '../../src/backup/crypto.ts';
import type { BackupPayload } from '../../src/backup/payload.ts';

const words = 'news weather recipe travel flight hotel review price shop sale code docs guide forum video music map bank'.split(' ');
let seed = 7;
const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed % n);
const word = () => words[rnd(words.length)];
const sentence = (n: number) => Array.from({ length: n }, word).join(' ');
const url = () => `https://www.${word()}${rnd(500)}.com/${word()}/${word()}-${rnd(1e6)}?ref=${word()}&id=${rnd(1e9)}`;

type Profile = { name: string; visitsPerDay: number; bookmarks: number; memories: number; tabs: number; chats: number; chatSteps: number; toolResultChars: number; activity: number };

export function build(p: Profile): BackupPayload {
  const now = Date.now();
  const history = Array.from({ length: p.visitsPerDay * 90 }, (_, i) => ({ url: url(), title: sentence(6), visitedAt: now - i * 60_000 }));
  const tabs = Array.from({ length: p.tabs }, (_, i) => ({ url: url(), title: sentence(5), uid: `tab${i}` }));
  const chats = Array.from({ length: Math.min(p.chats, p.tabs) }, (_, c) => {
    const items: unknown[] = [];
    const turns: unknown[] = [];
    for (let s = 0; s < p.chatSteps; s++) {
      items.push({ id: `i${c}-${s}`, kind: s % 2 ? 'assistant' : 'user', text: sentence(40) });
      turns.push({ role: 'user', text: sentence(20) });
      turns.push({ role: 'assistant', text: sentence(60), toolCalls: [{ id: `call_${c}_${s}`, name: 'read_page', input: { url: url() } }] });
      turns.push({ role: 'tool_results', results: [{ callId: `call_${c}_${s}`, name: 'read_page', content: sentence(p.toolResultChars / 6) }] });
    }
    return { key: `tab${c}`, items, turns };
  });
  return {
    app: 'qutai', payloadVersion: 1, createdAt: now, appVersion: '1.0.0', schemaVersion: 9,
    bookmarks: { folders: [{ id: 1, parentId: null, title: 'Work', createdAt: now }], items: Array.from({ length: p.bookmarks }, () => ({ url: url(), title: sentence(5), createdAt: now, folderId: rnd(2) ? 1 : null })) },
    history,
    memories: Array.from({ length: p.memories }, () => ({ text: sentence(15), category: 'general' as const, createdAt: now, updatedAt: now })),
    tabs: { tabs, activeIndex: 0, groups: [] },
    chats,
    activity: Array.from({ length: p.activity }, () => ({ at: now, host: 'example.com', url: url(), tool: 'click', description: sentence(10), ok: true })),
    settings: { theme: 'dark', textZoom: 100 },
  };
}

export const PROFILES: Profile[] = [
  { name: 'light (20 visits/day, 100 bookmarks, no chats)', visitsPerDay: 20, bookmarks: 100, memories: 20, tabs: 8, chats: 0, chatSteps: 0, toolResultChars: 0, activity: 0 },
  { name: 'typical (80 visits/day, 500 bookmarks, 10 chats)', visitsPerDay: 80, bookmarks: 500, memories: 100, tabs: 20, chats: 10, chatSteps: 15, toolResultChars: 8000, activity: 1000 },
  { name: 'heavy (300 visits/day, 3000 bookmarks, 60 chats of 40 steps)', visitsPerDay: 300, bookmarks: 3000, memories: 400, tabs: 80, chats: 60, chatSteps: 40, toolResultChars: 20000, activity: 5000 },
];

if (process.argv[1]?.endsWith('measure.ts')) {
  for (const p of PROFILES) {
    const payload = build(p);
    const json = new TextEncoder().encode(JSON.stringify(payload));
    let t = Date.now();
    const file = await encryptBackup(json, 'correct horse battery', async (n) => new Uint8Array(randomBytes(n)));
    const enc = Date.now() - t;
    t = Date.now();
    JSON.parse(new TextDecoder().decode(await decryptBackup(file, 'correct horse battery')));
    console.log(`${p.name}: history ${payload.history!.length}, file ${(file.length / 1e6).toFixed(2)} MB; encrypt ${enc} ms, decrypt+JSON.parse ${Date.now() - t} ms (Node, this Mac)`);
  }
}
