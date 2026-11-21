import type { Tab } from '../../browser/Tab';
import { Dimensions } from 'react-native';
import { renderPagePdf, renderPdfFromScreenshots, shareRenderedPdf, type RenderedPdf } from '../../device/pdf';
import { t } from '../../i18n';
import { captureForModel, saveFullPageScreenshot, saveScreenshot } from '../../device/screenshot';
import { formatSize } from '../../i18n/format';
import { PermissionDeniedError } from '../../device/settings';
import { speechText } from '../../chat/speechText';
import { speak, speakPage } from '../../device/speech';
import { errorNotice, pageErrorNotice } from '../stepLine';
import { sleep } from '../../utils/sleep';
import { screenshotStillValid, windowKey } from '../../ui/layout';
import { markBeforeAction } from '../actionMarker';
import { containsHidden } from '../hiddenValues';
import { hiddenLabel, hiddenValue, Memory } from '../memory';
import { gateFailedText, parseIndices, queryPage, type PageRunner } from '../pageFacts';
import { siteRulesTool } from '../siteRulesTool';
import { pageCustomTool } from '../pageCustomTool';
import { scriptTool } from '../scriptTool';
import { fenceUntrusted } from '../untrusted';
import { hiddenNeedlesFor, type PageSnapshot, type SourceSnapshot, normalizeUrl, showTab, pdfButtons } from './shared';
import type { ToolContext, ToolOutput } from '../executeTool';

/**
 * The page tools: reading the page and its source, navigating, clicking, typing, scrolling, screenshots, PDF and
 * reading aloud. They run in the assistant's tab once the call passed its checks (executeTool.ts).
 */

export function formatPage(tab: Tab, page: PageSnapshot, tool: 'read_page' | 'read_tab'): string {
  const header = [
    ...(tab.loadError ? [`Page failed to load: ${tab.loadError.description} (${tab.loadError.kind})`] : []),
    `Tab: ${tab.id}`,
    `URL: ${page.url}`,
    `Scroll: y=${page.scroll.y}, viewport=${page.scroll.viewportHeight}, page height=${page.scroll.pageHeight}`,
  ].join('\n');
  const more = tool === 'read_tab' ? `read_tab with tab_id=${tab.id} and` : 'read_page with';
  const note = page.truncated ? `\n[Content truncated. Call ${more} offset=${page.nextOffset} to read the rest.]` : '';
  const errors = page.formErrors?.length ? `\nForm errors:\n${page.formErrors.map((e) => `- ${e}`).join('\n')}` : '';
  // Everything the page wrote (its title, its form messages, its text) between untrusted-content markers (UNTR-21).
  return `${header}\n${fenceUntrusted(`Title: ${page.title}${errors}\n\n${page.content}`, 'page')}${note}`;
}

/**
 * Validation errors after type, select_option or a submitting click: on the field itself, or on its form after a
 * submit, so the model sees them without another read_page. Empty when there are none or the page has changed.
 */
export async function formReport(tab: Tab, ref: unknown, submitted: boolean): Promise<string> {
  try {
    const errors = await tab.run<string[]>('formReport', [ref, submitted], 3000);
    if (!errors.length) return '';
    const what = submitted ? 'The form reports errors' : 'The field reports an error';
    return `\n${what}:\n${errors.map((e) => `- ${e}`).join('\n')}\nFix these before submitting again.`;
  } catch {
    return '';
  }
}

export function formatSource(tab: Tab, source: SourceSnapshot, selector: string): string {
  const end = source.offset + source.content.length;
  const header = [
    `Tab: ${tab.id}`,
    `URL: ${source.url}`,
    selector ? `Selector: ${selector} (${source.matches ?? 0} element(s))` : 'HTML source from the DOM',
    `Characters ${source.offset}–${end} of ${source.total}`,
  ].join('\n');
  const args = selector ? `selector=${JSON.stringify(selector)} and ` : '';
  const note = source.truncated
    ? `\n[Content truncated. Call read_source with ${args}offset=${source.nextOffset} to read the rest.]`
    : '';
  return `${header}\n${fenceUntrusted(`Title: ${source.title}\n\n${source.content}`, 'source')}${note}`;
}

