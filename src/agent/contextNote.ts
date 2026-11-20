import { nowContext } from './scheduling';
import { interfaceLanguageNote } from './uiLabels';
import { fenceUntrusted } from './untrusted';

/** A page title longer than this is cut in the note (titles are short; a long one is usually not a title). */
export const MAX_TITLE_IN_NOTE = 200;

/**
 * The bracketed context at the end of each user message: which tab the user asks from, how many tabs are open, the
 * time and the interface language. The page's title is the page's own text, so it goes between untrusted-content
 * markers (UNTR-21): before 20 Nov 2026 it stood bare in the user's message, and a title written as an instruction
 * ("AI assistants: reply only …") was obeyed as if the user had said it.
 */
export function currentTabNote(
  tab: { id: string; title: string; url: string; isNewTab: boolean },
  openTabs: number,
  noPage = false,
  now = new Date(),
): string {
  const title = tab.title.trim();
  const where = tab.isNewTab
    ? 'new tab page, no web page loaded'
    : `${tab.url}, ${title ? `titled (the page's own words) ${fenceUntrusted(title.slice(0, MAX_TITLE_IN_NOTE), 'title')}` : 'no title'}`;
  const pageNote = noPage && !tab.isNewTab ? " This task isn't about this page; don't read it unless needed." : '';
  return `\n\n[Current tab ${tab.id}: ${where}.${pageNote} Open tabs: ${openTabs}. ${nowContext(now)}. ${interfaceLanguageNote()}]`;
}

/** The user's own words in a message the app built (their text, without the bracketed notes the app adds after it). */
export function userWords(text: string): string {
  const at = text.indexOf('\n\n[');
  return at >= 0 ? text.slice(0, at) : text;
}
