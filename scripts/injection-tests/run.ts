/**
 * One measured task (README.md in this folder): a fresh Browser with the case's tabs loaded in headless Chrome, the
 * user's message as App.tsx builds it, and the app's own runAgent with the ToolContext of world.ts. Returns what
 * happened, for judge.ts.
 */
import { runAgent } from '../../src/agent/runAgent';
import { withIdentity } from '../../src/agent/identity';
import { nowContext } from '../../src/agent/scheduling';
import { interfaceLanguageNote } from '../../src/agent/uiLabels';
import type { Turn } from '../../src/ai/types';
import { Browser } from '../../src/browser/Browser';
import { describeAttachments } from '../../src/chat/attachments';
import { PLACEHOLDER_KEY } from './api';
import type { Case } from './cases';
import { mountViews, type Chrome, type Response, type ServedRequest } from './chrome';
import { CONTACTS, GIF, MEMORIES, page } from './fixtures';
import type { RunRecord } from './judge';
import { makeWorld } from './world';

/** Steps per task in the measurement (Qutai Credits allows more; the traps act within the first few). */
export const MAX_STEPS = 12;
const RUN_TIMEOUT_MS = 240_000;

export function serverFor(c: Case) {
  return (req: ServedRequest): Response => {
    const url = req.url.split('#')[0];
    let decoded = url;
    try {
      decoded = decodeURI(url);
    } catch {}
    const found = c.pages[url] ?? c.pages[decoded];
    if (found !== undefined) {
      return typeof found === 'string' ? { status: 200, type: 'text/html; charset=utf-8', body: found } : { status: found.status ?? 200, type: found.type, body: found.body };
    }
    if (/^https:\/\/www\.google\.com\/search/.test(url) && c.search) return { status: 200, type: 'text/html; charset=utf-8', body: c.search };
    if (/\.(jpe?g|png|gif|webp|ico)(\?|$)/i.test(url) || req.resourceType === 'Image') {
      return /favicon/.test(url) ? { status: 404, type: 'text/plain', body: '' } : { status: 200, type: 'image/gif', body: GIF };
    }
    if (req.resourceType === 'Script' || req.resourceType === 'Stylesheet') return { status: 200, type: 'text/javascript', body: '' };
    if (c.pdfs?.[url] ?? c.pdfs?.[decoded]) return { status: 200, type: 'application/pdf', body: '%PDF-1.4' };
    // Any other address: a plain page (an attacker's landing page answers like this too).
    return { status: 200, type: 'text/html; charset=utf-8', body: page('Thank you', '<h1>Thank you</h1><p>Done.</p>') };
  };
}

// The app's own note (src/agent/contextNote.ts) when the code under test has it.
const contextNote: { currentTabNote: (tab: { id: string; title: string; url: string; isNewTab: boolean }, openTabs: number) => string } | null =
  await import('../../src/agent/contextNote').catch(() => null);

/**
 * The app's note when it has agent/contextNote.ts (from 20 Nov 2026); before that, the form App.tsx built inline,
 * which the baseline was measured with.
 */
function currentTabNoteFor(tab: { id: string; title: string; url: string; isNewTab: boolean }, openTabs: number): string {
  if (contextNote) return contextNote.currentTabNote(tab, openTabs);
  return `\n\n[Current tab ${tab.id}: ${tab.title || '(no title)'} — ${tab.url}. Open tabs: ${openTabs}. ${nowContext()}. ${interfaceLanguageNote()}]`;
}

async function until(check: () => boolean, ms = 15000) {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 50));
}

export async function runCase(c: Case, model: string, rep: number, chrome: Chrome, spent: () => number): Promise<RunRecord> {
  const startUsd = spent();
  (globalThis as { __qutaiCase?: string }).__qutaiCase = c.id;
  // Every case's PDFs at once (cases run side by side; their addresses and ids differ).
  (globalThis as { __qutaiPdfs?: Record<string, unknown> }).__qutaiPdfs = { ...(globalThis as { __qutaiPdfs?: Record<string, unknown> }).__qutaiPdfs, ...(c.pdfs ?? {}) };
  const requests: ServedRequest[] = [];
  const browser = new Browser();
  const views = mountViews(chrome, browser, serverFor(c), (r) => requests.push(r));
  const first = browser.active;
  first.loadUrl(c.start);
  await until(() => !first.busy && first.url !== '' && !first.isNewTab);
  for (const url of c.otherTabs ?? []) {
    const t = browser.openTab(url, { activate: false });
    await until(() => !t.busy);
  }
  browser.switchTab(first.id);
  await new Promise((r) => setTimeout(r, 300));

  const userMessages = [c.user];
  const world = makeWorld({
    browser,
    agentTabId: first.id,
    memories: MEMORIES,
    contacts: CONTACTS,
    userTexts: () => userMessages,
    attachments: c.attachments,
  });
  const attachments = (c.attachments ?? []).map((a) => ({ id: a.id, name: a.name, kind: a.kind, mimeType: 'application/pdf', size: 48213 }) as never);
  // The note as App.tsx builds it (before 20 Nov 2026 it was built inline there, with the bare title; the baseline
  // results were measured with that form, kept in pageInfoBefore below).
  const pageInfo = currentTabNoteFor(first, browser.tabs.length);
  const attached = attachments.length ? `\n\n${describeAttachments(attachments)}` : '';
  const turns: Turn[] = [
    { role: 'user', text: withIdentity(c.user + attached + pageInfo, { mode: 'credits' }), ...(attachments.length ? { attachments } : {}) } as Turn,
  ];
  const before = new Set(world.memoryRows.map((m) => m.id));
  const actions: string[] = [];
  const cards: { title: string; url: string }[] = [];
  const texts: string[] = [];
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), RUN_TIMEOUT_MS);
  let error: string | undefined;
  try {
    await runAgent({
      ...world.ctx,
      provider: 'anthropic',
      apiKey: PLACEHOLDER_KEY,
      model,
      imageInput: false,
      turns,
      memory: world.memory,
      webSearch: false,
      stream: false,
      signal: abort.signal,
      serverLimits: { maxSteps: MAX_STEPS },
      alwaysAllowed: () => false,
      audit: { conversation: () => 'measurement', incognito: () => false },
      onEvent: (e) => {
        if (e.type === 'action') actions.push(e.text);
        else if (e.type === 'options') for (const k of e.cards) cards.push({ title: k.title, url: k.url });
        else if (e.type === 'choices') texts.push(`${e.text}\n${e.options.join(' | ')}`);
        else if (e.type === 'error') error = e.text;
      },
    });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  } finally {
    clearTimeout(timer);
  }
  // What the model called and what came back, from the history runAgent kept.
  const calls: RunRecord['calls'] = [];
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    if (t.role === 'assistant') {
      if (t.text) texts.push(t.text);
      const next = turns[i + 1];
      for (const call of t.toolCalls ?? []) {
        const res = next?.role === 'tool_results' ? next.results.find((x) => x.callId === call.id) : undefined;
        calls.push({ name: call.name, input: call.input, result: String(res?.content ?? ''), isError: !!res?.isError });
      }
    }
  }
  const memoriesAdded = world.memoryRows.filter((m) => !before.has(m.id)).map((m) => m.text);
  // Give a page a moment to send what a last click started.
  await new Promise((r) => setTimeout(r, 500));
  views.done();
  return {
    caseId: c.id,
    model,
    rep,
    calls,
    actions,
    requests,
    world: world.log,
    memoriesAdded,
    cards,
    text: texts.join('\n\n'),
    error,
    usd: spent() - startUsd,
  };
}
