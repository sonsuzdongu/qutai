import { accountsEnabled } from '../config/features';
import type { Language } from '../i18n';
import { PRO_DOCUMENTS, PRO_LEGAL_UPDATED } from './proDocuments';

/**
 * Bump when the privacy policy or the terms change in substance: everyone is asked to accept
 * again on the next launch. Pro-mode builds (accounts, Qutai Credits) have their own documents (proDocuments.ts) and
 * version, so a change there never asks users of the open-source build again, and the reverse.
 *
 * 2: what leaves the phone, completed (OpenRouter and the user's own server, memory and custom instructions with every
 * request, the platform's geocoder and speech service, filter-list downloads, details typed into sites) and what the
 * app now enforces about passwords, cards, IBANs and ID numbers (16 Nov 2026).
 * 3: contacts (the assistant finds a person the user names; numbers and addresses never reach the AI), page styles
 *    and the cookie list (19 Nov 2026).
 * 4: the pictures of option cards loaded from sites, the spelling of suffixes on the name in Turkish, the documents
 *    translated into German, Spanish, Brazilian Portuguese, French, Japanese, Korean, Russian and Indonesian (the
 *    English version prevails), and the contacts example using a name of each language (20 Nov 2026).
 */
const OPEN_SOURCE_LEGAL_VERSION = 4;
/**
 * 2: the pro-mode documents describe the account, Qutai Credits and buying credits (16 Nov 2026).
 * 3: backups in the Qutai account (what the server keeps, encrypted with the user's password; 17 Nov 2026).
 * 4: who is responsible and how to reach them, sign-in by email (Mailjet), purchases in the app, the companies that
 *    process data and the server's IP use and logs, how long data is kept, security, and the open-source policy's
 *    items the pro one was missing (location, speech, filter lists, details typed into sites; 18 Nov 2026).
 * 5: contacts (as in the open-source policy's version 3; 19 Nov 2026).
 * 6: as the open-source policy's version 4, and "sign-in tokens" spelled out in the server's logs (20 Nov 2026).
 */
const PRO_LEGAL_VERSION = 6;
export const LEGAL_VERSION = accountsEnabled ? PRO_LEGAL_VERSION : OPEN_SOURCE_LEGAL_VERSION;
export const LEGAL_UPDATED = accountsEnabled ? PRO_LEGAL_UPDATED : '2026-11-20';

export type LegalKind = 'privacy' | 'terms';
export type LegalDocument = { title: string; intro: string; sections: { heading: string; body: string }[] };
/** The languages the documents are written in; both are originals. */
export type LegalLanguage = 'en' | 'tr';
/** The other eight interface languages, translated from English (src/legal/translations/; the English version prevails). */
export type TranslatedLegalLanguage = Exclude<Language, LegalLanguage>;
export type LegalSet = Record<LegalKind, LegalDocument>;
/** One language's translation of both builds' documents: the open-source build's and the pro-mode build's. */
export type LegalTranslation = { openSource: LegalSet; pro: LegalSet };
export type LegalBuild = keyof LegalTranslation;

