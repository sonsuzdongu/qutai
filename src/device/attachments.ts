import { Directory, File, FileMode, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { t } from '../i18n';
import {
  AttachmentInfo,
  fitWithin,
  isIncognitoAttachment,
  MODEL_JPEG_QUALITY,
  MODEL_LONG_EDGE,
  MODEL_MAX_BYTES,
  newAttachmentId,
} from '../chat/attachments';
import { ensureMediaPermission } from './mediaPermissions';
import { safeFileName } from './download';
import { PermissionDeniedError } from './settings';

/**
 * The files behind attachments (see src/chat/attachments.ts for what the conversation keeps).
 *
 * Each attachment has a folder named by its id holding `original.<ext>` (the file as picked, untouched) and, for
 * images, `model.jpg` / `model.png` (the copy sent to the AI: orientation applied, metadata such as EXIF location
 * stripped by re-encoding, longest side ≤ MODEL_LONG_EDGE, ≤ MODEL_MAX_BYTES). Normal conversations keep them in
 * the app's documents folder until nothing refers to them (pruneAttachments: after a chat is cleared, after "Clear
 * browsing data" clears chats, and at start for conversations that are gone). Incognito conversations keep them in
 * a cache folder that is emptied when the incognito session ends and at every start. Not part of the encrypted
 * backup.
 */

type PickerModule = typeof import('expo-image-picker');
type ManipulatorModule = typeof import('expo-image-manipulator');

/** Attaching isn't possible: the build lacks the module, or the file can't be used. */
export class AttachmentError extends Error {}

// Loaded on first use, so an older development build still starts (and says a newer build is needed).
async function picker(): Promise<PickerModule> {
  try {
    return await import('expo-image-picker');
  } catch {
    throw new AttachmentError(t('attach.needsBuild'));
  }
}

/** expo-image-manipulator, loaded on first use (also for image edits, src/device/imageEdit.ts). */
export async function manipulator(): Promise<ManipulatorModule> {
  try {
    return await import('expo-image-manipulator');
  } catch {
    throw new AttachmentError(t('attach.needsBuild'));
  }
}

const NORMAL_DIR = 'attachments';
const INCOGNITO_DIR = 'attachments-incognito';

function root(incognito: boolean): Directory {
  const dir = incognito ? new Directory(Paths.cache, INCOGNITO_DIR) : new Directory(Paths.document, NORMAL_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function folderOf(id: string): Directory {
  return new Directory(root(isIncognitoAttachment(id)), id);
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};

function extensionOf(name: string, mime: string): string {
  return EXTENSIONS[mime] ?? (/\.([a-z0-9]{2,5})$/i.exec(name)?.[1]?.toLowerCase() || 'bin');
}

function mimeOf(name: string, given?: string | null): string {
  if (given && given !== 'application/octet-stream') return given.toLowerCase();
  const ext = /\.([a-z0-9]{2,5})$/i.exec(name)?.[1]?.toLowerCase();
  const found = Object.entries(EXTENSIONS).find(([, e]) => e === (ext === 'jpeg' ? 'jpg' : ext));
  return found?.[0] ?? 'application/octet-stream';
}

/** The untouched file (to show, share or save it, and for tools that act on the original). */
export function originalFile(id: string): File | null {
  const dir = folderOf(id);
  if (!dir.exists) return null;
  const file = dir.list().find((f): f is File => f instanceof File && f.name.startsWith('original.'));
  return file ?? null;
}

/** The copy made for the model (images only), or null when it is gone. */
export function modelFile(id: string): File | null {
  const dir = folderOf(id);
  if (!dir.exists) return null;
  for (const name of ['model.jpg', 'model.png']) {
    const file = new File(dir, name);
    if (file.exists) return file;
  }
  return null;
}

/** Whether the files of an attachment are still on the phone. */
export function attachmentAvailable(id: string): boolean {
  return originalFile(id) !== null;
}

/** Recently read model copies (base64), so a task's steps don't read the same files again. */
const dataCache = new Map<string, string>();
const DATA_CACHE_SIZE = 12;

/** The model's copy as base64, or null when the file is gone. */
export async function modelImageData(id: string): Promise<string | null> {
  const cached = dataCache.get(id);
  if (cached) {
    dataCache.delete(id);
    dataCache.set(id, cached);
    return cached;
  }
  const file = modelFile(id);
  if (!file) return null;
  const data = await file.base64();
  dataCache.set(id, data);
  while (dataCache.size > DATA_CACHE_SIZE) dataCache.delete(dataCache.keys().next().value!);
  return data;
}

type Picked = { uri: string; name?: string | null; mimeType?: string | null; width: number; height: number; size?: number };

/** Copies a picked image into its folder and makes the model's copy. */
async function importImage(picked: Picked, incognito: boolean, fallbackName: string): Promise<AttachmentInfo> {
  const id = newAttachmentId(incognito);
  const dir = folderOf(id);
  dir.create({ intermediates: true, idempotent: true });
  try {
    const mimeType = mimeOf(picked.name ?? '', picked.mimeType);
    const name = safeFileName(picked.name || `${fallbackName}.${extensionOf('', mimeType)}`, fallbackName);
    const original = new File(dir, `original.${extensionOf(name, mimeType)}`);
    new File(picked.uri).copySync(original);
    const model = await makeModelCopy(original.uri, mimeType === 'image/png', dir);
    // The picker's sizes can be those of the stored pixels; the model's copy shows how the image is displayed.
    let { width, height } = picked;
    if (!width || !height) ({ width, height } = model.decoded);
    else if (width > height !== model.width > model.height && width !== height) [width, height] = [height, width];
    return {
      id,
      kind: 'image',
      name,
      mimeType,
      size: original.size || picked.size || 0,
      width,
      height,
      model: { width: model.width, height: model.height, mimeType: model.mimeType, size: model.size },
    };
  } catch (e) {
    if (dir.exists) dir.delete();
    throw e;
  }
}

/**
 * The model's copy: decoded at a reduced size (a 48 MP photo is never held in memory at full size), orientation
 * applied by the decoder, scaled to fit MODEL_LONG_EDGE and re-encoded, which leaves out EXIF and other metadata.
 * A PNG stays PNG while it fits (screenshots stay sharp); otherwise JPEG at falling quality until it fits.
 */
export async function makeModelCopy(
  uri: string,
  png: boolean,
  dir: Directory,
): Promise<{ width: number; height: number; mimeType: 'image/jpeg' | 'image/png'; size: number; decoded: { width: number; height: number } }> {
  const { ImageManipulator, SaveFormat } = await manipulator();
  const decode = MODEL_LONG_EDGE * 2;
  const context = ImageManipulator.manipulate(uri, { maxWidth: decode, maxHeight: decode });
  let image = await context.renderAsync();
  const decoded = { width: image.width, height: image.height };
  const fit = fitWithin(image.width, image.height);
  if (fit.width !== image.width || fit.height !== image.height) {
    context.resize(image.width >= image.height ? { width: fit.width, height: null } : { width: null, height: fit.height });
    image = await context.renderAsync();
  }
  const attempts: { format: 'png' | 'jpeg'; compress: number }[] = [
    ...(png ? [{ format: 'png' as const, compress: 1 }] : []),
    ...MODEL_JPEG_QUALITY.map((compress) => ({ format: 'jpeg' as const, compress })),
  ];
  for (let i = 0; i < attempts.length; i++) {
    const { format, compress } = attempts[i];
    const saved = await image.saveAsync({ format: format === 'png' ? SaveFormat.PNG : SaveFormat.JPEG, compress });
    const file = new File(saved.uri);
    const last = i === attempts.length - 1;
    if (file.size <= MODEL_MAX_BYTES || last) {
      const target = new File(dir, format === 'png' ? 'model.png' : 'model.jpg');
      if (target.exists) target.delete();
      file.moveSync(target);
      return {
        width: saved.width,
        height: saved.height,
        mimeType: format === 'png' ? 'image/png' : 'image/jpeg',
        size: target.size,
        decoded,
      };
    }
    file.delete();
  }
  throw new AttachmentError(t('attach.failed'));
}

/**
 * Lets the user choose up to `limit` images with the system photo picker (no photo library permission: Android's
 * photo picker, iOS's PHPicker). iOS hands over a compatible JPEG instead of HEIC, which not every provider takes.
 * Resolves with the attachments made (none when cancelled).
 */
export async function pickImages(limit: number, incognito: boolean): Promise<AttachmentInfo[]> {
  const ImagePicker = await picker();
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 1,
    exif: false,
    base64: false,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled || !result.assets?.length) return [];
  const out: AttachmentInfo[] = [];
  for (const asset of result.assets.slice(0, limit)) {
    if (asset.type && asset.type !== 'image' && asset.type !== 'livePhoto') continue;
    out.push(
      await importImage(
        { uri: asset.uri, name: asset.fileName, mimeType: asset.mimeType, width: asset.width, height: asset.height, size: asset.fileSize },
        incognito,
        `image-${Date.now().toString(36)}`,
      ),
    );
  }
  return out;
}

/** Takes a photo with the system camera, after the camera permission (the same one the QR scanner and uploads use). */
export async function takePhoto(incognito: boolean): Promise<AttachmentInfo | null> {
  const ImagePicker = await picker();
  await ensureMediaPermission('camera');
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false, base64: false });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return importImage(
    { uri: asset.uri, name: null, mimeType: asset.mimeType ?? 'image/jpeg', width: asset.width, height: asset.height, size: asset.fileSize },
    incognito,
    `photo-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`,
  );
}

