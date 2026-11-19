# 21. Image editing and filters

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

The assistant can make edited copies of an image the user attached, entirely on the phone. It can crop, rotate, resize, convert, shrink to a file size, and apply filters such as greyscale or sharpen. It can also put an image into a web page's upload field. The user can edit images the same way without the assistant.

## How it works

1. The user attaches a photo and asks, for example, "make it square and under 1 MB", "greyscale, sharpen 30", or "upload it to this form".
2. The model calls `edit_image`. There is no AI request; the work happens on the phone. The steps always run in this order: crop (a rectangle, or an aspect ratio placed by gravity or centred on a focus point), rotate by quarter turns, flip, resize (fit, cover, exact, or one side), filters, background under transparency for JPEG, encode (JPEG, PNG or WebP at a quality), then the largest file size.
3. Filters (`filters: "greyscale, sharpen 30"`) are drawn after the geometry, in one Skia pass and a fixed order: auto enhance → brightness → contrast → saturation → warmth → greyscale → sepia → invert as one colour matrix, then blur or sharpen.
4. The result is a new attachment with its own id, shown in the chat as a card with a preview, size, format and bytes, plus Save to Photos and Share. The model gets text only, for example "brightness +25 (×1.25)", "sharpened (40)" and any clamping. It can look at the result with `view_attachment`.
5. Without the assistant, the full-screen preview has **Edit**. It offers:
   - shape (original, square, 4:3, 16:9);
   - longest side (2048, 1024 or 512) or an exact size;
   - a largest file size;
   - Filters: presets (Original, Auto enhance, Greyscale, Sepia, Sharpen, Brighter, More contrast, Blur), a slider per amount, Reset, and a live preview on a copy at most 900 px across (touch and hold shows the original).

   The copy is attached to the message being written.
6. To upload, the model calls `upload_image` with the image id and the file field (or its label, button or drop zone). Qutai asks every time: "Give this image to <site>?", showing the image, its size and bytes. The page gets the file and Qutai reports the page's preview and validation errors. Qutai never submits the form.
7. Some pages can't receive the file: a non-https page, an uploader inside a frame from another site, or an uploader that ignores the file. In those cases the user may save the prepared image to Photos and pick it with the site's own button.

## The rules

- **`IMG-1`** `edit_image` works only on the phone. It makes no AI request and sends nothing anywhere.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/device/imageEdit.ts (expo-image-manipulator and Skia on the phone); src/agent/imageTools.ts (editImageTool) · Source: README › Editing images; cf41b06
- **`IMG-3`** An image is never enlarged unless the request explicitly allows it (`allow_upscale`).
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: README › Editing images; item32 hand-over note
- **`IMG-6`** Edited images carry no EXIF or GPS data, because Skia's encoders write none. Attached originals are re-encoded without EXIF before an upload.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded (location must not leave with a photo) · Enforced: In the app: src/device/imageEdit.ts (Skia encode); src/agent/imageTools.ts (uploadableImage) · Source: README › Editing images, Uploading images
- **`IMG-8`** An edit made in a conversation that touched incognito, or an edit of an incognito image, lives only as long as the incognito session.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/imageTools.ts (editImageTool incognito check) · Source: src/agent/imageTools.ts
- **`IMG-9`** A conversation keeps its 12 newest edited images. Older ones that nothing depends on lose their files, and their cards say so.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/chat/attachments.ts (MAX_EDITED_IMAGES); src/chat/Conversation.ts (addEditedImage)
- **`IMG-15`** `upload_image` asks every time, whatever the site's setting. The dialog shows the image, its size, bytes and the site, and has no "don't ask again".
  Status: Default (manager or implementing session; open to change) · Why: an image leaving the phone is the user's decision each time · Enforced: In the app: src/agent/imageTools.ts (uploadImageTool, ctx.confirmImage); upload_image is in ALWAYS_CONFIRMED in src/agent/executeTool.ts and is not a kind in src/agent/alwaysAllow.ts · Source: README › Uploading images; a987554
- **`IMG-16`** Only images from this conversation can be uploaded: ones the user attached, or edits of them. Screenshots, other tabs, downloads and PDFs have no image id and are refused.
  Status: Default (manager or implementing session; open to change) · Why: page content must not be able to make the assistant hand out other files · Enforced: In the app: src/agent/imageTools.ts (findAttachment with kind "image") · Source: README › Uploading images
- **`IMG-17`** The assistant never uploads because a page asks. It only uploads when the user wants it.
  Status: Default (manager or implementing session; open to change) · Why: page text is untrusted · Enforced: Prompt only: src/agent/systemPrompt.ts; the app does not check who asked, but IMG-15 and IMG-16 always apply · Source: src/agent/systemPrompt.ts
- **`IMG-18`** An image never crosses the incognito boundary. An incognito image can't go into a normal tab, and a normal one can't go into an incognito tab.
  Status: Default (manager or implementing session; open to change) · Why: Qutai doesn't move images across the incognito boundary · Enforced: In the app: src/agent/imageTools.ts (uploadImageTool, isIncognitoAttachment) · Source: README › Uploading images
- **`IMG-19`** Images go only to https pages. A non-https page, an uploader in a frame from another site, or an uploader that ignores the file falls back to "save to Photos". Saving needs the user's confirmation, and in incognito the user is told that Photos outlive the incognito session.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/imageTools.ts (uploadImageTool, photosFallback) · Source: README › Uploading images
- **`IMG-20`** `upload_image` is refused in these cases:
  - on "Read only" and "Blocked" sites;
  - on a disabled field;
  - where the field's `accept` list doesn't take the format; the error names the accepted types and the `edit_image` format to use.

  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/sitePolicy.ts (upload_image in WRITE_ACTIONS); src/agent/imageTools.ts (acceptError, disabled check) · Source: README › Uploading images
