# Mağaza gönderimi: inceleme notları, App Store Connect ve Play Console

Bu dosya, Qutai'ın pro derlemesini App Store'a ve Google Play'e gönderirken yapılacakları tek yerde toplar: inceleme ekibine yazılacak notlar (kopyalayıp yapıştırılacak İngilizce metin), App Store Connect'te ve Play Console'da doldurulacak alanlar, gönderimden önce ve sonra sunucuda açılıp kapatılacaklar.

- **Dayanak:** [store-review-risks.md](store-review-risks.md) (21 Kasım 2026; kuralların bağlantıları ve gerekçeleri orada). Madde numaraları (1.4, 2.2 …) o rapora aittir.
- **Durum:** 21 Kasım 2026, 0.1.9 (109). Bir madde değişirse bu dosyayı da güncelleyin.
- **İşaretler:** ☐ yapılacak · ⚠ yazmadan önce koşulu sağlanmalı · ⛔ henüz yapılmadı, bu hâliyle gönderilirse ret riski var.

---

## 1. Gönderimden önce sunucuda

| | Ne | Nerede | Neden |
|---|---|---|---|
| ☐ | İnceleme hesabı girişini (`review_login`) **açın** | Admin paneli › Settings | E-posta kodu inceleme ekibine ulaşmaz; sabit kodlu hesap gerekir (`ACC-54`, risk 1.4) |
| ☐ | İnceleme hesabına kredi yükleyin (ör. 300) | Admin paneli › Users | Ekip asistanı kredi satın almadan deneyebilsin |
| ☐ | "Test purchases in production" → **everyone** | Admin paneli › Settings (`BUY-32`) | Apple ve Google inceleme ekipleri production derlemesinde sandbox ile satın alır |
| ☐ | Hesapta gerçek veri olmasın | — | Hesap herkesin bildiği bir kodla açılıyor |
| ☐ | Web sitesi yayında olsun: gizlilik politikası ve hesap silme sayfası | `qutai.sonsuzdongu.com` | İki konsolun da girdiği bağlantılar (21 Kasım'da yayımlandı) |

**İnceleme bitince:** `review_login` kapatın, "Test purchases in production" kapatın ya da yalnızca kendi hesabınıza indirin. Her güncelleme gönderiminde ikisini yeniden açın.

---

## 2. İnceleme notları (İngilizce, yapıştırılacak metin)

Apple: App Store Connect › sürüm › **App Review Information › Notes** ve **Sign-in required** alanları.
Google: Play Console › Policy and programs › App content › **App access** › "All or some functionality is restricted" › talimat alanı.

`<…>` yerlerini doldurun. Giriş adresini ve kodu yalnızca bu alanlara yazın, mağaza açıklamasına ya da başka yere değil.

```text
SIGN-IN
Sign-in is only needed for Qutai Credits (the built-in AI). Tap the Q button or Settings › Qutai Credits › Sign in › Email.
Email: <review email>
Code: <6-digit review code> (no email is sent to this address; the code is fixed for review)
The account already has <N> credits.

WHAT QUTAI IS
Qutai is a WebKit-based web browser with an AI assistant. The assistant reads the page the user is on and, when the user asks, clicks and types on it. Everything the browser does works without signing in.

CONFIRMATIONS
Posting, sending messages, deleting, account changes and payments always stop at Qutai's own confirmation dialog that shows the exact text, or the total read from the page. The assistant completing payments is off by default (Settings › Assistant) and has no "don't ask again".

IN-APP PURCHASES
Qutai Credits are consumable in-app purchases (Settings › Qutai Credits › Buy). Sandbox purchases are accepted by our production server during review. Credits never expire and are not sold anywhere else.

REPORTING AI CONTENT
Every assistant answer and every app has ⋮ › Report. Reports reach us with the reason and, only if the user leaves the box ticked, the text.

APPS INSIDE QUTAI (Guidelines 2.5.2 and 4.7)
"Apps" are small personal tools the assistant writes at the user's request (for example a water tracker). They run in a sandboxed WKWebView with no network access, no cookies, no navigation and no native APIs beyond their own storage and the clipboard. No code is downloaded from our servers, and there is no store, gallery or sharing between users. "My apps" lists every app on the device; each app can be reported or deleted from there.

PAGE SCRIPTS AND STYLES (Guideline 2.5.2)
Scripts and styles run only inside web pages the user opens, after the user sees the code and approves it. Scripts are off until the user turns them on in Settings › Assistant. They never change the app's own functionality, and no code comes from our servers.

PRIVACY
Location, contacts and calendar are asked for only when the user uses that feature. Contact numbers and email addresses are never sent to the AI. Before the first request, the user accepts a screen naming where the data goes (Qutai's server and Anthropic for Qutai Credits, or the provider of the user's own key, or the host of their own server) and what is sent; Cancel sends nothing. With an own key the screen is shown again for a different provider or server. "What was sent to the AI" in Settings lists every request.

OWN API KEY (optional)
Users may instead use their own API key with an AI provider they already have an account with. This does not unlock any paid feature of Qutai.

BACKGROUND
iOS: the audio background mode is used only for audio the user starts on a website, as in Safari.

ACCOUNT DELETION
Settings › Account › Delete account, or on the web: https://qutai.sonsuzdongu.com/delete-account

CONTACT
qutai@sonsuzdongu.com
```

Eklemeden önce:

- ⚠ Menü yollarını ("Settings › Qutai Credits › Sign in", "Settings › Account › Delete account") gönderilecek derlemede İngilizce arayüzle bir kez açıp kontrol edin; inceleme ekibi tam olarak bu adımları izler.

- ✅ **Sahte satın alma kaldırıldı** (21 Kasım 2026, risk 1.5'in bu kısmı): kredi ekranında "Test mode" yazısı ya da "Get (test)" düğmesi artık yok; paket denetimi bu metinler geri gelirse paketi durdurur. Notlardaki "Sandbox purchases" cümlesi mağazanın kendi test satın almasını anlatır (`BUY-32`), sahte yolu değil.
- ⚠ **IN-APP PURCHASES** paragrafının ikinci cümlesini yalnızca "Test purchases in production" gerçekten **everyone** iken yazın.
- ✅ **IN-APP PURCHASES** "Credits never expire": karar verildi (21 Kasım, `LEGAL-11`); pro şartlar on dilde "kredilerin süresi dolmaz" diyor (yasal sürüm pro 7). Cümle kalabilir (risk 3.7).
- ✅ **Üçüncü taraf AI'a veri gönderimi** (21 Kasım 2026, risk 2.3): kendi anahtar modu için de rıza ekranı var (`AI-32`); cümle yukarıdaki PRIVACY paragrafında. İnceleme ekibi bunu kurulumun "Connect your AI" adımında kendi anahtarla, ya da ilk mesajda görür.
- ⛔ **Video reklam engelleme** (risk 1.3) ve iOS'ta arka plan oynatma (2.1): karar sizde. Mağaza derlemesinde kalacaksa inceleme notlarında site adı vermeyin.
- ✅ iOS: `release.mjs` artık RevenueCat iOS anahtarı olmadan pro IPA çıkarmıyor (`BUY-33`; bilerek satın almasız paket için `--without-purchases`).
- ✅ iOS'ta "Varsayılan tarayıcı yap" satırı gizlendi (`INTRO-32`): Apple'ın `com.apple.developer.web-browser` yetkisi alınana kadar. Mağaza açıklamasında da bu vaat olmasın.
- ✅ Satın alma ekranı ve değerlendirme mesajı yalnızca telefonun kendi mağazasını anıyor (`BUY-34`; Apple 2.3.10).

**Demo (isteğe bağlı):** ödeme onayını görmek isterlerse bir test sitesi verin (tanıtım filmlerindeki sahte kartlı demo site gibi). Adresi buraya yazın: `<demo site URL>`.

---

## 3. App Store Connect

### 3.1 App Information ve sürüm sayfası

| | Alan | Değer |
|---|---|---|
| ☐ | Privacy Policy URL | `https://qutai.sonsuzdongu.com/en/privacy-policy/` |
| ☐ | Support URL | `https://qutai.sonsuzdongu.com/en/support/` (her dilde o dilin sayfası, örneğin `/tr/support/`); iletişim adresi, mesaja yazılacaklar ve sık sorulan sorular var |
| ☐ | Marketing URL | `https://qutai.sonsuzdongu.com/en/` |
| ☐ | App Review Information › Contact | `qutai@sonsuzdongu.com` ve telefonunuz |
| ☐ | Sign-in required | Evet; §2'deki adres ve kod |
| ☐ | Notes | §2'deki metin |
| ☐ | Ad, alt başlık, anahtar kelimeler, ekran görüntüleri | Rakip tarayıcı, YouTube ya da başka marka adı ve logosu yok; "her şeyi otomatik satın alır" gibi abartı yok; ekranlarda gerçek kart ve gerçek kişi verisi yok (risk 3.4, 4.12) |
| ☐ | Varsayılan tarayıcı | Açıklamada "varsayılan tarayıcı yapılabilir" vaadi yok (yetki başvurusu yapılmadı; risk 4.2) |
| ☐ | Export compliance | `app.json` › `usesNonExemptEncryption: true` (21 Kasım, `OSPERM-25`): yedekler uygulamanın kendi kodunda standart algoritmalarla şifreleniyor. Build yüklenince sorulan soruya "Standard encryption algorithms instead of, or in addition to, using or accessing the encryption within Apple's operating system" deyin. Fransa bunun için ayrı beyan istediğinden Fransa satış dışı bırakıldı (Pricing and Availability); belge alınınca geri açın |
| ☐ | Kullanım şartları (EULA) | Varsayılan: Apple'ın standart EULA'sı (alanı boş bırakın). Sitede artık uygulamanın kullanım koşulları var (`WEB-14`, 21 Kasım): Qutai'ın kendi şartlarını özel EULA olarak vermek isterseniz App Information › License Agreement'a `https://qutai.sonsuzdongu.com/en/terms/` adresini (ya da metnini) koyun. Önce sitenin yayında olduğundan emin olun; şartlar uygulamada pro 7 ile kabul ettiriliyor (`LEGAL-25`) |
| ☐ | **Description (açıklama) alanının sonu** | Uygulama içi satın alma olduğu için açıklamanın sonuna iki bağlantı ekleyin (sahibin isteği, 21 Kasım; inceleme bağlantıları açıklamada arar):<br>`Privacy Policy: https://qutai.sonsuzdongu.com/en/privacy-policy/`<br>`Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`<br>Özel EULA seçerseniz ikinci satırı `Terms of Use (EULA): https://qutai.sonsuzdongu.com/en/terms/` ile değiştirin ve App Store Connect › App Information › License Agreement'ı da güncelleyin. Diğer dillerdeki açıklamalara aynı iki satırı ekleyin (gizlilik bağlantısını o dilin sayfasıyla: `/tr/privacy-policy/` gibi) |

### 3.2 Yaş derecelendirmesi

- "Unrestricted Web Access": **evet**.
- Yapay zekâ sohbeti ve AI içerik üretimi: anket soruyorsa **evet**. Kullanıcılar arası paylaşım: **yok**.
- Reklam: **hayır**.
- Beklenen sonuç büyük olasılıkla 17+/18+ (anketin bugünkü hâli okunmadı; doldururken kontrol edin).

### 3.3 App Privacy (gizlilik etiketleri, pro derleme)

| Veri | Beyan | Amaç | Kimliğe bağlı | İzleme |
|---|---|---|---|---|
| E-posta adresi | Collected | App Functionality | Evet | Hayır |
| User ID (RevenueCat'e de gidiyor) | Collected | App Functionality | Evet | Hayır |
| Satın alma geçmişi | Collected | App Functionality | Evet | Hayır |
| Other User Content: sohbet, sayfa metni, ekran görüntüsü, sesten çevrilen metin, bildirimler (Bildir) | Collected | App Functionality | Bildirimler hesaba bağlı; sohbet içeriği Qutai'da saklanmıyor ama Anthropic'e gidiyor | Hayır |
| Konum (onaylanırsa AI'a) | Collected | App Functionality | Hayır | Hayır |
| Kişiler (yalnızca isim ve etiket AI'a) | Collected | App Functionality | Hayır | Hayır |
| Takvim (onaylanan aralık AI'a) | Other User Content | App Functionality | Hayır | Hayır |
| Tarama geçmişi, şifreli yedek, çökme ve analiz | Beyan yok (telefonda kalıyor ya da uçtan uca şifreli; analiz yok) | — | — | — |

- ATT izni gerekmez (reklam ve izleme yok).
- ✅ Pro derlemenin gizlilik manifestosu toplanan veri türlerini listeliyor (`plugins/withProAccounts.js`, `OSPERM-26`): e-posta, kullanıcı kimliği, cihaz kimliği, satın alma geçmişi, diğer kullanıcı içeriği, diğer kullanım verisi. App Store Connect › App Privacy'de bugün "Other User Content" **yok**; ekleyip yayımlayın, yoksa manifest ile etiket uyuşmaz.

### 3.4 Uygulama içi satın almalar

- ☐ Kredi paketlerini **Consumable** olarak oluşturun; kimlikler Android'deki ve sunucunun listesindekiyle aynı (`com.sonsuzdongu.qutai.packs.*`). **1 kredilik paket (`…packs.1`) test ürünüdür ve mağazaya gönderilmez** (sahibin kararı, 21 Kasım): sürüme yalnızca 100, 500 ve 1000 kredilik paketleri ekleyin, Play'de de 1 kredilik ürünü etkinleştirmeyin ve admin panelindeki paket listesinde production'da görünmediğinden emin olun.
- ☐ Her pakete yerelleştirilmiş ad, açıklama ve inceleme ekran görüntüsü; durum "Ready to Submit".
- ☐ Paketleri ilk sürümle **aynı gönderimde** ekleyin.
- ☐ RevenueCat'te iOS uygulamasını ve App Store Connect bağlantısını kurun; IPA'yı iOS anahtarıyla derleyin.

---

## 4. Google Play Console

### 4.1 Policy and programs › App content

| | Bölüm | Değer |
|---|---|---|
| ☐ | Privacy policy | `https://qutai.sonsuzdongu.com/en/privacy-policy/` |
| ☐ | App access | "All or some functionality is restricted"; §2'deki metin, adres ve kod |
| ☐ | Ads | Contains ads: **No** |
| ☐ | Content rating (IARC) | Tarayıcı / sınırsız internet: **evet** · kullanıcılar arası etkileşim: **hayır** · dijital satın alma: **evet** · AI üretimli içerik: **evet** |
| ☐ | Target audience | **18+**; çocukları hedef kitleye eklemeyin (Families politikası devreye girer) |
| ☐ | Data safety | §4.2 |
| ☐ | Account deletion | Web bağlantısı: `https://qutai.sonsuzdongu.com/delete-account` (21 Kasım'da yayımlandı); uygulama içi silme de var |
| ☐ | Generative AI | AI içerik üretiyor; uygulama içi bildirme yolu: her cevapta ve her uygulamada ⋮ › Bildir |
| ☐ | Foreground service permissions | Her tür için tek cümle ve kısa video: `specialUse` (arka planda asistan görevi; başlatma, bildirim, Durdur), `dataSync` (indirme), `mediaPlayback` (bir sitede ses başlatıp ana ekrana çıkma). Risk 3.1, 3.2 |
| ☐ | Sensitive permissions | `REQUEST_INSTALL_PACKAGES`: "Tarayıcı; kullanıcı indirdiği bir APK'ya dokununca sistem yükleyicisine verilir." Risk 3.3 |

### 4.2 Data safety

- **Toplanan (gerekli):** e-posta; kullanıcı kimliği; satın alma geçmişi; App activity › other user-generated content (sohbet, sayfa metni, bildirimler); Messages (sohbet); Photos (gönderilen ekran görüntüsü ve fotoğraf). AI sağlayıcısına yalnızca işlenmek için gidenlerde "ephemeral processing" işaretleyin.
- **İsteğe bağlı:** konum; takvim; kişiler (isim AI'a gidiyorsa). Ses: Qutai yalnızca metni alır; tanıma telefonun ya da Google'ın hizmetinde.
- **Paylaşım:** Anthropic ve RevenueCat sizin adınıza işleyen hizmet sağlayıcıları; Play'in tanımına göre "sharing" sayılmaz. Kendi anahtar modunda veri kullanıcının kendi seçtiği sağlayıcıya gider. Kesin cevabı hukukçunuzla netleştirin.
- **Web gezintisi:** tarama geçmişi telefonda kalıyor; beyan gerekmez.
- **Güvenlik:** aktarım şifreli: **evet** · silme isteği yolu: **evet** (uygulama içi ve web sayfası).

### 4.3 Store listing ve hesap

| | Alan | Değer |
|---|---|---|
| ☐ | Contact details › Email | `qutai@sonsuzdongu.com` |
| ☐ | Website | `https://qutai.sonsuzdongu.com/en/` |
| ☐ | Başlık, kısa ve uzun açıklama, ekran görüntüleri | App Store'daki kurallar (§3.1): marka adı yok, abartı yok, gerçek kart yok |
| ☐ | Uzun açıklamanın sonu | `Privacy Policy: https://qutai.sonsuzdongu.com/en/privacy-policy/` (her dilde o dilin sayfası). Apple'ın EULA bağlantısı Play'e konmaz |

---

## 5. Gönderimi engelleyen açık işler

Bu dosyanın metinleri bunlar yapılmadan tam doğru olmaz. Ayrıntı ve çözüm önerisi [store-review-risks.md](store-review-risks.md) › §7'de.

- ⛔ **1.3 / 2.1:** video reklam engelleme ve iOS'ta arka plan oynatma. Sizin kararınız.
- ✅ **2.3:** ~~kendi anahtar modu için üçüncü taraf AI rıza ekranı; kredi açıklamasındaki sağlayıcı listesi~~: yapıldı (21 Kasım 2026, `AI-32`; kredi açıklaması artık yalnızca Anthropic diyor).
- ⛔ **1.5:** Ayarlar'daki "(deneme)" anahtarı. ~~Sahte satın alma yolu ve metinleri~~: kaldırıldı (21 Kasım 2026; production veritabanı için migration 0015 bir sonraki sunucu dağıtımıyla gider).
- ☐ **2.2:** başkasından alınan `.qutaiapp` dosyasının içe aktarılması (uyarı ekleyin ya da ilk sürümde kapatın); ~~gizlilik metnine uygulamalarla ilgili cümle~~: metinlerde (21 Kasım, `LEGAL-6`, `LEGAL-24`), yasal sürüm açık kaynak 5 / pro 7 ile kabul ettiriliyor (`LEGAL-25`).
- ✅ **2.4:** ~~pro gizlilik manifestosu ve `docs/permissions.md`'deki "sunucumuz yok" cümlesi~~: yapıldı (21 Kasım 2026, `OSPERM-26`; pro derlemede altı veri türü, açık kaynakta boş).
- ☐ **3.8:** yasal metinlerin avukat incelemesi.
- ☐ **Cihazda deneme (2.1, çökme ve bozuk özellik reddi):** 21 Kasım kod incelemesi düzeltmeleri (commit 8379e6c) telefonda denenmedi. Gönderilecek derlemede [test-checklist.md](test-checklist.md) › §32'yi bir kez geçin: güncellemeden sonra kayıtlı AI anahtarının yerinde durması (iPhone, `AI-33`), sekme sürükleme, PDF'e aktarma ve görsel indirme, Android'de sertifika uyarısında "Yine de devam et", sandbox satın alma. Bu commit mağaza formlarını değiştirmez: yeni izin, SDK, ağ hedefi ya da toplanan veri yok; gizlilik etiketleri, Data safety ve gizlilik manifestosu aynı kalır.

Yapılanlar (21 Kasım): uygulama içi Bildir (1.1, 2.2'nin bildirme kısmı), web'de hesap silme sayfası (1.2), iletişim adresi `qutai@sonsuzdongu.com` (3.8, `LEGAL-21`), inceleme hesabı admin panelinde açıldı (1.4'ün bir kısmı).