/** PDFs larger than this are not attached (or read): the reader holds the whole file in memory. */
export const MAX_PDF_BYTES = 30_000_000;

/**
 * Lets the user choose a PDF from Files (iOS) or the system document picker (Android); other kinds of document
 * are not offered. The file is copied into its attachment folder. Resolves null when cancelled.
 */
export async function pickPdf(incognito: boolean): Promise<AttachmentInfo | null> {
  let DocumentPicker: typeof import('expo-document-picker');
  try {
    DocumentPicker = await import('expo-document-picker');
  } catch {
    throw new AttachmentError(t('attach.needsBuild'));
  }
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const picked = new File(asset.uri);
  try {
    const size = asset.size ?? picked.size ?? 0;
    if (size > MAX_PDF_BYTES) throw new AttachmentError(t('attach.pdfTooLarge', { max: '30 MB' }));
    // Some providers of files report no type or a generic one; the file's first bytes decide.
    const head = picked.open(FileMode.ReadOnly);
    let isPdf = false;
    try {
      isPdf = String.fromCharCode(...head.readBytesSync(Math.min(1024, size || 1024))).includes('%PDF-');
    } finally {
      head.close();
    }
    if (!isPdf) throw new AttachmentError(t('attach.onlyPdf'));
    return importFile(picked, asset.name || 'document.pdf', 'application/pdf', size, incognito);
  } finally {
    // The picker's cache copy goes once ours is made.
    if (picked.exists && picked.uri.startsWith(Paths.cache.uri)) picked.delete();
  }
}

