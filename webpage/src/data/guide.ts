// The question pages written for search engines and AI answers (WEB-17): "What is an agentic browser?"
// (/<lang>/agentic-browser/) and the copy around the Qutai vs <competitor> pages (/<lang>/vs/<id>/). Facts about Qutai come
// from the design record; facts about other browsers only from src/data/comparison.ts (their sources and dates).
import type { Text } from './features';

const t = (en: string, tr: string): Text => ({ en, tr });

export const GUIDE = {
  metaTitle: t('What is an agentic browser? AI browsers on Android and iPhone · Qutai', 'Agentic tarayıcı nedir? Android ve iPhone’da yapay zekâlı tarayıcılar · Qutai'),
  metaDescription: t(
    'An agentic browser is a web browser whose AI agent acts on pages for you: it fills in forms, shops, books and researches. What it can do on a phone, how to judge if it is safe, and which mobile browsers can do it.',
    'Agentic tarayıcı, yapay zekâ ajanı sayfalarda sizin yerinize iş yapan bir tarayıcıdır: form doldurur, alışveriş yapar, rezervasyon yapar, araştırır. Telefonda neler yapabildiği, güvenli olup olmadığını nasıl anlayacağınız ve hangi mobil tarayıcıların bunu yapabildiği.',
  ),
  kicker: t('Guide', 'Rehber'),
  title: t('What is an agentic browser?', 'Agentic tarayıcı nedir?'),
  lede: t(
    'Short answers to the questions people ask about AI browsers and agentic browsers on Android and iPhone, from the team that makes Qutai, an open-source agentic AI browser.',
    'Android ve iPhone’da yapay zekâlı tarayıcılar ve agentic tarayıcılar hakkında en çok sorulanlara kısa cevaplar. Açık kaynak, agentic bir yapay zekâ tarayıcısı olan Qutai’ı yapan ekipten.',
  ),
  whichQ: t('Which agentic browsers are there on Android and iPhone?', 'Android ve iPhone’da hangi agentic tarayıcılar var?'),
  /** The answer that lists the mobile browsers is built from the comparison table; this is its opening. */
  whichIntro: t(
    'Few mobile browsers let their assistant act on pages. In our comparison of mobile browsers with an AI assistant (checked {date}), “acts on web pages for you” stands like this:',
    'Asistanının sayfalarda iş yapmasına izin veren mobil tarayıcı az. Yapay zekâ asistanlı mobil tarayıcıları karşılaştırdığımız tabloda ({date} itibarıyla) “sayfalarda sizin için işlem yapar” satırı şöyle:',
  ),
  whichOutro: t('Each comparison page shows every row with its source.', 'Her karşılaştırma sayfasında tüm satırlar kaynaklarıyla birlikte var.'),
  cta: t('Try Qutai', 'Qutai’ı deneyin'),
};