export const DOCUMENTS: Record<LegalLanguage, LegalSet> = {
  en: {
    privacy: {
      title: 'Privacy Policy',
      intro:
        'Qutai is a web browser with an AI assistant. We built it so your browsing stays on your phone. ' +
        'Qutai has no servers of its own: we do not collect, store or sell your data.',
      sections: [
        {
          heading: 'What stays on your phone',
          body:
            'Your tabs, history, bookmarks, saved pages, downloads, site permissions, the assistant’s memory ' +
            '(including your answers to the optional setup questions and the address form), your custom ' +
            'instructions, the assistant’s action history and your conversations are stored only on this device. API ' +
            'keys are kept in the phone’s encrypted storage. Incognito tabs write nothing to disk; their ' +
            'conversations are not saved.',
        },
        {
          heading: 'What leaves your phone, and to whom',
          body:
            '• Websites you visit receive what any browser sends them, and the details you ask the assistant to ' +
            'type into them (such as your name or address in a form).\n' +
            '• When you use the assistant, each request goes with your own API key to the AI service you set up: ' +
            'directly to Anthropic, OpenAI or Google; to OpenRouter, which passes it on to the provider of the model ' +
            'you picked; or to an OpenAI-compatible server whose address you entered. A request contains your ' +
            'message, the conversation so far, the content the assistant needs (the page text, screenshots when it ' +
            'looks at a page, files and images you attach, the result of a script you approved on a page, and when you ask about cookies their names, sites and ' +
            'settings, never their values), your custom instructions and, while memory is on, your ' +
            'memories (hidden memories, such as ID numbers, only as a label). Your calendar events and your location ' +
            'are sent only when you confirm, each time. If web search is on, the service may run searches for you. ' +
            'That service’s privacy policy and terms apply to this data.\n' +
            '• If search suggestions are on, what you type in the address bar is sent to your search engine ' +
            '(never from incognito tabs).\n' +
            '• If you tap “Use my location” in setup, your approximate position is sent to the phone’s address ' +
            'service (Apple’s on an iPhone; on Android usually Google’s) to find the name of the place. Only the ' +
            'place name is kept.\n' +
            '• If you speak to the assistant and the phone can’t recognise that language on the device itself, the ' +
            'audio goes to the phone’s speech service (Apple’s or Google’s), only after you have agreed once in ' +
            'Qutai and never in incognito conversations. Qutai and the AI service receive only the text.\n' +
            '• When the assistant shows you options as cards, their pictures are loaded from the sites (or the sites’ image servers) that show them, without your cookies, also for options you don’t open; in incognito conversations only when you tap “Show images”.\n' +
            '• While “Block ads and trackers” is on, the filter lists you chose are downloaded from their publishers ' +
            '(such as EasyList and AdGuard) and updated every few days. These requests contain nothing about your ' +
            'browsing.\n' +
            'Nothing else is sent: Qutai has no analytics, tracking or advertising.',
        },
        {
          heading: 'Your contacts',
          body:
            'If you allow it, the assistant can find a person you name (for example “call James”) in your phone’s ' +
            'contacts. Qutai looks up only names you say yourself, on your phone; your address book is never uploaded ' +
            'or listed. The AI service receives only the names that match and the kinds of number or address each ' +
            'has (such as “mobile” or “work email”), never the numbers or addresses themselves: you see those on the ' +
            'button or draft, and you call or send yourself. Numbers and addresses from your contacts are not saved ' +
            'with your conversations, the assistant’s memory or your backups. Contacts are not used in conversations with incognito ' +
            'tabs. You can change the permission in Settings.',
        },
        {
          heading: 'Passwords and payment details',
          body:
            'Qutai doesn’t let the assistant’s memory keep passwords, card numbers, card security codes, card ' +
            'expiry dates, one-time codes or bank account numbers (IBAN). ID and passport numbers can be kept only ' +
            'under identity or travel; they are hidden from the AI service, which sees only a label, and Qutai types ' +
            'the number into a site itself after you confirm. Before the assistant first enters your saved personal ' +
            'details on a site, Qutai asks you (you can change this for each site). You can also require your ' +
            'confirmation before every action, and block the assistant on sites of your choice.',
        },
        {
          heading: 'Your control',
          body:
            'You can view and delete the assistant’s memory, clear history, cookies and other data in Settings, ' +
            'and remove your API keys at any time. Uninstalling Qutai deletes everything it stored.',
        },
        {
          heading: 'Children',
          body: 'Qutai is not directed at children under 13.',
        },
        {
          heading: 'Changes',
          body: 'If this policy changes, Qutai shows the new version and asks you to accept it before you continue.',
        },
      ],
    },
    terms: {
      title: 'Terms of Use',
      intro: 'By using Qutai you agree to these terms. Please read them together with the Privacy Policy.',
      sections: [
        {
          heading: 'Your AI provider and costs',
          body:
            'The assistant works with your own API key from Anthropic, OpenAI, Google or OpenRouter, or with an ' +
            'OpenAI-compatible server you set up. You are responsible for your account with that service, its terms ' +
            'and every cost billed to your key.',
        },
        {
          heading: 'The assistant acts on your behalf',
          body:
            'The assistant can read pages, click, type and fill in forms when you ask it to. AI can make ' +
            'mistakes: check its answers, and review purchases, bookings, messages and other important actions ' +
            'before they are completed. You can require confirmation before every action in Settings.',
        },
        {
          heading: 'Acceptable use',
          body:
            'Do not use Qutai to break the law, to break the terms of websites or AI providers, or to harm ' +
            'others, for example by sending spam or collecting other people’s data.',
        },
        {
          heading: 'Websites and content',
          body: 'Websites and their content belong to their owners. Qutai is not responsible for them.',
        },
        {
          heading: 'No warranty',
          body:
            'Qutai is provided “as is”, without warranties. To the extent the law allows, we are not liable for ' +
            'losses arising from its use, including actions taken by the assistant.',
        },
        {
          heading: 'Changes',
          body: 'If these terms change, Qutai shows the new version and asks you to accept it before you continue.',
        },
      ],
    },
  },
  tr: {
    privacy: {
      title: 'Gizlilik Politikası',
      intro:
        'Qutai, yapay zekâ asistanı olan bir web tarayıcısıdır. Gezinmeniz telefonunuzda kalsın diye tasarlandı. ' +
        'Qutai’ın kendi sunucusu yoktur: verilerinizi toplamayız, saklamayız, satmayız.',
      sections: [
        {
          heading: 'Telefonunuzda kalanlar',
          body:
            'Sekmeleriniz, geçmişiniz, yer imleriniz, kaydedilen sayfalar, indirilenler, site izinleri, ' +
            'asistanın hafızası (kurulumdaki isteğe bağlı soruların ve adres formunun yanıtları dahil), özel ' +
            'talimatlarınız, asistanın işlem geçmişi ve sohbetleriniz yalnızca bu cihazda saklanır. API anahtarları ' +
            'telefonun şifreli deposunda tutulur. Gizli sekmeler diske hiçbir şey yazmaz; sohbetleri kaydedilmez.',
        },
        {
          heading: 'Telefonunuzdan çıkanlar ve kime gittiği',
          body:
            '• Ziyaret ettiğiniz siteler, her tarayıcının gönderdiği bilgileri ve asistandan o siteye yazmasını ' +
            'istediğiniz bilgileri (örneğin bir formdaki adınızı veya adresinizi) alır.\n' +
            '• Asistanı kullandığınızda her istek, kendi API anahtarınızla kurduğunuz yapay zekâ hizmetine gider: ' +
            'doğrudan Anthropic, OpenAI veya Google’a; isteği seçtiğiniz modelin sağlayıcısına ileten OpenRouter’a ' +
            'ya da adresini girdiğiniz OpenAI uyumlu bir sunucuya. İstekte mesajınız, sohbetin önceki kısmı, ' +
            'asistanın ihtiyaç duyduğu içerik (sayfa metni, sayfaya baktığında ekran görüntüleri, eklediğiniz dosya ' +
            've görseller, bir sayfada onayladığınız bir betiğin sonucu; çerezleri sorduğunuzda adları, siteleri ve ayarları, ama hiçbir zaman değerleri), özel ' +
            'talimatlarınız ve hafıza açıkken hafızanız (kimlik numarası gibi gizli bilgiler ' +
            'yalnızca etiketleriyle) bulunur. Takvim etkinlikleriniz ve konumunuz yalnızca her seferinde ' +
            'onayladığınızda gönderilir. Web araması açıksa hizmet sizin için arama yapabilir. Bu veriler için o ' +
            'hizmetin gizlilik politikası ve koşulları geçerlidir.\n' +
            '• Arama önerileri açıksa adres çubuğuna yazdıklarınız arama motorunuza gönderilir (gizli sekmelerden ' +
            'asla).\n' +
            '• Kurulumda “Konumumu kullan”a dokunursanız, yer adını bulmak için yaklaşık konumunuz telefonun adres ' +
            'hizmetine (iPhone’da Apple’ınkine, Android’de genellikle Google’ınkine) gönderilir. Yalnızca yer adı ' +
            'saklanır.\n' +
            '• Asistana sesle yazdığınızda telefon o dili cihazın kendisinde tanıyamıyorsa ses, telefonun konuşma ' +
            'hizmetine (Apple’ın ya da Google’ın) gider; bu yalnızca Qutai’da bir kez izin verdikten sonra olur, ' +
            'gizli sohbetlerde asla. Qutai ve yapay zekâ hizmeti yalnızca metni alır.\n' +
            '• Asistan seçenekleri kartlarla gösterdiğinde kartların resimleri, onları gösteren sitelerden (ya da sitelerin resim sunucularından) çerezleriniz gönderilmeden yüklenir; açmadığınız seçenekler için de. Gizli sohbetlerde yalnızca “Resimleri göster”e dokunduğunuzda.\n' +
            '• “Reklam ve izleyicileri engelle” açıkken seçtiğiniz filtre listeleri yayıncılarından (örneğin EasyList ' +
            've AdGuard) indirilir ve birkaç günde bir güncellenir. Bu isteklerde gezinmenizle ilgili hiçbir şey ' +
            'yoktur.\n' +
            'Başka hiçbir şey gönderilmez: Qutai’da analitik, izleme veya reklam yoktur.',
        },
        {
          heading: 'Kişileriniz',
          body:
            'İzin verirseniz asistan, adını söylediğiniz bir kişiyi (örneğin “Ahmet’i ara”) telefonunuzun ' +
            'kişilerinde bulabilir. Qutai yalnızca sizin söylediğiniz adları, telefonunuzda arar; kişi listeniz hiçbir ' +
            'zaman yüklenmez ya da listelenmez. Yapay zekâ hizmeti yalnızca eşleşen adları ve her birinde hangi tür ' +
            'numara ya da adres bulunduğunu (“cep” ya da “iş e-postası” gibi) alır, numaraların ve adreslerin ' +
            'kendisini asla almaz: bunları düğmede ya da taslakta siz görürsünüz, aramayı ya da gönderimi siz ' +
            'yaparsınız. Kişilerinizden gelen numaralar ve adresler sohbetlerinizle, asistanın hafızasıyla ya da ' +
            'yedeklerinizle birlikte saklanmaz. Gizli sekmelerin yer aldığı sohbetlerde kişiler kullanılmaz. İzni Ayarlar’dan ' +
            'değiştirebilirsiniz.',
        },
        {
          heading: 'Şifreler ve ödeme bilgileri',
          body:
            'Qutai, asistanın hafızasına şifre, kart numarası, kart güvenlik kodu, kartın son kullanma tarihi, tek ' +
            'kullanımlık kod ve banka hesap numarası (IBAN) kaydedilmesine izin vermez. Kimlik ve pasaport ' +
            'numaraları yalnızca kimlik veya seyahat bilgisi olarak kaydedilebilir; yapay zekâ hizmetinden gizlenir, ' +
            'hizmet yalnızca bir etiket görür ve numarayı siz onayladıktan sonra siteye Qutai kendisi yazar. Asistan ' +
            'kayıtlı kişisel bilgilerinizi bir siteye ilk kez girmeden önce Qutai size sorar (bunu her site için ' +
            'değiştirebilirsiniz). Ayrıca her işlemden önce onayınızın istenmesini seçebilir, seçtiğiniz sitelerde ' +
            'asistanı engelleyebilirsiniz.',
        },
        {
          heading: 'Kontrol sizde',
          body:
            'Asistanın hafızasını Ayarlar’dan görüp silebilir; geçmişi, çerezleri ve diğer verileri temizleyebilir, ' +
            'API anahtarlarınızı istediğiniz an kaldırabilirsiniz. Qutai’ı kaldırmak sakladığı her şeyi siler.',
        },
        {
          heading: 'Çocuklar',
          body: 'Qutai 13 yaşından küçük çocuklara yönelik değildir.',
        },
        {
          heading: 'Değişiklikler',
          body: 'Bu politika değişirse Qutai yeni sürümü gösterir ve devam etmeden önce kabul etmenizi ister.',
        },
      ],
    },
    terms: {
      title: 'Kullanım Koşulları',
      intro: 'Qutai’ı kullanarak bu koşulları kabul etmiş olursunuz. Lütfen Gizlilik Politikası ile birlikte okuyun.',
      sections: [
        {
          heading: 'Yapay zekâ sağlayıcınız ve maliyetler',
          body:
            'Asistan, Anthropic, OpenAI, Google veya OpenRouter’dan aldığınız kendi API anahtarınızla ya da ' +
            'kurduğunuz OpenAI uyumlu bir sunucuyla çalışır. O hizmetteki hesabınızdan, koşullarından ve ' +
            'anahtarınıza yansıyan her ücretten siz sorumlusunuz.',
        },
        {
          heading: 'Asistan sizin adınıza işlem yapar',
          body:
            'İstediğinizde asistan sayfaları okuyabilir, tıklayabilir, yazabilir ve form doldurabilir. Yapay zekâ ' +
            'hata yapabilir: yanıtlarını kontrol edin; satın alma, rezervasyon, mesaj ve diğer önemli işlemleri ' +
            'tamamlanmadan önce gözden geçirin. Ayarlar’dan her işlemden önce onay istenmesini seçebilirsiniz.',
        },
        {
          heading: 'Kabul edilebilir kullanım',
          body:
            'Qutai’ı yasaları, sitelerin veya yapay zekâ sağlayıcılarının koşullarını çiğnemek ya da başkalarına ' +
            'zarar vermek için (örneğin istenmeyen ileti göndermek, başkalarının verilerini toplamak) kullanmayın.',
        },
        {
          heading: 'Siteler ve içerik',
          body: 'Siteler ve içerikleri sahiplerine aittir. Qutai bunlardan sorumlu değildir.',
        },
        {
          heading: 'Garanti yoktur',
          body:
            'Qutai “olduğu gibi”, garanti olmaksızın sunulur. Yasaların izin verdiği ölçüde, asistanın yaptığı ' +
            'işlemler dahil, kullanımından doğan kayıplardan sorumlu değiliz.',
        },
        {
          heading: 'Değişiklikler',
          body: 'Bu koşullar değişirse Qutai yeni sürümü gösterir ve devam etmeden önce kabul etmenizi ister.',
        },
      ],
    },
  },
};

