import type { Tab } from '../browser/Tab';
import { t } from '../i18n';
import type { ToolContext, ToolOutput } from './executeTool';
import {
  ApprovalGrants,
  approvedText,
  checkPress,
  contentToApprove,
  declinedText,
  isPublicText,
  changeNeedsApprovalText,
  PAY_BY_POINT_TEXT,
  pageUrl,
  parseApprovalInput,
  payNeedsApprovalText,
  paymentsOffText,
  publishEnterFirstText,
  publishFirstText,
  rememberedText,
  sameText,
  secretFieldText,
  type Grant,
  type SecretKind,
  type PublishAction,
} from './outwardApproval';
import {
  gateFailedText,
  parseChangeInfo,
  parseEnterFacts,
  parseFieldText,
  parseFormValues,
  parseFound,
  parsePressContext,
  parsePressFacts,
  parsePressInfo,
  parseSecretField,
  parseTextOrNull,
  queryPage,
  type ChangeInfo,
  type FormValue,
  type PageRunner,
  type PressInfo,
} from './pageFacts';
import { changePress, payPress, type ChangeAction } from './pressContext';
import { siteKey } from './sitePolicy';
import { declinedNotice, errorNotice, settingNotice } from './stepLine';
import { uiPath } from './uiLabels';

/** What the publish or pay dialog shows: read from the page by Qutai, not taken from the model. */
export type OutwardApproval =
  | {
      kind: 'publish';
      site: string;
      action: PublishAction;
      /** The site button's label, as read from the page. */
      button: string;
      /** The field's text (publish with a field) or the form's values (a form). */
      text?: string;
      fields?: { label: string; value: string }[];
      incognito: boolean;
      /**
       * The dialog may offer "Post on {site} without asking" (PAY-29): an http(s) site in an ordinary tab. The task
       * still leaves it out when its conversation touched an incognito tab.
       */
      canRemember: boolean;
    }
  | {
      kind: 'pay';
      site: string;
      button: string;
      total: string;
      /** The line of the page the total was found on ("Order total: €24.99"). */
      totalLine: string;
      items: string;
      paymentMethod: string;
      recurring: string | null;
      incognito: boolean;
    }
  | {
      kind: 'change';
      site: string;
      action: ChangeAction;
      button: string;
      /** The page's heading (or the dialog's), its confirm dialog's text, the list row or card the button is in. */
      heading: string;
      dialog: string;
      item: string;
      fields?: { label: string; value: string }[];
      incognito: boolean;
    };

const ask = <T>(tab: Tab, command: string, args: unknown[], parse: (raw: unknown) => T) =>
  queryPage(tab as unknown as PageRunner, command, args, parse);

/** A check that could not run: refused, with the step line of a changed approval. */
function failed(what: string, e: unknown): ToolOutput {
  return { content: gateFailedText(what, e), isError: true, notice: errorNotice(t('step.checkFailed')) };
}

const fieldLines = (fields: FormValue[]) => fields.map((f) => `${f.label}: ${f.value}`);

function paymentsSetting(): string {
  return uiPath('settings.title', 'settings.assistant', 'settings.payments');
}

/** Payments are off: the step line and the result telling the model to hand over. */
function paymentsOff(button: string | null): ToolOutput {
  return { content: paymentsOffText(button, paymentsSetting()), isError: true, notice: settingNotice(t('step.paymentsOff')) };
}