/**
 * For view_screenshot while hidden memories exist: fields showing a hidden value are made transparent for the capture
 * (the returned function restores them), and a hidden value elsewhere in the page's text refuses the screenshot. The
 * page only sends its field values and text to the app; no hidden value is sent into the page to look for.
 */
export async function maskHiddenForCapture(tab: Tab, ctx: ToolContext): Promise<{ restore: () => Promise<void> } | string> {
  const nothing = { restore: async () => {} };
  // One-time codes, card numbers and security codes on screen are made transparent for the capture, always.
  // Not knowing where they are is not "none": the capture is refused rather than taken unmasked.
  let secrets: number[];
  try {
    secrets = await queryPage(tab as unknown as PageRunner, 'secretFieldIndices', [], parseIndices, 3000);
  } catch (e) {
    return `Not captured: ${gateFailedText('which fields hold codes or card numbers', e)} Use read_page instead.`;
  }
  const needles = await hiddenNeedlesFor(ctx);
  if (!needles.length) {
    if (!secrets.length) return nothing;
    await tab.run('maskFields', [secrets], 3000);
    return { restore: () => tab.run('maskEnd', [], 3000).then(() => undefined, () => undefined) };
  }
  const screen = await tab.run<{ fields: string[]; text: string }>('screenFields', [], 5000);
  if (containsHidden(screen.text, needles)) {
    return (
      'Not captured: the page shows one of the user\'s hidden saved values as text, and a screenshot would show it ' +
      'to you. Use read_page instead (hidden values appear there as [hidden: …]).'
    );
  }
  const indices = [
    ...screen.fields.flatMap((value, i) => (containsHidden(value, needles) ? [i] : [])),
    ...secrets,
  ];
  if (!indices.length) return nothing;
  await tab.run('maskFields', [indices], 3000);
  return { restore: () => tab.run('maskEnd', [], 3000).then(() => undefined, () => undefined) };
}

/** The site-rule tools (agent/siteRulesTool.ts), on a web page only; a page that doesn't answer is reported. */
export async function siteRulesStep(name: string, input: Record<string, unknown>, ctx: ToolContext, tab: Tab): Promise<ToolOutput> {
  if (tab.isNewTab)
    return {
      content: 'This tab shows the new tab page; open a web page first.',
      isError: true,
      notice: errorNotice(t('step.noPage')),
    };
  try {
    return await siteRulesTool(name, input, ctx, tab);
  } catch (e) {
    return {
      content: `The page did not answer: ${e instanceof Error ? e.message : String(e)}`,
      isError: true,
      notice: errorNotice(t('step.pageNoAnswer')),
    };
  }
}

/** run_script (agent/scriptTool.ts). */
export async function scriptStep(_name: string, input: Record<string, unknown>, ctx: ToolContext, tab: Tab): Promise<ToolOutput> {
  try {
    return await scriptTool(input, ctx, tab);
  } catch (e) {
    return {
      content: `It did not work: ${e instanceof Error ? e.message : String(e)}`,
      isError: true,
      notice: errorNotice(t('step.scriptFailed')),
    };
  }
}

/** restyle_page and page_cookies (agent/pageCustomTool.ts). */
export async function pageCustomStep(name: string, input: Record<string, unknown>, ctx: ToolContext, tab: Tab): Promise<ToolOutput> {
  try {
    return await pageCustomTool(name, input, ctx, tab);
  } catch (e) {
    return {
      content: `It did not work: ${e instanceof Error ? e.message : String(e)}`,
      isError: true,
      notice: errorNotice(t(name === 'page_cookies' ? 'step.cookiesFailed' : 'step.pageNoAnswer')),
    };
  }
}

/**
 * The page tools of the assistant's tab (runTool in executeTool.ts calls this once the tab is awake and shows a page).
 * `hidden`: the hidden memory type enters instead of `text`, already checked and confirmed.
 */
