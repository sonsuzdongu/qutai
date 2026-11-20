/**
 * Facts a safety check asks the page for (paying, deleting, publishing, secret fields), read so that a page that is
 * slow, throws or answers nonsense stops the check instead of passing it: `queryPage` throws a PageQueryError for an
 * error, a timeout or an answer of the wrong shape, and every gate turns that into a refusal (`PAY-28`,
 * docs/design/07-posting-and-paying.md). What the page answers is still the page's word, never trusted beyond that.
 */
import type { FieldFacts, PressFacts, SecretKind } from './outwardApproval';
import { isSecretKind } from './outwardApproval';
import type { PressContext } from './pressContext';

export type PageQueryFailure = 'error' | 'timeout' | 'malformed';

export class PageQueryError extends Error {
  constructor(
    readonly command: string,
    readonly reason: PageQueryFailure,
    message: string,
  ) {
    super(message);
    this.name = 'PageQueryError';
  }
}

/** Anything with Tab.run's shape (the real Tab, or a test's fake). */
export type PageRunner = { run<T = unknown>(command: never, args?: unknown[], timeoutMs?: number): Promise<T> };

/** Thrown by a parser for an answer of the wrong shape. */
export class Malformed extends Error {}

const DEFAULT_TIMEOUT = 5000;

/** The longest a gate waits for the page; tests lower it so a page that never answers fails fast. */
export const gateTiming = { maxMs: 10_000 };

/**
 * Runs one page command for a gate and checks its answer with `parse`. Throws PageQueryError when the page throws,
 * does not answer within `timeoutMs` (checked here too, so a runner that never settles still ends), or answers
 * something `parse` rejects.
 */
export async function queryPage<T>(
  tab: PageRunner,
  command: string,
  args: unknown[],
  parse: (raw: unknown) => T,
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<T> {
  timeoutMs = Math.min(timeoutMs, gateTiming.maxMs);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new PageQueryError(command, 'timeout', 'The page did not answer in time (it may still be loading).')),
      timeoutMs + 250,
    );
  });
  let raw: unknown;
  try {
    raw = await Promise.race([(tab.run as (c: string, a: unknown[], t: number) => Promise<unknown>)(command, args, timeoutMs), late]);
  } catch (e) {
    if (e instanceof PageQueryError) throw e;
    const message = e instanceof Error ? e.message : String(e);
    const timeout = /did not respond|timeout/i.test(message);
    throw new PageQueryError(command, timeout ? 'timeout' : 'error', message || 'The page reported an error.');
  } finally {
    clearTimeout(timer);
  }
  try {
    return parse(raw);
  } catch (e) {
    if (!(e instanceof Malformed)) throw e;
    throw new PageQueryError(command, 'malformed', `The page answered something Qutai can't read (${e.message}).`);
  }
}

/** For the model: why a check could not run, and that nothing happened. */
export function gateFailedText(what: string, e: unknown): string {
  const why = e instanceof PageQueryError ? e.message : e instanceof Error ? e.message : String(e);
  return (
    `Qutai couldn't check ${what}: ${why} Nothing was done. Call read_page and try again; if it keeps failing, ` +
    'tell the user, who can do this step themselves.'
  );
}

// ---------- Shapes ----------

type Kind = 'string' | 'boolean' | 'number' | 'number|null' | 'string?';

function isObject(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw);
}

function check(raw: unknown, shape: Record<string, Kind>, what: string): Record<string, unknown> {
  if (!isObject(raw)) throw new Malformed(`${what} is not an object`);
  for (const [key, kind] of Object.entries(shape)) {
    const v = raw[key];
    const ok =
      kind === 'string'
        ? typeof v === 'string'
        : kind === 'string?'
          ? v === undefined || typeof v === 'string'
          : kind === 'boolean'
            ? typeof v === 'boolean'
            : kind === 'number'
              ? typeof v === 'number' && Number.isFinite(v)
              : v === null || (typeof v === 'number' && Number.isFinite(v));
    if (!ok) throw new Malformed(`${what}.${key} is not a ${kind}`);
  }
  return raw;
}

const PRESS_CONTEXT: Record<keyof PressContext, Kind> = {
  label: 'string',
  tag: 'string',
  type: 'string',
  role: 'string',
  link: 'boolean',
  toggle: 'boolean',
  switchLike: 'boolean',
  field: 'boolean',
  disabled: 'boolean',
  submitsForm: 'boolean',
  inForm: 'boolean',
  cardOnPage: 'boolean',
  payFrame: 'boolean',
  formCard: 'boolean',
  paymentChoice: 'boolean',
  checkoutPath: 'boolean',
  total: 'boolean',
  amountInLabel: 'boolean',
  inDialog: 'boolean',
  alertDialog: 'boolean',
  dialogText: 'string',
  dangerStyle: 'boolean',
  accountPath: 'boolean',
  signupPath: 'boolean',
  heading: 'string',
  formPasswords: 'number',
  formNewPassword: 'boolean',
  formCurrentPassword: 'boolean',
  formContact: 'boolean',
  formFields: 'number',
  text: 'string?',
};

