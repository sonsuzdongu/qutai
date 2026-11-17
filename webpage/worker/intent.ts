/**
 * `/intent/sign-in/email?token=…`: the https link in Qutai's sign-in email. Mail apps (Gmail above all) don't make a
 * custom-scheme address tappable, so the mail links here, and this page hands the token to the app:
 * `<SCHEME>://sign-in/email?token=…` (on Android as an `intent://` URL naming the app's package, so Chrome opens the
 * app, or the store when it isn't installed). It tries once by itself on a phone, and always shows a button.
 *
 * The token is a sign-in secret (single use, 10 minutes, only on the phone that asked), so this page:
 * - never signs in or calls anything: opening it (a mail scanner does) uses nothing up;
 * - sends the token nowhere but into the app's link: no third-party loads, `Referrer-Policy: no-referrer`, not
 *   cached, not indexed; the Worker logs nothing (observability is off);
 * - takes it out of the address bar and the history entry once the page has it (`history.replaceState`).
 *
 * In the app's ten interface languages, picked from Accept-Language (the site's `lang` cookie first for en/tr).
 */
import { cookieLanguage } from './language';

export const INTENT_PATH = '/intent/sign-in/email';

const TOKEN = /^[A-Za-z0-9_-]{16,256}$/;
const SCHEME_RE = /^[a-z][a-z0-9+.-]{0,30}$/;
const PACKAGE_RE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;

export type IntentLang = 'en' | 'tr' | 'de' | 'es' | 'pt-BR' | 'fr' | 'ja' | 'ko' | 'ru' | 'id';

interface Strings {
  title: string;
  lead: string;
  button: string;
  help: string;
  desktop: string;
  invalidTitle: string;
  invalid: string;
  home: string;
}

