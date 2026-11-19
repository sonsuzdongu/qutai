# Qutai: nerede ve nasıl tanıtılır

Tarih: 20 Kasım 2026. Sürüm 0.1.3; Google Play ve TestFlight'ta iç testte, herkese açık değil. Taslak metinler
[drafts.md](drafts.md) dosyasında.

## Kısa öneri

1. **Henüz büyük lansman yok.** Hacker News "Show HN" kuralı, insanların deneyemediği bir şeyi kabul etmiyor; Product
   Hunt da "kimsenin katılamadığı kapalı beta"yı uygun bulmuyor. Önce herkesin kurabileceği bir yol açılmalı:
   TestFlight herkese açık bağlantısı + Google Play açık test (ya da mağaza sürümü).
2. **Hikâye "kendi anahtarınızla" olmalı.** Satın alma çalışmıyor, sunucunun aylık 100 USD sağlayıcı sınırı var.
   Lansmanı "açık kaynak, kendi AI anahtarınız, veriler telefonda, önemli adımlarda önce sorar" üzerine kurun; Qutai
   Credits'i "yakında" diye anın.
3. **Sıra:** (a) sessiz aşama, 2–3 hafta: 30–100 test kullanıcısı, Türk geliştirici çevresi, birkaç uygun Reddit
   topluluğu; (b) Show HN (tek başına, bir hafta içi sabahı ABD saatiyle); (c) bir hafta sonra Product Hunt;
   (d) mağaza sürümüyle Türk basını ve AlternativeTo.
