# Bölüm 1: Sizi tanır

**Fikir:** Qutai'a bir kez söylersiniz, hatırlar. Ertesi gün yemek siparişi verirken glutensiz yemek arar, siz tekrar
söylemeden. Bilgi telefonunuzda durur, bir siteye yazılmadan önce size sorulur.

**Süre:** ~37 sn (ana kayıt), 15 sn (kısa kesit) · **Biçim:** 9:16 ana, 16:9 site versiyonu ·
**Diller:** Türkçe ve İngilizce altyazı ve seslendirme

**Sahnedeki kişi:** Osman (test hafızası; adres, telefon ve kart gerçek değil).

## Hazırlık

- **Hafıza:** Ayarlar › Asistan › Hafıza boş başlar (önceki kayıtlar silinir). "Benimle ilgili bilgileri hatırla" açık.
- **Demo restoran sitesi (`video/demo-sites/lokanta/`):** markasız; menüsünde etiketli glutensiz yemekler, bir arama
  kutusu, sepet, ad, adres ve telefon soran bir teslimat formu ve bir ödeme adımı var.
- **Hafızadaki teslimat bilgisi:** Kayıttan önce hafızaya bir test adresi eklenir. Böylece 8. sahnede "Kişisel
  bilgileriniz … girilsin mi?" sorusu ad ve adres için birlikte gelir.
- **Model:** Bütün çekimlerde aynı model. Model "glutensiz"i kendiliğinden aramazsa çekim tekrarlanır. Arama uydurulmaz:
  hafızadaki bilginin gerçekten kullanıldığı çekim seçilir.

## Sahneler

Arayüz metinleri uygulamanın kendi metinleridir (`src/i18n/tr.ts`, `en.ts`). "Rozet" ve "altyazı" film
grafikleridir, arayüzün parçası değil.

### Perde A: Tanışma

| # | Süre | Görüntü | Vurgu / grafik | Altyazı TR | Altyazı EN |
|---|---|---|---|---|---|
| 1 | 0:00–0:02 | **Açılış kartı:** `memory` minyatüründen kesit (robot sandığa hatıraları yerleştiriyor), yavaş yakınlaşma | Serif başlık | Sizi tanır. | It gets to know you. |
| 2 | 0:02–0:06 | Qutai paneli açık; Osman yazıyor: "Adım Osman ve gluten intoleransım var." | Mesaj balonu belirince hafif yakınlaşma | Bir kez söyleyin. | Say it once. |
| 3 | 0:06–0:09 | Panelde işlem satırları belirir: "Hatırlanıyor: Adı Osman", "Hatırlanıyor: Gluten intoleransı var" | **Vurgu anı:** satırlara yakınlaşma, teal çerçeve, rozet "Hatırlandı" (onay ikonu) | Hatırladı. | Remembered. |
| 4 | 0:09–0:14 | Ayarlar › Asistan › Hafıza ekranı: "Kimlik ve iletişim" altında "Adı Osman", "Yemek ve beslenme" altında "Gluten intoleransı var" | İki satır sırayla parlar | Telefonunuzda durur. Görebilir, değiştirebilir, silebilirsiniz. | It stays on your phone. See it, edit it, delete it. |

**Geçiş:** parşömen zemin üstünde kısa kart: "Ertesi akşam" / "The next evening" (1 sn).

### Perde B: Hatırlama

| # | Süre | Görüntü | Vurgu / grafik | Altyazı TR | Altyazı EN |
|---|---|---|---|---|---|
| 5 | 0:15–0:18 | Yeni bir sekmede yeni sohbet. Osman yazıyor: "Akşam için iki kişilik yemek siparişi ver." (gluten sözü yok) | — | Gluten demedi. | No mention of gluten. |
| 6 | 0:18–0:23 | Asistan menüyü okur ve yalnızca glutensiz yemekleri sepete ekler (gerçek çekimlerde arama kutusuna yazmadı; menüden seçti). İngilizce çekimde bunu kendisi yazıyor: "Filter is off, but I'll just pick gluten-free items." Türkçe çekimde kanıt, teslimat formuna kendiliğinden yazdığı "Gluten intoleransı var, lütfen …" notu | **Vurgu anı 2:** o satıra teal çerçeve, rozet "Hafızadan". Köşede "Hızlandırıldı ×N" | Ama Qutai hatırladı. | But Qutai remembered. |
| 7 | — | Türkçe çekimde asistan glutensiz seçenekleri düğmelerle sorar, Osman birine dokunur (İngilizce çekimde sormadan glutensizleri seçti) | Seçilen düğmeye çerçeve | Seçimi siz yaparsınız. | You choose. |
| 8 | 0:26–0:30 | Teslimat formu. Uygulamanın penceresi: "Kişisel bilgileriniz lokanta… sitesine girilsin mi?" → Osman "Bir kez izin ver"e dokunur; ad ve adres alanları dolar | **Kontrol anı:** pencereye yakınlaşma | Bilgileriniz sorulmadan girilmez. | Your details go in only when you say so. |
| 9 | 0:30–0:33 | Ödeme adımı: asistan durur ve ödemenin size kaldığını yazar | Ödeme düğmesine hafif vurgu | Ödemeyi siz yaparsınız. | You make the payment. |
| 10 | son 4 sn | **Kapanış kartı:** Q logosu, slogan, alt satır | Küçük not, altta | Qutai: telefonunuzun tarayıcısında çalışan yapay zekâ asistanınız. · Açık kaynak · Yakında App Store ve Google Play'de | Qutai: the AI assistant in your phone's browser. · Open source · Coming to the App Store and Google Play |

