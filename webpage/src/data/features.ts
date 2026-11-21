import type { IconName } from '../components/Icon';

/**
 * The /features page: everything Qutai does, written from the design record (DESIGN.md, docs/design/*.md,
 * backend/DESIGN.md) as of the date below. Only what the code does; limits said plainly. When a feature lands or
 * changes, update its item here in both languages, together with the home page.
 */
export const FEATURES_CHECKED = '2026-11-21';

export type Text = { en: string; tr: string };
const t = (en: string, tr: string): Text => ({ en, tr });

export type Feature = {
  title: Text;
  body: Text;
  /**
   * Example requests to the assistant, in the visitor's language. Turkish ones are written the way people talk to an
   * assistant ("hatırla", "ara"), not with the formal "siz" the page itself uses for the visitor.
   */
  asks?: Text[];
};
export type Group = { id: string; icon: IconName; title: Text; lede: Text; items: Feature[] };

export const PAGE = {
  metaTitle: t('Features · Qutai', 'Özellikler · Qutai'),
  metaDescription: t(
    'Everything Qutai does, from the assistant that reads and uses pages to apps it builds for you, with example requests and the limits stated plainly.',
    'Qutai’ın yaptığı her şey: istediğinizde sayfayı okuyup kullanan asistandan sizin için yaptığı uygulamalara kadar, örnek isteklerle ve sınırlarıyla birlikte.',
  ),
  kicker: t('Features', 'Özellikler'),
  title: t('Everything Qutai does, in one place.', 'Qutai’ın yaptığı her şey, tek sayfada.'),
  lede: t(
    'A browser for iPhone and Android with an AI assistant built in. Ask in your own words, by typing or by voice; the examples under each feature are requests you could send as they are. This page follows Qutai’s design record: what the code does today, and where its limits are.',
    'iPhone ve Android için, yapay zekâ asistanıyla gelen bir tarayıcı. Ne istediğinizi kendi sözlerinizle yazın ya da söyleyin; her özelliğin altındaki örnekleri olduğu gibi gönderebilirsiniz. Bu sayfa Qutai’ın tasarım kaydına dayanır: kodun bugün yaptıklarını ve sınırlarını anlatır.',
  ),
  medallionLabel: t(
    'An illuminated medallion with Qutai’s mark at its centre and ten petals, one for each group of features; each petal links to its group.',
    'Ortasında Qutai işareti, çevresinde her özellik grubu için bir yaprak bulunan tezhipli bir madalyon; her yaprak kendi grubuna götürür.',
  ),
  contents: t('Groups', 'Gruplar'),
  try: t('Try asking', 'Şöyle isteyin'),
  principlesTitle: t('The principles behind every feature', 'Her özelliğin arkasındaki ilkeler'),
  leavesTitle: t('What leaves the phone', 'Telefondan ne çıkar'),
  leavesTo: t('Goes to', 'Nereye'),
  leavesWhat: t('What', 'Ne'),
  leavesWhen: t('When', 'Ne zaman'),
  neverTitle: t('Never sent anywhere', 'Hiçbir yere gönderilmez'),
  notBuiltTitle: t('Deliberately not built', 'Bilerek yapılmayanlar'),
  notBuiltLede: t(
    'Things you might expect that Qutai does not have, and what it does instead.',
    'Belki beklediğiniz ama Qutai’da olmayanlar, ve bunun yerine ne yaptığı.',
  ),
  status: t(
    'Qutai is in development and not released yet. Most of this has been tried in the iOS simulator and the Android emulator and in tests, much of it not yet on a real phone. What the assistant manages also depends on the AI model you choose and on the site.',
    'Qutai geliştirme aşamasında, henüz yayımlanmadı. Buradakilerin çoğu iOS simülatöründe, Android emülatöründe ve testlerde denendi; birçoğu gerçek bir telefonda henüz denenmedi. Asistanın neyi başaracağı seçtiğiniz yapay zekâ modeline ve siteye göre de değişir.',
  ),
  checked: t('Checked against the design record on', 'Tasarım kaydıyla karşılaştırma tarihi:'),
  home: t('Back to the home page', 'Ana sayfaya dön'),
  top: t('Back to the top', 'Başa dön'),
};

export const PRINCIPLES: { icon: IconName; title: Text; body: Text }[] = [
  {
    icon: 'key',
    title: t('Your key, or the optional service', 'Kendi anahtarınız ya da isteğe bağlı hizmet'),
    body: t(
      'With your own key, requests go from the phone straight to the provider you chose. In the official builds you may use Qutai Credits instead, through Qutai’s server, which doesn’t store or log them.',
      'Kendi anahtarınızla istekler telefondan doğrudan seçtiğiniz sağlayıcıya gider. Resmî sürümlerde bunun yerine Qutai Kredileri kullanabilirsiniz; istekler Qutai sunucusundan geçer, orada saklanmaz ve kayda geçirilmez.',
    ),
  },
  {
    icon: 'phone',
    title: t('Your data stays on the phone', 'Verileriniz telefonda kalır'),
    body: t(
      'Tabs, history, bookmarks, conversations, memory, your rules, styles, scripts and apps are stored only on the phone. Moving to another phone uses a password-protected backup file.',
      'Sekmeler, geçmiş, yer imleri, sohbetler, hafıza, kurallarınız, stiller, betikler ve uygulamalar yalnızca telefonda saklanır. Başka bir telefona geçmek için parolalı bir yedek dosyası kullanılır.',
    ),
  },
  {
    icon: 'list',
    title: t('The AI gets labels, never secrets', 'Yapay zekâ etiket görür, sır görmez'),
    body: t(
      'Contacts reach the AI as names, never numbers or addresses; cookies as names, never values; ID numbers and locked memories as labels; password fields as “(filled)”.',
      'Yapay zekâ rehberinizdeki kişilerin numarasını ya da adresini değil, yalnızca adını görür; çerezlerin değerini değil, adını görür. Kimlik numaraları ve kilitlediğiniz bilgiler ona etiket olarak gider; şifre alanlarının yalnızca dolu olduğunu bilir.',
    ),
  },
  {
    icon: 'hand',
    title: t('Nothing irreversible without your yes', 'Geri dönüşü olmayan her adım sizin onayınızla'),
    body: t(
      'Posting, sending, paying, deleting and changing account settings on a site need Qutai’s own dialog, which shows what Qutai itself reads on the page and allows one press of one button.',
      'Bir sitede paylaşım, gönderme, ödeme, silme ya da hesap ayarı değişikliği için Qutai kendi penceresini açar. Pencerede Qutai’ın sayfada kendi okuduğu bilgiler görünür; onay, tek bir düğmeye yalnızca bir kez basma izni verir.',
    ),
  },
  {
    icon: 'shield',
    title: t('Pages are data, not orders', 'Sayfadaki yazı emir değildir'),
    body: t(
      'Text on a web page, in a PDF or a file can never approve anything, trigger a contact lookup or make the assistant change a protective setting. The assistant itself can still be misled by a page, which is why those steps are left to the app and to you.',
      'Bir web sayfasındaki, PDF’teki ya da dosyadaki yazı hiçbir şeyi onaylayamaz, rehberde kişi aratamaz, asistana koruyucu bir ayarı kapattıramaz. Yine de bir sayfa asistanı yanıltabilir; bu adımları uygulamaya ve size bırakmamızın nedeni de bu.',
    ),
  },
  {
    icon: 'sliders',
    title: t('Risky powers start switched off', 'Riskli yetkiler baştan kapalı'),
    body: t(
      'Completing payments, running page scripts, working in the background and putting AI keys in a backup stay off until you turn them on. Imported scripts and apps arrive switched off.',
      'Ödemeyi tamamlamak, sayfalarda betik çalıştırmak, arka planda çalışmak ve AI anahtarlarını yedeğe koymak, siz açmadıkça kapalıdır. İçe aktarılan betikler ve uygulamalar da kapalı gelir.',
    ),
  },
  {
    icon: 'code',
    title: t('Open source, no server needed', 'Açık kaynak, sunucu gerekmez'),
    body: t(
      'The whole app is open source (Apache 2.0). A build from the repository has no account section and never contacts a Qutai server.',
      'Uygulamanın tamamı açık kaynak (Apache 2.0). Depodan derlediğiniz sürümde hesap bölümü yoktur, uygulama Qutai sunucusuna hiç bağlanmaz.',
    ),
  },
  {
    icon: 'incognito',
    title: t('Private means private', 'Gizli mod gerçekten gizli'),
    body: t(
      'Incognito tabs, and any conversation that touched one, are never written to disk, and get no location, calendar, contacts, memory or apps.',
      'Gizli sekmeler ve bunlara dokunan sohbetler diske hiç yazılmaz; orada konum, takvim, rehber, hafıza ve uygulamalar kullanılmaz.',
    ),
  },
];

