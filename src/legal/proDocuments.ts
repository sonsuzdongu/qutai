import type { LegalDocument, LegalKind, LegalLanguage } from './documents';

/**
 * The privacy policy and terms of the pro-mode builds (accounts, Qutai Credits, buying credits: `accountsEnabled`).
 * Builds without pro mode show `documents.ts` unchanged. Written from what the app and the server actually do
 * (README.md › Accounts, › Qutai Credits; backend/README.md › Purchases); have them checked by a lawyer before the
 * store release (TODO.md › Legal).
 */
export const PRO_LEGAL_UPDATED = '2026-11-19';

export const PRO_DOCUMENTS: Record<LegalLanguage, Record<LegalKind, LegalDocument>> = {
  en: {
    privacy: {
      title: 'Privacy Policy',
      intro:
        'Qutai is a web browser with an AI assistant. We built it so your browsing stays on your phone. Qutai’s own ' +
        'server is used only for your Qutai account (sign-in, Qutai Credits, purchases in the app and backups), and ' +
        'only when you choose them. We do not sell your data, and Qutai has no analytics, tracking or advertising.',
      sections: [
        {
          heading: 'Who we are',
          body:
            'Qutai is made by Osman Yuksel (“we”), who is responsible for the data described in this policy. For ' +
            'questions about your privacy, or to ask for a copy or the deletion of what Qutai’s server keeps about ' +
            'you, write to osmanyuksel@gmail.com.',
        },
        {
          heading: 'What stays on your phone',
          body:
            'Your tabs, history, bookmarks, saved pages, downloads, site permissions, the assistant’s memory, its ' +
            'action history and your conversations are stored only on this device, also when you are signed in, unless ' +
            'you back them up to your Qutai account (below). API ' +
            'keys and your sign-in are kept in the phone’s encrypted storage. Incognito tabs write nothing to disk; ' +
            'their conversations are not saved.',
        },
        {
          heading: 'What leaves your phone, and to whom',
          body:
            '• Websites you visit receive what any browser sends them, and the details you ask the assistant to type ' +
            'into them (such as your name or address in a form).\n• With your own API key, your message and the ' +
            'content the assistant needs (the page text, screenshots when it looks at a page, files and images you ' +
            'attach, the result of a script you approved on a page, when you ask about cookies their names, sites and settings but never their values, your memory ' +
            'and custom instructions) go directly to the AI provider you chose (Anthropic, ' +
            'OpenAI, Google, OpenRouter or your own server). Qutai’s server is not involved. Your calendar events and ' +
            'your location are sent only when you confirm, each time.\n• With Qutai Credits, the same content goes to ' +
            'Qutai’s server first, which passes it to the AI provider (Anthropic, OpenAI or Google) under Qutai’s own ' +
            'account and sends the answer back. Qutai’s server does not store or log this content. The app asks ' +
            'before you use Qutai Credits for the first time.\n• If web search is on, the AI provider may run searches ' +
            'for you. The providers’ privacy policies and terms apply to what they receive.\n• If search suggestions ' +
            'are on, what you type in the address bar is sent to your search engine (never from incognito tabs).\n• If ' +
            'you tap “Use my location” in setup, your approximate position is sent to the phone’s address service ' +
            '(Apple’s on an iPhone; on Android usually Google’s) to find the name of the place. Only the place name ' +
            'is kept.\n• If you speak to the assistant and the phone can’t recognise that language on the device ' +
            'itself, the audio goes to the phone’s speech service (Apple’s or Google’s), only after you have agreed ' +
            'once in Qutai and never in incognito conversations. Qutai and the AI service receive only the text.\n• ' +
            'When the assistant shows you options as cards, their pictures are loaded from the sites (or the sites’ image servers) that show them, without your cookies, also for options you don’t open; in incognito conversations only when you tap “Show images”.\n• ' +
            'While “Block ads and trackers” is on, the filter lists you chose are downloaded from their publishers ' +
            '(such as EasyList and AdGuard) and updated every few days. These requests contain nothing about your ' +
            'browsing.',
        },
        {
          heading: 'Your Qutai account',
          body:
            'An account is optional; you need one only for Qutai Credits, purchases in the app and backups in your ' +
            'account. You sign in with Apple, with Google or with your email address. With email, we send a message ' +
            'with a one-time code and a link to the address you enter, through our email service (Mailjet); the code ' +
            'works for 10 minutes and only on the phone that asked for it, and to prevent abuse the server counts how ' +
            'many codes are sent to each address and phone. Qutai’s server keeps: an account number; the sign-in ' +
            'methods the account has (Apple, Google, email) and the email addresses that come with them (with Apple ' +
            'this can be a private relay address); when the account was created and last used; your signed-in devices ' +
            '(a random device id, not your phone’s identifiers); and your credits: the balance, purchases and credits ' +
            'added, and for each assistant request the model, the number of tokens, what it cost and when. It does ' +
            'not keep your messages, pages or answers.',
        },
        {
          heading: 'Backups in your Qutai account',
          body:
            'Only if you choose it (Settings › Backup), Qutai’s server keeps your backup file: the same data as a backup ' +
            'you export (bookmarks, history, the assistant’s memory, saved tasks, site settings and preferences; open ' +
            'tabs, conversations, activity and AI keys only if you include them). It is encrypted on your phone with a ' +
            'password you choose before it is sent; Qutai cannot read it and cannot recover the password, which is kept ' +
            'only on your phone. With each backup the server also keeps when it was made, its size, the app version and ' +
            'the kind of phone (for example “iPhone · iOS 26”). The newest backups are kept (3 at present) and older ones ' +
            'are deleted; you can delete them at any time, and deleting your account deletes them.',
        },
        {
          heading: 'Purchases in the app',
          body:
            'Qutai Credits and anything else sold in the app are bought through the App Store or Google Play; your ' +
            'payment details stay with Apple or Google and never reach Qutai. A payments service (RevenueCat) ' +
            'receives your Qutai account number and the store’s purchase record so the purchase can be confirmed, ' +
            'added to your account and restored on another phone. Qutai keeps a record of each purchase (store, ' +
            'transaction, product, credits, price paid and dates), which tax law requires us to keep, also after the ' +
            'account is deleted, without the link to you. Refunds are handled by Apple or Google under their own ' +
            'rules.',
        },
        {
          heading: 'Qutai’s server and who else processes data',
          body:
            'Qutai’s server runs on Cloudflare, which also stores the backups. Like any server, it sees your IP ' +
            'address with each request; it uses it only to limit how many requests can be made, and Qutai’s own logs ' +
            'never contain your IP address, email address, messages, pages or tokens (they hold a request id, your ' +
            'account number, what was asked for, how long it took and, for assistant requests, the model, tokens and ' +
            'cost). The companies that process data for Qutai, each under its own privacy policy, are: Cloudflare ' +
            '(the server), Apple and Google (sign-in and the stores), Mailjet (sign-in emails), RevenueCat ' +
            '(purchases) and, with Qutai Credits, Anthropic, OpenAI and Google (the AI). We share your data with no ' +
            'one else, except when the law requires it (for example a court order) or to protect Qutai and its users ' +
            'against fraud and abuse.',
        },
        {
          heading: 'How long data is kept',
          body:
            'On your phone: until you delete it or uninstall Qutai. On Qutai’s server: your account, its sign-in ' +
            'methods, devices and credit history until you delete the account; backups as described above; sign-in ' +
            'codes until they are used or expire; purchase records as long as tax law requires, without the link to ' +
            'you once the account is deleted.',
        },
        {
          heading: 'Your contacts',
          body:
            'If you allow it, the assistant can find a person you name (for example “call Ahmet”) in your phone’s ' +
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
            'You can view and delete the assistant’s memory, clear history, cookies and other data in Settings, and ' +
            'remove your API keys at any time. You can delete your backups from Qutai’s server in Settings › Backup. ' +
            'You can stop using Qutai Credits, sign out, or delete your account in Settings › Account: deleting it ' +
            'removes the account, its balance and its history from Qutai’s server (purchase records stay without the ' +
            'link to you, as above) and asks the payments service to delete its record of you. You can also write to ' +
            'osmanyuksel@gmail.com to ask for a copy of what Qutai’s server keeps about you, or for its correction or ' +
            'deletion. Uninstalling Qutai deletes everything it stored on the phone.',
        },
        {
          heading: 'Security',
          body:
            'Connections to Qutai’s server use HTTPS. Sign-in tokens are kept on the server only in hashed form and ' +
            'on your phone in its encrypted storage, and backups are encrypted on your phone before they are sent.',
        },
        {
          heading: 'Children',
          body:
            'Qutai is not directed at children under 13, and we do not knowingly collect data from them. In some ' +
            'countries you must be older (for example 16) to agree to this policy yourself; below that age a parent ' +
            'or guardian must agree for you.',
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
          heading: 'Two ways to use the assistant',
          body:
            '• Your own API key: you are responsible for your account with that provider, its terms and every cost ' +
            'billed to your key.\n' +
            '• Qutai Credits: the assistant’s requests go through Qutai’s server and are paid with credits from your ' +
            'Qutai account. You need an account to use them.',
        },
        {
          heading: 'Qutai Credits',
          body:
            'Credits are bought in the app through the App Store or Google Play, at the price the store shows, and are ' +
            'added to your Qutai account once the purchase is confirmed. They pay only for the assistant’s requests in ' +
            'Qutai, at the credit prices shown for each model; what each answer cost is shown under it. A request first ' +
            'holds the most it could cost and gives back what it did not use. Credits belong to your Qutai account, can ' +
            'be used on any phone you sign in on, cannot be transferred or exchanged for money, and are not refunded ' +
            'except where the law or the store’s refund rules require it; refunds are handled by Apple or Google. If a ' +
            'purchase is refunded, its credits are taken back, which can make the balance negative until you top it up. ' +
            'Models, credit prices and limits can change; the current ones are shown in the app before you use them. ' +
            'Qutai Credits can be paused for maintenance or be unavailable at times.',
        },
        {
          heading: 'Your account',
          body:
            'Keep your sign-in (Apple, Google or your email) secure; what is done with your account is your responsibility. We may ' +
            'suspend an account that breaks these terms. If you delete your account, its remaining credits are lost.',
        },
        {
          heading: 'The assistant acts on your behalf',
          body:
            'The assistant can read pages, click, type and fill in forms when you ask it to. AI can make mistakes: ' +
            'check its answers, and review purchases, bookings, messages and other important actions before they are ' +
            'completed. You can require confirmation before every action in Settings.',
        },
        {
          heading: 'Acceptable use',
          body:
            'Do not use Qutai or Qutai Credits to break the law, to break the terms of websites or AI providers, to ' +
            'harm others (for example by sending spam or collecting other people’s data), or to misuse or overload ' +
            'Qutai’s server.',
        },
        {
          heading: 'Websites and content',
          body: 'Websites and their content belong to their owners. Qutai is not responsible for them.',
        },
        {
          heading: 'No warranty',
          body:
            'Qutai is provided “as is”, without warranties. To the extent the law allows, we are not liable for losses ' +
            'arising from its use, including actions taken by the assistant.',
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
        'Qutai’ın kendi sunucusu yalnızca Qutai hesabınız (oturum açma, Qutai Kredileri, uygulama içi satın alma ve ' +
        'yedekler) için, yalnızca siz bunları seçtiğinizde kullanılır. Verilerinizi satmayız; Qutai’da analitik, ' +
        'izleme veya reklam yoktur.',
      sections: [
        {
          heading: 'Biz kimiz',
          body:
            'Qutai’ı Osman Yuksel (“biz”) geliştirir ve bu politikada anlatılan verilerden o sorumludur. ' +
            'Gizliliğinizle ilgili sorularınız için ya da Qutai’ın sunucusunun sizinle ilgili sakladıklarının bir ' +
            'kopyasını veya silinmesini istemek için osmanyuksel@gmail.com adresine yazın.',
        },
        {
          heading: 'Telefonunuzda kalanlar',
          body:
            'Sekmeleriniz, geçmişiniz, yer imleriniz, kaydedilen sayfalar, indirilenler, site izinleri, asistanın ' +
            'hafızası, işlem geçmişi ve sohbetleriniz, oturum açmış olsanız da yalnızca bu cihazda saklanır; bunları ' +
            'Qutai hesabınıza yedeklemeyi seçerseniz yedek sunucuda da tutulur (aşağıda). API ' +
            'anahtarları ve oturumunuz telefonun şifreli deposunda tutulur. Gizli sekmeler diske hiçbir şey yazmaz; ' +
            'sohbetleri kaydedilmez.',
        },
        {
          heading: 'Telefonunuzdan çıkanlar ve kime gittiği',
          body:
            '• Ziyaret ettiğiniz siteler, her tarayıcının gönderdiği bilgileri ve asistandan o siteye yazmasını ' +
            'istediğiniz bilgileri (örneğin bir formdaki adınızı veya adresinizi) alır.\n• Kendi API anahtarınızla, ' +
            'mesajınız ve asistanın ihtiyaç duyduğu içerik (sayfa metni, sayfaya baktığında ekran görüntüleri, ' +
            'eklediğiniz dosya ve görseller, bir sayfada onayladığınız bir betiğin sonucu, çerezleri sorduğunuzda adları, siteleri ve ayarları ama hiçbir zaman ' +
            'değerleri, hafızanız ve özel talimatlarınız) doğrudan seçtiğiniz yapay zekâ ' +
            'sağlayıcısına (Anthropic, OpenAI, Google, OpenRouter veya kendi sunucunuz) gider. Qutai’ın sunucusu ' +
            'araya girmez. Takvim etkinlikleriniz ve konumunuz yalnızca her seferinde onayladığınızda gönderilir.\n• ' +
            'Qutai Kredileriyle aynı içerik önce Qutai’ın sunucusuna gider; sunucu onu Qutai’ın kendi hesabıyla ' +
            'yapay zekâ sağlayıcısına (Anthropic, OpenAI veya Google) iletir ve yanıtı geri gönderir. Qutai’ın ' +
            'sunucusu bu içeriği saklamaz ve kayda geçirmez. Uygulama, Qutai Kredilerini ilk kez kullanmadan önce ' +
            'size sorar.\n• Web araması açıksa yapay zekâ sağlayıcısı sizin için arama yapabilir. Sağlayıcıların ' +
            'aldıkları için kendi gizlilik politikaları ve koşulları geçerlidir.\n• Arama önerileri açıksa adres ' +
            'çubuğuna yazdıklarınız arama motorunuza gönderilir (gizli sekmelerden asla).\n• Kurulumda “Konumumu ' +
            'kullan”a dokunursanız, yer adını bulmak için yaklaşık konumunuz telefonun adres hizmetine (iPhone’da ' +
            'Apple’ınkine, Android’de genellikle Google’ınkine) gönderilir. Yalnızca yer adı saklanır.\n• Asistana ' +
            'sesle yazdığınızda telefon o dili cihazın kendisinde tanıyamıyorsa ses, telefonun konuşma hizmetine ' +
            '(Apple’ın ya da Google’ın) gider; bu yalnızca Qutai’da bir kez izin verdikten sonra olur, gizli ' +
            'sohbetlerde asla. Qutai ve yapay zekâ hizmeti yalnızca metni alır.\n• Asistan seçenekleri kartlarla ' +
            'gösterdiğinde kartların resimleri, onları gösteren sitelerden (ya da sitelerin resim sunucularından) çerezleriniz gönderilmeden yüklenir; açmadığınız seçenekler için de. Gizli sohbetlerde yalnızca “Resimleri göster”e dokunduğunuzda.\n• “Reklam ve izleyicileri engelle” ' +
            'açıkken seçtiğiniz filtre listeleri yayıncılarından (örneğin EasyList ve AdGuard) indirilir ve birkaç ' +
            'günde bir güncellenir. Bu isteklerde gezinmenizle ilgili hiçbir şey yoktur.',
        },
        {
          heading: 'Qutai hesabınız',
          body:
            'Hesap isteğe bağlıdır; yalnızca Qutai Kredileri, uygulama içi satın almalar ve hesabınızdaki yedekler ' +
            'için gerekir. Apple, Google ya da e-posta adresinizle oturum açarsınız. E-postayla açarken girdiğiniz ' +
            'adrese e-posta hizmetimiz (Mailjet) aracılığıyla tek kullanımlık bir kod ve bir bağlantı göndeririz; kod ' +
            '10 dakika ve yalnızca onu isteyen telefonda geçerlidir, kötüye kullanımı önlemek için sunucu her adrese ' +
            've telefona kaç kod gönderildiğini sayar. Qutai’ın sunucusu şunları saklar: bir hesap numarası; hesabın ' +
            'oturum açma yöntemleri (Apple, Google, e-posta) ve bunlarla gelen e-posta adresleri (Apple’da bu, gizli ' +
            'bir yönlendirme adresi olabilir); hesabın oluşturulma ve son kullanılma zamanı; oturum açtığınız ' +
            'cihazlar (telefonunuzun kimlikleri değil, rastgele bir cihaz numarası); ve kredileriniz: bakiye, satın ' +
            'almalar ve eklenen krediler, her asistan isteği için model, token sayısı, maliyet ve zaman. ' +
            'Mesajlarınızı, sayfaları veya yanıtları saklamaz.',
        },
        {
          heading: 'Qutai hesabınızdaki yedekler',
          body:
            'Yalnızca siz seçerseniz (Ayarlar › Yedekleme), Qutai’ın sunucusu yedek dosyanızı saklar: dışa ' +
            'aktardığınız bir yedekle aynı veriler (yer imleri, geçmiş, asistanın hafızası, kayıtlı görevler, site ' +
            'ayarları ve tercihler; açık sekmeler, sohbetler, etkinlik ve yapay zekâ anahtarları yalnızca bunları dahil ' +
            'ederseniz). Dosya gönderilmeden önce telefonunuzda seçtiğiniz bir parolayla şifrelenir; Qutai onu okuyamaz ' +
            've yalnızca telefonunuzda tutulan parolayı kurtaramaz. Sunucu her yedekle birlikte ne zaman yapıldığını, ' +
            'boyutunu, uygulama sürümünü ve telefon türünü (örneğin “iPhone · iOS 26”) de saklar. En yeni yedekler ' +
            'tutulur (şu an 3), eskileri silinir; yedekleri istediğiniz an silebilirsiniz, hesabınızı silmek onları da ' +
            'siler.',
        },
        {
          heading: 'Uygulama içi satın alma',
          body:
            'Qutai Kredileri ve uygulamada satılan her şey App Store veya Google Play aracılığıyla satın alınır; ' +
            'ödeme bilgileriniz Apple veya Google’da kalır, Qutai’a asla ulaşmaz. Satın almanın doğrulanıp ' +
            'hesabınıza eklenebilmesi ve başka bir telefonda geri yüklenebilmesi için bir ödeme hizmeti (RevenueCat) ' +
            'Qutai hesap numaranızı ve mağazanın satın alma kaydını alır. Qutai her satın almanın kaydını (mağaza, ' +
            'işlem, ürün, kredi, ödenen tutar ve tarihler) vergi mevzuatı gereği saklar; hesap silindikten sonra da, ' +
            'sizinle bağlantısı olmadan. İadeleri Apple veya Google kendi kurallarına göre yapar.',
        },
        {
          heading: 'Qutai’ın sunucusu ve verileri işleyen diğerleri',
          body:
            'Qutai’ın sunucusu Cloudflare üzerinde çalışır; yedekler de orada saklanır. Her sunucu gibi o da her ' +
            'istekte IP adresinizi görür; bunu yalnızca istek sayısını sınırlamak için kullanır ve Qutai’ın kendi ' +
            'kayıtlarında IP adresiniz, e-posta adresiniz, mesajlarınız, sayfalar veya oturum anahtarları asla ' +
            'bulunmaz (kayıtlarda bir istek numarası, hesap numaranız, istenen işlem, ne kadar sürdüğü ve asistan ' +
            'isteklerinde model, token ve maliyet bulunur). Qutai için veri işleyen şirketler, her biri kendi ' +
            'gizlilik politikasına göre: Cloudflare (sunucu), Apple ve Google (oturum açma ve mağazalar), Mailjet ' +
            '(oturum açma e-postaları), RevenueCat (satın almalar) ve Qutai Kredileriyle Anthropic, OpenAI ve Google ' +
            '(yapay zekâ). Verilerinizi başka kimseyle paylaşmayız; yasanın gerektirdiği durumlar (örneğin bir ' +
            'mahkeme kararı) ve Qutai’ı ve kullanıcılarını dolandırıcılık ve kötüye kullanıma karşı korumak dışında.',
        },
        {
          heading: 'Verilerin ne kadar saklandığı',
          body:
            'Telefonunuzda: siz silene ya da Qutai’ı kaldırana kadar. Qutai’ın sunucusunda: hesabınız, oturum açma ' +
            'yöntemleri, cihazları ve kredi geçmişi siz hesabı silene kadar; yedekler yukarıda anlatıldığı gibi; ' +
            'oturum açma kodları kullanılana ya da süresi dolana kadar; satın alma kayıtları vergi mevzuatının ' +
            'gerektirdiği süre boyunca, hesap silindikten sonra sizinle bağlantısı olmadan.',
        },
        {
          heading: 'Kişileriniz',
          body:
            'İzin verirseniz asistan, adını söylediğiniz bir kişiyi (örneğin “Ahmet’i ara”) telefonunuzun ' +
            'kişilerinde bulabilir. Qutai yalnızca sizin söylediğiniz adları, telefonunuzda arar; kişi listeniz hiçbir ' +
            'zaman yüklenmez ya da listelenmez. Yapay zekâ hizmeti yalnızca eşleşen adları ve her birinde hangi tür ' +
            'numara ya da adres bulunduğunu (“cep” ya da “iş e-postası” gibi) alır, numaraların ve adreslerin ' +
            'kendisini asla almaz: bunları düğmede ya da taslakta siz görürsünüz, aramayı ya da gönderimi siz ' +
            'yaparsınız. Kişilerinizden gelen numaralar ve adresler sohbetlerinizle, asistanın belleğiyle ya da ' +
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
            'API anahtarlarınızı istediğiniz an kaldırabilirsiniz. Yedeklerinizi Ayarlar › Yedekleme’den Qutai’ın ' +
            'sunucusundan silebilirsiniz. Ayarlar › Hesap’tan Qutai Kredilerini kullanmayı bırakabilir, oturumu ' +
            'kapatabilir ya da hesabınızı silebilirsiniz: silmek hesabı, bakiyesini ve geçmişini Qutai’ın ' +
            'sunucusundan kaldırır (satın alma kayıtları yukarıdaki gibi sizinle bağlantısı olmadan kalır) ve ödeme ' +
            'hizmetinden sizinle ilgili kaydını silmesini ister. Qutai’ın sunucusunun sizinle ilgili sakladıklarının ' +
            'bir kopyasını, düzeltilmesini veya silinmesini osmanyuksel@gmail.com adresine yazarak da ' +
            'isteyebilirsiniz. Qutai’ı kaldırmak telefonda sakladığı her şeyi siler.',
        },
        {
          heading: 'Güvenlik',
          body:
            'Qutai’ın sunucusuyla bağlantılar HTTPS kullanır. Oturum anahtarları sunucuda yalnızca özetlenmiş (hash) ' +
            'olarak, telefonunuzda ise şifreli depoda tutulur; yedekler gönderilmeden önce telefonunuzda şifrelenir.',
        },
        {
          heading: 'Çocuklar',
          body:
            'Qutai 13 yaşından küçük çocuklara yönelik değildir ve onlardan bilerek veri toplamayız. Bazı ülkelerde ' +
            'bu politikayı kendiniz kabul edebilmek için daha büyük (örneğin 16 yaşında) olmanız gerekir; bu yaşın ' +
            'altında bir ebeveyn veya vasinin sizin adınıza kabul etmesi gerekir.',
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
          heading: 'Asistanı kullanmanın iki yolu',
          body:
            '• Kendi API anahtarınız: o sağlayıcıdaki hesabınızdan, koşullarından ve anahtarınıza yansıyan her ücretten ' +
            'siz sorumlusunuz.\n' +
            '• Qutai Kredileri: asistanın istekleri Qutai’ın sunucusundan geçer ve Qutai hesabınızdaki kredilerle ' +
            'ödenir. Kullanmak için bir hesabınız olması gerekir.',
        },
        {
          heading: 'Qutai Kredileri',
          body:
            'Krediler uygulama içinden App Store veya Google Play aracılığıyla, mağazanın gösterdiği fiyatla satın ' +
            'alınır ve satın alma doğrulandığında Qutai hesabınıza eklenir. Yalnızca Qutai’da asistanın isteklerinin ' +
            'ücretini, her model için gösterilen kredi fiyatlarıyla öder; her yanıtın ne kadar tuttuğu altında ' +
            'gösterilir. Bir istek önce tutabileceği en yüksek tutarı ayırır, kullanmadığını geri verir. Krediler Qutai ' +
            'hesabınıza aittir, oturum açtığınız her telefonda kullanılabilir, devredilemez, paraya çevrilemez ve ' +
            'yasaların ya da mağazanın iade kurallarının gerektirdiği durumlar dışında iade edilmez; iadeleri Apple veya ' +
            'Google yürütür. Bir satın alma iade edilirse kredileri geri alınır; bu, bakiyeyi yeniden kredi alana kadar ' +
            'eksiye düşürebilir. Modeller, kredi fiyatları ve sınırlar değişebilir; güncel olanlar kullanmadan önce ' +
            'uygulamada gösterilir. Qutai Kredileri bakım nedeniyle durdurulabilir ya da zaman zaman kullanılamayabilir.',
        },
        {
          heading: 'Hesabınız',
          body:
            'Oturum açma yönteminizi (Apple, Google veya e-postanız) güvende tutun; hesabınızla yapılanlardan siz sorumlusunuz. Bu koşulları ' +
            'çiğneyen bir hesabı askıya alabiliriz. Hesabınızı silerseniz kalan kredileri kaybolur.',
        },
        {
          heading: 'Asistan sizin adınıza işlem yapar',
          body:
            'İstediğinizde asistan sayfaları okuyabilir, tıklayabilir, yazabilir ve form doldurabilir. Yapay zekâ hata ' +
            'yapabilir: yanıtlarını kontrol edin; satın alma, rezervasyon, mesaj ve diğer önemli işlemleri ' +
            'tamamlanmadan önce gözden geçirin. Ayarlar’dan her işlemden önce onay istenmesini seçebilirsiniz.',
        },
        {
          heading: 'Kabul edilebilir kullanım',
          body:
            'Qutai’ı veya Qutai Kredilerini yasaları, sitelerin veya yapay zekâ sağlayıcılarının koşullarını çiğnemek, ' +
            'başkalarına zarar vermek (örneğin istenmeyen ileti göndermek, başkalarının verilerini toplamak) ya da ' +
            'Qutai’ın sunucusunu kötüye kullanmak veya aşırı yüklemek için kullanmayın.',
        },
        {
          heading: 'Siteler ve içerik',
          body: 'Siteler ve içerikleri sahiplerine aittir. Qutai bunlardan sorumlu değildir.',
        },
        {
          heading: 'Garanti yoktur',
          body:
            'Qutai “olduğu gibi”, garanti olmaksızın sunulur. Yasaların izin verdiği ölçüde, asistanın yaptığı işlemler ' +
            'dahil, kullanımından doğan kayıplardan sorumlu değiliz.',
        },
        {
          heading: 'Değişiklikler',
          body: 'Bu koşullar değişirse Qutai yeni sürümü gösterir ve devam etmeden önce kabul etmenizi ister.',
        },
      ],
    },
  },
};