Kapanıştaki küçük not: "Alerjen bilgisini her zaman restoranla doğrulayın." / "Always confirm allergens with the
restaurant." Ayrıca köşede "Gerçek ekran kaydı. Hızlandırılan yerler belirtilmiştir." / "Real screen recording;
sped-up parts are marked."

### 15 saniyelik kısa kesit

Sahne 1 (1 sn) → 2 (2 sn) → 3 (3 sn) → geçiş (0,5 sn) → 5 (2 sn) → 6 (3,5 sn) → 10 (3 sn).

## Seslendirme (isteğe bağlı; ElevenLabs)

Sakin, sıcak, kısa cümleler; altyazıyla aynı sözler, sahnelerin üstüne:

| Sahne | Türkçe | English |
|---|---|---|
| 1–3 | Bir kez söyleyin, yeter. Qutai hatırlar. | Tell Qutai once. It remembers. |
| 4 | Telefonunuzda saklanır; görebilir, silebilirsiniz. | It stays on your phone, where you can see it and delete it. |
| 5–6 | Ertesi akşam yemek isteyin. · Söylemenize gerek yok: glutensiz seçer. | The next evening, ask for dinner. · No need to say it again: it picks gluten-free. |
| 8–9 | Bilgileriniz sorulmadan girilmez. · Ödemeyi siz yaparsınız. | Your details go in only when you say so. · You make the payment. |
| 10 | Qutai: telefonunuzun tarayıcısında çalışan yapay zekâ asistanınız. | Qutai: the AI assistant in your phone's browser. |

## Müzik (ElevenLabs)

Tarif: "Sakin, sıcak, hafif ritimli, sözsüz; ud ya da kanun benzeri telli bir motif üstünde yumuşak elektronik
vuruşlar; 37 saniye; 33. saniyede kapanışa doğru yükselip sönen." Sahne 3 ve 6'daki rozetlerde hafif bir "tık" sesi.
Bütün bölümlerde aynı müzik, değişen tek şey motifin varyasyonu.

## Durum

- **Demo site:** `demo-sites/lokanta/`, gerçek bir yemek siparişi sitesi gibi: hayalî "yourlocal" platformunda
  "Lokanta Moda" (puan, teslimat süresi, kategoriler, sepet çubuğu, teslimat zamanı, ödeme). Üstte demo yazısı yok;
  hiçbir şey sipariş edilmez ya da ödenmez. Kayıtta `https://www.yourlocalfooddeliveryservice.com/` adresinden açılır
  (kurulum: `README.md`, "Demo alan adı"). İngilizce için `?lang=en`.
- **Seslendirme:** Türkçe ve İngilizce, ses "Ayça D." (`audio/01/<dil>-1, 2, 3a, 3b, 4a, 4b, 5.mp3`). Her dil tek
  istekte, satırlar arasında duraklamayla üretilip duraklamalardan kesiliyor (`make_voice_01.py`); satırları ayrı
  isteklerde üretince bazıları farklı biri okuyormuş gibi duyuluyordu. "Qutai" seslendirmede "Kutay" diye okunuyor
  (sahibinin kararı; yazıda ve altyazıda "Qutai"). Yazıya çeviriyle kontrol edildi.