export const GROUPS: Group[] = [
  {
    id: 'assistant',
    icon: 'hand',
    title: t('The assistant at work', 'İş başında asistan'),
    lede: t(
      'When you ask, it reads the page and uses it the way you would: taps, types, picks, scrolls and opens tabs, one visible step at a time.',
      'İstediğinizde sayfayı okur ve tıpkı sizin gibi kullanır: dokunur, yazar, seçer, kaydırır, sekme açar. Her adımı ekranda görürsünüz.',
    ),
    items: [
      {
        title: t('Reads the page when you ask, and uses it', 'İstediğinizde sayfayı okur ve kullanır'),
        body: t(
          'Fills forms, fixes the errors a form reports, chooses options and moves between pages. It answers in the language you write in.',
          'Form doldurur, formun gösterdiği hataları düzeltir, seçenekleri işaretler, sayfalar arasında gezinir. Siz hangi dilde yazarsanız o dilde yanıt verir.',
        ),
        asks: [
          t('Fill in this form with my details', 'Bu formu bilgilerimle doldur'),
          t('Summarise this page in five points', 'Bu sayfayı beş maddede özetle'),
        ],
      },
      {
        title: t('You see where and what', 'Nerede ve ne yaptığını görürsünüz'),
        body: t(
          'A ring marks the element just before it is tapped or typed into; one line at the bottom says the step (“Tapping the “Add to cart” button”) with Stop next to it. While a task runs, the message field stays closed.',
          'Bir yere dokunmadan ya da yazmadan hemen önce orada bir halka belirir; altta tek satırda o anki adım yazar (“Sepete ekle” düğmesine dokunuluyor), yanında da Durdur düğmesi. Görev sürerken mesaj alanı kapalı kalır.',
        ),
      },
      {
        title: t('Compares across tabs', 'Sekmeler arasında karşılaştırır'),
        body: t(
          'Reads other tabs without switching away and answers with a table, which it can also save as a CSV file.',
          'Diğer sekmelere geçmeden onları da okur ve bir tabloyla yanıt verir; tabloyu CSV dosyası olarak da kaydedebilir.',
        ),
        asks: [
          t('Which of these three is the better deal? Make a table', 'Bu üçünden hangisi daha uygun? Tablo yap'),
        ],
      },
      {
        title: t('Choices as cards', 'Seçenekler kart olarak'),
        body: t(
          'When the assistant finds several things to choose from, such as products, places, hotels or flights, they come as cards: a picture, the title, the price as the page shows it, and the site, which Qutai takes from the card’s own link. The pictures load from the shops’ own servers, without your cookies; in incognito none load until you tap “Show images”.',
          'Asistan aralarından seçim yapacağınız birkaç şey bulduğunda (ürünler, mekânlar, oteller, uçuşlar gibi) bunları kart olarak gösterir: bir resim, başlık, sayfada yazdığı haliyle fiyat ve site; siteyi Qutai kartın kendi bağlantısından alır. Resimler mağazaların kendi sunucularından, çerezleriniz olmadan yüklenir; gizli modda siz “Resimleri göster”e dokunana kadar hiçbiri yüklenmez.',
        ),
        asks: [t('Find me three rain jackets under £80', 'Bana 2.000 TL altında üç yağmurluk bul')],
      },
      {
        title: t('Short questions, answered with a tap', 'Kısa sorular, tek dokunuşla yanıt'),
        body: t(
          'When a task ends with a short question and two to four options, it is asked in a bubble over the page with a button for each answer.',
          'Bir görev kısa bir soru ve iki ila dört seçenekle biterse, soru sayfanın üstünde bir baloncukta, her yanıt için bir düğmeyle sorulur.',
        ),
      },
      {
        title: t('Deep research with sources', 'Kaynaklı derin araştırma'),
        body: t(
          'Searches and reads many pages and PDFs, takes notes and writes a report with its sources under the answer, which you can share as a PDF. It takes a few minutes and costs more than a normal request.',
          'Birçok sayfayı ve PDF’i bulup okur, not alır ve kaynakları altında listelenen bir rapor yazar; raporu PDF olarak paylaşabilirsiniz. Birkaç dakika sürer, normal bir istekten daha pahalıya gelir.',
        ),
        asks: [t('Research the e-bike rules in London', 'İstanbul’daki elektrikli bisiklet kurallarını araştır')],
      },
      {
        title: t('Tab groups share one conversation', 'Bir gruptaki sekmeler aynı sohbette'),
        body: t(
          'Tabs the assistant opens join the current group, so a task’s tabs and its chat stay together; links in an answer open there too.',
          'Asistanın açtığı sekmeler bulunduğunuz gruba eklenir; böylece bir görevin sekmeleri ve sohbeti bir arada durur. Yanıttaki bağlantılar da aynı grupta açılır.',
        ),
      },
      {
        title: t('Saved tasks and reminders', 'Kayıtlı görevler ve hatırlatmalar'),
        body: t(
          'Save a request as a task, run it by name, or get a reminder daily or weekly. Nothing runs while Qutai is closed. On Android, a task can keep working in the background if you turn that on.',
          'Bir isteği görev olarak kaydedin; sonra adıyla çalıştırın ya da her gün veya her hafta size hatırlatılsın. Qutai kapalıyken hiçbir şey çalışmaz. Android’de bu ayarı açarsanız görev arka planda sürebilir.',
        ),
        asks: [t('Run the task called Weekly prices', 'Haftalık fiyatlar görevini çalıştır')],
      },
      {
        title: t('Changes Qutai’s settings for you', 'Qutai’ın ayarlarını sizin için değiştirir'),
        body: t(
          'Appearance and browsing preferences from a fixed list, with a line saying what changed. It can never weaken a protection, such as turning blocking off, and a change you didn’t ask for in the chat, for example one a page suggested, waits for your yes in Qutai’s dialog.',
          'Belirli görünüm ve gezinme ayarlarını değiştirir, neyi değiştirdiğini de bir satırla söyler. Reklam engellemeyi kapatmak gibi bir korumayı ise hiçbir zaman zayıflatamaz; sohbette sizin istemediğiniz bir değişiklik, örneğin bir sayfanın önerdiği, Qutai’ın penceresinde onayınızı bekler.',
        ),
        asks: [t('Turn on dark mode and make the text bigger', 'Koyu temayı aç ve yazıyı büyüt')],
      },
    ],
  },
  {
    id: 'memory',
    icon: 'bookmark',
    title: t('It gets to know you', 'Sizi tanır'),
    lede: t(
      'What you tell it once is kept on the phone and used in later tasks, so each task needs less explaining.',
      'Bir kez söylediğinizi telefonda saklar ve sonraki görevlerde kullanır; zamanla daha az anlatmanız gerekir.',
    ),
    items: [
      {
        title: t('Memory in categories', 'Konulara ayrılmış hafıza'),
        body: t(
          'Identity and contact, addresses, shopping, travel, food, budget and general. See, edit, search and delete it in Settings, and lock any memory so the AI sees only a label. Passwords, card numbers, one-time codes and IBANs are never kept, even if you ask.',
          'Kimlik ve iletişim, adresler, alışveriş, seyahat, yemek, bütçe ve genel. Hepsini Ayarlar’da görebilir, düzenleyebilir, arayabilir, silebilirsiniz; kilitlediğiniz bir bilginin yalnızca etiketi yapay zekâya gider. Şifre, kart numarası, tek kullanımlık kod ve IBAN siz isteseniz bile saklanmaz.',
        ),
        asks: [
          t('Remember that I’m vegetarian', 'Vejetaryen olduğumu hatırla'),
          t('My delivery address is 12 Camden Road, London NW1', 'Teslimat adresim Moda Cd. 12, Kadıköy'),
        ],
      },
      {
        title: t('Tell it about yourself', 'Kendinizden bahsedin'),
        body: t(
          'In setup, choose how: speak, type, or let Qutai ask you four short questions. When you speak or type, one AI request turns it into notes and Qutai asks at most three follow-ups; “Use my location” fills in your city, keeping only the city. You review every note before anything is saved, and allergies and health can be hidden from the AI.',
          'Kurulumda nasıl anlatacağınızı seçin: konuşarak, yazarak ya da Qutai’ın soracağı dört kısa soruyu yanıtlayarak. Konuşur ya da yazarsanız Qutai bunu tek bir yapay zekâ isteğiyle notlara çevirir, en fazla üç soru daha sorar; “Konumumu kullan” şehrinizi doldurur ve yalnızca şehri saklar. Kaydetmeden önce her notu siz gözden geçirirsiniz; alerji ve sağlık bilgilerinizi yapay zekâdan gizleyebilirsiniz.',
        ),
        asks: [
          t(
            'I’m Emma, I live in Camden, I’m allergic to peanuts and I prefer short answers',
            'Ben Ayşe, Kadıköy’de oturuyorum, yer fıstığına alerjim var, kısa yanıtları severim',
          ),
        ],
      },
      {
        title: t('Your details, asked per site', 'Bilgileriniz her site için ayrıca sorulur'),
        body: t(
          'Before your remembered name, address or phone go into a site, Qutai asks whether that site may have them: once, always or never.',
          'Hafızadaki adınız, adresiniz ya da telefon numaranız bir siteye yazılmadan önce Qutai size sorar: bu siteye bir kez mi, her zaman mı, yoksa hiç mi?',
        ),
        asks: [t('Order dinner for two from this restaurant', 'Bu restorandan iki kişilik akşam yemeği sipariş et')],
      },
      {
        title: t('Custom instructions', 'Özel talimatlar'),
        body: t(
          'How you like answers, followed in every request. Setup starts you with short, to-the-point answers; change that line whenever you like.',
          'Yanıtları nasıl istediğinizi bir kez yazın; her istekte buna uyar. Kurulum, kısa ve öz yanıtlarla başlatır; o satırı istediğiniz zaman değiştirebilirsiniz.',
        ),
      },
    ],
  },
  {
    id: 'approvals',
    icon: 'shield',
    title: t('Asks before it matters', 'Önemli adımda sorar'),
    lede: t(
      'The steps that can’t be undone are decided by the app, not by the AI model: Qutai’s own dialogs, which a page can neither draw nor answer.',
      'Geri alınamayan adımlara yapay zekâ değil, uygulama karar verir: bunlar Qutai’ın kendi pencerelerinde sorulur; bir sayfa bu pencereleri ne taklit edebilir ne de yanıtlayabilir.',
    ),
    items: [
      {
        title: t('A level for every site', 'Her siteye ayrı izin'),
        body: t(
          'Always allow, ask every time, read only or blocked; a site without its own level follows “Ask before every action”.',
          'Her zaman izin ver, her seferinde sor, yalnızca oku ya da engelle. Ayrı bir ayar yapmadığınız siteler “Her işlemden önce sor” ayarına uyar.',
        ),
        asks: [t('Only read this site, don’t click anything', 'Bu sitede sadece oku, hiçbir şeye tıklama')],
      },
      {
        title: t('Posting and sending with your approval', 'Onayınızla paylaşma ve gönderme'),
        body: t(
          'Comments, replies, reviews, contact forms and messages on a site: Qutai reads the exact text in the box and shows it with the button it will press once. If the text changes, nothing is pressed.',
          'Yorum, yanıt, değerlendirme, iletişim formu ya da bir sitedeki mesaj: Qutai kutudaki metni kendisi okur, basacağı düğmeyle birlikte size gösterir ve onayınızla bir kez basar. Metin bu arada değişirse hiçbir şeye basmaz.',
        ),
        asks: [t('Comment “Great video, thanks!” on this video', 'Bu videoya “Harika video, teşekkürler!” diye yorum yaz')],
      },
      {
        title: t('Shopping, up to the payment', 'Ödemeye kadar alışveriş'),
        body: t(
          'The assistant fills the cart and the checkout, then you choose who pays: press the last button yourself, or turn on “Let the assistant complete payments” and approve each payment in Qutai’s window, which shows the site, the total on the page, the order and the payment method every time. A subscribe button with a price (“Subscribe – £4.99 a month”) counts as a payment too. There is no spending limit.',
          'Asistan sepeti ve ödeme formunu doldurur; ödemeyi kimin yapacağına siz karar verirsiniz. Son düğmeye kendiniz basarsınız ya da “Asistan ödemeleri tamamlasın”ı açarsınız; o zaman her ödeme, siteyi, sayfadaki tutarı, siparişi ve ödeme yöntemini gösteren Qutai penceresinde onayınızı bekler. “Abone ol – aylık 149 TL” gibi fiyatlı bir abonelik düğmesi de ödeme sayılır. Harcama sınırı yoktur.',
        ),
        asks: [
          t('Put these in the cart and go to checkout', 'Bunları sepete ekle, ödeme adımına geç'),
          t('Order this and pay with the card saved on the site', 'Bunu sipariş et, sitede kayıtlı kartla öde'),
        ],
      },
      {
        title: t('Deleting and account changes', 'Silme ve hesap değişiklikleri'),
        body: t(
          'Deleting something on a site, or changing its account or security settings, gets the same kind of approval.',
          'Bir sitede bir şeyi silmek ya da hesap veya güvenlik ayarlarını değiştirmek de aynı şekilde onayınızı bekler.',
        ),
      },
      {
        title: t('Secrets stay with you', 'Sırlar sizde kalır'),
        body: t(
          'The app refuses to type card numbers and to type into password, one-time-code, card and security-code fields. Sign-ins and bank checks (3-D Secure) are left to you.',
          'Qutai kart numarası yazmaz; şifre, tek kullanımlık kod, kart ve güvenlik kodu alanlarına hiçbir şey yazmaz. Siteye giriş ve banka doğrulaması (3-D Secure) size kalır.',
        ),
      },
      {
        title: t('Tested against hidden instructions', 'Gizli talimatlara karşı test edilir'),
        body: t(
          'How well the assistant resists instructions hidden in pages is measured with a test set of 35 trap pages, run through the app’s real steps and checks. A test is not a guarantee, which is why the steps that matter are decided by the app. Qutai’s own script on the page runs under a secret name that the page can’t replace or tamper with.',
          'Asistanın sayfalara gizlenmiş talimatlara ne kadar direndiği, uygulamanın gerçek adımları ve denetimlerinden geçen 35 tuzak sayfalık bir test setiyle ölçülür. Test bir garanti değildir; önemli adımlara uygulamanın karar vermesinin nedeni de bu. Qutai’ın sayfadaki kendi betiği, sayfanın değiştiremeyeceği ya da kurcalayamayacağı gizli bir adla çalışır.',
        ),
      },
      {
        title: t('When a check fails, nothing happens', 'Bir denetim tutmazsa hiçbir şey yapılmaz'),
        body: t(
          'Every step the assistant takes passes the same ordered set of checks. If Qutai can’t read what a press would do, or a page interferes with its checks before an approval, the step is refused rather than guessed.',
          'Asistanın attığı her adım aynı sıralı denetimlerden geçer. Qutai bir düğmenin ne yapacağını okuyamazsa ya da bir sayfa onaydan önceki denetimlere karışırsa adım tahminle atılmaz, reddedilir.',
        ),
      },
    ],
  },
  {
    id: 'phone',
    icon: 'call',
    title: t('Your phone, within reach', 'Telefonunuz elinizin altında'),
    lede: t(
      'Calendar, reminders, calls and messages, prepared by the assistant and finished by you.',
      'Takvim, hatırlatıcılar, aramalar ve mesajlar: asistan hazırlar, son adımı siz atarsınız.',
    ),
    items: [
      {
        title: t('Calendar and reminders', 'Takvim ve hatırlatıcılar'),
        body: t(
          'Adds events and reminders after showing you the details, reads your calendar when you allow it, and schedules a notification.',
          'Ayrıntıları gösterip onayınızı aldıktan sonra etkinlik ve hatırlatıcı ekler; izin verirseniz takviminizi okur, bildirim kurar.',
        ),
        asks: [
          t('Add this concert to my calendar', 'Bu konseri takvimime ekle'),
          t('Am I free on Friday evening?', 'Cuma akşamı boş muyum?'),
        ],
      },
      {
        title: t('Calls and messages you send', 'Aramayı ve mesajı siz gönderirsiniz'),
        body: t(
          'A call is a Call button; texts, WhatsApp messages and emails are drafts. The assistant never sends a message by itself.',
          'Arama için bir Ara düğmesi çıkar; SMS, WhatsApp ve e-posta taslak olarak hazırlanır. Asistan hiçbir mesajı kendi başına göndermez.',
        ),
        asks: [t('Book a table here, or give me their number', 'Burada masa ayırt ya da numaralarını ver')],
      },
      {
        title: t('Contacts by name', 'Rehberden adıyla bulur'),
        body: t(
          'Only a name you said is looked up, on the phone. The AI sees names and labels such as “mobile”, never numbers or addresses; if several match, you pick in Qutai’s own list. Off in incognito.',
          'Yalnızca söylediğiniz ad aranır, o da telefonda. Yapay zekâ adları ve “cep” gibi etiketleri görür, numaraları ve adresleri hiçbir zaman görmez. Birden fazla kişi çıkarsa Qutai’ın kendi listesinden siz seçersiniz. Gizli modda kapalıdır.',
        ),
        asks: [
          t('Call James', 'Ahmet’i ara'),
          t('WhatsApp Emma that I’ll be ten minutes late', 'Ayşe’ye WhatsApp’tan on dakika gecikeceğimi yaz'),
          t('Email this page to Mr Clarke', 'Bu sayfayı Mehmet Bey’e e-postayla gönder'),
        ],
      },
      {
        title: t('Location when it helps', 'Gerektiğinde konum'),
        body: t(
          'With your permission, for “near me” requests; never in incognito.',
          '“Yakınımda” gibi istekler için, izin verirseniz; gizli modda hiçbir zaman.',
        ),
        asks: [t('Find a pharmacy open near me', 'Yakınımda açık bir eczane bul')],
      },
    ],
  },
  {
    id: 'web',
    icon: 'sliders',
    title: t('Make the web yours', 'Web’i kendinize göre ayarlayın'),
    lede: t(
      'Blocking, your own rules, styles, a page’s cookies and, if you allow them, small scripts.',
      'Reklam engelleme, kendi kurallarınız, stiller, sayfanın çerezleri ve izin verirseniz küçük betikler.',
    ),
    items: [
      {
        title: t('Ad and tracker blocking', 'Reklam ve izleyici engelleme'),
        body: t(
          'On by default, from filter lists the phone downloads (EasyList, EasyPrivacy, AdGuard Turkish, regional lists or any list by address). The assistant can hide a leftover ad box or block a domain after you approve; the rule goes to My rules.',
          'Baştan açık gelir; telefonun indirdiği filtre listeleriyle çalışır (EasyList, EasyPrivacy, AdGuard Turkish, bölgesel listeler ya da adresiyle eklediğiniz bir liste). Boş kalan bir reklam kutusunu gizlemesini ya da bir alan adını engellemesini asistandan isteyebilirsiniz; onaylarsanız kural Kendi kurallarım’a eklenir.',
        ),
        asks: [t('Hide this empty gap at the top', 'Üstteki bu boş alanı gizle')],
      },
      {
        title: t('Video ads, if you want', 'İsterseniz video reklamları'),
        body: t(
          'An optional switch, off by default, in Settings › Privacy and security and in setup’s protection step. It removes the ads that play before and during videos on supported video sites, and can stop working for a while when a site changes.',
          'Ayarlar › Gizlilik ve güvenlik’te ve kurulumun koruma adımında, baştan kapalı gelen isteğe bağlı bir anahtar. Desteklenen video sitelerinde videolardan önce ve video sırasında çıkan reklamları kaldırır; bir site değiştiğinde bir süre çalışmayabilir.',
        ),
      },
      {
        title: t('Your own styles', 'Kendi stilleriniz'),
        body: t(
          'The assistant proposes the change; you approve, try it and keep it for the site. Styles can’t load anything from the internet, and “Styles off for this page” is always one tap away.',
          'Asistan değişikliği önerir; siz onaylayıp denersiniz, beğenirseniz o site için saklarsınız. Stiller internetten hiçbir şey yükleyemez; bir şey bozulursa “Bu sayfada stilleri kapat” hep bir dokunuş uzağınızda.',
        ),
        asks: [
          t('Make the links red on this site', 'Bu sitede bağlantıları kırmızı yap'),
          t('Bigger text and a dark background here', 'Burada daha büyük yazı ve koyu zemin'),
        ],
      },
      {
        title: t('A page’s cookies', 'Sayfanın çerezleri'),
        body: t(
          'A list by site, HttpOnly cookies included, with names and settings. Values never go to the AI; you can show or delete them on screen.',
          'HttpOnly olanlar dahil, siteye göre gruplanmış bir liste; her çerezin adı ve ayarları. Değerler yapay zekâya hiç gitmez; isterseniz ekranda görüp silebilirsiniz.',
        ),
        asks: [t('Which cookies does this page have?', 'Bu sayfada hangi çerezler var?')],
      },
      {
        title: t('Scripts on pages, if you allow them', 'İzin verirseniz sayfalarda betik çalıştırır'),
        body: t(
          'Off by default. Questions that only read run on a sealed copy of the page with no internet or sign-in. A script on the live page needs your approval with its code, is refused on sign-in, payment and bank pages, and can then do what the site’s own code can do.',
          'Baştan kapalıdır. Yalnızca bilgi okuyan sorular, sayfanın internete ve oturumunuza bağlı olmayan kapalı bir kopyasında çalışır. Canlı sayfada çalışacak bir betiğin kodunu görüp onay verirsiniz; giriş, ödeme ve banka sayfalarında betik çalıştırılmaz. Onayladığınız betik, sitenin kendi kodunun yapabildiği her şeyi yapabilir.',
        ),
        asks: [
          t('How many links are on this page?', 'Bu sayfada kaç bağlantı var?'),
          t('Collect this table into a list', 'Bu tabloyu bir listeye topla'),
        ],
      },
      {
        title: t('Camera, microphone and location per site', 'Her site için kamera, mikrofon ve konum izni'),
        body: t(
          'A site asks; you allow once, always or never. Only the site in the address bar can ask, and only over https.',
          'Site izin ister; siz bir kez, her zaman ya da hiçbir zaman dersiniz. Bunu yalnızca adres çubuğundaki site ve yalnızca https üzerinden isteyebilir.',
        ),
      },
    ],
  },
  {
    id: 'apps',
    icon: 'apps',
    title: t('Apps inside Qutai', 'Qutai içinde uygulamalar'),
    lede: t(
      'Ask for a small app in your own words; the assistant writes it, and it lives in My apps on the new tab page.',
      'Kendi sözlerinizle küçük bir uygulama isteyin; asistan yazar, uygulama da yeni sekme sayfasında, Uygulamalarım bölümünde yerini alır.',
    ),
    items: [
      {
        title: t('Built, checked and fixed by the assistant', 'Asistan yazar, dener, düzeltir'),
        body: t(
          'It writes the app, opens a preview, reads its errors and fixes them. Every change is a new version, so you can go back; an error inside the app offers “Ask Qutai to fix this”. Writing an app is an ordinary assistant request; running it costs nothing.',
          'Uygulamayı yazar, önizlemesini açar, hatalarını görüp düzeltir. Her değişiklik yeni bir sürüm olur, istediğinizde eskisine dönersiniz; uygulamada bir hata çıkarsa “Qutai bunu düzeltsin” demeniz yeter. Uygulama yazdırmak sıradan bir asistan isteğidir; kullanmak ise ücretsizdir.',
        ),
        asks: [
          t('Build me an app where I can keep my notes', 'Notlarımı tutabileceğim bir uygulama yap'),
          t('A tracker for how much water I drink each day', 'Her gün ne kadar su içtiğimi takip eden bir uygulama'),
          t('Add a search box to my notes app', 'Not uygulamama bir arama kutusu ekle'),
        ],
      },
      {
        title: t('Sealed off from everything else', 'Tarayıcıdan ve birbirinden ayrı'),
        body: t(
          'Each app runs in its own view: no internet, no sites’ cookies or sign-ins, no other app’s data. Its data stays on the phone, up to 5 MB per app; reading the clipboard asks once.',
          'Her uygulama kendi alanında çalışır: internete, sitelerin çerezlerine ya da oturumlarına, başka uygulamaların verisine erişemez. Verileri telefonda kalır, uygulama başına en fazla 5 MB; panoyu okumak için bir kez izin ister.',
        ),
      },
      {
        title: t('Share as a file, kept in your backup', 'Dosyayla paylaşılır, yedeğe girer'),
        body: t(
          'Export an app as a file and import it on another phone; an imported app stays off until you look at it and approve it. Apps go into your encrypted backup. There is no app store or gallery.',
          'Bir uygulamayı dosya olarak dışa aktarıp başka bir telefona alabilirsiniz; içe aktarılan uygulama siz inceleyip onaylayana kadar kapalı kalır. Uygulamalar şifreli yedeğinize de girer. Bir uygulama mağazası ya da galerisi yok.',
        ),
      },
    ],
  },
  {
    id: 'media',
    icon: 'mic',
    title: t('Read, listen, speak, edit', 'Okuyun, dinleyin, konuşun, düzenleyin'),
    lede: t(
      'Reader mode, read-aloud and voice input with the phone’s own speech services, and image editing on the phone.',
      'Okuma modu; telefonun kendi konuşma hizmetleriyle sesli okuma ve sesle yazma; telefonda görsel düzenleme.',
    ),
    items: [
      {
        title: t('Reader mode and read aloud', 'Okuma modu ve sesli okuma'),
        body: t(
          'Only the article, in light, dark or sepia, serif or sans, with easier-reading spacing. Read aloud uses the language the text is written in and the most natural voice installed on the phone.',
          'Sayfada yalnızca makale kalır; açık, koyu ya da sepya zemin, serifli ya da serifsiz yazı, rahat okunan satır aralığı. Sesli okuma metni yazıldığı dilde, telefonda yüklü en doğal sesle okur.',
        ),
        asks: [t('Read this article aloud', 'Bu makaleyi sesli oku')],
      },
      {
        title: t('Talk instead of typing', 'Yazmak yerine konuşun'),
        body: t(
          'Hold the microphone, or hold the Q button without opening the panel. Speech becomes text on the phone when it can; otherwise Apple’s or Google’s service hears it, after one question. No audio goes to Qutai or the AI.',
          'Mikrofona basılı tutun ya da paneli hiç açmadan Q düğmesine. Konuşmanız mümkünse telefonda yazıya çevrilir; değilse, bir kez sorduktan sonra Apple’ın ya da Google’ın hizmeti kullanılır. Ses kaydı ne Qutai’a ne de yapay zekâya gider.',
        ),
      },
      {
        title: t('Edit images on the phone', 'Görselleri telefonda düzenleyin'),
        body: t(
          'Crop, rotate, resize, set a file size, and apply greyscale, sepia, invert, auto enhance, brightness, contrast, saturation, warmth, sharpen or blur, by asking or with presets and sliders.',
          'Kırpın, döndürün, boyutunu ve dosya boyutunu ayarlayın; siyah-beyaz, sepya, negatif, otomatik iyileştirme, parlaklık, kontrast, doygunluk, sıcaklık, keskinlik ya da bulanıklık uygulayın. Asistana söyleyerek ya da hazır ayarlar ve kaydırıcılarla.',
        ),
        asks: [
          t('Make it square and under 1 MB', 'Kare yap ve 1 MB’ın altına indir'),
          t('Greyscale and a little sharper', 'Siyah-beyaz ve biraz daha keskin'),
        ],
      },
      {
        title: t('Background playback', 'Arka planda çalma'),
        body: t(
          'Sound keeps playing with the screen locked; on Android a video can shrink to picture-in-picture. Some video sites still stop it.',
          'Ekran kilitliyken de ses çalmaya devam eder; Android’de video küçük bir pencerede oynamaya devam edebilir. Bazı video siteleri yine de durdurur.',
        ),
      },
      {
        title: t('PDF, screenshots and downloads', 'PDF, ekran görüntüsü ve indirmeler'),
        body: t(
          'Save a page as PDF or a full-page screenshot; downloads with pause and resume, and a warning before risky files.',
          'Sayfayı PDF ya da tam sayfa ekran görüntüsü olarak kaydedin. İndirmeleri duraklatıp sürdürebilirsiniz; riskli bir dosyadan önce uyarı gelir.',
        ),
        asks: [t('Save this page as a PDF', 'Bu sayfayı PDF olarak kaydet')],
      },
    ],
  },
  {
    id: 'privacy',
    icon: 'incognito',
    title: t('Your data, on your phone', 'Verileriniz, telefonunuzda'),
    lede: t(
      'What is kept, what is sent, and how you can see it.',
      'Neyin saklandığı, neyin gönderildiği ve bunları nasıl görebileceğiniz.',
    ),
    items: [
      {
        title: t('What was sent to the AI', 'Yapay zekâya gönderilenler'),
        body: t(
          'A list of every request: when, which provider and model (with Qutai Credits, just “Qutai Credits”), which site and what went with it. Each answer shows its tokens and, where the price is known, roughly what it cost; with Qutai Credits, the credits it was charged.',
          'Gönderilen her istek burada listelenir: ne zaman, hangi sağlayıcıya ve modele (Qutai Kredileri’nde yalnızca “Qutai Kredileri”), hangi siteyle ilgili, yanında neler gitti. Her yanıtın altında kaç token harcandığı ve fiyat biliniyorsa yaklaşık maliyeti yazar; Qutai Kredileri’nde ise düşülen kredi.',
        ),
      },
      {
        title: t('Incognito', 'Gizli mod'),
        body: t(
          'Incognito tabs keep their own cookies and site data and save nothing; the assistant still works there, with fewer powers. The incognito tabs can be locked with your face or fingerprint.',
          'Gizli sekmelerin kendi çerezleri ve site verileri vardır, hiçbir şey kaydedilmez; asistan orada daha kısıtlı çalışır. Gizli sekmeleri yüz ya da parmak izinizle kilitleyebilirsiniz.',
        ),
      },
      {
        title: t('Encrypted backup', 'Şifreli yedek'),
        body: t(
          'No sync: export everything to one password-protected file and import it on another phone, merging or replacing.',
          'Eşitleme yok: her şeyi parolalı tek bir dosyaya aktarırsınız, başka bir telefonda da mevcut verilerle birleştirerek ya da onların yerine geri yüklersiniz.',
        ),
      },
    ],
  },
  {
    id: 'ai',
    icon: 'key',
    title: t('Your AI, your choice', 'Yapay zekânız, seçiminiz'),
    lede: t(
      'Bring your own key, or, in the official builds, use the optional Qutai service.',
      'Kendi anahtarınızı kullanın ya da resmî sürümlerde isteğe bağlı Qutai hizmetini seçin.',
    ),
    items: [
      {
        title: t('Five ways with your own key', 'Kendi anahtarınızla beş seçenek'),
        body: t(
          'Anthropic, OpenAI, Google Gemini, OpenRouter or your own OpenAI-compatible server (Ollama, LM Studio, vLLM), with a connection test. Keys stay in the phone’s secure storage; choose the model per conversation.',
          'Anthropic, OpenAI, Google Gemini, OpenRouter ya da kendi OpenAI uyumlu sunucunuz (Ollama, LM Studio, vLLM); bağlantıyı tek dokunuşla test edebilirsiniz. Anahtarlar telefonun güvenli deposunda durur; modeli her sohbet için ayrı seçebilirsiniz.',
        ),
        asks: [t('Use Gemini for this chat', 'Bu sohbette Gemini kullan')],
      },
      {
        title: t('Qutai Credits', 'Qutai Kredileri'),
        body: t(
          'In the official builds: no key, and no tier or model to choose; Qutai picks the model, and the app doesn’t show which one answered. Requests pass through Qutai’s server to Anthropic; the server keeps the account, the credits and, per request, the model, tokens and cost; never your messages, pages or memory. Buying credits in the App Store and Google Play is being prepared.',
          'Resmî sürümlerde: anahtar da yok, seçmeniz gereken bir paket ya da model de; modeli Qutai belirler, uygulama hangi modelin yanıt verdiğini göstermez. İstekler Qutai sunucusu üzerinden Anthropic’e gider; sunucu hesabı, kredileri ve her istek için modeli, token sayısını ve tutarı tutar; mesajlarınızı, sayfaları ya da hafızanızı asla. App Store ve Google Play’den kredi satın alma hazırlanıyor.',
        ),
      },
      {
        title: t('A Qutai account, if you want one', 'İsterseniz bir Qutai hesabı'),
        body: t(
          'Sign in with Apple, Google or an email code; the account screen shows each method with its address (Apple’s private relay as “hidden email”). Sign out of every device or delete the account, which deletes your data.',
          'Apple, Google ya da e-postanıza gelen kodla giriş yapın; hesap ekranı her giriş yöntemini adresiyle gösterir (Apple’ın gizli adresi “gizli e-posta” olarak). Tüm cihazlarda oturumu kapatabilir ya da hesabı silebilirsiniz; hesapla birlikte verileriniz de silinir.',
        ),
      },
      {
        title: t('Backup in your account', 'Hesabınızda yedek'),
        body: t(
          'The same encrypted backup file, kept in your account (the newest three) and restored on any phone; after you sign in, Qutai offers to restore the newest one. Your backup password never leaves the phone, and nobody, not even Qutai, can recover it.',
          'Aynı şifreli yedek dosyası hesabınızda da saklanır (en yeni üçü) ve istediğiniz telefonda geri yüklenir; giriş yaptığınızda Qutai en yenisini geri yüklemeyi önerir. Yedek parolanız telefondan hiç çıkmaz; unutursanız Qutai dahil kimse kurtaramaz.',
        ),
      },
    ],
  },
  {
    id: 'browser',
    icon: 'tabs',
    title: t('And a complete browser', 'Ve eksiksiz bir tarayıcı'),
    lede: t(
      'Everything you expect from a browser, in ten languages, on phones and tablets.',
      'Bir tarayıcıdan beklediğiniz her şey; on dilde, telefonda da tablette de.',
    ),
    items: [
      {
        title: t('Tabs, groups and the address bar', 'Sekmeler, gruplar ve adres çubuğu'),
        body: t(
          'Idle tabs sleep to save memory; swipe on the address bar to switch tabs, and put the bar at the top or the bottom. It slides away while you scroll down and comes back on a small scroll up (or keep it always visible), and it shows the site’s domain clearly, with the rest of the address subdued.',
          'Kullanmadığınız sekmeler bellek harcamasın diye uykuya geçer. Sekmeler arasında geçmek için adres çubuğunu kaydırın; çubuğu ekranın üstüne ya da altına alabilirsiniz. Aşağı kaydırırken çubuk gizlenir, biraz yukarı kaydırınca geri gelir (isterseniz hep görünür kalır); sitenin alan adını belirgin, adresin geri kalanını soluk gösterir.',
        ),
      },
      {
        title: t('Clear feedback while a page loads', 'Sayfa yüklenirken ne olduğunu bilirsiniz'),
        body: t(
          'A progress line starts at once; after 4 seconds you hear that the site isn’t answering yet, with Stop, and after 25 seconds that it is very slow, with Try again. Being offline is said at once, and tabs that failed offline reload when the connection returns. The address bar keeps showing the current page until the new site answers, so a slow page can’t pass itself off as another; windows a page opens later appear behind your tab with a notice, and a tab that wakes up returns to where you were. A line names the site that is opening while it answers. Reloading or going back to a form you sent asks before sending it again, since that could repeat an order. A page that stops working reloads once; if it stops again, you get a “This page stopped working” screen with Reload instead of a blank tab.',
          'İlerleme çizgisi hemen başlar; 4 saniye sonra sitenin henüz yanıt vermediği söylenir ve Durdur çıkar, 25 saniye sonra da çok yavaş olduğu söylenir ve Tekrar dene çıkar. İnternet yoksa bu hemen söylenir; bağlantı yokken açılamayan sekmeler bağlantı gelince yeniden yüklenir. Yeni site yanıt verene kadar adres çubuğu bulunduğunuz sayfayı göstermeye devam eder, böylece yavaş bir sayfa kendini başka bir site gibi gösteremez. Bir sayfanın sonradan açtığı pencereler bir uyarıyla sekmenizin arkasında açılır; uyuyan bir sekme uyanınca kaldığınız yere döner. Site yanıt verene kadar bir satır hangi sitenin açıldığını söyler. Gönderdiğiniz bir formun sonucunu yenilediğinizde ya da ona geri döndüğünüzde, bir siparişi yineleyebileceği için formu yeniden göndermeden önce sorar. Çalışmayı durduran bir sayfa bir kez kendiliğinden yenilenir; yine durursa boş bir sekme yerine Yeniden yükle düğmesiyle “Bu sayfa çalışmayı durdurdu” ekranı çıkar.',
        ),
      },
      {
        title: t('Bookmarks and history', 'Yer imleri ve geçmiş'),
        body: t(
          'Bookmarks in folders, imported from and exported to the file Chrome, Firefox, Safari or Edge use; the assistant can search your history.',
          'Yer imlerinizi klasörlere ayırın; Chrome, Firefox, Safari ya da Edge’den aldığınız dosyayı içe aktarın, aynı biçimde dışa verin. Asistan geçmişinizde de arama yapabilir.',
        ),
        asks: [t('Find the recipe page I read last week', 'Geçen hafta okuduğum yemek tarifi sayfasını bul')],
      },
      {
        title: t('Ten languages', 'On dil'),
        body: t(
          'English, Turkish, German, Spanish, Brazilian Portuguese, French, Japanese, Korean, Russian and Indonesian, following the phone or chosen in Settings. The privacy policy and terms are available in all ten.',
          'Türkçe, İngilizce, Almanca, İspanyolca, Brezilya Portekizcesi, Fransızca, Japonca, Korece, Rusça ve Endonezce; telefonun diline uyar ya da Ayarlar’dan seçilir. Gizlilik politikası ve kullanım koşulları da on dilin hepsinde var.',
        ),
      },
      {
        title: t('Accessible', 'Herkes için erişilebilir'),
        body: t(
          'Labels for screen readers, the phone’s Reduce motion, text size from 50% to 200%, and zoom on pages that forbid it.',
          'Ekran okuyucular için etiketler, telefonun Hareketi azalt ayarına uyum, %50 ile %200 arası yazı boyutu ve yakınlaştırmayı engelleyen sayfalarda bile yakınlaştırma.',
        ),
      },
      {
        title: t('Phones, tablets and landscape', 'Telefon, tablet ve yatay ekran'),
        body: t(
          'Turning the device keeps tabs, pages and a running task as they were; on iPad, Split View and Stage Manager at any size.',
          'Cihazı yan çevirdiğinizde sekmeler, sayfalar ve süren görev olduğu gibi kalır; iPad’de her pencere boyutunda Split View ve Stage Manager çalışır.',
        ),
      },
      {
        title: t('Opening from other apps', 'Diğer uygulamalardan Qutai’a'),
        body: t(
          'Share a link or text to Qutai (Android for now) or use qutai:// links from shortcuts. On Android, make Qutai your default browser from Settings › Search. On Android, the launcher shortcuts (New tab, Incognito tab, Ask Qutai, Scan QR code) follow Qutai’s language.',
          'Bir bağlantıyı ya da metni Qutai’a gönderin (şimdilik Android’de) ya da Kestirmeler’den qutai:// bağlantılarıyla açın. Android’de Qutai’ı varsayılan tarayıcınız yapmak için Ayarlar › Arama’ya gidin. Android’de ana ekran kısayolları (Yeni sekme, Gizli sekme, Qutai’a sor, QR kodu tara) Qutai’ın diline uyar.',
        ),
      },
    ],
  },
];