/** Turkish addresses the reader as "siz", like the app. */
export const STRINGS: Record<IntentLang, Strings> = {
  en: {
    title: 'Sign in to Qutai',
    lead: 'Tap the button to finish signing in in the Qutai app.',
    button: 'Open Qutai',
    help: 'Nothing happens? Open this link on the phone where you asked for the code, with Qutai installed. Or enter the 6-digit code from the email in the app.',
    desktop: 'This link opens the Qutai app on your phone. Open the email on the phone where you asked for the code, or enter the 6-digit code from the email there.',
    invalidTitle: 'This link is incomplete',
    invalid: 'Open the link again from the newest email, or enter the 6-digit code from the email in the app.',
    home: 'Qutai website',
  },
  tr: {
    title: 'Qutai’de oturum açın',
    lead: 'Oturum açmayı Qutai uygulamasında tamamlamak için düğmeye dokunun.',
    button: 'Qutai’yi aç',
    help: 'Bir şey olmuyor mu? Bu bağlantıyı, kodu istediğiniz ve Qutai’nin yüklü olduğu telefonda açın. Ya da e-postadaki 6 haneli kodu uygulamaya girin.',
    desktop: 'Bu bağlantı telefonunuzdaki Qutai uygulamasını açar. E-postayı kodu istediğiniz telefonda açın ya da e-postadaki 6 haneli kodu orada girin.',
    invalidTitle: 'Bu bağlantı eksik',
    invalid: 'Bağlantıyı en yeni e-postadan tekrar açın ya da e-postadaki 6 haneli kodu uygulamaya girin.',
    home: 'Qutai web sitesi',
  },
  de: {
    title: 'Bei Qutai anmelden',
    lead: 'Tippen Sie auf die Schaltfläche, um die Anmeldung in der Qutai-App abzuschließen.',
    button: 'Qutai öffnen',
    help: 'Passiert nichts? Öffnen Sie diesen Link auf dem Telefon, auf dem Sie den Code angefordert haben und Qutai installiert ist. Oder geben Sie den 6-stelligen Code aus der E-Mail in der App ein.',
    desktop: 'Dieser Link öffnet die Qutai-App auf Ihrem Telefon. Öffnen Sie die E-Mail auf dem Telefon, auf dem Sie den Code angefordert haben, oder geben Sie dort den 6-stelligen Code aus der E-Mail ein.',
    invalidTitle: 'Dieser Link ist unvollständig',
    invalid: 'Öffnen Sie den Link erneut aus der neuesten E-Mail oder geben Sie den 6-stelligen Code aus der E-Mail in der App ein.',
    home: 'Qutai-Website',
  },
  es: {
    title: 'Iniciar sesión en Qutai',
    lead: 'Toca el botón para terminar de iniciar sesión en la app Qutai.',
    button: 'Abrir Qutai',
    help: '¿No pasa nada? Abre este enlace en el teléfono donde pediste el código y que tiene Qutai instalado. O escribe en la app el código de 6 dígitos del correo.',
    desktop: 'Este enlace abre la app Qutai en tu teléfono. Abre el correo en el teléfono donde pediste el código o escribe allí el código de 6 dígitos del correo.',
    invalidTitle: 'Este enlace está incompleto',
    invalid: 'Abre de nuevo el enlace desde el correo más reciente o escribe en la app el código de 6 dígitos del correo.',
    home: 'Sitio web de Qutai',
  },
  'pt-BR': {
    title: 'Entrar no Qutai',
    lead: 'Toque no botão para terminar de entrar no app Qutai.',
    button: 'Abrir o Qutai',
    help: 'Nada aconteceu? Abra este link no celular em que você pediu o código e que tem o Qutai instalado. Ou digite no app o código de 6 dígitos do e-mail.',
    desktop: 'Este link abre o app Qutai no seu celular. Abra o e-mail no celular em que você pediu o código ou digite lá o código de 6 dígitos do e-mail.',
    invalidTitle: 'Este link está incompleto',
    invalid: 'Abra o link de novo pelo e-mail mais recente ou digite no app o código de 6 dígitos do e-mail.',
    home: 'Site do Qutai',
  },
  fr: {
    title: 'Se connecter à Qutai',
    lead: 'Touchez le bouton pour terminer la connexion dans l’app Qutai.',
    button: 'Ouvrir Qutai',
    help: 'Rien ne se passe ? Ouvrez ce lien sur le téléphone où vous avez demandé le code et où Qutai est installé. Ou saisissez dans l’app le code à 6 chiffres de l’e-mail.',
    desktop: 'Ce lien ouvre l’app Qutai sur votre téléphone. Ouvrez l’e-mail sur le téléphone où vous avez demandé le code, ou saisissez-y le code à 6 chiffres de l’e-mail.',
    invalidTitle: 'Ce lien est incomplet',
    invalid: 'Rouvrez le lien depuis l’e-mail le plus récent, ou saisissez dans l’app le code à 6 chiffres de l’e-mail.',
    home: 'Site de Qutai',
  },
  ja: {
    title: 'Qutai にログイン',
    lead: 'ボタンをタップして、Qutai アプリでログインを完了してください。',
    button: 'Qutai を開く',
    help: '何も起こらない場合は、コードをリクエストした、Qutai がインストールされているスマートフォンでこのリンクを開いてください。または、メールに記載の 6 桁のコードをアプリに入力してください。',
    desktop: 'このリンクはスマートフォンの Qutai アプリを開きます。コードをリクエストしたスマートフォンでメールを開くか、そこでメールに記載の 6 桁のコードを入力してください。',
    invalidTitle: 'このリンクは不完全です',
    invalid: '最新のメールからリンクをもう一度開くか、メールに記載の 6 桁のコードをアプリに入力してください。',
    home: 'Qutai のウェブサイト',
  },
  ko: {
    title: 'Qutai에 로그인',
    lead: '버튼을 탭해 Qutai 앱에서 로그인을 마치세요.',
    button: 'Qutai 열기',
    help: '아무 일도 일어나지 않나요? 코드를 요청했고 Qutai가 설치된 휴대전화에서 이 링크를 여세요. 또는 이메일의 6자리 코드를 앱에 입력하세요.',
    desktop: '이 링크는 휴대전화의 Qutai 앱을 엽니다. 코드를 요청한 휴대전화에서 이메일을 열거나 그곳에서 이메일의 6자리 코드를 입력하세요.',
    invalidTitle: '링크가 완전하지 않습니다',
    invalid: '가장 최근 이메일에서 링크를 다시 열거나 이메일의 6자리 코드를 앱에 입력하세요.',
    home: 'Qutai 웹사이트',
  },
  ru: {
    title: 'Вход в Qutai',
    lead: 'Нажмите кнопку, чтобы завершить вход в приложении Qutai.',
    button: 'Открыть Qutai',
    help: 'Ничего не происходит? Откройте эту ссылку на телефоне, где вы запросили код и где установлен Qutai. Или введите в приложении 6-значный код из письма.',
    desktop: 'Эта ссылка открывает приложение Qutai на телефоне. Откройте письмо на телефоне, где вы запросили код, или введите там 6-значный код из письма.',
    invalidTitle: 'Ссылка неполная',
    invalid: 'Откройте ссылку снова из самого нового письма или введите в приложении 6-значный код из письма.',
    home: 'Сайт Qutai',
  },
  id: {
    title: 'Login ke Qutai',
    lead: 'Ketuk tombol untuk menyelesaikan login di aplikasi Qutai.',
    button: 'Buka Qutai',
    help: 'Tidak terjadi apa-apa? Buka tautan ini di ponsel tempat Anda meminta kode dan yang terpasang Qutai. Atau masukkan kode 6 digit dari email di aplikasi.',
    desktop: 'Tautan ini membuka aplikasi Qutai di ponsel Anda. Buka email di ponsel tempat Anda meminta kode, atau masukkan kode 6 digit dari email di sana.',
    invalidTitle: 'Tautan ini tidak lengkap',
    invalid: 'Buka lagi tautan dari email terbaru, atau masukkan kode 6 digit dari email di aplikasi.',
    home: 'Situs web Qutai',
  },
};