- **Müzik:** `audio/01/music.mp3` (37 sn, sözsüz). Yeniden üretmek için `python3 make_music_01.py`.
- **Çekimler (2026-11-17, Claude Sonnet 5.5, iOS Simülatör):** `raw/` içinde, git'e girmez.
  - A (tanışma, hafıza ekranı): `ep01-tr-actA-take1.mp4`, `ep01-en-actA-take1.mp4`. Türkçe yanıtın ilk satırı ("Bu
    bilgiler zaten kayıtlıydı") doğru olmadığı için gösterilmiyor, yalnızca "Hatırlanıyor" satırları. İngilizcede
    "Remembering" satırları yanıtla aynı anda geliyor ve yanıt Türkçe çıktı; o an yakınlaştırılarak (kırpma)
    gösteriliyor.
  - B (sipariş, yeni demo site ve alan adıyla): `ep01-tr-actB-take3.mp4`, `ep01-en-actB-take2.mp4`. Türkçede asistan
    "Gluten intoleransın var, glutensiz seçenekleri baz alalım" deyip seçenek soruyor, iki kez kişisel bilgi izni ve
    teslimat saati soruyor, ödemede duruyor. İngilizcede soru sormadan yalnızca glutensiz seçiyor ("all
    gluten-free"), restorana glutensiz notu yazıyor, ödemede duruyor. Eski B çekimleri (localhost) artık kullanılmıyor.
  - Not: Uygulamada bir hata kayıtta göründü: asistan hafıza boşken de "zaten kayıtlıydı" diyor. Filme girmiyor;
    ayrıca bildirildi.
- **İngilizce yeniden çekim (2026-11-21, 0.1.7, arayüz değiştiği için):** Pro sürüm, Qutai Kredileri (model Qutai'ın
  seçtiği), iOS Simülatör, kişi adı **Emma** (İngilizce filmde Osman yok). Ayarlar › Asistan › "Let the assistant
  complete payments" açık. A: `ep01-en-actA-take3.mp4` ("Remembering: Name: Emma", "Remembering: Diet: gluten
  intolerant", hafıza ekranında ikisi). B: `ep01-en-actB-take6.mp4`, yazılı komut: asistan "Your saved note says
  you're gluten intolerant, so I can filter for gluten-free dishes" deyip seçenekleri düğmelerle sunuyor (biri glutensiz
  değil, "Mixed"), Emma ilk glutensiz seti seçiyor, sepet ve form doluyor, kişisel bilgi izni soruluyor, teslimat saati
  soruluyor, ödeme sayfasında sitenin kayıtlı kartı (Visa •••• 4242) var; Qutai'ın kendi ödeme penceresi siteyi, toplamı
  (₺720), siparişi ve ödeme yöntemini gösteriyor; onaydan sonra "Pay ₺720"ye bir kez basılıyor, "Order placed" çıkıyor
  ve Qutai takvime eklemeyi öneriyor. Demo sitede hiçbir şey ödenmez: kayıtlı kart yalnızca sayfadaki bir yazı.
  Simülatörün kayıt aracı ilk ~15 saniyeyi kaçırabildiği için (take 5'te komut ve "Thinking" kayboldu) kayda başladıktan
  sonra ~12 sn beklenip komut öyle gönderildi. Seslendirmede "You make the payment." yerine "It pays only when you
  approve." (İngilizce seslendirme tek istekte yeniden üretildi). Türkçe film henüz eski arayüzle.
- **Sesli komut (yapılmadı):** Planı Q düğmesine basılı tutup "Order dinner for two for this evening" demekti.
  Bu Mac'te kaydedilemedi: Xcode yalnızca komut satırı araçlarıyla kurulu olduğu için simülatörün mikrofon girişi yok;
  Android emülatörü (`demo-sites/dns.py` ve `serve.py --plain-80` ile alan adı çalışıyor) Mac mikrofonundan yalnızca
  sessizlik alıyor (`no-speech`). Sahibinin telefonundan sesli bir ekran kaydı gelince B'nin başına eklenecek.
  `audio/01/en-command.mp3` bu deneme için üretilen sentetik ses; filmde kullanılmıyor.
- **Kurgu:** `python3 edit_01.py [tr|en] [v|h|short]` (`out/`, git'e girmez). Kesme noktaları, çerçeveler, rozetler ve
  seslendirme zamanları betiğin içinde. Yalnızca kesme, hız (işaretli), kısa donmuş kare, yakınlaştırma ve üstüne
  film grafikleri; uygulama ekranı değiştirilmiyor. Ses: müzik konuşma sırasında kısılıyor, toplam −16 LUFS.
- **Çıktılar (`out/`):** `01-hafiza-tr.mp4` (45 sn, 9:16), `01-hafiza-tr-16x9.mp4`, `01-hafiza-tr-15s.mp4`; aynıları
  `-en` ile (21 Kasım çekimiyle 54 sn, kısa kesit 15 sn). Her biri `.webm` ve `.vtt` ile; kapak `01-hafiza-{tr,en}-cover.jpg`. MP4'ler 1–2 MB.
- **Kalan:** Videoları siteye koymak ayrı bir iş (henüz yapılmadı). Filmler yayımlanmadan önce demo alan adı
  alınmalı ya da sahibinin bir alan adıyla yeniden çekilmeli (README, "Demo alan adı").

## Teslim edilecekler

- `01-hafiza-tr.mp4`, `01-hafiza-en.mp4`: 9:16 ve 16:9, H.264 ve WebM, sitede kullanılmak üzere en fazla 6 MB
- `01-hafiza-tr.vtt`, `01-hafiza-en.vtt`: altyazılar
- Kapak görseli (sahne 3'ün karesi)
