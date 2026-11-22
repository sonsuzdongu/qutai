import { Platform } from 'react-native';
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
 *    English version prevails), the contacts example using a name of each language, and the texts saying what the app
 *    does: calendar events and location are asked each time unless "Don't ask again" was chosen (undone in Settings ›
 *    Assistant › Allowed without asking; never used in incognito conversations), incognito tabs keep files downloaded
 *    from them, and uninstalling leaves files saved outside Qutai (20 Nov 2026).
 * 5: protective clauses in the terms (websites, the assistant's actions and the user's responsibility, AI answers,
 *    blocking, page styles and scripts, apps, downloads, the own key, acceptable use, warranty and liability, consumer
 *    rights) and a privacy section on what blocking, styles, scripts and apps do with data (21 Nov 2026).
 */
const OPEN_SOURCE_LEGAL_VERSION = 5;
/**
 * 2: the pro-mode documents describe the account, Qutai Credits and buying credits (16 Nov 2026).
 * 3: backups in the Qutai account (what the server keeps, encrypted with the user's password; 17 Nov 2026).
 * 4: who is responsible and how to reach them, sign-in by email (Mailjet), purchases in the app, the companies that
 *    process data and the server's IP use and logs, how long data is kept, security, and the open-source policy's
 *    items the pro one was missing (location, speech, filter lists, details typed into sites; 18 Nov 2026).
 * 5: contacts (as in the open-source policy's version 3; 19 Nov 2026).
 * 6: as the open-source policy's version 4, and "sign-in tokens" spelled out in the server's logs (20 Nov 2026).
 * 7: as the open-source policy's version 5, the reports section (what a report sends, kept 180 days), and in the
 *    terms that Qutai Credits do not expire (21 Nov 2026).
 * 8: the consented anonymous usage statistics and the device verification and abuse checks (what goes to Apple and
 *    Google, what the server keeps), and the intro no longer says there are no analytics (22 Nov 2026).
 */
