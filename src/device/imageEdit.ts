import { FilterMode, ImageFormat, MipmapMode, Skia, type SkImage } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import type { AttachmentInfo } from '../chat/attachments';
import {
  bytesLabel,
  decodeScale,
  defaultFormat,
  EditPlan,
  EditRequest,
  editedName,
  fitToBudget,
  FORMAT_EXT,
  FORMAT_MIME,
  formatLabel,
  mapRect,
  mayHaveAlpha,
  OutputFormat,
  planEdit,
  Size,
} from '../chat/imageEdit';
import { manipulator, originalFile, storeEditedImage } from './attachments';

/**
 * Image edits on the phone (edit_image and the "Resize or crop" sheet). Nothing is sent anywhere and the source is
 * left as it is. The geometry is planned in src/chat/imageEdit.ts; here:
 *
 * 1. expo-image-manipulator decodes the source (the original file: its EXIF orientation is applied by the decoder,
 *    so the pixels are as the picture is displayed; HEIC is decoded by the platform), at a reduced size when the
 *    result needs less detail (so a 48 MP photo is never held twice), then crops, rotates and flips it and writes
 *    that piece to a temporary file (PNG when the source can be transparent, otherwise JPEG at full quality). Re-encoding
 *    leaves every bit of metadata (EXIF, GPS, maker notes) behind.
 * 2. Skia draws the piece at the output size on a CPU surface: halving steps with bilinear filtering (an exact 2×2
 *    average at each step) while the piece is twice the output or more, then one bicubic draw (Mitchell, B = C = 1/3)
 *    for the rest; Catmull-Rom when enlarging; plain pixel copy when the size is already right. A 4000 px photo made
 *    256 px is thus averaged down, never sampled, and shows no aliasing. A JPEG gets the background colour under
 *    transparent pixels.
 * 3. Skia encodes JPEG, PNG or WebP (its encoders write no EXIF), lowering quality and then size for maxBytes.
 */

export class ImageEditError extends Error {}

export type EditOutcome = {
  info: AttachmentInfo;
  format: OutputFormat;
  /** Steps done and notes, for the model. */
  steps: string[];
  notes: string[];
};

const MITCHELL = { B: 1 / 3, C: 1 / 3 };
const CATMULL_ROM = { B: 0, C: 1 / 2 };

