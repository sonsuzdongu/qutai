import { CHANGE_ACTIONS, type ChangeAction } from './pressContext';
/**
 * Approvals for what goes out in the user's name on a web page: "publish" (a post, comment, reply, review, a message
 * or email sent on a site, a public form) and "pay" (the final step of a payment, only when the user turned on
 * Settings › Assistant › "Let the assistant complete payments"). README.md › Posting and paying.
 *
 * The model asks with request_approval right before pressing the site's own button; Qutai shows its dialog with what
 * it read from the page itself (the field's text or the form's values; the total and the line it is on), never only
 * what the model claims. An approval is a grant for ONE press of that button, in that tab, on that page, during that
 * task; it is checked again just before the press (the text and the total must still be what was approved) and used
 * up by it. Nothing a page says can create one: only the dialog does. A press of a final payment button without a
 * grant is refused in the app (whatever the prompt said), and so is typing a payment card number.
 *
 * Pure code (no React Native): the rules, the texts for the model, and the payment-button words.
 */

export type OutwardKind = 'publish' | 'pay' | 'change';

export const PUBLISH_ACTIONS = ['post', 'comment', 'reply', 'review', 'message', 'email', 'form'] as const;
export type PublishAction = (typeof PUBLISH_ACTIONS)[number];

export type ApprovalRequest =
  | { kind: 'publish'; action: PublishAction; buttonRef: number; fieldRef: number | null; text: string | null }
  | {
      kind: 'pay';
      buttonRef: number;
      total: string;
      items: string;
      paymentMethod: string;
      recurring: string | null;
    }
  | { kind: 'change'; action: ChangeAction; buttonRef: number };

const MAX_TEXT = 5000;

function ref(value: unknown): number | null {
  const n = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
}
function str(value: unknown, max = 300): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** request_approval's input checked: the request, or what to fix (a tool error for the model). */
export function parseApprovalInput(input: Record<string, unknown>): { request: ApprovalRequest } | { error: string } {
  const buttonRef = ref(input.button_ref);
  if (!buttonRef) return { error: 'Give button_ref: the ref of the site button that sends or pays (from read_page).' };
  if (input.kind === 'publish') {
    const action = PUBLISH_ACTIONS.includes(input.action as PublishAction) ? (input.action as PublishAction) : null;
    if (!action) return { error: `Give action: one of ${PUBLISH_ACTIONS.join(', ')}.` };
    const fieldRef = input.field_ref === undefined || input.field_ref === null ? null : ref(input.field_ref);
    if (input.field_ref !== undefined && input.field_ref !== null && !fieldRef)
      return { error: 'field_ref must be the ref of the text field (from read_page).' };
    const text = typeof input.text === 'string' ? input.text.slice(0, MAX_TEXT) : null;
    if (fieldRef && !text?.trim()) return { error: 'Give text: exactly the text you typed into field_ref.' };
    return { request: { kind: 'publish', action, buttonRef, fieldRef, text: fieldRef ? text : null } };
  }
  if (input.kind === 'pay') {
    const total = str(input.total, 60);
    if (!/\d/.test(total)) return { error: 'Give total: the amount to pay with its currency, exactly as the page shows it.' };
    const paymentMethod = str(input.payment_method, 80);
    if (containsCardNumber(paymentMethod))
      return { error: 'payment_method must name the method as the page does (e.g. "Visa ending 4242"), never a card number.' };
    return {
      request: {
        kind: 'pay',
        buttonRef,
        total,
        items: str(input.items, 300),
        paymentMethod,
        recurring: str(input.recurring, 200) || null,
      },
    };
  }
  if (input.kind === 'change') {
    const action = CHANGE_ACTIONS.includes(input.action as ChangeAction) ? (input.action as ChangeAction) : null;
    if (!action) return { error: `Give action: one of ${CHANGE_ACTIONS.join(', ')}.` };
    return { request: { kind: 'change', action, buttonRef } };
  }
  return { error: 'kind must be "publish", "pay" or "change".' };
}

/** Text compared the way a person reads it: spacing and non-breaking spaces don't count. */
export function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (s: string | null | undefined) => String(s ?? '').replace(/[\s ]+/g, ' ').trim();
  return norm(a) === norm(b);
}