const PRO_LEGAL_VERSION = 8;
export const LEGAL_VERSION = accountsEnabled ? PRO_LEGAL_VERSION : OPEN_SOURCE_LEGAL_VERSION;
export const LEGAL_UPDATED = accountsEnabled ? PRO_LEGAL_UPDATED : '2026-11-21';

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
            'keys are kept in the phone’s encrypted storage. Incognito tabs save nothing on the phone except files you download from them; their ' +
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
            'memories (hidden memories, such as ID numbers, only as a label). Your calendar events and your location are sent only after you confirm, each time, unless ' +
            'you chose “Don’t ask again” for them (you can undo this in Settings › Assistant › ' +
            '“Allowed without asking”); in conversations with incognito tabs they are never used. If web search is on, the service may run searches for you. ' +
            'That service’s privacy policy and terms apply to this data.\n' +
            '• If search suggestions are on, what you type in the address bar is sent to your search engine ' +
            '(never from incognito tabs).\n' +
            '• If you tap “Use my location” in setup, your approximate position is sent to the phone’s address ' +
            'service {{ios:(Apple’s)|android:(usually Google’s)|web:(Apple’s on an iPhone; on Android usually Google’s)}} to find the name of the place. Only the ' +
            'place name is kept.\n' +
            '• If you speak to the assistant and the phone can’t recognise that language on the device itself, the ' +
            'audio goes to the phone’s speech service {{ios:(Apple’s)|android:(usually Google’s)|web:(Apple’s or Google’s)}}, only after you have agreed once in ' +
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
          heading: 'Blocking, page styles, scripts and apps',
          body:
            'Blocking ads, trackers and video ads happens on your phone: the filter lists are downloaded to the phone ' +
            '(see above) and each page’s requests are checked against them there, so nothing about the pages you ' +
            'visit goes to the lists’ publishers. “Hide cookie banners” only hides the banners; it never accepts or ' +
            'refuses cookies for you. Your own rules, kept styles and kept scripts are stored only on the phone and, ' +
            'if you make one, in your backup file, encrypted with your password. When the assistant writes a style or ' +
            'a script, the AI service receives your request and the page content it needs, as with any question, and ' +
            'the result of a script you approved goes to it too; Qutai refuses scripts that touch cookies, and a ' +
            'script’s result is never kept in the assistant’s memory, in backups or in the action history. Apps ' +
            'inside Qutai are stored only on the phone and, if you include them, in your backup file. When you ask ' +
            'Qutai to make or fix an app, its code and its error messages go to the AI service; what you save in an ' +
            'app never does. Apps cannot reach the internet or see websites or their cookies.',
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
            'and remove your API keys at any time. Uninstalling Qutai deletes everything it stored, except files you saved outside it, such as {{ios:files you saved to the Files app|android:downloads in Android’s Downloads folder|web:downloads in Android’s Downloads folder or in the Files app on an iPhone}} and pictures saved to your photos.',
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
            'OpenAI-compatible server you set up. Using it is an agreement between you and that service: its terms, ' +
            'privacy policy and prices apply, and you are responsible for your account there and every cost billed to ' +
            'your key. Qutai is not a party to that agreement and cannot refund those costs.',
        },
        {
          heading: 'Qutai is a browser',
          body:
            'Qutai shows websites that other people run. We do not control, check or endorse websites, their content, ' +
            'or the products and services they offer, and we are not responsible for them. Websites and their content ' +
            'belong to their owners. Each website’s own terms and the law apply when you use it, and you are ' +
            'responsible for following them. Links, search results and suggestions, including the assistant’s, are ' +
            'not recommendations from us.',
        },
        {
          heading: 'The assistant acts on your behalf',
          body:
            'The assistant can read pages, click, type, fill in forms and prepare posts, messages and orders when you ' +
            'ask it to. Before it posts or submits text on a site, Qutai asks for your approval. Completing a payment ' +
            'is off until you turn on “Let the assistant complete payments” in Settings › Assistant; even then, each ' +
            'payment needs your approval in Qutai’s own dialog, which shows the total. AI can make mistakes: check ' +
            'what you are approving, and review purchases, bookings, payments, posts, messages, deletions, account ' +
            'changes and other important actions before they are completed. You are responsible for the actions you ' +
            'ask for or approve, as if you had taken them yourself. Your purchases and other dealings with websites, ' +
            'sellers and other people are between you and them: Qutai is not a party to them and never handles your ' +
            'payments to them. You can require confirmation before every action in Settings, and block the assistant ' +
            'on sites of your choice.',
        },
        {
          heading: 'AI answers',
          body:
            'Answers, summaries, translations and anything else the AI writes can be wrong, incomplete or out of ' +
            'date. They are not professional advice, for example medical, legal, financial or tax advice: for such ' +
            'matters, ask a qualified professional. Check important information before you rely on it.',
        },
        {
          heading: 'Blocking ads and trackers',
          body:
            'Blocking ads and trackers, hiding cookie banners and blocking video ads are features you choose: you can ' +
            'turn each one off in Settings › Privacy and security, and turn blocking off for one site in its sheet ' +
            '(“Block video ads” is off until you turn it on). Blocking works only in the pages you open on your ' +
            'phone; it does not change websites themselves. The filter lists are made by third parties under their ' +
            'own licences (for example EasyList under GPLv3 or CC BY-SA 3.0, and AdGuard under GPLv3); your phone ' +
            'downloads them from their publishers, and Settings shows each list’s home page and licence. We do not ' +
            'guarantee what is or is not blocked: lists can block too much or too little, and a site may break, show ' +
            'less, or ask you to turn blocking off. Whether to use blocking on a site is your decision, and that ' +
            'site’s terms apply to your visit.',
        },
        {
          heading: 'Page styles and scripts',
          body:
            'You can ask the assistant to change how a page looks (a style) or to run a script on a page, keep them ' +
            'for a site, and write, edit, import and export them yourself. Scripts are off until you turn them on in ' +
            'Settings › Assistant. Qutai shows each style and script the assistant writes and runs it only after you ' +
            'approve it, and imported scripts stay off until you approve them. Styles and scripts run only in pages ' +
            'you open, on your phone. Qutai refuses some risky code, but it does not review code that you write, edit ' +
            'or import, and it cannot guarantee what any code does: a script runs with your sign-in on that site, can ' +
            'change or break the page, and can affect your account there. Approve only what you understand and trust. ' +
            'You are responsible for the styles and scripts you approve, keep, import or share.',
        },
        {
          heading: 'Apps inside Qutai',
          body:
            'Apps inside Qutai are written by the AI at your request. They run sealed off from the internet and from ' +
            'websites, but they are not tested or reviewed by us and come with no warranty: an app can have mistakes ' +
            'or lose the data saved in it, so export or back up anything important. Apps you import from a file can ' +
            'come from anyone and are not reviewed by us; Qutai shows you what an imported app is and what it may use ' +
            'before you turn it on. You are responsible for the apps you turn on and the apps you share with others.',
        },
        {
          heading: 'Downloads and installing files',
          body:
            'You decide what to download, open and install. Qutai warns you before it downloads files that can ' +
            'install or run code, but it does not scan files for viruses or other harm. {{ios:Qutai never installs anything itself. Downloaded files can harm|android:Opening a downloaded app (an APK file) hands it to the system installer; Qutai never installs anything itself. Files and apps from outside Google Play can harm|web:On Android, opening a downloaded app (an APK file) hands it to the system installer; Qutai never installs anything itself. Files and apps from outside the App Store and Google Play can harm}} your phone or your data; downloading, ' +
            'opening and installing them is your responsibility, as is having the right to do so.',
        },
        {
          heading: 'Acceptable use',
          body:
            'Do not use Qutai, the assistant, styles, scripts or apps to:\n' +
            '• break the law or other people’s rights, such as their privacy, copyright or trademarks;\n' +
            '• break the terms of websites or AI providers;\n' +
            '• get around passwords, access controls, paywalls, copy protection (DRM) or other technical protection;\n' +
            '• collect, track or publish other people’s personal data unlawfully;\n' +
            '• send spam, create fake accounts or reviews, post or act in bulk automatically, or overload websites;\n' +
            '• deceive or defraud anyone, or spread malware.',
        },
        {
          heading: 'No warranty and limits of liability',
          body:
            'Qutai is provided “as is” and “as available”. We work to make it useful and safe, but we do not promise ' +
            'that it will always work, be free of errors, block what you expect or work with every website, and we ' +
            'give no warranties beyond those the law requires. To the extent the law allows, we are not liable for ' +
            'losses caused by websites and their content, by other people, by AI providers’ services, by filter ' +
            'lists, by styles, scripts and apps you approve or import, or by actions you asked for or approved, nor ' +
            'for indirect losses such as lost profits. Nothing in these terms limits liability for intent or gross ' +
            'negligence, for death or personal injury, or any other liability that the law does not allow to be ' +
            'limited or excluded.',
        },
        {
          heading: 'Your rights as a consumer',
          body:
            'If you use Qutai as a consumer, you keep every right that the law where you live gives consumers and ' +
            'that cannot be waived by contract, such as your rights under Turkish consumer law (Law No. 6502 on ' +
            'Consumer Protection) and the consumer law of the European Union and the European Economic Area. Nothing ' +
            'in these terms limits or excludes those rights; where a term conflicts with them, those rights apply.',
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
            'telefonun şifreli deposunda tutulur. Gizli sekmeler, onlardan indirdiğiniz dosyalar dışında telefona hiçbir şey kaydetmez; ' +
            'sohbetleri kaydedilmez.',
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
            'yalnızca etiketleriyle) bulunur. Takvim etkinlikleriniz ve konumunuz, bunlar için “Bir daha sorma”yı seçmediyseniz ' +
            'yalnızca her seferinde onayladığınızda gönderilir (bunu Ayarlar › Asistan › “Sormadan ' +
            'izin verilenler”den geri alabilirsiniz); gizli sekmelerin yer aldığı sohbetlerde hiç ' +
            'kullanılmaz. Web araması açıksa hizmet sizin için arama yapabilir. Bu veriler için o ' +
            'hizmetin gizlilik politikası ve koşulları geçerlidir.\n' +
            '• Arama önerileri açıksa adres çubuğuna yazdıklarınız arama motorunuza gönderilir (gizli sekmelerden ' +
            'asla).\n' +
            '• Kurulumda “Konumumu kullan”a dokunursanız, yer adını bulmak için yaklaşık konumunuz telefonun adres ' +
            'hizmetine {{ios:(Apple’ınkine)|android:(genellikle Google’ınkine)|web:(iPhone’da Apple’ınkine, Android’de genellikle Google’ınkine)}} gönderilir. Yalnızca yer adı ' +
            'saklanır.\n' +
            '• Asistana sesle yazdığınızda telefon o dili cihazın kendisinde tanıyamıyorsa ses, telefonun konuşma ' +
            'hizmetine {{ios:(Apple’ın)|android:(genellikle Google’ın)|web:(Apple’ın ya da Google’ın)}} gider; bu yalnızca Qutai’da bir kez izin verdikten sonra olur, ' +
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
          heading: 'Engelleme, sayfa stilleri, betikler ve uygulamalar',
          body:
            'Reklamların, izleyicilerin ve video reklamlarının engellenmesi telefonunuzda olur: filtre listeleri ' +
            'telefona indirilir (yukarıda) ve her sayfanın istekleri orada bu listelerle karşılaştırılır; böylece ' +
            'ziyaret ettiğiniz sayfalarla ilgili hiçbir şey listelerin yayıncılarına gitmez. “Çerez bildirimlerini ' +
            'gizle” yalnızca bildirimleri gizler; sizin yerinize çerezleri hiçbir zaman kabul etmez ya da reddetmez. ' +
            'Kendi kurallarınız, kalıcı stilleriniz ve kalıcı betikleriniz yalnızca telefonda ve yedek alırsanız, ' +
            'parolanızla şifrelenmiş olarak yedek dosyanızda saklanır. Asistan bir stil ya da betik yazarken yapay ' +
            'zekâ hizmeti, her soruda olduğu gibi isteğinizi ve gereken sayfa içeriğini alır; onayladığınız bir ' +
            'betiğin sonucu da ona gider. Qutai çerezlere dokunan betikleri reddeder ve bir betiğin sonucu asistanın ' +
            'hafızasında, yedeklerde ya da işlem geçmişinde hiçbir zaman tutulmaz. Qutai içindeki uygulamalar ' +
            'yalnızca telefonda ve dahil ederseniz yedek dosyanızda saklanır. Qutai’dan bir uygulama yapmasını ya da ' +
            'düzeltmesini istediğinizde uygulamanın kodu ve hata iletileri yapay zekâ hizmetine gider; bir uygulamaya ' +
            'kaydettikleriniz hiçbir zaman gitmez. Uygulamalar internete erişemez, siteleri ve sitelerin çerezlerini ' +
            'göremez.',
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
            'API anahtarlarınızı istediğiniz an kaldırabilirsiniz. Qutai’ı kaldırmak sakladığı her şeyi siler; Qutai dışına kaydettiğiniz dosyalar, örneğin {{ios:Dosyalar uygulamasına kaydettiğiniz dosyalar|android:Android’in İndirilenler klasöründeki indirmeler|web:Android’in İndirilenler klasöründeki ya da iPhone’da Dosyalar uygulamasındaki indirmeler}} ve fotoğraflarınıza kaydettiğiniz ' +
            'resimler kalır.',
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
            'Asistan; Anthropic, OpenAI, Google ya da OpenRouter’dan aldığınız kendi API anahtarınızla veya ' +
            'kurduğunuz OpenAI uyumlu bir sunucuyla çalışır. Bunu kullanmak sizinle o hizmet arasında bir ' +
            'sözleşmedir: hizmetin koşulları, gizlilik politikası ve fiyatları geçerlidir; oradaki hesabınızdan ve ' +
            'anahtarınıza yansıyan her ücretten siz sorumlusunuz. Qutai bu sözleşmenin tarafı değildir ve bu ' +
            'ücretleri iade edemez.',
        },
        {
          heading: 'Qutai bir tarayıcıdır',
          body:
            'Qutai, başkalarının işlettiği web sitelerini gösterir. Siteleri, içeriklerini ya da sundukları ürün ve ' +
            'hizmetleri kontrol etmeyiz, denetlemeyiz veya onaylamayız ve bunlardan sorumlu değiliz. Siteler ve ' +
            'içerikleri sahiplerine aittir. Bir siteyi kullanırken o sitenin kendi koşulları ve yasalar geçerlidir; ' +
            'bunlara uymak sizin sorumluluğunuzdadır. Asistanınkiler dahil bağlantılar, arama sonuçları ve öneriler ' +
            'bizim tavsiyemiz değildir.',
        },
        {
          heading: 'Asistan sizin adınıza işlem yapar',
          body:
            'İstediğinizde asistan sayfaları okuyabilir, tıklayabilir, yazabilir, form doldurabilir; gönderi, mesaj ' +
            've sipariş hazırlayabilir. Bir sitede metin yayımlamadan ya da göndermeden önce Qutai onayınızı ister. ' +
            'Ödemeyi tamamlamak, Ayarlar › Asistan’da “Asistan ödemeleri tamamlasın”ı açana kadar kapalıdır; açık ' +
            'olduğunda da her ödeme, toplam tutarı gösteren Qutai’ın kendi penceresinde onayınızı gerektirir. Yapay ' +
            'zekâ hata yapabilir: neyi onayladığınızı kontrol edin; satın alma, rezervasyon, ödeme, gönderi, mesaj, ' +
            'silme, hesap değişikliği ve diğer önemli işlemleri tamamlanmadan önce gözden geçirin. İstediğiniz ya da ' +
            'onayladığınız işlemlerden, onları kendiniz yapmışsınız gibi siz sorumlusunuz. Siteler, satıcılar ve ' +
            'başka kişilerle yaptığınız alışverişler ve diğer işler sizinle onlar arasındadır: Qutai bunların tarafı ' +
            'değildir ve onlara yaptığınız ödemelere hiçbir zaman aracılık etmez. Ayarlar’dan her işlemden önce onay ' +
            'istenmesini seçebilir, seçtiğiniz sitelerde asistanı engelleyebilirsiniz.',
        },
        {
          heading: 'Yapay zekâ yanıtları',
          body:
            'Yapay zekânın yazdığı yanıtlar, özetler, çeviriler ve diğer her şey yanlış, eksik ya da güncelliğini ' +
            'yitirmiş olabilir. Bunlar profesyonel tavsiye değildir; örneğin tıbbi, hukuki, mali ya da vergi ' +
            'tavsiyesi değildir: bu tür konularda yetkin bir uzmana danışın. Önemli bilgilere güvenmeden önce onları ' +
            'kontrol edin.',
        },
        {
          heading: 'Reklam ve izleyici engelleme',
          body:
            'Reklam ve izleyicileri engellemek, çerez bildirimlerini gizlemek ve video reklamlarını engellemek sizin ' +
            'seçtiğiniz özelliklerdir: her birini Ayarlar › Gizlilik ve güvenlik’ten kapatabilir, bir site için ' +
            'engellemeyi o sitenin sayfasından kapatabilirsiniz (“Video reklamlarını engelle” siz açana kadar ' +
            'kapalıdır). Engelleme yalnızca telefonunuzda açtığınız sayfalarda çalışır; sitelerin kendisini ' +
            'değiştirmez. Filtre listelerini üçüncü taraflar kendi lisanslarıyla hazırlar (örneğin EasyList GPLv3 ya ' +
            'da CC BY-SA 3.0, AdGuard GPLv3 lisansıyla); telefonunuz onları yayıncılarından indirir, Ayarlar da her ' +
            'listenin ana sayfasını ve lisansını gösterir. Neyin engellenip neyin engellenmeyeceğini garanti etmeyiz: ' +
            'listeler fazla ya da eksik engelleyebilir; bir site bozulabilir, daha az şey gösterebilir ya da ' +
            'engellemeyi kapatmanızı isteyebilir. Bir sitede engellemeyi kullanıp kullanmamak sizin kararınızdır ve ' +
            'ziyaretiniz için o sitenin koşulları geçerlidir.',
        },
        {
          heading: 'Sayfa stilleri ve betikler',
          body:
            'Asistandan bir sayfanın görünüşünü değiştirmesini (stil) ya da bir sayfada betik çalıştırmasını ' +
            'isteyebilir, bunları bir site için kalıcı yapabilir; ayrıca kendiniz yazabilir, düzenleyebilir, içe ve ' +
            'dışa aktarabilirsiniz. Betikler, siz Ayarlar › Asistan’dan açana kadar kapalıdır. Qutai, asistanın ' +
            'yazdığı her stili ve betiği size gösterir ve yalnızca siz onayladıktan sonra çalıştırır; içe aktarılan ' +
            'betikler siz onaylayana kadar kapalı kalır. Stiller ve betikler yalnızca telefonunuzda, açtığınız ' +
            'sayfalarda çalışır. Qutai riskli bazı kodları reddeder, ancak sizin yazdığınız, düzenlediğiniz ya da içe ' +
            'aktardığınız kodu incelemez ve hiçbir kodun ne yapacağını garanti edemez: bir betik o sitede sizin ' +
            'oturumunuzla çalışır, sayfayı değiştirebilir ya da bozabilir ve oradaki hesabınızı etkileyebilir. ' +
            'Yalnızca anladığınız ve güvendiğiniz şeyleri onaylayın. Onayladığınız, kalıcı yaptığınız, içe ' +
            'aktardığınız ya da paylaştığınız stillerden ve betiklerden siz sorumlusunuz.',
        },
        {
          heading: 'Qutai içindeki uygulamalar',
          body:
            'Qutai içindeki uygulamaları, sizin isteğiniz üzerine yapay zekâ yazar. İnternetten ve sitelerden ' +
            'yalıtılmış olarak çalışırlar, ancak bizim tarafımızdan test edilmez ya da incelenmez ve hiçbir garanti ' +
            'olmadan sunulur: bir uygulamada hatalar olabilir ya da içine kaydedilen veriler kaybolabilir; önemli ' +
            'olan her şeyi dışa aktarın ya da yedekleyin. Bir dosyadan içe aktardığınız uygulamalar herhangi birinden ' +
            'gelebilir ve bizim tarafımızdan incelenmez; Qutai içe aktarılan bir uygulamanın ne olduğunu ve neleri ' +
            'kullanabileceğini, siz onu açmadan önce gösterir. Açtığınız ve başkalarıyla paylaştığınız uygulamalardan ' +
            'siz sorumlusunuz.',
        },
        {
          heading: 'İndirmeler ve dosya yükleme',
          body:
            'Neyi indireceğinize, açacağınıza ve yükleyeceğinize siz karar verirsiniz. Qutai, uygulama yükleyebilen ' +
            'ya da kod çalıştırabilen dosyaları indirmeden önce sizi uyarır, ancak dosyaları virüslere ya da başka ' +
            'zararlara karşı taramaz. {{ios:Qutai hiçbir şeyi kendisi yüklemez. İndirilen dosyalar telefonunuza|android:İndirilen bir uygulamayı (APK dosyası) açmak, onu sistemin yükleyicisine verir; Qutai hiçbir şeyi kendisi yüklemez. Google Play dışından gelen dosyalar ve uygulamalar telefonunuza|web:Android’de indirilen bir uygulamayı (APK dosyası) açmak, onu sistemin yükleyicisine verir; Qutai hiçbir şeyi kendisi yüklemez. App Store ve Google Play dışından gelen dosyalar ve uygulamalar telefonunuza}} ya da verilerinize zarar verebilir; bunları indirmek, açmak ve ' +
            'yüklemek, bunu yapma hakkınızın olması da dahil, sizin sorumluluğunuzdadır.',
        },
        {
          heading: 'Kabul edilebilir kullanım',
          body:
            'Qutai’ı, asistanı, stilleri, betikleri ya da uygulamaları şunlar için kullanmayın:\n' +
            '• yasaları ya da başkalarının gizlilik, telif veya marka gibi haklarını çiğnemek;\n' +
            '• sitelerin ya da yapay zekâ sağlayıcılarının koşullarını çiğnemek;\n' +
            '• şifreleri, erişim denetimlerini, ödeme duvarlarını, kopya korumasını (DRM) ya da başka teknik ' +
            'korumaları aşmak;\n' +
            '• başkalarının kişisel verilerini hukuka aykırı biçimde toplamak, izlemek ya da yayımlamak;\n' +
            '• istenmeyen ileti göndermek, sahte hesap ya da yorum oluşturmak, otomatik olarak toplu gönderi ya da ' +
            'işlem yapmak veya siteleri aşırı yüklemek;\n' +
            '• kimseyi aldatmak ya da dolandırmak veya kötü amaçlı yazılım yaymak.',
        },
        {
          heading: 'Garanti yoktur ve sorumluluğun sınırları',
          body:
            'Qutai “olduğu gibi” ve “sunulabildiği kadarıyla” sunulur. Onu yararlı ve güvenli kılmak için çalışırız, ' +
            'ancak her zaman çalışacağına, hatasız olacağına, beklediğinizi engelleyeceğine ya da her siteyle ' +
            'çalışacağına söz vermeyiz ve yasaların gerektirdiklerinin ötesinde garanti vermeyiz. Yasaların izin ' +
            'verdiği ölçüde; siteler ve içeriklerinin, başka kişilerin, yapay zekâ sağlayıcılarının hizmetlerinin, ' +
            'filtre listelerinin, onayladığınız ya da içe aktardığınız stillerin, betiklerin ve uygulamaların ya da ' +
            'istediğiniz veya onayladığınız işlemlerin yol açtığı kayıplardan ve kâr kaybı gibi dolaylı kayıplardan ' +
            'sorumlu değiliz. Bu koşullardaki hiçbir şey kast ya da ağır ihmalden, ölüm ya da bedensel zarardan doğan ' +
            'sorumluluğu veya yasaların sınırlanmasına ya da kaldırılmasına izin vermediği başka bir sorumluluğu ' +
            'sınırlamaz.',
        },
        {
          heading: 'Tüketici olarak haklarınız',
          body:
            'Qutai’ı tüketici olarak kullanıyorsanız, yaşadığınız yerin yasalarının tüketicilere tanıdığı ve ' +
            'sözleşmeyle vazgeçilemeyen her hakkınız saklıdır; örneğin 6502 sayılı Tüketicinin Korunması Hakkında ' +
            'Kanun’dan ve Avrupa Birliği ile Avrupa Ekonomik Alanı tüketici hukukundan doğan haklarınız. Bu ' +
            'koşullardaki hiçbir şey bu hakları sınırlamaz ya da kaldırmaz; bir hüküm bunlarla çelişirse bu haklar ' +
            'geçerli olur.',
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

/** The platform a document is shown on: it names only that platform's store and services. */
export type LegalPlatform = 'ios' | 'android';

/**
 * Wording that differs by platform is written in the texts as `{{ios:…|android:…|web:…}}`: the app shows the branch of
 * the phone it runs on, so the iOS texts never name Google Play or Android and the Android texts never name the App
 * Store or the iPhone where they mean the other platform (Apple's guideline 2.3.10). The `web` branch is what the
 * website's copy shows (webpage/scripts/make-legal.mjs, English and Turkish pro texts only); the eight translations,
 * shown only in the app, leave it out. A branch may be empty.
 */
const PLATFORM_WORDING = /\{\{ios:([^{}|]*)\|android:([^{}|]*)(?:\|web:([^{}|]*))?\}\}/g;

/** A text with each platform part replaced by the given platform's wording. */
export function textForPlatform(text: string, platform: LegalPlatform): string {
  return text.replace(PLATFORM_WORDING, (_, ios: string, android: string) => (platform === 'ios' ? ios : android));
}

function documentForPlatform(doc: LegalDocument, platform: LegalPlatform): LegalDocument {
  return {
    title: textForPlatform(doc.title, platform),
    intro: textForPlatform(doc.intro, platform),
    sections: doc.sections.map((s) => ({ heading: textForPlatform(s.heading, platform), body: textForPlatform(s.body, platform) })),
  };
}

const thisPlatform = (): LegalPlatform => (Platform.OS === 'android' ? 'android' : 'ios');

/** A build's document as written, before the platform's wording is chosen. */
function writtenDocument(build: LegalBuild, kind: LegalKind, language: Language): LegalDocument {
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

/**
 * A build's document in a language (English and Turkish as written, the other eight from their translation), worded for
 * a platform (this phone's unless given).
 */
export function legalDocumentFor(
  build: LegalBuild,
  kind: LegalKind,
  language: Language,
  platform: LegalPlatform = thisPlatform(),
): LegalDocument {
  return documentForPlatform(writtenDocument(build, kind, language), platform);
}

/** The privacy policy or terms of this build, in the interface language (all ten have them), for this phone's platform. */
export function legalDocument(kind: LegalKind, language: Language): LegalDocument {
  return legalDocumentFor(accountsEnabled ? 'pro' : 'openSource', kind, language);
}
