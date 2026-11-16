import type { LegalDocument, LegalKind, LegalLanguage } from './documents';

/**
 * The privacy policy and terms of the pro-mode builds (accounts, Qutai Credits, buying credits: `accountsEnabled`).
 * Builds without pro mode show `documents.ts` unchanged. Written from what the app and the server actually do
 * (README.md › Accounts, › Qutai Credits; backend/README.md › Purchases); have them checked by a lawyer before the
 * store release (TODO.md › Legal).
 */
export const PRO_LEGAL_UPDATED = '2026-11-16';

export const PRO_DOCUMENTS: Record<LegalLanguage, Record<LegalKind, LegalDocument>> = {
  en: {
    privacy: {
      title: 'Privacy Policy',
      intro:
        'Qutai is a web browser with an AI assistant. We built it so your browsing stays on your phone. Qutai’s own ' +
        'server is used only for your Qutai account and for Qutai Credits, and only when you choose them. We do not ' +
        'sell your data, and Qutai has no analytics, tracking or advertising.',
      sections: [
        {
          heading: 'What stays on your phone',
          body:
            'Your tabs, history, bookmarks, saved pages, downloads, site permissions, the assistant’s memory, its ' +
            'action history and your conversations are stored only on this device, also when you are signed in. API ' +
            'keys and your sign-in are kept in the phone’s encrypted storage. Incognito tabs write nothing to disk; ' +
            'their conversations are not saved.',
        },
        {
          heading: 'What leaves your phone, and to whom',
          body:
            '• Websites you visit receive what any browser sends them.\n' +
            '• With your own API key, your message and the content the assistant needs (the page text, screenshots when ' +
            'it looks at a page, files you attach, your memory and custom instructions) go directly to the AI ' +
            'provider you chose (Anthropic, OpenAI, Google, OpenRouter or your own server). Qutai’s server is not ' +
            'involved.\n' +
            '• With Qutai Credits, the same content goes to Qutai’s server first, which passes it to the AI provider ' +
            '(Anthropic, OpenAI or Google) under Qutai’s own account and sends the answer back. Qutai’s server does not ' +
            'store or log this content. The app asks before you use Qutai Credits for the first time.\n' +
            '• If web search is on, the AI provider may run searches for you. The providers’ privacy policies and terms ' +
            'apply to what they receive.\n' +
            '• If search suggestions are on, what you type in the address bar is sent to your search engine (never ' +
            'from incognito tabs).',
        },
        {
          heading: 'Your Qutai account',
          body:
            'An account is optional; you need one only for Qutai Credits. You sign in with Apple or Google. Qutai’s ' +
            'server keeps: an account number; the Apple or Google sign-in the account belongs to and the email address ' +
            'that sign-in shares (if any); when the account was created and last used; your signed-in devices (a ' +
            'random device id, not your phone’s identifiers); and your credits: the balance, purchases and credits ' +
            'added, and for each assistant request the model, the number of tokens, what it cost and when. It does ' +
            'not keep your messages, pages or answers.',
        },
        {
          heading: 'Buying credits',
          body:
            'Credits are bought in the app through the App Store or Google Play; your payment details stay with Apple ' +
            'or Google and never reach Qutai. A payments service (RevenueCat) receives your Qutai account number and ' +
            'the store’s purchase record so the purchase can be confirmed and added to your account. Qutai keeps a ' +
            'record of each purchase (store, transaction, product, credits, price paid and dates), which tax law ' +
            'requires us to keep, also after the account is deleted, without the link to you.',
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
            'remove your API keys at any time. You can stop using Qutai Credits, sign out, or delete your account in ' +
            'Settings › Account: deleting it removes the account, its balance and its history from Qutai’s server ' +
            '(purchase records stay without the link to you, as above) and asks the payments service to delete its ' +
            'record of you. Uninstalling Qutai deletes everything it stored on the phone.',
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
            'Keep your Apple or Google sign-in secure; what is done with your account is your responsibility. We may ' +
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
        'Qutai’nin kendi sunucusu yalnızca Qutai hesabınız ve Qutai Kredileri için, yalnızca siz bunları ' +
        'seçtiğinizde kullanılır. Verilerinizi satmayız; Qutai’de analitik, izleme veya reklam yoktur.',
      sections: [
        {
          heading: 'Telefonunuzda kalanlar',
          body:
            'Sekmeleriniz, geçmişiniz, yer imleriniz, kaydedilen sayfalar, indirilenler, site izinleri, asistanın ' +
            'hafızası, işlem geçmişi ve sohbetleriniz, oturum açmış olsanız da yalnızca bu cihazda saklanır. API ' +
            'anahtarları ve oturumunuz telefonun şifreli deposunda tutulur. Gizli sekmeler diske hiçbir şey yazmaz; ' +
            'sohbetleri kaydedilmez.',
        },
        {
          heading: 'Telefonunuzdan çıkanlar ve kime gittiği',
          body:
            '• Ziyaret ettiğiniz siteler, her tarayıcının gönderdiği bilgileri alır.\n' +
            '• Kendi API anahtarınızla, mesajınız ve asistanın ihtiyaç duyduğu içerik (sayfa metni, sayfaya baktığında ' +
            'ekran görüntüleri, eklediğiniz dosyalar, hafızanız ve özel talimatlarınız) doğrudan seçtiğiniz yapay zekâ ' +
            'sağlayıcısına (Anthropic, OpenAI, Google, OpenRouter veya kendi sunucunuz) gider. Qutai’nin sunucusu ' +
            'araya girmez.\n' +
            '• Qutai Kredileriyle aynı içerik önce Qutai’nin sunucusuna gider; sunucu onu Qutai’nin kendi hesabıyla ' +
            'yapay zekâ sağlayıcısına (Anthropic, OpenAI veya Google) iletir ve yanıtı geri gönderir. Qutai’nin ' +
            'sunucusu bu içeriği saklamaz ve kayda geçirmez. Uygulama, Qutai Kredilerini ilk kez kullanmadan önce size ' +
            'sorar.\n' +
            '• Web araması açıksa yapay zekâ sağlayıcısı sizin için arama yapabilir. Sağlayıcıların aldıkları için ' +
            'kendi gizlilik politikaları ve koşulları geçerlidir.\n' +
            '• Arama önerileri açıksa adres çubuğuna yazdıklarınız arama motorunuza gönderilir (gizli sekmelerden ' +
            'asla).',
        },
        {
          heading: 'Qutai hesabınız',
          body:
            'Hesap isteğe bağlıdır; yalnızca Qutai Kredileri için gerekir. Apple veya Google ile oturum açarsınız. ' +
            'Qutai’nin sunucusu şunları saklar: bir hesap numarası; hesabın bağlı olduğu Apple veya Google girişi ve bu ' +
            'girişin paylaştığı e-posta adresi (varsa); hesabın oluşturulma ve son kullanılma zamanı; oturum açtığınız ' +
            'cihazlar (telefonunuzun kimlikleri değil, rastgele bir cihaz numarası); ve kredileriniz: bakiye, satın ' +
            'almalar ve eklenen krediler, her asistan isteği için model, token sayısı, maliyet ve zaman. Mesajlarınızı, ' +
            'sayfaları veya yanıtları saklamaz.',
        },
        {
          heading: 'Kredi satın alma',
          body:
            'Krediler uygulama içinden App Store veya Google Play aracılığıyla satın alınır; ödeme bilgileriniz Apple ' +
            'veya Google’da kalır, Qutai’ye asla ulaşmaz. Satın almanın doğrulanıp hesabınıza eklenebilmesi için bir ' +
            'ödeme hizmeti (RevenueCat) Qutai hesap numaranızı ve mağazanın satın alma kaydını alır. Qutai her satın ' +
            'almanın kaydını (mağaza, işlem, ürün, kredi, ödenen tutar ve tarihler) vergi mevzuatı gereği saklar; hesap ' +
            'silindikten sonra da, sizinle bağlantısı olmadan.',
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
            'Asistanın hafızasını Ayarlar’dan görüp silebilir; geçmişi, çerezleri ve diğer verileri temizleyebilir, API ' +
            'anahtarlarınızı istediğiniz an kaldırabilirsiniz. Ayarlar › Hesap’tan Qutai Kredilerini kullanmayı ' +
            'bırakabilir, oturumu kapatabilir ya da hesabınızı silebilirsiniz: silmek hesabı, bakiyesini ve geçmişini ' +
            'Qutai’nin sunucusundan kaldırır (satın alma kayıtları yukarıdaki gibi sizinle bağlantısı olmadan kalır) ve ' +
            'ödeme hizmetinden sizinle ilgili kaydını silmesini ister. Qutai’yi kaldırmak telefonda sakladığı her şeyi ' +
            'siler.',
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
      intro: 'Qutai’yi kullanarak bu koşulları kabul etmiş olursunuz. Lütfen Gizlilik Politikası ile birlikte okuyun.',
      sections: [
        {
          heading: 'Asistanı kullanmanın iki yolu',
          body:
            '• Kendi API anahtarınız: o sağlayıcıdaki hesabınızdan, koşullarından ve anahtarınıza yansıyan her ücretten ' +
            'siz sorumlusunuz.\n' +
            '• Qutai Kredileri: asistanın istekleri Qutai’nin sunucusundan geçer ve Qutai hesabınızdaki kredilerle ' +
            'ödenir. Kullanmak için bir hesabınız olması gerekir.',
        },
        {
          heading: 'Qutai Kredileri',
          body:
            'Krediler uygulama içinden App Store veya Google Play aracılığıyla, mağazanın gösterdiği fiyatla satın ' +
            'alınır ve satın alma doğrulandığında Qutai hesabınıza eklenir. Yalnızca Qutai’de asistanın isteklerinin ' +
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
            'Apple veya Google girişinizi güvende tutun; hesabınızla yapılanlardan siz sorumlusunuz. Bu koşulları ' +
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
            'Qutai’yi veya Qutai Kredilerini yasaları, sitelerin veya yapay zekâ sağlayıcılarının koşullarını çiğnemek, ' +
            'başkalarına zarar vermek (örneğin istenmeyen ileti göndermek, başkalarının verilerini toplamak) ya da ' +
            'Qutai’nin sunucusunu kötüye kullanmak veya aşırı yüklemek için kullanmayın.',
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