export const LEAVES: { to: Text; what: Text; when: Text }[] = [
  {
    to: t('The AI provider you chose', 'Seçtiğiniz yapay zekâ sağlayıcısı'),
    what: t(
      'The conversation, the page text and screenshots the assistant reads for a task, memory (locked items as labels), your instructions, tool results',
      'Sohbet, asistanın görev için okuduğu sayfa metni ve ekran görüntüleri, hafıza (kilitli bilgiler etiket olarak), talimatlarınız, araç sonuçları',
    ),
    when: t('With each assistant request', 'Her asistan isteğinde'),
  },
  {
    to: t('Qutai’s server (official builds)', 'Qutai sunucusu (resmî sürümler)'),
    what: t(
      'Sign-in details; with Qutai Credits, the AI requests on their way, not stored or logged; your encrypted backup file; the app’s version and build',
      'Giriş bilgileri; Qutai Kredileri kullanıyorsanız yapay zekâya giden istekler (saklanmaz, kayda geçirilmez); şifreli yedek dosyanız; uygulamanın sürümü ve derleme numarası',
    ),
    when: t('Only when signed in and using those features', 'Yalnızca giriş yaptıysanız ve bu özellikleri kullanıyorsanız'),
  },
  {
    to: t('Your search engine', 'Arama motorunuz'),
    what: t('Suggestions as you type in the address bar', 'Adres çubuğuna yazarken öneriler'),
    when: t('Not in incognito tabs', 'Gizli sekmelerde değil'),
  },
  {
    to: t('Apple or Google', 'Apple ya da Google'),
    what: t(
      'The address lookup for “Use my location”; speech, when the phone can’t recognise it itself',
      '“Konumumu kullan” dediğinizde adres sorgusu; telefon sesinizi kendisi yazıya çeviremediğinde konuşmanız',
    ),
    when: t('After a one-time question; never in incognito', 'Bir kez sorulduktan sonra; gizli modda asla'),
  },
  {
    to: t('Sites shown on option cards', 'Seçenek kartlarındaki siteler'),
    what: t(
      'Requests for the cards’ pictures, from the phone, without cookies or a referrer',
      'Kartlardaki resimlerin istekleri; telefondan, çerez ve yönlendiren adres olmadan',
    ),
    when: t('When the assistant shows cards; in incognito only after “Show images”', 'Asistan kart gösterdiğinde; gizli modda yalnızca “Resimleri göster”den sonra'),
  },
  {
    to: t('Filter list publishers', 'Filtre listesi yayıncıları'),
    what: t('Downloads of the blocking lists', 'Engelleme listelerinin indirilmesi'),
    when: t('While blocking is on', 'Engelleme açıkken'),
  },
  {
    to: t('Web sites', 'Web siteleri'),
    what: t(
      'What you or the assistant type and send, after the approvals above',
      'Sizin ya da asistanın yazıp gönderdikleri; yukarıdaki onaylardan sonra',
    ),
    when: t('As you browse', 'Gezindikçe'),
  },
];

