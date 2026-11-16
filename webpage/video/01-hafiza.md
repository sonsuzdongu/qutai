# Bölüm 1: Sizi tanır

**Fikir:** Qutai'ye bir kez söylersiniz, hatırlar. Ertesi gün yemek siparişi verirken glutensiz yemek arar, siz tekrar
söylemeden. Bilgi telefonunuzda durur, bir siteye yazılmadan önce size sorulur.

**Süre:** ~35 sn (ana kayıt), 15 sn (kısa kesit) · **Biçim:** 9:16 ana, 16:9 site versiyonu ·
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
| 4 | 0:09–0:12 | Ayarlar › Asistan › Hafıza ekranı: "Kimlik ve iletişim" altında "Adı Osman", "Yemek ve beslenme" altında "Gluten intoleransı var" | İki satır sırayla parlar | Telefonunuzda durur. Görebilir, değiştirebilir, silebilirsiniz. | It stays on your phone. See it, edit it, delete it. |

**Geçiş:** parşömen zemin üstünde kısa kart: "Ertesi akşam" / "The next evening" (1 sn).

### Perde B: Hatırlama

| # | Süre | Görüntü | Vurgu / grafik | Altyazı TR | Altyazı EN |
|---|---|---|---|---|---|
| 5 | 0:13–0:16 | Yeni bir sekmede yeni sohbet. Osman yazıyor: "Akşam için iki kişilik yemek siparişi ver." (gluten sözü yok) | — | Gluten demedi. | No mention of gluten. |
| 6 | 0:16–0:21 | İşlem satırları: "Açılıyor: lokanta…", "Sayfa okunuyor", "Yazılıyor (ref …): \"glutensiz\"". Sayfada arama kutusunda "glutensiz" yazar, sonuçlar süzülür | **Vurgu anı 2:** arama kutusuna yakınlaşma, rozet "Hafızadan". Köşede "Hızlandırıldı" | Ama Qutai hatırladı. | But Qutai remembered. |
| 7 | 0:21–0:24 | Asistanın yanıtı glutensiz seçenekleri listeler ve seçim düğmeleriyle sorar; Osman birine dokunur, ürün sepete eklenir | — | Seçimi siz yaparsınız. | You choose. |
| 8 | 0:24–0:28 | Teslimat formu. Uygulamanın penceresi: "Kişisel bilgileriniz lokanta… sitesine girilsin mi?" → Osman "Bir kez izin ver"e dokunur; ad ve adres alanları dolar | **Kontrol anı:** pencereye yakınlaşma | Bilgileriniz sorulmadan girilmez. | Your details go in only when you say so. |
| 9 | 0:28–0:31 | Ödeme adımı: asistan durur ve ödemenin size kaldığını yazar | Ödeme düğmesine hafif vurgu | Ödemeyi siz yaparsınız. | You make the payment. |
| 10 | 0:31–0:35 | **Kapanış kartı:** Q logosu, slogan, alt satır | Küçük not, altta | Qutai. Sizi tanır, telefonunuzda. · Açık kaynak · Yakında App Store ve Google Play'de | Qutai. It knows you, on your phone. · Open source · Coming to the App Store and Google Play |

Kapanıştaki küçük not: "Alerjen bilgisini her zaman restoranla doğrulayın." / "Always confirm allergens with the
restaurant." Ayrıca köşede "Gerçek ekran kaydı. Hızlandırılan yerler belirtilmiştir." / "Real screen recording;
sped-up parts are marked."

### 15 saniyelik kısa kesit

Sahne 1 (1 sn) → 2 (2 sn) → 3 (3 sn) → geçiş (0,5 sn) → 5 (2 sn) → 6 (3,5 sn) → 10 (3 sn).

## Seslendirme (isteğe bağlı; ElevenLabs)

Sakin, sıcak, kısa cümleler; altyazıyla aynı sözler, sahnelerin üstüne:

| Sahne | Türkçe | English |
|---|---|---|
| 1–3 | Qutai'ye bir kez söyleyin. Hatırlar. | Tell Qutai once. It remembers. |
| 4 | Telefonunuzda saklanır; görebilir, silebilirsiniz. | It stays on your phone, where you can see it and delete it. |
| 5–6 | Ertesi akşam yemek isteyin. Söylemenize gerek yok: glutensiz arar. | The next evening, ask for dinner. No need to say it again: it looks for gluten-free. |
| 8–9 | Bilgileriniz sorulmadan girilmez. Ödemeyi siz yaparsınız. | Your details go in only when you say so. You make the payment. |
| 10 | Qutai. Sizi tanır, telefonunuzda. | Qutai. It knows you, on your phone. |

## Müzik (ElevenLabs)

Tarif: "Sakin, sıcak, hafif ritimli, sözsüz; ud ya da kanun benzeri telli bir motif üstünde yumuşak elektronik
vuruşlar; 35 saniye; 31. saniyede kapanışa doğru yükselip sönen." Sahne 3 ve 6'daki rozetlerde hafif bir "tık" sesi.
Bütün bölümlerde aynı müzik, değişen tek şey motifin varyasyonu.

## Teslim edilecekler

- `01-hafiza-tr.mp4`, `01-hafiza-en.mp4`: 9:16 ve 16:9, H.264 ve WebM, sitede kullanılmak üzere en fazla 6 MB
- `01-hafiza-tr.vtt`, `01-hafiza-en.vtt`: altyazılar
- Kapak görseli (sahne 3'ün karesi)
