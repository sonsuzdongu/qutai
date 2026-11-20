import type { Tab } from '../browser/Tab';
import { isIncognitoAttachment } from '../chat/attachments';
import {
  acceptsFile,
  bytesLabel,
  formatForAccept,
  formatLabel,
  imageFormatLabel,
  parseEditRequest,
} from '../chat/imageEdit';
import { modelFile, saveImageFileToPhotos } from '../device/attachments';
import { editImage, ImageEditError, UploadableImage, uploadableImage } from '../device/imageEdit';
import { PermissionDeniedError } from '../device/settings';
import { uiLabel } from './uiLabels';
import { t } from '../i18n';
import type { ToolContext, ToolOutput } from './executeTool';
import { declinedNotice, settingNotice } from './stepLine';
import { findAttachment } from './fileTools';
import { siteKey } from './sitePolicy';
import { newNonce } from '../utils/ids';

/**
 * edit_image: crop, rotate, flip, resize and re-encode an image of this conversation on the phone. The result is a
 * new image with its own id (shown to the user as a card); the source stays as it is. Nothing leaves the phone, so
 * it needs no confirmation, and the model gets text only: it can look at the result with view_attachment.
 */
export async function editImageTool(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  if (!ctx.offerImage) return { content: 'Image editing is not available here.', isError: true };
  const found = findAttachment(input, ctx, 'image');
  if ('content' in found) return found;
  const req = parseEditRequest(input);
  if (typeof req === 'string') return { content: `${req} Nothing was made.`, isError: true };
  const tab = ctx.browser.getTab(ctx.agentTab.id);
  // An edit made in a conversation that touched incognito tabs, or of an incognito image, lives only as long as the
  // incognito session.
  const incognito = !!(ctx.privacy?.touchedIncognito || tab?.incognito || isIncognitoAttachment(found.id));
  try {
    const { info, steps, notes, format } = await editImage(found, req, incognito);
    ctx.offerImage(info);
    const from = found.width && found.height ? ` from ${found.id} (${found.width}×${found.height})` : ` from ${found.id}`;
    return {
      content:
        `Made image id=${info.id} "${info.name}"${from}: ${info.width}×${info.height} ${formatLabel(format)}, ` +
        `${bytesLabel(info.size)} (${info.size} bytes).\nSteps: ${steps.join('; ')}.` +
        (notes.length ? `\nNote: ${notes.join(' ')}` : '') +
        '\nIt is shown to the user as a card; nothing was sent anywhere and the original is unchanged. Call ' +
        'view_attachment with the new id to look at it, upload_image to put it into a file field, or edit_image ' +
        'on it again.',
      isError: false,
    };
  } catch (e) {
    if (e instanceof ImageEditError) return { content: `${e.message} Nothing was made.`, isError: true };
    return {
      content: `The image could not be edited: ${e instanceof Error ? e.message : String(e)}. Nothing was made.`,
      isError: true,
    };
  }
}

/** What the page script says about the element upload_image was given (fileTarget). */
export type FileTarget =
  | { kind: 'frame'; origin: string }
  | { kind: 'probe'; element: string }
  | {
      kind: 'input';
      how: string;
      element: string;
      field: string;
      accept: string;
      multiple: boolean;
      disabled: boolean;
      required: boolean;
    };

/** What the page did with the file (fileAssign). */
export type AssignResult =
  | { ok: false; reason: 'accept'; accept: string }
  | { ok: false; reason: 'disabled' }
  | {
      ok: true;
      mode: 'input' | 'drop';
      how: string;
      field: string;
      detached: boolean;
      handled: boolean;
      holds: boolean;
      multiple: boolean;
      preview: boolean;
      nameShown: boolean;
      foreignFrame: boolean;
      errors: string[];
    };

/** Base64 characters per message to the page (a multiple of 4, so each piece decodes on its own). */
const CHUNK = 384 * 1024;

function acceptError(accept: string, mimeType: string): ToolOutput {
  const format = formatForAccept(accept);
  return {
    content:
      `The field accepts only ${accept}, and this image is ${imageFormatLabel(mimeType)}. ` +
      (format
        ? `Make a ${formatLabel(format)} copy with edit_image (format "${format}") and upload that.`
        : 'None of the formats edit_image makes (JPEG, PNG, WebP) is accepted there; tell the user.') +
      ' Nothing was given to the page.',
    isError: true,
  };
}