export const NEVER = t(
  'Contact numbers and addresses to the AI, cookie values, your backup password, voice audio to Qutai or the AI provider, incognito data to disk.',
  'Kişilerin numaraları ve adresleri yapay zekâya, çerez değerleri, yedek parolanız, ses kaydı Qutai’a ya da yapay zekâ sağlayıcısına, gizli mod verileri diske.',
);

export const NOT_BUILT: Text[] = [
  t(
    'No connecting to sites while you type an address, which would tell a site what you are typing before you choose it. For now, no harmful-site lookup service such as Safe Browsing either, which would send the addresses you open to another company.',
    'Adres yazarken sitelere önceden bağlanma yok; bu, siz seçmeden önce ne yazdığınızı o siteye bildirirdi. Şimdilik Safe Browsing gibi zararlı site sorgulama hizmeti de yok; açtığınız adresleri başka bir şirkete gönderirdi.',
  ),
  t(
    'No password manager of its own: the phone’s system autofill works in the browser.',
    'Kendine ait şifre yöneticisi yok: telefonun sistem otomatik doldurması tarayıcıda çalışır.',
  ),
  t('No browser extensions.', 'Tarayıcı eklentisi yok.'),
  t(
    'No live sync between devices: an encrypted backup file instead, which the official builds can keep in your account.',
    'Cihazlar arası canlı eşitleme yok: yerine şifreli yedek dosyası; resmî sürümler bunu hesabınızda saklayabilir.',
  ),
  t(
    'Messages are never sent by the assistant on its own: texts, WhatsApp and email are drafts you send.',
    'Asistan hiçbir mesajı kendi başına göndermez: SMS, WhatsApp ve e-posta sizin gönderdiğiniz taslaklardır.',
  ),
  t(
    'No “undo” for actions on the web: approvals before sensitive steps and per-site permissions instead.',
    'Web’deki işlemler için “geri al” yok: yerine hassas adımlardan önce onay ve site bazında izinler.',
  ),
  t(
    'No speech service of Qutai’s own: speech becomes text only through the phone’s own recogniser.',
    'Qutai’a ait konuşma hizmeti yok: konuşma yalnızca telefonun kendi tanıma hizmetiyle yazıya çevrilir.',
  ),
  t('No video editing for now; image editing and filters exist.', 'Şimdilik video düzenleme yok; görsel düzenleme ve filtreler var.'),
  t(
    'No app store or gallery for apps made in Qutai: they are shared as files only.',
    'Qutai’da yapılan uygulamalar için mağaza ya da galeri yok: yalnızca dosya olarak paylaşılır.',
  ),
  t(
    'No in-place page translation: the Translate chip translates in the chat.',
    'Sayfayı yerinde çevirme yok: Çevir seçeneği sohbette çevirir.',
  ),
  t('The assistant can’t write to your clipboard; only you copy.', 'Asistan panonuza yazamaz; kopyalayan yalnızca sizsiniz.'),
];