/** Copies a file the user chose (a PDF, or a downloaded file) into a new attachment folder, untouched. */
export function importFile(source: File, name: string, mimeType: string, size: number, incognito: boolean): AttachmentInfo {
  const id = newAttachmentId(incognito);
  const dir = folderOf(id);
  dir.create({ intermediates: true, idempotent: true });
  try {
    const safe = safeFileName(name, 'document');
    const original = new File(dir, `original.${extensionOf(safe, mimeType)}`);
    source.copySync(original);
    return { id, kind: mimeType === 'application/pdf' ? 'pdf' : 'image', name: safe, mimeType, size: original.size || size };
  } catch (e) {
    if (dir.exists) dir.delete();
    throw e;
  }
}

/**
 * Keeps the result of an image edit (a temporary file already free of metadata) as an attachment of its own: the
 * file becomes its `original.<ext>` and the model's copy is made from it, as for an attached image. Same folders,
 * same pruning, same incognito rules as attachments; `derivedFrom` names the image it was made from.
 */
export async function storeEditedImage(
  file: File,
  meta: { name: string; mimeType: string; width: number; height: number; derivedFrom: string; edits: string },
  incognito: boolean,
): Promise<AttachmentInfo> {
  const id = newAttachmentId(incognito);
  const dir = folderOf(id);
  dir.create({ intermediates: true, idempotent: true });
  try {
    const original = new File(dir, `original.${extensionOf(meta.name, meta.mimeType)}`);
    file.moveSync(original);
    const model = await makeModelCopy(original.uri, meta.mimeType !== 'image/jpeg', dir);
    return {
      id,
      kind: 'image',
      name: meta.name,
      mimeType: meta.mimeType,
      size: original.size,
      width: meta.width,
      height: meta.height,
      model: { width: model.width, height: model.height, mimeType: model.mimeType, size: model.size },
      derivedFrom: meta.derivedFrom,
      edits: meta.edits,
    };
  } catch (e) {
    if (dir.exists) dir.delete();
    throw e;
  }
}

