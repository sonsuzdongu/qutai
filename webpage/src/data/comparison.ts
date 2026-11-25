/**
 * The comparison table: the single source for both languages. Facts (state, source, date) are shared;
 * only labels and notes are translated.
 *
 * Updating it
 * - Qutai's column (`QUTAI`) follows the app's code and the owner's checklist (`checklist.md` at the repo root).
 *   When a feature changes there, change the cell's state and its notes here.
 * - A competitor cell must come from the vendor's own current page (feature page, help centre, pricing page or
 *   the app's store listing) about the MOBILE app. Put the URL in `source` and the day you read it in `checked`.
 *   Exception: the owner's own test of the mobile app, with no `source`, a note that says it was our test, and
 *   the test's day in `checked` (Brave's `agent` cell, 25 Nov 2026).
 *   If no such page settles it, use `unknown` (shown as a neutral dash, never as "no").
 * - Only the mobile app counts: a feature that exists only in the desktop version is `no` for that row.
 * - Write notes in your own words; never copy a vendor's text.
 * - Change `CHECKED` (the date shown above the table) when you re-check the table.
 */
export type State = 'yes' | 'partial' | 'no' | 'unknown';
export type Lang = 'en' | 'tr';
type Text = { en: string; tr: string };

export type Cell = {
  state: State;
  /** For the price row, a short value shown instead of a state label. */
  value?: Text;
  note?: Text;
  source?: string;
  checked?: string;
};

export type RowId =
  | 'agent'
  | 'research'
  | 'phoneHandoffs'
  | 'memoryForms'
  | 'byok'
  | 'noAccount'
  | 'directToProvider'
  | 'confirmations'
  | 'openSource'
  | 'adblock'
  | 'reader'
  | 'backgroundAudio'
  | 'sync'
  | 'availability'
  | 'price';

export type Group = { id: string; label: Text; rows: { id: RowId; label: Text }[] };

export const CHECKED = '2026-11-14';
export const REPO = 'https://github.com/sonsuzdongu/qutai';

export const GROUPS: Group[] = [
  {
    id: 'assistant',
    label: { en: 'The assistant', tr: 'Asistan' },
    rows: [
      {
        id: 'agent',
        label: { en: 'Acts on web pages for you (taps, types, fills forms)', tr: 'Sayfalarda sizin için işlem yapar (dokunur, yazar, form doldurur)' },
      },
      {
        id: 'research',
        label: { en: 'Research across pages or tabs, with sources', tr: 'Sayfalar ya da sekmeler arasında kaynaklı araştırma' },
      },
      {
        id: 'phoneHandoffs',
        label: { en: 'Calendar, calls and messages from the assistant', tr: 'Asistandan takvim, arama ve mesaj' },
      },
      {
        id: 'memoryForms',
        label: { en: 'Remembers your details and uses them in forms', tr: 'Bilgilerinizi hatırlayıp formlarda kullanır' },
      },
    ],
  },
  {
    id: 'control',
    label: { en: 'Your AI, your data', tr: 'Yapay zekânız, verileriniz' },
    rows: [
      {
        id: 'byok',
        label: { en: 'Your own AI key or model, or a choice of models', tr: 'Kendi AI anahtarınız ya da modeliniz, veya model seçimi' },
      },
      { id: 'noAccount', label: { en: 'Assistant works without an account', tr: 'Asistan hesap olmadan çalışır' } },
      {
        id: 'directToProvider',
        label: {
          en: 'Requests go straight from the phone to a provider you choose',
          tr: 'İstekler telefondan doğrudan seçtiğiniz sağlayıcıya gider',
        },
      },
      {
        id: 'confirmations',
        label: {
          en: 'Asks before actions; per-site permissions for the assistant',
          tr: 'İşlemden önce sorar; asistan için site bazında izinler',
        },
      },
      { id: 'openSource', label: { en: 'Open-source app', tr: 'Açık kaynak uygulama' } },
    ],
  },
  {
    id: 'browser',
    label: { en: 'Browser', tr: 'Tarayıcı' },
    rows: [
      { id: 'adblock', label: { en: 'Built-in ad and tracker blocking', tr: 'Yerleşik reklam ve izleyici engelleme' } },
      { id: 'reader', label: { en: 'Reader mode or read aloud', tr: 'Okuma modu ya da sesli okuma' } },
      { id: 'backgroundAudio', label: { en: 'Keeps playing in the background', tr: 'Arka planda çalmaya devam eder' } },
    ],
  },
  {
    id: 'availability',
    label: { en: 'Availability', tr: 'Erişim' },
    rows: [
      { id: 'sync', label: { en: 'Sync across devices', tr: 'Cihazlar arası eşitleme' } },
      { id: 'availability', label: { en: 'In the App Store or Google Play', tr: 'App Store’da ya da Google Play’de' } },
      { id: 'price', label: { en: 'Price of the AI features', tr: 'Yapay zekâ özelliklerinin fiyatı' } },
    ],
  },
];

export type Product = {
  id: string;
  name: string;
  platforms: Text;
  cells: Record<RowId, Cell>;
};

const t = (en: string, tr: string): Text => ({ en, tr });
const src = (path: string) => `${REPO}/blob/main/${path}`;

