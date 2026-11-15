import type { Messages } from './en';

/**
 * Türkçe metinler. Anahtarlar en.ts ile birebir aynı olmalı (TypeScript denetler).
 * "app:" ile işaretlenenler uygulamanın kendi arayüz metinleri (uygulamada src/i18n/tr.ts).
 */
export const tr: Messages = {
  'meta.title': 'Qutai: Agentic Browser',
  'meta.description':
    'Qutai, iPhone ve Android için açık kaynak bir yapay zekâ tarayıcısı. Asistanı kendi AI anahtarınızla sayfaları sizin için okur ve kullanır, verilerinizi telefonunuzda tutar, hassas işlemlerden önce sorar. Geliştirme aşamasında.',
  'meta.ogAlt': 'Mavi Q harfinden oluşan Qutai logosu ve yanında: Qutai, Agentic Browser.',
  'meta.appDescription':
    'iOS ve Android için açık kaynak bir yapay zekâ tarayıcısı: asistanı, kendi AI sağlayıcı anahtarınızla web sayfalarını sizin için okur ve kullanır.',

  'nav.skip': 'İçeriğe geç',
  'nav.label': 'Bölümler',
  'nav.agent': 'Neler yapar',
  'nav.privacy': 'Gizlilik',
  'nav.browser': 'Tarayıcı',
  'nav.compare': 'Karşılaştırma',
  'nav.openSource': 'Açık kaynak',
  'nav.status': 'Durum',
  'nav.github': 'GitHub',
  'nav.home': 'Qutai ana sayfa',

  'lang.label': 'Dil',
  'lang.current': 'Türkçe',
  'lang.other': 'English',
  'lang.otherShort': 'EN',
  'lang.switchTo': 'Switch to English',

  'hero.eyebrow': 'Yapay zekâ odaklı tarayıcı',
  'hero.title': 'Yapay zekâ için, yapay zekâ ile üretildi.',
  'hero.lede':
    'Asistanı sayfayı okuyan ve sizin yerinize kullanan bir iPhone ve Android tarayıcısı.',
  'hero.github': 'GitHub’da incele',
  'hero.status': 'Geliştirme aşamasında. App Store ve Google Play’e geliyor; henüz yayımlanmadı.',

  'hero.chip1': 'Sekmeleri okur',
  'hero.chip2': 'Sizi hatırlar',
  'hero.chip3': 'Önce sorar',
  'hero.chip4': 'Kendi AI anahtarınız',

  'statement.kicker': 'Qutai hakkında',
  'statement.text':
    'Qutai, merkezinde bir asistan olan bir tarayıcı. Sayfayı okur, sekmelerinizi karşılaştırır, form doldurur, rezervasyon yapar, araştırır; ona anlattıklarınızı telefonunuzda hatırlar ve önemli bir adımdan önce durup size sorar.',

  'art.placeholder': 'Minyatür hazırlanıyor',
  'art.hero.alt': 'Osmanlı minyatürü: renkli kaftanlı robot kâtipler bir saray kütüphanesinde tabletlerde web sayfaları okuyor; pencereden Haliç ve Galata Kulesi görünüyor.',
  'art.compare.alt': 'Osmanlı minyatürü: çarşıdaki bir dükkânda robot iki çift pabucu terazide tartıyor; iki tablette dükkânların sayfaları açık, bir müşteri izliyor.',
  'art.checkout.alt': 'Osmanlı minyatürü: robot tezgâhta sipariş formunu dolduruyor ve bekliyor; kese sahibinin elinde.',
  'art.booking.alt': 'Osmanlı minyatürü: bir bahçe avlusunda robot, eski bir telefonun yanında akşam yemeği rezervasyonunu takvim tomarına yazıyor; masa kuruluyor.',
  'art.research.alt': 'Osmanlı minyatürü: gece, açık kitaplar, gök küresi ve usturlap arasında bir robot âlim rapor yazıyor.',
  'art.memory.alt': 'Osmanlı minyatürü: robot diz çöküp hatıraları sedefli bir sandığa yerleştiriyor; sahibi sedirden izliyor.',

  'agent.compare.kicker': 'Oku, karşılaştır, karar ver',
  'agent.checkout.kicker': 'Doldur, kontrol et, dur',
  'agent.booking.kicker': 'Ayırt, yaz, hatırlat',
  'agent.research.kicker': 'Ara, oku, kaynak göster',

  'start.kicker': 'Başlarken',
  'start.title': 'Yayımlandığında üç adım.',
  'start.step1.title': 'Qutai’yi kurun',
  'start.step1.body': 'Henüz mağazalarda değil: bugün depodan derleyin ya da projeyi GitHub’da takip edin.',
  'start.step2.title': 'AI anahtarınızı ekleyin',
  'start.step2.body': 'Anthropic, OpenAI, Gemini, OpenRouter ya da kendi sunucunuz. Ücretli Qutai hizmeti seçenek olarak planlanıyor.',
  'start.step3.title': 'Bir görev verin',
  'start.step3.body': 'Adres çubuğundaki Q’ya dokunun ve ne istediğinizi kendi sözlerinizle söyleyin.',

  'mock.label':
    'Qutai uygulamasının bir çizimi: asistan paneli açık bir mağaza sayfası. Kullanıcı Qutai’den bu ayakkabıyı diğer sekmedekiyle karşılaştırıp ucuz olanı sepete eklemesini istiyor. Qutai iki sekmeyi okuyup yanıt veriyor; bir pencere Sepete ekle tıklaması için kullanıcıdan izin istiyor.',
  'mock.caption': 'Çizim; uygulamanın arayüzünden ve metinlerinden sadeleştirildi.',
  'mock.url': 'magaza.example/trail-runner',
  'mock.pageKicker': 'Koşu',
  'mock.pageTitle': 'Trail Runner 4',
  'mock.pagePrice': '3.299 TL',
  'mock.pageButton': 'Sepete ekle',
  'mock.panelTitle': 'Qutai',
  'mock.model': 'Claude · bu sohbet',
  'mock.user': 'Bunu diğer sekmedeki ayakkabıyla karşılaştır, ucuz olanı 42 numara sepete ekle.',
  'mock.actionReadTab': 'Sekme 2 okunuyor',
  'mock.actionReadPage': 'Sayfa okunuyor',
  'mock.answer': 'Bu 450 TL daha ucuz; tabanı ve topuk farkı aynı. 42 numarayı sepetine ekliyorum.',
  'mock.confirmTitle': 'Qutai bu işlemi yapmak istiyor',
  'mock.confirmBody': 'Tıklanıyor (ref 31)',
  'mock.confirmAlways': 'magaza.example için hep izin ver',
  'mock.deny': 'Reddet',
  'mock.allow': 'İzin ver',
  'mock.placeholder': 'Qutai’ye bir görev verin…',

  'agent.kicker': 'Asistan',
  'agent.title': 'Sıkıcı kısmı ona bırakın.',
  'agent.lede':
    'Qutai’nin asistanı sekmelerinizde çalışır: sayfaları okur, dokunur, yazar, sekme açıp karşılaştırır; adım adım. Her adımı anında görürsünüz ve istediğiniz an durdurabilirsiniz. Üstelik ona anlattıklarınızı hatırlar; her görevde bir öncekinden daha az açıklama yaparsınız.',
  'agent.memory.kicker': 'Hafıza, telefonunuzda',
  'agent.memory.title': 'Sizi tanır; öğrendiklerini telefonunuzda saklar.',
  'agent.memory.body':
    'Adreslerinizi, bedeninizi, beslenme tercihlerinizi ya da bütçenizi Qutai’ye söyleyin veya kurulumda birkaç isteğe bağlı soruyu yanıtlayın. Öğrendiklerini kategorilere ayırır, sonraki görevlerde size yeniden sormadan kullanır ve özel talimatlarınıza her istekte uyar. Kullandıkça daha az anlatmanız gerekir.',
  'agent.memory.point1': 'Kategorilere ayrılır: kimlik ve iletişim, adresler, alışveriş ve teslimat, seyahat, yemek ve beslenme, bütçe, genel tercihler',
  'agent.memory.point2': 'Telefonda saklanır; Ayarlar’dan görebilir, değiştirebilir, silebilirsiniz; şifreli yedeğinize de girer',
  'agent.memory.point3': 'Yalnızca isteklerinizle birlikte seçtiğiniz AI sağlayıcısına gider ve “Yapay zekâya gönderilenler”de listelenir; kimlik numaraları ve kilitlediğiniz bilgiler yalnızca etiket olarak gider',
  'agent.memory.point4': 'Şifre, kart numarası ve tek kullanımlık kod asla; bilgilerinizi bir siteye girmeden önce site bazında sorar',
  'agent.compare.title': 'Sekmeler arasında ürün karşılaştırma',
  'agent.compare.body':
    'İki üç ürün sayfası açın, hangisinin size uygun olduğunu sorun. Qutai sekmeleri değiştirmeden her birini okur; fiyatı, teslimat süresini ve özellikleri not edip bir tabloyla yanıt verir, isterseniz tabloyu CSV dosyası olarak da verir.',
  'agent.compare.step1': 'Sekme 2 okunuyor',
  'agent.compare.step2': 'Sekme 3 okunuyor',
  'agent.compare.step3': 'Fiyat, teslimat, garanti yan yana',
  'agent.checkout.title': 'Ödeme formunu doldurur, ödemede durur',
  'agent.checkout.body':
    'Adınızı, adresinizi ve kaydettiğiniz teslimat notunu girer; bunu yapmadan önce hafızadaki bilgilerinizi o sitede kullanıp kullanamayacağını sorar. Ödeme adımında durur: asistan kart numarası, şifre ya da tek kullanımlık kod yazmaz. Ödemeyi siz yaparsınız.',
  'agent.checkout.step1': 'Kişisel bilgileriniz magaza.example sitesine girilsin mi?',
  'agent.checkout.step2': '[12] alanına yazdı',
  'agent.checkout.step3': 'Ödemede durdu: sıra sizde',
  'agent.booking.title': 'Rezervasyonu yapar, takviminize ekler',
  'agent.booking.body':
    'Bir masa ya da randevu bulup formu doldurur. Ardından takviminize eklemeyi veya hatırlatıcı kurmayı önerir, ayrıntıları onayınıza sunar. Yer telefonla rezervasyon alıyorsa bir Ara düğmesi çıkar; aramayı siz başlatırsınız.',
  'agent.booking.step1': 'Takvim etkinliği: Akşam yemeği, Cuma 20:00',
  'agent.booking.callName': 'Kebap Evi',
  'agent.booking.callNumber': '+90 212 555 01 23',
  'agent.booking.call': 'Ara',
  'agent.research.title': 'Kaynaklı araştırma',
  'agent.research.body':
    'Derin araştırma birçok sayfayı ve PDF’i arar ve okur, not alır, kaynakları yanıtın altında listelenen bir rapor yazar. Raporu PDF olarak paylaşabilirsiniz. Birkaç dakika sürer ve API kredinizden daha fazla harcar.',
  'agent.research.step1': 'Arandı: İstanbul’da elektrikli bisiklet kuralları',
  'agent.research.step2': 'Sayfa okunuyor',
  'agent.research.step3': 'Kaynaklar',
  'agent.footnote':
    'Asistanın neyi başaracağı seçtiğiniz modele ve siteye bağlıdır. Bunlar kodun desteklediklerinden örnekler; çoğu henüz gerçek bir telefonda denenmedi.',

  'privacy.kicker': 'Tasarımdan gelen gizlilik',
  'privacy.title': 'Anahtar sizin. Telefon sizin. Karar sizin.',
  'privacy.lede':
    'Qutai’nin yapay zekâya nasıl ulaşacağını siz seçersiniz. Bugün kendi anahtarınızı kullanır: istekler telefonunuzdan doğrudan sağlayıcınıza gider; arada ne Qutai hesabı ne Qutai sunucusu vardır. İleride, anahtarla uğraşmak istemeyenler için ücretli bir Qutai hizmeti de seçenek olacak.',
  'privacy.diagramLabel':
    'Yapay zekâya ulaşmanın iki yolunu gösteren şema. Şimdi, kendi anahtarınızla: telefonunuz istekleri doğrudan seçtiğiniz sağlayıcıya gönderir, arada Qutai sunucusu yoktur. Planlanan ve isteğe bağlı: ücretli Qutai hizmeti; istekler telefonunuzdan Qutai sunucusu üzerinden yapay zekâya gider.',
  'privacy.routeOwn': 'Kendi anahtarınızla',
  'privacy.routeOwnTag': 'Şimdi kullanılabilir',
  'privacy.routeService': 'Qutai hizmetiyle',
  'privacy.routeServiceTag': 'Planlanıyor · isteğe bağlı · ücretli',
  'privacy.diagramPhone': 'Telefonunuz',
  'privacy.diagramPhoneSub': 'sekmeler, geçmiş, hafıza, sohbetler',
  'privacy.diagramProvider': 'AI sağlayıcınız',
  'privacy.diagramProviderSub': 'kendi anahtarınızla',
  'privacy.diagramNone': 'Qutai sunucusu yok',
  'privacy.diagramQutai': 'Qutai sunucusu',
  'privacy.diagramQutaiSub': 'hesap ve kredi',
  'privacy.diagramAi': 'Yapay zekâ',
  'privacy.diagramAiSub': 'kendi anahtarınız olmadan',
  'privacy.key.title': 'Kendi AI anahtarınız',
  'privacy.key.body':
    'Anthropic, OpenAI, Google Gemini ya da OpenRouter anahtarınızı veya kendi OpenAI uyumlu sunucunuzu (Ollama, LM Studio, vLLM) kullanın. Modeli siz seçersiniz, isterseniz sohbet başına. Sonra ne gelirse gelsin bu yol kalır.',
  'privacy.device.title': 'Telefonda kalır',
  'privacy.device.body':
    'Sekmeler, geçmiş, yer imleri, sohbetler ve asistanın hafızası cihazda saklanır. Şifreler, kart numaraları ve tek kullanımlık kodlar hafızaya hiç alınmaz; kimlik numaraları ve kilitlediğiniz bilgiler yapay zekâya yalnızca etiket olarak gider.',
  'privacy.sites.title': 'Site bazında izinler',
  'privacy.sites.body':
    'Her site için asistan serbestçe işlem yapabilir, her işlemde sorar, yalnızca okur ya da hiç girmez. Hafızadaki bilgilerinizi o siteye girip giremeyeceğine ayrıca siz karar verirsiniz.',
  'privacy.log.title': 'Yapay zekâya gönderilenler',
  'privacy.log.body':
    'Her isteğin listesi: ne zaman, hangi sağlayıcı ve model, hangi site, yanında neler gitti. İçeriğin kendisi yalnızca uygulama kapanana kadar bellekte tutulur.',
  'privacy.incognito.title': 'Gizli mod: hiçbir şey kaydedilmez',
  'privacy.incognito.body':
    'Gizli sekmeler geçmiş tutmaz; onlara dokunan sohbetler yalnızca bellekte kalır. Orada hafıza, konum ve takvim kapalıdır; gizli sekmeleri kilitleyebilirsiniz.',
  'privacy.confirm.title': 'Önemli adımda sorar',
  'privacy.confirm.body':
    'Hassas işlemler onayınızı bekler. Takvim, konum, bildirim, indirme ve görsel yükleme her seferinde onaylanır; arama, SMS, WhatsApp ve e-posta yalnızca taslaktır, gönderen sizsiniz.',
  'privacy.note':
    'Ücretli Qutai hizmeti (hesap, eşitleme ve kendi anahtarınız yerine Qutai kredisi) mağaza sürümleri için planlanıyor, henüz yapılmadı. İsteğe bağlı olacak: kendi anahtarınız çalışmaya devam eder, açık kaynak sürüm hiçbir zaman Qutai sunucusuna ihtiyaç duymaz.',

  'browser.kicker': 'Bir de tarayıcı',
  'browser.title': 'Bir tarayıcıdan beklediğiniz her şey, izlenmeden.',
  'browser.tabs.title': 'Sekmeler ve gruplar',
  'browser.tabs.body': 'Bir sekme grubu asistanla tek bir sohbeti paylaşır. Boştaki sekmeler bellek için uyur.',
  'browser.reader.title': 'Okuma modu ve sesli okuma',
  'browser.reader.body':
    'Açık, koyu ya da sepya; serif ya da sans; kolay okuma aralığı. Sesli okuma makaleyi paragraf paragraf takip eder.',
  'browser.blocking.title': 'Reklam ve izleyici engelleme',
  'browser.blocking.body':
    'EasyList, EasyPrivacy ya da AdGuard Turkish’i seçin veya adresiyle istediğiniz listeyi ekleyin. Listeler telefonda indirilir; tüm alan adını engelleyen kuralları kullanılır.',
  'browser.audio.title': 'Arka planda çalar',
  'browser.audio.body':
    'Ekran kilitliyken ses çalmaya devam eder. iPhone’da video yalnızca ses olarak sürer; YouTube gibi bazı siteler yine de durdurur.',
  'browser.private.title': 'Gizli sekmeler',
  'browser.private.body':
    'Kendi çerezleri ve site verileri olur, kapattığınızda silinir; isterseniz biyometrik kilitle korunur.',
  'browser.backup.title': 'Şifreli yedek',
  'browser.backup.body':
    'Hesap da eşitleme de yok: her şeyi parola korumalı tek bir dosyaya aktarın, başka bir telefonda içe aktarın.',
  'browser.bookmarks.title': 'Klasörlü yer imleri',
  'browser.bookmarks.body':
    'Chrome, Firefox, Safari ya da Edge’in dışa aktardığı dosyayı içe aktarın; aynı biçimde dışa aktarın.',
  'browser.voice.title': 'Sesle yazma',
  'browser.voice.body':
    'Görevleri telefonun kendi konuşma tanımasıyla söyleyin; telefon ve dil destekliyorsa tanıma cihazda yapılır.',
  'browser.save.title': 'PDF ve tam sayfa ekran görüntüsü',
  'browser.save.body':
    'Sayfayı PDF ya da tüm sayfanın birleştirilmiş ekran görüntüsü olarak kaydedin veya çevrimdışı okumak için saklayın.',

  'compare.kicker': 'Karşılaştırma',
  'compare.title': 'Mobilde Qutai ve diğerleri',
  'compare.lede':
    'Yalnızca mobil uygulamalar, her üreticinin kendi herkese açık sayfalarına göre. Doğrulayamadığımız bir bilgide tahmin yürütmedik; hücrede bunu belirttik.',
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
  'compare.pickHint': 'Geniş ekranlarda tablonun tamamı görünür.',
  'compare.excluded': 'Tabloda olmayanlar: {list}.',
  'compare.methodologyLink': 'Nasıl karşılaştırdık',
  'compare.methodology.title': 'Nasıl karşılaştırdık',
  'compare.methodology.1':
    'Her tarayıcının masaüstü sürümüne değil, iPhone ve Android uygulamasına baktık: yalnızca masaüstünde olan bir özellik burada yok sayılır.',
  'compare.methodology.2':
    'Rakiplerle ilgili her hücre, üreticinin kendi sayfalarına dayanıyor: özellik sayfaları, yardım merkezleri, fiyat sayfaları ve mağaza sayfaları. Her hücre kaynağına ve kontrol tarihine bağlanıyor. Bir özelliği böyle bir sayfadan doğrulayamadıysak hücrede “Doğrulanmadı” yazıyor; bu, özelliğin olmadığı anlamına gelmez.',
  'compare.methodology.3':
    'Qutai sütunu bugün kaynak kodunda olanı anlatıyor. Qutai henüz yayımlanmadı ve bu özelliklerin çoğu henüz gerçek bir telefonda denenmedi.',
  'compare.methodology.4':
    'Ürün adları sahiplerinin ticari markalarıdır. Bu karşılaştırma yukarıdaki tarih itibarıyla herkese açık bilgileri yansıtır; adı geçen şirketlerin hiçbiri tarafından onaylanmamıştır.',
  'compare.correction': 'Düzeltme bildirin',
  'compare.notes': 'Notlar',

  'oss.kicker': 'Açık kaynak',
  'oss.title': 'Her satırını okuyun. Kendiniz derleyin.',
  'oss.body':
    'Uygulamanın tamamı Apache Lisansı 2.0 ile depoda: asistan, güvenlik kuralları, yapay zekâya neyin nasıl gönderildiği. Kendi araçlarınızla ya da kendi Expo hesabınızla bulutta derleyebilirsiniz.',
  'oss.buildLabel': 'Kendi bilgisayarınızda derleyin',
  'oss.trademark':
    'Lisans kodu kapsar. Qutai adı ve logosu ticari markadır: yayımladığınız bir çatallamanın kendi adı ve simgeleri olmalı; ayrıntılar TRADEMARKS.md’de.',
  'oss.repo': 'Depo',
  'oss.license': 'Lisans',
  'oss.trademarks': 'Ticari markalar',

  'status.kicker': 'Durum',
  'status.title': 'Nerede olduğumuz, açıkça.',
  'status.body':
    'Qutai geliştirme aşamasında. Henüz App Store’da ya da Google Play’de değil; bu sayfada anlatılanların çoğu kodda var ama henüz gerçek bir telefonda denenmedi.',
  'status.today': 'Bugün kodda olanlar',
  'status.today.1': 'Asistan: okuma, dokunma, yazma, form hatalarını düzeltme, sekmeler, kaynaklı derin araştırma',
  'status.today.2': 'Kendi anahtarınızla beş sağlayıcı seçeneği, sohbet başına model',
  'status.today.3': 'Kategorili ve gizli kayıtlı hafıza, site bazında izinler, “yapay zekâya gönderilenler” kaydı',
  'status.today.4': 'Takvim okuma ve yazma, hatırlatıcı, Ara düğmesi; SMS, WhatsApp ve e-posta taslakları',
  'status.today.5': 'Hatırlatmalı kayıtlı görevler, PDF okuma, görsel ekleme, indirme ve CSV dışa aktarma',
  'status.today.6': 'Okuma modu, sesli okuma, sesle yazma, reklam ve izleyici engelleme, şifreli yedek',
  'status.limits': 'Bilmeniz gereken sınırlar',
  'status.limits.1': 'Arka planda görevler yalnızca Android’de ve isteğe bağlı; iPhone’da uygulamadan çıkınca görev duraklar',
  'status.limits.2': 'Zamanlanmış görevler birer hatırlatmadır: Qutai kapalıyken hiçbir şey çalışmaz',
  'status.limits.3': 'Ödemeyi her zaman siz tamamlarsınız',
  'status.limits.4': 'Qutai ile paylaşma ve ana ekran widget’ı şimdilik yalnızca Android’de',
  'status.planned': 'Planlananlar',
  'status.planned.1': 'App Store ve Google Play’de yayın',
  'status.planned.2': 'Uçtan uca şifreli eşitlemeli isteğe bağlı hesap',
  'status.planned.3': 'Kendi anahtarınıza seçenek olarak Qutai kredisi',
  'status.planned.4': 'iPhone’da paylaşım uzantısı ve widget',

  'footer.tagline': 'Agentic Browser',
  'footer.privacy':
    'Bu site başka sunuculara istek göndermez ve çerez kullanmaz; yalnızca dili değiştirirseniz seçiminizi hatırlayan bir çerez bırakır.',
  'footer.licenseNote': 'Kod Apache-2.0 ile lisanslıdır.',
  'footer.github': 'GitHub',
  'footer.issues': 'Sorun bildir',
  'footer.license': 'Lisans',
  'footer.trademarks': 'Ticari markalar',
  'footer.appPrivacy': 'Uygulamanın gizlilik politikası',

  'notFound.title': 'Sayfa bulunamadı',
  'notFound.body': 'Böyle bir sayfa yok.',
  'notFound.home': 'Ana sayfaya git',
};
