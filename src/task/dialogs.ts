import type { PersonalKind } from '../agent/personalData';
import { AlwaysAllowKind, rememberOffer } from '../agent/alwaysAllow';
import type { OutwardApproval } from '../agent/approvalTool';
import type { SiteRulesApproval } from '../agent/siteRulesTool';
import { askSitePermission, SitePromptAnswer } from '../browser/sitePrompt';
import { dialog } from '../components/Dialog';
import { personalKindsLabel } from '../components/memoryCategories';
import { DEFAULT_SCOPE, SCOPE_KINDS, type ScopeKind } from '../content/siteRules';
import { t } from '../i18n';
import type { SitePermissionStore } from '../storage/sitePermissions';
import type { IconLine, IconLines } from '../ui/Icon';

/**
 * The questions a running task asks the user (moved from App.tsx with the task lifecycle, task/sendTask.ts). Each is
 * dismissed as declined when the task stops (`signal`). "Always allow" answers are saved in the site permissions.
 */
let sitePermissions: Pick<SitePermissionStore, 'set' | 'setPersonal'> | null = null;

/** The site permissions "Always allow" answers go to (set once by App.tsx). */
export function setTaskDialogSites(sites: Pick<SitePermissionStore, 'set' | 'setPersonal'>) {
  sitePermissions = sites;
}

/**
 * The agent's "may I?" before an action. Stopping the task (signal) dismisses it as declined. A site's action offers
 * "Always allow on <site>"; a low-risk phone action (`kind`, agent/alwaysAllow.ts) offers "Don't ask again for …",
 * handed to `onDontAskAgain` when allowed with it ticked. A denial is never remembered.
 */
export async function askConfirmation(
  description: string | IconLines,
  host: string | null,
  signal: AbortSignal,
  incognito: boolean,
  kind?: AlwaysAllowKind,
  onDontAskAgain?: (kind: AlwaysAllowKind) => void,
): Promise<boolean> {
  const text = typeof description === 'string' ? description : null;
  // Incognito never remembers an answer: no "Always allow" and no "Don't ask again" there (alwaysAllow.ts rememberOffer).
  const offer = rememberOffer({ host, kind, incognito, canRememberKind: !!onDontAskAgain });
  const result = await dialog.show({
    title: t('confirm.title'),
    ...(typeof description === 'string' ? {} : { lines: description }),
    message: text && host ? `${text}\n\n${host}` : (text ?? host ?? undefined),
    buttons: [{ text: t('confirm.deny'), style: 'cancel' }, { text: t('confirm.allow') }],
    checkbox:
      offer === 'site' && host
        ? { label: t('confirm.always', { host }) }
        : offer === 'kind' && kind
          ? { label: t(`confirm.dontAskAgain.${kind}`) }
          : undefined,
    signal,
  });
  const allowed = result.button === 1;
  if (allowed && offer === 'site' && host && result.checked) sitePermissions?.set(host, 'allow').catch(() => {});
  if (allowed && offer === 'kind' && kind && result.checked) onDontAskAgain?.(kind);
  return allowed;
}

/**
 * The assistant giving a picture to a page (upload_image), or saving it to Photos instead: the picture and what
 * happens, every time, with no "always allow" (an image can be personal, whatever the site's setting). Stopping the
 * task dismisses it as declined.
 */
export async function askImageConfirmation(
  options: { title: string; message: string; image?: { uri: string; aspectRatio: number }; confirmText: string },
  signal: AbortSignal,
): Promise<boolean> {
  const result = await dialog.show({
    title: options.title,
    message: options.message,
    ...(options.image ? { image: { ...options.image, label: options.title } } : {}),
    buttons: [{ text: t('confirm.deny'), style: 'cancel' }, { text: options.confirmText, primary: true }],
    signal,
  });
  return result.button === 1;
}

/**
 * The assistant saving site rules (save_site_rules): the selectors and domains in plain words and where hiding
 * applies (default: this site and its subdomains), every time; never "don't ask again". Stopping the task dismisses
 * it as declined.
 */
export async function askSiteRules(approval: SiteRulesApproval, active: boolean, signal: AbortSignal): Promise<ScopeKind | null> {
  const lines: IconLine[] = [];
  if (approval.hide.length) {
    lines.push({ icon: 'shield', text: t('siteRules.saveHide') }, ...approval.hide.map((text) => ({ text })));
  }
  if (approval.block.length) {
    lines.push({ icon: 'shield', text: t('siteRules.saveBlock') }, ...approval.block.map((text) => ({ text })));
  }
  const notes = [approval.incognito ? t('siteRules.saveIncognito') : '', active ? '' : t('siteRules.saveOff')].filter(Boolean);
  const result = await dialog.show({
    title: t('siteRules.saveTitle', { site: approval.site }),
    lines: { lines },
    ...(notes.length ? { message: notes.join('\n\n') } : {}),
    // Only hiding has a scope; a blocked domain is blocked everywhere.
    ...(approval.hide.length
      ? {
          choices: {
            label: t('siteRules.scopeLabel'),
            options: SCOPE_KINDS.map((k) => t(`siteRules.scope.${k}`)),
            initial: SCOPE_KINDS.indexOf(DEFAULT_SCOPE),
          },
        }
      : {}),
    buttons: [{ text: t('confirm.deny'), style: 'cancel' }, { text: t('siteRules.save'), primary: true }],
    signal,
  });
  if (result.button !== 1) return null;
  return approval.hide.length ? (SCOPE_KINDS[result.choice] ?? DEFAULT_SCOPE) : DEFAULT_SCOPE;
}