/** What a grant was given for, as read from the page when the user approved. */
export type Grant = {
  kind: OutwardKind;
  tabId: string;
  /** The page's address without its #fragment. */
  url: string;
  buttonRef: number;
  /** publish with a field: its ref and the text approved. */
  fieldRef?: number;
  text?: string;
  /** publish of a form: its values as approved ("label: value" lines). */
  fields?: string[];
  /** pay: the total as approved, the ref of the element it was read from, and its line. */
  total?: string;
  totalRef?: number;
  totalLine?: string;
  /** change: the button's label and the page's dialog text as approved. */
  label?: string;
  dialog?: string;
};

/** The grants of one task (runAgent makes one per message): a grant is used up by the press it was for. */
export class ApprovalGrants {
  private grants: Grant[] = [];

  /** A new approval replaces an older one for the same tab (only the latest stands). */
  add(grant: Grant): void {
    this.grants = this.grants.filter((g) => g.tabId !== grant.tabId).concat(grant);
  }

  /** The grant for pressing `ref` in `tabId`, taken out (single use), or null. */
  take(tabId: string, ref: number): Grant | null {
    const i = this.grants.findIndex((g) => g.tabId === tabId && g.buttonRef === ref);
    if (i < 0) return null;
    return this.grants.splice(i, 1)[0];
  }

  /** Whether an approval waits to be used in `tabId` (scripts are refused there meanwhile). */
  hasTab(tabId: string): boolean {
    return this.grants.some((g) => g.tabId === tabId);
  }

  get size(): number {
    return this.grants.length;
  }
}

/** The page as read just before the approved press. */
export type PressState = {
  url: string;
  /** publish with a field: its text now (null: the field is gone). */
  fieldText?: string | null;
  /** publish of a form: its values now. */
  fields?: string[] | null;
  /** pay: the text of the total's element now (null: it left the page), and the line the total is found on now. */
  totalText?: string | null;
  totalLine?: string | null;
  /** pay: the setting, read again. */
  paymentsOn?: boolean;
  /** change: the button's label and the dialog's text now (null: gone). */
  label?: string | null;
  dialog?: string | null;
};

export const pageUrl = (url: string) => url.split('#')[0];

/**
 * Whether the approved press may go ahead: the same page, and what the user approved still on it. The reason is for
 * the model (the press does not happen; it has to ask again).
 */
export function checkPress(grant: Grant, now: PressState): { ok: true } | { ok: false; reason: string } {
  const again = ' Nothing was pressed. Read the page, fix it if needed and call request_approval again; do not press without a new approval.';
  if (pageUrl(now.url) !== grant.url) return { ok: false, reason: 'The page changed since the user approved.' + again };
  if (grant.kind === 'publish') {
    if (grant.fieldRef !== undefined) {
      if (now.fieldText === null || now.fieldText === undefined)
        return { ok: false, reason: 'The text field is no longer on the page.' + again };
      if (!sameText(now.fieldText, grant.text))
        return {
          ok: false,
          reason: `The text in the field changed since the user approved it (it now reads "${clip(now.fieldText)}").${again}`,
        };
    } else if (grant.fields) {
      if (!now.fields || now.fields.join('\n') !== grant.fields.join('\n'))
        return { ok: false, reason: 'The form changed since the user approved it.' + again };
    }
    return { ok: true };
  }
  if (grant.kind === 'change') {
    if (now.label === null || now.label === undefined || !sameText(now.label, grant.label))
      return { ok: false, reason: 'The button is no longer the one the user approved.' + again };
    if (grant.dialog && !sameText(now.dialog, grant.dialog))
      return { ok: false, reason: "The page's dialog changed since the user approved." + again };
    if (grant.fields && (!now.fields || now.fields.join('\n') !== grant.fields.join('\n')))
      return { ok: false, reason: 'The form changed since the user approved it.' + again };
    return { ok: true };
  }
  if (!now.paymentsOn) return { ok: false, reason: paymentsOffText(null) };
  const stillThere =
    (now.totalText != null && now.totalText.includes(grant.total ?? '\u0000')) ||
    (now.totalLine != null && sameText(now.totalLine, grant.totalLine));
  if (!stillThere)
    return {
      ok: false,
      reason: `The total on the page is no longer ${grant.total} as the user approved${now.totalLine ? ` (the page now shows "${clip(now.totalLine)}")` : ''}.${again}`,
    };
  return { ok: true };
}