/** Qutai: what is in the code today (on Google Play, App Store in beta; not every feature tried on every device). */
export const QUTAI: Product = {
  id: 'qutai',
  name: 'Qutai',
  platforms: t('iOS and Android, in development', 'iOS ve Android, geliştirme aşamasında'),
  cells: {
    agent: {
      state: 'yes',
      note: t(
        'Taps, types, selects, navigates and fixes form errors; posts and pays only after your approval in Qutai’s window (paying is off by default).',
        'Dokunur, yazar, seçer, gezinir, form hatalarını düzeltir; paylaşım ve ödemeyi yalnızca Qutai’ın penceresinde onayınızla yapar (ödeme varsayılan olarak kapalı).',
      ),
      source: src('src/agent/tools.ts'),
    },
    research: {
      state: 'yes',
      note: t('Deep research with sources; reads other tabs and PDFs without switching.', 'Kaynaklı derin araştırma; diğer sekmeleri ve PDF’leri geçmeden okur.'),
      source: src('README.md'),
    },
    phoneHandoffs: {
      state: 'partial',
      note: t(
        'Reads and writes your calendar with your approval; calls, texts, WhatsApp and email, also to a contact found by name, are a button or a draft that you send.',
        'Onayınızla takvimi okur ve yazar; arama, SMS, WhatsApp ve e-posta, rehberden adıyla bulunan kişiye de, sizin gönderdiğiniz bir düğme ya da taslaktır.',
      ),
      source: src('src/agent/tools.ts'),
    },
    memoryForms: {
      state: 'yes',
      note: t(
        'Kept on the phone; asks per site before entering your details; ID numbers reach the AI only as a label; never passwords or cards.',
        'Telefonda saklanır; bilgilerinizi girmeden önce site bazında sorar; kimlik numaraları yapay zekâya yalnızca etiket olarak gider; şifre ve kart asla.',
      ),
      source: src('src/agent/personalData.ts'),
    },
    byok: {
      state: 'yes',
      note: t(
        'Anthropic, OpenAI, Gemini, OpenRouter or your own server; a model per conversation.',
        'Anthropic, OpenAI, Gemini, OpenRouter ya da kendi sunucunuz; sohbet başına model.',
      ),
      source: src('README.md'),
    },
    noAccount: {
      state: 'yes',
      note: t('No Qutai account with your own key; Qutai Credits, the optional paid service, use one.', 'Kendi anahtarınızla Qutai hesabı yok; isteğe bağlı ücretli hizmet Qutai Kredileri hesap kullanır.'),
      source: src('README.md'),
    },
    directToProvider: {
      state: 'yes',
      note: t(
        'With your own key, no Qutai server in between; with Qutai Credits, requests pass through Qutai’s server, which doesn’t store or log them.',
        'Kendi anahtarınızla arada Qutai sunucusu yok; Qutai Kredileriyle istekler Qutai sunucusundan geçer, orada saklanmaz ve kayda geçirilmez.',
      ),
      source: src('src/ai/providers.ts'),
    },
    confirmations: {
      state: 'yes',
      note: t('Per site: allow, ask, read only or blocked.', 'Site bazında: izin ver, sor, salt okunur ya da engelli.'),
      source: src('src/agent/sitePolicy.ts'),
    },
    openSource: { state: 'yes', note: t('Apache License 2.0.', 'Apache Lisansı 2.0.'), source: src('LICENSE') },
    adblock: {
      state: 'yes',
      note: t(
        'Filter lists you pick (EasyList, EasyPrivacy, AdGuard Turkish) or add by address; blocks whole domains, plus your own rules.',
        'Seçtiğiniz (EasyList, EasyPrivacy, AdGuard Turkish) ya da adresiyle eklediğiniz filtre listeleri; tüm alan adını engeller; kendi kurallarınız da eklenir.',
      ),
      source: src('README.md'),
    },
    reader: {
      state: 'yes',
      note: t('Both; read aloud in the language the text is written in.', 'İkisi de; sesli okuma metnin yazıldığı dilde.'),
      source: src('README.md'),
    },
    backgroundAudio: {
      state: 'partial',
      note: t(
        'On iPhone a video goes on as sound only, and some sites such as YouTube still stop it.',
        'iPhone’da video yalnızca ses olarak sürer; YouTube gibi bazı siteler yine de durdurur.',
      ),
      source: src('README.md'),
    },
    sync: {
      state: 'no',
      note: t('An encrypted backup file instead; optional sync is planned.', 'Yerine şifreli yedek dosyası; isteğe bağlı eşitleme planlanıyor.'),
      source: src('README.md'),
    },
    availability: { state: 'yes', note: t('Google Play; the App Store in beta testing (TestFlight).', 'Google Play’de; App Store’da beta testinde (TestFlight).') },
    price: {
      state: 'yes',
      value: t('Free, open source', 'Ücretsiz, açık kaynak'),
      note: t(
        'With your own key you pay your AI provider for what you use; or buy Qutai Credits from Qutai.',
        'Kendi anahtarınızla kullandığınız kadarını AI sağlayıcınıza ödersiniz; dilerseniz Qutai’dan Qutai Kredileri alırsınız.',
      ),
      source: src('README.md'),
    },
  },
};

const U: Cell = { state: 'unknown' };
const D = CHECKED;

