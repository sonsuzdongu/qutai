import type { SavedTask } from '../storage/savedTasks';
import { cutText } from '../utils/wellFormed';

/**
 * The assistant's two saved-task tools: list_saved_tasks (names and the start of each text) and get_saved_task (one
 * task's full text, by name or id), so "run the task called X" works. The assistant then carries the text out as if
 * the user had typed it. Creating, editing, deleting and scheduling tasks stay with the user (the saved tasks list).
 *
 * Incognito: the same as the saved tasks list, which the panel offers in incognito conversations too (its header
 * button and the recent-task chips) and whose tasks run in the conversation on screen. Nothing is written but the
 * "last used" time, as when the user runs a task from the list.
 *
 * The matching is pure (no React Native, no database), tested in scripts/assistant-tests/savedTaskTool.test.ts.
 */

/** What the tools need of the app; absent in tests or when unavailable. */
export type SavedTasksAccess = {
  list(): Promise<SavedTask[]>;
  /** `{date}` / `{today}` filled in, as when the user runs the task. */
  fill(prompt: string): string;
  markUsed(id: string): void;
};

const LIST_LIMIT = 50;
const PREVIEW = 80;

/**
 * A name folded for comparison: case-insensitive with Turkish dotted and dotless i (İ, I, ı, i all the same), spaces
 * collapsed, quotes around it dropped. `loose` also drops the other Turkish (and common) accents: ş→s, ğ→g, ç→c, ö→o,
 * ü→u, for a name typed without them.
 */
export function foldTaskName(text: string, loose = false): string {
  let s = text
    .normalize('NFC')
    .replace(/[İIıi]/g, 'i')
    .toLowerCase()
    .replace(/̇/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'“”‘’«»]+|["'“”‘’«».]+$/g, '')
    .trim();
  if (loose) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
  return s;
}

/**
 * The saved tasks a name or id points at: the id exactly; else the names equal to it (case and Turkish i ignored);
 * else equal without accents; else the names containing it (without accents). Several results: the user is asked.
 */
export function matchSavedTasks<T extends Pick<SavedTask, 'id' | 'name'>>(tasks: T[], query: { name?: string; id?: string }): T[] {
  const id = (query.id ?? '').trim();
  if (id) {
    const byId = tasks.filter((task) => task.id === id);
    if (byId.length) return byId;
  }
  const name = query.name ?? '';
  if (!foldTaskName(name)) return [];
  const strict = foldTaskName(name);
  const exact = tasks.filter((task) => foldTaskName(task.name) === strict);
  if (exact.length) return exact;
  const loose = foldTaskName(name, true);
  const plain = tasks.filter((task) => foldTaskName(task.name, true) === loose);
  if (plain.length) return plain;
  return tasks.filter((task) => foldTaskName(task.name, true).includes(loose));
}

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();
const preview = (text: string) => {
  const line = oneLine(text);
  return line.length > PREVIEW ? `${cutText(line, PREVIEW)}…` : line;
};
/** Names and texts go between quotes in the result: their own quotes would end them early. */
const quoted = (text: string) => `"${text.replace(/"/g, "'")}"`;

function listLine(task: SavedTask): string {
  return `- ${quoted(task.name)} (id ${task.id}): ${quoted(preview(task.prompt))}`;
}

export async function listSavedTasksTool(access: SavedTasksAccess | undefined): Promise<{ content: string; isError: boolean }> {
  if (!access) return { content: 'Saved tasks are not available.', isError: true };
  const tasks = await access.list();
  if (!tasks.length) {
    return {
      content: 'The user has no saved tasks. They save one with "Save as task" on a message they sent, or in the saved tasks list.',
      isError: false,
    };
  }
  const shown = tasks.slice(0, LIST_LIMIT);
  const more = tasks.length > shown.length ? `\n(${tasks.length - shown.length} more not shown.)` : '';
  return {
    content:
      `The user's saved tasks (${tasks.length}), most recently used first: name, id, start of the text.\n` +
      `${shown.map(listLine).join('\n')}${more}\n` +
      'To run one the user asked for, call get_saved_task with its id.',
    isError: false,
  };
}

/** Where the task runs, as the user set it when saving it. */
function targetLine(task: SavedTask): string {
  if (task.target === 'url' && task.url) {
    return `It runs on a page opened first: open ${task.url} with open_tab, then carry out the text there.`;
  }
  if (task.target === 'none') return 'It needs no particular page.';
  return 'It runs on the page on screen.';
}

export async function getSavedTaskTool(
  input: Record<string, unknown>,
  access: SavedTasksAccess | undefined,
): Promise<{ content: string; isError: boolean }> {
  if (!access) return { content: 'Saved tasks are not available.', isError: true };
  const name = typeof input.name === 'string' ? input.name : '';
  const id = typeof input.id === 'string' ? input.id : '';
  if (!name.trim() && !id.trim()) return { content: 'Give the task\'s name or id.', isError: true };
  const tasks = await access.list();
  const found = matchSavedTasks(tasks, { name, id });
  if (!found.length) {
    const names = tasks.slice(0, 20).map((task) => quoted(task.name)).join(', ');
    return {
      content:
        `No saved task is called ${quoted(name || id)}. ` +
        (tasks.length ? `The saved tasks are: ${names}${tasks.length > 20 ? ', …' : ''}. ` : 'The user has no saved tasks. ') +
        'Tell the user, and ask which one they mean if one of these may be it; never guess.',
      isError: false,
    };
  }
  if (found.length > 1) {
    return {
      content:
        `Several saved tasks match ${quoted(name || id)}:\n${found.slice(0, 10).map(listLine).join('\n')}\n` +
        'Ask the user which one to run with ask_user (their names as options), then call get_saved_task with its id.',
      isError: false,
    };
  }
  const task = found[0];
  access.markUsed(task.id);
  const research = task.research ? '\nThe user saved it as deep research: work through it as a thorough, sourced report.' : '';
  return {
    content:
      `Saved task ${quoted(task.name)} (id ${task.id}), written by the user. ${targetLine(task)}${research}\n` +
      `Its text:\n<<<\n${access.fill(task.prompt).replace(/<{3,}|>{3,}/g, '')}\n>>>\n` +
      'Carry it out now as if the user had just typed it, under the usual safety and confirmation rules.',
    isError: false,
  };
}