const LANGS = Object.keys(STRINGS) as IntentLang[];

/** The first of the app's languages in Accept-Language (by preference); the site's `lang` cookie wins for en/tr. */
export function intentLanguage(cookie: string | null, acceptLanguage: string | null): IntentLang {
  const fromCookie = cookieLanguage(cookie);
  if (fromCookie) return fromCookie;
  const entries = (acceptLanguage ?? '')
    .split(',')
    .map((raw, index) => {
      const [tag = '', ...params] = raw.trim().toLowerCase().split(';');
      const qParam = params.map((p) => p.trim().split('=')).find(([k]) => k === 'q');
      const q = qParam ? Number(qParam[1]) : 1;
      return { tag: tag.trim(), q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((e) => e.tag && e.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { tag } of entries) {
    const primary = tag.split('-')[0];
    if (primary === 'pt') return 'pt-BR';
    const match = LANGS.find((l) => l === primary);
    if (match) return match;
  }
  return 'en';
}

export type Platform = 'android' | 'ios' | 'other';

export function platformOf(userAgent: string | null): Platform {
  const ua = userAgent ?? '';
  if (/Android/i.test(ua)) return 'android';
  // iPadOS reports a Mac user agent; "Mobile" is still there on its Safari.
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua))) return 'ios';
  return 'other';
}

export interface IntentConfig {
  /** The app's URL scheme (`SCHEME`), `qutai`. */
  scheme: string;
  /** The Android package (`ANDROID_PACKAGE`), so Chrome opens exactly this app (or its store page). Optional. */
  androidPackage: string;
}

export function intentConfig(env: { SCHEME?: string; ANDROID_PACKAGE?: string }): IntentConfig {
  const scheme = (env.SCHEME ?? '').trim().toLowerCase();
  const androidPackage = (env.ANDROID_PACKAGE ?? '').trim();
  return {
    scheme: SCHEME_RE.test(scheme) ? scheme : 'qutai',
    androidPackage: PACKAGE_RE.test(androidPackage) ? androidPackage : '',
  };
}

/** The app link for a token: `qutai://sign-in/email?token=…`. */
export function appLink(config: IntentConfig, token: string): string {
  return `${config.scheme}://sign-in/email?token=${token}`;
}

