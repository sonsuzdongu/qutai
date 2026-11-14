import { isIncognitoAttachment } from '../chat/attachments';
import { bytesLabel, formatLabel, parseEditRequest } from '../chat/imageEdit';
import { editImage, ImageEditError } from '../device/imageEdit';
import type { ToolContext, ToolOutput } from './executeTool';
import { findAttachment } from './fileTools';

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
        'view_attachment with the new id to look at it, or edit_image on it again.',
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
