# Qutai: App Store ve Google Play inceleme riskleri

Tarih: 21 Kasım 2026 · Kapsam: mağazaya gidecek **pro** derleme (`--pro-mode`, Qutai Kredileri, hesaplar, RevenueCat) ve ortak kod.
Yalnızca okuma yapıldı; kodda hiçbir şey değiştirilmedi.

**Kaynaklar (bugün okundu, ezberden değil):**
- Apple App Review Guidelines, sayfanın son güncelleme tarihi 16 Ekim 2026: <https://developer.apple.com/app-store/review/guidelines/>
- Google Play Developer Program Policies (ana sayfa): <https://support.google.com/googleplay/android-developer/topic/9858052>. Ayrıca şu sayfalar:
  AI-Generated Content ([13985936](https://support.google.com/googleplay/android-developer/answer/13985936)),
  Device and Network Abuse ([9888379](https://support.google.com/googleplay/android-developer/answer/9888379)),
  Payments ([9858738](https://support.google.com/googleplay/android-developer/answer/9858738)),
  Deceptive Behavior ([9888077](https://support.google.com/googleplay/android-developer/answer/9888077)),
  User Generated Content ([9876937](https://support.google.com/googleplay/android-developer/answer/9876937)),
  Inappropriate Content ([9878810](https://support.google.com/googleplay/android-developer/answer/9878810)),
  User Data ([10144311](https://support.google.com/googleplay/android-developer/answer/10144311)),
  hesap silme ([13327111](https://support.google.com/googleplay/android-developer/answer/13327111)),
  Data safety ([10787469](https://support.google.com/googleplay/android-developer/answer/10787469)),
  Permissions and APIs ([9888170](https://support.google.com/googleplay/android-developer/answer/9888170)),
  QUERY_ALL_PACKAGES ([10158779](https://support.google.com/googleplay/android-developer/answer/10158779)),
  ön plan hizmetleri ([13392821](https://support.google.com/googleplay/android-developer/answer/13392821)),
  inceleme hazırlığı / App access ([9859455](https://support.google.com/googleplay/android-developer/answer/9859455)),
  hedef API ([11926878](https://support.google.com/googleplay/android-developer/answer/11926878)),
  politika takvimi ([12921780](https://support.google.com/googleplay/android-developer/table/12921780)).
- **Okunmayan sayfalar:** Play Ads ([9857753](https://support.google.com/googleplay/android-developer/answer/9857753)), Misrepresentation (9888689), AccessibilityService ayrıntı sayfası, Apple'ın yaş derecelendirme soru listesi ve Mini Apps Partner Program sayfası. Bunlara dayanan cümleler aşağıda "tahmin" diye işaretli.

**İşaretler:** **[kodda doğrulandı]** = dosyada / tasarım kaydında bizzat görüldü. **[tahmin]** = kuralın yorumu ya da inceleme ekibinin davranışına dair beklenti; kodda kanıtı yok.

---

## 1. Kesin ret riski

Bunlar düzeltilmeden gönderirseniz büyük olasılıkla ret alırsınız. Play'de bazıları Console formunu bile tamamlatmaz.

### 1.1 Yapay zekâ cevaplarını uygulama içinden bildirme yolu yok
- **Mağaza:** Google Play (kesin), Apple (yüksek)
- **Kural:** Play: [AI-Generated Content](https://support.google.com/googleplay/android-developer/answer/13985936). Uygulamadan çıkmadan rahatsız edici içeriği geliştiriciye bildirme (report/flag) yolu zorunlu. Apple: [1.2 User-Generated Content](https://developer.apple.com/app-store/review/guidelines/#user-generated-content). 1.2 açıkça "AI content creation apps" uygulamalarını da sayıyor: içerik filtresi, şikâyet yolu, zamanında yanıt ve yayımlanmış iletişim bilgisi isteniyor.
- **Bizde ne var:** Sohbet cevaplarında "Bildir" ya da "Bu cevabı şikâyet et" yok **[kodda doğrulandı]**: `src/chat` ve `src/components` içinde böyle bir işlem ya da metin bulunmuyor. AI'ın yazdığı uygulamalar için de yok: `APPS-45` ("There is no report button for AI-generated apps") [docs/design/22-apps.md:164](design/22-apps.md).
- **Olasılık:** yüksek (Play'de neredeyse kesin)
- **Çözüm:** Her asistan cevabına ve her uygulama kartına ⋮ › "Bildir" ekleyin. Sebep seçilsin (saldırgan, zararlı, yanlış, diğer) ve isteğe bağlı bir not yazılabilsin. Pro modda bildirim sunucuya gitsin (cevap metni yalnızca kullanıcı onaylarsa eklensin; bu "telefondan çıkan veri" sayılır, gizlilik metnine yazılmalı). Açık kaynak modda e-posta taslağı açılabilir. Bildirimler admin panelde görünsün. İnceleme notunda hangi düğmenin bu işi yaptığını yazın.

### 1.2 Web'den hesap silme bağlantısı yok
- **Mağaza:** Google Play
- **Kural:** [Hesap silme şartları](https://support.google.com/googleplay/android-developer/answer/13327111) ve [User Data](https://support.google.com/googleplay/android-developer/answer/10144311). Uygulamada hesap açılabiliyorsa silme hem uygulama içinden hem de Play Console'a girilen bir **web bağlantısından**, uygulamayı yeniden kurmadan yapılabilmeli. Sayfada uygulamanın ya da geliştiricinin adı geçmeli. Dondurmak ya da devre dışı bırakmak silme sayılmaz.
- **Bizde ne var:** Uygulama içinde silme var **[kodda doğrulandı]**: `ACC-40`, `src/components/AccountScreen.tsx:100` (`deleteAccount`). Web sitesinde (`webpage/src`) silme sayfası ya da yolu yok **[kodda doğrulandı]**. Gizlilik metni yalnızca "Ayarlar › Hesap" yolunu anlatıyor (`webpage/src/data/privacy.json:49`).
- **Olasılık:** kesin (Data safety formunda bu alan zorunlu)
- **Çözüm:** Sitede `/hesap-silme` (ve `/delete-account`) sayfası açın. Adımları anlatsın: uygulamadan Ayarlar › Hesap › Sil. Uygulama yoksa ya da açılmıyorsa e-posta veya form ile silme isteği, giriş yapılan adresten. Ne silinir: hesap, giriş yöntemleri, kredi bakiyesi ve geçmişi, sunucu yedekleri. Ne kalır: vergi için kullanıcıdan ayrılmış satın alma kayıtları (`BUY-22`). Ne kadar sürede silinir, onu da yazın. Bağlantıyı Play Console › App content › Data deletion alanına girin.

### 1.3 YouTube'a özel video reklam engelleme
- **Mağaza:** Google Play (kesin), Apple (yüksek)
- **Kural:** Play: [Device and Network Abuse](https://support.google.com/googleplay/android-developer/answer/9888379). Bir hizmete onun kullanım şartlarını ihlal edecek biçimde erişmek ve "Google hizmetlerine müdahale" ihlal örnekleri arasında. Çalışma anında yüklenen yorumlanan kod (JavaScript) da politika ihlaline imkân vermemeli. Apple: [5.2.2 Third-Party Sites/Services](https://developer.apple.com/app-store/review/guidelines/#intellectual-property). Üçüncü taraf hizmetin içeriği ancak o hizmetin şartları izin veriyorsa kullanılabilir ve istenirse izin belgesi gösterilmeli.
- **Bizde ne var:** "Video reklamlarını engelle" ayarı **[kodda doğrulandı]**: `BLK-29`, `BLK-30` ve `BLK-31`, `src/content/videoAds.ts:37` `VIDEO_AD_RULES`. Kural listesinde `youtube.com`, `m.youtube.com`, `music.youtube.com` ve `youtube-nocookie.com` var (`videoAds.ts:40-44`). Betik, sayfanın oynatıcı yanıtından `playerAds`/`adPlacements` alanlarını budayıp reklam sınıflarını izliyor. Asistan da bu ayarı açabiliyor (`BLK-24`). YouTube'un şartları reklamların atlatılmasını yasaklıyor, YouTube da Google'ın. Bu yüzden Play'de ret, sonradan kaldırılma ve hesap uyarısı riski çok yüksek **[tahmin, güçlü]**. Not: Play sayfasının "başka uygulamanın reklamlarını engelleme" maddesi uygulamanın kendi tarayıcısındaki web sayfalarını açıkça kapsamıyor. Genel reklam ve izleyici engelleme (filtre listeleri) bu yüzden düşük risk (bkz. 4.4). Sorun, adıyla YouTube'u hedefleyen kural.
- **Olasılık:** yüksek (Play için kesin sayın)
- **Çözüm:** Mağaza derlemesinde video reklam engellemeyi tümüyle kaldırın: kural tablosundan YouTube alan adlarını çıkarın, ayarı gizleyin, asistanın `block_video_ads` anahtarını kapatın. En azından derleme bayrağıyla mağaza paketlerinde kapalı olsun. Mağaza açıklaması, ekran görüntüleri ve web sitesinde "YouTube reklamlarını engeller" gibi bir cümle olmasın. Genel EasyList tarzı engelleme kalabilir.

### 1.4 İnceleme ekibinin girişi, kredisi ve satın alması çalışmalı
- **Mağaza:** her ikisi
- **Kural:** Apple [2.1 App Completeness](https://developer.apple.com/app-store/review/guidelines/#app-completeness). Giriş varsa demo hesabı verilmeli, sunucu inceleme boyunca açık olmalı, uygulama içi satın almalar görünür ve çalışır olmalı. Play: [App access](https://support.google.com/googleplay/android-developer/answer/9859455). Girişle kapanan her bölüm için erişim bilgisi verilmeli (OTP için "Any other instructions" alanı var).
- **Bizde ne var:**
  - Sabit kodlu inceleme hesabı var ama varsayılan olarak **kapalı** **[kodda doğrulandı]**: `ACC-54`, `backend/apps/api/src/auth/email/challenges.ts:35-42`, `review_login`. İnceleme sırasında açık değilse e-posta kodu inceleme ekibine ulaşmaz ve ret gelir.
  - Production sunucusu yalnızca gerçek satın almaları kabul ediyor. Mağazanın test (sandbox) satın almaları ancak "Test purchases in production" açıksa ve hesap listedeyse kredi ekliyor **[kodda doğrulandı]**: `BUY-5`, `BUY-26`, `BUY-32` ([35-purchases.md:44,82,94](design/35-purchases.md)). Apple inceleme ekibi production derlemesini **sandbox** hesabıyla alır. Ekip kendi Apple kimliğiyle Apple'la giriş yapıp yeni bir hesap açarsa o hesap listede olmaz. Satın alma "başarısız" görünür ve 2.1(b) reddi gelir **[tahmin, Apple'ın bilinen davranışı]**.
  - iOS'ta satın alma, IPA RevenueCat iOS anahtarıyla derlenirse açılıyor (`BUY-27`, `BUY-30`). "Önce Android, iOS sonra" kararı var. Kredi modu iOS'ta görünüp satın alma yoksa 2.1(b) ve 3.1.1 reddi gelir **[kodda doğrulandı: anahtar yoksa paket yine de çıkıyor]**.
- **Olasılık:** yüksek (hazırlık yapılmazsa kesin)
- **Çözüm:** (1) Her gönderimde inceleme bitene kadar `review_login` açık kalsın. Hesapta inceleme için yeterli kredi olsun (ör. 300). Gerçek veri olmasın. (2) İnceleme süresince "Test purchases in production" **herkes için** açık olsun (`BUY-32`), ya da sunucu Apple'ın önerdiği gibi önce production sonra sandbox doğrulasın. Açık kaldığı sürece kötüye kullanım riski olduğunu unutmayın. İnceleme biter bitmez kapatın. (3) iOS ürünlerini App Store Connect'te oluşturun ve paketlerle birlikte "Ready to Submit" durumuna getirin, uygulama sürümüyle aynı gönderimde ekleyin. IPA'yı RevenueCat iOS anahtarı olmadan çıkarmayın. Ya da `release.mjs` iOS için de Android'deki gibi anahtar yoksa dursun.

### 1.5 Sahte satın alma ve diğer geçici çözümler
- **Mağaza:** her ikisi
- **Kural:** Apple [2.1](https://developer.apple.com/app-store/review/guidelines/#app-completeness) (son sürüm olmalı, yer tutucu olmamalı) ve [2.5.19](https://developer.apple.com/app-store/review/guidelines/) (gizli, uyuyan ya da belgelenmemiş özellik olmamalı). Play [Deceptive Behavior §5](https://support.google.com/googleplay/android-developer/answer/9888077) (davranış şeffaflığı).
- **Bizde ne var:** "Fix before launch" listesindeki geçici çözümler **[kodda doğrulandı]**: sahte satın alma yolu ve on dildeki metinleri (`BUY-16` ile `BUY-21`, ayrıca TODO.md). Production'da kapalı (`BUY-17`) ama uygulamadaki metinler ve kod yolu `BUY-21`'e göre henüz temizlenmedi. Ayarlar › Asistan altında "Asistan görünümü (deneme)" adlı deneme anahtarı duruyor. Test girişi mağaza paketlerinden çıkarılıyor (`BUILD-9`, doğrulandı).
- **Olasılık:** orta-yüksek. İnceleme ekibi "deneme" yazan bir ayar görürse ya da sahte satın alma metni ortaya çıkarsa ret gelir.
- **Çözüm:** `BUY-21` listesini bitirin (uygulamadaki sahte yolu ve metinleri kaldırın, veritabanını temizleyin). "(deneme)" anahtarını kaldırın. Paketten sonra `bundleCheck` sahte satın alma metinlerini de arasın.

---

## 2. Yüksek risk

### 2.1 iOS'ta YouTube arka plan oynatma ("görünür" sanılması)
- **Mağaza:** Apple
- **Kural:** [5.2.2](https://developer.apple.com/app-store/review/guidelines/#intellectual-property) ve [5.2.3 Audio/Video Downloading](https://developer.apple.com/app-store/review/guidelines/#intellectual-property). 5.2.3 YouTube gibi kaynaklardan izinsiz kaydetme ya da indirmeyi yasaklıyor ve akışın da şartları ihlal edebileceğini söylüyor. Ayrıca [2.5.4 Background modes](https://developer.apple.com/app-store/review/guidelines/#software-requirements).
- **Bizde ne var:** `MEDIA-6` **[kodda doğrulandı, tasarım kaydında]**. Qutai ekrandan çıkınca WebKit'in durdurduğu video yeniden (yalnızca ses) çalıyor ve sayfaya "görünür" deniyor. Böylece kendini durduran siteler (YouTube mobil sitesi) çalmaya devam ediyor. `MEDIA-7`'de "YouTube şartları ve App Review açısından kabul edilebilir mi" sorusu açık ([24-reader-and-media.md:25-28](design/24-reader-and-media.md)). Arka planda oynatma YouTube'da ücretli (Premium) bir özellik. Android tarafında bu engel bilerek aşılmıyor (`MEDIA-11`). Web sitesi de "YouTube gibi bazı siteler yine de durdurur" diyor (`webpage/src/data/comparison.ts:207`). Yani iOS davranışı web sitesindeki cümleyle de çelişebilir.
- **Olasılık:** orta-yüksek. Apple genelde inceleme sırasında denemez ama şikâyet gelirse kaldırma riski var **[tahmin]**.
- **Çözüm:** Android'deki kuralı iOS'a da uygulayın: youtube.com, m.youtube.com ve music.youtube.com için görünürlük taklidi olmasın, arka planda kendiliğinden yeniden oynatma olmasın. Diğer siteler için `audio` modu Safari gibi kalabilir. `MEDIA-7`'yi kapatın.

### 2.2 Uygulamalar (Qutai içindeki mini uygulamalar): 4.7 şartları ve dışarıdan içe aktarma
- **Mağaza:** Apple (yüksek), Play (orta)
- **Kural:** Apple [4.7 Mini apps, mini games, … chatbots, plug-ins](https://developer.apple.com/app-store/review/guidelines/#mini-apps):
  - 4.7.1: filtre, şikâyet, yanıt ve engelleme yolu.
  - 4.7.2: Apple'ın önceden izni olmadan yerel platform API'leri bu yazılımlara açılamaz.
  - 4.7.3: her seferinde açık rıza.
  - 4.7.4: yazılımların dizini.
  - 4.7.5: yaş sınırını aşan yazılımlar işaretlenip yaşa göre kısıtlanmalı.
  - Ayrıca [2.5.2](https://developer.apple.com/app-store/review/guidelines/#software-requirements): özellik ekleyen ya da değiştiren kod indirilip çalıştırılamaz.
  - Play: [Device and Network Abuse](https://support.google.com/googleplay/android-developer/answer/9888379). WebView içindeki JavaScript, çalıştırılabilir kod yasağından muaf ama ihlale imkân vermemeli. Untrusted içerik yükleyen WebView'a JS arayüzü eklemek ihlal sayılıyor. [Deceptive Behavior §5](https://support.google.com/googleplay/android-developer/answer/9888077): uzaktan inip incelemede olmayan özellik getiren kod olmamalı.
- **Bizde ne var:** **[kodda doğrulandı]**
  - Uygulamalar ağsız, ayrı bir WebView'da çalışıyor (`APPS-4`, `APPS-5`, `APPS-41`). Köprü yalnızca depolama, ui ve pano erişimi veriyor (`src/apps/contract.ts:55-84`). Bu 4.7.2 için iyi.
  - "My apps" 4.7.4'teki dizin olarak düşünülmüş (`APPS-47`).
  - Ancak şikâyet ya da engelleme yok (`APPS-45`) ve yaş işaretleme yok.
  - `.qutaiapp` dosyası **başkasından** alınıp içe aktarılabiliyor (`APPS-34`, `APPS-37`). Bu, kullanıcının kendi yazdırdığı araçtan farklı olarak "üçüncü taraf kodu indirip çalıştırma" diye okunabilir.
  - Gizlilik metinleri uygulamalardan hiç söz etmiyor (`APPS-46`, `LEGAL-6`).
- **Olasılık:** orta-yüksek
- **Çözüm:** Uygulama kartına ve çalıştırma ekranına "Bildir" ekleyin (1.1 ile aynı akış). İnceleme notunda ağsız sandbox'ı, kodun Qutai sunucusundan inmediğini, mağaza ya da galeri olmadığını (`APPS-29`) ve My apps dizinini anlatın. İçe aktarma için iki seçenek var: (a) ilk sürümde yalnızca bu telefonda yapılmış uygulamaların yedekten geri yüklenmesine izin verin, ya da (b) içe aktarma ekranında "Bu uygulamayı başkası yazdı, Qutai denetlemedi" uyarısı ve bildir düğmesi olsun. `LEGAL-6`'daki cümleyi gizlilik metnine ekleyin; yasal sürüm artırma kararı sizde.

### 2.3 Üçüncü taraf yapay zekâya veri gönderimi için açık izin (kendi anahtar modu)
- **Mağaza:** Apple (yüksek), Play (orta)
- **Kural:** Apple [5.1.2(i)](https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing): kişisel verinin üçüncü taraf yapay zekâ dahil kimlerle paylaşıldığı açıkça söylenmeli ve göndermeden **önce açık izin** alınmalı. Play [User Data](https://support.google.com/googleplay/android-developer/answer/10144311): kullanım sırasında belirgin açıklama ve olumlu bir eylemle rıza. Sayfa "third-party AI integrations" için de geçerli olduğunu yazıyor.
- **Bizde ne var:** Qutai Kredileri için ayrı bir açıklama ve kabul var **[kodda doğrulandı]**: `CRED-4`, `src/components/CreditsDisclosure.ts`, `AiProviderFields.tsx:100`. Kendi anahtarla (Anthropic, OpenAI, Gemini, OpenRouter, özel uç nokta) böyle bir diyalog yok. Yalnızca kurulumda gizlilik politikası ve şartlar kabul ediliyor (`INTRO-2`). Ayrıca kredi açıklaması "Anthropic, OpenAI or Google" diyor ama sunucu artık yalnızca Anthropic'e aktarıyor (`src/i18n/en.ts:2263`, `CRED-47`). Metin gerçeği tam yansıtmıyor.
- **Olasılık:** orta-yüksek
- **Çözüm:** Kendi anahtarla bir sağlayıcı ilk kez seçildiğinde kısa bir kabul ekranı gösterin: "Sayfa metni, ekran görüntüsü, sesten çevrilen metin ve onayladığınız konum ya da takvim [sağlayıcı adı]'na gönderilir; [sağlayıcı]'nın gizlilik politikası…". Düğmeler "Kabul ediyorum" ve "Vazgeç" olsun. Kredi açıklamasındaki sağlayıcı listesini düzeltin. İnceleme notlarında bu ekranları gösterin.

### 2.4 Mağaza formlarının dayanağı olan belge "sunucumuz yok" diyor
- **Mağaza:** her ikisi
- **Kural:** Apple [5.1.1(i)](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage) ve gizlilik etiketleri. Etiket yanlışsa uygulama kaldırılabilir. Play [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469): doğruluktan geliştirici sorumlu, yanlış beyan yaptırım nedeni.
- **Bizde ne var:** **[kodda doğrulandı]**
  - `docs/permissions.md:265-268` "Notes for the store forms" başlığı altında "Qutai has no servers of its own" yazıyor.
  - `app.json` gizlilik manifestosunda toplanan veri türleri listesi boş ve docs/permissions.md bunu "sunucumuz yok" diye gerekçelendiriyor.
  - Oysa pro derleme e-posta, kullanıcı kimliği, cihaz ya da oturum bilgisi, satın alma geçmişi, isteğe bağlı şifreli yedek ve RevenueCat'e giden hesap numarası topluyor. Sohbet ve sayfa içeriği de Qutai sunucusundan geçiyor (`CRED-1`, `BUY-29`, `webpage/src/data/privacy.json`).
  - `LEGAL-9` bu cümlelerin pro için yeniden yazılmasını istiyor.
- **Olasılık:** orta. Ret değil ama yanlış form, sonradan kaldırma nedeni.
- **Çözüm:** Formları aşağıdaki §6'ya göre doldurun. `docs/permissions.md`'ye pro derleme için ayrı bir "store forms" bölümü ekleyin. Gizlilik manifestosuna pro için `NSPrivacyCollectedDataTypes` ekleyin (e-posta, kullanıcı kimliği, satın alma geçmişi, diğer kullanıcı içeriği; hepsi "App Functionality", hiçbiri izleme değil).

### 2.5 Yaş derecelendirmesi ve AI çıktısının içeriği
- **Mağaza:** her ikisi
- **Kural:** Apple [2.3.6](https://developer.apple.com/app-store/review/guidelines/#accurate-metadata) (yaş derecelendirmesi dürüst cevaplanmalı) ve [1.1 Objectionable Content](https://developer.apple.com/app-store/review/guidelines/#objectionable-content). Play [Inappropriate Content](https://support.google.com/googleplay/android-developer/answer/9878810) ve AI-Generated Content (yasaklı içeriğin üretilmesi engellenmeli).
- **Bizde ne var:** Sınırsız web erişimi olan bir tarayıcı **[doğrulandı]**. Kendi anahtar, OpenRouter ve özel uç nokta ile kullanıcı filtresiz bir model de bağlayabilir (`src/ai/openrouter.ts`, `src/ai/custom.ts`). Kredi modunda model Claude Haiku 5.5 (`CRED-40`). Onun güvenlik filtresi sağlayıcı tarafında, ek bir filtre yok **[tahmin: uygulama içi ek filtre görmedim]**.
- **Olasılık:** orta
- **Çözüm:** Apple anketinde "Unrestricted Web Access" ve yapay zekâ ya da sohbet sorularına **evet** deyin. Bu büyük olasılıkla 17+/18+ demek **[tahmin: Apple'ın güncel yaş anketi okunmadı]**. Play IARC anketinde "kullanıcılar etkileşir veya içerik paylaşır: hayır" (sosyal özellik yok), "sınırsız internet erişimi: evet" ve "AI üretimli içerik: evet" deyin. İnceleme notunda kredi modunun hangi modeli ve sağlayıcı filtresini kullandığını, OpenRouter ve özel uç noktanın kullanıcının kendi hesabı olduğunu yazın. 1.1 bildirimi ile birlikte bu yeterli olur **[tahmin]**.

---

## 3. Orta risk

### 3.1 Android `specialUse` ön plan hizmeti (arka planda asistan görevi)
- **Mağaza:** Play
- **Kural:** [Ön plan hizmeti şartları](https://support.google.com/googleplay/android-developer/answer/13392821) ve [Device and Network Abuse › Foreground Services](https://support.google.com/googleplay/android-developer/answer/9888379). Her tür manifestte ve Console'da beyan edilmeli, kullanıcının başlattığını gösteren bir video gönderilmeli. `specialUse` ayrıca incelemeye tabi. WorkManager ile yapılabilecek iş için ön plan hizmeti kullanılmamalı.
- **Bizde ne var:** `plugins/withBackgroundTasks.js:11-16` (`PROPERTY_SPECIAL_USE_FGS_SUBTYPE` metni) ve `AgentTaskService` **[kodda doğrulandı]**. Varsayılan olarak kapalı ve kullanıcı başlatıyor. Bunun yanında yanıtı bitirmek için 3 dakikalık bir mod var. Bu ikinci kullanım "kullanıcı başlattı" ölçütünü zayıflatabilir **[tahmin]**.
- **Olasılık:** orta
- **Çözüm:** Console beyanına görevin başlatılmasını, bildirimi ve Durdur düğmesini gösteren bir video koyun. Reddedilirse 3 dakikalık modu "user-initiated data transfer job"a taşıyın ya da kaldırın.

### 3.2 `dataSync` ve `mediaPlayback` ön plan hizmetleri, `RUN_USER_INITIATED_JOBS`
- **Mağaza:** Play
- **Kural:** aynı sayfa ([13392821](https://support.google.com/googleplay/android-developer/answer/13392821)): her tür için beyan ve video. Medya oynatma kullanıcı başlatmalı.
- **Bizde ne var:** `plugins/withDownloads.js:4-7` ve `plugins/withBackgroundMedia.js:3` **[kodda doğrulandı]**.
- **Olasılık:** düşük-orta (beyan yapılırsa düşük)
- **Çözüm:** Console › App content › Foreground service permissions bölümünde iki tür için de kısa video yükleyin: indirme başlatma ve bir podcast sitesinde oynatıp ana ekrana çıkma.

### 3.3 `REQUEST_INSTALL_PACKAGES` (indirilen APK'yı açma)
- **Mağaza:** Play
- **Kural:** [Permissions and APIs](https://support.google.com/googleplay/android-developer/answer/9888170). "Web browsing or search" izin verilen kullanımlar arasında. Beyan formu gerekiyor ve kurulum kullanıcı başlatmalı.
- **Bizde ne var:** `plugins/withDownloads.js:11` **[kodda doğrulandı]**
- **Olasılık:** orta. Beyan eksikse sürüm durur.
- **Çözüm:** Beyanı doldurun ("tarayıcı; kullanıcının indirdiği APK'ya dokununca sistem yükleyicisine verilir"). Reddedilirse bu izni kaldırıp dosyayı "Paylaş/Aç" ile başka bir uygulamaya verin.

### 3.4 Asistanın web sitelerinde kullanıcı adına işlem yapması
- **Mağaza:** her ikisi
- **Kural:** Apple [5.2.2](https://developer.apple.com/app-store/review/guidelines/#intellectual-property) (üçüncü taraf hizmet şartları), [1.4](https://developer.apple.com/app-store/review/guidelines/#physical-harm), [2.5.14](https://developer.apple.com/app-store/review/guidelines/#software-requirements) (kayıt ya da kullanıcı etkinliğini izlemede açık rıza ve görünür gösterge). Play [Device and Network Abuse](https://support.google.com/googleplay/android-developer/answer/9888379): bir hizmete şartlarını ihlal ederek erişmek. Play politika takviminde 14 Nisan 2027 tarihli AppFunctions maddesi AI ajanlarını aldatmayı ve güvenliği aşmayı yasaklıyor (bize doğrudan değil, yönü gösteriyor). Apple'da "ajan" için özel bir madde yok.
- **Bizde ne var:** Gönderi, mesaj, ödeme ve silme işlemleri her seferinde Qutai'nin kendi onay diyaloğundan geçiyor. Ödeme varsayılan olarak kapalı, "bir daha sorma" yok, tutar sayfadan okunuyor ve kontroller hata durumunda işlemi durduruyor **[kodda doğrulandı]**: `PAY-1` ile `PAY-28` ([07-posting-and-paying.md](design/07-posting-and-paying.md)). Ödeme diyalog metinleri ve sahte kartlı demo sitesi tanıtım videosunda kullanılıyor.
- **Olasılık:** düşük-orta. Tasarım iyi; risk, inceleme ekibinin "bot/otomasyon" diye yanlış anlaması **[tahmin]**.
- **Çözüm:** İnceleme notunda onay akışını açıkça yazın (§5). Mağaza açıklamasında "her şeyi otomatik satın alır" gibi bir abartı olmasın. "Ödemeyi yalnızca siz onaylayınca yapar" deyin. Ekran görüntülerinde gerçek kart ya da marka olmasın (Apple 2.3.9: kurgusal veri).

### 3.5 Kullanıcı betikleri ve stilleri, asistanın sayfada betik çalıştırması
- **Mağaza:** her ikisi
- **Kural:** Apple [2.5.2](https://developer.apple.com/app-store/review/guidelines/#software-requirements). Play [Device and Network Abuse](https://support.google.com/googleplay/android-developer/answer/9888379) (yorumlanan kod ihlale imkân vermemeli) ve [Deceptive Behavior §5](https://support.google.com/googleplay/android-developer/answer/9888077).
- **Bizde ne var:** "Kurallarım" ve kalıcı betikler ve stiller, betiklerin onayla çalışması, gizli sekmede çalışmaması **[kodda doğrulandı]**: [20-page-scripts.md](design/20-page-scripts.md), [18-page-styles.md](design/18-page-styles.md), `src/components/BrowserView.tsx:184`. Kod yalnızca web sayfasının içinde çalışıyor ve uygulamanın kendi özelliklerini değiştirmiyor.
- **Olasılık:** düşük-orta
- **Çözüm:** İnceleme notunda şunu yazın: "Betikler yalnızca kullanıcının açtığı web sayfasının içinde, kullanıcının onayıyla çalışır; uygulamanın yerel koduna ya da özelliklerine dokunmaz; Qutai sunucusundan kod indirilmez." Paylaşılabilen bir betik galerisi yapmayın (yapılırsa UGC şartları gelir).

### 3.6 Kişiler, konum ve takvim izinleri (Play'in 2027 değişiklikleri)
- **Mağaza:** Play (yakında), Apple (düşük)
- **Kural:** Play [Permissions and APIs](https://support.google.com/googleplay/android-developer/answer/9888170) ve [politika takvimi](https://support.google.com/googleplay/android-developer/table/12921780):
  - 27 Ocak 2027: geniş kişi erişimine ihtiyacı olmayan uygulamalar Android Contact Picker kullanmak zorunda. Hassas konum için konum düğmesi öneriliyor; API 37+ için `ACCESS_FINE_LOCATION` beyanı gerekecek.
  - 25 Ağustos 2027: Yerel Ağ izni beyanı.
  - Apple [5.1.1(iii)](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage): mümkünse seçici (picker) kullanın.
- **Bizde ne var:** `READ_CONTACTS` ile ada göre arama yapılıyor, en fazla 5 eşleşme alınıyor ve numaralar AI'a gitmiyor (`docs/permissions.md`, [17-contacts.md](design/17-contacts.md)). İnce ve kaba konum ön planda. `WRITE_CONTACTS` engelli **[kodda doğrulandı: app.json blockedPermissions, AndroidManifest `tools:node="remove"`]**.
- **Olasılık:** bugün düşük, Ocak 2027'den sonra orta
- **Çözüm:** Kişi aramasını Contact Picker'a geçirmeyi planlayın, ya da Console'da "çekirdek özellik" beyanına hazırlanın. İnce konumu isteğe bağlı yapın (yaklaşık konum zaten kabul ediliyor).

### 3.7 Kredilerin süresi, deneme kredisi vaadi
- **Mağaza:** Apple (3.1.1), Play (Payments §5-6)
- **Kural:** Apple [3.1.1](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase): uygulama içi satın almayla alınan kredilerin **süresi dolmamalı**. [3.2.2](https://developer.apple.com/app-store/review/guidelines/#unacceptable): kiralık içerik dışında hiçbir öğenin süresi dolmamalı. Play [Payments](https://support.google.com/googleplay/android-developer/answer/9858738): sanal para yalnızca satın alındığı uygulamada kullanılmalı (§5), fiyat açık olmalı (§6).
- **Bizde ne var:** "Krediler süresiz mi" bilerek kararsız bırakılmış (`CRED-35`, `LEGAL-11`) **[kodda doğrulandı]**. Kredi yalnızca uygulama içi satın almayla, mağaza fiyatıyla alınıyor ve dışarıya bağlantı yok (`BUY-6`, doğrulandı). Sunucudaki deneme kredisi kararı da açık.
- **Olasılık:** düşük (süre eklenmezse)
- **Çözüm:** Süre koymayın ve şartlara "Satın alınan kredilerin süresi dolmaz" diye yazın. Deneme kredisi verilecekse mağaza metninde vaat edilen miktar uygulamada gerçekten verilsin. Kredi web'den satılırsa iOS'ta o bağlantı gösterilmesin (3.1.1(a); ABD istisnası dışında).

### 3.8 Hukuki metinler ve iletişim bilgisi
- **Mağaza:** her ikisi
- **Kural:** Apple [1.5 Developer Information](https://developer.apple.com/app-store/review/guidelines/#developer-information), [5.1.1(i)](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage) (gizlilik politikası hem App Store Connect'te hem uygulamada; kimlerle paylaşıldığı, ne kadar tutulduğu ve nasıl silindiği yazmalı). Play [User Data](https://support.google.com/googleplay/android-developer/answer/10144311) (herkese açık, PDF olmayan, bölgeye göre kısıtlanmamış politika).
- **Bizde ne var:** Metinler avukat görmemiş taslak (`LEGAL-10`). Uygulamalardan söz edilmiyor (`LEGAL-6`). İletişim adresi kişisel bir Gmail hesabı (`src/legal/proDocuments.ts:25`) **[kodda doğrulandı]**.
- **Olasılık:** orta (Apple genelde ret vermez ama Play'de politika bağlantısının içeriği kontrol ediliyor)
- **Çözüm:** Politikayı web sitesinde yayımlayın ve iki Console'a girin. Destek adresi alan adınızda olsun (ör. destek@…) ve App Store'daki "Support URL" çalışan bir sayfaya gitsin. Avukat incelemesini gönderimden önce yaptırın.

---

## 4. Düşük risk (bilgi için; çoğu doğrulandı)

| # | Konu | Kural | Bizde | Not |
|---|---|---|---|---|
| 4.1 | WebKit zorunluluğu | Apple [2.5.6](https://developer.apple.com/app-store/review/guidelines/#software-requirements) | `react-native-webview` iOS'ta WKWebView kullanıyor. Başka bir motor (Gecko, Chromium) yok. `pdfjs-dist` WebView içinde JS olarak çalışıyor **[doğrulandı: package.json]** | Uygun |
| 4.2 | Varsayılan tarayıcı | Apple'ın `com.apple.developer.web-browser` yetkisi (ayrı başvuru) | Entitlements dosyasında yalnızca Apple ile giriş var (`ios/Qutai/Qutai.entitlements`) **[doğrulandı]** | Varsayılan tarayıcı olmayı vaat etmeyin. İleride istenirse Apple'ın şartlarını ayrıca okuyun. Android'de http/https VIEW filtresi var, uygun |
| 4.3 | Apple ile giriş eşitliği | Apple [4.8 Login Services](https://developer.apple.com/app-store/review/guidelines/#login-services) | Google olan her iPhone'da Apple da var (`ACC-11`); e-posta ile giriş de var | Uygun |
| 4.4 | Genel reklam ve izleyici engelleme | Play Device and Network Abuse yalnızca **başka uygulamaların** reklamlarını kapsıyor; Apple'da özel bir madde yok | Filtre listeleri ağ düzeyinde, yalnızca kendi WebView'da ([09-blocking-and-my-rules.md](design/09-blocking-and-my-rules.md)) | Uygun (YouTube kuralı hariç, bkz. 1.3). Mağaza metninde site adı vermeyin |
| 4.5 | `QUERY_ALL_PACKAGES`, Accessibility, tam ekran intent, tam zamanlı alarm | Play [Permissions](https://support.google.com/googleplay/android-developer/answer/9888170) | Manifestte yok **[doğrulandı: AndroidManifest izin listesi]** | Uygun |
| 4.6 | Arka plan konumu | Play ve Apple 5.1.5 | `ACCESS_BACKGROUND_LOCATION` ve `FOREGROUND_SERVICE_LOCATION` kaldırılmış **[doğrulandı]** | Uygun |
| 4.7 | Fotoğraf izinleri | Play foto ve video politikası | `READ_MEDIA_IMAGES` ve `READ_MEDIA_VISUAL_USER_SELECTED` kaldırılmış; sistem seçicisi kullanılıyor **[doğrulandı]** | Uygun |
| 4.8 | Hedef API | Play [hedef API](https://support.google.com/googleplay/android-developer/answer/11926878): 31 Ağustos 2026'dan beri API 36 | `targetSdk = "36"` (react-native gradle) **[doğrulandı]** | Uygun |
| 4.9 | Android'de düz http | Kurallarda yasak yok | `usesCleartextTraffic=true` (`plugins/withCleartextBrowsing.js`), HTTPS-only ayarı var | Uygun; "tarayıcı" açıklaması yeterli |
| 4.10 | Gizli sekme iddiası | Apple [2.3](https://developer.apple.com/app-store/review/guidelines/#accurate-metadata), Play Deceptive Behavior | Web sitesi "Private means private" diyor (`webpage/src/data/features.ts:121`) | Gizli sohbetler de AI sağlayıcısına gidiyorsa ("diske yazılmaz" doğru olsa bile) mağaza metninde "AI isteği yine sağlayıcıya gider" deyin |
| 4.11 | Ses girişi ve kayıt göstergesi | Apple [2.5.14](https://developer.apple.com/app-store/review/guidelines/#software-requirements) | Mikrofon yalnızca düğmeyle açılıyor, titreşim ve gösterge var (`UI-16`, [25-voice.md](design/25-voice.md)) | Uygun |
| 4.12 | Başka markaların adı | Apple [2.3.7](https://developer.apple.com/app-store/review/guidelines/#accurate-metadata), [4.1(c)](https://developer.apple.com/app-store/review/guidelines/#copycats), [5.2.1](https://developer.apple.com/app-store/review/guidelines/#intellectual-property); Play Deceptive Behavior (metadata) | Web sitesindeki karşılaştırma Chrome, Brave, Opera, Perplexity Comet ve Gemini adlarını kullanıyor (`webpage/src/data/comparison.ts`) | Web sitesi mağaza metadata'sı değil. Ama mağaza başlığı, alt başlığı, anahtar kelimeleri ve ekran görüntülerinde rakip ya da YouTube adı ve logosu kullanmayın |
| 4.13 | Çerez görüntüleme | 5.1.1 | Yalnızca telefonda ([19-cookies.md](design/19-cookies.md)) | Uygun |
| 4.14 | Gizlilik manifestosu, required-reason API'ler | Apple'ın gizlilik manifestosu şartı | `app.json` › `privacyManifests` içinde UserDefaults, FileTimestamp, SystemBootTime ve DiskSpace nedenleri var **[doğrulandı]** | Uygun; toplanan veri türleri için bkz. 2.4 |
| 4.15 | Hesap zorunluluğu | Apple [5.1.1(v)](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage) | Kendi anahtar yolunda giriş yok; giriş yalnızca kredi için (`CRED-3`, `ACC-49`) | Uygun |
| 4.16 | Asgari işlev | Apple [4.2](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality) | Tam bir tarayıcı | Uygun |
| 4.17 | İnceleme hesabının güvenliği | (ret değil, güvenlik) | `ACC-54` bilerek açılmış bir arka kapı | İnceleme dışında kapalı tutun ve hesapta gerçek veri olmasın. Her güncelleme gönderiminde yeniden açmanız gerekeceğini unutmayın |

---

## 5. İnceleme notlarına yazılacaklar

Apple "Notes for Review" ve Play "App access › Any other instructions" alanlarına İngilizce yazın. Önerilen içerik:

1. **Giriş:** "Sign in › Email: `<inceleme adresi>`, code: `<6 haneli kod>`. The account has <N> credits." `review_login` inceleme bitene kadar açık kalmalı. Kodu ve adresi yalnızca bu alana yazın, başka yere değil.
2. **Satın alma:** "Credits are consumable in-app purchases (Settings › Qutai Credits › Buy). Sandbox purchases are enabled on our production server during review." Bu cümle yalnızca `BUY-32` gerçekten açıksa yazılmalı.
3. **Ne olduğu:** "Qutai is a WebKit-based web browser with an AI assistant. The assistant reads the page the user is on and can click and type on it at the user's request."
4. **Onaylar:** "Posting, sending messages, deleting, account changes and payments always stop at Qutai's own confirmation dialog showing the exact text or the total read from the page; payments are off by default (Settings › Assistant) and there is no 'don't ask again' for them."
5. **Üçüncü taraf AI'a veri:** "Before the first request, the user accepts a screen naming where the data goes (Qutai's server → Anthropic for Qutai Credits, or the provider of the user's own key). 'What was sent to the AI' in Settings lists every request." Bu, 2.3'teki kendi anahtar ekranı yapıldıktan sonra yazılmalı.
6. **AI içeriğini bildirme:** "Each answer and each app has ⋮ › Report." Bu, 1.1 yapıldıktan sonra yazılmalı.
7. **Uygulamalar (Apple 2.5.2 / 4.7):** "Apps are small personal tools the assistant writes at the user's request. They run in a sandboxed WKWebView with no network, cookies, navigation or native APIs beyond storage and clipboard. No code is downloaded from our servers; there is no store or catalogue. 'My apps' is the index of all apps on the device." (`APPS-47`)
8. **Betikler ve stiller:** "User scripts/styles run only inside web pages the user opens, after the user approves them; they never change the app's own functionality."
9. **Arka plan:** iOS: "Audio background mode is used only for audio the user starts on a website, like Safari." Android: her ön plan hizmeti türü için tek cümle ve video bağlantısı.
10. **Konum, kişiler, takvim:** "Asked only when the feature is used. Contact numbers and email addresses are never sent to the AI."
11. **Kendi anahtar ve özel uç nokta:** "Optional: users may use their own API key with a provider they already have an account with. This does not unlock any paid feature of Qutai." Bu cümle 3.1.1'deki lisans anahtarı yasağıyla karışmasın diye yazılmalı **[tahmin]**.
12. **Demo:** Uzun bir akışı (ör. ödeme diyaloğu) bir test sitesinde nasıl göreceklerini yazın. Tanıtım videosundaki gibi sahte kartlı bir demo site adresi verebilirsiniz.

---

## 6. Mağaza formlarında doğru cevaplanması gerekenler

### 6.1 Yaş derecelendirmesi
- **Apple:**
  - "Unrestricted Web Access": **evet**.
  - Kullanıcı üretimli içerik ve sohbet: kullanıcılar arası paylaşım yok, ama AI sohbeti ve AI içerik üretimi var. Apple'ın güncel anketi bunu ayrıca soruyorsa evet.
  - Reklam: hayır.
  - Sonuç büyük olasılıkla 17+/18+ **[tahmin: anket bugün okunmadı]**.
- **Play (IARC):**
  - Tarayıcı ya da sınırsız internet: evet.
  - Kullanıcılar arası etkileşim: hayır.
  - Dijital satın alma: evet.
  - AI üretimli içerik: evet.
  - Target audience: 18+ (çocukları hedef kitleye eklemeyin; aksi halde Families politikası devreye girer).

### 6.2 Apple gizlilik etiketleri (pro derleme)
"Collected" = verinin telefondan çıkıp sizin ya da ortağınızın gerçek zamanlı hizmetten uzun süre erişebileceği biçimde tutulması. Gönderilip saklanmayan veri toplanan sayılmayabilir. Yorum sizin, emin değilseniz beyan edin.

| Veri | Beyan | Amaç | Kimliğe bağlı mı | İzleme |
|---|---|---|---|---|
| E-posta adresi (giriş) | Collected | App Functionality | Evet | Hayır |
| User ID (hesap numarası; RevenueCat'e de gidiyor) | Collected | App Functionality | Evet | Hayır |
| Satın alma geçmişi | Collected | App Functionality | Evet | Hayır |
| Diğer kullanıcı içeriği: sohbet, sayfa metni, ekran görüntüsü, sesten çevrilen metin | Kredi modunda Qutai sunucusu saklamıyor (`CRED-8`) ama Anthropic'e gidiyor. Anthropic'in saklama süresine göre büyük olasılıkla "Collected – App Functionality, not linked" **[tahmin]** | App Functionality | Hayır | Hayır |
| Hassas konum ya da yaklaşık konum | Yalnızca kullanıcı onaylarsa AI'a gidiyor. Gönderilirse beyan edin | App Functionality | Hayır | Hayır |
| Kişiler | AI'a yalnızca isim ve etiket gidiyor; numara ve adres gitmiyor. "Contacts" beyanı tartışmalı; isim gidiyorsa beyan edin **[tahmin]** | App Functionality | Hayır | Hayır |
| Takvim (onaylanan aralık AI'a) | "Other User Content" ya da "Sensitive Info" değil; "Other User Content" diye beyan edin | App Functionality | Hayır | Hayır |
| Yedek (isteğe bağlı, şifreli) | Uçtan uca şifreliyse Apple'a göre toplanan sayılmaz | — | — | — |
| Tarama geçmişi | Telefonda kalıyor; yalnızca şifreli yedekte. Beyan gerekmez | — | — | — |
| Çökme ve analiz | Yok (`CRED-37`, analiz yok) | — | — | — |

ATT (izleme izni): gerekmez. Reklam ve izleme yok.

### 6.3 Google Play Data safety
- **Toplanan veriler (gerekli):** e-posta; kullanıcı kimlikleri; satın alma geçmişi; "App activity › Other user-generated content" ve "Messages"(sohbet) ile "Photos" (gönderilen ekran görüntüsü ve fotoğraf). AI sağlayıcısına geçici işlem için gidiyorsa "ephemeral processing" işaretleyin. Play'e göre sohbet gibi içerik de kapsamda.
- **İsteğe bağlı:** hassas veya yaklaşık konum; takvim etkinlikleri; ses (Google'ın konuşma hizmeti ses alıyorsa bu Google'ın hizmeti; Qutai yalnızca metin alıyor). Kişiler: isim AI'a gidiyorsa beyan edin.
- **Paylaşım:** Anthropic ve RevenueCat sizin adınıza işleyen hizmet sağlayıcılarsa "sharing" sayılmaz (Play'in tanımı). Kendi anahtar modunda veri kullanıcının seçtiği sağlayıcıya gidiyor ve bu kullanıcının kendi eylemi. Hukukçunuzla netleştirin **[tahmin]**.
- **Web tarama:** Play, açık web gezintisini veri toplama sayılmayan durumlar arasında sayıyor; tarama geçmişi telefonda kaldığı için beyan gerekmez.
- **Güvenlik:** aktarım şifreli: **evet** (Qutai'nin kendi istekleri https; kullanıcının açtığı http sayfaları kendi tercihi). Silme isteği yolu: **evet**, uygulama içi ve 1.2'deki web sayfası.
- **Reklam:** "Contains ads: No".
- **İzin beyanları:** `REQUEST_INSTALL_PACKAGES`, her ön plan hizmeti türü (`mediaPlayback`, `dataSync`, `specialUse`) videolu; `READ_CONTACTS` için 2027'den sonra çekirdek özellik beyanı.

---

## 7. Özet: önce yapılacaklar (sıralı)

1. AI cevapları ve uygulamalar için uygulama içi "Bildir" (1.1, 2.2).
2. Web'de hesap silme sayfası ve Play Console bağlantısı (1.2).
3. Mağaza derlemelerinden YouTube video reklam engellemeyi kaldırma (1.3), iOS'ta YouTube arka plan taklidini kapatma (2.1).
4. İnceleme erişimi: `review_login`, inceleme hesabına kredi, production'da sandbox satın alma, iOS IAP ürünleri ve iOS RevenueCat anahtarı (1.4).
5. Kendi anahtar için üçüncü taraf AI rıza ekranı, gizlilik metinlerine uygulamalar cümlesi, pro derleme için doğru mağaza formları (2.3, 2.4, 3.8).
6. "Fix before launch" listesini kapatma: sahte satın alma metinleri ve "(deneme)" görünüm anahtarı (1.5).