function clip(text: string, max = 200): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

// ---------- Texts for the model ----------

/** After the dialog's Approve. `button`: the button's label as read from the page. */
export function approvedText(kind: OutwardKind, buttonRef: number, button: string, enter = false): string {
  const what = kind === 'pay' ? 'pay' : kind === 'change' ? 'make the change' : 'send it';
  const how = enter
    ? `press Enter in ref=${buttonRef}: call type with ref=${buttonRef}, the same text and submit true`
    : `press ref=${buttonRef} ("${button}") with click to ${what}`;
  return (
    `The user approved this in Qutai's own dialog. Now complete it: ${how}, ` +
    'then read the page and tell the user the outcome (sent, posted, paid, or the error the site shows). ' +
    'Do not ask for confirmation again in chat. The approval is for one press of that button on this page; ' +
    'if the page or the text changes first, ask again with request_approval.'
  );
}

/** After Cancel, or when the dialog was dismissed. */
export function declinedText(kind: OutwardKind): string {
  if (kind === 'change')
    return 'The user did not approve this change. Do not press the button or make the change any other way. Tell the user nothing was changed and ask what they want instead.';
  return kind === 'pay'
    ? 'The user did not approve the payment. Do not press the payment button or pay any other way. Tell the user nothing was paid and ask what to change.'
    : 'The user did not approve it. Do not press the button or send it any other way. Tell the user it was not sent and ask what to change.';
}

/**
 * Payments are left to the user (the setting is off). `settingPath`: the setting's name as the user sees it, quoted
 * (agent/uiLabels.ts), or null to leave it out.
 */
export function paymentsOffText(button: string | null, settingPath: string | null = null): string {
  return (
    'Completing payments is left to the user (Qutai\'s setting is off), so this was not pressed. ' +
    `Stop here and tell the user that the order is ready and that they complete it themselves by pressing ${button ? `"${button}"` : 'the payment button'} on the page. ` +
    'Do not ask them in chat for permission to pay: you cannot press it.' +
    (settingPath ? ` Only if they ask how to let you pay: ${settingPath}.` : '')
  );
}

/** A final payment button pressed without an approval while payments are on. */
export function payNeedsApprovalText(button: string, why = 'its label is a payment button'): string {
  return (
    `"${button}" looks like the final payment button (${why}), and it needs the user's approval in Qutai's dialog first. ` +
    'Nothing was pressed. Call request_approval with kind "pay" (total, items and payment method as the page shows them), then press it.'
  );
}

/** A press that deletes something or changes account or security settings, without an approval. */
export function changeNeedsApprovalText(buttonRef: number | null, button: string, action: ChangeAction, why: string): string {
  const which = buttonRef === null ? 'The button at that point' : `ref=${buttonRef} ("${button}")`;
  const what = action === 'delete' ? 'deletes something' : action === 'security' ? 'changes security settings' : 'changes account settings';
  return (
    `${which} ${what} on this site (${why}), which needs the user's approval in Qutai's dialog first. Nothing was ` +
    `pressed. Call request_approval with kind "change", action "${action}" and button_ref ` +
    `${buttonRef ?? "(the button's ref from read_page; a tap at a point can't carry an approval)"}; once approved, press ` +
    'it with click. Do not ask in chat.'
  );
}

/** A tap at a point on a final payment button: only a click by ref can carry an approval. */
export const PAY_BY_POINT_TEXT =
  'That point is on what looks like the final payment button; it can only be pressed with click and its ref after request_approval. Nothing was pressed.';

// ---------- Final payment buttons ----------