- **`IMG-21`** `upload_image` never submits the form. Submitting is a separate step under the usual confirmation rules.
  Status: Default (manager or implementing session; open to change) · Why: sending stays the user's step · Enforced: In the app: the page script only assigns the file and fires input and change events (src/browser/pageScript.ts, fileAssign); the result says nothing was submitted (src/agent/imageTools.ts) · Source: README › Uploading images
- **`IMG-23`** The action history records only that an image was given to a site and where, never the image.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/agent/executeTool.ts (LOGGED_TOOLS)
- **`IMG-24`** Video editing (the other half of the 18 Nov media request) is postponed.
  Status: Owner, 2026-11-19 · Why: reason not recorded · Source: TODO.md (image filters entry); cc5711d

## Details

**Editing steps and limits**

- (was `IMG-2`) The steps always run in a fixed order: crop → rotate → flip → resize → filters → JPEG background → encode → size budget. This holds whatever order the request names them in. · Where: README › Editing images; src/chat/imageEdit.ts (planEdit)
- (was `IMG-4`) Size limits:
  - at most 50 MP decoded, with a clear error above that;
  - at most 24 MP in between steps;
  - at most 4096×4096 (about 16.7 MP) out.

  A largest file size is met by lowering quality (not below 40), then scaling down. The smallest allowed budget is 2048 bytes and the smallest edge 32 px. The default quality is 90.

  Where: src/chat/imageEdit.ts (MAX_DECODE_PIXELS, MAX_INTERMEDIATE_PIXELS, MAX_OUTPUT_PIXELS, MIN_BUDGET_QUALITY, MIN_MAX_BYTES, MIN_BUDGET_EDGE, DEFAULT_QUALITY)
- (was `IMG-5`) Resampling uses halving steps (exact 2×2 averages) down to within 2× of the target, then one bicubic draw (Mitchell; Catmull-Rom when enlarging). · Why: so a 4000 px photo made 256 px is not aliased · Where: README › Editing images; src/device/imageEdit.ts
- (was `IMG-7`) Each result is an attachment of its own (a new id, `derivedFrom` its source), with the same folder, pruning, incognito and backup rules as attachments. · Where: README › Editing images; item32 hand-over note

**Filters**

- (was `IMG-10`) Filter amounts are whole numbers, clamped with a note to the model:
  - brightness, contrast, saturation and warmth: −100…100 (named without a number: +25);
  - sharpen: 0…100 (named: 40);
  - blur: 0…100 (named: 20);
  - greyscale, sepia, invert and auto: on or off;
  - blur and sharpen are never both applied.

  Where: src/chat/imageFilters.ts (RANGES); 2cc1a3d
- (was `IMG-11`) Colour filters are one 4×5 colour matrix on unpremultiplied colours, clamped once at the end. Alpha is untouched, and sharpen ignores fully transparent neighbours. · Why: transparency must stay as it was · Where: README › Image filters; src/device/filterRender.ts
- (was `IMG-12`) Sharpen is a 3×3 unsharp mask written as a small runtime shader. · Why: CanvasKit (used for the tests in Node) lacks the matrix-convolution filter, and the shader works on both · Where: image-filters hand-over note; src/device/filterRender.ts
- (was `IMG-13`) Auto enhance is only a levels stretch. It measures the luminance of a copy at most 128 px wide, clips 0.5 % at each end, and applies the same gain and offset to R, G and B, with a gain of at most 2. It does nothing when the picture already spans 2–253. · Where: README › Image filters
- (was `IMG-14`) The tool result and the cards say in words what was done ("Greyscale, sharpened"), in the app's language for cards, along with any clamping. · Where: src/chat/filterSummary.ts; eacd51e

**Upload transfer**

- (was `IMG-22`) The bytes go to the page only after the user confirms. They travel in 384 KB base64 pieces over the tab's authenticated command channel, into a closure of the page script under a one-time token. The page sees nothing until a `File` is built and assigned. · Where: src/browser/pageScript.ts (fileBegin, fileChunk, fileAssign); README › Uploading images

## Limits and what is not built

- Video editing is postponed by the owner.
- Filters are not verified on Android, with screen readers, with large text, or through the assistant path on a device. The edit sheet was checked on the iOS simulator.
- `upload_image` was checked in headless Chromium and WebKit against a test page, not on a phone.
- On the simulator, the system photo picker closed right after opening when the message field had focus. A local workaround was not committed; this should be checked on a real iPhone.
- The privacy policies have no image-editing sentence and no source asks for one (attached images were already covered).

## Where it lives

- [README.md](../../README.md) › Editing images, Image filters, Uploading images.
- `src/chat/imageEdit.ts`, `src/chat/imageFilters.ts`, `src/chat/filterSummary.ts` (pure logic).
- `src/device/imageEdit.ts`, `src/device/filterRender.ts` (drawing on the phone).
- `src/agent/imageTools.ts`, `src/browser/pageScript.ts` (upload transfer).
- `src/components/AttachmentViews` (the Edit sheet).
- Tests: `npm run test:image`.

## Disagreements between sources

- The output limit is given three ways: README says "16 MP at most", the item32 note says "≤16.7 MP", and the code uses 4096×4096 (`MAX_OUTPUT_PIXELS`, about 16.78 MP). This is only a rounding difference.