/** request_approval: reads the page, shows the dialog, and on Approve grants one press of the button. */
export async function requestApprovalTool(input: Record<string, unknown>, ctx: ToolContext, tab: Tab): Promise<ToolOutput> {
  const parsed = parseApprovalInput(input);
  if ('error' in parsed) return { content: parsed.error, isError: true };
  const request = parsed.request;
  if (!ctx.approvals || !ctx.confirmOutward)
    return {
      content: "Qutai's approval dialog is not available here, so this can't be sent or paid. Tell the user to press the button themselves.",
      isError: true,
    };
  const site = siteKey(tab.url) ?? tab.url;
  let info: PressInfo | null;
  try {
    info = await ask(tab, 'pressInfo', [request.buttonRef], parsePressInfo);
  } catch (e) {
    return { content: gateFailedText('the button', e), isError: true };
  }
  if (!info) return { content: `ref=${request.buttonRef} was not found. Call read_page again.`, isError: true };
  if (info.disabled)
    return {
      content: `"${info.label}" is disabled: the site doesn't take it yet. Fill in what it needs (read_page shows it), then ask again.`,
      isError: true,
    };
  const base = { tabId: tab.id, url: pageUrl(tab.url), buttonRef: request.buttonRef };
  const incognito = tab.incognito;

  if (request.kind === 'pay') {
    if (!ctx.paymentsAllowed?.()) return paymentsOff(info.label);
    let found;
    try {
      found = await ask(tab, 'findText', [request.total], parseFound);
    } catch (e) {
      return { content: gateFailedText('the total on the page', e), isError: true };
    }
    if (!found)
      return {
        content: `"${request.total}" is not on the page as written. Give total exactly as the page shows it (amount and currency).`,
        isError: true,
      };
    const approved = await ctx.confirmOutward({
      kind: 'pay',
      site,
      button: info.label,
      total: request.total,
      totalLine: found.line,
      items: request.items,
      paymentMethod: request.paymentMethod,
      recurring: request.recurring,
      incognito,
    });
    if (!approved) return { content: declinedText('pay'), isError: true, notice: declinedNotice() };
    // The setting may have been turned off while the dialog was open.
    if (!ctx.paymentsAllowed?.()) return paymentsOff(info.label);
    ctx.approvals.add({ ...base, kind: 'pay', total: request.total, totalRef: found.ref, totalLine: found.line });
    return { content: approvedText('pay', request.buttonRef, info.label), isError: false };
  }

  if (request.kind === 'change') {
    let change: ChangeInfo;
    try {
      change = await ask(tab, 'changeInfo', [request.buttonRef], parseChangeInfo);
    } catch (e) {
      return { content: gateFailedText('what the button changes', e), isError: true };
    }
    const fields = change.fields?.length ? change.fields : undefined;
    const approved = await ctx.confirmOutward({
      kind: 'change',
      site,
      action: request.action,
      button: change.label,
      heading: change.heading,
      dialog: change.dialog,
      item: change.item,
      ...(fields ? { fields } : {}),
      incognito,
    });
    if (!approved) return { content: declinedText('change'), isError: true, notice: declinedNotice() };
    ctx.approvals.add({
      ...base,
      kind: 'change',
      label: change.label,
      ...(change.dialog ? { dialog: change.dialog } : {}),
      ...(fields ? { fields: fieldLines(fields) } : {}),
    });
    return { content: approvedText('change', request.buttonRef, change.label), isError: false };
  }

  let grant: Grant;
  let shown: { text?: string; fields?: FormValue[] };
  if (request.fieldRef) {
    let field: { text: string; secret: boolean };
    try {
      field = await ask(tab, 'fieldText', [request.fieldRef], parseFieldText);
    } catch (e) {
      return { content: gateFailedText('the text field', e), isError: true };
    }
    if (field.secret) return { content: 'That is a password field: it is never sent with an approval.', isError: true };
    if (!field.text.trim())
      return { content: `The field ref=${request.fieldRef} is empty: type the text first, then ask again.`, isError: true };
    if (!sameText(field.text, request.text))
      return {
        content:
          `The field shows "${field.text.slice(0, 500)}", not the text you gave. Nothing was asked. Type the text again ` +
          '(or give exactly what the field shows), then call request_approval again.',
        isError: true,
      };
    grant = { ...base, kind: 'publish', fieldRef: request.fieldRef, text: field.text };
    shown = { text: field.text };
  } else {
    let fields: FormValue[] | null;
    try {
      fields = await ask(tab, 'formValues', [request.buttonRef], parseFormValues);
    } catch (e) {
      return { content: gateFailedText("the button's form", e), isError: true };
    }
    if (!fields?.length)
      return {
        content: 'The button is not in a form with filled fields. Give field_ref (the field with the text) and text.',
        isError: true,
      };
    grant = { ...base, kind: 'publish', fields: fieldLines(fields) };
    shown = { fields };
  }
  const enter = request.fieldRef === request.buttonRef;
  // The user chose "Post on {site} without asking" (PAY-29): the text was read and matched above, and the press is
  // checked again before it happens (checkPress), as after the dialog. Never in an incognito tab, and the task's own
  // check (ctx.postingRemembered) also leaves out incognito conversations, Read only and Blocked sites.
  const canRemember = !incognito && siteKey(tab.url) !== null;
  if (canRemember && ctx.postingRemembered?.(site)) {
    ctx.approvals.add(grant);
    return {
      content: rememberedText(site, request.buttonRef, info.label, enter),
      isError: false,
      notice: settingNotice(t('step.postRemembered', { site })),
    };
  }
  const approved = await ctx.confirmOutward({
    kind: 'publish',
    site,
    action: request.action,
    button: info.label,
    ...shown,
    incognito,
    canRemember,
  });
  if (!approved) return { content: declinedText('publish'), isError: true, notice: declinedNotice() };
  ctx.approvals.add(grant);
  return { content: approvedText('publish', request.buttonRef, info.label, enter), isError: false };
}