export async function pageTool(name: string, input: Record<string, unknown>, ctx: ToolContext, tab: Tab, hidden?: Memory): Promise<ToolOutput> {
  const { browser } = ctx;
  try {
    // Shows the user where the step acts (and waits a moment for clicks and typing); changes nothing in the result.
    await markBeforeAction(tab, name, input);
    switch (name) {
      case 'read_page': {
        const page = await tab.run<PageSnapshot>('readPage', [input.offset ?? 0], undefined, ctx.signal);
        ctx.outbound?.notePage(page.content, page.url);
        return { content: formatPage(tab, page, 'read_page'), isError: false };
      }
      case 'read_source': {
        const selector = typeof input.selector === 'string' ? input.selector.trim() : '';
        const source = await tab.run<SourceSnapshot>('readSource', [input.offset ?? 0, selector], undefined, ctx.signal);
        return { content: formatSource(tab, source, selector), isError: false };
      }
      case 'navigate': {
        const url = normalizeUrl(input.url);
        await tab.navigate(url, ctx.signal);
        if (tab.loadError) {
          return {
            content: `Could not load ${url}: ${tab.loadError.description} (${tab.loadError.kind}).`,
            isError: true,
          };
        }
        return { content: `Opened ${tab.url || url}. Call read_page to see it.`, isError: false };
      }
      case 'go_back': {
        await tab.goBack(ctx.signal);
        return { content: `Went back. Now at ${tab.url}.`, isError: false };
      }
      case 'click': {
        const urlBefore = tab.url;
        const tabsBefore = new Set(browser.tabs.map((t) => t.id));
        const result = await tab.run<string>('click', [input.ref], undefined, ctx.signal);
        await tab.settle(ctx.signal);
        const opened = browser.tabs.find((t) => !tabsBefore.has(t.id));
        if (opened) {
          ctx.agentTab.id = opened.id;
          await opened.settle(ctx.signal);
          return {
            content: `${result} It opened a new tab (id=${opened.id}, ${opened.url}); you are now in it.`,
            isError: false,
          };
        }
        if (tab.url !== urlBefore) return { content: `${result} Page changed to ${tab.url}.`, isError: false };
        return { content: result + (await formReport(tab, input.ref, true)), isError: false };
      }
      case 'type': {
        const submit = input.submit === true;
        const urlBefore = tab.url;
        // A hidden value goes straight from memory to the page script, never into a result or a log.
        const result = await tab.run<string>('type', [
          input.ref,
          hidden ? hiddenValue(hidden) : String(input.text ?? ''),
          input.clear !== false,
          submit,
        ], undefined, ctx.signal);
        if (submit) await tab.settle(ctx.signal);
        // Pages often validate a moment after input; a submit that left the page has nothing to report.
        else await sleep(150, ctx.signal);
        const report = tab.url === urlBefore ? await formReport(tab, input.ref, submit) : '';
        if (hidden) {
          return {
            content:
              `Entered the saved ${hiddenLabel(hidden)} into ref=${String(input.ref)}${submit ? ' and submitted' : ''}; ` +
              `the value stays hidden from you.${report}`,
            isError: false,
          };
        }
        return { content: result + report, isError: false };
      }
      case 'select_option': {
        const result = await tab.run<string>('select', [input.ref, String(input.value ?? '')], undefined, ctx.signal);
        await sleep(300, ctx.signal);
        return { content: result + (await formReport(tab, input.ref, false)), isError: false };
      }
      case 'scroll': {
        const result = await tab.run<string>('scroll', [input.direction, input.amount ?? 1], undefined, ctx.signal);
        await sleep(400, ctx.signal);
        return { content: result, isError: false };
      }
      case 'scroll_to': {
        const result = await tab.run<string>('scrollTo', [input.ref], undefined, ctx.signal);
        return { content: result, isError: false };
      }
      case 'save_pdf': {
        let pdf: RenderedPdf;
        let cut = '';
        if (input.from_screenshots === true) {
          // Screens are captured from the view, so the tab has to be on screen.
          await showTab(ctx, tab);
          const shot = await renderPdfFromScreenshots(tab);
          pdf = shot;
          if (shot.truncated)
            cut = ` The page was very long, so only its first ${shot.screens} screens are in the PDF (the limit for endless pages).`;
        } else {
          pdf = await renderPagePdf(tab);
          if (pdf.imagesMissing > 0) cut = ` ${pdf.imagesMissing} image(s) could not be embedded.`;
        }
        const how = input.from_screenshots === true ? ' from screenshots' : '';
        if (!ctx.offerPdf) {
          await shareRenderedPdf(pdf);
          return { content: `Created "${pdf.fileName}"${how} (${pdf.pages} page(s)) and showed the share sheet to the user.${cut}`, isError: false };
        }
        const info = ctx.offerPdf(pdf);
        return {
          content:
            `Created "${info.name}"${how} (${pdf.pages} page(s), ${formatSize(info.size)}), id=${info.id}. It is shown in ` +
            `the chat as a card with ${pdfButtons()}; nothing was sent. It stays with this conversation: attach it ` +
            'to an email with draft_email, send it with share, or put it into a web page with upload_file, using ' +
            `this id.${cut}`,
          isError: false,
        };
      }
      case 'view_screenshot': {
        await showTab(ctx, tab);
        const mask = await maskHiddenForCapture(tab, ctx);
        if (typeof mask === 'string') return { content: mask, isError: true };
        let shot: Awaited<ReturnType<typeof captureForModel>>;
        try {
          shot = await captureForModel(tab);
        } finally {
          await mask.restore();
        }
        const { width, height, ...image } = shot;
        tab.modelScreenshotSize = { width, height, window: windowKey(Dimensions.get('window')) };
        return {
          content:
            `Screenshot of the visible area of ${tab.url} (${width}×${height} pixels). ` +
            'To click something that has no ref, call click_at with x and y in these pixels.',
          isError: false,
          images: [image],
        };
      }
      case 'click_at': {
        const size = tab.modelScreenshotSize;
        if (!size)
          return { content: 'Call view_screenshot first; click_at uses its pixel coordinates.', isError: true };
        if (!screenshotStillValid(size.window, Dimensions.get('window'))) {
          tab.modelScreenshotSize = null;
          return {
            content:
              'The screen turned or changed size after that screenshot, so its coordinates no longer match the page. ' +
              'Call view_screenshot again.',
            isError: true,
          };
        }
        const x = Number(input.x);
        const y = Number(input.y);
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > size.width || y > size.height) {
          return {
            content: `x and y must be inside the screenshot (0–${size.width}, 0–${size.height}).`,
            isError: true,
          };
        }
        const result = await tab.run<string>('clickAt', [x / size.width, y / size.height], undefined, ctx.signal);
        // The page may have changed; old coordinates are no longer reliable.
        tab.modelScreenshotSize = null;
        await tab.settle(ctx.signal);
        return { content: `${result}. Take a new screenshot to see the result.`, isError: false };
      }
      case 'read_aloud': {
        const text = typeof input.text === 'string' ? input.text.trim() : '';
        if (text) {
          // The text's own language decides the voice; the language the model named is only a hint.
          await speak(speechText(text), typeof input.language === 'string' ? input.language : undefined);
          return { content: `Started reading ${text.length} characters aloud.`, isError: false };
        }
        if (tab.isNewTab)
          return { content: 'No web page is loaded in this tab.', isError: true, notice: errorNotice(t('step.noPage')) };
        const page = await speakPage(tab);
        const note = page.truncated ? ' The page is long; only the beginning is read.' : '';
        return { content: `Started reading the page aloud (${page.chars} characters).${note}`, isError: false };
      }
      case 'save_screenshot': {
        await showTab(ctx, tab);
        if (input.full_page === true) {
          const shot = await saveFullPageScreenshot(tab);
          const saved =
            shot.images > 1
              ? `Saved a full-page screenshot to the user's photo library as ${shot.images} images, because the page ` +
                'is too long for one image on this phone; they are cut between screens.'
              : "Saved a full-page screenshot to the user's photo library as one image.";
          const cut = shot.truncated
            ? ` The page was very long; only its first ${shot.screens} screens were captured (the limit for endless pages).`
            : '';
          return { content: `${saved}${cut}`, isError: false };
        }
        await saveScreenshot(tab);
        return { content: "Saved a screenshot of the visible area to the user's photo library.", isError: false };
      }
      default:
        return { content: `Unknown tool: ${name}`, isError: true };
    }
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return {
        content:
          `Permission denied: ${e.message} Offer the user (with ask_user) to open Qutai's page in the phone's ` +
          'settings with open_settings (target system), where they can allow it.',
        isError: true,
      };
    }
    return { content: `Error: ${e instanceof Error ? e.message : String(e)}`, isError: true, notice: pageErrorNotice(e) };
  }
}