/** Labels that are the final payment step when they are the whole label (an amount around them is ignored). */
const PAY_WORDS = new Set([
  'pay', 'pay now', 'purchase', 'purchase now', 'buy now', 'place order', 'place your order', 'place my order',
  'complete order', 'complete your order', 'complete purchase', 'complete payment', 'confirm order', 'confirm purchase',
  'confirm payment', 'confirm and pay', 'submit order', 'order and pay', 'pay and order', 'checkout and pay',
  // de
  'bezahlen', 'jetzt bezahlen', 'kaufen', 'jetzt kaufen', 'zahlungspflichtig bestellen', 'kostenpflichtig bestellen',
  'bestellung abschließen', 'zahlung bestätigen', 'kaufen und bezahlen',
  // fr
  'payer', 'payer maintenant', 'commander et payer', 'valider la commande', 'confirmer la commande', 'passer la commande',
  'acheter maintenant', 'confirmer le paiement', 'finaliser la commande', 'valider et payer',
  // es, pt-BR
  'pagar', 'pagar ahora', 'realizar pedido', 'confirmar pedido', 'finalizar compra', 'comprar ahora', 'confirmar pago',
  'completar compra', 'pagar agora', 'finalizar pedido', 'comprar agora', 'confirmar pagamento', 'fazer pedido',
  // ru
  'оплатить', 'оплатить заказ', 'подтвердить заказ', 'подтвердить и оплатить', 'купить сейчас', 'подтвердить оплату', 'оплатить сейчас',
  // tr
  'öde', 'ödeme yap', 'şimdi öde', 'siparişi tamamla', 'siparişi onayla', 'alışverişi tamamla', 'satın al', 'ödemeyi onayla',
  'ödemeyi tamamla', 'onayla ve öde', 'hemen öde',
  // id
  'bayar', 'bayar sekarang', 'buat pesanan', 'beli sekarang', 'konfirmasi pembayaran', 'selesaikan pesanan',
]);

/** Japanese and Korean labels have no spaces: these are found inside the label. */
const PAY_PARTS = ['購入する', '注文を確定', '今すぐ購入', '支払う', '支払いを確定', '결제하기', '구매하기', '주문하기', '바로구매', '바로 구매', '지금 구매'];

/** Whether a button's label names the final step of a payment ("Pay €24.99", "Place your order", "Siparişi onayla"). */
export function isFinalPaymentLabel(label: string | null | undefined): boolean {
  if (!label) return false;
  const lower = label.toLocaleLowerCase('en').replace(/[ \s]+/g, ' ').trim();
  if (PAY_PARTS.some((part) => lower.includes(part))) return true;
  // Amounts, currency signs and punctuation around the words are left out: "Pay €24.99", "Öde (1.249,90 TL)".
  const words = lower
    .split(' ')
    .map((w) => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ''))
    .filter((w) => w && !/\d/.test(w) && !/^(tl|try|eur|usd|gbp|rub|idr|brl|jpy|krw|₺|€|\$|£)$/.test(w));
  return PAY_WORDS.has(words.join(' '));
}

// ---------- Card numbers ----------

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** A payment card number in the text (13–19 digits, spaced or not, passing the Luhn check). */
export function containsCardNumber(text: string): boolean {
  for (const match of text.matchAll(/\d(?:[ -]?\d)*/g)) {
    const digits = match[0].replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) return true;
  }
  return false;
}

export const CARD_NUMBER_TEXT =
  'That looks like a payment card number. Qutai never types card numbers, security codes, passwords or one-time codes: ' +
  'nothing was typed. Ask the user to enter it themselves, or to choose a card the site has saved.';

// ---------- Secret fields ----------
// Decided 19 Nov 2026: Qutai never types into a password, one-time code, card number or security code field. The
// page script recognises the field (browser/pageScript.ts secretKind: input type, autocomplete, inputmode and length,
// the words around it in ten languages, custom elements and shadow hosts, split code boxes); the app refuses.

export const SECRET_KINDS = ['password', 'oneTimeCode', 'cardNumber', 'securityCode'] as const;
export type SecretKind = (typeof SECRET_KINDS)[number];

export function isSecretKind(value: unknown): value is SecretKind {
  return typeof value === 'string' && (SECRET_KINDS as readonly string[]).includes(value);
}

const SECRET_WORDS: Record<SecretKind, string> = {
  password: 'a password',
  oneTimeCode: 'a one-time code',
  cardNumber: 'a card number',
  securityCode: 'a card security code',
};

/** The refusal for typing into a secret field. */
export function secretFieldText(ref: number, kind: SecretKind): string {
  return (
    `ref=${ref} is a field for ${SECRET_WORDS[kind]}. Qutai never types passwords, one-time codes, card numbers or ` +
    'security codes, and never reads them back: nothing was typed. Ask the user (with ask_user) to fill in this field ' +
    'themselves on the page, which is on their screen, and to tell you when they are done; then continue. Do not ask ' +
    'them to tell you the value.'
  );
}

