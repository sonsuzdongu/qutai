import { BridgeError } from '../apps/contract';
import { formatDiagnostics, type Diagnostic } from '../apps/document';
import { APP_GUIDE } from '../apps/guide';
import { APP_ICONS, type AppIcon, type AppPackage, type AppPermission } from '../apps/manifest';
import type { AppChange, AppSummary, LoadedApp, NewApp } from '../apps/store';
import { t } from '../i18n';
import { cutText } from '../utils/wellFormed';
import type { ToolContext, ToolOutput } from './executeTool';
import { errorNotice, incognitoNotice } from './stepLine';

/**
 * The `apps` tool (docs/mini-apps.md › How the assistant builds an app): the guide, listing and reading apps, creating
 * and changing them (each change a new, sealed version; the chat shows the app card with Open and Undo), the preview
 * that gives the model the app's errors and console, and undo. Never the app's data. Not in incognito conversations.
 */

/** The chat's app card. */
export type AppOffer = {
  appId: string;
  name: string;
  version: number;
  change: 'created' | 'changed' | 'undone';
  note?: string;
};

/** What a preview gives back: the app's diagnostics after it settled. */
export type PreviewReport = {
  loaded: boolean;
  diagnostics: Diagnostic[];
  /** What the document builder left out (a script from a CDN…). */
  notes: string[];
  /** Malformed messages the bridge dropped. */
  dropped: number;
};

export type AppsAccess = {
  list(): Promise<AppSummary[]>;
  load(id: string): Promise<LoadedApp | null>;
  create(app: NewApp): Promise<AppPackage>;
  change(id: string, change: AppChange, note: string | null): Promise<AppPackage>;
  undo(id: string): Promise<number | null>;
  /** Opens the app in the runner and resolves once it settled; 'unavailable' when it can't be shown now. */
  preview(id: string): Promise<PreviewReport | 'unavailable'>;
  offer(offer: AppOffer): void;
  /** The conversation is incognito or touched an incognito tab. */
  incognito(): boolean;
  uiLanguage(): string;
  /** Creates and updates made in this task (one user message). */
  budget: { writes: number };
};

/** Creates and updates allowed per user message. */
export const MAX_APP_WRITES = 8;
/** read returns every file while the package is at most this many characters, otherwise the list and one file. */
const READ_ALL_LIMIT = 60_000;

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function fail(content: string, notice = errorNotice(t('step.appFailed'))): ToolOutput {
  return { content, isError: true, notice };
}

function icon(value: unknown): AppIcon {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const color = typeof v.color === 'string' ? { color: v.color } : {};
  if (typeof v.svg === 'string' && !v.name) return { svg: v.svg, ...color };
  // An unknown name becomes the generic tool icon rather than failing the whole app.
  const name = (APP_ICONS as readonly string[]).includes(str(v.name)) ? (str(v.name) as (typeof APP_ICONS)[number]) : 'tool';
  return { name, ...color };
}

function permissions(value: unknown): AppPermission[] {
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is AppPermission => typeof p === 'string') as AppPermission[];
}

function files(value: unknown): Record<string, string | null> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) throw new BridgeError('E_BAD_ARGS', 'files must be an object of file name: text');
  return value as Record<string, string | null>;
}

function describeApp(app: AppSummary): string {
  return `- ${app.id}: "${app.name}" version ${app.version}${app.state === 'disabled' ? ' (switched off)' : ''}${app.description ? ` — ${app.description}` : ''}`;
}

export function describeAppsCall(input: Record<string, unknown>): string {
  switch (input.action) {
    case 'guide':
      return t('action.appsGuide');
    case 'list':
      return t('action.appsList');
    case 'read':
      return t('action.appsRead');
    case 'create':
      return t('action.appsCreate', { name: cutText(str(input.name).trim(), 40) });
    case 'update':
      return t('action.appsUpdate');
    case 'preview':
      return t('action.appsPreview');
    case 'undo':
      return t('action.appsUndo');
    default:
      return t('action.appsList');
  }
}