/**
 * Android: an `intent:` URL, which Chrome (and the in-app browsers built on it, Gmail's included) opens in the app.
 * With the app missing it goes to `fallback` (this page again, marked as tried, so it doesn't loop).
 */
export function androidIntentLink(config: IntentConfig, token: string, fallback: string): string {
  const parts = [`scheme=${config.scheme}`];
  if (config.androidPackage) parts.push(`package=${config.androidPackage}`);
  parts.push(`S.browser_fallback_url=${encodeURIComponent(fallback)}`);
  return `intent://sign-in/email?token=${token}#Intent;${parts.join(';')};end`;
}

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function nonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function intentPage(request: Request, config: IntentConfig): Response {
  const url = new URL(request.url);
  const lang = intentLanguage(request.headers.get('Cookie'), request.headers.get('Accept-Language'));
  const s = STRINGS[lang];
  const platform = platformOf(request.headers.get('User-Agent'));
  const tokens = url.searchParams.getAll('token');
  const token = tokens.length === 1 && TOKEN.test(tokens[0]!) ? tokens[0]! : null;
  const tried = url.searchParams.get('tried') === '1';

  let href: string | null = null;
  if (token) {
    const fallback = new URL(INTENT_PATH, url);
    fallback.searchParams.set('token', token);
    fallback.searchParams.set('tried', '1');
    href = platform === 'android' ? androidIntentLink(config, token, fallback.toString()) : appLink(config, token);
  }
  // A phone tries the app at once (once: not after Android came back here because the app is missing). A computer
  // can't open the phone's app, so it only explains.
  const autoOpen = !!href && platform !== 'other' && !tried;
  const n = nonce();

  const body = !token
    ? `<h1>${escape(s.invalidTitle)}</h1><p>${escape(s.invalid)}</p>`
    : [
        `<h1>${escape(s.title)}</h1>`,
        platform === 'other' ? `<p>${escape(s.desktop)}</p>` : `<p>${escape(s.lead)}</p>`,
        `<p class="center"><a id="open" class="button" href="${escape(href!)}">${escape(s.button)}</a></p>`,
        platform === 'other' ? '' : `<p class="help">${escape(s.help)}</p>`,
      ].join('');

  const script = [
    // The token stays in the button only: out of the address bar, the history entry and any later bookmark.
    `history.replaceState(null,'',location.pathname);`,
    autoOpen ? `location.href=document.getElementById('open').href;` : '',
  ].join('');

  const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="light">
<title>${escape(token ? s.title : s.invalidTitle)}</title>
<link rel="icon" href="/favicon-32.png" sizes="32x32">
<style nonce="${n}">
:root{color-scheme:light}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f2e7cf;color:#292119;
font:17px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;padding:24px max(16px,env(safe-area-inset-left))}
main{max-width:440px;width:100%;background:#fbf5e6;border:1px solid #d6c39c;border-radius:18px;padding:28px 22px;text-align:left}
.logo{display:block;width:64px;height:64px;border-radius:14px;margin:0 auto 18px}
h1{font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;font-size:1.6rem;line-height:1.25;margin:0 0 12px;text-align:center}
p{margin:0 0 16px}
.center{text-align:center;margin:22px 0}
.button{display:inline-block;min-width:200px;padding:14px 26px;border-radius:999px;background:#2287a5;color:#fff;text-decoration:none;font-weight:600;font-size:1.05rem;text-align:center}
.button:focus-visible{outline:3px solid #1b6e87;outline-offset:3px}
.help{font-size:.92rem;color:#574a39}
footer{text-align:center;font-size:.9rem;margin-top:8px}
footer a{color:#186579}
</style>
</head>
<body>
<main>
<img class="logo" src="/icon-192.png" alt="" width="64" height="64">
${body}
<footer><a href="/">${escape(s.home)}</a></footer>
</main>
${token ? `<script nonce="${n}">${script}</script>` : ''}
</body>
</html>
`;

  return new Response(html, {
    status: token ? 200 : 400,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Language': lang,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Accept-Language, Cookie, User-Agent',
      'Content-Security-Policy': `default-src 'none'; img-src 'self'; style-src 'nonce-${n}'; script-src 'nonce-${n}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    },
  });
}