const FIELD_FACTS: Record<keyof FieldFacts, Kind> = {
  ref: 'number',
  tag: 'string',
  type: 'string',
  editable: 'boolean',
  role: 'string',
  inSearch: 'boolean',
  formGet: 'boolean',
  loginForm: 'boolean',
  autocomplete: 'string',
  inputMode: 'string',
  hints: 'string',
  maxLength: 'number|null',
  text: 'string',
  label: 'string',
};

const PRESS_FACTS: Record<Exclude<keyof PressFacts, 'fields'>, Kind> = {
  label: 'string',
  tag: 'string',
  type: 'string',
  role: 'string',
  field: 'boolean',
  link: 'boolean',
  toggle: 'boolean',
};

/**
 * pressContext: what a click would press. Null (nothing at that point) is not "nothing to approve": there is nothing
 * Qutai could check, so it is malformed for a gate.
 */
export function parsePressContext(raw: unknown): PressContext {
  return check(raw, PRESS_CONTEXT, 'pressContext') as PressContext;
}

export function parseFieldFacts(raw: unknown, what = 'field'): FieldFacts {
  return check(raw, FIELD_FACTS, what) as FieldFacts;
}

/** pressComposed: the press and the fields the assistant typed that it would send. */
export function parsePressFacts(raw: unknown): PressFacts {
  const p = check(raw, PRESS_FACTS, 'pressComposed');
  if (!Array.isArray(p.fields)) throw new Malformed('pressComposed.fields is not a list');
  p.fields.forEach((f, i) => {
    parseFieldFacts(f, `pressComposed.fields[${i}]`);
    check(f, { sameForm: 'boolean', near: 'boolean' }, `pressComposed.fields[${i}]`);
  });
  return p as PressFacts;
}

/** enterFacts: the field Enter would be pressed in, or null when the ref holds no text field (type then fails too). */
export function parseEnterFacts(raw: unknown): FieldFacts | null {
  return raw === null ? null : parseFieldFacts(raw, 'enterFacts');
}

/** secretField: the field's secret kind, or null for an ordinary field. */
export function parseSecretField(raw: unknown): SecretKind | null {
  if (raw === null) return null;
  if (isSecretKind(raw)) return raw;
  throw new Malformed('secretField is not a field kind');
}

/** secretFieldIndices: indices of secret fields on screen. */
export function parseIndices(raw: unknown): number[] {
  if (!Array.isArray(raw) || !raw.every((n) => Number.isInteger(n) && n >= 0)) throw new Malformed('not a list of field numbers');
  return raw as number[];
}

export type PressInfo = { label: string; url: string; disabled: boolean };

/** pressInfo: the button's name and state, or null when the ref is gone. */
export function parsePressInfo(raw: unknown): PressInfo | null {
  return raw === null ? null : (check(raw, { label: 'string', url: 'string', disabled: 'boolean' }, 'pressInfo') as PressInfo);
}

export type FormValue = { label: string; value: string };

/** formValues: a form's filled fields, or null when the button is in no form. */
export function parseFormValues(raw: unknown): FormValue[] | null {
  if (raw === null) return null;
  if (!Array.isArray(raw)) throw new Malformed('formValues is not a list');
  raw.forEach((f, i) => check(f, { label: 'string', value: 'string' }, `formValues[${i}]`));
  return raw as FormValue[];
}

export type ChangeInfo = {
  label: string;
  url: string;
  disabled: boolean;
  heading: string;
  dialog: string;
  item: string;
  fields: FormValue[] | null;
};

export function parseChangeInfo(raw: unknown): ChangeInfo {
  const c = check(raw, { label: 'string', url: 'string', disabled: 'boolean', heading: 'string', dialog: 'string', item: 'string' }, 'changeInfo');
  parseFormValues(c.fields ?? null);
  return { ...(c as ChangeInfo), fields: (c.fields as FormValue[] | null | undefined) ?? null };
}

export type FieldText = { text: string; secret: boolean };

export function parseFieldText(raw: unknown): FieldText {
  return check(raw, { text: 'string', secret: 'boolean' }, 'fieldText') as FieldText;
}

export type Found = { ref: number; line: string };

/** findText: where a text is on the page, or null when it isn't. */
export function parseFound(raw: unknown): Found | null {
  return raw === null ? null : (check(raw, { ref: 'number', line: 'string' }, 'findText') as Found);
}

/** textOf: an element's text, or null when it left the page. */
export function parseTextOrNull(raw: unknown): string | null {
  if (raw === null || typeof raw === 'string') return raw;
  throw new Malformed('not a text');
}

/** scriptFacts (run_script's sensitive-page check): which secret fields the page has. */
export function parseScriptFacts(raw: unknown): { password: boolean; oneTimeCode: boolean; card: boolean } {
  return check(raw, { password: 'boolean', oneTimeCode: 'boolean', card: 'boolean' }, 'scriptFacts') as {
    password: boolean;
    oneTimeCode: boolean;
    card: boolean;
  };
}
