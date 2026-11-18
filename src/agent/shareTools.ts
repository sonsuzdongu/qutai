import { Platform } from 'react-native';
import type { Tab } from '../browser/Tab';
import { isIncognitoAttachment } from '../chat/attachments';
import { acceptsFile } from '../chat/imageEdit';
import {
  isComposedId,
  listShareables,
  pickShareables,
  textTravelsWithFiles,
  type Shareable,
  type ShareApp,
} from '../chat/shareable';
import { composedFileContent } from '../device/composedFile';
import { OutgoingError, outgoingErrorText, prepareOutgoing } from '../device/outgoing';
import { MAX_WHATSAPP_BODY, normalizeWhatsAppNumber } from '../device/whatsapp';
import { t } from '../i18n';
import { formatSize } from '../i18n/format';
import type { ToolContext, ToolOutput } from './executeTool';
import { declinedNotice, settingNotice } from './stepLine';
import { transfer, type FileTarget } from './imageTools';
import { siteKey } from './sitePolicy';
import { uiLabel } from './uiLabels';
import { cutText } from '../utils/wellFormed';
import { contactForUse } from './contactTool';

/**
 * Tools that hand the conversation's files to someone else, always through a step the user completes:
 * draft_email (the mail composer, or the share sheet when there is none), share (a card whose button opens WhatsApp
 * or the share sheet) and upload_file (a web page's file field, after a confirmation every time). What may be handed
 * out is decided in src/chat/shareable.ts alone.
 */

/** Everything this conversation may hand out. */
export function conversationShareables(ctx: ToolContext): Shareable[] {
  return listShareables(ctx.attachments?.() ?? [], ctx.composedFiles?.() ?? []);
}

/** Whether the files must be treated as incognito (their copies go to the session-only folder). */
function incognitoHandout(ctx: ToolContext, items: Shareable[]): boolean {
  const tab = ctx.browser.getTab(ctx.agentTab.id);
  if (ctx.privacy?.touchedIncognito || tab?.incognito) return true;
  return items.some((s) => (isComposedId(s.id) ? composedIncognito(s.id) : isIncognitoAttachment(s.id)));
}

function composedIncognito(id: string): boolean {
  try {
    return composedFileContent(id).incognito;
  } catch {
    return false;
  }
}

/** "photo.jpg", "Offer.pdf" for results and cards. */
function names(items: Shareable[]): string {
  return items.map((s) => `"${s.name}"`).join(', ');
}