export async function appsTool(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  const apps = ctx.apps;
  if (!apps) return fail('Apps are not available here.');
  const action = str(input.action);
  if (action === 'guide') return { content: APP_GUIDE, isError: false };
  if (apps.incognito())
    return fail(
      "Not allowed: apps can't be made, changed or opened from an incognito conversation. Tell the user to ask in a normal tab.",
      incognitoNotice(),
    );
  const id = str(input.app_id);
  try {
    switch (action) {
      case 'list': {
        const list = await apps.list();
        return { content: list.length ? `The user's apps:\n${list.map(describeApp).join('\n')}` : 'The user has no apps yet.', isError: false };
      }
      case 'read': {
        const app = await apps.load(id);
        if (!app) return fail(`There is no app ${id}. Call apps list.`);
        const { manifest } = app.pkg;
        const names = Object.keys(app.pkg.files).sort();
        const total = names.reduce((n, f) => n + app.pkg.files[f].length, 0);
        const head =
          `App ${app.id} "${manifest.name}" version ${manifest.version}, language ${manifest.language}, icon ${JSON.stringify(manifest.icon)}, ` +
          `permissions [${manifest.permissions.join(', ')}]. Description: ${manifest.description || '(none)'}\n` +
          `Files: ${names.map((f) => `${f} (${app.pkg.files[f].length} chars)`).join(', ')}`;
        const wanted = str(input.file);
        if (wanted) {
          if (typeof app.pkg.files[wanted] !== 'string') return fail(`${id} has no file ${wanted}.`);
          return { content: `${head}\n\n=== ${wanted} ===\n${app.pkg.files[wanted]}`, isError: false };
        }
        if (total > READ_ALL_LIMIT) return { content: `${head}\n\nThe files are large: read them one at a time with file.`, isError: false };
        return { content: `${head}\n\n${names.map((f) => `=== ${f} ===\n${app.pkg.files[f]}`).join('\n\n')}`, isError: false };
      }
      case 'create':
      case 'update': {
        if (apps.budget.writes >= MAX_APP_WRITES)
          return fail(
            `Stopped: ${MAX_APP_WRITES} app changes in one message. Tell the user what is still wrong and let them decide.`,
            errorNotice(t('step.appLimit')),
          );
        apps.budget.writes++;
        if (action === 'create') {
          const pkg = await apps.create({
            name: str(input.name),
            description: str(input.description),
            icon: icon(input.icon),
            permissions: permissions(input.permissions),
            language: str(input.language) || apps.uiLanguage(),
            files: (files(input.files) ?? {}) as Record<string, string>,
          });
          apps.offer({ appId: pkg.manifest.id, name: pkg.manifest.name, version: 1, change: 'created' });
          return {
            content: `Created "${pkg.manifest.name}" (${pkg.manifest.id}), version 1. Call apps preview with this app_id to check it.`,
            isError: false,
          };
        }
        const change: AppChange = {
          ...(input.name !== undefined ? { name: str(input.name) } : {}),
          ...(input.description !== undefined ? { description: str(input.description) } : {}),
          ...(input.icon !== undefined ? { icon: icon(input.icon) } : {}),
          ...(input.permissions !== undefined ? { permissions: permissions(input.permissions) } : {}),
          ...(input.files !== undefined ? { files: files(input.files) } : {}),
          ...(Array.isArray(input.edits) ? { edits: input.edits as AppChange['edits'] } : {}),
        };
        if (!Object.keys(change).length) return fail('Nothing to change: give edits, files, name, description, icon or permissions.');
        const note = cutText(str(input.note).trim(), 200) || null;
        const pkg = await apps.change(id, change, note);
        apps.offer({ appId: id, name: pkg.manifest.name, version: pkg.manifest.version, change: 'changed', ...(note ? { note } : {}) });
        return { content: `Saved "${pkg.manifest.name}" version ${pkg.manifest.version} (now current). Call apps preview to check it.`, isError: false };
      }
      case 'preview': {
        const app = await apps.load(id);
        if (!app) return fail(`There is no app ${id}. Call apps list.`);
        const report = await apps.preview(id);
        if (report === 'unavailable')
          return fail('The preview could not be shown now (Qutai is not on screen). Ask the user to open the app from the card.');
        const errors = report.diagnostics.filter((d) => d.kind === 'error' || d.kind === 'blocked' || d.kind === 'bridge');
        const lines = [
          `Preview of "${app.name}" version ${app.version}: ${report.loaded ? 'loaded' : 'did not finish loading'}; ${errors.length} problem${errors.length === 1 ? '' : 's'}. It is open on the user's screen now.`,
        ];
        if (report.diagnostics.length) lines.push(`Errors, blocked things and console output:\n${formatDiagnostics(report.diagnostics)}`);
        if (report.notes.length) lines.push(`Left out of the document: ${report.notes.join('; ')}`);
        if (report.dropped) lines.push(`${report.dropped} malformed bridge message(s) were dropped.`);
        return { content: lines.join('\n\n'), isError: false };
      }
      case 'undo': {
        const version = await apps.undo(id);
        if (version === null) return fail(`There is no earlier version of ${id} to go back to.`);
        const app = await apps.load(id);
        apps.offer({ appId: id, name: app?.name ?? '', version, change: 'undone' });
        return { content: `"${app?.name ?? id}" is back at version ${version}.`, isError: false };
      }
      default:
        return fail('action must be guide, list, read, create, update, preview or undo.');
    }
  } catch (e) {
    if (e instanceof BridgeError) return fail(`Not saved: ${e.message}`);
    throw e;
  }
}
