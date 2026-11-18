/**
 * Where a link tapped in the assistant's chat opens (answer text, the search widget, "Sources" cards, and "Open in
 * new tab" from a link's long-press menu). Pure (tested in scripts/assistant-tests/chatLinks.test.ts).
 *
 * The rule is the one tabs the assistant opens during a task follow (executeTool.ts open_tab): the new tab joins the
 * tab group of the conversation's tab, and when that tab has no group yet the two form one (Browser.openTab with
 * `group`), so the conversation and its pages stay together. A link from an incognito conversation opens incognito.
 * A tab can only share a group with tabs of its own kind, so a page opened in the other mode (a source that was read
 * in an incognito tab, shown in a normal conversation) opens on its own.
 */

export type LinkOwner = { id: string; incognito: boolean };
export type OpenTabInfo = { id: string; url: string; incognito: boolean };

export type ChatLinkPlan =
  | { kind: 'switch'; tabId: string }
  | {
      kind: 'open';
      url: string;
      incognito: boolean;
      /** The conversation's tab, when the new tab joins (or starts) its group. */
      openerId?: string;
      group: boolean;
      /** Shown at once (a tap); false: opened behind ("Open in new tab" from the long-press menu). */
      activate: boolean;
    };

export function chatLinkPlan({
  url,
  owner,
  conversationIncognito,
  sourceIncognito,
  openTabs,
  background = false,
}: {
  url: string;
  /** The tab whose conversation the panel shows. */
  owner: LinkOwner;
  /** The conversation is an incognito tab's (or group's). */
  conversationIncognito: boolean;
  /** A "Sources" card: the mode its page was read in. */
  sourceIncognito?: boolean;
  /** A "Sources" card: a page that is still open in the same mode is shown in its tab. */
  openTabs?: readonly OpenTabInfo[];
  background?: boolean;
}): ChatLinkPlan {
  const incognito = owner.incognito || conversationIncognito || sourceIncognito === true;
  const open = openTabs?.find((t) => t.incognito === incognito && t.url === url);
  if (open) return { kind: 'switch', tabId: open.id };
  const sameKind = incognito === owner.incognito;
  return {
    kind: 'open',
    url,
    incognito,
    ...(sameKind ? { openerId: owner.id } : {}),
    group: sameKind,
    activate: !background,
  };
}