function tempFile(ext: string): File {
  return new File(Paths.cache, `qutai-edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
}

/** Step 1: the cropped, rotated, flipped piece of the source, as a temporary file free of metadata. */
async function decodePiece(sourceUri: string, source: Size, plan: EditPlan, alpha: boolean): Promise<File> {
  const scale = decodeScale(plan, source);
  if (typeof scale === 'string') throw new ImageEditError(scale);
  const { ImageManipulator, SaveFormat, FlipType } = await manipulator();
  const edge = Math.ceil(Math.max(source.width, source.height) * scale.scale);
  const context = ImageManipulator.manipulate(sourceUri, scale.scale < 1 ? { maxWidth: edge, maxHeight: edge } : undefined);
  const refs: { release?: () => void }[] = [];
  try {
    const decoded = await context.renderAsync();
    refs.push(decoded);
    const size = { width: decoded.width, height: decoded.height };
    // The stored size is the displayed one; a decoded image of another shape means it is not what the plan was for.
    const expected = (source.width / source.height) * size.height;
    if (Math.abs(expected - size.width) > Math.max(2, size.width * 0.02))
      throw new ImageEditError('The image could not be read as expected (its size changed). Ask the user to attach it again.');
    const rect = mapRect(plan.region, source, size);
    const whole = rect.x === 0 && rect.y === 0 && rect.width === size.width && rect.height === size.height;
    if (!whole) context.crop({ originX: rect.x, originY: rect.y, width: rect.width, height: rect.height });
    if (plan.rotate) context.rotate(plan.rotate);
    if (plan.flipH) context.flip(FlipType.Horizontal);
    if (plan.flipV) context.flip(FlipType.Vertical);
    const piece = whole && !plan.rotate && !plan.flipH && !plan.flipV ? decoded : await context.renderAsync();
    if (piece !== decoded) refs.push(piece);
    const saved = await piece.saveAsync({ format: alpha ? SaveFormat.PNG : SaveFormat.JPEG, compress: 1 });
    return new File(saved.uri);
  } finally {
    for (const ref of refs) ref.release?.();
    (context as { release?: () => void }).release?.();
  }
}

function surfaceOf(size: Size) {
  const surface = Skia.Surface.Make(size.width, size.height);
  if (!surface) throw new ImageEditError('Not enough memory to resize this image.');
  return surface;
}

/**
 * The first half of step 2: `image` halved while it is at least twice `size` both ways (each step averages 2×2
 * pixels: bilinear sampling exactly between them), as a raster image even when no step is needed, so that drawing
 * it again (to meet maxBytes) never decodes the file again. The caller disposes the result.
 */
function halveTowards(image: SkImage, size: Size): SkImage {
  let current = image;
  do {
    const next =
      current.width() >= size.width * 2 && current.height() >= size.height * 2
        ? { width: Math.max(size.width, Math.round(current.width() / 2)), height: Math.max(size.height, Math.round(current.height() / 2)) }
        : current === image
          ? { width: image.width(), height: image.height() }
          : null;
    if (!next) break;
    const surface = surfaceOf(next);
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('transparent'));
    canvas.drawImageRectOptions(
      current,
      Skia.XYWHRect(0, 0, current.width(), current.height()),
      Skia.XYWHRect(0, 0, next.width, next.height),
      next.width === current.width() ? FilterMode.Nearest : FilterMode.Linear,
      MipmapMode.None,
      Skia.Paint(),
    );
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    surface.dispose();
    if (current !== image) current.dispose();
    current = snapshot;
  } while (current.width() >= size.width * 2 && current.height() >= size.height * 2);
  return current;
}

/**
 * Step 2: `image` drawn at `size`: halving steps first, then one bicubic draw (Mitchell when reducing, Catmull-Rom
 * when enlarging) or a plain copy at the same size; `background` under transparent pixels (JPEG). The caller
 * disposes the result.
 */
function resample(image: SkImage, size: Size, background: string | null): SkImage {
  const halved = image.width() >= size.width * 2 && image.height() >= size.height * 2 ? halveTowards(image, size) : image;
  try {
    const surface = surfaceOf(size);
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color(background ?? 'transparent'));
    const src = Skia.XYWHRect(0, 0, halved.width(), halved.height());
    const dst = Skia.XYWHRect(0, 0, size.width, size.height);
    const paint = Skia.Paint();
    if (halved.width() === size.width && halved.height() === size.height) {
      canvas.drawImageRectOptions(halved, src, dst, FilterMode.Nearest, MipmapMode.None, paint);
    } else {
      const enlarging = size.width > halved.width() || size.height > halved.height();
      const { B, C } = enlarging ? CATMULL_ROM : MITCHELL;
      canvas.drawImageRectCubic(halved, src, dst, B, C, paint);
    }
    surface.flush();
    const result = surface.makeImageSnapshot();
    surface.dispose();
    return result;
  } finally {
    if (halved !== image) halved.dispose();
  }
}

const SKIA_FORMAT: Record<OutputFormat, ImageFormat> = {
  jpeg: ImageFormat.JPEG,
  png: ImageFormat.PNG,
  webp: ImageFormat.WEBP,
};

type Encoded = { bytes: number; data: Uint8Array };

/**
 * Applies an edit to an image of the conversation and keeps the result as a new attachment (incognito when the
 * source or the conversation is). Throws ImageEditError with a message for the model.
 */
export async function editImage(source: AttachmentInfo, req: EditRequest, incognito: boolean): Promise<EditOutcome> {
  const file = originalFile(source.id);
  if (!file) throw new ImageEditError(`The image ${source.id} is no longer on this phone.`);
  if (!source.width || !source.height) throw new ImageEditError('The size of this image is unknown, so it cannot be edited.');
  const size = { width: source.width, height: source.height };
  const plan = planEdit(req, size);
  if (typeof plan === 'string') throw new ImageEditError(plan);
  const format = req.format ?? defaultFormat(source.mimeType);
  const alpha = mayHaveAlpha(source.mimeType);
  // Transparent pixels in a JPEG take the background colour; the other formats keep them.
  const background = format === 'jpeg' ? req.background : null;

  const piece = await decodePiece(file.uri, size, plan, alpha);
  let image: SkImage | null = null;
  const steps = [...plan.steps];
  const notes = [...plan.notes];
  try {
    const data = await Skia.Data.fromURI(piece.uri);
    const encoded = Skia.Image.MakeImageFromEncoded(data);
    if (!encoded) throw new ImageEditError('The image could not be decoded.');
    // Decoded once, into memory, and halved towards the output size (the budget may draw it several times).
    try {
      image = halveTowards(encoded, plan.out);
    } finally {
      encoded.dispose();
    }
    const decoded = image;
    const lossy = format !== 'png';
    const budget = await fitToBudget<Encoded>(
      // WebP at 100 would be lossless (and much larger); 99 keeps it lossy.
      { maxBytes: req.maxBytes, quality: format === 'webp' ? Math.min(req.quality, 99) : lossy ? req.quality : 100, lossy, size: plan.out },
      async (quality, outSize) => {
        const drawn = resample(decoded, outSize, background);
        try {
          const bytes = drawn.encodeToBytes(SKIA_FORMAT[format], quality);
          if (!bytes || bytes.length === 0) throw new ImageEditError(`This phone could not encode ${formatLabel(format)}.`);
          return { bytes: bytes.length, data: bytes };
        } finally {
          drawn.dispose();
        }
      },
    );
    if (typeof budget === 'string') throw new ImageEditError(budget);
    if (budget.scaled)
      steps.push(`made smaller to ${budget.size.width}×${budget.size.height} to stay under ${bytesLabel(req.maxBytes!)}`);
    if (alpha && format === 'jpeg') steps.push(`transparent areas filled with ${req.background}`);
    steps.push(
      lossy
        ? `encoded as ${formatLabel(format)} at quality ${budget.quality}${budget.qualityLowered ? ` (lowered from ${req.quality} to stay under ${bytesLabel(req.maxBytes!)})` : ''}`
        : `encoded as ${formatLabel(format)}`,
    );
    if (budget.scaled)
      notes.push(
        `To meet the size limit the image is now ${budget.size.width}×${budget.size.height}, not ${plan.out.width}×${plan.out.height}. ` +
          'If the form needs the exact dimensions, ask the user whether a lower quality or another format is acceptable.',
      );
    const out = tempFile(format === 'jpeg' ? 'jpg' : format);
    out.writeSync(budget.result.data);
    const name = editedName(source.name, budget.size, format);
    const info = await storeEditedImage(
      out,
      {
        name,
        mimeType: FORMAT_MIME[format],
        width: budget.size.width,
        height: budget.size.height,
        derivedFrom: source.id,
        edits: steps.join('; '),
      },
      incognito,
    ).finally(() => {
      if (out.exists) out.delete();
    });
    return { info, format, steps, notes };
  } finally {
    image?.dispose();
    if (piece.exists) piece.delete();
  }
}

export type UploadableImage = {
  file: File;
  name: string;
  mimeType: string;
  width: number;
  height: number;
  /** A copy made for this upload, which the caller deletes. */
  temporary: boolean;
};

/**
 * The file a web page gets for an image (upload_image), never with metadata: an edited image is one already (Skia
 * wrote it); an attached image is re-encoded at its full size in its format (JPEG for HEIC and others), which leaves
 * EXIF and GPS out. Larger than MAX_OUTPUT_PIXELS: an error asking for edit_image first.
 */
export async function uploadableImage(info: AttachmentInfo): Promise<UploadableImage> {
  const file = originalFile(info.id);
  if (!file) throw new ImageEditError(`The image ${info.id} is no longer on this phone.`);
  if (!info.width || !info.height) throw new ImageEditError('The size of this image is unknown.');
  const size = { width: info.width, height: info.height };
  if (info.derivedFrom) return { file, name: info.name, mimeType: info.mimeType, ...size, temporary: false };
  const format = defaultFormat(info.mimeType);
  const plan = planEdit(
    { gravity: 'center', rotate: 0, flipH: false, flipV: false, fit: 'fit', allowUpscale: false, quality: 95, background: '#ffffff' },
    size,
  );
  if (typeof plan === 'string')
    throw new ImageEditError(`${plan} Make a smaller copy with edit_image first, then upload that.`);
  const piece = await decodePiece(file.uri, size, plan, mayHaveAlpha(info.mimeType));
  try {
    const encoded = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(piece.uri));
    if (!encoded) throw new ImageEditError('The image could not be decoded.');
    let bytes: Uint8Array;
    try {
      bytes = encoded.encodeToBytes(SKIA_FORMAT[format], format === 'png' ? 100 : 95);
    } finally {
      encoded.dispose();
    }
    if (!bytes?.length) throw new ImageEditError(`This phone could not encode ${formatLabel(format)}.`);
    const out = tempFile(FORMAT_EXT[format]);
    out.writeSync(bytes);
    const base = info.name.replace(/\.[a-z0-9]{2,5}$/i, '') || 'image';
    return { file: out, name: `${base}.${FORMAT_EXT[format]}`, mimeType: FORMAT_MIME[format], ...size, temporary: true };
  } finally {
    if (piece.exists) piece.delete();
  }
}
