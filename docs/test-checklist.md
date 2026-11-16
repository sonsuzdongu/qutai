# Qutai — telefonda test listesi

Kodda yapılmış ama gerçek cihazda henüz görülmemiş şeyler. En sonda toplu denenecek.
İşaretler: `[x]` denendi ve çalışıyor, `[ ]` denenmedi, `[!]` denendi ve sorun var (yanına not).

Son güncelleme: 2026-11-16. Denenecek APK'lar: `builds/qutai-release-arm64.apk` (normal),
`builds/qutai-release-arm64-pro-mode.apk` (pro mod, test girişi açık). İkisi aynı uygulama kimliğini
kullanır; biri diğerinin üzerine kurulur.

## 1. Pro mod: hesap ve krediler (pro-mode APK)

Sunucu: `cd backend && API_PORT=8000 npm run dev -w @qutai/api` (tünel 8000 portuna bakıyor).

- [x] Test girişi tünel üzerinden çalışıyor (Ayarlar › Hesap › Test girişi)
- [x] Yönetim panelinden test kullanıcısına kredi verilebiliyor
- [x] Gerçek sağlayıcı anahtarıyla relay çalışıyor (hangi sağlayıcı: … )
- [ ] Diğer sağlayıcılar da çalışıyor: Anthropic / OpenAI / Gemini (üçünün relay yolu ayrı)
- [ ] Rakamlar tutuyor: yanıtın altındaki kredi satırı = paneldeki defter düşüşü; token sayıları sağlayıcı
      panelindekiyle eşleşiyor
- [ ] Bakiye panelin başlığı altında ve Ayarlar › Hesap › Qutai Credits'te doğru görünüyor, son hareketler listeleniyor
- [ ] Kredi bitince: "yeterli kredi yok" mesajı çıkıyor ve yazılan mesaj (ekleriyle) giriş kutusuna geri geliyor
- [ ] İlk kullanımdan önce "içerik Qutai sunucusundan geçer" bilgilendirmesi ve açık seçim çıkıyor
- [ ] Uzun bir görev (çok adımlı) boyunca kredi her adımda düşüyor, görev bitince kilit kalkıyor
- [ ] Görev sürerken ikinci bir cihaz/sekmeden istek: "başka yerde görev çalışıyor" mesajı
- [ ] Sunucu kapalıyken: "sunucuya ulaşılamıyor" mesajı, uygulama takılmıyor
- [ ] Çıkış yap, yeniden gir: bakiye korunuyor
- [ ] Hesabı sil: kullanıcı panelde silinmiş görünüyor
- [ ] Panel: kullanıcı askıya alınınca uygulama "askıya alındı" diyor; geri açınca çalışıyor
- [ ] Web aramalı uzun Anthropic isteği (duraklatılan arama): görev notla bitiyor mu (bilinen eksik)
- [ ] Gemini 4 Hydrogen seçilince reddediliyor (bilinen eksik: sunucu fiyat tablosunda yok)

Sonraya kalanlar (bugün denenemez): gerçek Apple / Google girişi, satın alma ve iade (RevenueCat),
Cloudflare'e yayın ve Access.

## 2. İndirmeler ve bildirimler

- [ ] İndirilen APK'da "Aç": Android'in "bu kaynaktan izin ver" ekranı, sonra kurucu açılıyor
- [ ] Açılamayan dosyada (uygun uygulama yok, dosya silinmiş) ne yapılacağını söyleyen mesaj çıkıyor
- [ ] İndirme hapı kapatma düğmesiyle ve yana kaydırarak gizleniyor, indirme durmuyor
- [ ] Biten indirme hapta kısa süre "Aç" ile görünüyor; yeni indirmede hap geri geliyor
- [ ] "3 dakika sonra bildirim at": bildirime basınca istenen sekme açılıyor
- [ ] Aynı şey sekme değiştirilmişken, sekme kapatılmışken (grubun ilk sekmesi + kısa açıklama) ve uygulama
      kapalıyken (soğuk açılış)
- [ ] Uygulama kilidi açıkken bildirim kilidi bekliyor

## 3. Video: arka plan ve PiP (Android)

- [ ] samplelib videosu oynarken Ana ekrana dönünce PiP penceresi açılıyor
- [ ] PiP'te oynat / duraklat çalışıyor, pencereye dokununca uygulamaya dönüyor
- [ ] YouTube: Premium yoksa PiP açılmıyor ama ses arka planda sürüyor (beklenen)
- [ ] Arka planda ses: ekran kilitliyken sürüyor, bildirimden kontrol ediliyor
- [ ] Honor cihazda aynı davranış (Android sürümünü not et: … )