export type PressGate =
  | { kind: 'none' }
  | { kind: 'approved' }
  | { kind: 'refuse'; output: ToolOutput };

/**
 * Before click or click_at: an approved press is checked against what the user approved and used up; a final payment
 * button without an approval is refused (left to the user when payments are off). `point`: click_at's position as
 * fractions of the visible area.
 */
export async function pressGate(
  name: 'click' | 'click_at',
  input: Record<string, unknown>,
  ctx: ToolContext,
  tab: Tab,
  point: { fx: number; fy: number } | null,
): Promise<PressGate> {
  const ref = typeof input.ref === 'number' ? input.ref : Number(input.ref);
  const grant = name === 'click' && Number.isInteger(ref) ? (ctx.approvals?.take(tab.id, ref) ?? null) : null;
  if (grant) {
    let state;
    try {
      state = await pressState(grant, ctx, tab);
    } catch (e) {
      return { kind: 'refuse', output: failed('the approved press', e) };
    }
    const check = checkPress(grant, state);
    if (check.ok) return { kind: 'approved' };
    return { kind: 'refuse', output: { content: check.reason, isError: true, notice: errorNotice(t('step.approvalChanged')) } };
  }
  const args = name === 'click' ? [ref] : point ? [null, point.fx, point.fy] : null;
  if (!args) return { kind: 'none' };
  // What the press is, from the page's context (agent/pressContext.ts): the final step of a payment, deleting
  // something, or changing account or security settings.
  // A page that throws, is slow or answers nonsense is refused: nothing is pressed unchecked.
  let press;
  let facts;
  try {
    press = await ask(tab, 'pressContext', args, parsePressContext);
    facts = await ask(tab, 'pressComposed', args, parsePressFacts);
  } catch (e) {
    return { kind: 'refuse', output: failed('what this press does', e) };
  }
  const pay = payPress(press);
  if (pay.pay) {
    if (!ctx.paymentsAllowed?.()) return { kind: 'refuse', output: paymentsOff(press.label) };
    return {
      kind: 'refuse',
      output: { content: name === 'click' ? payNeedsApprovalText(press.label, pay.why) : PAY_BY_POINT_TEXT, isError: true },
    };
  }
  const change = changePress(press);
  if (change.change) {
    return {
      kind: 'refuse',
      output: {
        content: changeNeedsApprovalText(name === 'click' ? ref : null, press.label, change.change, change.why),
        isError: true,
        notice: settingNotice(t('step.changeFirst')),
      },
    };
  }
  // A press that would send text the assistant typed (its form's button, or one in the same composer box).
  const field = contentToApprove(facts);
  if (!field) return { kind: 'none' };
  return {
    kind: 'refuse',
    output: {
      content: publishFirstText(name === 'click' ? ref : null, facts.label, field),
      isError: true,
      notice: settingNotice(t('step.publishFirst')),
    },
  };
}

/** Stands in for a hidden value where a field is judged: long enough and in words, so a one-line field counts too. */
const HIDDEN_AS_PROSE = 'a hidden saved value';

const HIDDEN_ENTER_TEXT =
  "Nothing was typed. A hidden saved value is never sent with Enter from a field for a message, comment or other free " +
  "text: the user allowed it for this site's own form fields, not for something other people read. If the user asked " +
  'for exactly this, tell them to enter it themselves.';

/**
 * Before type with submit (Enter): an approval given for Enter in this field (button_ref = the field) is checked and
 * used up; Enter in a field that will hold free text to send, without one, is refused before anything is typed.
 *
 * `hidden`: the text is a hidden saved value (an ID or passport number, a locked memory), typed by the app. The
 * user allowed it for the site, not for a message to other people, and the publish dialog can't show it, so Enter in
 * a field for free text is always refused for it; in a form's own field (a number, a name, a search) it goes on as
 * before (PAY-30).
 */
