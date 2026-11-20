import type { Browser } from '../browser/Browser';
import type { Tab } from '../browser/Tab';
import type { Turn } from '../ai/types';
import {
  buildCards,
  optionsResult,
  parseOptionsInput,
  type OptionCard,
  type OptionDetail,
  type OptionRequest,
} from '../chat/optionCards';

/** Per tab: a page that doesn't answer quickly gives no pictures rather than holding up the answer. */
const LOOKUP_TIMEOUT_MS = 3000;
/** Besides the assistant's tab, at most this many tabs of its group are searched for links the model named. */
const MAX_OTHER_TABS = 3;

/**
 * show_options (UI-25, DATA-24 in docs/design): the model's options checked, their links and pictures
 * looked up on the pages the task has open (the assistant's tab first, then the other tabs of its group in the same
 * mode), and the cards built (src/chat/optionCards.ts). Nothing on a page is clicked, loaded or changed, and a picture
 * never triggers anything: it is only an address the panel may load later.
 */
export async function showOptions(
  input: Record<string, unknown>,
  { browser, agentTabId, turns }: { browser: Browser; agentTabId: string; turns: Turn[] },
): Promise<{ content: string; isError: boolean; cards?: OptionCard[] }> {
  const parsed = parseOptionsInput(input);
  if ('error' in parsed) return { content: parsed.error, isError: true };
  const { requests } = parsed;
  const agentTab = browser.getTab(agentTabId);
  const details: OptionDetail[] = requests.map(() => null);

  if (agentTab) await lookUp(agentTab, requests, details, requests.map((_, i) => i));
  if (agentTab) {
    const others = browser.tabs
      .filter(
        (t) =>
          t.id !== agentTab.id &&
          t.incognito === agentTab.incognito &&
          !!agentTab.groupId &&
          t.groupId === agentTab.groupId &&
          !t.asleep &&
          !t.isNewTab,
      )
      .slice(0, MAX_OTHER_TABS);
    for (const tab of others) {
      // Only options given by link and not found yet: refs belong to the assistant's tab.
      const missing = requests.map((r, i) => i).filter((i) => requests[i].url && !details[i]?.href);
      if (!missing.length) break;
      await lookUp(tab, requests.map((r) => ({ ...r, ref: undefined })), details, missing);
    }
  }

  const built = buildCards(requests, details, { pageUrl: agentTab?.url, readTexts: readTexts(turns) });
  if (!built.cards.length) {
    return {
      content: `No card could be shown: ${built.dropped.join(', ')}. Cards need https links from the page. Answer in text instead.`,
      isError: true,
    };
  }
  return { content: optionsResult(built), isError: false, cards: built.cards };
}

async function lookUp(tab: Tab, requests: OptionRequest[], details: OptionDetail[], indexes: number[]) {
  if (tab.asleep || tab.isNewTab) return;
  const asked = indexes.map((i) => ({ ref: requests[i].ref, url: requests[i].url }));
  const found = await tab.run<OptionDetail[]>('optionDetails', [asked], LOOKUP_TIMEOUT_MS).catch(() => null);
  if (!Array.isArray(found)) return;
  indexes.forEach((index, k) => {
    const d = found[k];
    if (!d || typeof d !== 'object') return;
    const before = details[index];
    // Keep what an earlier tab found; fill in only what is still missing.
    details[index] = {
      href: before?.href || (typeof d.href === 'string' ? d.href : ''),
      image: before?.image || (typeof d.image === 'string' ? d.image : ''),
      text: [before?.text, typeof d.text === 'string' ? d.text : ''].filter(Boolean).join('\n'),
    };
  });
}

/** What the conversation read and the user wrote: where a price must appear to be shown (optionCards.ts priceSeen). */
function readTexts(turns: Turn[]): string[] {
  const texts: string[] = [];
  for (const turn of turns) {
    if (turn.role === 'user') texts.push(turn.text);
    else if (turn.role === 'tool_results') for (const r of turn.results) if (typeof r.content === 'string') texts.push(r.content);
  }
  return texts;
}