/**
 * When a page can't take the file (a custom uploader that ignores it, a frame from another site, a page that is not
 * https): with the user's OK the prepared image goes to Photos under its name, and the model tells the user to pick
 * it with the site's own button.
 */
async function photosFallback(
  ctx: ToolContext,
  image: UploadableImage,
  preview: string,
  why: string,
  incognito: boolean,
): Promise<ToolOutput> {
  if (!ctx.confirmImage) return { content: `${why} Tell the user to upload it themselves.`, isError: true };
  const body = t('upload.fallbackBody', { name: image.name });
  const ok = await ctx.confirmImage({
    title: t('upload.fallbackTitle'),
    // Photos outlive the incognito session; the user is told before choosing.
    message: incognito ? `${body}\n\n${t('upload.fallbackIncognito')}` : body,
    image: { uri: preview, aspectRatio: image.width / image.height },
    confirmText: t('upload.fallbackSave'),
  });
  if (!ok) {
    return {
      content:
        `${why} The user chose not to save it to their photo library. Tell them they can save it with the ` +
        `${uiLabel('chat.imageSave')} button on the image's card and choose it with the site's own upload button.`,
      isError: true,
    };
  }
  try {
    const saved = await saveImageFileToPhotos(image.file, image.name);
    return {
      content:
        `${why} With the user's OK the prepared image was saved to their photo library as "${saved}" (the newest ` +
        'photo). ' +
        `Tell the user to tap the site's own upload button and choose "${saved}", and to tell you when it is done.`,
      isError: true,
    };
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return {
        content:
          `${why} Saving to the photo library was refused: the user has not allowed Qutai to add photos. Offer them ` +
          "(with ask_user) to open Qutai's page in the phone's settings with open_settings, or to use the " +
          `${uiLabel('chat.imageSave')} button on the image's card.`,
        isError: true,
      };
    }
    return { content: `${why} Saving to the photo library failed too: ${e instanceof Error ? e.message : String(e)}.`, isError: true };
  }
}

/** A random one-time token for a transfer (not secret from the app, unknown to the page). */
function token(): string {
  return newNonce();
}

/**
 * Sends the file to the page script in pieces and has it put into the field; aborts the transfer on failure. Shared
 * by upload_image and upload_file (src/agent/shareTools.ts).
 */
export async function transfer(
  tab: Tab,
  image: { file: { base64(): Promise<string>; size: number }; name: string; mimeType: string },
  ref: unknown,
): Promise<AssignResult> {
  const id = token();
  const data = await image.file.base64();
  try {
    await tab.run('fileBegin', [id, image.file.size]);
    for (let i = 0, n = 0; i < data.length; i += CHUNK, n++) await tab.run('fileChunk', [id, n, data.slice(i, i + CHUNK)], 20000);
    return await tab.run<AssignResult>('fileAssign', [id, ref, image.name, image.mimeType], 20000);
  } catch (e) {
    await tab.run('fileAbort', []).catch(() => {});
    throw e;
  }
}

/**
 * upload_image: gives an image of this conversation (attached by the user, or an edit of one) to a file field on the
 * page, after the user confirms with the image, its size and the site in front of them, every time. Only ids from
 * this conversation's manifest exist here, so page content can't name anything else (screenshots and other tabs have
 * no id). https pages only; never across the incognito boundary. The form is not submitted.
 */