/**
 * Posting and paying (request_approval, agent/approvalTool.ts): the site, what kind of action, and what Qutai read on
 * the page (the exact text or the form's values; the total, the line it is on, the order and the payment method,
 * any recurring charge), every time, never "don't ask again". Only Approve grants the one press; stopping the task
 * dismisses it as declined.
 */
export async function askOutward(approval: OutwardApproval, signal: AbortSignal): Promise<boolean> {
  const lines: IconLine[] = [];
  let title: string;
  let approve: string;
  if (approval.kind === 'publish') {
    title = t(`approval.title.${approval.action}`, { site: approval.site });
    approve = t('approval.approve');
    if (approval.text !== undefined) {
      lines.push({ icon: 'send', text: t('approval.exactText') }, { text: approval.text });
    } else {
      lines.push({ icon: 'send', text: t('approval.formValues') }, ...(approval.fields ?? []).map((f) => ({ text: `${f.label}: ${f.value}` })));
    }
  } else if (approval.kind === 'change') {
    title = t(`approval.changeTitle.${approval.action}`, { site: approval.site });
    approve = t('approval.approve');
    if (approval.heading) lines.push({ icon: 'document', text: t('approval.changeHeading', { heading: approval.heading }) });
    if (approval.dialog) lines.push({ icon: 'info', text: t('approval.changeDialog', { text: approval.dialog }) });
    if (approval.item) lines.push({ icon: 'trash', text: t('approval.changeItem', { item: approval.item }) });
    if (approval.fields?.length)
      lines.push({ icon: 'send', text: t('approval.formValues') }, ...approval.fields.map((f) => ({ text: `${f.label}: ${f.value}` })));
  } else {
    title = t('approval.payTitle', { total: approval.total, site: approval.site });
    approve = t('approval.pay', { total: approval.total });
    lines.push(
      { icon: 'wallet', text: t('approval.total', { total: approval.total }) },
      { text: t('approval.totalLine', { line: approval.totalLine }) },
    );
    if (approval.items) lines.push({ icon: 'review', text: t('approval.items', { items: approval.items }) });
    if (approval.paymentMethod) lines.push({ icon: 'key', text: t('approval.method', { method: approval.paymentMethod }) });
    if (approval.recurring) lines.push({ icon: 'reload', text: t('approval.recurring', { terms: approval.recurring }) });
  }
  const notes = [
    t('approval.press', { button: approval.button }),
    ...(approval.kind === 'pay' ? [t('approval.payNote')] : []),
    ...(approval.kind === 'change' ? [t('approval.changeNote')] : []),
    t('approval.onlyHere'),
  ];
  const result = await dialog.show({
    title,
    lines: { lines, spaced: true },
    message: notes.join('\n\n'),
    buttons: [{ text: t('common.cancel'), style: 'cancel' }, { text: approve, primary: true }],
    signal,
  });
  return result.button === 1;
}

/**
 * Before the assistant first enters remembered personal details on a site in a task: which kinds, on which site.
 * "Allow once" (emphasised) covers the site until the task ends; "Always allow on this site" is saved (not offered in
 * incognito). Stopping the task dismisses it as declined.
 */
export async function askPersonalData(
  host: string,
  kinds: PersonalKind[],
  incognito: boolean,
  signal: AbortSignal,
): Promise<SitePromptAnswer> {
  const answer = await askSitePermission({
    title: t('personal.title', { host }),
    message: t('personal.body', { what: personalKindsLabel(kinds) }),
    incognito,
    signal,
  });
  if (answer === 'always') sitePermissions?.setPersonal(host, 'allow').catch(() => {});
  return answer;
}

/**
 * Before Qutai types a hidden memory (`what`: what it is, never the value) into a field on a site: the first time for
 * each hidden value and site in a task, whatever the site's personal-information setting (blocked sites never get
 * here). No "always": the dialog says the rule. Stopping the task dismisses it as declined.
 */
export async function askHiddenValue(
  host: string,
  what: string,
  field: string,
  incognito: boolean,
  signal: AbortSignal,
): Promise<boolean> {
  const lines = [
    ...(field ? [t('hidden.field', { field })] : []),
    t('hidden.body'),
    ...(incognito ? [t('hidden.incognito')] : []),
  ];
  const result = await dialog.show({
    title: t('hidden.title', { what, host }),
    message: lines.join('\n\n'),
    buttons: [{ text: t('confirm.deny'), style: 'cancel' }, { text: t('hidden.enter'), primary: true }],
    signal,
  });
  return result.button === 1;
}