/**
 * Keeps a PDF Qutai made (save_pdf, or an answer saved as a PDF) as an attachment of the conversation, so it can be
 * shared, attached to an email or uploaded later: same folders, pruning and incognito rules as attachments. The
 * temporary file is moved in.
 */
export function storeMadePdf(file: File, name: string, made: 'page' | 'report', incognito: boolean): AttachmentInfo {
  const id = newAttachmentId(incognito);
  const dir = folderOf(id);
  dir.create({ intermediates: true, idempotent: true });
  try {
    const original = new File(dir, 'original.pdf');
    file.moveSync(original);
    return { id, kind: 'pdf', name: safeFileName(name, 'document.pdf'), mimeType: 'application/pdf', size: original.size, made };
  } catch (e) {
    if (dir.exists) dir.delete();
    throw e;
  }
}

/** Removes an attachment's files right away (a thumbnail removed before sending). */
export function deleteAttachment(id: string) {
  dataCache.delete(id);
  const dir = folderOf(id);
  if (dir.exists) dir.delete();
}

/**
 * Deletes the files of attachments nothing refers to any more. `keep`: ids in saved conversations, in open ones and
 * in messages being written. Incognito folders are checked only against open conversations (they are never saved).
 */
export function pruneAttachments(keep: Set<string>) {
  for (const incognito of [false, true]) {
    const dir = root(incognito);
    for (const entry of dir.list()) {
      if (entry instanceof Directory && !keep.has(entry.name)) {
        dataCache.delete(entry.name);
        entry.delete();
      }
    }
  }
}

/** The incognito session ended (or the app starts): attachments of incognito conversations go. */
export function forgetIncognitoAttachments() {
  const dir = new Directory(Paths.cache, INCOGNITO_DIR);
  for (const id of [...dataCache.keys()]) if (isIncognitoAttachment(id)) dataCache.delete(id);
  if (dir.exists) dir.delete();
}

/** Opens the share sheet with the original file. */
export async function shareAttachment(info: AttachmentInfo): Promise<void> {
  const file = originalFile(info.id);
  if (!file) throw new AttachmentError(t('attach.gone'));
  await Sharing.shareAsync(file.uri, { mimeType: info.mimeType, dialogTitle: info.name });
}

/**
 * Android: copies an attachment's file (a PDF Qutai made) into a folder the user picks through the system picker.
 * Resolves false when they cancel.
 */
export async function saveAttachmentToFolder(info: AttachmentInfo): Promise<boolean> {
  const file = originalFile(info.id);
  if (!file) throw new AttachmentError(t('attach.gone'));
  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch {
    return false;
  }
  if (!dir) return false;
  const target = dir.createFile(info.name, info.mimeType);
  target.write(await file.bytes());
  return true;
}

/**
 * Adds an image file to the photo library (add-only permission, as for saved screenshots) under `name`: a copy named
 * so is what the library gets, so the user finds "photo-1024x1024.jpg", not "original.jpg". Resolves with the name.
 */
export async function saveImageFileToPhotos(file: File, name: string): Promise<string> {
  const { Asset, requestPermissionsAsync } = await import('expo-media-library');
  const permission = await requestPermissionsAsync(true, ['photo']);
  if (!permission.granted) throw new PermissionDeniedError(t('error.photosPermission'), permission.canAskAgain);
  const dir = new Directory(Paths.cache, `qutai-photo-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  dir.create({ intermediates: true, idempotent: true });
  try {
    const named = new File(dir, name);
    file.copySync(named);
    await Asset.create(named.uri);
    return name;
  } finally {
    if (dir.exists) dir.delete();
  }
}

/** Adds the original image to the photo library under the attachment's name. Resolves with that name. */
export async function saveAttachmentToPhotos(info: AttachmentInfo): Promise<string> {
  const file = originalFile(info.id);
  if (!file) throw new AttachmentError(t('attach.gone'));
  return saveImageFileToPhotos(file, safeFileName(info.name, `image.${extensionOf('', info.mimeType)}`));
}