## 4. Kurulum (onboarding)

- [ ] İzin anahtarları bölümü: konum, takvim, bildirim vb. anahtarlar sistem iznini soruyor ve durumu doğru gösteriyor
- [ ] Takvim izni ilk açıldığında takvim seçme ekranı geliyor; seçim sonradan değiştirilebiliyor
- [ ] Şehir alanı: yazarken öneri yok; "Konumumu kullan" mahalle, ilçe, il, ülke dolduruyor (gelen adları not et)
- [ ] Kayıtlı e-posta otomatik doldurulunca telefon alanı ezilmiyor
- [ ] Kurulum bitince Qutai düğmesi tanıtımı çıkıyor
- [ ] Kurulumdaki "Sizi biraz tanıyayım" soruları artık "siz" diyor ("Size nasıl hitap edeyim?", "Hangi şehirde yaşıyorsunuz?"); uygulamanın başka bir yerinde "sen" kalmamış (gördüğünüz yeri not edin)
- [ ] Uzun soru başlıkları küçük ekranda sığıyor ("…bilgilerinizi şimdi doldurmak ister misiniz?"); özet ekranında "Değiştirmek için birine, silmek için ✕’e dokunun."

## 5. Asistan paneli

- [ ] Paneldeki mikrofon basılı tutulunca dinliyor, bırakınca gönderiyor
- [ ] Dinleme dili mesajın diline göre değişiyor
- [ ] Türkçe yer tutucu metin giriş kutusuna sığıyor
- [ ] "Araştırma raporu" (eski "deep search") açıklaması anlaşılır, alt boşluk düzgün
- [ ] Site izinleri hamburger menüden açılıyor
- [ ] "Her zaman Türkçe yanıt ver" seçeneği yok; eski sürümde bu seçeneğe dokunulduysa güncellemeden sonra Özel talimatlar'da o satır kalmamış, elle yazdığınız diğer satırlar duruyor
- [ ] Eski bir yedekten geri yükleme: "Her zaman Türkçe yanıt ver" satırı gelmiyor; yeni bir yedekte elle yazdığınız aynı cümle korunuyor
- [ ] Sağlayıcı metinleri "AI sağlayıcısı" diyor ("Anthropic'e gönderildi" değil)

## 6. Onay pencereleri ve ikonlar

- [ ] "Qutai bu işlemi yapmak istiyor" penceresinde emoji yerine ikon var
- [ ] Sohbetteki adım satırları, duraklatıldı / devam / durduruldu notları ve hatalar ikonlu
- [ ] Takvim, hatırlatıcı, bildirim onaylarında başlık, yer, uyarı ve not satırları ikonlu
- [ ] Qutai etkinliği ekranında araç ikonları; reddedilen adım kırmızı uyarı ikonuyla
- [ ] Sekme değiştirici, indirilenler, yer imleri, kilit ekranı, hata sayfasında emoji kalmamış
- [ ] Koyu ve açık temada ikon renkleri okunuyor

## 7. Maliyet satırı (kendi anahtarınla, normal APK)