/** The user asked for the original file (with its metadata): only meaningful for images they attached. */
function wantsOriginal(input: Record<string, unknown>, items: Shareable[]): boolean {
  return input.original === true && items.some((s) => s.origin === 'attached' && s.kind === 'image');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * draft_email: the system composer with the draft and the named files attached. The user sends it in the mail app;
 * nothing is sent by Qutai. Without a composer, files are never dropped: the share sheet opens with the files and
 * the text instead, and the result says so. A card in the chat lists the files that left the conversation.
 */
export async function draftEmailTool(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  if (!ctx.composeEmail) return { content: 'Email drafts are not available.', isError: true };
  const raw = Array.isArray(input.to) ? input.to : typeof input.to === 'string' ? [input.to] : [];
  // Contact handles (find_contact) become the real addresses here; the model never sees them, and the card shows the
  // person's name instead of the address (the composer shows the address).
  const to: string[] = [];
  const shownTo: string[] = [];
  const fromContacts: string[] = [];
  for (const entry of raw) {
    const contact = await contactForUse(entry, 'email', ctx);
    if (contact && !contact.ok) return contact.out;
    if (contact) {
      to.push(contact.value);
      shownTo.push(contact.name);
      fromContacts.push(`${contact.name} (${contact.label})`);
      continue;
    }
    const address = String(entry).trim();
    if (EMAIL_RE.test(address)) {
      to.push(address);
      shownTo.push(address);
    }
  }
  const contactsNote = fromContacts.length
    ? ` Recipients from the user's contacts: ${fromContacts.join(', ')}; the user sees the address in the composer.`
    : '';
  const picked = pickShareables(input.attachments, conversationShareables(ctx));
  if (!picked.ok) return { content: picked.error, isError: true };
  const items = picked.items;
  const subject = String(input.subject ?? '');
  const body = String(input.body ?? '');
  const original = wantsOriginal(input, items);
  try {
    const outcome = await ctx.composeEmail({ to, subject, body, attachments: items, incognito: incognitoHandout(ctx, items), original });
    if (items.length) {
      ctx.offerShare?.({
        app: 'email',
        subject,
        ...(shownTo.length ? { to: shownTo } : {}),
        files: items,
        delivered: outcome.route === 'share' ? 'share' : 'composer',
        ...(original ? { original } : {}),
        ...(outcome.route === 'share' && outcome.textCopied ? { copiesText: true } : {}),
      });
    }
    if (outcome.route === 'mailto')
      return {
        content: `The mail app was opened with the draft (no mail account is set up in the system composer). You cannot send it yourself.${contactsNote}`,
        isError: false,
      };
    const attached = items.length
      ? ` with ${items.length} file${items.length === 1 ? '' : 's'} attached: ${names(items)}` +
        (original ? ' (as the original files, metadata included)' : '')
      : '';
    if (outcome.route === 'share') {
      return {
        content:
          'No mail account is set up in the phone\'s system mail composer, and a mailto link cannot carry files, so ' +
          `the share sheet was opened instead${attached}, with the subject${outcome.textCopied ? ', and the body copied to the clipboard as well (some apps leave shared text out)' : ' and the body'}. ` +
          'The user picks their mail app there (e.g. Gmail), checks the recipient and sends it themselves. Tell the ' +
          `user this in those words; do not say it was sent.${contactsNote}`,
        isError: false,
      };
    }
    const status =
      Platform.OS === 'android'
        ? 'Android does not report whether the user sent it'
        : `the user's choice: ${outcome.status}`;
    return {
      content:
        `The email composer was shown${attached}; ${status}. A card in the chat lists the attached files. You ` +
        `cannot send it yourself.${contactsNote}`,
      isError: false,
    };
  } catch (e) {
    if (e instanceof OutgoingError) return { content: outgoingErrorText(e), isError: true };
    return { content: `Could not open the email composer: ${e instanceof Error ? e.message : String(e)}`, isError: true };
  }
}

/** The button a share card shows, by where it goes (AssistantPanel ShareCard). */
export function shareButtonKey(app: ShareApp) {
  return app === 'whatsapp' ? ('chat.shareToWhatsApp' as const) : ('chat.shareTo' as const);
}

/**
 * share: a card with the files (thumbnails or names), the text and a button; the user's tap opens WhatsApp (app
 * "whatsapp") or the share sheet, where the user picks the chat or app and sends. Nothing opens or is sent here.
 */
export function shareTool(input: Record<string, unknown>, ctx: ToolContext): ToolOutput {
  if (!ctx.offerShare) return { content: 'Sharing is not available here.', isError: true };
  const app: ShareApp = input.app === 'whatsapp' ? 'whatsapp' : 'any';
  const picked = pickShareables(input.attachments, conversationShareables(ctx));
  if (!picked.ok) return { content: picked.error, isError: true };
  const items = picked.items;
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  if (!items.length && !text) return { content: 'Give the files to share (attachments), the text, or both. Nothing was prepared.', isError: true };
  if (app === 'whatsapp' && !items.length)
    return {
      content:
        'For a text-only WhatsApp message use draft_whatsapp: it can open the chat with the number. share is for ' +
        'sending images or files. Nothing was prepared.',
      isError: true,
    };
  if (text.length > MAX_WHATSAPP_BODY)
    return { content: `The text is longer than ${MAX_WHATSAPP_BODY} characters; shorten it. Nothing was prepared.`, isError: true };
  let number: string | undefined;
  const rawPhone = typeof input.phone === 'string' ? input.phone.trim() : '';
  if (rawPhone && app === 'whatsapp') {
    const phone = normalizeWhatsAppNumber(rawPhone);
    if (!phone.ok) return { content: `${phone.error} Nothing was prepared.`, isError: true };
    number = phone.number;
  }
  const name = typeof input.name === 'string' ? cutText(input.name.replace(/\s+/g, ' ').trim(), 80) : '';
  const original = wantsOriginal(input, items);
  const copiesText = !!text && items.length > 0 && !textTravelsWithFiles(Platform.OS, app);
  ctx.offerShare({
    app,
    files: items,
    ...(text ? { text } : {}),
    ...(number ? { number } : {}),
    ...(name ? { name } : {}),
    ...(original ? { original } : {}),
    ...(copiesText ? { copiesText } : {}),
  });

  const lines = [
    `A card is shown in the chat with ${items.length ? `${items.length} file${items.length === 1 ? '' : 's'} (${names(items)})` : 'the text'}` +
      `${items.length && text ? ' and the text' : ''} and a ${uiLabel(shareButtonKey(app))} button. Nothing has been sent or opened: ` +
      (app === 'whatsapp'
        ? 'the user taps the button, WhatsApp opens, and the user picks the chat and sends it there.'
        : 'the user taps the button, picks an app in the share sheet, and sends it there.'),
  ];
  if (items.length) {
    lines.push(
      app === 'whatsapp'
        ? `With files, WhatsApp lets the user choose the chat; Qutai cannot open a specific chat${number ? ` (${number} is shown on the card so the user can find it)` : ''}. Do not say it will go to ${name || 'a named contact'} automatically.`
        : 'The user chooses the recipient in the app they pick; Qutai cannot choose it.',
    );
  }
  if (copiesText) {
    lines.push(
      Platform.OS === 'ios'
        ? 'On iPhone an app may leave out text shared with files, so the tap also copies the text: the user pastes it if it is missing. Tell them.'
        : 'Not every app keeps text shared with files, so the tap also copies the text: the user pastes it if it is missing. Tell them.',
    );
  } else if (items.length && text && app === 'whatsapp') {
    lines.push('On Android the text goes with the files as the caption.');
  }
  if (original) lines.push('The images go out as the original files, with their metadata (such as the place a photo was taken).');
  return { content: lines.join('\n'), isError: false };
}

/** Who a share went to, for the action history: the app, never the files, text or number. */
export function shareLog(input: Record<string, unknown>): string {
  return t(input.app === 'whatsapp' ? 'action.shareLoggedWhatsApp' : 'action.shareLogged');
}

/**
 * upload_file: puts a PDF or composed file of this conversation into a web page's file field (webmail's attach
 * control, a form), with the same transfer as upload_image and a confirmation every time naming the file and the
 * site. https pages only; never across the incognito boundary. Nothing is submitted or sent.
 */
export async function uploadFileTool(input: Record<string, unknown>, ctx: ToolContext, tab: Tab): Promise<ToolOutput> {
  if (!ctx.confirmImage) return { content: "This needs the user's confirmation, which is not available here.", isError: true };
  const id = String(input.id ?? '').trim();
  const picked = pickShareables(id ? [id] : [], conversationShareables(ctx));
  if (!picked.ok) return { content: picked.error, isError: true };
  const item = picked.items[0];
  if (!item) return { content: 'Give the id of the file to upload.', isError: true };
  if (item.kind === 'image') return { content: `${item.id} is an image: use upload_image for images.`, isError: true };
  const ref = input.ref;
  if (ref === undefined || ref === null || ref === '')
    return { content: 'Give the ref of the file field, or of the attach button or drop zone the site uses.', isError: true };
  const host = siteKey(tab.url) ?? tab.url;
  const itemIncognito = isComposedId(item.id) ? composedIncognito(item.id) : isIncognitoAttachment(item.id);
  if (itemIncognito !== tab.incognito) {
    return {
      content: tab.incognito
        ? `Not allowed: ${item.id} belongs to a normal conversation and this tab is incognito; Qutai doesn't move files across the incognito boundary.`
        : `Not allowed: ${item.id} was made or attached in incognito and this tab is not incognito; Qutai doesn't move files out of incognito.`,
      isError: true,
      notice: settingNotice(t('step.incognitoFiles')),
    };
  }
  const save = saveHint(item);
  if (!/^https:\/\//i.test(tab.url))
    return { content: `Files are only given to https pages, and ${host} is not one; nothing was given to it. ${save}`, isError: true };

  let target: FileTarget;
  try {
    target = await tab.run<FileTarget>('fileTarget', [ref]);
  } catch (e) {
    return { content: e instanceof Error ? e.message : String(e), isError: true };
  }
  if (target.kind === 'frame')
    return {
      content: `The uploader is inside a frame from another site${target.origin ? ` (${target.origin})` : ''}, which Qutai can't reach; nothing was given to it. ${save}`,
      isError: true,
    };
  if (target.kind === 'input') {
    if (target.disabled) return { content: `The file field (${target.field || target.element}) is disabled. Read the page again: it may need another step first.`, isError: true };
    if (!acceptsFile(target.accept, item.name, item.mimeType))
      return { content: `The field accepts only ${target.accept}, and "${item.name}" is ${item.mimeType}. Nothing was given to the page.`, isError: true };
  }

  const allowed = await ctx.confirmImage({
    title: t('uploadFile.confirmTitle', { host }),
    message: t('uploadFile.confirmBody', { name: item.name, bytes: formatSize(item.size), host }),
    confirmText: t('uploadFile.confirmGive'),
  });
  const what = `"${item.name}" (${formatSize(item.size)})`;
  if (!allowed) return { content: `The user declined giving ${what} to ${host}. Ask them how to proceed.`, isError: true, notice: declinedNotice() };

  let prepared: Awaited<ReturnType<typeof prepareOutgoing>> | null = null;
  try {
    prepared = await prepareOutgoing([item], { incognito: tab.incognito });
    const file = prepared.files[0];
    const { File } = await import('expo-file-system');
    const result = await transfer(tab, { file: new File(file.uri), name: file.name, mimeType: file.mimeType }, ref);
    if (!result.ok) {
      if (result.reason === 'accept') return { content: `The field accepts only ${result.accept}. Nothing was given to the page.`, isError: true };
      return { content: 'The file field is disabled. Read the page again: it may need another step first.', isError: true };
    }
    if (result.mode === 'drop' && !result.handled) {
      return {
        content:
          `No file field was found for that element, and it ignored a dropped file: the site's uploader doesn't take ` +
          `files from Qutai; nothing was given to it. ${save}`,
        isError: true,
      };
    }
    const lines =
      result.mode === 'input'
        ? [
            `Put ${what} into ${result.field || 'the file field'} on ${host} (${result.how}).`,
            result.holds ? 'The field now holds the file.' : 'The field no longer holds it: the page took the file and cleared the field, as many uploaders do.',
          ]
        : [`Dropped ${what} on that element on ${host}; the page took the drop.`];
    if (result.nameShown) lines.push('The page shows the file name (for webmail: the attachment appears in the draft).');
    if (result.errors.length) lines.push(`The page reports:\n${result.errors.map((e) => `- ${e}`).join('\n')}`);
    else if (!result.nameShown && !(result.mode === 'input' && result.holds))
      lines.push('No file name or message is visible yet: check with read_page or view_screenshot.');
    lines.push('Nothing was submitted or sent; sending is a separate step under the usual rules, normally done by the user.');
    return { content: lines.join('\n'), isError: false };
  } catch (e) {
    if (e instanceof OutgoingError) return { content: outgoingErrorText(e), isError: true };
    return { content: `The file could not be given to the page: ${e instanceof Error ? e.message : String(e)}`, isError: true };
  } finally {
    prepared?.dispose();
  }
}

/** What the user can do instead when a page can't take the file: its card's buttons, by their labels. */
function saveHint(item: Shareable): string {
  const button =
    item.origin === 'attached'
      ? 'file they attached (it is already on their phone)'
      : Platform.OS === 'android'
        ? `${uiLabel('chat.fileSave')} button on its card (to put it in a folder)`
        : `${uiLabel('chat.fileShareIos')} button on its card (then "Save to Files")`;
  if (item.origin === 'attached')
    return `Tell the user to choose "${item.name}" with the site's own attach button (it is the ${button}), or send it with draft_email or share instead.`;
  return (
    `Tell the user they can save "${item.name}" with the ${button} and choose it with the site's own attach ` +
    'button, or send it with draft_email or share instead.'
  );
}