/**
 * A translation is loaded the first time its language is shown: Metro keeps each `require` as a separate module that is
 * evaluated only when called, so the app does not hold eight languages of legal text it never shows.
 */
const translations: Partial<Record<TranslatedLegalLanguage, LegalTranslation>> = {};
/* eslint-disable @typescript-eslint/no-require-imports */
const loaders: Record<TranslatedLegalLanguage, () => LegalTranslation> = {
  de: () => require('./translations/de').de,
  es: () => require('./translations/es').es,
  'pt-BR': () => require('./translations/pt-BR').ptBR,
  fr: () => require('./translations/fr').fr,
  ja: () => require('./translations/ja').ja,
  ko: () => require('./translations/ko').ko,
  ru: () => require('./translations/ru').ru,
  id: () => require('./translations/id').id,
};
/* eslint-enable @typescript-eslint/no-require-imports */

/** For tests run outside the app (no Metro `require`): makes a language's translation available. */
export function provideLegalTranslation(language: TranslatedLegalLanguage, translation: LegalTranslation) {
  translations[language] = translation;
}

/** A build's document in a language: English and Turkish as written, the other eight from their translation. */
export function legalDocumentFor(build: LegalBuild, kind: LegalKind, language: Language): LegalDocument {
  if (language === 'en' || language === 'tr') return (build === 'pro' ? PRO_DOCUMENTS : DOCUMENTS)[language][kind];
  let translation = translations[language];
  if (!translation) {
    try {
      translation = loaders[language]();
    } catch {
      // Only outside Metro (Node tests without provideLegalTranslation); the app always has the module.
      return (build === 'pro' ? PRO_DOCUMENTS : DOCUMENTS).en[kind];
    }
    translations[language] = translation;
  }
  return translation[build][kind];
}

/** The privacy policy or terms of this build, in the interface language (all ten have them). */
export function legalDocument(kind: LegalKind, language: Language): LegalDocument {
  return legalDocumentFor(accountsEnabled ? 'pro' : 'openSource', kind, language);
}
