// Qutai never types into password, one-time code, card number or security code fields (decided 19 Nov 2026). The rule
// is the page script's secretKind (src/browser/pageScript.ts), taken from the file and run here on a table of field
// patterns from real sites: what must be refused, and ordinary numeric and text fields that must not be.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PAGE_SCRIPT } from '../../src/browser/pageScript.ts';
import { pageScriptPart } from '../test-support/pageScriptPart.mjs';
import { isSecretKind, secretFieldText } from '../../src/agent/outwardApproval.ts';

type Facts = {
  type?: string;
  autocomplete?: string;
  inputMode?: string;
  hints?: string;
  maxLength?: number | null;
  pattern?: string;
  textSecurity?: boolean;
  digitBoxes?: number;
};
const secretKindSource = pageScriptPart(PAGE_SCRIPT, '  var SECRET_PASSWORD', '  // ---------- end of secretKind');
const secretKind = new Function(`${secretKindSource}; return secretKind;`)() as (f: Facts) => string | null;
const k = (f: Facts) => secretKind({ type: 'text', autocomplete: '', inputMode: '', hints: '', maxLength: null, pattern: '', textSecurity: false, digitBoxes: 0, ...f });

test('passwords: type, autocomplete, masking style, words in ten languages, custom elements', () => {
  const yes: Facts[] = [
    { type: 'password' },
    { autocomplete: 'current-password' },
    { autocomplete: 'section-login new-password' },
    { textSecurity: true, hints: 'enter' },
    { hints: 'password' },
    { hints: 'pwd login_pwd' },
    { hints: 'şifre şifrenizi girin' },
    { hints: 'passwort' },
    { hints: 'mot de passe' },
    { hints: 'contraseña' },
    { hints: 'senha' },
    { hints: 'пароль' },
    { hints: 'kata sandi' },
    { hints: 'パスワード' },
    { hints: '비밀번호' },
    { hints: 'x-password-field password' },
    { hints: 'pin', inputMode: 'numeric', maxLength: 4 },
  ];
  for (const f of yes) assert.equal(k(f), 'password', JSON.stringify(f));
});

test('one-time codes: autocomplete, words, split boxes, a short numeric "code"', () => {
  const yes: Facts[] = [
    { autocomplete: 'one-time-code' },
    { hints: 'verification code', inputMode: 'numeric' },
    { hints: 'enter the 6-digit code we sent you', inputMode: 'numeric', maxLength: 6 },
    { hints: 'otp' },
    { hints: 'two-factor authentication code' },
    { hints: 'doğrulama kodu' },
    { hints: 'sms kodu', maxLength: 6 },
    { hints: 'bestätigungscode' },
    { hints: 'code de vérification' },
    { hints: 'código de verificación' },
    { hints: 'código de verificação' },
    { hints: 'код подтверждения' },
    { hints: 'kode verifikasi' },
    { hints: '認証コード' },
    { hints: '인증번호' },
    { hints: '', maxLength: 1, digitBoxes: 6, inputMode: 'numeric' },
    { hints: 'digit 1', maxLength: 1, digitBoxes: 4 },
    { hints: 'code', inputMode: 'numeric', maxLength: 6 },
    { hints: 'kod', type: 'tel', maxLength: 6 },
    { hints: 'tan', maxLength: 6 },
  ];
  for (const f of yes) assert.equal(k(f), 'oneTimeCode', JSON.stringify(f));
});

test('card numbers and security codes', () => {
  assert.equal(k({ autocomplete: 'cc-number' }), 'cardNumber');
  assert.equal(k({ hints: 'card number', inputMode: 'numeric' }), 'cardNumber');
  assert.equal(k({ hints: 'kart numarası' }), 'cardNumber');
  assert.equal(k({ hints: 'numéro de carte' }), 'cardNumber');
  assert.equal(k({ hints: 'номер карты' }), 'cardNumber');
  assert.equal(k({ autocomplete: 'cc-csc' }), 'securityCode');
  assert.equal(k({ hints: 'cvc', maxLength: 4 }), 'securityCode');
  assert.equal(k({ hints: 'cvv2' }), 'securityCode');
  assert.equal(k({ hints: 'security code' }), 'securityCode');
  assert.equal(k({ hints: 'güvenlik kodu' }), 'securityCode');
  assert.equal(k({ hints: 'kartenprüfnummer' }), 'securityCode');
});

test('ordinary fields are not secret: numbers, codes that are not secrets, details named by autocomplete', () => {
  const no: Facts[] = [
    { hints: 'quantity', type: 'number', maxLength: 4 },
    { hints: 'adet', inputMode: 'numeric' },
    { hints: 'zip code', inputMode: 'numeric', maxLength: 5 },
    { hints: 'postal code', maxLength: 6 },
    { hints: 'posta kodu', inputMode: 'numeric', maxLength: 5 },
    { hints: 'plz', inputMode: 'numeric', maxLength: 5 },
    { hints: 'promo code', maxLength: 8 },
    { hints: 'gift card code' },
    { hints: 'kupon kodu' },
    { hints: 'gutschein code' },
    { hints: 'country code', inputMode: 'numeric', maxLength: 4 },
    { hints: 'phone', type: 'tel', maxLength: 10 },
    { hints: 'telefon numarası', inputMode: 'tel' },
    { hints: 'age', type: 'number', maxLength: 3 },
    { hints: 'amount', inputMode: 'decimal' },
    { hints: 'year of birth', inputMode: 'numeric', maxLength: 4 },
    { hints: 'search', type: 'search' },
    { hints: 'email', type: 'email' },
    { hints: 'username', autocomplete: 'username' },
    { hints: 'order number', inputMode: 'numeric', maxLength: 8 },
    { hints: 'booking code', maxLength: 6 },
    { hints: 'expiry date mm/yy', autocomplete: 'cc-exp' },
    { hints: 'name on card', autocomplete: 'cc-name' },
    { hints: 'comment', type: '' },
    { hints: 'first name' },
    { hints: 'street address', autocomplete: 'street-address' },
    { hints: 'tracking number', inputMode: 'numeric' },
    { hints: '', maxLength: 1, digitBoxes: 1 },
    { hints: 'company passport office', type: 'text' },
  ];
  for (const f of no) assert.equal(k(f), null, JSON.stringify(f));
});

test('the refusal tells the model to ask the user, and never for the value', () => {
  assert.ok(isSecretKind('oneTimeCode'));
  assert.ok(!isSecretKind('email'));
  const text = secretFieldText(7, 'oneTimeCode');
  assert.match(text, /nothing was typed/);
  assert.match(text, /ask_user/);
  assert.match(text, /Do not ask them to tell you the value/);
});