export const COMPETITORS: Product[] = [
  {
    id: 'comet',
    name: 'Perplexity Comet',
    platforms: t('iOS and Android', 'iOS ve Android'),
    cells: {
      agent: {
        state: 'yes',
        note: t(
          'With “Smart task automation” it navigates sites and finishes a task by itself, such as adding items to the cart or trying promo codes at checkout; only while the app is open.',
          '“Smart task automation” ile sitelerde gezinip görevi kendisi bitiriyor; örneğin ürünleri sepete ekliyor ya da ödeme adımında indirim kodlarını deniyor. Yalnızca uygulama açıkken çalışıyor.',
        ),
        source: 'https://www.perplexity.ai/help-center/comet/en/articles/12875447-comet-for-android-quick-start-and-key-features',
        checked: D,
      },
      research: {
        state: 'yes',
        note: t('Deep Research with cited sources; answers across open tabs.', 'Kaynak gösteren Deep Research; açık sekmeler üzerinden yanıt.'),
        source: 'https://www.perplexity.ai/hub/blog/meet-comet-for-ios',
        checked: D,
      },
      phoneHandoffs: {
        state: 'partial',
        note: t(
          'On iPhone it can read calendar events and share a summary by email; adding events, calls and texts are not documented.',
          'iPhone’da takvim etkinliklerini okuyup özeti e-postayla paylaşabiliyor; etkinlik ekleme, arama ve SMS belgelenmemiş.',
        ),
        source: 'https://www.perplexity.ai/hub/blog/meet-comet-for-ios',
        checked: '2026-11-15',
      },
      memoryForms: {
        state: 'partial',
        note: t(
          'Uses your Perplexity account memory across devices; filling forms from it is not documented.',
          'Perplexity hesabındaki hafızayı cihazlar arasında kullanıyor; bununla form doldurma belgelenmemiş.',
        ),
        source: 'https://www.perplexity.ai/help-center/comet/en/articles/12658438-comet-memory',
        checked: '2026-11-15',
      },
      byok: U,
      noAccount: {
        state: 'partial',
        note: t('Basic AI features without an account; the assistant needs a paid plan.', 'Temel özellikler hesapsız; asistan ücretli plan istiyor.'),
        source: 'https://www.perplexity.ai/help-center/comet/en/articles/11583823-do-i-need-a-perplexity-account-to-use-comet',
        checked: D,
      },
      directToProvider: {
        state: 'no',
        note: t('Requests and page context go to Perplexity’s servers.', 'İstekler ve sayfa bağlamı Perplexity sunucularına gidiyor.'),
        source: 'https://www.perplexity.ai/comet/resources/articles/comet-data-privacy-security-faq-s',
        checked: D,
      },
      confirmations: {
        state: 'yes',
        note: t(
          'Asks before an agent first runs, and the assistant can be blocked on chosen sites.',
          'Bir ajan ilk kez çalışmadan önce soruyor; asistan seçilen sitelerde engellenebiliyor.',
        ),
        source: 'https://www.perplexity.ai/help-center/comet/en/articles/12867415-comet-assistant-privacy-data-use',
        checked: '2026-11-15',
      },
      openSource: {
        state: 'no',
        note: t(
          'Proprietary licence; only bundled third-party parts are open source.',
          'Tescilli lisans; yalnızca içindeki üçüncü taraf parçalar açık kaynak.',
        ),
        source: 'https://www.perplexity.ai/hub/legal/comet-terms-of-service',
        checked: '2026-11-15',
      },
      adblock: {
        state: 'yes',
        note: t('Standard and Aggressive levels; also hides leftover ad slots and cookie banners.', 'Standart ve Agresif düzeyler; boş kalan reklam alanlarını ve çerez uyarılarını da gizliyor.'),
        source: 'https://apps.apple.com/us/app/id6748622471',
        checked: D,
      },
      reader: {
        state: 'yes',
        note: t('Reader mode on iOS.', 'iOS’ta okuma modu.'),
        source: 'https://apps.apple.com/us/app/id6748622471',
        checked: D,
      },
      backgroundAudio: {
        state: 'yes',
        note: t('Video keeps playing after leaving the app (iOS listing).', 'Uygulamadan çıkınca video çalmaya devam ediyor (iOS sayfası).'),
        source: 'https://apps.apple.com/us/app/id6748622471',
        checked: D,
      },
      sync: {
        state: 'partial',
        note: t('Research threads and history carry over between devices.', 'Araştırmalar ve geçmiş cihazlar arasında taşınıyor.'),
        source: 'https://www.perplexity.ai/hub/blog/meet-comet-for-ios',
        checked: D,
      },
      availability: {
        state: 'yes',
        note: t('App Store and Google Play.', 'App Store ve Google Play.'),
        source: 'https://www.perplexity.ai/comet',
        checked: D,
      },
      price: {
        state: 'yes',
        value: t('Free + paid plans', 'Ücretsiz + ücretli planlar'),
        note: t('The assistant needs Pro or Max.', 'Asistan için Pro ya da Max gerekiyor.'),
        source: 'https://www.perplexity.ai/help-center/en/articles/11187416-which-perplexity-subscription-plan-is-right-for-you',
        checked: D,
      },
    },
  },
  {
    id: 'sigma',
    name: 'Sigma AI Browser',
    platforms: t('iOS; Android on a waitlist', 'iOS; Android için bekleme listesi'),
    cells: {
      agent: U,
      research: {
        state: 'yes',
        note: t('Deep Research mode with source-based answers on mobile.', 'Mobilde kaynaklara dayalı yanıt veren Deep Research modu.'),
        source: 'https://www.sigmabrowser.com/updates',
        checked: D,
      },
      phoneHandoffs: U,
      memoryForms: U,
      byok: {
        state: 'yes',
        note: t(
          'Local models on the phone, or your own model by API key.',
          'Telefonda yerel modeller ya da API anahtarıyla kendi modeliniz.',
        ),
        source: 'https://sigmabrowser.com/local-ai',
        checked: '2026-11-15',
      },
      noAccount: U,
      directToProvider: {
        state: 'partial',
        note: t(
          'The default AI is Sigma’s own service; only local models stay on the phone.',
          'Varsayılan yapay zekâ Sigma’nın kendi hizmeti; yalnızca yerel modeller telefonda kalıyor.',
        ),
        source: 'https://sigmabrowser.com/plans',
        checked: '2026-11-15',
      },
      confirmations: U,
      openSource: U,
      adblock: {
        state: 'yes',
        note: t(
          'Built-in ad and tracker blocker on iPhone.',
          'iPhone’da yerleşik reklam ve izleyici engelleyici.',
        ),
        source: 'https://sigmabrowser.com/browser-for-iphone',
        checked: '2026-11-15',
      },
      reader: U,
      backgroundAudio: U,
      sync: {
        state: 'yes',
        note: t('History, bookmarks and settings (App Store listing).', 'Geçmiş, yer imleri ve ayarlar (App Store sayfası).'),
        source: 'https://apps.apple.com/us/app/sigma-ai-browser/id6670252712',
        checked: D,
      },
      availability: {
        state: 'partial',
        note: t('App Store only so far.', 'Şimdilik yalnızca App Store.'),
        source: 'https://www.sigmabrowser.com/',
        checked: D,
      },
      price: {
        state: 'yes',
        value: t('Free + paid plans', 'Ücretsiz + ücretli planlar'),
        note: t('A free tier with limits, and Plus and Pro plans.', 'Sınırlı ücretsiz kullanım; Plus ve Pro planları.'),
        source: 'https://www.sigmabrowser.com/plans',
        checked: D,
      },
    },
  },
  {
    id: 'brave',
    name: 'Brave (Leo)',
    platforms: t('iOS and Android', 'iOS ve Android'),
    cells: {
      agent: {
        state: 'no',
        note: t(
          'Our own test of the mobile app: Leo could not tap, type or fill in forms on a page.',
          'Mobil uygulamada kendi denememiz: Leo bir sayfada dokunamadı, yazamadı, form dolduramadı.',
        ),
        checked: '2026-11-25',
      },
      research: {
        state: 'yes',
        note: t(
          'Leo answers can link Brave Search results, and on Android it can use tabs you mention.',
          'Leo yanıtları Brave Search sonuçlarına bağlantı verebiliyor; Android’de andığınız sekmeleri kullanabiliyor.',
        ),
        source: 'https://brave.com/blog/leo-real-time-results/',
        checked: '2026-11-15',
      },
      phoneHandoffs: U,
      memoryForms: {
        state: 'partial',
        note: t(
          'On Android, Leo can keep your name and interests to tailor answers; form filling is not documented.',
          'Android’de Leo yanıtları kişiselleştirmek için adınızı ve ilgi alanlarınızı tutabiliyor; form doldurma belgelenmemiş.',
        ),
        source: 'https://brave.com/whats-new/android/',
        checked: '2026-11-15',
      },
      byok: {
        state: 'partial',
        note: t('A choice of Leo models; using your own model is not in the mobile app.', 'Leo modelleri arasında seçim; kendi modelinizi kullanmak mobil uygulamada yok.'),
        source: 'https://brave.com/whats-new/android/',
        checked: D,
      },
      noAccount: {
        state: 'yes',
        note: t('Free Leo needs no account.', 'Ücretsiz Leo hesap istemiyor.'),
        source: 'https://brave.com/leo/',
        checked: D,
      },
      directToProvider: {
        state: 'no',
        note: t('Requests go to Leo’s servers through an anonymising proxy.', 'İstekler anonimleştiren bir vekil sunucu üzerinden Leo sunucularına gidiyor.'),
        source: 'https://brave.com/leo/',
        checked: D,
      },
      confirmations: {
        state: 'partial',
        note: t(
          'Release notes show Leo’s tool requests need your approval on Android; details are not documented.',
          'Sürüm notları Android’de Leo’nun araç isteklerinin onayınızı gerektirdiğini gösteriyor; ayrıntılar belgelenmemiş.',
        ),
        source: 'https://brave.com/latest/',
        checked: '2026-11-15',
      },
      openSource: {
        state: 'yes',
        note: t('MPL-2.0.', 'MPL-2.0.'),
        source: 'https://github.com/brave/brave-browser',
        checked: D,
      },
      adblock: {
        state: 'yes',
        note: t('Brave Shields, on by default.', 'Varsayılan olarak açık Brave Shields.'),
        source: 'https://apps.apple.com/us/app/brave-private-web-browser-vpn/id1052879175',
        checked: D,
      },
      reader: {
        state: 'partial',
        note: t(
          'Reader Mode is documented for iOS.',
          'Okuma modu iOS için belgelenmiş.',
        ),
        source: 'https://brave.com/latest/',
        checked: '2026-11-15',
      },
      backgroundAudio: {
        state: 'yes',
        note: t('Background and lock-screen playback; Playlist on iOS.', 'Arka planda ve kilit ekranında çalma; iOS’ta Playlist.'),
        source: 'https://brave.com/whats-new/android/',
        checked: D,
      },
      sync: {
        state: 'yes',
        note: t('Encrypted Brave Sync.', 'Şifreli Brave Sync.'),
        source: 'https://apps.apple.com/us/app/brave-private-web-browser-vpn/id1052879175',
        checked: D,
      },
      availability: {
        state: 'yes',
        note: t('App Store and Google Play.', 'App Store ve Google Play.'),
        source: 'https://brave.com/leo/',
        checked: D,
      },
      price: {
        state: 'yes',
        value: t('Free + paid plan', 'Ücretsiz + ücretli plan'),
        note: t('Leo is free with limits; Leo Premium costs more.', 'Leo sınırlı olarak ücretsiz; Leo Premium ücretli.'),
        source: 'https://brave.com/premium/',
        checked: D,
      },
    },
  },
  {
    id: 'edge',
    name: 'Microsoft Edge (Copilot)',
    platforms: t('iOS and Android', 'iOS ve Android'),
    cells: {
      agent: {
        state: 'no',
        note: t(
          'Copilot can act on sites for you (“Browse with Copilot”) only in Edge for desktop, for Microsoft 365 Premium in the US; the mobile app has no such feature.',
          'Copilot’un sitelerde sizin yerinize işlem yaptığı özellik (“Browse with Copilot”) yalnızca masaüstündeki Edge’de, ABD’de Microsoft 365 Premium abonelerine açık; mobil uygulamada böyle bir özellik yok.',
        ),
        source: 'https://blogs.windows.com/msedgedev/2026/05/13/new-updates-to-edge-across-desktop-and-mobile/',
        checked: D,
      },
      research: {
        state: 'partial',
        note: t('Answers across open tabs; linked sources not documented.', 'Açık sekmeler üzerinden yanıt; kaynak bağlantıları belgelenmemiş.'),
        source: 'https://blogs.windows.com/msedgedev/2026/05/13/new-updates-to-edge-across-desktop-and-mobile/',
        checked: D,
      },
      phoneHandoffs: U,
      memoryForms: {
        state: 'partial',
        note: t('Remembers past chats; use in forms not documented.', 'Geçmiş sohbetleri hatırlıyor; formlarda kullanımı belgelenmemiş.'),
        source: 'https://blogs.windows.com/msedgedev/2026/05/13/new-updates-to-edge-across-desktop-and-mobile/',
        checked: D,
      },
      byok: U,
      noAccount: {
        state: 'yes',
        note: t('Basic use without signing in; longer chats need an account.', 'Temel kullanım oturum açmadan; uzun sohbetler hesap istiyor.'),
        source: 'https://www.microsoft.com/en-us/edge/learning-center/how-to-use-copilot-in-edge-on-your-phone',
        checked: D,
      },
      directToProvider: {
        state: 'no',
        note: t(
          'Copilot in the app is Microsoft’s own AI service.',
          'Uygulamadaki Copilot Microsoft’un kendi yapay zekâ hizmeti.',
        ),
        source: 'https://explore.microsoft.com/en-us/edge/terms',
        checked: '2026-11-15',
      },
      confirmations: U,
      openSource: {
        state: 'no',
        note: t(
          'Proprietary licence terms cover the iOS and Android apps.',
          'iOS ve Android uygulamaları tescilli lisans koşullarıyla dağıtılıyor.',
        ),
        source: 'https://explore.microsoft.com/en-us/edge/terms',
        checked: '2026-11-15',
      },
      adblock: {
        state: 'yes',
        note: t('Adblock Plus and tracking prevention.', 'Adblock Plus ve izleme önleme.'),
        source: 'https://apps.apple.com/us/app/microsoft-edge-ai-browser/id1288723196',
        checked: D,
      },
      reader: {
        state: 'yes',
        note: t('Read Aloud.', 'Sesli okuma (Read Aloud).'),
        source: 'https://apps.apple.com/us/app/microsoft-edge-ai-browser/id1288723196',
        checked: D,
      },
      backgroundAudio: U,
      sync: {
        state: 'yes',
        note: t('Tabs, favourites and passwords, when signed in.', 'Oturum açıkken sekmeler, sık kullanılanlar ve şifreler.'),
        source: 'https://explore.microsoft.com/en-us/edge/mobile',
        checked: D,
      },
      availability: {
        state: 'yes',
        note: t('App Store and Google Play.', 'App Store ve Google Play.'),
        source: 'https://explore.microsoft.com/en-us/edge/mobile',
        checked: D,
      },
      price: {
        state: 'yes',
        value: t('Free + paid plan', 'Ücretsiz + ücretli plan'),
        note: t('Copilot is free; Microsoft 365 Premium adds more.', 'Copilot ücretsiz; Microsoft 365 Premium daha fazlasını ekliyor.'),
        source: 'https://apps.apple.com/us/app/microsoft-edge-ai-browser/id1288723196',
        checked: D,
      },
    },
  },
  {
    id: 'chrome',
    name: 'Google Chrome (Gemini)',
    platforms: t('iOS and Android', 'iOS ve Android'),
    cells: {
      agent: {
        state: 'partial',
        note: t(
          'Auto browse: Android only, with a paid Google AI plan, in some countries.',
          'Auto browse: yalnızca Android’de, ücretli Google AI planıyla, bazı ülkelerde.',
        ),
        source: 'https://support.google.com/chrome/answer/16821166?co=GENIE.Platform%3DAndroid&hl=en',
        checked: D,
      },
      research: {
        state: 'partial',
        note: t('Uses the current and recent tabs; linked sources not documented.', 'Geçerli ve son sekmeleri kullanıyor; kaynak bağlantıları belgelenmemiş.'),
        source: 'https://support.google.com/chrome/answer/16283624?co=GENIE.Platform%3DiOS&hl=en',
        checked: D,
      },
      phoneHandoffs: {
        state: 'partial',
        note: t('Adds events to Google Calendar on Android.', 'Android’de Google Takvim’e etkinlik ekliyor.'),
        source: 'https://blog.google/products-and-platforms/products/chrome/bringing-chrome-ai-to-android/',
        checked: D,
      },
      memoryForms: {
        state: 'partial',
        note: t(
          'Gemini-powered autofill suggests details from Gmail in forms; US only, with Personal Intelligence on.',
          'Gemini destekli otomatik doldurma formlarda Gmail’deki bilgileri öneriyor; yalnızca ABD’de, Personal Intelligence açıkken.',
        ),
        source: 'https://blog.google/products-and-platforms/products/chrome/enhanced-autofill-gmail/',
        checked: '2026-11-15',
      },
      byok: U,
      noAccount: {
        state: 'no',
        note: t('Gemini in Chrome needs you to sign in to Chrome.', 'Chrome’da Gemini için Chrome’da oturum açmak gerekiyor.'),
        source: 'https://support.google.com/chrome/answer/16283624?co=GENIE.Platform%3DAndroid&hl=en',
        checked: D,
      },
      directToProvider: {
        state: 'no',
        note: t('Uses Google’s Gemini; no other provider can be chosen.', 'Google’ın Gemini’sini kullanıyor; başka sağlayıcı seçilemiyor.'),
        source: 'https://support.google.com/chrome/answer/16283624?co=GENIE.Platform%3DAndroid&hl=en',
        checked: D,
      },
      confirmations: {
        state: 'yes',
        note: t('Auto browse asks before sensitive steps.', 'Auto browse hassas adımlardan önce soruyor.'),
        source: 'https://support.google.com/chrome/answer/16821166?co=GENIE.Platform%3DAndroid&hl=en',
        checked: D,
      },
      openSource: {
        state: 'partial',
        note: t('Built on the open-source Chromium project; Chrome has its own terms.', 'Açık kaynak Chromium projesine dayanıyor; Chrome’un kendi koşulları var.'),
        source: 'https://www.chromium.org/chromium-projects/',
        checked: D,
      },
      adblock: {
        state: 'partial',
        note: t('Removes ads only on sites that fail the Better Ads Standards.', 'Reklamları yalnızca Better Ads Standards’a uymayan sitelerde kaldırıyor.'),
        source: 'https://support.google.com/chrome/answer/7632919?co=GENIE.Platform%3DAndroid&hl=en',
        checked: D,
      },
      reader: {
        state: 'yes',
        note: t('Listen to this page (Android).', 'Bu sayfayı dinle (Android).'),
        source: 'https://support.google.com/chrome/answer/14768725?hl=en',
        checked: D,
      },
      backgroundAudio: {
        state: 'partial',
        note: t('Read-aloud continues with the screen locked; other media not documented.', 'Sesli okuma kilitli ekranda sürüyor; diğer medya belgelenmemiş.'),
        source: 'https://support.google.com/chrome/answer/14768725?hl=en',
        checked: D,
      },
      sync: {
        state: 'yes',
        note: t('With a Google Account.', 'Google Hesabı ile.'),
        source: 'https://support.google.com/chrome/answer/165139?co=GENIE.Platform%3DAndroid&hl=en',
        checked: D,
      },
      availability: {
        state: 'yes',
        note: t('App Store and Google Play.', 'App Store ve Google Play.'),
        source: 'https://play.google.com/store/apps/details?id=com.android.chrome',
        checked: D,
      },
      price: {
        state: 'yes',
        value: t('Free + paid plans', 'Ücretsiz + ücretli planlar'),
        note: t('Auto browse needs a paid Google AI plan.', 'Auto browse ücretli Google AI planı istiyor.'),
        source: 'https://support.google.com/chrome/answer/16821166?co=GENIE.Platform%3DAndroid&hl=en',
        checked: D,
      },
    },
  },
  {
    id: 'opera',
    name: 'Opera (Opera AI)',
    platforms: t('iOS and Android', 'iOS ve Android'),
    cells: {
      agent: U,
      research: {
        state: 'partial',
        note: t('Answers from current web information with links; multi-tab research not documented.', 'Güncel web bilgisiyle bağlantılı yanıtlar; çok sekmeli araştırma belgelenmemiş.'),
        source: 'https://blogs.opera.com/mobile/2026/01/say-hello-to-opera-browser-ai-on-opera-for-android/',
        checked: D,
      },
      phoneHandoffs: U,
      memoryForms: {
        state: 'partial',
        note: t(
          'The browser’s own autofill for addresses and cards; no AI memory is documented.',
          'Tarayıcının kendi adres ve kart otomatik doldurması; yapay zekâ hafızası belgelenmemiş.',
        ),
        source: 'https://help.opera.com/en/mobile/android/',
        checked: '2026-11-15',
      },
      byok: {
        state: 'no',
        note: t(
          'Opera’s service picks the model for each request.',
          'Her istek için modeli Opera’nın hizmeti seçiyor.',
        ),
        source: 'https://blogs.opera.com/news/2025/12/opera-upgrades-ai-experience-for-android/',
        checked: '2026-11-15',
      },
      noAccount: {
        state: 'yes',
        note: t('No account or sign-up needed.', 'Hesap ya da kayıt gerekmiyor.'),
        source: 'https://www.opera.com/features/aria',
        checked: D,
      },
      directToProvider: {
        state: 'no',
        note: t('Requests go to Opera’s own AI Engine.', 'İstekler Opera’nın kendi AI Engine’ine gidiyor.'),
        source: 'https://blogs.opera.com/mobile/2026/01/say-hello-to-opera-browser-ai-on-opera-for-android/',
        checked: D,
      },
      confirmations: U,
      openSource: {
        state: 'no',
        note: t('Proprietary licence.', 'Tescilli lisans.'),
        source: 'https://www.opera.com/eula/mobile',
        checked: D,
      },
      adblock: {
        state: 'yes',
        note: t('Ad and tracker blocking built in.', 'Reklam ve izleyici engelleme yerleşik.'),
        source: 'https://www.opera.com/features/ad-blocker',
        checked: D,
      },
      reader: U,
      backgroundAudio: {
        state: 'partial',
        note: t('Background media playback documented for iOS.', 'Arka planda medya çalma iOS için belgelenmiş.'),
        source: 'https://apps.apple.com/us/app/opera-ai-browser-with-vpn/id1411869974',
        checked: D,
      },
      sync: {
        state: 'yes',
        note: t('History, bookmarks and tabs, with an Opera account.', 'Opera hesabıyla geçmiş, yer imleri ve sekmeler.'),
        source: 'https://play.google.com/store/apps/details?id=com.opera.browser',
        checked: D,
      },
      availability: {
        state: 'yes',
        note: t('App Store and Google Play.', 'App Store ve Google Play.'),
        source: 'https://apps.apple.com/us/app/opera-ai-browser-with-vpn/id1411869974',
        checked: D,
      },
      price: {
        state: 'yes',
        value: t('Free', 'Ücretsiz'),
        source: 'https://www.opera.com/features/aria',
        checked: D,
      },
    },
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo (Duck.ai)',
    platforms: t('iOS and Android', 'iOS ve Android'),
    cells: {
      agent: {
        state: 'no',
        note: t(
          'Its AI features are the Duck.ai chat and Search Assist answers.',
          'Yapay zekâ özellikleri Duck.ai sohbeti ve Search Assist yanıtlarından ibaret.',
        ),
        source: 'https://duckduckgo.com/duckduckgo-help-pages/duckai/approach-to-ai',
        checked: '2026-11-15',
      },
      research: {
        state: 'partial',
        note: t('Search answers link one or two sources.', 'Arama yanıtları bir iki kaynağa bağlantı veriyor.'),
        source: 'https://duckduckgo.com/duckduckgo-help-pages/results/ai-assisted-answers',
        checked: D,
      },
      phoneHandoffs: U,
      memoryForms: {
        state: 'partial',
        note: t(
          'The browser’s own on-device autofill; Duck.ai does not fill forms.',
          'Tarayıcının cihazdaki kendi otomatik doldurması; Duck.ai form doldurmuyor.',
        ),
        source: 'https://duckduckgo.com/duckduckgo-help-pages/passwords-autofill',
        checked: '2026-11-15',
      },
      byok: {
        state: 'partial',
        note: t('A choice of models from several providers; no own key.', 'Birkaç sağlayıcının modelleri arasında seçim; kendi anahtar yok.'),
        source: 'https://duckduckgo.com/duckduckgo-help-pages/duckai/chat-models',
        checked: D,
      },
      noAccount: {
        state: 'yes',
        note: t('Free, no account needed.', 'Ücretsiz, hesap gerekmiyor.'),
        source: 'https://duckduckgo.com/duckduckgo-help-pages/duckai/approach-to-ai',
        checked: D,
      },
      directToProvider: {
        state: 'no',
        note: t('Requests pass through DuckDuckGo, which removes metadata such as your IP address.', 'İstekler IP adresi gibi üst verileri silen DuckDuckGo üzerinden geçiyor.'),
        source: 'https://duckduckgo.com/duckduckgo-help-pages/duckai/ai-chat-privacy',
        checked: D,
      },
      confirmations: U,
      openSource: {
        state: 'yes',
        note: t('Apache 2.0.', 'Apache 2.0.'),
        source: 'https://github.com/duckduckgo/apple-browsers',
        checked: D,
      },
      adblock: {
        state: 'yes',
        note: t('Blocks most ads and third-party trackers.', 'Reklamların ve üçüncü taraf izleyicilerin çoğunu engelliyor.'),
        source: 'https://duckduckgo.com/duckduckgo-help-pages/ad-blocking',
        checked: D,
      },
      reader: U,
      backgroundAudio: U,
      sync: {
        state: 'partial',
        note: t('Bookmarks, passwords and Duck.ai chats.', 'Yer imleri, şifreler ve Duck.ai sohbetleri.'),
        source: 'https://duckduckgo.com/duckduckgo-help-pages/sync-and-backup',
        checked: D,
      },
      availability: {
        state: 'yes',
        note: t('App Store and Google Play.', 'App Store ve Google Play.'),
        source: 'https://apps.apple.com/us/app/duckduckgo-browser-w-duck-ai/id663592361',
        checked: D,
      },
      price: {
        state: 'yes',
        value: t('Free + paid plans', 'Ücretsiz + ücretli planlar'),
        note: t('Free with a daily limit; paid plans add models and limits.', 'Günlük sınırla ücretsiz; ücretli planlar model ve sınır ekliyor.'),
        source: 'https://duckduckgo.com/duckduckgo-help-pages/duckai/chat-models',
        checked: D,
      },
    },
  },
  {
    id: 'samsung',
    name: 'Samsung Internet',
    platforms: t('Android', 'Android'),
    cells: {
      agent: {
        state: 'partial',
        note: t(
          'Browsing assist manages tabs and history; clicking or filling forms not documented. US and South Korea.',
          'Browsing assist sekmeleri ve geçmişi yönetiyor; tıklama ya da form doldurma belgelenmemiş. ABD ve Güney Kore.',
        ),
        source: 'https://news.samsung.com/global/samsung-takes-its-browser-beyond-mobile-extending-agentic-ai-across-devices',
        checked: D,
      },
      research: {
        state: 'partial',
        note: t('Summarises and compares across tabs; linked sources not documented.', 'Sekmeler arasında özetliyor ve karşılaştırıyor; kaynak bağlantıları belgelenmemiş.'),
        source: 'https://news.samsung.com/global/samsung-takes-its-browser-beyond-mobile-extending-agentic-ai-across-devices',
        checked: D,
      },
      phoneHandoffs: {
        state: 'no',
        note: t(
          'Browsing assist summarises, translates and reads highlights aloud only.',
          'Browsing assist yalnızca özetliyor, çeviriyor ve öne çıkanları sesli okuyor.',
        ),
        source: 'https://www.samsung.com/us/support/answer/ANS10012964/',
        checked: '2026-11-15',
      },
      memoryForms: {
        state: 'partial',
        note: t(
          'The browser’s own autofill; Browsing assist does not keep personal details.',
          'Tarayıcının kendi otomatik doldurması; Browsing assist kişisel bilgi tutmuyor.',
        ),
        source: 'https://www.samsung.com/us/support/answer/ANS00076953',
        checked: '2026-11-15',
      },
      byok: U,
      noAccount: {
        state: 'no',
        note: t('Browsing assist needs a Samsung Account.', 'Browsing assist Samsung Hesabı istiyor.'),
        source: 'https://news.samsung.com/global/samsung-takes-its-browser-beyond-mobile-extending-agentic-ai-across-devices',
        checked: D,
      },
      directToProvider: {
        state: 'no',
        note: t(
          'Browsing assist is Samsung’s Galaxy AI service and needs a Samsung account.',
          'Browsing assist Samsung’un Galaxy AI hizmeti ve Samsung Hesabı istiyor.',
        ),
        source: 'https://www.samsung.com/au/support/mobile-devices/how-to-set-up-and-use-the-browsing-assist-features-on-the-galaxy-s24',
        checked: '2026-11-15',
      },
      confirmations: U,
      openSource: {
        state: 'no',
        note: t(
          'Samsung’s terms describe the browser as proprietary.',
          'Samsung’un koşulları tarayıcıyı tescilli yazılım olarak tanımlıyor.',
        ),
        source: 'https://www.internet.apps.samsung.com/tos/us/index.html',
        checked: '2026-11-15',
      },
      adblock: {
        state: 'partial',
        note: t('Anti-tracking built in; ad blocking through separate blocker apps.', 'İzleme önleme yerleşik; reklam engelleme ayrı engelleyici uygulamalarla.'),
        source: 'https://play.google.com/store/apps/details?id=com.sec.android.app.sbrowser',
        checked: D,
      },
      reader: {
        state: 'yes',
        note: t('Reads selected text aloud.', 'Seçili metni sesli okuyor.'),
        source: 'https://www.samsung.com/us/support/answer/ANS10012964/',
        checked: D,
      },
      backgroundAudio: {
        state: 'yes',
        note: t(
          'A Background play setting; some sites, such as YouTube, may not support it.',
          'Arka planda oynatma ayarı var; YouTube gibi bazı siteler desteklemeyebiliyor.',
        ),
        source: 'https://www.samsung.com/us/support/troubleshoot/TSG10010305/',
        checked: '2026-11-15',
      },
      sync: {
        state: 'yes',
        note: t('Bookmarks and history, with a Samsung Account.', 'Samsung Hesabıyla yer imleri ve geçmiş.'),
        source: 'https://news.samsung.com/global/samsung-takes-its-browser-beyond-mobile-extending-agentic-ai-across-devices',
        checked: D,
      },
      availability: {
        state: 'yes',
        note: t('Google Play; no iOS app.', 'Google Play; iOS uygulaması yok.'),
        source: 'https://play.google.com/store/apps/details?id=com.sec.android.app.sbrowser',
        checked: D,
      },
      price: {
        state: 'yes',
        value: t('Free (basic Galaxy AI)', 'Ücretsiz (temel Galaxy AI)'),
        note: t(
          'Samsung says basic Galaxy AI features are free; enhanced ones may cost extra.',
          'Samsung temel Galaxy AI özelliklerinin ücretsiz olduğunu, gelişmiş olanların ücretli olabileceğini söylüyor.',
        ),
        source: 'https://www.samsung.com/us/support/answer/ANS10012964/',
        checked: '2026-11-15',
      },
    },
  },
];

/** On the competitors list but not in the table, with the reason (shown under the table). */
export const EXCLUDED: { name: string; reason: Text; source: string; checked: string }[] = [
  {
    name: 'Arc Search',
    reason: t(
      'its AI features are being switched off on 23 November 2026',
      'yapay zekâ özellikleri 23 Kasım 2026’da kapatılıyor',
    ),
    source: 'https://arc.net/search',
    checked: D,
  },
  {
    name: 'Hyperweb',
    reason: t('we found no Hyperweb mobile browser', 'Hyperweb’in bir mobil tarayıcısını bulamadık'),
    source: 'https://hyperweb.ai/',
    checked: D,
  },
];

/** The competitor shown first on small screens, where one at a time is compared with Qutai. */
export const DEFAULT_PICK = 'comet';