// ---------- Sending the assistant's own text without an approval ----------
// Decided 19 Nov 2026: a press that would send free text the assistant typed during the task (a comment, reply, review,
// message, a contact form's message) is refused until request_approval granted it. Recognised by context, not by the
// button's words ("Send code", "Post" in a menu): the button is in the field's form, or in the same small composer box,
// or it is Enter in the field. Search boxes, filters, login, codes, quantities and personal-detail fields never count.

/** What the page script reports about a field (pageScript.ts fieldFacts). */
export type FieldFacts = {
  ref: number;
  tag: string;
  /** An <input>'s type; '' for a textarea or an editor. */
  type: string;
  editable: boolean;
  role: string;
  /** Inside role=search or <search>, or a form whose action is a search. */
  inSearch: boolean;
  /** Its form says method="get" (a search or a filter: nothing is sent to anyone). */
  formGet: boolean;
  /** Its form has a password field (signing in or up). */
  loginForm: boolean;
  autocomplete: string;
  inputMode: string;
  /** name, id, placeholder and label, lowercase. */
  hints: string;
  maxLength: number | null;
  text: string;
  label: string;
};

/** What the page script reports about a press (pageScript.ts pressComposed). */
export type PressFacts = {
  label: string;
  tag: string;
  type: string;
  role: string;
  /** The press is on a field or a select itself (focusing it sends nothing). */
  field: boolean;
  link: boolean;
  /** aria-pressed, aria-haspopup or aria-expanded: a toggle or a menu, not a send button. */
  toggle: boolean;
  /** The fields the assistant typed into that this press would send: in its form, or in the same composer box. */
  fields: (FieldFacts & { sameForm: boolean; near: boolean })[];
};

/** Autocomplete tokens of personal details, sign-in and codes: never public text. */
const PRIVATE_AUTOCOMPLETE =
  /\b(username|email|current-password|new-password|one-time-code|tel[\w-]*|name|given-name|family-name|additional-name|honorific-[\w]+|nickname|organization[\w-]*|street-address|address-line\d|address-level\d|postal-code|country[\w-]*|cc-[\w-]+|bday[\w-]*|sex|url|photo|transaction-[\w-]+)\b/;

/** Words around a field that make it a search, a filter, a code, a quantity or a delivery note (ten languages). */
const NOT_PUBLIC_HINT = new RegExp(
  '(?<![\\p{L}\\p{N}])(' +
    [
      'search', 'query', 'find', 'filter', 'q', 'keywords?', 'lookup', 'coupon', 'promo', 'voucher', 'code', 'otp', 'pin',
      'zip', 'postcode', 'quantity', 'qty', 'amount', 'login', 'username', 'user', 'e-?mail', 'phone',
      'ara', 'arama', 'filtre', 'kod', 'kupon', 'adet', 'miktar', 'kullanıcı adı',
      'suche', 'suchen', 'menge', 'gutschein', 'recherche', 'rechercher', 'filtrer', 'quantité',
      'buscar', 'búsqueda', 'filtrar', 'cantidad', 'pesquisar', 'pesquisa', 'quantidade', 'cupom',
      'поиск', 'найти', 'фильтр', 'код', 'количество', 'cari', 'pencarian', 'jumlah',
      // A checkout's delivery or order note goes with the order, not to an audience.
      'delivery', 'shipping', 'order notes?', 'teslimat', 'kargo', 'sipariş notu', 'lieferung', 'lieferhinweis',
      'livraison', 'entrega', 'envío', 'доставка', 'доставки', 'pengiriman',
    ].join('|') +
    ')(?![\\p{L}\\p{N}])',
  'u',
);
/** Japanese and Korean hints, found inside the text. */
const NOT_PUBLIC_PARTS = ['検索', '絞り込み', 'フィルタ', 'コード', '数量', '配送', '검색', '필터', '코드', '수량', '배송'];

const TEXT_INPUT_MODES = new Set(['', 'text']);

/**
 * Whether a field holds free text that goes out to other people (a comment, a message, a review), as opposed to a
 * search, a filter, a sign-in, a code, a quantity or a personal detail. `text`: what it will hold (Enter in type), else
 * what it holds now. Errs towards not asking: a one-line input counts only for prose of a few words.
 */
