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
  sameText,
  type FieldFacts,
  type Grant,
  type PressFacts,
  type PublishAction,
} from './outwardApproval';
import { changePress, payPress, type ChangeAction, type PressContext } from './pressContext';
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

type ChangeInfo = {
  label: string;
  url: string;
  disabled: boolean;
  heading: string;
  dialog: string;
  item: string;
  fields: FormValue[] | null;
};

type PressInfo = { label: string; url: string; disabled: boolean } | null;
type Found = { ref: number; line: string } | null;
type FormValue = { label: string; value: string };

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
  let info: PressInfo;
  try {
    info = await tab.run<PressInfo>('pressInfo', [request.buttonRef]);
  } catch (e) {
    return { content: e instanceof Error ? e.message : String(e), isError: true };
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
    const found = await tab.run<Found>('findText', [request.total]).catch(() => null);
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
    const change = await tab.run<ChangeInfo>('changeInfo', [request.buttonRef]).catch(() => null);
    if (!change) return { content: `ref=${request.buttonRef} was not found. Call read_page again.`, isError: true };
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
      field = await tab.run<{ text: string; secret: boolean }>('fieldText', [request.fieldRef]);
    } catch (e) {
      return { content: e instanceof Error ? e.message : String(e), isError: true };
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
    const fields = await tab.run<FormValue[] | null>('formValues', [request.buttonRef]).catch(() => null);
    if (!fields?.length)
      return {
        content: 'The button is not in a form with filled fields. Give field_ref (the field with the text) and text.',
        isError: true,
      };
    grant = { ...base, kind: 'publish', fields: fieldLines(fields) };
    shown = { fields };
  }
  const approved = await ctx.confirmOutward({ kind: 'publish', site, action: request.action, button: info.label, ...shown, incognito });
  if (!approved) return { content: declinedText('publish'), isError: true, notice: declinedNotice() };
  ctx.approvals.add(grant);
  const enter = request.fieldRef === request.buttonRef;
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
    const check = checkPress(grant, await pressState(grant, ctx, tab));
    if (check.ok) return { kind: 'approved' };
    return { kind: 'refuse', output: { content: check.reason, isError: true, notice: errorNotice(t('step.approvalChanged')) } };
  }
  const args = name === 'click' ? [ref] : point ? [null, point.fx, point.fy] : null;
  if (!args) return { kind: 'none' };
  // What the press is, from the page's context (agent/pressContext.ts): the final step of a payment, deleting
  // something, or changing account or security settings.
  const press = await tab.run<PressContext | null>('pressContext', args).catch(() => null);
  const pay = payPress(press);
  if (press && pay.pay) {
    if (!ctx.paymentsAllowed?.()) return { kind: 'refuse', output: paymentsOff(press.label) };
    return {
      kind: 'refuse',
      output: { content: name === 'click' ? payNeedsApprovalText(press.label, pay.why) : PAY_BY_POINT_TEXT, isError: true },
    };
  }
  const change = changePress(press);
  if (press && change.change) {
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
  const facts = await tab.run<PressFacts | null>('pressComposed', args).catch(() => null);
  const field = contentToApprove(facts);
  if (!field) return { kind: 'none' };
  return {
    kind: 'refuse',
    output: {
      content: publishFirstText(name === 'click' ? ref : null, facts?.label ?? '', field),
      isError: true,
      notice: settingNotice(t('step.publishFirst')),
    },
  };
}

/**
 * Before type with submit (Enter): an approval given for Enter in this field (button_ref = the field) is checked and
 * used up; Enter in a field that will hold free text to send, without one, is refused before anything is typed.
 */
export async function enterGate(input: Record<string, unknown>, ctx: ToolContext, tab: Tab): Promise<PressGate> {
  const ref = typeof input.ref === 'number' ? input.ref : Number(input.ref);
  const text = typeof input.text === 'string' ? input.text : '';
  if (!Number.isInteger(ref)) return { kind: 'none' };
  const grant = ctx.approvals?.take(tab.id, ref) ?? null;
  if (grant && grant.kind === 'publish' && grant.fieldRef === ref) {
    const field = await tab.run<{ text: string }>('fieldText', [ref]).catch(() => null);
    const check = checkPress(grant, { url: tab.url, fieldText: field?.text ?? null });
    if (check.ok && input.clear !== false && sameText(text, grant.text)) return { kind: 'approved' };
    const reason = check.ok
      ? 'The text to type differs from what the user approved (or clear is false). Nothing was typed. Ask again with request_approval.'
      : check.reason;
    return { kind: 'refuse', output: { content: reason, isError: true, notice: errorNotice(t('step.approvalChanged')) } };
  }
  const facts = await tab.run<FieldFacts | null>('enterFacts', [ref]).catch(() => null);
  if (!facts || !isPublicText(facts, input.clear === false ? facts.text + text : text)) return { kind: 'none' };
  return {
    kind: 'refuse',
    output: { content: publishEnterFirstText(facts.ref), isError: true, notice: settingNotice(t('step.publishFirst')) },
  };
}

/** The page as it is now, for checkPress. */
async function pressState(grant: Grant, ctx: ToolContext, tab: Tab) {
  if (grant.kind === 'change') {
    const now = await tab.run<ChangeInfo>('changeInfo', [grant.buttonRef]).catch(() => null);
    return {
      url: tab.url,
      label: now ? now.label : null,
      dialog: now ? now.dialog : null,
      fields: now?.fields?.length ? fieldLines(now.fields) : null,
    };
  }
  if (grant.kind === 'pay') {
    const totalText = await tab.run<string | null>('textOf', [grant.totalRef]).catch(() => null);
    const found = await tab.run<Found>('findText', [grant.total]).catch(() => null);
    return { url: tab.url, totalText, totalLine: found?.line ?? null, paymentsOn: !!ctx.paymentsAllowed?.() };
  }
  if (grant.fieldRef !== undefined) {
    const field = await tab.run<{ text: string }>('fieldText', [grant.fieldRef]).catch(() => null);
    return { url: tab.url, fieldText: field?.text ?? null };
  }
  const fields = await tab.run<FormValue[] | null>('formValues', [grant.buttonRef]).catch(() => null);
  return { url: tab.url, fields: fields ? fieldLines(fields) : null };
}

export { ApprovalGrants };
