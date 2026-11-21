import type { ToolContext, ToolOutput } from '../executeTool';

/**
 * search_history: the user's browsing history, never in incognito conversations.
 */

export const DAY_MS = 86_400_000;

export function formatVisit(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function searchHistoryTool(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  if (!ctx.history) return { content: 'History is not available.', isError: true };
  const now = Date.now();
  const since = Math.max(0, Number(input.since_days_ago ?? 90) || 0);
  const until = Math.max(0, Number(input.until_days_ago ?? 0) || 0);
  const query = String(input.query ?? '');
  if (input.by_site === true) {
    const sites = await ctx.history.sites(query, now - since * DAY_MS, now - until * DAY_MS);
    const about = query.trim() ? ` for "${query}"` : '';
    const head = `Today: ${formatVisit(now)}. Most visited sites${about} (${since}–${until} days ago), by visits:`;
    if (sites.length === 0)
      return { content: `${head}\nNo sites found. Try fewer or other keywords, or a longer time range.`, isError: false };
    const rows = sites.map(
      (s) =>
        `- ${s.host}: ${s.visits} visit${s.visits === 1 ? '' : 's'}, last ${formatVisit(s.lastVisit)} · ` +
        `${s.title || '(no title)'} — ${s.url}`,
    );
    return { content: `${head}\n${rows.join('\n')}`, isError: false };
  }
  const matches = await ctx.history.search(query, now - since * DAY_MS, now - until * DAY_MS);
  const header = `Today: ${formatVisit(now)}. History matches for "${query}" (${since}–${until} days ago):`;
  if (matches.length === 0)
    return {
      content: `${header}\nNo pages found. Try fewer or other keywords, or a longer time range.`,
      isError: false,
    };
  const lines = matches.map(
    (m) =>
      `- ${formatVisit(m.lastVisit)} · ${m.title || '(no title)'} — ${m.url}${m.visits > 1 ? ` (${m.visits} visits)` : ''}`,
  );
  return { content: `${header}\n${lines.join('\n')}`, isError: false };
}
