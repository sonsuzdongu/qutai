// The pricing page (/en/pricing/, /tr/pricing/): what Qutai costs. Every line comes from the design record
// (docs/design/34-credits-and-relay.md, 35-purchases.md, 41-legal-texts.md, 31-onboarding.md) or the owner's own word
// (the packs and their prices, 2026-11-26, WEB-15). The stores set the price a buyer actually pays, in their currency.
import type { Text } from './features';

const t = (en: string, tr: string): Text => ({ en, tr });

/** When the packs and prices on this page were last checked against the owner's word (the sitemap's lastmod). */
export const PRICING_CHECKED = '2026-11-26';

export const PAGE = {
  metaTitle: t('Pricing · Qutai', 'Fiyatlar · Qutai'),
  metaDescription: t(
    'Qutai is free. Use it with your own AI key and pay Qutai nothing, or buy Qutai Credits in the app: 100 credits for $1, 550 for $5, 1,200 for $10.',
    'Qutai ücretsiz. Kendi yapay zekâ anahtarınızla kullanırsanız bize hiçbir şey ödemezsiniz; isterseniz uygulamadan Qutai Kredisi alırsınız: 100 kredi 1 dolar, 550 kredi 5 dolar, 1.200 kredi 10 dolar.',
  ),
  kicker: t('Pricing', 'Fiyatlar'),
  title: t(
    'Free to use. You choose how to pay for the AI.',
    'Qutai ücretsiz. Yapay zekâ için nasıl ödeyeceğinizi siz seçersiniz.',
  ),
  lede: t(
    'The app itself costs nothing. For the assistant, bring your own key from an AI provider, or skip keys altogether and buy Qutai Credits in the app.',
    'Uygulamanın kendisi ücretsiz. Asistan için ya bir yapay zekâ sağlayıcısından aldığınız anahtarı kullanırsınız ya da anahtarla hiç uğraşmadan uygulamadan Qutai Kredisi alırsınız.',
  ),
};

export type Plan = {
  id: 'own-key' | 'credits';
  name: Text;
  price: Text;
  sub: Text;
  points: Text[];
};

export const PLANS: Plan[] = [
  {
    id: 'own-key',
    name: t('Your own AI key', 'Kendi anahtarınızla'),
    price: t('Free', 'Ücretsiz'),
    sub: t(
      'Qutai charges nothing. Your AI provider bills you directly for what you use.',
      'Qutai’a hiçbir şey ödemezsiniz. Kullandığınız kadarını yapay zekâ sağlayıcınız size doğrudan faturalar.',
    ),
    points: [
      t(
        'Anthropic, OpenAI, Google Gemini, OpenRouter or your own OpenAI-compatible server (Ollama, LM Studio, vLLM)',
        'Anthropic, OpenAI, Google Gemini, OpenRouter ya da kendi OpenAI uyumlu sunucunuz (Ollama, LM Studio, vLLM)',
      ),
      t(
        'Requests go from your phone straight to the provider, never through Qutai’s server',
        'İstekler telefonunuzdan doğrudan sağlayıcıya gider, Qutai sunucusuna hiç uğramaz',
      ),
      t('You pick the model for each conversation', 'Modeli her sohbet için siz seçersiniz'),
      t('Your key stays in the phone’s secure storage', 'Anahtarınız telefonun güvenli deposunda kalır'),
      t('No account needed', 'Hesap açmanız gerekmez'),
    ],
  },
  {
    id: 'credits',
    name: t('Qutai Credits', 'Qutai Kredileri'),
    price: t('From $1', '1 dolardan başlayan paketler'),
    sub: t(
      'No key to set up. Buy credits in the app; each task uses only what it costs.',
      'Anahtar ayarlamanıza gerek yok. Krediyi uygulamadan alırsınız, her iş yalnızca tuttuğu kadar kredi harcar.',
    ),
    points: [
      t('Credits never expire', 'Kredilerin süresi dolmaz'),
      t(
        'They belong to your Qutai account, so your balance is there on every device you sign in on',
        'Krediler Qutai hesabınıza aittir; aynı hesapla giriş yaptığınız her cihazda bakiyeniz hazırdır',
      ),
      t('Each answer shows what it cost, in credits', 'Her yanıtın kaç kredi tuttuğunu görürsünüz'),
      t(
        'Requests pass through Qutai’s server, which doesn’t store or log your conversations or pages',
        'İstekler Qutai sunucusundan geçer; sunucu sohbetlerinizi ve sayfalarınızı saklamaz, kayda geçirmez',
      ),
      t(
        'The getting-started chat when you first open Qutai is free',
        'Qutai’ı ilk açtığınızdaki tanışma sohbeti ücretsizdir',
      ),
    ],
  },
];