export const GUIDE_QA: { id: string; q: Text; a: Text[] }[] = [
  {
    id: 'what',
    q: t('What is an agentic browser?', 'Agentic tarayıcı nedir?'),
    a: [
      t(
        'An agentic browser is a web browser with an AI agent built in. The agent doesn’t only answer questions about a page; it acts on it. It taps, types, fills in forms, opens and moves between tabs and finishes a task of several steps for you, showing each step as it goes.',
        'Agentic tarayıcı, içinde bir yapay zekâ ajanı olan web tarayıcısıdır. Bu ajan bir sayfa hakkındaki soruları cevaplamakla kalmaz, sayfada iş de yapar: dokunur, yazar, form doldurur, sekmeler açıp aralarında geçer ve birkaç adımlık bir işi baştan sona sizin için bitirir. Her adımı yaparken de size gösterir.',
      ),
      t(
        '“AI browser” is the wider term. Many AI browsers can summarise a page or chat about it, but can’t act on it. An agentic browser can.',
        '“Yapay zekâlı tarayıcı” daha geniş bir terim. Birçok yapay zekâlı tarayıcı sayfayı özetleyebilir ya da sayfa hakkında sohbet edebilir ama sayfada işlem yapamaz. Agentic tarayıcı yapabilir.',
      ),
    ],
  },
  {
    id: 'phone',
    q: t('What can an agentic browser do on a phone?', 'Agentic tarayıcı telefonda neler yapabilir?'),
    a: [
      t(
        'The tasks that take the most tapping on a small screen. In Qutai, for example, you can ask it to fill in a form with the details it knows about you, find a product in your size and put it in the cart with your delivery details, book a table and add it to your calendar, or research a question across many pages and write a report with its sources.',
        'Küçük ekranda en çok uğraştıran işleri. Örneğin Qutai’dan, sizin hakkınızda bildikleriyle bir formu doldurmasını, bedeninize uygun ürünü bulup teslimat bilgilerinizle sepete eklemesini, masa ayırtıp takviminize eklemesini ya da bir soruyu birçok sayfada araştırıp kaynaklarıyla birlikte rapor yazmasını isteyebilirsiniz.',
      ),
    ],
  },
  {
    id: 'chatbot',
    q: t('How is it different from an AI chatbot?', 'Yapay zekâ sohbet botundan farkı ne?'),
    a: [
      t(
        'A chatbot only sees what you paste into it, and you do the clicking. An agentic browser sees the page you are on and your other tabs, remembers what you have told it, and does the clicking itself, in the same browser where you are signed in.',
        'Sohbet botu yalnızca ona yapıştırdığınızı görür; tıklamaları siz yaparsınız. Agentic tarayıcı ise açık olan sayfayı ve diğer sekmelerinizi görür, ona anlattıklarınızı hatırlar ve tıklamaları kendisi yapar; üstelik oturum açtığınız tarayıcının içinde.',
      ),
    ],
  },
  {
    id: 'safe',
    q: t('Is it safe to let an AI act in my browser?', 'Tarayıcımda yapay zekânın işlem yapmasına izin vermek güvenli mi?'),
    a: [
      t(
        'It depends on how much control you keep. Look for a browser that shows every step and lets you stop it, asks before payments and other important actions, never types passwords, card numbers or one-time codes, lets you set permissions per site, and shows you what was sent to the AI. Web pages can also hide instructions meant for AI agents, which is why the confirmations should come from the browser itself, not from the page.',
        'Ne kadar kontrolün sizde kaldığına bağlı. Şunlara bakın: her adımı gösteriyor ve durdurmanıza izin veriyor mu, ödeme gibi önemli işlemlerden önce soruyor mu, şifre, kart numarası ve tek kullanımlık kodları yazmaktan kaçınıyor mu, site bazında izin verebiliyor musunuz, yapay zekâya ne gönderildiğini görebiliyor musunuz? Web sayfaları yapay zekâ ajanlarına yönelik gizli talimatlar da barındırabilir; bu yüzden onay pencerelerinin sayfadan değil, tarayıcının kendisinden gelmesi gerekir.',
      ),
      t(
        'Qutai does all of this: every approval is Qutai’s own dialog, which a page can’t draw, and what a page says is treated as content, not as instructions.',
        'Qutai bunların hepsini yapar: her onay, bir sayfanın taklit edemeyeceği Qutai’ın kendi penceresidir; sayfada yazanları talimat değil, içerik olarak ele alır.',
      ),
    ],
  },
  {
    id: 'open-source',
    q: t('Is there an open-source agentic browser for Android and iPhone?', 'Android ve iPhone için açık kaynak bir agentic tarayıcı var mı?'),
    a: [
      t(
        'Yes. Qutai is open source under the Apache-2.0 licence, and its code is on GitHub. It is on Google Play for Android and in beta testing (TestFlight) on iPhone, iPad and Macs with Apple silicon.',
        'Evet. Qutai, Apache-2.0 lisansıyla açık kaynaktır; kodu GitHub’da. Android için Google Play’de; iPhone, iPad ve Apple silicon işlemcili Mac’te ise beta testinde (TestFlight).',
      ),
    ],
  },
  {
    id: 'own-model',
    q: t('Can I use my own AI model or key?', 'Kendi yapay zekâ modelimi ya da anahtarımı kullanabilir miyim?'),
    a: [
      t(
        'In Qutai, yes: Anthropic, OpenAI, Google Gemini, OpenRouter, or your own OpenAI-compatible server such as Ollama, LM Studio or vLLM. With your own key, requests go from your phone straight to the provider. If you would rather not deal with keys, you can buy Qutai Credits in the app instead.',
        'Qutai’da evet: Anthropic, OpenAI, Google Gemini, OpenRouter ya da Ollama, LM Studio, vLLM gibi kendi OpenAI uyumlu sunucunuz. Kendi anahtarınızı kullandığınızda istekler telefonunuzdan doğrudan sağlayıcıya gider. Anahtarla uğraşmak istemezseniz uygulamadan Qutai Kredisi alabilirsiniz.',
      ),
    ],
  },
  {
    id: 'cost',
    q: t('How much does an agentic browser cost?', 'Agentic tarayıcı ne kadar tutar?'),
    a: [
      t(
        'Qutai itself is free. With your own AI key you pay your provider only for what you use; with Qutai Credits, packs start at 100 credits for $1. Details are on the pricing page.',
        'Qutai’ın kendisi ücretsiz. Kendi anahtarınızla yalnızca kullandığınız kadarını sağlayıcınıza ödersiniz; Qutai Kredileri ise 100 kredi 1 dolardan başlayan paketlerle gelir. Ayrıntılar fiyatlar sayfasında.',
      ),
    ],
  },
];

