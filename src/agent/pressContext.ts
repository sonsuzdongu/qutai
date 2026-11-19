import { isFinalPaymentLabel } from './outwardApproval';

/**
 * Which presses need Qutai's own approval besides sending text (decided 19 Nov 2026; docs/design/07-posting-and-paying.md
 * PAY-9, docs/design/04-untrusted-content.md UNTR-19): the final step of a payment, deleting something, and changing
 * account or security settings on a site. The page script only reports facts (browser/pageScript.ts pressContext);
 * this pure rule decides from context first (a payment step and its form, a total, a confirm dialog on the page, a
 * destructive style, an account settings page and what its form changes), with words as one signal among several.
 *
 * What it can't see: a payment or settings change inside a cross-origin frame (Qutai can't press there either), a
 * press that saves by itself with no label, form, dialog, style or address that says what it does, and select menus
 * that save on change. Those rest on the prompt's rule to call request_approval.
 */
export type PressContext = {
  label: string;
  tag: string;
  type: string;
  role: string;
  link: boolean;
  /** aria-haspopup or aria-expanded: opens a menu or a panel, does nothing by itself. */
  toggle: boolean;
  /** A switch or a checkbox. */
  switchLike: boolean;
  field: boolean;
  disabled: boolean;
  /** A submit button of a form. */
  submitsForm: boolean;
  inForm: boolean;
  /** Card number or security code fields on the page (autocomplete cc-*, or recognised by their words). */
  cardOnPage: boolean;
  /** A payment provider's frame (Stripe, Adyen, Braintree, PayPal, iyzico…). */
  payFrame: boolean;
  /** Card fields in the press's own form. */
  formCard: boolean;
  /** A payment method choice in the press's own form. */
  paymentChoice: boolean;
  /** The address names a checkout or payment step. */
  checkoutPath: boolean;
  /** A line with a total word and an amount on the page (read only on a checkout or payment step). */
  total: boolean;
  amountInLabel: boolean;
  /** Inside a dialog on the page (role dialog or alertdialog, an open <dialog>, aria-modal). */
  inDialog: boolean;
  alertDialog: boolean;
  dialogText: string;
  /** A destructive style: its class or variant says danger, delete, remove…, or it is drawn red. */
  dangerStyle: boolean;
  /** The address is an account, settings, profile, security, privacy or billing page. */
  accountPath: boolean;
  signupPath: boolean;
  heading: string;
  formPasswords: number;
  formNewPassword: boolean;
  formCurrentPassword: boolean;
  /** An email or telephone field in the press's own form. */
  formContact: boolean;
  formFields: number;
};

/** Labels that only dismiss or step back (the whole label): never the risky press. */
const DISMISS = new RegExp(
  '^(' +
    [
      'cancel', 'close', 'no', 'no thanks', 'not now', 'keep', 'keep it', 'back', 'go back', 'dismiss', 'edit', 'change',
      'vazgeç', 'iptal', 'hayır', 'kapat', 'geri', 'şimdi değil', 'düzenle', 'değiştir',
      'abbrechen', 'nein', 'schließen', 'zurück', 'bearbeiten', 'ändern', 'behalten',
      'annuler', 'non', 'fermer', 'retour', 'modifier', 'garder',
      'cancelar', 'cerrar', 'volver', 'editar', 'cambiar', 'mantener', 'não', 'fechar', 'voltar', 'alterar', 'manter',
      'отмена', 'отменить', 'нет', 'закрыть', 'назад', 'изменить', 'оставить',
      'batal', 'tidak', 'tutup', 'kembali', 'ubah', 'simpan saja',
      'キャンセル', 'いいえ', '閉じる', '戻る', '編集', '変更', '취소', '아니요', '닫기', '뒤로', '편집', '변경',
    ].join('|') +
    ')$',
  'iu',
);