4. **Atlanacaklar:** r/opensource (Ekim 2026'dan beri AI projelerini ve tek kişilik projeleri yasaklıyor), ücretli AI
   dizinleri, "upvote grupları", awesome-privacy ve android-foss listeleri (resmî sürümdeki kapalı parçalar yüzünden
   şimdilik uymuyor).

## 1. Konumlandırma

**Kimin için.** Telefonda çok iş yapan, AI'ı zaten kullanan ve bir API anahtarı açmaktan çekinmeyen kişiler:
geliştiriciler, teknoloji meraklıları, gizliliğe önem verenler. İlk kitle, "Comet ilginç ama verilerimi
Perplexity'ye vermek istemiyorum" ya da "Chrome'daki Gemini sayfayla bir şey yapmıyor" diyenler. Sıradan kullanıcı
ancak Qutai Credits çalışınca (anahtarsız) kitleye girer.

**Tek cümle (İngilizce):** "Qutai is an open-source browser for iPhone and Android with an assistant that reads the
page and uses it for you, with your own AI key, and asks before anything that matters."

**Tek cümle (Türkçe):** "Qutai, sayfayı sizin için okuyup kullanan bir asistanla gelen, açık kaynak bir iPhone ve
Android tarayıcısı: kendi AI anahtarınızla çalışır, önemli adımlardan önce sorar."

**Okurun gözünde canlanan beş iş** (site ve README'den, abartısız):

1. İki üç ürün sekmesi açıp "hangisi daha uygun?" diye sormak: Qutai sekmeleri değiştirmeden okur, fiyat, teslimat ve
   garantiyi tabloya döker, isterseniz CSV verir.
2. "Bunu sepete ekle, 42 numara": ürünü sepete koyar, kayıtlı adresi o sitede kullanmak için izin ister; ödemeyi siz
   yaparsınız ya da her ödemeyi Qutai'ın kendi penceresinde (site, tutar, sipariş, ödeme yöntemi) onaylarsınız. Kart
   numarası, CVV, şifre ve tek kullanımlık kod asla yazılmaz.
3. Restoran ya da randevu formunu doldurmak, sonra takvime ekleme ve hatırlatma önermek; telefonla rezervasyon alan
   yerde size Ara düğmesi vermek.
4. Derin araştırma: birçok sayfa ve PDF okuyup kaynaklarıyla rapor yazmak, PDF olarak paylaşmak (birkaç dakika sürer,
   daha çok API kredisi harcar).
5. "Notlarımı tutacağım bir uygulama yap": Qutai küçük bir uygulama yazar; internetsiz, gezintinizden ayrı bir
   alanda çalışır, eski sürümlere dönülebilir.

Yanında: "Yapay zekâya ne gönderildi" listesi (her istek, sağlayıcı, model, site, ne gittiği), site başına izinler
(serbest / her adımda sor / yalnızca oku / uzak dur), telefonda kalan ve kategorili bellek, şifreli yedek, reklam ve
izleyici engelleme, okuma modu, sesli komut, 10 arayüz dili.

**Neyle farklı.**

| Karşısında | Qutai'ın farkı (kaynakla desteklenen) |
|---|---|
| Comet, Edge Copilot, Chrome Gemini, Opera, Samsung Internet, DuckDuckGo, Brave Leo, Sigma | Açık kaynak (Apache-2.0): ajanın güvenlik kuralları ve AI'ya ne gittiği okunabilir. Kendi anahtarınız: Anthropic, OpenAI, Gemini, OpenRouter ya da kendi sunucunuz (Ollama, LM Studio, vLLM); konuşma başına model. Kendi anahtarınızla istekler telefondan doğrudan sağlayıcıya gider, Qutai sunucusu yoktur. Ödeme, paylaşım, silme ve hesap değişikliği Qutai'ın kendi penceresinde onay bekler; sayfadaki yazı bu pencereyi onaylayamaz. Ayrıntılı karşılaştırma ve kaynakları sitede (`webpage/src/data/comparison.ts`). |
| Chrome veya Safari + AI eklentisi/uygulaması | Android'de Chrome eklenti almıyor; iOS Safari eklenti alıyor ama yerleşik AI'ı kendi anahtarınızla seçemezsiniz. Ayrı bir AI uygulaması (ChatGPT, Claude) açık sekmelerinizi ve oturumunuzu görmez, sayfada dokunamaz. Qutai'da asistan tarayıcının içinde: sekmeleri okur, dokunur, yazar ve her adımı gösterir. (Bu satır genel bilgi; sitedeki karşılaştırma tablosu Chrome/Gemini hücrelerini kaynaklarıyla veriyor, iddiayı oradan kontrol edin.) |

Owner'ın Comet notlarındaki şikâyetler, Qutai'ın zaten cevap verdiği yerler (iddia değil, kodda olan): adres çubuğu
konumu ayarlanabiliyor, okuma modu, yer imi klasörleri ve içe aktarma, indirmeler, arka planda ses, reklam listesi
eklenebiliyor, asistan sayfa içeriğini okuyor. Bunları "Comet'ten iyi" diye değil, "bunlar da var" diye söyleyin;
çoğu gerçek telefonda geniş çapta denenmedi.

**Eleştirmenin soracakları ve dürüst cevaplar.**

| Soru | Cevap |
|---|---|
| "Tek kişi mi? Bir hafta sonra bırakırsa?" | Evet, tek geliştirici. Kod Apache-2.0, kendiniz derleyebilirsiniz; tasarım kaydı (`DESIGN.md`) her kararı yazıyor. |
| "0.1.3, test edilmiş mi?" | Hayır, geniş çapta değil. Özelliklerin çoğu testlerle ve simülatörde doğrulandı; sitede de böyle yazıyor. Geri bildirim için tam da bu yüzden açıyoruz. |
| "Prompt injection?" | Çözülmüş değil, sitedeki "Limits" bölümü bunu açıkça söylüyor. Ödeme, paylaşım, silme, hesap değişikliği, arama ve mesaj her zaman sizin dokunuşunuzu bekler; şifre, kart, CVV, tek kullanımlık kod alanlarına uygulama yazmayı reddeder; betikler varsayılan kapalı. Ama yanlı bir özet, kötü bir bağlantı ya da onay gerektirmeyen bir adım yine olabilir. (Bağlam: Brave'in Comet araştırması, bu sorunun bütün AI tarayıcılarında olduğunu söylüyor.) |
| "Bir tarayıcıya neden güveneyim?" | Kodu okuyun; "Yapay zekâya ne gönderildi" listesi her isteği gösterir; kendi anahtarla Qutai sunucusu yok; kaynaktan derlenen sürüm hiç Qutai sunucusuna bağlanmaz. |
| "Tarayıcı motoru kendi mi?" | Hayır: iOS'ta WebKit, Android'de sistem WebView (React Native / Expo). Bunu kendiniz söyleyin, HN'de mutlaka sorulur. |
| "User-Agent'ta `qutai.<build>` var, iz değil mi?" | Bilinçli karar (`DATA-23`), gizlilik ödünleşimi sahibin kararına açık. Sorulursa açıkça söyleyin. |
| "Qutai Credits sunucusu ne saklıyor?" | Hesap, kredi, istek başına model/token/maliyet; mesaj ve sayfa içeriği değil. Ama içerik sunucudan geçer; bunu gizlemeyin. |
| "Ücretli mi?" | Kendi anahtarınızla uygulama ücretsiz; AI maliyetini sağlayıcınıza ödersiniz, her cevabın yanında yaklaşık maliyet görünür. Qutai Credits henüz satılmıyor. |

## 2. Kanallar

Kurallar 20 Kasım 2026'da okundu. Reddit sayfaları bu ortamdan açılamadı; Reddit satırlarındaki bilgiler ikincil
kaynaklardan, **paylaşmadan önce her topluluğun kurallar sayfasını kendiniz okuyun.**

### Hacker News (Show HN): önerilir, ama herkese açık kurulum yolu açılınca

- Kurallar ([showhn](https://news.ycombinator.com/showhn.html), [guidelines](https://news.ycombinator.com/newsguidelines.html), [FAQ](https://news.ycombinator.com/newsfaq.html)):
  insanların deneyebileceği bir şey olmalı; kayıt sayfası, bekleme listesi, açılış sayfası olmaz. "Hazır değilse
  Show HN yapmayın." Başlık "Show HN:" ile başlar, abartı ve büyük harf yok. Oy ya da yorum istemek yasak, hesap ve
  site cezalandırılır. **AI ile yazılmış veya AI ile düzenlenmiş metin yasak**: başlığı ve ilk yorumu kendi
  kelimelerinizle yazın; buradaki taslak yalnızca içerik listesidir.
- Neden uygun: açık kaynak, kendi anahtar, prompt injection tartışması tam HN konusu. Benzer örnek: 2025'te
  açık kaynak masaüstü ajan tarayıcısı Nxtscape'in Show HN'i; ilk soru "neden eklenti değil de tarayıcı?" oldu.
- Ne gönderilir: GitHub deposu bağlantısı (site değil). İlk yorumda: ne olduğu, nasıl denenir (TestFlight bağlantısı,
  Play test bağlantısı, kaynaktan derleme), nasıl yapıldı (Expo/RN, WebKit/WebView), güvenlik modeli, sınırlar.
- Zamanlama: Salı–Perşembe, ABD doğu saatiyle 08:00–10:00 (Türkiye 16:00–18:00). Sonraki 6–8 saat bilgisayar
  başında olun. Tutmazsa: "az ilgi gördüyse birkaç kez tekrar gönderilebilir"; silip yeniden göndermeyin.
- Emek: hazırlık 1 akşam, gün boyu cevap.

### Product Hunt: önerilir, HN'den sonra

- Kurallar ([launch guide](https://help.producthunt.com/en/collections/19793093-launch-guide), [featured](http://help.producthunt.com/en/articles/17734341-2-what-kind-of-products-get-featured), [page](http://help.producthunt.com/en/articles/17834537-4-build-your-product-page), [promote](http://help.producthunt.com/en/articles/17734384-5-how-to-promote-your-launch-and-what-to-avoid)):
  kişisel hesap (şirket hesabı olmaz), doğrulanmış e-posta; hunter gerekmez. Yarından 30 gün sonrasına kadar
  planlanır, 00:01 Pasifik'te (Türkiye 11:01) başlar, gece yarısına kadar sürer. "Canlı ya da net tarihle yakında";
  kimsenin katılamadığı kapalı beta uygun değil. "Asla oy istemeyin"; ücretli oy/yorum ban sebebi. Öne çıkarma
  editoryal: özgünlük, net bir fark, sade dil, "gerçekten çalışıyor".
- Sınırlar: ad 40, tagline 60, açıklama 500, ilk yorum 5000 karakter; logo 240×240, galeri 1270×760 (en az 1,
  3+ önerilir); en fazla 3 etiket.
- Zamanlama: Salı–Perşembe çok kalabalık; küçük bir ürün için Cumartesi/Pazar ya da Pazartesi daha az rekabet
  demektir (bu bir yargı, PH sayfası söylemiyor).
- Emek: galeri ve video hazırsa 1 akşam; gün boyu yorum.

### Reddit: seçerek

| Topluluk | Uygunluk | Bilinen kural (ikincil kaynak, doğrulayın) |
|---|---|---|
| r/LocalLLaMA | İyi: Ollama / LM Studio / vLLM ile kendi sunucunuza bağlanma | Kural 4 "Limit Self Promotion"; gönderi için minimum karma ([wiki aynası](https://r.datuan.dev/r/LocalLLaMA/wiki/index)). Gönderiyi yerel model kurulumu üzerine kurun. |
| r/androidapps | İyi | Geliştirici gönderileri bayrakla; r/Android'in kuralı uygulama önerilerini buraya yönlendiriyor ([r/Android kuralları aynası](https://axebps-redlib.hf.space/r/Android/wiki/rulesandregs)). |
| r/browsers | İyi | Kural okunamadı; yeni tarayıcı duyuruları görülüyor, tavsiye megathread'leri var. |
| r/TestFlight | Test kullanıcısı bulmak için | "[Recruiting]" etiketli gönderiler normal. |
| r/selfhosted | Zayıf | Yeni projeler yalnızca Cuma'ları yenilenen megathread'de, AI katkısı beyan edilmeli ([selfh.st](https://selfh.st/weekly/2026-03-20/)). Bir telefon tarayıcısı burada konu dışı kalabilir; atlayın ya da yalnızca megathread. |
| r/iOSapps | Riskli | Yakın tarihli bir mod notu "üretken AI uygulamaları şimdilik istenmiyor" diyor ([ayna](https://pol1.lr.ggtyler.dev/r/iosapps)). Modlara sorun, yoksa atlayın. |
| r/privacy | Riskli | Kendini tanıtma kısıtlı; bir AI tarayıcısı burada tepki alır. Atlayın. |
| r/opensource | **Atlayın** | 24 Ekim 2026'dan beri AI kullanan/AI için projeler yasak, en az 1 yıl ve 3+ katkıcı şartı ([Linux Magazine](https://www.linux-magazine.com/Online/News/r-opensource-Bans-AI-Assisted-and-AI-Related-Projects)). |
| r/SideProject | Orta | Geri bildirim tonu iyi karşılanıyor; kural okunamadı. |
| r/Turkey, r/KGBTR, r/CodingTR, r/Yazilim | Türkçe sessiz aşama | Kurallar okunamadı; okuyun. |

Genel: hesap geçmişi olmayan, yalnızca kendi ürününü paylaşan hesaplar silinir; Reddit'in genel çizgisi "kendi
içeriğiniz katkınızın küçük bir kısmı olsun". Aynı gün çok yere aynı metni atmayın.

### Sosyal ağlar

- **X:** Geliştirici ve AI kitlesi orada; kısa video şart. Takipçi yoksa erişim düşük; değeri, HN/PH günü bağlantı
  vermek ve Expo / React Native topluluğunu etiketsiz ama konuyla yakalamak.
- **Bluesky:** Açık kaynak ve gizlilik meraklıları daha sıcak; AI'a mesafeli bir kesim de var. Dürüst ton iyi çalışır.
- **Mastodon (fosstodon.org gibi):** AI'a karşı tepki güçlü; yalnızca "kendi sunucunuz / Ollama" açısıyla ve
  #OpenSource etiketiyle, bir kez. Kayıt kuralları sunucuya göre değişir, okuyun.
- **LinkedIn:** Türk iş çevresi ve olası işbirlikleri için; Türkçe kısa yazı + video. Düşük risk.

### Açık kaynak ve alternatif dizinleri

- **AlternativeTo:** Önerilir, mağaza sürümünden sonra. Hesap açıp "Suggest new application"; moderasyondan geçer
  ([FAQ](https://alternativeto.net/faq)). Comet, Arc Search, Brave'e "alternatif" olarak ekleyin.
- **F-Droid:** Şimdi değil. Google Play Services / Firebase gibi kapalı SDK'lar yasak; çözüm, bunlar olmadan derlenen
  bir sürüm ([Inclusion Policy](https://f-droid.org/docs/Inclusion_Policy/)). Qutai'ın repodan derlenen sürümü zaten
  sunucusuz; ama Expo/RN derlemesinin F-Droid'de kaynaktan yapılabilirliği ve Google oturum açma modülünün ayrılması
  doğrulanmadı. En az 3 ay aktif geliştirme ve bakım sözü istiyor. Daha kolay ara adım: **IzzyOnDroid** (GitHub
  sürümlerindeki APK'yı yayımlar; kapalı kütüphaneler işaretlenir, [bilgi](https://apt.izzysoft.de/fdroid/index/info)).
- **offa/android-foss:** "kapalı öğe yok", en az 6 ay ([CONTRIBUTING](https://github.com/offa/android-foss/blob/master/CONTRIBUTING.md)); şimdilik uymaz.
- **awesome-privacy:** "tanıtım yeri değil", çoğu öneri reddediliyor, paketli sürüm ve kullanıcı tabanı istiyor
  ([Contributing](https://github.com/pluja/awesome-privacy/blob/main/misc/Contributing.md)). Atlayın.
- **awesome-react-native, awesome-expo gibi listeler:** Teknik örnek olarak eklenebilir (kuralları okunmadı).

### AI dizinleri ve bültenleri

Yüzlerce "AI tools" dizini var; çoğu ücretli listeleme satar ve trafik getirmez. Ücretsizse yalnızca
**There's An AI For That** ve **Futurepedia** gibi bilinen birkaçına, mağaza sürümünden sonra 15 dakikalık bir iş
olarak. Ücret ödemeyin. (Kuralları bu çalışmada okunmadı.) Bültenlerde gerçek etki: **TLDR**, **Ben's Bites**,
**Console.dev** (açık kaynak geliştirici araçları), **Android Weekly** / **iOS Dev Weekly** (teknik bir yazı olursa),
**selfh.st weekly** (yerel model açısıyla). Hepsine bir kez, kısa e-posta; çoğu cevap vermez.

### YouTube ve kısa video

Kendi kanalınızdan 60–90 sn demo (aşağıda taslak) ve özellik başına 15 sn kesitler (`webpage/video/` dizisi zaten bu
kalıpta; `01-hafiza` hazır). YouTube Shorts, Instagram Reels, TikTok'a aynı dikey video. İnceleme yapan kanallara
(Android/iOS uygulama tanıtanlar) mağaza sürümünden sonra yazın; beta'yı tanıtmazlar.

### Geliştirici yazıları

En iyi getiriyi bu verebilir, çünkü HN'de "nasıl yaptım" yazıları ürün duyurusundan daha iyi karşılanır. Konu
önerileri: "Bir telefon tarayıcısında AI ajanının ödeme yapmasına nasıl izin verdik (ve sayfanın onu neden
onaylayamadığı)", "React Native ile tarayıcı yazmak: WebKit ve WebView sınırları", "Kendi anahtarla AI: istek
başına maliyeti telefonda hesaplamak". Önce kendi sitenizde yayımlayın, dev.to / Hashnode'a kanonik bağlantıyla
kopyalayın. dev.to kuralı: içerik "öncelikle tanıtım için" olmamalı, AI yardımı beyan edilmeli
([terms](https://dev.to/terms), [code of conduct](https://dev.to/code-of-conduct)).

### Basın

- **Yabancı:** Android Police, 9to5Google, Android Authority (mobil); The Verge / TechCrunch'a tek kişilik beta ile
  girmek zor, atlayın. Gizlilik ve güvenlik basını prompt injection konusunda yazı arıyor; "açık kaynak ve onay
  modelini açıkça yazan bir AI tarayıcı" açısı ilginç olabilir. Mağaza sürümünden sonra.
- **Türk:** **Webrazzi** "Girişiminizi Tanıtın" formu ([form](https://webrazzi.com/girisim-formu/); sayfa bu
  ortamdan açılamadı). Webrazzi daha önce başka yerde çıkmamış haberi tercih ediyor ve kendi yazısını yazıyor
  ([2012 rehberi](https://webrazzi.com/2012/09/02/girisiminizin-webrazzide-yer-almasi-icin-bilmeniz-gereken-her-sey/)):
  Türk basınına HN/PH'den önce ya da aynı hafta gidin. **ShiftDelete.Net**: iletişim sayfasında "Haber ihbarı"
  seçeneği ([iletişim](https://www.shiftdelete.net/iletisim?tur=ihbar)). İkisi de mağaza sürümü ister.

### Türk toplulukları

- **Technopat Sosyal**, **DonanımHaber Forum**: kurallar bu ortamdan açılamadı (403). Genelde "kendi ürününü
  tanıtma" ayrı bölümlerde ya da yasak; açmadan önce kuralları okuyun, uygulama/yazılım bölümünde "geri bildirim
  istiyorum" diye açın.
- **Ekşi Sözlük:** Kendi ürününüze entry girmek kurallara ve topluluğa ters düşer, ters tepebilir. Atlayın; başkası
  başlık açarsa orada cevap vermeyin, sorulanları GitHub'da yanıtlayın.
- **Türk geliştirici toplulukları** (Discord/Telegram grupları, r/CodingTR): sessiz aşama için en iyi yer, çünkü
  Türkçe arayüz ve "siz" dili burada test edilir. Kuralları bu çalışmada araştırılmadı.

### Atlanacaklar, kısaca

r/opensource (AI yasağı), r/privacy (tepki), Ekşi Sözlük (kendini tanıtma), awesome-privacy ve android-foss (şimdilik
uymuyor), ücretli AI dizinleri ve "launch platform" siteleri, upvote değiş-tokuş grupları (HN ve PH'de ban sebebi),
büyük teknoloji basını (beta için).

## 3. Hazır olma

| Kanal | Önce şunlar doğru olmalı |
|---|---|
| Sessiz aşama | TestFlight herkese açık bağlantısı (ilk sürüm Beta App Review'dan geçmeli, en fazla 10.000 kişi; [Apple](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers)) ve Play kapalı/açık test bağlantısı. Geri bildirim yolu: GitHub Issues şablonu + uygulama içinden e-posta. README'nin ilk ekranında "nasıl denenir". |
| Show HN | Yukarıdakiler + herkesin kurabileceği yol (TestFlight bağlantısı ve Play testi; kayıt gerektirmeyen). Sitedeki "Not in the stores yet: build it from the repository today" cümlesi güncellenmeli. Sunucu sorunları HN'yi etkilemez, çünkü hikâye kendi anahtar. |
| Product Hunt | Net bir tarih ya da canlı bağlantı; 3+ galeri görseli, 60–90 sn video, logo. |
| Türk basını, AlternativeTo, AI dizinleri | Mağaza sürümü (App Store ve Google Play'de herkese açık). Basın kiti: logo, 6 ekran görüntüsü (TR ve EN), kısa ve uzun tanım, kurucu fotoğrafı (isterseniz), iletişim. |
| Qutai Credits'i öne çıkarmak | `TODO.md` › "Before launch: remove fake purchases" ve RevenueCat; avukat kontrolü; App Attest / Play Integrity; çoklu hesap önlemi. O zamana kadar Credits'i reklamda öne koymayın. |

**Google Play notu:** Kişisel geliştirici hesabı 13 Kasım 2023'ten sonra açıldıysa, üretime çıkmadan önce en az 12
test kullanıcısıyla 14 gün kesintisiz kapalı test şart ([Google](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)).
Sessiz aşama bu 14 günü doldurmak için de iyi bir fırsat.

**Sıra ve ölçüler.**

| Aşama | Süre | Ne yapılır | Ne ölçülür | Durup düzeltme işareti |
|---|---|---|---|---|
| 0. Hazırlık | 1 hafta | Herkese açık test bağlantıları, README "nasıl denenir", demo videosu, 6 ekran görüntüsü, GitHub Issues şablonları | — | — |
| 1. Sessiz | 2–3 hafta | Türk geliştirici çevresi, r/TestFlight, r/androidapps, r/LocalLLaMA (birer gönderi, aralıklı) | Kurulum → anahtar girip ilk görevi yapanlar oranı; çökme; hangi görev başarılı; issue sayısı | İlk görevde %30'dan fazla takılma; çökme; anahtar kurulumunda kafa karışıklığı; bir prompt injection raporu |
| 2. Show HN | 1 gün + 1 hafta | Tek gönderi, gün boyu cevap | GitHub yıldızları, TestFlight katılımı, gelen issue'lar, en çok sorulan 3 soru | Güvenlikle ilgili somut bir açık: önce düzelt, sonra devam |
| 3. Product Hunt | 1 gün | HN'den 7–10 gün sonra | Ziyaret, test katılımı, yorumlar | — |
| 4. Mağaza + Türk basını + dizinler | Mağaza onayı sonrası | Webrazzi formu, ShiftDelete, AlternativeTo, LinkedIn, X/Bluesky | İndirmeler, puanlar, 7 günlük geri dönüş | Ortalama puan 3,5 altı: yeni lansman yok, düzeltme |
| 5. Credits | Satın alma çalışınca | Ayrı bir "anahtarsız kullanım" duyurusu | Ücretli dönüşüm, istek başına maliyet | Aylık sağlayıcı sınırına %80'de yaklaşma |

**Lansman günü, tek kişi.** Gerçekçi olan: bir kanal, bir gün. Takvimi boşaltın; ilk 2 saatte her yoruma 15 dakika
içinde cevap; sık soruların cevaplarını (motor, güvenlik, sunucu, fiyat, User-Agent) önceden kendi cümlelerinizle
not alın. Kendi anahtarla gelen kullanıcı sunucuya yük bindirmez; bu yüzden lansmanı Credits'siz yapmak sunucu
riskini de kaldırır. Credits açıksa: aylık 100 USD sınırı birkaç yüz meraklıyla günler içinde dolabilir; sunucu
sınırda durur ve %80 / %100'de uyarır, ama uyarı adresi tanımlı değil (19 Kasım kararı) — lansmandan önce bir uyarı
adresi ekleyin ve sağlayıcı konsolunda da sınır koyun. Yeni hesaplara ücretsiz kredi vermeyin (çoklu hesap önlemi
yok). Bir şey bozulursa: gönderide kısa ve dürüst bir güncelleme yazın, sessiz kalmayın.

## 4. Taslaklar

[drafts.md](drafts.md): Show HN başlığı ve ilk yorum (yalnızca içerik listesi; HN kuralı gereği kendiniz
yazacaksınız), Product Hunt metinleri ve galeri planı, üç Reddit gönderisi, X/Bluesky dizisi, Türkçe duyuru, kısa
basın notu, 60–90 sn demo videosu akışı.

## 5. Sahibin kararları

1. Product Hunt ve HN'de görünecek kişisel hesap kimin? PH şirket hesabını kabul etmiyor; yüzünüzü ve adınızı
   göstermek istiyor musunuz, yoksa yalnızca kullanıcı adı mı?
2. Satın alma çalışmadan herkese açık lansman: yalnızca "kendi anahtarınız" ile mi, yoksa satın almalar canlıya
   çıkana kadar bekleyecek miyiz?
3. Qutai Credits'i lansmanda nasıl anlatalım: "yakında" mı, hiç anmayalım mı, yoksa sınırlı ücretsiz deneme mi?
4. Hangi ülkeler önce? (Türkiye + İngilizce konuşan ülkeler öneriyorum; mağaza sürümünde fiyat ve hukuk buna göre.)
5. Sunucu hakkında ne kadar konuşalım: sunucu kodu ayrı depoda; açık mı, kapalı mı kalacak? HN'de sorulacak.
6. Google Play geliştirici hesabınız kişisel mi, kurumsal mı, ne zaman açıldı? (12 kişi / 14 gün kuralı)
7. TestFlight herkese açık bağlantısını ve Play açık testi açmaya hazır mısınız, kaç kişiyle sınırlayalım?
8. User-Agent'taki `qutai.<build>` kararı lansmandan önce kalsın mı? Gizlilik kitlesinde ilk eleştirilerden biri olur.
