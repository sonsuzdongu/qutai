import { Platform } from 'react-native';
import { kindForDownload } from '../alwaysAllow';
import { t } from '../../i18n';
import { fileNameFromUrl, isRiskyDownload, probeDownload } from '../../device/download';
import { composeFile, keepComposedFile } from '../../device/composedFile';
import { formatSize } from '../../i18n/format';
import { uiLabel, uiPath } from '../uiLabels';
import { declinedNotice, errorNotice } from '../stepLine';
import type { IconLine } from '../../ui/Icon';
import { siteKey } from '../sitePolicy';
import { currentTab, fileButtons } from './shared';
import type { ToolContext, ToolOutput } from '../executeTool';

/**
 * Files: downloads the user confirms, and files composed from what the assistant gathered (save_file cards).
 */

/**
 * Downloads a file for the user through Qutai's downloads (src/browser/downloadRequests.ts). The user confirms every download with its name, site
 * and, when a HEAD request tells, type and size, with a warning for files that install or run code and archives. The
 * file is never opened, and the model only hears that it started and where the user finds it.
 */
export async function downloadFileTool(input: Record<string, unknown>, ctx: ToolContext, addressApproved = false): Promise<ToolOutput> {
  if (!ctx.startDownload) return { content: 'Downloads are not available here.', isError: true };
  const tab = currentTab(ctx);
  if (tab.incognito && ctx.privacy) ctx.privacy.touchedIncognito = true;
  const hasRef = input.ref !== undefined && input.ref !== null && input.ref !== '';
  let url = typeof input.url === 'string' ? input.url.trim() : '';
  if (hasRef) {
    if (tab.isNewTab)
      return {
        content: 'No web page is loaded in this tab, so there is no link to download.',
        isError: true,
        notice: errorNotice(t('step.noPage')),
      };
    try {
      url = await tab.run<string>('linkHref', [input.ref]);
    } catch (e) {
      return { content: e instanceof Error ? e.message : String(e), isError: true };
    }
  }
  if (!url) return { content: 'Give the ref of the link to the file, or its address as url.', isError: true };
  if (!/^https?:\/\//i.test(url))
    return { content: `Only http(s) addresses can be downloaded (got ${url.slice(0, 40)}).`, isError: true };
  // The page's own site was checked like any action; the file's site has to allow it as well.
  const fileHost = siteKey(url);
  const level = fileHost && ctx.sites ? ctx.sites.levelFor(fileHost) : 'default';
  if (fileHost && (level === 'blocked' || level === 'readonly')) {
    return {
      content: `The file is on ${fileHost}, where the user doesn't allow Qutai to act. Tell them to download it themselves.`,
      isError: true,
    };
  }
  if (!ctx.confirm) return { content: "This needs the user's confirmation, which is not available here.", isError: true };
  // An address the model wrote is not requested before the user has answered (it could carry the user's details,
  // UNTR-22): only a link the page wrote, or an address the user approved in the outbound dialog, is asked about its
  // name, type and size first. Unprobed, the dialog shows the name from the address and always asks.
  const probed = hasRef || addressApproved;
  const probe = probed ? await probeDownload(url) : { name: null, type: null, size: null };
  const name = probe.name || fileNameFromUrl(url);
  const host = fileHost ?? url;
  const details = [
    name,
    t('downloads.agentFrom', { host }),
    ...(probe.type ? [t('downloads.agentType', { type: probe.type })] : []),
    ...(probe.size ? [t('downloads.agentSize', { size: formatSize(probe.size) })] : []),
  ].join('\n');
  const android = Platform.OS === 'android';
  const risky = isRiskyDownload(name, probe.type);
  const lines: IconLine[] = [
    { text: t('downloads.agentConfirm') },
    { text: details },
    ...(risky ? [{ icon: 'insecure' as const, text: t('downloads.agentRisky', { host }) }] : []),
    { text: t(android ? 'downloads.agentWhereAndroid' : 'downloads.agentWhereIos') },
  ];
  // "Don't ask again" covers ordinary files only: never a risky one, never from an incognito conversation.
  const kind = kindForDownload({ risky: risky || !probed, incognito: !!(ctx.privacy?.touchedIncognito || tab.incognito) });
  if (!(await ctx.confirm({ lines, spaced: true }, null, kind)))
    return { content: 'The user declined the download. Ask them how to proceed.', isError: true, notice: declinedNotice() };
  try {
    await ctx.startDownload(tab, url, name, probe.type);
    return {
      content:
        `Started downloading "${name}"; it appears in Qutai's ${uiLabel('downloads.title')} screen ` +
        `(${uiPath('address.menu', 'menu.library', 'menu.downloads')}) with its progress, where the user opens ` +
        'or shares it' +
        (android ? " (the file is saved in the phone's Downloads folder)" : '') +
        '. You cannot open or read it.',
      isError: false,
    };
  } catch (e) {
    return { content: `Could not start the download: ${e instanceof Error ? e.message : String(e)}`, isError: true };
  }
}

/**
 * A file composed from what the assistant gathered, offered as a chat card. Nothing is written to shared storage
 * here: the user's tap shares or saves it. Kept in memory only (incognito ones until the incognito session ends).
 */
export function saveFileTool(input: Record<string, unknown>, ctx: ToolContext): ToolOutput {
  if (!ctx.offerFile) return { content: 'Files are not available here.', isError: true };
  const file = composeFile(input);
  if (typeof file === 'string') return { content: `${file} No file was made.`, isError: true };
  const tab = ctx.browser.getTab(ctx.agentTab.id);
  const incognito = !!(ctx.privacy?.touchedIncognito || tab?.incognito);
  const offer = keepComposedFile(file, incognito);
  ctx.offerFile(offer);
  const rows = file.rows !== undefined ? `, ${file.rows} data row${file.rows === 1 ? '' : 's'}` : '';
  return {
    content:
      `A card for "${file.name}" (${formatSize(file.size)}${rows}), id=${offer.id}, is shown in the chat with ${fileButtons()}. ` +
      'To attach it to an email, share it to an app or put it into a web page, use this id with draft_email, share or upload_file. ' +
      'Nothing is saved yet: the user taps a button to share or save it. It is kept only while the app runs' +
      `${incognito ? ' and this incognito session lasts' : ''}. Do not repeat the whole content in your reply.`,
    isError: false,
  };
}
