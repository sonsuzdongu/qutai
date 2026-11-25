import type { Messages } from './en';

/**
 * Türkçe metinler. Anahtarlar en.ts ile birebir aynı olmalı (TypeScript denetler).
 * "app:" ile işaretlenenler uygulamanın kendi arayüz metinleri (uygulamada src/i18n/tr.ts).
 */
export const tr: Messages = {
  'meta.title': 'Qutai: Agentic Browser',
  'meta.description':
    'Qutai, telefonunuzun tarayıcısındaki yapay zekâ asistanı: iPhone, iPad, Apple silicon işlemcili Mac ve Android için açık kaynak bir tarayıcı. Asistanı sizi tanır ve sayfadaki işi sizin yerinize yapar: form doldurur, alışverişinizi ve rezervasyonlarınızı halleder, araştırır. Qutai Kredileriyle ya da kendi AI anahtarınızla çalışır; verileriniz telefonunuzda kalır, önemli bir adımdan önce size sorar. Google Play’de; App Store’da beta testinde.',
  'meta.ogAlt': 'Mavi Q harfinden oluşan Qutai logosu ve yanında: Qutai, Agentic Browser.',
  'meta.appDescription':
    'iPhone, iPad, Apple silicon işlemcili Mac ve Android için açık kaynak, yapay zekâ asistanlı bir tarayıcı: asistan sizi tanır; form doldurur, alışverişinizi ve rezervasyonlarınızı halleder, sizin için araştırır. Qutai Kredileriyle ya da kendi AI anahtarınızla çalışır.',

  'nav.skip': 'İçeriğe geç',
  'nav.label': 'Bölümler',
  'nav.agent': 'Neler yapar',
  'nav.privacy': 'Gizlilik',
  'nav.browser': 'Tarayıcı',
  'nav.compare': 'Karşılaştırma',
  'nav.openSource': 'Açık kaynak',
  'nav.status': 'Durum',
  'nav.features': 'Özellikler',
  'nav.pricing': 'Fiyatlar',
  'nav.github': 'GitHub',
  'nav.home': 'Qutai ana sayfa',

  'lang.label': 'Dil',
  'lang.current': 'Türkçe',
  'lang.other': 'English',
  'lang.otherShort': 'EN',
  'lang.switchTo': 'Switch to English',

  'hero.eyebrow': 'Yapay zekâ odaklı tarayıcı',
  'hero.title': 'Yapay zekâyla, yapay zekâ için yapıldı.',
  'hero.tagline': 'Telefonunuzun tarayıcısında çalışan yapay zekâ asistanınız.',
  'hero.lede': 'Qutai; iPhone, iPad, Apple silicon işlemcili Mac ve Android için bir tarayıcı. Asistanı sizi tanır ve sayfadaki işi sizin yerinize yapar: form, alışveriş, rezervasyon, araştırma.',
  'hero.github': 'GitHub’da inceleyin',
  'hero.play': 'Google Play’den indirin',
  'hero.beta': 'iPhone, iPad ve Mac betası',
  'hero.status': 'Google Play’de yayında. iPhone, iPad ve Mac için App Store’da beta testinde.',

  'hero.chip1': 'Sizi tanır',
  'hero.chip2': 'Formları doldurur',
  'hero.chip3': 'Sizin için araştırır',
  'hero.chip4':
    'Önce sorar',

  'statement.kicker': 'Qutai hakkında',
  'statement.text':
    'Qutai, merkezinde bir asistan olan bir tarayıcı. Sizi tanır; anlattıklarınızı telefonunuzda saklar. Formları sizin bilgilerinizle doldurur, alışverişinizi ve rezervasyonlarınızı halleder, web’de araştırıp bulduklarını derler; hepsini sekmelerinizin içinde yapar. Önemli bir adımdan önce de durup size sorar.',

  'art.placeholder': 'Minyatür hazırlanıyor',
  'art.hero.alt': 'Osmanlı minyatürü: renkli kaftanlı robot kâtipler bir saray kütüphanesinde tabletlerde web sayfaları okuyor; pencereden Haliç ve Galata Kulesi görünüyor.',
  'art.compare.alt': 'Osmanlı minyatürü: çarşıdaki bir dükkânda robot iki çift pabucu terazide tartıyor; iki tablette dükkânların sayfaları açık, bir müşteri izliyor.',
  'art.checkout.alt': 'Osmanlı minyatürü: robot tezgâhta sipariş formunu dolduruyor ve bekliyor; kese sahibinin elinde.',
  'art.booking.alt': 'Osmanlı minyatürü: bir bahçe avlusunda robot, eski bir telefonun yanında akşam yemeği rezervasyonunu takvim tomarına yazıyor; masa kuruluyor.',
  'art.research.alt': 'Osmanlı minyatürü: gece, açık kitaplar, gök küresi ve usturlap arasında bir robot âlim rapor yazıyor.',
  'art.memory.alt': 'Osmanlı minyatürü: robot diz çöküp hatıraları sedefli bir sandığa yerleştiriyor; sahibi sedirden izliyor.',

  'agent.forms.kicker': 'Sizi tanır, formu doldurur',
  'agent.checkout.kicker': 'Sepet, bilgiler, ödeme',
  'agent.booking.kicker': 'Ayırt, yaz, hatırlat',
  'agent.research.kicker': 'Ara, oku, kaynak göster',

  'start.kicker': 'Başlarken',
  'start.title': 'Üç adımda başlayın.',
  'start.step1.title': 'Qutai’ı kurun',
  'start.step1.body': 'Android’de Google Play’den. iPhone, iPad ya da Apple silicon işlemcili Mac’te aşağıda anlatıldığı gibi TestFlight üzerinden betaya katılın.',
  'start.step2.title':
    'Yapay zekâya nasıl bağlanacağını seçin',
  'start.step2.body':
    'Giriş yapıp Qutai Kredileri kullanın, anahtarla uğraşmayın. Ya da kendi anahtarınızı ekleyin: Anthropic, OpenAI, Gemini, OpenRouter ya da kendi sunucunuz.',
  'start.step3.title': 'Bir görev verin',
  'start.step3.body': 'Adres çubuğundaki Q’ya dokunup ne istediğinizi kendi sözlerinizle söyleyin.',

  'mock.label':
    'Qutai uygulamasının bir çizimi: asistan paneli açık bir mağaza sayfası. Kullanıcı Qutai’dan ayakkabıyı 42 numara sepete eklemesini ve teslimat bilgilerini doldurmasını istiyor. Qutai sayfayı okuyup numarayı seçiyor ve yanıt veriyor; bir pencere Sepete ekle dokunuşu için kullanıcıdan izin istiyor.',
  'mock.caption': 'Çizim; uygulamanın arayüzünden ve metinlerinden sadeleştirildi.',
  'mock.url': 'magaza.example/trail-runner',
  'mock.pageKicker': 'Koşu',
  'mock.pageTitle': 'Trail Runner 4',
  'mock.pagePrice': '3.299 TL',
  'mock.pageButton': 'Sepete ekle',
  'mock.panelTitle': 'Qutai',
  'mock.model': 'Claude · bu sohbet',
  'mock.user': 'Bunu 42 numara sepete ekle, teslimat bilgilerimi de doldur.',
  'mock.actionSelect': 'Numara seçiliyor: 42',
  'mock.actionReadPage': 'Sayfa okunuyor',
  'mock.answer': '42 numara stokta. Sepetinize ekliyorum; ardından adresinizi hafızadan dolduracağım.',
  'mock.confirmTitle': 'Qutai bu işlemi yapmak istiyor',
  'mock.confirmBody': '“Sepete ekle” dokunuluyor',
  'mock.confirmAlways': 'magaza.example için hep izin ver',
  'mock.deny': 'Reddet',
  'mock.allow': 'İzin ver',
  'mock.placeholder': 'Bir görev verin…',

  'agent.kicker': 'Asistan',
  'agent.title': 'Adımları değil, işi verin.',
  'agent.lede':
    'Qutai’ın asistanı siz isteyince sekmelerinizde çalışır: sayfayı okur, dokunur, yazar, gerektiğinde yeni sekme açar. Ne yaptığını adım adım görürsünüz; üzerinde çalıştığı sayfa hafifçe parlar, istediğiniz an durdurabilirsiniz. İş bitince adımlar tek satıra toplanır. Ona anlattıklarınızı da hatırlar; zamanla daha az anlatmanız gerekir.',
  'agent.memory.kicker': 'Hafıza, telefonunuzda',
  'agent.memory.title': 'Sizi tanır, öğrendiklerini telefonunuzda saklar.',
  'agent.memory.body':
    'Adresinizi, bedeninizi, nasıl beslendiğinizi ya da bütçenizi Qutai’a bir kez söylemeniz yeter. Kurulumda kendinizi sesle ya da yazarak anlatabilir ya da birkaç kısa soruyu yanıtlayabilirsiniz: Qutai en fazla üç soru daha sorar, anladıklarını kaydetmeden önce size gösterir; sağlık bilgilerinizi yapay zekâdan gizleyebilirsiniz. Öğrendiklerini konularına göre ayırır, sonraki görevlerde size yeniden sormadan kullanır, özel talimatlarınıza da her seferinde uyar.',
  'agent.memory.point1':
    'Konulara ayrılır: kimlik ve iletişim, adresler, alışveriş ve teslimat, seyahat, yemek ve beslenme, bütçe, genel tercihler',
  'agent.memory.point2':
    'Telefonda saklanır; Ayarlar’dan görüp değiştirebilir ya da silebilirsiniz. Şifreli yedeğinize de girer',
  'agent.memory.point3':
    'Yalnızca isteklerinizle birlikte, seçtiğiniz AI sağlayıcısına gider (Qutai Kredileriyle Qutai sunucusu üzerinden) ve “Yapay zekâya gönderilenler” listesinde görünür. Kimlik numaraları ve kilitlediğiniz bilgiler yalnızca etiket olarak gider',
  'agent.memory.point4':
    'Şifre, kart numarası ve tek kullanımlık kodları asla saklamaz; bilgilerinizi bir siteye girmeden önce o site için izninizi ister',
  'agent.forms.title': 'Formları sizin bilgilerinizle doldurur',
  'agent.forms.body':
    'Üyelik, başvuru, teslimat ya da iletişim formu fark etmez: Qutai formu okur, ona anlattıklarınızla doldurabildiği her alanı doldurur. Bilgilerinizi bir sitede ilk kez kullanmadan önce size sorar. Şifre, kart numarası ve tek kullanımlık kodları asla yazmaz; onlar sizde kalır.',
  'agent.forms.step1': 'Kişisel bilgileriniz basvuru.example sitesine girilsin mi?',
  'agent.forms.step2': '[12] alanına yazdı',
  'agent.checkout.title': 'Sizin için alışveriş yapar',
  'agent.checkout.body':
    'Ne aradığınızı söyleyin. Ürünü bulur, numaranızı seçer, sepete ekler; adınızı, adresinizi ve kaydettiğiniz teslimat notunu girer. Hafızadaki bilgilerinizi o sitede kullanmadan önce size sorar. Ödemeyi kimin yapacağına siz karar verirsiniz: son düğmeye kendiniz basarsınız ya da Ayarlar’da “Asistan ödemeleri tamamlasın”ı açarsınız; o zaman her ödeme, siteyi, sayfadaki tutarı, siparişi ve ödeme yöntemini gösteren Qutai penceresinde onayınızı bekler. Kart numarası, güvenlik kodu, şifre ve tek kullanımlık kod asla yazılmaz; bankanın doğrulaması (3-D Secure) sizde kalır.',
  'agent.checkout.step1': 'Numara seçiliyor: 42',
  'agent.checkout.step2': '“Sepete ekle” dokunuluyor',
  'agent.checkout.step3': 'magaza.example sitesinde 2.490 TL ödensin mi?',
  'agent.booking.title': 'Rezervasyonu yapar, takviminize ekler',
  'agent.booking.body':
    'Bir masa ya da randevu bulur, formu doldurur. Sonra takviminize eklemeyi ya da hatırlatıcı kurmayı önerir, ayrıntıları onaylamanız için gösterir. Mekân rezervasyonu telefonla alıyorsa bir Ara düğmesi çıkar; aramayı siz yaparsınız.',
  'agent.booking.step1': 'Takvim etkinliği: Akşam yemeği, Cuma 20:00',
  'agent.booking.callName': 'Kebap Evi',
  'agent.booking.callNumber': '+90 212 555 01 23',
  'agent.booking.call': 'Ara',
  'agent.research.title': 'Sizin için araştırır, kaynak gösterir',
  'agent.research.body':
    'Gerçek bir soru sorun, gerisini derin araştırma halleder: web’de arar, sayfa sayfa okur, not alır ve kaynaklarını altında listeleyen bir rapor yazar. Birkaç dakika sürer; kısa bir sorudan daha çok kredi ya da API ücreti harcar.',
  'agent.research.step1': 'Arandı: İstanbul’da elektrikli bisiklet kuralları',
  'agent.research.step2': 'Sayfa okunuyor',
  'agent.research.step3': 'Kaynaklar',
  'agent.footnote':
    'Asistanın neyi başaracağı seçtiğiniz modele ve siteye göre değişir. Bunlar uygulamanın yapabildiklerinden örnekler. Qutai yeni; hepsi henüz her cihazda denenmedi.',

  'privacy.kicker': 'Gizlilik, en baştan',
  'privacy.title': 'Seçim sizin. Telefon sizin. Karar sizin.',
  'privacy.lede':
    'Qutai’ın yapay zekâya nasıl bağlanacağını siz seçersiniz. Giriş yapıp Qutai Kredileri kullanırsanız anahtarla uğraşmazsınız; istekler Qutai sunucusundan geçer ama orada saklanmaz, kayda da geçirilmez. Kendi anahtarınızı kullanırsanız istekler telefonunuzdan doğrudan sağlayıcınıza gider; arada ne Qutai hesabı ne Qutai sunucusu olur.',
  'privacy.diagramLabel':
    'Yapay zekâya ulaşmanın iki yolunu gösteren şema. Qutai Kredileriyle, resmî sürümlerde: istekler telefonunuzdan Qutai sunucusu üzerinden yapay zekâya gider, orada saklanmaz ve kayda geçirilmez. Kendi anahtarınızla, her sürümde: telefonunuz istekleri doğrudan seçtiğiniz sağlayıcıya gönderir, arada Qutai sunucusu yoktur.',
  'privacy.routeOwn': 'Kendi anahtarınızla',
  'privacy.routeOwnTag':
    'Her sürümde',
  'privacy.routeService': 'Qutai hizmetiyle',
  'privacy.routeServiceTag':
    'Resmî sürümlerde',
  'privacy.diagramPhone': 'Telefonunuz',
  'privacy.diagramPhoneSub': 'sekmeler, geçmiş, hafıza, sohbetler',
  'privacy.diagramProvider': 'AI sağlayıcınız',
  'privacy.diagramProviderSub': 'kendi anahtarınızla',
  'privacy.diagramNone': 'Qutai sunucusu yok',
  'privacy.diagramQutai': 'Qutai sunucusu',
  'privacy.diagramQutaiSub': 'saklanmaz, kayda geçmez',
  'privacy.diagramAi': 'Yapay zekâ',
  'privacy.diagramAiSub': 'kendi anahtarınız olmadan',
  'privacy.key.title': 'Kendi AI anahtarınız',
  'privacy.key.body':
    'Anthropic, OpenAI, Google Gemini ya da OpenRouter anahtarınızla veya kendi OpenAI uyumlu sunucunuzla (Ollama, LM Studio, vLLM) çalışır; bağlantıyı tek dokunuşla test edebilirsiniz. Modeli siz seçersiniz, isterseniz her sohbette ayrı. Qutai Kredileri olsa da bu seçenek her zaman kalır.',
  'privacy.device.title': 'Telefonda kalır',
  'privacy.device.body':
    'Sekmeler, geçmiş, yer imleri, sohbetler ve asistanın hafızası telefonda saklanır. Şifreler, kart numaraları ve tek kullanımlık kodlar hafızaya hiç alınmaz; kimlik numaraları ve kilitlediğiniz bilgiler yapay zekâya yalnızca etiket olarak gider.',
  'privacy.sites.title': 'Her siteye ayrı izin',
  'privacy.sites.body':
    'Her site için ayrı karar verirsiniz: asistan orada serbestçe işlem yapsın, her adımda sorsun, yalnızca okusun ya da hiç girmesin. Hafızadaki bilgilerinizin o siteye girilip girilmeyeceğini, sayfanın kameranızı, mikrofonunuzu ya da konumunuzu kullanıp kullanamayacağını da ayrıca seçersiniz.',
  'privacy.log.title': 'Yapay zekâya gönderilenler',
  'privacy.log.body':
    'Gönderilen her istek burada listelenir: ne zaman, hangi sağlayıcıya ve modele, hangi siteyle ilgili, yanında neler gitti. İçeriğin kendisi yalnızca uygulama kapanana kadar bellekte durur. Her yanıtın altında kaç token harcandığı ve fiyat biliniyorsa yaklaşık maliyeti de yazar.',
  'privacy.incognito.title': 'Gizli modda hiçbir şey kaydedilmez',
  'privacy.incognito.body':
    'Gizli sekmeler geçmiş tutmaz; bunlara dokunan sohbetler yalnızca bellekte kalır. Orada hafıza, konum ve takvim kullanılmaz; gizli sekmeleri kilitleyebilirsiniz.',
  'privacy.confirm.title': 'Önemli adımda sorar',
  'privacy.confirm.body':
    'Hassas adımlar onayınızı bekler. Bir sitede paylaşım, yorum, değerlendirme ya da mesaj, tam metni gösteren Qutai penceresinde siz onaylayınca gider; web sayfasındaki bir yazı bunları onaylayamaz. Güvendiğiniz bir sitede “Bundan sonra … üzerinde sormadan paylaş” kutusunu işaretleyebilirsiniz; Qutai yine de her basıştan önce metni ve sayfayı denetler, bu izni de sitenin ayarlarından geri alırsınız. Arama, SMS, WhatsApp ve e-posta yalnızca hazırlanır, gönderen sizsiniz. Bildirim, takvim etkinliği, hatırlatıcı, takvim ya da konum okuma ve sıradan indirmeler için “Bir daha sorma” diyebilir, bunu Ayarlar’dan geri alabilirsiniz; “hayır” cevabınız ise hiç hatırlanmaz. Yüklemeler ve riskli dosyalar her seferinde sorulur.',
  'privacy.contacts.title': 'Kişileriniz telefonda kalır',
  'privacy.contacts.body':
    '“Ahmet’i ara” ya da “bunu Mehmet Bey’e e-postayla gönder” dediğinizde asistan yalnızca söylediğiniz adı arar, o da telefonda. Yapay zekâ eşleşen adları ve “cep” gibi etiketleri görür; numaraları ve adresleri hiçbir zaman görmez. Birden fazla kişi çıkarsa Qutai’ın kendi listesinden siz seçersiniz; Ara’ya basan da mesajı gönderen de yine sizsiniz. İzin ilk kullanımda istenir, gizli modda kapalıdır.',
  'privacy.scripts.title': 'Betikler yalnızca izin verirseniz',
  'privacy.scripts.body':
    'Varsayılan olarak kapalıdır. Açarsanız asistan “burada kaç bağlantı var?” gibi soruları, sayfanın internete ve oturumunuza bağlı olmayan kapalı bir kopyasında çalışan küçük bir betikle yanıtlar. Canlı sayfada çalışacak bir betiğin kodunu ve uyarılarını görüp onay verirsiniz; giriş, ödeme ve banka sayfalarında betik çalıştırılmaz. Onayladığınız betik, sitenin kendi kodunun yapabildiği her şeyi yapabilir. Seçtiğiniz bir sitede asistanın tek seferlik betikleri pencere açılmadan da çalışabilir; diğer denetimler aynen sürer. Sakladığınız betikler yalnızca kendi sitelerinde çalışır, kodları değişince yeniden onay ister.',
  'privacy.apps.title': 'Kendi uygulamalarınız, dış dünyaya kapalı',
  'privacy.apps.body':
    '“Notlarımı tutabileceğim bir uygulama yap” demeniz yeter: Qutai uygulamayı yazar, önizlemesini açar, kendi hatalarını düzeltir, istediğinizde değiştirir. Eski sürümleri saklar; dilediğinizde geri dönersiniz. Uygulamalarınız yeni sekme sayfasında, Uygulamalarım bölümünde durur. Her biri tarayıcıdan ayrı, kendi alanında çalışır: internete, sitelerin çerezlerine ya da oturumlarına, başka uygulamaların verisine erişemez. Verileri telefonda kalır, uygulama başına en fazla 5 MB. Bir uygulamayı dosya olarak paylaşabilirsiniz; içe aktarılan uygulama siz onaylayana kadar kapalı kalır. Uygulamalar şifreli yedeğinize de girer. Uygulama yazdırmak sıradan bir asistan isteğidir; kendi anahtarınızla ya da Qutai Kredileriyle ödenir.',
  'privacy.note':
    'Qutai hizmeti tamamen isteğe bağlıdır: Apple, Google ya da e-postayla giriş yapıp kendi anahtarınız yerine Qutai Kredileri kullanabilir, seçmeniz gereken bir şey yok, modeli Qutai belirler. Qutai sunucusu hesabınızı, kredilerinizi ve her istek için modeli, token sayısını ve tutarı tutar, uygulamanın sürümünü ve derleme numarasını görür; mesajlarınızı ve sayfaları tutmaz. Hesabınıza bağlanmayan anonim kullanım bilgileri ise ancak size sorulduğunda evet derseniz gönderilir. Depodan derlenen sürümlerde bu hizmet yoktur, uygulama Qutai sunucusuna hiç bağlanmaz.',

  'browser.kicker': 'Üstelik tam bir tarayıcı',
  'browser.title': 'Bir tarayıcıdan beklediğiniz her şey, takip edilmeden.',
  'browser.tabs.title': 'Sekmeler ve gruplar',
  'browser.tabs.body':
    'Bir gruptaki sekmeler asistanla aynı sohbeti paylaşır. Kullanmadığınız sekmeler bellek harcamasın diye uykuya geçer.',
  'browser.reader.title': 'Okuma modu ve sesli okuma',
  'browser.reader.body':
    'Açık, koyu ya da sepya zemin; serifli ya da serifsiz yazı; daha rahat okunan satır aralığı. Sesli okuma makaleyi paragraf paragraf, her bölümü yazıldığı dilde ve telefondaki seslerle okur (iPhone’da yüklü en doğal sesi seçer).',
  'browser.blocking.title': 'Reklam ve izleyici engelleme',
  'browser.blocking.body':
    'EasyList, EasyPrivacy ya da AdGuard Turkish listesini seçin, isterseniz adresiyle başka bir liste ekleyin; listeler telefona indirilir ve alan adının tamamını engelleyen kuralları kullanılır. Boş kalan bir reklam kutusunu gizlemesini ya da bir alan adını engellemesini asistandan isteyebilirsiniz: onaylayıp nerede geçerli olacağını seçince kural “Kendi kurallarım” listesine eklenir; oradan kapatabilir, dışa ya da içe aktarabilirsiniz.',
  'browser.audio.title': 'Arka planda çalar',
  'browser.audio.body':
    'Ekran kilitliyken de ses çalmaya devam eder. iPhone’da video yalnızca sesiyle sürer; Android’de küçük bir pencerede oynamaya devam edebilir. YouTube gibi bazı siteler yine de durdurur.',
  'browser.private.title': 'Gizli sekmeler',
  'browser.private.body':
    'Kendi çerezleri ve site verileri vardır, kapatınca silinir; isterseniz yüz ya da parmak izinizle kilitlersiniz.',
  'browser.backup.title': 'Şifreli yedek',
  'browser.backup.body':
    'Canlı eşitleme yok, hesap da gerekmez: her şeyi parolalı tek bir dosyaya aktarır, başka bir cihazda geri yüklersiniz. Resmî sürümlerde bu dosya Qutai hesabınızda da durabilir; isterseniz her gün kendiliğinden alınır.',
  'browser.bookmarks.title': 'Klasörlü yer imleri',
  'browser.bookmarks.body':
    'Chrome, Firefox, Safari ya da Edge’den dışa aktardığınız dosyayı içe alın; aynı biçimde dışa da verin.',
  'browser.voice.title': 'Sesle yazma',
  'browser.voice.body':
    'Görevleri telefonun kendi konuşma tanıma özelliğiyle söyleyin; telefon ve dil destekliyorsa ses telefonda yazıya çevrilir (Mac’te bu iş Apple’ın çevrim içi hizmetiyle yapılır). Paneli açmadan konuşmak için Q düğmesine basılı tutun; Qutai sohbetin dilinde dinler.',
  'browser.save.title': 'PDF ve tam sayfa ekran görüntüsü',
  'browser.save.body':
    'Sayfayı PDF olarak ya da tamamının tek parça ekran görüntüsü olarak kaydedin, çevrimdışı okumak için saklayın.',
  'browser.desktop.title': 'iPad’de ve Mac’te',
  'browser.desktop.body':
    'Masaüstü tarayıcılardaki gibi şerit hâlinde sekmeler, üstte adres çubuğu, ⌘T, ⌘W, ⌘L ve diğer tarayıcı kısayolları; Qutai ile konuşmak için ⌥Boşluk’a basılı tutun. Siteler masaüstü görünümlerini gösterir.',
  'browser.more': 'Bütün özellikler, örnek isteklerle',
  'browser.styles.title': 'Her site, istediğiniz görünümde',
  'browser.styles.body':
    'Bağlantılar kırmızı olsun, yazı büyüsün, zemin koyulaşsın: asistan stili önerir, siz onaylayıp denersiniz, beğenirseniz o site için Kendi kurallarım’a kaydedersiniz. Oradan kapatabilir, düzenleyebilir, dışa ve içe aktarabilirsiniz. Stiller internetten hiçbir şey yükleyemez.',
  'browser.cookies.title': 'Sayfanın çerezlerini görün',
  'browser.cookies.body':
    'Bir sayfada hangi çerezler olduğunu sorun: HttpOnly olanlar dahil, siteye göre gruplanmış bir liste gelir; her çerezin adı ve ayarları görünür. Değerler yapay zekâya hiç gitmez; isterseniz ekranda görüp silebilirsiniz.',
  'browser.images.title': 'Görselleri telefonda düzenleyin',
  'browser.images.body':
    'Kırpın, boyutunu değiştirin; siyah-beyaz, sepya, negatif, otomatik iyileştirme, parlaklık, kontrast, doygunluk, keskinlik ya da bulanıklık uygulayın. Hazır ayarlara tek dokunuşla, kaydırıcılarla ya da asistana söyleyerek. Düzenleme sunucuda değil, telefonda yapılır.',

  'compare.kicker': 'Karşılaştırma',
  'compare.title': 'Mobilde Qutai ve diğerleri',
  'compare.lede':
    'Yalnızca mobil uygulamalar; her üreticinin kendi herkese açık sayfalarına baktık, notunda belirttiğimiz birkaç hücrede de uygulamayı kendimiz denedik. Doğrulayamadığımız yerde tahmin yürütmedik, hücreye bunu yazdık.',
  'compare.checked': 'Son kontrol: {date}',
  'compare.caption': 'Qutai ve yapay zekâ asistanlı diğer mobil tarayıcıların özellikleri',
  'compare.feature': 'Özellik',
  'compare.yes': 'Var',
  'compare.partial': 'Kısmen',
  'compare.no': 'Yok',
  'compare.unknown': 'Doğrulanmadı',
  'compare.legend': 'Açıklama',
  'compare.source': 'Kaynak',
  'compare.sourceFor': '{name} için kaynak: {feature}',
  'compare.pickLabel': 'Qutai ile karşılaştır',
  'compare.all': 'Tüm tarayıcılar',
  'compare.notesShow': 'Tüm notları göster',
  'compare.notesHide': 'Notları gizle',
  'compare.tapHint': 'Notunu ve kaynağını görmek için bir hücreye dokunun.',
  'compare.excluded': 'Tabloda olmayanlar: {list}.',
  'compare.methodologyLink': 'Nasıl karşılaştırdık',
  'compare.methodology.title': 'Nasıl karşılaştırdık',
  'compare.methodology.1':
    'Tarayıcıların masaüstü sürümlerine değil, iPhone ve Android uygulamalarına baktık; yalnızca masaüstünde olan bir özellik burada sayılmaz.',
  'compare.methodology.2':
    'Rakiplerle ilgili her hücre üreticinin kendi sayfalarına dayanıyor: özellik sayfaları, yardım merkezleri, fiyat sayfaları ve mağaza sayfaları. Her hücrede kaynağın bağlantısı ve kontrol tarihi var. Bir özelliği uygulamada kendimiz denediysek notta bu yazıyor ve bağlantı yok. Bir özelliği iki yoldan da doğrulayamadıysak hücrede “Doğrulanmadı” yazıyor; bu, özelliğin olmadığı anlamına gelmiyor.',
  'compare.methodology.3':
    'Qutai sütunu, kaynak kodunda bugün olanı anlatıyor. Qutai yeni: Google Play’de yayında, App Store’da beta testinde; her özellik henüz her cihazda denenmedi.',
  'compare.methodology.4':
    'Ürün adları sahiplerinin ticari markalarıdır. Bu karşılaştırma, yukarıdaki tarihte herkese açık olan bilgilere dayanır; adı geçen şirketlerin hiçbiri tarafından onaylanmamıştır.',
  'compare.correction': 'Düzeltme bildirin',
  'compare.notes': 'Notlar',

  'beta.title': 'iPhone, iPad ya da Mac’te betaya katılın',
  'beta.lede': 'Qutai, App Store’da beta testinde. Apple’ın beta sürümler için ücretsiz uygulaması TestFlight ile deneyebilirsiniz:',
  'beta.step1': 'Qutai’ı kullanmak istediğiniz iPhone, iPad ya da Mac’e App Store’dan TestFlight’ı yükleyin.',
  'beta.step2': 'Aynı cihazda aşağıdaki davet bağlantısını açın; Kabul Et’e, ardından Yükle’ye dokunun.',
  'beta.step3': 'Qutai diğer uygulamalar gibi görünür. Her yeni beta sürümü TestFlight’ta çıkar; geri bildirimi ve ekran görüntülerini de oradan gönderebilirsiniz.',
  'beta.link': 'TestFlight davetini açın',
  'beta.note': 'Bir beta sürümü yayımlanmasından 90 gün sonra çalışmayı bırakır; bu yüzden Qutai’ı TestFlight’tan güncel tutun. Mac’te Qutai için Apple silicon işlemci gerekir.',
  'oss.kicker': 'Açık kaynak',
  'oss.title': 'Her satırını okuyun, kendiniz derleyin.',
  'oss.body':
    'Uygulamanın tamamı Apache Lisansı 2.0 ile depoda: asistan, güvenlik kuralları, yapay zekâya neyin nasıl gittiği. Kendi bilgisayarınızda ya da kendi Expo hesabınızla bulutta derleyebilirsiniz.',
  'oss.buildLabel': 'Kendi bilgisayarınızda derleyin',
  'oss.repo': 'Depo',
  'oss.license': 'Lisans',

  'status.kicker': 'Durum',
  'status.title': 'Bugün neredeyiz, açıkça.',
  'status.body':
    'Qutai, Android için Google Play’de yayında; iPhone, iPad ve Mac için App Store’da beta testinde. Yeni bir uygulama: bu sayfada anlatılanların hepsi henüz her cihazda denenmedi.',
  'status.today': 'Bugün kodda olanlar',
  'status.today.1':
    'Asistan: okuma, dokunma, yazma, form hatalarını düzeltme, sekmelerle çalışma, kaynaklı derin araştırma',
  'status.today.2':
    'Hesapla Qutai Kredileri; ya da kendi anahtarınızla beş sağlayıcı seçeneği ve her sohbete ayrı model',
  'status.today.3':
    'Konulara ayrılan ve gizlenebilen kayıtlarıyla hafıza, site bazında izinler, “Yapay zekâya gönderilenler” listesi',
  'status.today.4':
    'Takvimi okuma ve takvime yazma, hatırlatıcılar, Ara düğmesi; SMS, WhatsApp ve e-posta taslakları, rehberdeki kişilere adıyla da',
  'status.today.5':
    'Adıyla çalıştırılan kayıtlı görevler, hatırlatmalar, PDF okuma, görsel ekleme ve telefonda filtre uygulama, indirmeler, CSV olarak dışa aktarma',
  'status.today.6': 'Okuma modu, sesli okuma, sesle yazma, kendi kurallarınızla reklam ve izleyici engelleme, şifreli yedek',
  'status.today.7': 'On arayüz dili (Türkçe, İngilizce, Almanca, İspanyolca, Brezilya Portekizcesi, Fransızca, Japonca, Korece, Rusça, Endonezce); telefonun diline uyar ya da Ayarlar’dan seçilir; ekran okuyucu etiketleri ve büyük yazı desteği',
  'status.today.8':
    'Sitelere kendi stilleriniz, değerleri yapay zekâya gitmeyen çerez listesi ve sayfalarda betik (varsayılan olarak kapalı, kodu gösterilip onaylanır)',
  'status.today.9':
    'Asistanın Qutai içinde sizin için yazdığı küçük uygulamalar: internetsiz, tarayıcıdan ayrı, eski sürümlerine dönülebilen',
  'status.limits': 'Bilmeniz gereken sınırlar',
  'status.limits.1':
    'Arka planda çalışma yalnızca Android’de ve siz açarsanız; görev bitince ya da size ihtiyaç olunca bildirim gelir. iPhone, iPad ve Mac’te uygulamadan çıkınca görev duraklar',
  'status.limits.2': 'Zamanlanmış görevler aslında hatırlatmadır: Qutai kapalıyken hiçbir şey çalışmaz',
  'status.limits.3':
    'Ödemeyi siz yaparsınız; asistanın ödemesine izin verirseniz her ödeme Qutai penceresinde onayınızı bekler',
  'status.limits.4': 'Qutai ile paylaşma ve ana ekran widget’ı şimdilik yalnızca Android’de',
  'status.limits.5':
    'Canlı sayfada onayladığınız bir betik, o sitedeki oturumunuzla sitenin kendi kodunun yapabildiği her şeyi yapabilir; yalnızca bilgi okuyan sorular ise kapalı bir kopyada çalışır',
  'status.limits.6': 'Uygulamaların henüz interneti ve konum, kamera, bildirim gibi telefon özellikleri yok',
  'status.limits.7':
    'Web sayfalarına gizlenmiş talimatlar: asistanı yanıltmak için hazırlanmış sayfalarla deniyor ve uygulamanın kendi denetimlerini sıkılaştırmaya devam ediyoruz, ama kusursuz değiliz. Ödeme, paylaşım, silme, hesap değişiklikleri, aramalar ve mesajlar sizin dokunuşunuzu bekler (paylaşımda, bir siteye sormadan paylaşma izni vermediyseniz); yine de asistan bir sayfa yüzünden taraflı bir özet çıkarabilir, kötü bir bağlantı önerebilir ya da onay gerektirmeyen bir adım atabilir. Onay penceresinde yazanı okuyup öyle dokunun; asistanın tanımadığınız bir sayfa hakkındaki özetini bir hüküm değil, bir özet olarak görün',
  'status.planned': 'Planlananlar',
  'status.planned.1': 'App Store’da yayın (şu anda beta testinde)',
  'status.planned.2': 'Hesap açanlar için cihazlar arasında uçtan uca şifreli canlı eşitleme (bugün: hesabınızda saklanan şifreli yedek)',
  'status.planned.3': 'Qutai Kredilerini App Store’dan satın alma (Google Play’de bugün çalışıyor)',
  'status.planned.4': 'iPhone’da paylaşım uzantısı ve widget',
  'status.planned.5': 'Uygulamalar için: konum, bildirim ve kamera gibi telefon özellikleri, seçtiğiniz sitelere internet, ana ekran kısayolu',

  'footer.tagline': 'Agentic Browser',
  'footer.privacy':
    'Bu site başka sunuculara istek göndermez, çerez de kullanmaz; yalnızca dili değiştirirseniz seçiminizi hatırlamak için bir çerez bırakır.',
  'footer.trademarks': 'Google Play ve Google Play logosu Google LLC’nin ticari markalarıdır. Apple, iPhone, iPad, Mac, App Store ve TestFlight Apple Inc.’in ticari markalarıdır.',
  'footer.licenseNote': 'Kod Apache-2.0 lisanslıdır.',
  'footer.github': 'GitHub',
  'footer.issues': 'Sorun bildirin',
  'footer.license': 'Lisans',
  'footer.appPrivacy': 'Uygulamanın gizlilik politikası',
  'footer.terms': 'Uygulamanın kullanım koşulları',
  'footer.deleteAccount': 'Hesabınızı silin',
  'footer.support': 'Destek',

  'policy.metaTitle': 'Gizlilik Politikası · Qutai',
  'policy.metaDescription':
    'Qutai uygulamasının gizlilik politikası: telefonunuzda kalanlar, telefonunuzdan çıkanlar ve kime gittiği, Qutai hesabınız ve Qutai Kredileri.',
  'policy.updated': 'Son güncelleme',
  'policy.note': 'Qutai’ın iPhone, iPad, Mac ve Android uygulamasının gizlilik politikası; uygulamada gösterilen metnin aynısı.',
  'policy.home': 'Qutai ana sayfasına dön',

  'terms.metaTitle': 'Kullanım Koşulları · Qutai',
  'terms.metaDescription':
    'Qutai uygulamasının kullanım koşulları: yapay zekâ anahtarınız ve Qutai Kredileri, siteler, asistan, reklam engelleme, sayfa stilleri ve betikler, uygulamalar, indirmeler, kabul edilebilir kullanım ve haklarınız.',
  'terms.note': 'Qutai’ın iPhone, iPad, Mac ve Android uygulamasının kullanım koşulları; uygulamada gösterilen metnin aynısı.',

  'deletion.metaTitle': 'Qutai hesabınızı silin · Qutai',
  'deletion.metaDescription': 'Qutai hesabınızı ve verilerini nasıl silersiniz: uygulamada ya da uygulama olmadan e-postayla; neyin silindiği ve neyin kaldığı.',
  'deletion.title': 'Qutai hesabınızı silin',
  'deletion.intro': 'Bu sayfa Qutai’ın iPhone, iPad, Mac ve Android uygulaması içindir. Qutai hesabınızı ve onunla birlikte Qutai’ın sunucusunda tutulan verileri istediğiniz an silebilirsiniz: uygulamada ya da uygulama olmadan e-postayla.',
  'deletion.inApp.heading': 'Uygulamada',
  'deletion.inApp.body': '• Qutai’ı açın, ardından Ayarlar › Hesap’a gidin.\n• Hesabı sil’e dokunun ve onaylayın.\n• Apple ile giriş yaptıysanız iPhone’unuz, iPad’iniz ya da Mac’iniz bir kez daha Apple ile onaylamanızı ister; böylece Qutai, Apple’daki erişimini de geri çeker.\nHesap hemen silinir ve tüm cihazlarda oturumunuz kapanır.',
  'deletion.byEmail.heading': 'Uygulama olmadan',
  'deletion.byEmail.body': 'Qutai’da kullandığınız e-posta adresinden (Apple ya da Google ile giriş yaptıysanız Ayarlar › Hesap’ta görünen adresten) {email} adresine “Qutai hesabımı silin” konulu bir e-posta gönderin. İsteğin size ait olduğundan emin olmak için o adrese bir kod gönderebiliriz. Hesabı en geç 30 gün içinde, genellikle çok daha önce siler ve işlem bitince size yazarız.',
  'deletion.deleted.heading': 'Neler silinir',
  'deletion.deleted.body': '• Hesabınız, giriş yöntemleri (Apple, Google, e-posta) ve bunların adresleri\n• Tüm cihazlardaki oturumlarınız\n• Qutai Kredisi bakiyeniz ve kredi geçmişiniz. Kullanılmamış krediler kaybolur ve yasanın ya da mağazanın gerektirdiği durumlar dışında iade edilmez\n• Qutai’ın sunucusunda tuttuğunuz yedekler\n• Ödeme hizmetindeki (RevenueCat) müşteri kaydınız',
  'deletion.kept.heading': 'Neler kalır',
  'deletion.kept.body': '• Satın alma kayıtları, vergi mevzuatının gerektirdiği süre boyunca ve sizinle hiçbir bağlantısı olmadan\n• Bir cevap ya da uygulama hakkında gönderdiğiniz bildirimler, hesabınız olmadan, 180 gün sonra silinene kadar\n• Telefonunuzda saklananlar, siz temizleyene (Ayarlar › Gezinme verilerini temizle) ya da uygulamayı kaldırana kadar kalır\n• Kendi AI anahtarınızı kullandıysanız o AI sağlayıcısına gönderdikleriniz sağlayıcının kendi koşullarına tabidir',
  'deletion.noAccount.heading': 'Qutai’ı hesap olmadan kullanmak',
  'deletion.noAccount.body': 'Yalnızca kendi AI anahtarınızı kullanıyor ve hiç giriş yapmadıysanız Qutai’ın sunucusunda size ait bir hesap yoktur. Her şey telefonunuzdadır: Ayarlar › Gezinme verilerini temizle ile silin ya da uygulamayı kaldırın.',
  'deletion.home': 'Qutai ana sayfasına dön',

  'support.metaTitle': 'Destek · Qutai',
  'support.metaDescription': 'iPhone, iPad, Mac ve Android için Qutai uygulamasıyla ilgili yardım: bize nasıl ulaşacağınız, mesajınıza neler ekleyeceğiniz ve sık sorulan sorular.',
  'support.title': 'Qutai destek',
  'support.intro': 'iPhone, iPad, Mac ve Android için Qutai uygulamasıyla ilgili yardım.',
  'support.contact.heading': 'Bize yazın',
  'support.contact.body': '{email} adresine yazın. Genellikle birkaç iş günü içinde yanıt veririz.',
  'support.include.heading': 'Mesajınıza ekleyin',
  'support.include.body': '• Uygulamanın sürümü (Ayarlar › Hakkında)\n• Cihazınız: telefonunuzun ya da tabletinizin modeli veya Mac\n• Ne yaptığınız, ne olduğu ve ne beklediğiniz; bir ekran görüntüsü de yardımcı olur\nLütfen şifre, kart numarası ya da tek kullanımlık kod göndermeyin.',
  'support.faq.heading': 'Sık sorulan sorular',
  'support.signIn.q': 'Qutai Kredilerini kullanmak için nasıl giriş yaparım?',
  'support.signIn.a': 'Kurulumda Qutai Kredileri’ni seçin ya da Ayarlar › Hesap’ı açın; Apple, Google ya da e-postanıza gelen bir kodla giriş yapın (seçenekler telefonunuza göre değişir). Qutai Kredileri için bir Qutai hesabı gerekir; kendi yapay zekâ anahtarınız için gerekmez.',
  'support.credits.q': 'Satın aldığım krediler nerede?',
  'support.credits.a': 'Krediler telefona değil, Qutai hesabınıza aittir. Bakiyenizi Ayarlar › Hesap › Qutai Kredileri’nde görürsünüz; aynı hesapla giriş yaptığınız her telefonda bakiyeniz oradadır.',
  'support.missing.q': 'Ödeme yaptım ama krediler gelmedi',
  'support.missing.a': 'Ayarlar › Hesap › Qutai Kredileri’ni açıp Eksik kredileri kontrol edin’e dokunun: Qutai, mağazada yapılıp henüz eklenmemiş satın almaları bulur ve ekler. Krediler abonelik olmadığı için Satın alımları geri yükle düğmesi yoktur; eksik krediler bu yolla gelir. Hâlâ eksikse satın alma tarihini yazarak bize ulaşın.',
  'support.ownKey.q': 'Bunun yerine kendi yapay zekâ anahtarımı kullanabilir miyim?',
  'support.ownKey.a': 'Evet. Ayarlar › Asistan’da bir sağlayıcı seçip anahtarınızı ekleyin. İstekler o zaman telefonunuzdan doğrudan o sağlayıcıya gider, kredi harcanmaz.',
  'support.report.q': 'Bir yanıtı ya da uygulamayı nasıl bildiririm?',
  'support.report.a': 'Asistanın yanıtının altındaki ⋮ menüsünü ya da Uygulamalarım’daki veya açık bir uygulamanın menüsünü açın, Bildir’i seçin. Bir neden seçin; yanıtın metni ya da uygulamanın adı ve kodu, yalnızca o kutuyu işaretli bırakırsanız bildirimle gider. Bildirimler Qutai ekibine ulaşır.',
  'support.delete.q': 'Hesabımı nasıl silerim?',
  'support.delete.a': 'Uygulamada: Ayarlar › Hesap › Hesabı sil. Uygulama olmadan, e-postayla: {deleteLink} sayfasına bakın.',
  'support.deleteLink': 'Qutai hesabınızı silin',
  'support.privacy.q': 'Verilerime ne oluyor?',
  'support.privacy.a': 'Sekmeleriniz, geçmişiniz, sohbetleriniz ve hafızanız yalnızca telefonunuzda saklanır. Telefonunuzdan neyin, nereye ve neden çıktığı {privacyLink} sayfasında.',
  'support.openSource.q': 'Bu, açık kaynak koddaki uygulamanın aynısı mı?',
  'support.openSource.a': 'Uygulamanın tamamı açık kaynak. Depodan derlediğiniz sürüm yalnızca kendi yapay zekâ anahtarınızla çalışır: hesap ve Qutai Kredileri yoktur, Qutai sunucusuna hiç bağlanmaz. Resmî sürümlerde hesap ve Qutai Kredileri de vardır.',
  'support.home': 'Qutai ana sayfasına dön',

  'notFound.title': 'Sayfa bulunamadı',
  'notFound.body': 'Böyle bir sayfa yok.',
  'notFound.home': 'Ana sayfaya git',
};