export type Pack = { credits: number; usd: number; bonus?: number };

/** The packs sold in the app (the owner, 2026-11-26). `bonus` is what a pack gives beyond 100 credits per dollar. */
export const PACKS: Pack[] = [
  { credits: 100, usd: 1 },
  { credits: 550, usd: 5, bonus: 50 },
  { credits: 1200, usd: 10, bonus: 200 },
];

export const PACK_TEXT = {
  title: t('Credit packs', 'Kredi paketleri'),
  lede: t(
    'Bought once, in the app, through Google Play or the App Store. No subscription.',
    'Uygulamanın içinden, Google Play ya da App Store üzerinden tek seferlik alınır. Abonelik yok.',
  ),
  credits: t('credits', 'kredi'),
  bonus: t('{n} bonus credits', '{n} kredi hediye'),
  note: t(
    'Prices in US dollars. Google Play and the App Store show the price in your own currency, with any taxes, before you pay.',
    'Fiyatlar ABD doları cinsindendir. Google Play ve App Store, ödemeden önce fiyatı kendi para biriminizde ve varsa vergileriyle birlikte gösterir.',
  ),
  where: t(
    'In the app: Settings › Account › Qutai Credits › Buy credits.',
    'Uygulamada: Ayarlar › Hesap › Qutai Kredileri › Kredi satın al.',
  ),
};

export const FAQ_TITLE = t('Good to know', 'Bilmekte fayda var');

export const FAQ: { q: Text; a: Text }[] = [
  {
    q: t('How many credits does a task use?', 'Bir iş kaç kredi harcar?'),
    a: t(
      'It depends on the task. A quick question uses little; long research that reads many pages and searches the web uses more. Each answer shows what it cost, and when your balance runs low the assistant keeps the next step within it.',
      'İşe göre değişir. Kısa bir soru az kredi harcar; çok sayfa okuyan, web’de arama yapan uzun bir araştırma daha fazlasını. Her yanıtın kaç kredi tuttuğu görünür; bakiyeniz azaldığında asistan bir sonraki adımı kalan krediye sığdırır.',
    ),
  },
  {
    q: t('Can I switch between my own key and credits?', 'Kendi anahtarımla kredi arasında geçiş yapabilir miyim?'),
    a: t(
      'Yes, at any time in Settings › Assistant. With your own key, no credits are used.',
      'Evet, istediğiniz zaman Ayarlar › Asistan’dan. Kendi anahtarınızı kullanırken kredi harcanmaz.',
    ),
  },
  {
    q: t('What about refunds?', 'İade nasıl oluyor?'),
    a: t(
      'Refunds follow the store’s own rules and the law. A refunded purchase takes its credits back. Credits have no cash value, can’t be transferred, and are lost if you delete your account.',
      'İadeler mağazanın kendi kurallarına ve yasaya göre yapılır; iade edilen bir satın almanın kredileri hesaptan geri alınır. Kredilerin nakit karşılığı yoktur, başkasına aktarılamaz ve hesabınızı silerseniz kaybolur.',
    ),
  },
  {
    q: t(
      'I build Qutai from the source code. Can I use credits?',
      'Qutai’ı kaynak koddan derliyorum. Kredi kullanabilir miyim?',
    ),
    a: t(
      'Builds from the source code work with your own key. Qutai Credits come with the official builds from Google Play and the App Store.',
      'Kaynak koddan derlediğiniz sürüm kendi anahtarınızla çalışır. Qutai Kredileri, Google Play ve App Store’daki resmî sürümlerde var.',
    ),
  },
];