/** "Continue", "Next", "Confirm": a payment step's generic forward button. */
const PROCEED = new RegExp(
  '^(' +
    [
      'continue', 'next', 'confirm', 'submit', 'ok', 'done', 'proceed', 'go', 'devam', 'devam et', 'ileri', 'onayla',
      'tamam', 'gönder', 'weiter', 'bestätigen', 'fortfahren', 'absenden', 'continuer', 'suivant', 'valider', 'confirmer',
      'continuar', 'siguiente', 'confirmar', 'enviar', 'próximo', 'prosseguir', 'продолжить', 'далее', 'подтвердить',
      'lanjut', 'lanjutkan', 'berikutnya', 'konfirmasi', 'kirim', '次へ', '続ける', '確認', '確定', '다음', '계속', '확인',
    ].join('|') +
    ')$',
  'iu',
);

const DELETE = /(^|[^\p{L}])(delete|erase|destroy|permanently|sil|silin|kalıcı olarak|löschen|endgültig|supprimer|définitivement|eliminar|borrar|excluir|apagar|удалить|удаление|навсегда|hapus)([^\p{L}]|$)|削除|삭제/iu;
const REMOVE = /(^|[^\p{L}])(remove|kaldır|entfernen|retirer|quitar|remover|убрать|keluarkan)([^\p{L}]|$)|取り消|제거/iu;
const IRREVERSIBLE = /can(no|')t be undone|cannot be reversed|permanent|geri alınamaz|kalıcı|nicht rückgängig|endgültig|irréversible|définitiv|no se puede deshacer|permanente|não pode ser desfeit|нельзя отменить|безвозвратно|tidak dapat dibatalkan|permanen|元に戻せません|되돌릴 수 없/iu;
const SECURITY = new RegExp(
  [
    'password', 'two-?factor', '2fa', 'two-?step', '2-?step', 'authenticator', 'security key', 'passkey', 'recovery',
    'sign out (of )?(all|every)', 'log ?out (of )?(all|every)', 'all (other )?(devices|sessions)', 'everywhere',
    'close (my |your |the )?account', 'delete (my |your |the )?account', 'deactivate', 'disable account',
    'şifre', 'parola', 'iki adımlı', 'iki faktörlü', 'tüm cihaz', 'tüm oturum', 'hesab[ıi] (kapat|sil)', 'hesabımı',
    'passwort', 'kennwort', 'zwei-?faktor', 'überall abmelden', 'allen geräten', 'konto (löschen|schließen)',
    'mot de passe', 'double authentification', 'deux facteurs', 'tous les appareils', '(fermer|supprimer) (le|mon) compte',
    'contraseña', 'dos pasos', 'dos factores', 'todos los dispositivos', '(eliminar|cerrar) (la |mi )?cuenta',
    'senha', 'duas etapas', 'dois fatores', 'todos os dispositivos', '(excluir|encerrar) (a |minha )?conta',
    'пароль', 'двухфактор', 'двухэтап', 'всех устройств', 'удалить (аккаунт|учетную)',
    'kata sandi', 'dua langkah', 'dua faktor', 'semua perangkat', 'hapus akun', 'tutup akun',
    'パスワード', '二段階', '2段階', 'すべてのデバイス', 'アカウント(を)?削除', '비밀번호', '2단계', '모든 기기', '계정 삭제', '회원 탈퇴',
  ].join('|'),
  'iu',
);
const PRIVACY = /privacy|visibility|public profile|gizlilik|görünürlük|datenschutz|sichtbarkeit|confidentialité|visibilité|privacidad|visibilidad|privacidade|visibilidade|конфиденциальн|видимость|privasi|プライバシー|公開|개인정보|공개/iu;

export type PayDecision = { pay: true; why: string } | { pay: false };

/**
 * Whether a press is the final step of a payment: its label says so (ten languages), or the context does (it submits
 * the form with the card fields or the payment choice on a payment step; or it is the forward button of a payment
 * step that shows a total; or its label is an amount on a checkout page with a total).
 */
export function payPress(c: PressContext | null): PayDecision {
  if (!c || c.link || c.toggle || c.field) return { pay: false };
  const label = c.label.trim();
  if (isFinalPaymentLabel(label)) return { pay: true, why: 'its label is a payment button' };
  if (DISMISS.test(label)) return { pay: false };
  const paymentStep = c.cardOnPage || c.payFrame || c.paymentChoice;
  const buttonish = c.submitsForm || c.tag === 'button' || c.role === 'button' || c.type === 'submit';
  if (paymentStep && c.submitsForm && (c.formCard || c.paymentChoice))
    return { pay: true, why: 'it submits the form with the payment details' };
  if (paymentStep && c.total && buttonish && (PROCEED.test(label) || !label || c.amountInLabel))
    return { pay: true, why: 'it is the forward button of a payment step that shows a total' };
  if (c.checkoutPath && c.total && buttonish && c.amountInLabel)
    return { pay: true, why: 'its label is the amount on a checkout page' };
  return { pay: false };
}

export const CHANGE_ACTIONS = ['delete', 'account', 'security'] as const;
export type ChangeAction = (typeof CHANGE_ACTIONS)[number];

export type ChangeDecision = { change: ChangeAction; why: string } | { change: null };

/**
 * Whether a press deletes something or changes account or security settings on a site. Security: its label or the
 * page's dialog names a password, two-factor, signing out everywhere or closing the account, or it submits a form
 * that sets a new password (not a sign-up). Delete: its label says delete (remove only with a destructive style, in a
 * dialog or on an account page), or it confirms a dialog on the page that says delete or "can't be undone", or it is
 * drawn as destructive inside such a dialog. Account: on an account or settings page, it submits a form with an email
 * or phone field, card fields or a password, or it flips a switch, or its page is about privacy.
 */
export function changePress(c: PressContext | null): ChangeDecision {
  if (!c || c.link || c.field || c.disabled) return { change: null };
  const label = c.label.trim();
  if (DISMISS.test(label)) return { change: null };
  // A menu opener ("⋮", "Delete…" that opens a confirm dialog) does nothing by itself; the dialog's button is the press.
  if (c.toggle && !c.switchLike) return { change: null };
  const signup = c.signupPath || (c.formNewPassword && !c.formCurrentPassword && !c.accountPath);
  const dialog = c.inDialog ? c.dialogText : '';
  if (SECURITY.test(label) || (dialog && SECURITY.test(dialog) && (c.dangerStyle || PROCEED.test(label) || DELETE.test(label))))
    return { change: 'security', why: c.inDialog ? 'it confirms a security change in a dialog on the page' : 'its label names a security change' };
  if (c.submitsForm && c.formNewPassword && !signup) return { change: 'security', why: 'it submits a form that sets a new password' };
  if (c.accountPath && c.submitsForm && c.formPasswords > 0 && !signup)
    return { change: 'security', why: 'it submits a form with a password on an account page' };
  if (DELETE.test(label)) return { change: 'delete', why: 'its label says delete' };
  if (REMOVE.test(label) && (c.dangerStyle || c.inDialog || c.accountPath))
    return { change: 'delete', why: c.inDialog ? 'it confirms removing something in a dialog on the page' : 'it removes something and is styled as destructive' };
  if (c.inDialog && (DELETE.test(dialog) || IRREVERSIBLE.test(dialog)) && (c.dangerStyle || PROCEED.test(label) || c.alertDialog || !label))
    return { change: 'delete', why: 'it confirms a dialog on the page that deletes something or cannot be undone' };
  if (c.inDialog && c.dangerStyle && c.alertDialog) return { change: 'delete', why: 'it is the destructive button of a warning dialog' };
  if (c.accountPath && !signup) {
    if (c.submitsForm && (c.formContact || c.formCard)) return { change: 'account', why: 'it saves contact or payment details on an account page' };
    if (c.switchLike) return { change: 'account', why: 'it switches a setting on an account page' };
    if (c.submitsForm && PRIVACY.test(`${c.heading} ${label}`)) return { change: 'account', why: 'it saves privacy settings' };
  }
  return { change: null };
}