export function isPublicText(f: FieldFacts, text: string = f.text): boolean {
  const value = text.trim();
  if (!value) return false;
  if (f.tag === 'input' && f.type !== 'text') return false;
  if (f.role === 'searchbox' || f.role === 'combobox' || f.role === 'spinbutton') return false;
  if (f.inSearch || f.formGet || f.loginForm) return false;
  if (PRIVATE_AUTOCOMPLETE.test(f.autocomplete)) return false;
  if (!TEXT_INPUT_MODES.has(f.inputMode)) return false;
  if (NOT_PUBLIC_HINT.test(f.hints) || NOT_PUBLIC_PARTS.some((p) => f.hints.includes(p))) return false;
  // A text area or an editor is made for prose.
  if (f.tag === 'textarea' || f.editable) return true;
  // A one-line input: a short field (a name, a code) never; prose of at least two words and twelve characters does.
  if (f.maxLength !== null && f.maxLength <= 40) return false;
  return value.length >= 12 && /\S\s+\S/.test(value);
}

/** Buttons that close, clear or decorate a composer (their label starts with these words): they send nothing. */
const NOT_SEND_LABEL = new RegExp(
  '^(' +
    [
      'cancel', 'close', 'discard', 'clear', 'back', 'delete', 'remove', 'attach.*', 'add (a )?(photo|image|file|gif|emoji).*',
      'emoji.*', 'gif', 'bold', 'italic', 'underline', 'strikethrough', 'link', 'insert link', 'mention', 'format.*', 'preview',
      'edit', 'more', 'more options', 'options', 'show more', 'expand', 'collapse',
      'vazgeç', 'iptal', 'kapat', 'temizle', 'sil', 'geri', 'önizle', 'abbrechen', 'schließen', 'löschen', 'verwerfen',
      'annuler', 'fermer', 'effacer', 'supprimer', 'cancelar', 'cerrar', 'borrar', 'eliminar', 'fechar', 'apagar', 'excluir',
      'отмена', 'отменить', 'закрыть', 'удалить', 'очистить', 'batal', 'tutup', 'hapus', 'キャンセル', '閉じる', '削除', '취소', '닫기', '삭제',
    ].join('|') +
    ')(?![\\p{L}\\p{N}])',
  'iu',
);

/**
 * The field whose free text this press would send without an approval, or null when the press sends none of the
 * assistant's text (a link, a toggle or menu, a field itself, a reset or cancel button, or only non-public fields).
 */
export function contentToApprove(p: PressFacts | null): (FieldFacts & { sameForm: boolean; near: boolean }) | null {
  if (!p || p.field || p.link || p.toggle || p.type === 'reset') return null;
  if (NOT_SEND_LABEL.test(p.label.trim())) return null;
  return p.fields.find((f) => isPublicText(f)) ?? null;
}

function excerpt(text: string, max = 80): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** The refusal for a press that would send the assistant's text without an approval. */
export function publishFirstText(buttonRef: number | null, button: string, field: FieldFacts): string {
  const which = buttonRef === null ? 'the button at that point' : `ref=${buttonRef} ("${button}")`;
  return (
    `Pressing ${which} would send the text you typed into ref=${field.ref} ("${excerpt(field.text)}"), which needs the ` +
    "user's approval in Qutai's dialog first. Nothing was pressed. Call request_approval with kind \"publish\", " +
    `field_ref ${field.ref}, text exactly as the field shows it, and button_ref ${buttonRef ?? "(the button's ref from read_page)"}; ` +
    'once approved, press it with click. Do not ask in chat.'
  );
}

/** The refusal for Enter in a field with free text the assistant typed, without an approval. */
export function publishEnterFirstText(fieldRef: number): string {
  return (
    `Pressing Enter in ref=${fieldRef} would send this text, which needs the user's approval in Qutai's dialog first. ` +
    'Nothing was typed. Type it without submit, then call request_approval with kind "publish", field_ref ' +
    `${fieldRef}, the text, and button_ref: the site's send button, or ${fieldRef} itself when Enter is the only way to ` +
    'send. Once approved, press the button with click, or (button_ref = the field) call type again with the same text ' +
    'and submit true. Do not ask in chat.'
  );
}