/** The copy around each Qutai vs <competitor> page; `{name}` is the competitor, `{date}` the table's check date. */
export const VS = {
  metaTitle: t('Qutai vs {name}: AI browsers on mobile compared', 'Qutai ve {name}: mobilde yapay zekâlı tarayıcı karşılaştırması'),
  metaDescription: t(
    'Qutai, an open-source agentic AI browser for Android and iPhone, side by side with {name} on the mobile app: acting on pages, research, memory, your own AI key, privacy, price. Every {name} cell has its source.',
    'Android ve iPhone için açık kaynak, agentic bir yapay zekâ tarayıcısı olan Qutai ile {name} mobil uygulamada yan yana: sayfalarda işlem, araştırma, hafıza, kendi anahtarınız, gizlilik, fiyat. {name} için her hücrenin kaynağı var.',
  ),
  kicker: t('Comparison', 'Karşılaştırma'),
  title: t('Qutai vs {name}', 'Qutai ve {name}'),
  lede: t(
    'How Qutai compares with {name} ({platforms}) on the phone. {name}’s cells come from its own pages, with a link to each, or from our own test where the note says so; checked {date}. Qutai’s come from its source code and design record.',
    'Qutai’ın telefonda {name} ({platforms}) ile karşılaştırması. {name} hücreleri kendi sayfalarından, her birinin bağlantısıyla, ya da notta belirtildiyse bizim denememizden geliyor; {date} itibarıyla. Qutai’ınkiler kaynak kodundan ve tasarım kaydından.',
  ),
  differ: t('Where they differ', 'Farklı oldukları yerler'),
  alike: t('Where they are alike', 'Benzer oldukları yerler'),
  others: t('Other comparisons', 'Diğer karşılaştırmalar'),
  full: t('See every browser in one table', 'Tüm tarayıcıları tek tabloda görün'),
  guide: t('What is an agentic browser?', 'Agentic tarayıcı nedir?'),
  correction: t('Something out of date? Report a correction', 'Güncel olmayan bir şey mi var? Düzeltme bildirin'),
  sideBySide: t('Side by side:', 'Yan yana:'),
};