export async function enterGate(input: Record<string, unknown>, ctx: ToolContext, tab: Tab, hidden = false): Promise<PressGate> {
  const ref = typeof input.ref === 'number' ? input.ref : Number(input.ref);
  if (!Number.isInteger(ref)) return { kind: 'none' };
  if (hidden) {
    let hiddenFacts;
    try {
      hiddenFacts = await ask(tab, 'enterFacts', [ref], parseEnterFacts);
    } catch (e) {
      return { kind: 'refuse', output: failed('what Enter would send', e) };
    }
    // The value is never looked at: any hidden value counts as prose, so only the field decides.
    if (!hiddenFacts || !isPublicText(hiddenFacts, HIDDEN_AS_PROSE)) return { kind: 'none' };
    return {
      kind: 'refuse',
      output: { content: HIDDEN_ENTER_TEXT, isError: true, notice: settingNotice(t('step.publishFirst')) },
    };
  }
  const text = typeof input.text === 'string' ? input.text : '';
  const grant = ctx.approvals?.take(tab.id, ref) ?? null;
  if (grant && grant.kind === 'publish' && grant.fieldRef === ref) {
    let field;
    try {
      field = await ask(tab, 'fieldText', [ref], parseFieldText);
    } catch (e) {
      return { kind: 'refuse', output: failed('the approved field', e) };
    }
    const check = checkPress(grant, { url: tab.url, fieldText: field.text });
    if (check.ok && input.clear !== false && sameText(text, grant.text)) return { kind: 'approved' };
    const reason = check.ok
      ? 'The text to type differs from what the user approved (or clear is false). Nothing was typed. Ask again with request_approval.'
      : check.reason;
    return { kind: 'refuse', output: { content: reason, isError: true, notice: errorNotice(t('step.approvalChanged')) } };
  }
  let facts;
  try {
    facts = await ask(tab, 'enterFacts', [ref], parseEnterFacts);
  } catch (e) {
    return { kind: 'refuse', output: failed('what Enter would send', e) };
  }
  // No text field at this ref: type itself fails, nothing is sent.
  if (!facts || !isPublicText(facts, input.clear === false ? facts.text + text : text)) return { kind: 'none' };
  return {
    kind: 'refuse',
    output: { content: publishEnterFirstText(facts.ref), isError: true, notice: settingNotice(t('step.publishFirst')) },
  };
}

/** The page as it is now, for checkPress; throws (PageQueryError) when the page can't say. */
async function pressState(grant: Grant, ctx: ToolContext, tab: Tab) {
  if (grant.kind === 'change') {
    const now = await ask(tab, 'changeInfo', [grant.buttonRef], parseChangeInfo);
    return {
      url: tab.url,
      label: now.label,
      dialog: now.dialog,
      fields: now.fields?.length ? fieldLines(now.fields) : null,
    };
  }
  if (grant.kind === 'pay') {
    const totalText = await ask(tab, 'textOf', [grant.totalRef], parseTextOrNull);
    const found = await ask(tab, 'findText', [grant.total], parseFound);
    return { url: tab.url, totalText, totalLine: found?.line ?? null, paymentsOn: !!ctx.paymentsAllowed?.() };
  }
  if (grant.fieldRef !== undefined) {
    const field = await ask(tab, 'fieldText', [grant.fieldRef], parseFieldText);
    return { url: tab.url, fieldText: field.text };
  }
  const fields = await ask(tab, 'formValues', [grant.buttonRef], parseFormValues);
  return { url: tab.url, fields: fields ? fieldLines(fields) : null };
}

/**
 * Before type: Qutai never types into a password, one-time code, card number or security code field (the page
 * script recognises it: browser/pageScript.ts secretKind). A page that throws, is slow or answers nonsense is refused
 * too: nothing is typed into a field Qutai couldn't check. Null when typing may go ahead.
 */
export async function secretFieldGate(tab: Tab, ref: unknown): Promise<ToolOutput | null> {
  let kind: SecretKind | null;
  try {
    kind = await queryPage(tab as unknown as PageRunner, 'secretField', [ref], parseSecretField, 3000);
  } catch (e) {
    return failed('the field', e);
  }
  if (!kind) return null;
  return { content: secretFieldText(Number(ref), kind), isError: true, notice: settingNotice(t('step.secretField')) };
}

export { ApprovalGrants };