export async function uploadImageTool(input: Record<string, unknown>, ctx: ToolContext, tab: Tab): Promise<ToolOutput> {
  if (!ctx.confirmImage) return { content: "This needs the user's confirmation, which is not available here.", isError: true };
  const found = findAttachment(input, ctx, 'image');
  if ('content' in found) return found;
  const ref = input.ref;
  if (ref === undefined || ref === null || ref === '')
    return { content: 'Give the ref of the file field, or of the button or drop zone the site uses for uploads.', isError: true };
  const host = siteKey(tab.url) ?? tab.url;
  if (isIncognitoAttachment(found.id) !== tab.incognito) {
    return {
      content: tab.incognito
        ? `Not allowed: ${found.id} belongs to a normal conversation and this tab is incognito; Qutai doesn't move ` +
          'images across the incognito boundary. Tell the user they can attach it again in this incognito tab.'
        : `Not allowed: ${found.id} was attached in incognito and this tab is not incognito; Qutai doesn't move ` +
          'images out of incognito. Tell the user to upload it in an incognito tab, or attach it again here.',
      isError: true,
      notice: settingNotice(t('step.incognitoFiles')),
    };
  }

  let target: FileTarget;
  try {
    target = await tab.run<FileTarget>('fileTarget', [ref]);
  } catch (e) {
    return { content: e instanceof Error ? e.message : String(e), isError: true };
  }
  const outgoingMime = found.derivedFrom ? found.mimeType : found.mimeType === 'image/png' || found.mimeType === 'image/webp' ? found.mimeType : 'image/jpeg';
  if (target.kind === 'input') {
    if (target.disabled) return { content: `The file field (${target.field || target.element}) is disabled. Read the page again: it may need another step first.`, isError: true };
    const name = found.derivedFrom ? found.name : `x.${outgoingMime.split('/')[1].replace('jpeg', 'jpg')}`;
    if (!acceptsFile(target.accept, name, outgoingMime)) return acceptError(target.accept, outgoingMime);
  }

  let image: UploadableImage;
  try {
    image = await uploadableImage(found);
  } catch (e) {
    return { content: e instanceof ImageEditError ? e.message : `The image could not be prepared: ${String(e)}`, isError: true };
  }
  const preview = modelFile(found.id)?.uri ?? image.file.uri;
  try {
    if (!/^https:\/\//i.test(tab.url))
      return await photosFallback(ctx, image, preview, `Images are only given to https pages, and ${host} is not one; nothing was given to it.`, tab.incognito);
    if (target.kind === 'frame')
      return await photosFallback(
        ctx,
        image,
        preview,
        `The uploader is inside a frame from another site${target.origin ? ` (${target.origin})` : ''}, which Qutai can't reach; nothing was given to it.`,
        tab.incognito,
      );
    const what = `"${image.name}" (${image.width}×${image.height} ${imageFormatLabel(image.mimeType)}, ${bytesLabel(image.file.size)})`;
    const allowed = await ctx.confirmImage({
      title: t('upload.confirmTitle', { host }),
      message: t('upload.confirmBody', {
        name: image.name,
        size: `${image.width}×${image.height}`,
        bytes: bytesLabel(image.file.size),
        host,
      }),
      image: { uri: preview, aspectRatio: image.width / image.height },
      confirmText: t('upload.confirmGive'),
    });
    if (!allowed) return { content: `The user declined giving ${what} to ${host}. Ask them how to proceed.`, isError: true, notice: declinedNotice() };

    const result = await transfer(tab, image, ref);
    if (!result.ok) {
      if (result.reason === 'accept') return acceptError(result.accept, image.mimeType);
      return { content: 'The file field is disabled. Read the page again: it may need another step first.', isError: true };
    }
    if (result.mode === 'drop' && !result.handled) {
      return await photosFallback(
        ctx,
        image,
        preview,
        result.foreignFrame
          ? `The uploader there is inside a frame from another site, which Qutai can't reach; nothing was given to it.`
          : `No file field was found for that element, and it ignored a dropped file: the site's uploader doesn't take files from Qutai.`,
        tab.incognito,
      );
    }
    ctx.imageUsed?.(found.id);
    const lines =
      result.mode === 'input'
        ? [
            `Put ${what} into ${result.field || 'the file field'} on ${host} (${result.how}${result.detached ? ': a field the page made when its button was clicked' : ''}).`,
            result.holds
              ? 'The field now holds the file.'
              : 'The field no longer holds it: the page took the file and cleared the field, as many uploaders do.',
          ]
        : [`Dropped ${what} on that element on ${host}; the page took the drop.`];
    if (result.preview) lines.push('A preview image appeared on the page.');
    if (result.nameShown) lines.push('The page shows the file name.');
    if (result.multiple) lines.push('The field takes several files; this one replaced its selection.');
    if (result.errors.length) {
      lines.push(
        `The page reports:\n${result.errors.map((e) => `- ${e}`).join('\n')}\nMeet these with edit_image (dimensions, ` +
          'format, max_bytes) and upload the new copy.',
      );
    } else if (!result.preview && !result.nameShown && !(result.mode === 'input' && result.holds)) {
      lines.push('No preview or message is visible yet: check with read_page or view_screenshot.');
    } else lines.push('No error is shown.');
    lines.push('Nothing was submitted; submitting the form is a separate step under the usual rules.');
    return { content: lines.join('\n'), isError: false };
  } catch (e) {
    return { content: `The image could not be given to the page: ${e instanceof Error ? e.message : String(e)}`, isError: true };
  } finally {
    if (image.temporary && image.file.exists) image.file.delete();
  }
}