- [ ] Her görevin son yanıtının altında "≈ $… · … token" satırı çıkıyor
- [ ] Dokununca model, istek sayısı, token dökümü ve sohbet toplamı görünüyor
- [ ] Rakam sağlayıcının panelindeki tutarla yaklaşık tutuyor (Anthropic / OpenAI / Gemini)
- [ ] OpenRouter ve özel adreste yalnızca token (ya da OpenRouter'ın bildirdiği tutar) görünüyor
- [ ] "Yapay zekâya ne gönderildi" ekranında istek başına ve günlük toplam maliyet
- [ ] Ayarlar › Asistan › Yaklaşık maliyeti göster kapatılınca ikisi de gizleniyor

## 8. Diğer

- [ ] Adres çubuğu varsayılan olarak altta
- [ ] Özel adres (OpenAI uyumlu) için ek başlıklar çalışıyor
- [ ] Özel adres: Cloudflare `api.cloudflare.com/client/v4/accounts/<hesap kimliği>/ai/run` adresi yapıştırınca uyarı çıkıyor; "Sohbet adresini kullan" adresi `…/accounts/<hesap kimliği>/ai/v1` yapıyor, anahtar ve model değişmiyor, altında anahtar (Workers AI Read izinli Cloudflare token'ı) ve model ipucu görünüyor; "Olduğu gibi bırak" uyarıyı gizliyor
- [ ] Özel adres: `…/ai/run/@cf/meta/llama-3.1-8b-instruct` yapıştırınca uyarıda bu model adı geçiyor; model alanı kendiliğinden dolmuyor
- [ ] Özel adres: `…/ai/v1` (ya da `…/ai/v1/chat/completions`) adresinde uyarı yok, yalnızca kısa bilgi satırı; `gateway.ai.cloudflare.com/…/compat` adresinde hiçbir not çıkmıyor
- [ ] Bağlantıyı test et, yanlış yollu Cloudflare adresiyle: "Sunucuya ulaşıldı", "Anahtar kontrol edilmedi", "Model kontrol edilmedi", ardından kırmızı "Bu adreste /chat/completions yok" ve sunucunun yanıtı (400: No route for that URI); "Araç çağırma yok" çıkmıyor
- [ ] Aynı adresle sohbette hata "API hatası 400: No route for that URI. Özel uç noktanın adresinde…" diye görünüyor (yalnızca "API hatası 400" değil); hata metninde anahtar yok
- [ ] `…/ai/v1` adresiyle (Cloudflare API token'ı, `@cf/…` model ve `cf-aig-gateway-id: default` başlığı; ayrıca `anthropic/…` model) Bağlantıyı test et: araç çağırma çalışıyor mu (Cloudflare belgelemiyor), çok adımlı bir görev
- [ ] Test satırları ekran okuyucuda durumuyla okunuyor (Geçti / Uyarı / Başarısız / Kontrol edilmedi)
- [ ] iOS: uygulama açılışta çökmüyor (WebKit düzeltmesi); kurulum, indirmeler ve bildirimler iOS'ta da denenmeli
- [ ] Otomatik doldurma: adresin tamamını doldurma engellendi mi, bu kabul edilebilir mi (karar bekliyor)

## 9. Qutai Kredileri (pro mod APK): kurulum, oturum ve kredi satın alma

Pro mod + test girişi açık APK (`EXPO_PUBLIC_PRO_MODE=on`, API adresi, `EXPO_PUBLIC_DEV_LOGIN=on`). Uygulama verisi silinmiş (ilk açılış) olarak başlanmalı.

### Çökme düzeltmesi
- [ ] Kurulumda yapay zekâ adımında Qutai seçilince uygulama çökmüyor; veri aktarımı açıklaması (disclosure) açılıyor

### Kurulum: Qutai önde, kendi anahtar ayrı yol
- [ ] Yapay zekâ adımında Qutai Kredileri kartı en üstte; hesap gerektiği, kredi harcadığı ve sayfa içeriğinin Qutai sunucusundan geçtiği yazıyor
- [ ] "Kendi yapay zekâ sağlayıcı anahtarımı kullanayım" ayrı ve daha sade duruyor; dokununca eski anahtar ekranı açılıyor (Qutai sekmesi orada yok), "Qutai Kredilerine dön" ile geri dönülüyor
- [ ] "Sonra karar vereyim" bir sonraki adıma geçiriyor
- [ ] "Qutai ile devam edin" → açıklama → "Şimdi değil": seçim ekranına dönüyor, üstte açıklayıcı not var
- [ ] Açıklamayı kabul edince oturum açma ekranı geliyor; Apple/Google kurulu değilse bu açıkça yazıyor, test girişi (test-1/2/3) görünüyor
- [ ] "Başka bir yol seçin" ya da üstteki geri oku seçim ekranına dönüyor, not görünüyor, Qutai seçili kalmıyor
- [ ] Sunucu kapalıyken ya da test girişi kapalıyken oturum açma: seçim ekranına dönüyor, neden yazıyor
- [ ] test-1 ile oturum açınca "Oturumunuz açık" ekranı: hesap, bakiye, "Kredi satın al" butonu
- [ ] "Devam" ile kurulum bitince asistan Qutai Kredileri ile açılıyor (panelin başlığında model ve bakiye)

### Oturum yokken Qutai
- [ ] Ayarlar › Hesap › Oturumu kapat: hesap sayfasında "Qutai Kredileri bu hesabı gerektiriyor" notu çıkıyor
- [ ] Oturum kapalıyken asistana mesaj gönderince: mesaj giriş alanında kalıyor (ekler de), hata satırının altında "Oturum açın veya başka bir yapay zekâ seçin" butonu, ve "Oturum aç / Kendi anahtarımı kullan / Şimdi değil" penceresi
- [ ] "Oturum aç" Ayarlar › Hesap'ı, "Kendi anahtarımı kullan" Ayarlar › Asistan'ı açıyor
- [ ] Ayarlar › Asistan'da oturum kapalıyken Qutai'ye dokununca seçilmiyor; "önce oturum açın" penceresi çıkıyor
- [ ] Hesabı silince (test kullanıcısı) uygulama çökmüyor, aynı not ve pencere davranışı
- [ ] Oturum süresi dolunca (ya da sunucu yeniden kurulunca) ilk mesajda aynı davranış, mesaj kaybolmuyor
- [ ] Yedekten geri yükleme (yeni kurulum): Qutai seçili ama oturum yok; ilk mesajda oturum açma penceresi geliyor

### Kredi satın alma ekranı
- [ ] Kurulumdaki "Kredi satın al", Ayarlar › Hesap › Qutai Kredileri › "Kredi satın al" ve "yetersiz kredi" hatasının altındaki buton aynı ekranı açıyor
- [ ] Ekranda bakiye, kredinin ne olduğu (tek satır), sunucunun paketleri (ör. 100 ve 500 kredi), mağaza notu, Kullanım Koşulları ve Gizlilik Politikası bağlantıları var
- [ ] Bu sürümde satın alma yok: "bu sürümde kredi satın alınamıyor" notu var, Satın al butonu yok, fiyat uydurulmamış
- [ ] "Eksik kredileri kontrol edin": "Eksik bir şey yok" yazıyor, bakiye yenileniyor
- [ ] Sunucu kapalıyken açınca paket yerine hata ve "Yeniden dene" görünüyor, uygulama çökmüyor
- [ ] Kredi 0 iken mesaj gönderince "yeterli krediniz yok… kredi satın alın" hatası ve altında "Kredi satın al" butonu (sağlayıcı anahtarları olan sunucuda)
- [ ] Koyu temada ve Türkçe dilde ekranlar düzgün; TalkBack butonları ve paketleri okuyor

### Gizlilik ve koşullar (pro mod)
- [ ] Daha önce kurulumu bitirmiş pro APK güncellenince "Gizlilik ve koşullar güncellendi" ekranı geliyor
- [ ] Özet maddeleri Qutai sunucusunu, hesabı ve kredileri anlatıyor ("sunucumuz yok" yazmıyor)
- [ ] Gizlilik Politikası ve Kullanım Koşulları hesap, Qutai Kredileri, satın alma ve hesap silme bölümlerini içeriyor (Türkçe ve İngilizce)

### Pro olmayan APK
- [ ] Normal APK'da kurulumun yapay zekâ adımı eskisi gibi (sağlayıcı sekmeleri, Qutai yok, oturum açma yok)
- [ ] Normal APK'da gizlilik ve koşullar eskisi gibi; güncelleme sonrası yeniden kabul istenmiyor

## Bulunan sorunlar

Deneme sırasında çıkanları buraya yazın; toplu düzeltilir.

- …

## 10. Sunucu: kademeler, duraklatma devamı, birlikte çalıştırma

Önce: `cd backend && npm run migrate:local`, panelde `allowed_models` listesine Claude Opus 5.5'i ekleyin,
sonra `cd backend && API_PORT=8000 npm run dev:together` (API 8000'de, panel http://localhost:8791).

- [ ] `dev:together` ile telefon çalışırken panelden kredi verince bakiye yeniden başlatmadan güncelleniyor
- [ ] Test girişi birlikte çalıştırmada da çalışıyor
- [ ] Panel › Settings'te kademe eşlemesi (`model_tiers`) değiştirilebiliyor, değişiklik denetim kaydına düşüyor
- [ ] Panel › Usage'da "By tier" tablosu doluyor
- [ ] Hafıza 10.000 karaktere, görsel 9'a kadar kabul ediliyor (mevcut yerel veritabanında ayarı panelden yükseltmek gerekir)
- [ ] Gemini 4 Hydrogen artık reddedilmiyor (1. bölümdeki "bilinen eksik" maddesi kapanır)

Uygulama kademe gönderdikten sonra (yeni APK gerekir):

- [ ] Her kademede (Hızlı / Qutai / Pro) bir görev çalışıyor, kredi kademeye göre düşüyor
- [ ] Konuşma sürerken `standard` kademesi başka modele çevrilince konuşma kendi modelinde kalıyor, yeni konuşma yeni modeli alıyor
- [ ] `standard` bir Gemini modeline çevrilince eski Anthropic konuşması bir kez yeniden kurulup devam ediyor
- [ ] Web aramalı uzun Anthropic görevi duraklayınca notla bitmek yerine devam ediyor
