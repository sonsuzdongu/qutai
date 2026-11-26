# Qutai — telefonda test listesi

Kodda yapılmış ama gerçek cihazda henüz görülmemiş şeyler. En sonda toplu denenecek.
İşaretler: `[x]` denendi ve çalışıyor, `[ ]` denenmedi, `[!]` denendi ve sorun var (yanına not).

Son güncelleme: 2026-11-16. Denenecek APK'lar: `builds/qutai-release-arm64.apk` (normal),
`builds/qutai-release-arm64-pro-mode.apk` (pro mod; test girişi 17 Kasım'dan beri kapalı, sahibin kararı). İkisi aynı uygulama kimliğini
kullanır; biri diğerinin üzerine kurulur.

## 1. Pro mod: hesap ve krediler (pro-mode APK)

Sunucu: `cd backend && API_PORT=8000 npm run dev -w @qutai/api` (tünel 8000 portuna bakıyor).

- [x] Test girişi tünel üzerinden çalışıyor (Ayarlar › Hesap › Test girişi)
- [x] Yönetim panelinden test kullanıcısına kredi verilebiliyor
- [ ] E-posta ile giriş (Ayarlar › Hesap › E-posta ile devam et): kod e-postayla geliyor, kodu girince oturum
      açılıyor; e-postadaki bağlantıya telefonda dokununca da açılıyor (Gmail `qutai://` bağlantısını tıklanabilir
      yapmayabilir; o zaman kod yeterli). Yanlış kod, "Tekrar gönder" geri sayımı, uygulama kapatılıp açılınca kod
      ekranına dönüş, Ayarlar › Hesap'ta "Giriş yöntemleri" altında adresin görünmesi
- [ ] iPhone'da Mail'den gelen kod klavyenin üstünde öneriliyor
- [x] Gerçek sağlayıcı anahtarıyla relay çalışıyor (hangi sağlayıcı: … )
- [x] ~~Diğer sağlayıcılar da çalışıyor: Anthropic / OpenAI / Gemini (üçünün relay yolu ayrı)~~ Gerek kalmadı (20 Kas): sunucu artık yalnızca Anthropic'i aktarıyor (`CRED-47`); uygulamada kendi OpenAI ya da Gemini anahtarınızla kullanım aynen sürüyor.
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
- [ ] Web aramalı uzun Anthropic isteği (duraklatılan arama): görev notla bitmeden kendiliğinden devam ediyor (10. bölüm)
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
- [ ] Normal APK'yı eskisinin üstüne kurun: açılışta bir kez "Gizlilik politikamızı ve koşullarımızı güncelledik" çıkıyor, kabul edince bir daha çıkmıyor; yeni kurulumda yalnızca normal kurulum adımı var
- [ ] Gizlilik Politikası (Türkçe ve İngilizce): "Telefonunuzdan çıkanlar" OpenRouter'ı, kendi sunucunuzu, "Konumumu kullan"ı (Apple / Google adres hizmeti), sesle yazmayı ve filtre listelerini anlatıyor; "Şifreler ve ödeme bilgileri" yeni metin; tarih 16 Kasım 2026; uzun metin kayarak okunuyor
- [ ] "Sizi biraz tanıyayım" girişindeki gizlilik notu "Hafıza açıkken asistana giden her istekle" diyor
- [ ] iOS: konum izni penceresinde "konumunuzun yer adını Apple’ın adres hizmeti bulur" cümlesi görünüyor (yeni derleme gerekir)
- [ ] İzinler adımında "Mikrofon" anahtarı var ("Sesli asistanı kullanabilmek için…"); açınca sistem izni soruluyor (iOS'ta mikrofon ve konuşma tanıma, Android'de mikrofon), durum doğru görünüyor
- [ ] Kurulumda mikrofona izin verdikten sonra paneldeki mikrofona ilk dokunuşta ikinci bir sistem izni çıkmıyor; çevrim içi konuşma hizmeti sorusu (gerekiyorsa) yine ayrıca soruluyor
- [ ] Mikrofon reddedilince "İzin verilmedi…" yazıyor; "bir daha sorma" sonrası "Telefonun ayarlarını açın" bağlantısı ayarları açıyor, ayarlardan izin verip dönünce anahtar açık görünüyor
- [ ] iOS: konuşma tanıma reddedilip mikrofona izin verilince anahtar açık, altında "yalnızca telefonun kendisinin tanıdığı diller çalışır" notu

## 5. Asistan paneli

- [ ] Paneldeki mikrofon basılı tutulunca dinliyor, bırakınca gönderiyor
- [ ] Dinleme dili mesajın diline göre değişiyor
- [ ] Türkçe yer tutucu metin giriş kutusuna sığıyor
- [ ] "Araştırma raporu" (eski "deep search") açıklaması anlaşılır, alt boşluk düzgün
- [ ] Site izinleri hamburger menüden açılıyor
- [ ] "Her zaman Türkçe yanıt ver" seçeneği yok; eski sürümde bu seçeneğe dokunulduysa güncellemeden sonra Özel talimatlar'da o satır kalmamış, elle yazdığınız diğer satırlar duruyor
- [ ] Eski bir yedekten geri yükleme: "Her zaman Türkçe yanıt ver" satırı gelmiyor; yeni bir yedekte elle yazdığınız aynı cümle korunuyor
- [ ] Sağlayıcı metinleri "AI sağlayıcısı" diyor ("Anthropic'e gönderildi" değil)
- [ ] Görev çalışırken giriş kutusu soluk ve kilitli, içinde "Qutai çalışıyor…"; ek, mikrofon ve "Araştırma raporu", "Özetle" gibi düğmeler soluk ve dokunulmuyor; gönder yerine Durdur var ve her an çalışıyor
- [ ] Görev başlamadan yazılmış metin görev boyunca kutuda soluk duruyor, görev bitince düzenlenip gönderilebiliyor
- [ ] Giriş kutusu şu anlarda hemen açılıyor: onay penceresi çıkınca, asistan seçenekli ya da serbest soru sorunca, görev bitince, durdurulunca, hata verince, Qutai Kredileri reddedip mesajı kutuya geri koyunca
- [ ] Ekran okuyucu (TalkBack / VoiceOver) görev başlayınca bir kez "Qutai çalışıyor…" diyor
- [ ] Görev çalışırken üzerinde çalıştığı sekmenin sayfa kenarlarında içe doğru solan mavi bir parıltı yavaşça nabız gibi atıyor; "Hareketi azalt" açıkken sabit
- [ ] Parıltı yalnızca görevin çalıştığı sekmede; başka sekmeye geçince, sekme listesinde, onay beklerken, görev bitince / durdurulunca yok
- [ ] Parıltı varken sayfa kaydırılıyor ve dokunulabiliyor; adres çubuğu altta ve üstte, klavye açıkken, panel açıkken, gizli sekmede, açık ve koyu temada düzgün
- [ ] Tam ekran videoda ve PiP'te parıltı görünmüyor; asistanın aldığı ekran görüntüsünde ve kaydedilen sayfa görüntüsünde parıltı yok

## 6. Onay pencereleri ve ikonlar

- [ ] "Qutai bu işlemi yapmak istiyor" penceresinde emoji yerine ikon var
- [ ] Sohbetteki adım satırları, duraklatıldı / devam / durduruldu notları ve hatalar ikonlu
- [ ] Takvim, hatırlatıcı, bildirim onaylarında başlık, yer, uyarı ve not satırları ikonlu
- [ ] Qutai etkinliği ekranında araç ikonları; reddedilen adım kırmızı uyarı ikonuyla
- [ ] Sekme değiştirici, indirilenler, yer imleri, kilit ekranı, hata sayfasında emoji kalmamış
- [ ] Koyu ve açık temada ikon renkleri okunuyor

## 7. Maliyet satırı (kendi anahtarınla, normal APK)

- [ ] Her görevin son yanıtının altında "≈ $… · … token" satırı çıkıyor
- [ ] Tutar ve token yazısı artık ayrı satırda değil, yanıtın kopyala / sesli oku / paylaş / daha fazla simgelerinin yanında; ikinci satıra geçmiyor, simgeleri ekrandan itmiyor
- [ ] Dar ekranda ya da büyük yazı boyutunda önce token kısmı düşüyor ("≈ $0,012"), yine sığmazsa tutar "…" ile kısalıyor; ekran okuyucu tam metni okuyor; dokununca döküm açılıyor
- [ ] Hata ya da durdurulan görevin altında tutar eskisi gibi kendi küçük satırında; görevin önceki yanıtlarında ve maliyet gösterimi kapalıyken simge satırı eskisi gibi
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

Pro mod APK (`EXPO_PUBLIC_PRO_MODE=on`, API adresi; 17 Kasım'dan beri test girişi olmadan: Apple, Google ya da e-postayla girilir). Test girişi satırları yalnızca yerel geliştirme yapısı içindir. Uygulama verisi silinmiş (ilk açılış) olarak başlanmalı.

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
- [ ] Ayarlar › Asistan'da oturum kapalıyken Qutai'a dokununca seçilmiyor; "önce oturum açın" penceresi çıkıyor
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
- [ ] Normal APK'da gizlilik ve koşullar açık kaynak sürümün metinleri (pro metinleri değil); güncelleme sonrası yalnızca bir kez yeniden kabul isteniyor (4. bölüm)

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
- [ ] Ayarlar › Asistan › Qutai Kredileri: model yerine üç seçenek görünüyor (Qutai Hızlı / Qutai / Qutai Pro), her birinde ne için olduğu ve "adım başına yaklaşık … kredi"; varsayılan olarak "Qutai" seçili
- [ ] "Bunlar hangi yapay zekâ modellerini kullanıyor" bağlantısı her kademenin şu anki modelini, adım sınırını ve Qutai'ın bunu değiştirebileceğini gösteriyor
- [ ] Panel başlığının altındaki menüde (bu konuşma için) aynı üç kademe çıkıyor; seçim yalnızca o konuşmaya uygulanıyor, başlıkta kademenin adı yazıyor
- [ ] Kurulumda Qutai seçilince aynı kademe listesi görünüyor
- [ ] Eski APK'dan güncelleme: önceden seçilmiş Qutai modeli (ör. Claude Haiku 5.5) uygun kademeye dönüşüyor (Haiku → Hızlı), eski konuşmalar kaybolmuyor
- [ ] Yanıtın altındaki kredi satırına dokununca kademenin adı ve "Yanıtlayan: <model>" görünüyor; "Yapay zekâya gönderilenler"de de aynısı
- [ ] Panelden bir kademe kapatılınca (`enabled: false`) "geçici olarak kullanılamıyor" mesajı çıkıyor ve mesaj giriş kutusuna geri geliyor
- [ ] Gizli sekmede kademeli konuşma: uygulama kapanıp açılınca hiçbir şey kalmıyor
- [ ] Duraklayan aramada görevi durdurunca normal "durduruldu" notu çıkıyor, kredi bir kez düşüyor
- [ ] Türkçe ve İngilizce, açık ve koyu temada kademe listesi ve ayrıntılar düzgün görünüyor; ekran okuyucu her seçeneği adı, açıklaması ve maliyetiyle okuyor

## 11. Sayfa metninde emoji: "The request body is not valid JSON"

- [ ] Qutai Kredileri ile (Anthropic kademesi) "Trendyol'da terlik bul…" görevini yeniden verin: arama sayfası okunduktan sonra görev "API hatası 400: The request body is not valid JSON" olmadan sürüyor
- [ ] Aynı görev kendi Anthropic, OpenAI ve Gemini anahtarınızla: hata yok
- [ ] Bu sürümden önce bu hatayı vermiş eski konuşmada "Tekrar dene"ye dokunun: istek gidiyor ve cevap geliyor, yeni sohbet açmanız gerekmiyor
- [ ] Ürün adlarında emoji olan başka bir sayfada (bir pazar yeri, emoji dolu bir sosyal medya sayfası) "Bu sayfada ne var?" diye sorun: cevap geliyor, emojiler yarım "�" olarak değil doğru görünüyor (yalnızca kesilen yerde en fazla bir eksik karakter olabilir)
- [ ] Emojili uzun bir metni seçip "Qutai'a sor" deyin: soru gidiyor, hata yok

## 12. 16 Kasım cila düzeltmeleri (telefonda denenmedi)

Asistan
- [ ] "10 saniye sonrasına bildirim kur": saat sormadan onay penceresi açılıyor, izin verince yaklaşık 10 saniyede bildirim geliyor.
- [ ] Onay penceresi "3 dakika sonra (13:36)" biçiminde; saat dilimi satırı yok (telefonla aynıysa).
- [ ] Onay penceresinde "Bildirimler için bir daha sorma": işaretleyince bir sonraki bildirim sormadan kuruluyor; ayarlardan geri alınabiliyor. Takvim etkinliği ve hatırlatıcıda da var; sayfadaki işlemlerde yok.
- [ ] Seçenekli soruya cevap verince seçenekler kapanıyor.
- [ ] Görev ve onay beklerken giriş kutusu kapalı, "Qutai çalışıyor…" yazıyor.
- [ ] "Hangi modeli kullanıyorsun": kredili modda "Qutai" ve seviye adı (alttaki model yok); kendi anahtarla sağlayıcı ve model.
- [ ] Hata olunca sade bir cümle; "ayrıntı" açılınca ham metin (denemek için: uçak modu, yanlış anahtar).
- [ ] Biten görevde üç ve daha fazla adım tek satır özete katlanıyor; dokununca adımlar açılıyor.
- [ ] Onay penceresi açıkken uygulamadan çıkınca bildirim geliyor; dokununca o sekmenin paneli açılıyor.
- [ ] Kredili modda bakiye yaklaşık 5 adımlık tutarın altına inince bir kez "kredi azaldı" notu ve "Kredi satın al".

Kurulum ve dil
- [ ] Kurulumda izinler listesinde Mikrofon ilk satır.
- [ ] Android ayarlarından Qutai'ın uygulama dili Türkçe yapılınca (telefon İngilizce) simgeye uzun basınca kısayollar Türkçe; widget yazıları da. Yaklaşık 10 saniye sürebilir.
- [ ] Yeni kurulumda kısayollar uygulama bir kez açıldıktan sonra görünüyor (bilinen durum).

Genel
- [ ] Ayar anahtarlarında ve onay düğmelerinde hafif titreşim; telefonun dokunma geri bildirimi kapalıysa titreşim yok.
- [ ] Kayıtlı görevler, anılar, çevrimdışı sayfalar ve kayıtlar yüklenirken dönen gösterge.
- [ ] Yazı boyutu en büyükte: tek satırlık alanlarda (sunucu adresi, anahtar, arama) harfler kesilmiyor; panel ve onay penceresi taşmıyor.
- [ ] TalkBack açıkken satır ve düğmeler "düğme" olarak okunuyor.

## 13. Android telefonda: çalışma modu, yatay ekran, sahte satın alma (17 Kasım, emülatörde denenemedi)

Emülatörde denenemedi: uygulama Android'de kendi isteklerini yalnızca https ile gönderiyor, yerel sunucu ve sahte yapay zekâ ise http. Telefonda tünel adresiyle (pro mod APK) deneyin. Ayrıntı: `docs/performance-2026-11.md` › C.

Çalışma modu (sahte yapay zekâ yerine kendi anahtarınız veya Qutai Kredileri ile, kısa bir görev):
- [ ] Bir form sayfasında "formu doldur" gibi bir görev verin: panel aşağı iner, alttaki şerit adımları yazar ("Düşünüyor…", "Yazılıyor…", "Tıklanıyor…"), tıklanan düğmede halka, yazılan alanda çerçeve görünür, ekranın kenarlarında ışıltı döner; sonunda panel yanıtla geri gelir.
- [ ] Görev sürerken şeritteki durdurma düğmesi: görev durur, şerit ve ışıltı kaybolur, panelde "Durduruldu" yazar.
- [ ] Onay isteyen bir adım (konum): onay penceresi şeridin üstünde açılır; "Reddet" deyince sohbette reddettiğinizi bildiren kısa bir satır çıkar.
- [ ] İstek sürerken uygulamadan çıkın, 15 saniye sonra dönün: istek bir kez gider, yanıt dönüşte orada olur (bildirim çubuğunda "yanıt tamamlanıyor" bildirimi görünebilir).

Yatay ekran:
- [ ] Tarayıcı, sekme değiştirici (üç sütun), Ayarlar ve asistan paneli (sağda) yatayda düzgün görünür.
- [ ] Görev sürerken telefonu çevirin: görev devam eder, şerit ve ışıltı yeni yöne uyar.

Kredi satın alma ekranı (sahte satın alma 21 Kasım 2026'da kaldırıldı; gerçek satın alma 30. bölümde):
- [ ] Ayarlar › Hesap › Qutai Kredileri › Kredi satın al: "Test modu" yazısı ve "Al (test)" düğmesi hiçbir sunucuda görünmez; paketler mağaza fiyatıyla çıkar.
- [ ] Aynı ekran kurulumdaki "Kredi satın al" düğmesinden de açılır.

Ölçüm (her biri beş kez, ortanca değeri yazın):
- [ ] Soğuk açılış: `adb shell am force-stop com.sonsuzdongu.qutai && adb shell am start -W -n com.sonsuzdongu.qutai/.MainActivity` (TotalTime).
- [ ] Bellek: `adb shell dumpsys meminfo com.sonsuzdongu.qutai | grep -E "TOTAL PSS|TOTAL RSS"`: açılıştan sonra, 1, 5 ve 20 sekmeyle, panel açıkken ve görev sürerken.
- [ ] Takılma: `adb shell dumpsys gfxinfo com.sonsuzdongu.qutai reset`, uzun bir sayfayı 10 saniye kaydırın (görev varken ve yokken), sonra `adb shell dumpsys gfxinfo com.sonsuzdongu.qutai | grep -E "Janky|50th|90th"`.

## Bulunan sorunlar

Deneme sırasında çıkanları buraya yazın; toplu düzeltilir.

- 16 Kasım'da telefonda bulunanlar ve cila listesi düzeltildi (kısayol dili, "bir daha sorma", göreli zaman, giriş kutusu yazısı, mikrofon satırı, onay penceresi, seçenekler, adım özeti, görev bildirimi, kredi uyarısı, titreşim, yüklenme göstergesi, erişilebilirlik, tablet genişliği). Denenecekler 12. bölümde.
- [x] Asistan panelinde sesle yazarken "Sesle yazma çalışmadı. Yeniden deneyin." uyarısı çıkıyor ama metin aslında yazılıyor (16 Kas, Honor / Android 15; "düzelt" bekleniyor). Mikrofon düğmesini bırakınca çıkıyor. Olası neden: tanıyıcı metni verdikten sonra geç gelen, eşlenmemiş bir hata kodu (`src/device/voiceInput.ts` › `handleError`).
  - Düzeltildi (21 Kas, `b00048b`): basılı tutarken tanıyıcı kendiliğinden yeniden başlayınca, önceki turda duyulan sözler artık "duyuldu" sayılıyor; yeni tur söz gelmeden geç bir hata ("client", "no-speech") verse de uyarı çıkmıyor, sözler son metin olarak kalıyor (otomatik gönderme açıksa gönderiliyor). Ayrıca (21 Kas, `d5e453b`): tanıyıcı hiç başlayamazsa "Hazırlanıyor…" artık takılı kalmıyor; olağan uyarı çıkıyor, sonraki basış normal başlıyor. İkisi de ses testlerinde (`npm run test:voice`).
  - Telefonda bakın: Q'ya ya da paneldeki mikrofona basılı tutup bir cümle söyleyin, 5-10 sn susun, yine konuşun, bırakın: uyarı çıkmamalı, bütün sözler kutuda olmalı. Susup bıraktığınızda da (yeni söz yokken) uyarı çıkmamalı.
- [x] Adres çubuğundaki üç nokta menüsü ekrana tam sığmıyor. Ekran yüksekliğine göre boyutlanmalı; sığmazsa kaydırılabilir olmalı. (16 Kas; "düzelt" bekleniyor)
  - Düzeltildi (16 Kas, `1e06ccb`; 21 Kas, `be24dcc`): menünün yüksekliği ekranın gerçek boyundan hesaplanıyor (durum çubuğu, alt gezinme çubuğu, klavye ve adres çubuğu dışarıda kalır), sığmayan liste menünün içinde kayıyor, üstteki simge satırı yerinde duruyor; adres çubuğu alttayken menü onun üstünde açılıyor. 21 Kas'ta ek olarak: uzun etiketlerde menü sol kenara ve yatay konumda kamera çentiğine de 8 pt'den fazla yaklaşmıyor, etiket alt satıra iniyor. Android emülatöründe en büyük yazı boyutunda (2×) küçük bir ekranda (360 × 640 dp, iPhone SE boyu) ve yan çevrilmişken denendi: sığıyor, son öğeye (Diğer) kadar kayıyor.
  - Telefonda bakın: en büyük yazı boyutunda ⋮'ye dokunun; menü alt çubuğun üstünde bitmeli, parmakla kaydırınca en alttaki "Diğer"e ulaşılmalı, simge satırı (ileri, yer imi, yenile) üstte kalmalı. Adres çubuğunu Ayarlar › Görünüm'den alta alıp yine deneyin (menü çubuğun üstünde açılmalı), telefonu yan çevirip de bakın.
- [x] Kayıtlı görev ("Deneme") asistana "Deneme adlı görevi çalıştır" denince çalışmıyor; asistan kayıtlı görevlere erişimi olmadığını söylüyor. Asistanın kayıtlı görevleri adıyla bulup çalıştırabilmesi gerekiyor (bugün böyle bir aracı yok; talimatı da "yapamazsın" diyor). (16 Kas; "düzelt" bekleniyor)
  - Düzeltildi (16 Kas, `11af7c4`; 21 Kas'ta bugünkü araç bölünmesinden sonra yeniden doğrulandı ve uçtan uca testi eklendi): asistanın iki yeni aracı var: `list_saved_tasks` (kayıtlı görevlerin adları) ve `get_saved_task` (adıyla bir görevin metni). Ad büyük/küçük harf ve Türkçe i/İ/ı/I farkı gözetmeden, ş, ğ, ç, ö, ü'süz yazılsa da, olmazsa adın bir parçasıyla eşleşir; birden çok görev uyarsa asistan düğmelerle hangisi olduğunu sorar, hiç uymazsa görevlerin adlarını söyler, tahmin etmez. Görev, Görevler ekranındaki gibi o sohbette çalışır; onaylar değişmez (ödeme, gönderme, "Her işlemden önce sor" yine sorar; görevin metni sizin yazdığınız bir mesaj sayılmaz, bu yüzden hiçbir onayı atlatmaz). Gizli sohbette de çalışır (Görevler listesi gibi). Görev oluşturma, düzenleme, silme ve zamanlama yine yalnızca sizde.
    - Telefonda bakın: Görevler'de "Deneme" adlı bir görev olsun; panelde "Deneme adlı görevi çalıştır" yazın → asistan görevi bulup yapmalı. "deneme görevini başlat", "kayıtlı görevlerim neler?" da denensin. "Deneme" ve "Deneme 2" adlı iki görev varken "dene adlı görevi çalıştır" yazın → asistan hangisi diye düğmelerle sormalı. 16 Kasım'dan önceki bir derlemede bu araç yoktu: `11af7c4` sonrası bir derleme gerekir.
- [x] Gözlem (aynı ekran görüntüsü): panel başlığındaki satır "Qutai K…02 kredi" diye ortadan kesiliyor; bakiye okunmuyor.
  - Düzeltilmişti (16 Kas, `b211327`; 21 Kas'ta kodda yeniden bakıldı, yeni değişiklik gerekmedi): bakiye ayrı bir metin ve hiç kısaltılmıyor; yanındaki ad ("Qutai") önce kısalıyor, sığmazsa tamamen gidiyor. Yazı boyutu 1,4 katında sabitleniyor; ekran okuyucu ad ile bakiyeyi tam okuyor. Ekran görüntüsü bundan önceki bir derlemeden olmalı.
  - Telefonda bakın: Qutai Kredileri ile paneli açın, en küçük ve en büyük yazı boyutunda: "Qutai · 12,02 kredi" ya da yalnızca "12,02 kredi" görünmeli, bakiye hiç kesilmemeli.
- [x] İstek: "Qutai bu işlemi yapmak istiyor" türündeki bütün cihaz izni pencerelerinde "bir daha sorma" kutusu olsun: takvim okuma, takvim etkinliği, bildirim, hatırlatıcı, konum, dosya indirme vb. Kutu işaretli "İzin ver" denirse o tür için bir daha sorulmaz; "Reddet" hatırlanmaz, sonraki sefer yine sorulur. Bugün yalnızca bildirim, takvim etkinliği ve hatırlatıcıda var; takvim okumada yok. (16 Kas; "düzelt" bekleniyor)
  - Düzeltildi (16 Kas, `289a687`; metinler on dilde; 21 Kas'ta bugünkü araç bölünmesinden sonra yeniden doğrulandı ve uçtan uca testi eklendi): kutu altı cihaz izninin hepsinde var: bildirim zamanlama, takvim etkinliği, hatırlatıcı, takvim okuma, konum ve sıradan bir dosya indirme. Kutu işaretliyken "İzin ver": o tür bir daha sorulmaz; "Reddet" hiçbir zaman hatırlanmaz. Ayarlar › Asistan › "Sormadan izin verilenler"de her tür bir anahtarla görünür ve oradan geri alınır; takvim okuma ve konumun altında, açıkken verinin her seferinde sorulmadan yapay zekâ sağlayıcınıza gideceği yazar. Kutu çıkmayanlar (bilerek): riskli dosyalar (uygulama, yükleyici, arşiv), asistanın kendi yazdığı bir adresten indirme, gizli sohbetler (orada hiçbir onay hatırlanmaz; takvim, konum ve zamanlama zaten reddedilir) ve sayfada ya da sizin adınıza yapılan her şey (tıklama, yazma, gönderme, ödeme, paylaşma, yükleme, kişisel bilgi; sayfa işlemlerinde onun yerine "{site} için hep izin ver" var). Başka bir cihaz izni penceresi bulunmadı (kişiler telefonun kendi izniyle ve seçim listesiyle soruluyor).
    - Telefonda bakın: "yarın ne işim var?" deyin → takvim okuma penceresinde "Takviminizi okumak için bir daha sorma" kutusu; işaretleyip "İzin ver" → ikinci soruda pencere çıkmaz. Aynısı "yakınımdaki eczaneler" (konum) ve bir sayfadaki PDF bağlantısını indirme için. Bir kez kutu işaretliyken "Reddet" deyin → sonraki sefer yine sorar. Ayarlar › Asistan › "Sormadan izin verilenler"de anahtarı kapatın → yine sorar. Gizli sekmede kutu hiç çıkmaz.
- [x] Onay reddedilince sohbette kırmızı satırda İngilizce "The user declined this. Ask them how to proceed." yazıyor (uygulama dili Türkçe). Bu, modele giden araç sonucu metni; kullanıcıya ham gösteriliyor. Kullanıcıya uygulama dilinde kısa bir satır ("Reddettiniz") gösterilmeli, hata rengi de olmamalı. (16 Kas; "düzelt" bekleniyor)
  - Düzeltilmişti (16 Kas, `e267272`; 21 Kas'ta yeniden bakıldı, yeni değişiklik gerekmedi): reddedilen her onay (konum, takvim, hatırlatıcı, paylaşım, yayınlama, ödeme, yer imi silme, ayar, sayfa stili, çerez…) sohbette hata renginde değil, sıradan bir bilgi satırı olarak uygulamanın dilinde görünüyor ("Reddettiniz", on dilde); modele giden İngilizce metin değişmedi. Testi: `scripts/i18n-tests/stepLine.test.ts`.
  - Telefonda bakın: asistana "konumumu bul" deyin, onay penceresinde "Reddet": sohbette gri "Reddettiniz" satırı çıkmalı.
- [x] Asistan cevap balonu bazen dar kalıyor (ekranın yarısı kadar; madde işaretli liste içeren cevapta metin dar bir sütuna sıkışıyor). Cevap balonu her zaman kullanılabilir genişliğe yayılmalı. (16 Kas, Honor / Android 15; "düzelt" bekleniyor)
  - Düzeltilmişti (16 Kas, `7957f1b`; 21 Kas'ta kodda yeniden bakıldı, yeni değişiklik gerekmedi): cevap balonu içeriğe göre daralmıyor, her zaman sohbet sütununun %90'ı (tabloda tamamı). Neden: madde satırları kendi genişliğini neredeyse sıfır bildiriyordu, balon en geniş paragrafın genişliğinde kalıyordu. Sahte yapay zekâya "liste" / "bullets" / "punkte" yazınca kısa girişli uzun maddeli bir cevap geliyor (`966054c`, simülatörde denemek için).
  - Telefonda bakın: "Neler yapabilirsin, madde madde yaz" gibi bir soru: kısa girişli maddeli cevabın balonu ekran genişliğine yayılmalı.
- [x] Gözlem (aynı ekran görüntüsü): kendi anahtarla panel başlığında sağlayıcı ve model adı "Anthropi…net 5.5" diye ortadan kesiliyor.
  - Düzeltilmişti (16 Kas, `8782493`; 21 Kas'ta yeniden bakıldı): satır sığarsa "Anthropic · Claude Sonnet 5.5", sığmazsa yalnızca model ("Claude Sonnet 5.5"), o da sığmazsa sonundan kısaltılıyor; ortadan hiç kesilmiyor. Testi: `scripts/assistant-tests/statusFit.test.ts`.
  - Telefonda bakın: kendi anahtarınızla, en büyük yazı boyutunda ve Almanca arayüzde paneli açın: sağlayıcı adı yarım görünmemeli.
- Açık kalanlar: yatay ekran (yön dikeye kilitli, karar bekliyor); arka plan görevi kapalıyken uygulamadan çıkınca bekleyen istek dönüşte yeniden gönderiliyor (iki kez ücret); yazı boyutu sayfasında İngilizce "%120" yerine "120%" olmalı.
- …

### 18 Kasım'da bildirilenler ("düzelt" bekleniyor)

Sahibi "not et, ben düzelt deyince alt oturumlardaki Opus ajanlarına düzelttir" dedi; hiçbirine dokunulmadı.

- [x] Titreşim çalışmıyor: adres çubuğundaki Qutai (Q) düğmesine basılı tutunca titreşim gelmiyor (18 Kas; Play'den kurulan 0.1.0 (100), Android). Daha önce `e0bdea8` ile eklenmişti; çalışma modu, sesle başlatma ya da yatay ekran değişikliklerinden biri bozmuş olabilir. Bakılacaklar: uzun basış başlangıcındaki titreşim çağrısı hâlâ yerinde mi, sistemin "dokunma titreşimi" ayarı kapalıyken ne oluyor, diğer titreşimler (gönder, onay, hata) çalışıyor mu.
  - Düzeltildi (19 Kas, `1846cd1`): basılı tutma, gönderme, onay penceresi, hata, durdurma ve görev bitişi yeniden kısa bir titreşim dalgasıyla (e0bdea8 öncesindeki gibi) bildiriliyor; sistem sabiti (LONG_PRESS) bazı telefonlarda hiç hissedilmiyor. Telefonun "dokunma titreşimi" kapalıyken Android hiçbir uygulamanın kısa titreşimine izin vermiyor (sistemin kendi uzun basışları gibi), uygulamanın "Dokunsal geri bildirim" ayarı da hepsini kapatır.
  - Telefonda: dokunma titreşimi açıkken Q'ya basılı tutun → titreşim; bir onay penceresi çıkınca, görev bitince ve Durdur'a basınca titreşim. Dokunma titreşimini kapatın → hiçbiri titremez.
- [x] Adım satırlarında "ref" görünüyor: "Tıklanıyor: ref 1" gibi metinlerde teknik referans yerine insanın okuyacağı bir şey yazılsın: önce öğenin adı ("Sepete ekle"), adı yoksa türü ("düğmeye", "metin alanına", "bağlantıya", "onay kutusuna", "listeye" vb.), ikisi de varsa "Sepete ekle düğmesi". Adım şeridi, paneldeki adım listesi ve adım özeti için geçerli; on dilde, Türkçede hâl ekleri doğru olacak şekilde. (18 Kas; TODO'daki "Step strip: name the element by its label instead of ref 1" kararının cevabı: evet.)
  - Düzeltildi (19 Kas, `ba63602`): satırlar öğenin adını ve türünü söylüyor ("“Sepete ekle” düğmesine dokunuluyor", "Bir metin alanına yazılıyor", "“Ülke” listesinden seçiliyor: Türkiye"), sekme adımları sekmenin başlığını; on dilde. Yapay zekâya giden metin değişmedi.
  - Telefonda: bir alışveriş sitesinde "sepete ekle" görevi verin; adım şeridinde, paneldeki adım listesinde ve TalkBack duyurusunda "ref" ya da numara görmemelisiniz.
- [x] Android'de dinleme geç başlıyor ve sağlıksız: dinleme düğmesine basınca dinleme 2-3 saniye sonra başlıyor, o arada söylenenler kaçıyor ve tanıma güvenilir değil (18 Kas; Play'den kurulan 0.1.0 (100), Honor / Android 15). Bakılacaklar: tanıyıcının ısınma süresi (hizmete bağlanma, cihaz içi modelin yüklenmesi), basışla birlikte sesin hemen kaydedilip tanıyıcı hazır olunca verilmesi, "dinliyorum" göstergesinin gerçekten dinlemeye başlayınca yanması, tanıyıcının önceden ısıtılması (panel açılınca ya da Q'ya dokunulunca), cihaz içi ile Google hizmeti arasındaki fark, 17 Kasım'daki "otomatik dil" değişikliğinin başlatmayı yavaşlatıp yavaşlatmadığı.
  - Düzeltildi (19 Kas, `291174a`): basılı tutma eşiği 0,4 sn; dil ve tanıyıcı planı Q'ya dokunulunca ve panel açılınca hazırlanıyor; Android 13+'te basılı tutarken ses tanıyıcı yüklenirken de kaydediliyor (ilk sözler kaybolmuyor), "Dinliyor…" ancak ses alınınca, öncesinde soluk görünümle "Hazırlanıyor…". Tanıyıcı basılıyken kendiliğinden biterse yeniden başlıyor (en çok 4 kez), cihaz içi tanıyıcı açılamazsa izin verdiyseniz çevrimiçi deneniyor. Emülatörde "dinliyorum" basıştan 0,45-0,49 sn sonra (önce 0,65-2,4 sn).
  - Telefonda: Q'ya basılı tutar tutmaz konuşmaya başlayın; ilk kelimeler metinde olmalı. Ölçüm için: `adb logcat -s ReactNativeJS | grep voice-timing` (her basışta "press +0 · … · audio +… · ready +…" satırı; kelimeler yazılmaz). 10 sn sessiz kalıp konuşmaya devam edin: dinleme sürmeli.
- [x] Soru / araştırma (iş değil, karar bekliyor): sesle yazma ve sesli okuma telefonun kendi paketleriyle "doğal" değil. Daha iyi konuşma tanıma ve daha doğal ses için seçenekler sahibine anlatıldı (18 Kas): ücretsiz iyileştirmeler (ısıtma, kurulu en iyi sesi seçme), bulut tabanlı tanıma ve nöral ses (pro mod, sunucu üzerinden), gerçek zamanlı konuşmadan konuşmaya model. Hangi yolun seçileceği sahibinin kararı.
  - Sahibi "seviye 1"i seçti; yapıldı (19 Kas, `3fc70c0`): sesli okuma dil için kurulu en doğal sesi seçiyor (iOS: Premium > Geliştirilmiş > Siri > basit), cümleler arasında ses değişmiyor; yalnızca basit ses varsa dil başına bir kez kısa bir ipucu çıkıyor. Bulut seçenekleri ayrı bir karar olarak bekliyor.
  - Telefonda (iPhone): Ayarlar'da "Sesler" diye aratıp Türkçe için Geliştirilmiş bir ses indirin, bir cevabı sesli okutun: o ses okumalı. Android'de: yalnızca basit ses kuruluysa bir kez ipucu.
- [x] Yükleme göstergesi takılı kalıyor: sayfalar bazen adres çubuğunun üstündeki yükleme halinde kalıyor; menüden çarpıya (durdur) basılsa da yükleme hali bitmiyor (18 Kas; Play'den kurulan 0.1.0 (100), Android). Bakılacaklar: sayfa aslında yüklenmiş mi (yalnızca gösterge mi takılı), hangi sitelerde ve ne sonrası oluyor (yönlendirme, sayfa içi gezinme, indirme başlatan bağlantı, engellenen istek, arka plandaki sekme, asistanın açtığı sekme), yükleme bitti olayının kaçtığı durumlar, durdurmanın göstergeyi sıfırlamaması, ilerleme çubuğu için bir zaman aşımı gerekip gerekmediği.
  - Düzeltildi (19 Kas, `e1ca973`): sayfanın kendi adres değişikliği (pushState/replaceState, #bölüm) yükleme sayılmıyor, WebView'in ilerlemesi %100 olunca yükleme bitiyor, Durdur her zaman bitiriyor, indirmeye dönen bağlantı ve çöken sayfa süreci de bitiriyor; iOS'ta iptal edilen gezinme bitiş olarak bildiriliyor (yerel yama: yeni derleme gerekir). Emülatörde iki neden bulunup düzeltildi: en.m.wikipedia.org/wiki/Bosphorus (yönlendirme sayfası) ve react.dev/learn'de logoya dokunmak.
  - Telefonda: bu iki sayfayı açın; adres çubuğunun üstündeki çizgi sayfa yüklenince kaybolmalı, menüde "Yeniden yükle" görünmeli. Bir sayfa yüklenirken menüden Durdur: çizgi hemen gider.
- [x] Sohbetteki bağlantı sekme grubunda açılmalı: asistanın sohbet penceresinde önerdiği bir bağlantıya dokununca açılan sekme, sohbetin ait olduğu sekme grubunun içinde açılmalı (18 Kas). Bugün grubun dışında, ayrı bir sekme olarak açılıyor. Kapsam: cevap metnindeki bağlantılar, "Kaynaklar" kartları ve seçenek/öneri düğmelerinin açtığı bağlantılar; sohbet gruplanmamış bir sekmeye aitse o sekmeyle yeni sekme bir grup oluşturmalı mı, yoksa yalnızca yanına mı açılmalı (asistanın bir görev sırasında açtığı sekmeler zaten sekmenin grubunda toplanıyor: aynı kural). Gizli sekmede açılan bağlantı gizli kalmalı.
  - Düzeltildi (19 Kas, `0c8ab8d`): cevap metnindeki ve "Kaynaklar"daki bağlantılar sohbetin sekme grubunda açılıyor; sekme henüz grupta değilse ikisi bir grup oluyor (asistanın görevde açtığı sekmelerle aynı kod). Gizli sohbetteki bağlantı gizli açılıyor. Bağlantıya uzun basınca "Yeni sekmede aç" (arkada, aynı grupta), "Gizli sekmede aç", "Bağlantıyı kopyala", "Paylaş".
  - Telefonda: gruplanmamış bir sekmede asistana bağlantılı bir cevap aldırıp bağlantıya dokunun; sekme listesinde iki sekme bir grupta olmalı. Gizli sekmede aynısı: yeni sekme gizli.
- [x] Yeni özellik isteği (hata değil; tasarım ve karar gerekiyor): asistan sayfada daha fazlasını yapabilsin (18 Kas). Bugün yalnızca sayfayı okuyup blok gizleyebiliyor / alan adı engelleyebiliyor ("Kendi kurallarım").
  - (1) Sayfada JavaScript çalıştırabilsin: görev JS ile çözülebiliyorsa onu yapsın. Örnek: "bu sayfada hangi çerezler var" (HttpOnly çerezler dahil; bunlar sayfa JS'inden okunamaz, tarayıcının çerez deposundan okunmalı). Sahibinin ifadesiyle "bir eklenti (extension) altyapısına ihtiyacımız var".
  - (2) Sayfada CSS değişikliği yapabilsin ve Greasemonkey benzeri kalıcı kullanıcı betikleri / stilleri yazabilsin. Örnek: "sayfadaki bağlantıları kırmızı yap".
  - [x] 1. adım yapıldı (19 Kas): stiller ve çerez listesi. "Bağlantıları kırmızı yap", "bu sitede yazılar büyük olsun", "burada koyu arka plan": asistan CSS önerir, Qutai denetler (ağdan yükleme yok), her seferinde sorar, sayfa hemen değişir; sohbet kartında "Bu site için sakla…" ve "Geri al". Saklananlar "Kendi kurallarım › Stiller"de; sayfa menüsünde "Bu sayfada stilleri kapat". "Bu sayfada hangi çerezler var": tarayıcının çerez deposundan (HttpOnly dahil), yapay zekâya yalnızca ad, alan adı, yol, süre, boyut ve işaretler gider, değerler asla; "Çerezler" ekranında değer dokununca görünür, kopyalanır, silinir (onayla). Telefonda kontrol: bölüm 16. Tasarım: `docs/page-customisation.md`.
  - [x] 2. adım: sayfada JavaScript çalıştırma ve kalıcı kullanıcı betikleri. **Yapıldı (19 Kas, `2c4302d`, `f98b95c` ve sonrası; listede 21 Kasım'a kadar açık kalmıştı):** `run_script` varsayılan kapalı (Ayarlar › Asistan, açarken bir kez daha soruluyor); her çalıştırmadan önce kod gösterilip onay isteniyor; sayfanın bir kopyasında ya da sayfanın kendisinde çalışıyor; "Bu siteye sakla" ile kalıcı betik "Kendi kurallarım"da; gizli sekmede çalışmıyor. Tasarım: [20-page-scripts.md](design/20-page-scripts.md) (`SCR-*`). Mağaza tarafı (inceleme notu, risk 3.5): [store-submission.md](store-submission.md).
  - Yönetici notu: güvenlik açısından en riskli özellik bu olur (sayfadaki gizli talimatların asistana betik çalıştırtması, oturum çerezlerinin sızması). Önerilen çerçeve sahibine anlatıldı: tek seferlik çalıştırma ile kalıcı kural ayrımı, her betik için kod gösterilerek onay, çerez değerlerinin yapay zekâya gitmemesi, "Kendi kurallarım"ın stil ve betikleri de kapsaması.
- [x] Yeni özellik isteği (karar gerekiyor): asistan ödeme onayını da verebilsin (18 Kas). Bugün asistan siparişi sepete kadar getiriyor, "Ödemeyi her zaman siz tamamlarsınız" kuralıyla son düğmeye basmıyor (sistem isteminde ve web sitesinde böyle yazıyor). Sahibi bunun kaldırılabilmesini / zorlanabilmesini istiyor. Yönetici notu: teknik olarak mümkün (istem ve onay kuralı değişir), ama gerçek para harcayan tek özellik olur; önerilen çerçeve sahibine anlatıldı: her ödemede uygulamanın kendi onay penceresi (tutar, satıcı, sayfanın görüntüsü), "bir daha sorma" yok, harcama sınırı, kart bilgisi ve doğrulama kodu asistana gitmez, varsayılan kapalı ayar.
  - Yapıldı (19 Kas, `4d97c4d`): Ayarlar › Asistan › "Asistan ödemeleri tamamlasın" (varsayılan kapalı; açarken bir kez daha soruluyor; yedekten geri gelmiyor, asistan kendisi açamıyor). Kapalıyken asistan siparişi hazırlayıp "son düğmeye siz basın" diyor; son ödeme düğmesine basması uygulamada engelleniyor. Açıkken her ödemede Qutai'ın kendi penceresi: site, sayfada okunan toplam ve bulunduğu satır, sipariş, sayfanın adlandırdığı ödeme yöntemi, varsa abonelik/yenileme; "bir daha sorma" yok. Onaydan sonra toplam değişirse basılmıyor, yeniden soruluyor. Kart numarası hiçbir zaman yazılmıyor. Harcama sınırı eklenmedi (para birimi sorunu, TODO › Kararlar).
  - Telefonda kontrol: ayar kapalıyken bir test mağazasında (ya da `node scripts/page-tests/serve.mjs` sayfasındaki "Checkout" bölümünde, sahte yapay zekâ ile "pay") ödeme isteyin: pencere çıkmamalı, adımda "Ödemeyi siz yapıyorsunuz (ayarınız)" yazmalı, asistan "Pay now" düğmesine sizin basmanızı söylemeli. Ayarı açın (onay penceresi), aynısını isteyin: pencerede €24.99, "Order total: €24.99" satırı ve "Visa •••• 4242" görünmeli; Vazgeç → ödenmemeli; Onayla → "Paid €24.99" yazmalı. "sneakpay" ile onaysız basış reddedilmeli.
- [x] İstek / hata: asistan onay verilse de paylaşım yapmıyor: sosyal platformlarda paylaşım ve yorum (örnek: YouTube'a yorum girmiyor) ve ödeme adımı (18 Kas). Sahibi bunların "zorlanabilmesini" istiyor. Kodda bulunan: sistem istemi bunları yasaklamıyor, yalnızca "geri alınamaz ya da hassas işlemden önce dur ve açık onay iste" diyor (satın alma/ödeme, mesaj/e-posta gönderme, paylaşma/yayınlama, silme, hesap ayarı); uygulamada ayrıca bir engel görünmüyor. Yani nedeni henüz bilinmiyor; düzeltme sırasında ayırt edilecek: (a) model onaydan sonra da çekiniyor ya da reddediyor mu (hangi sağlayıcı/modelde), (b) onay sohbet metniyle isteniyor ve cevap modele "kullanıcı onayladı" olarak net ulaşmıyor mu (uygulamanın kendi onay penceresi ve araç sonucu daha net olur), (c) teknik mi: YouTube yorum kutusu gibi zengin metin alanlarına yazma ya da "Gönder" düğmesine basma başarısız mı oluyor. Ödeme için ayrı madde yukarıda.
  - Nedenleri ve düzeltme (19 Kas, `44def75`, `257ba70`, `4d97c4d`): (c) yerel test sayfalarında (`scripts/page-tests/`) eski yazma/tıklama kodu 10 durumdan 7'sinde başarısızdı: özel öğenin gölge DOM'undaki alana yazmak hata veriyordu, `beforeinput` ile çalışan zengin editörler metni kaybediyordu, yalnızca pointer/touch dinleyen düğmeler tepki vermiyordu, keyup ile açılan "Yayınla" düğmesi kapalı kalıyordu ve hâlâ kapalı bir "Gönder" düğmesine basmak "Clicked" diye başarı sayılıyordu (model gönderdiğini sanıyordu). Şimdi 16 durumun hepsi geçiyor; yalnızca `isTrusted` denetleyen düğmeye hiçbir sayfa betiği basamaz. (b) onay sohbetle (ask_user) isteniyordu, "evet" sıradan bir kullanıcı mesajı olarak gidiyordu ve sayfa metninden ayırt edilemiyordu; şimdi `request_approval` aracı Qutai'ın penceresini açıyor, sonuç modele "kullanıcı onayladı, şimdi bas ve sonucu söyle, sohbette yeniden sorma" diyor. (a) istemdeki "dur ve açık onay iste" cümlesi onaydan sonra ne yapılacağını söylemiyordu ve e-posta/SMS/WhatsApp kurallarındaki "kullanıcı kendisi gönderir" kalıbı modele genelleniyor olabilir; gerçek modellerle doğrulanacak (README › Posting and paying, bu dosyada aşağıdaki el ile test).
  - Telefonda kontrol: `node scripts/page-tests/serve.mjs` sayfasında sahte yapay zekâ ile "post" deyin: yorum kutusuna yazmalı, "Comment on localhost:8811?" penceresinde tam metin ("Nice page! (Qutai test)") ve "Qutai sayfadaki “Post (shadow)” düğmesine bir kez basacak" görünmeli; Onayla → yorum listede bir kez görünmeli; Vazgeç → gönderilmemeli. Sonra gerçek bir modelle kendi test videonuzda/hesabınızda: "Bu videoya 'Harika video' diye yorum yaz" → pencere bir kez, sohbette ikinci bir "emin misiniz?" olmadan; onaydan sonra yorum gerçekten görünmeli. Android emülatörü yerel http sunucusunu reddettiği için cihazda henüz denenmedi.
  - Gerçek modellerle el ile test (sahibi; her biri kendi hesabınızda, kendi test içeriğinizle): Anthropic'in varsayılan modeli, OpenAI'nin varsayılan modeli, Gemini'nin varsayılan modeli ve Qutai Kredileri. Görevler: (1) kendi YouTube test videonuza "Bu videoya 'Qutai deneme yorumu' diye yorum yaz"; (2) kendi hesabınızdan bir foruma/yorum alanına kısa bir yanıt; (3) ödeme ayarı kapalıyken bir mağazada sepeti ödeme adımına kadar getirmesini isteyin; (4) ayar açıkken kayıtlı kartlı bir hesapta küçük tutarlı bir ödeme (ya da mağazanın test ortamı). Bakılacaklar: sohbette ayrıca "emin misiniz?" sorulmadan tek pencere çıkıyor mu; penceredeki metin/toplam sayfadakiyle aynı mı; Onayla'dan sonra model düğmeye basıp sonucu söylüyor mu (yoksa yeniden soruyor ya da reddediyor mu: hangi modelde, cevabın metni); Vazgeç'ten sonra duruyor mu; (3)'te "siparişiniz hazır, şu düğmeye siz basın" deyip duruyor mu; 3-D Secure sayfasında size bırakıyor mu.
- [x] Yeni özellik isteği (tasarım ve karar gerekiyor): telefonda küçük görsel ve video düzenlemeleri (18 Kas). Örnekler: resmi keskinleştirme, gri tonlama; sayfadaki bazı öğelerden video oluşturup galeriye kaydetme. Bugün var olan: `edit_image` aracı ve "Yeniden boyutlandır ya da kırp" sayfası (kırpma, döndürme, çevirme, boyut, biçim, hedef dosya boyutu; hepsi telefonda, Skia ile, hiçbir yere gönderilmeden). Filtreler (keskinleştirme, gri ton, parlaklık, kontrast, bulanıklık) aynı altyapıya küçük bir ek; video ise ayrı ve büyük bir iş (uygulamada video kodlayan bir kütüphane yok). Seçenekler sahibine anlatıldı.
  - Görsel kısmı yapıldı (19 Kas): `edit_image` filtreleri (siyah beyaz, sepya, ters çevirme, otomatik iyileştirme, parlaklık, kontrast, doygunluk, sıcaklık, keskinleştirme, bulanıklık) ve önizlemedeki "Düzenle" sayfasında "Filtreler" bölümü (hazır seçimler, kaydırıcılar, Sıfırla, canlı önizleme, basılı tutunca orijinal). Video kısmı sahibi tarafından ertelendi (19 Kas); bu iş kapsamında değil.
  - iOS simülatöründe denendi (iPhone 17 Pro, Türkçe): fotoğrafta Siyah beyaz + Keskinleştir, Otomatik iyileştir, parlaklık kaydırıcısı, Sıfırla, basılı tutunca "Özgün", yatay ekranda yan yana düzen; saydam PNG'de Sepya + Daha parlak + Daha fazla kontrast + Bulanıklık; iki kopya da Fotoğraflar'a kaydedildi, JPEG tamamen gri, PNG saydamlığını koruyor, renkler test hesabıyla birebir aynı. Denenmeyen: Android, sesli okuyucu, büyük yazı, asistanın sahte yapay zekâyla `edit_image` çağırması (simülatöre adres yazılamadı), sohbet kartındaki özet satırı.
  - [ ] Telefonda kontrol: bir fotoğraf ekleyip önizlemede "Düzenle"ye basın; her hazır seçimi (Özgün, Otomatik iyileştir, Siyah beyaz, Sepya, Keskinleştir, Daha parlak, Daha fazla kontrast, Bulanıklık) deneyin, önizleme hemen değişmeli, resme basılı tutunca orijinal görünmeli; "Kopya oluştur" ile kopya mesaja eklenmeli, başlığın altında yapılanlar Türkçe yazmalı ("Siyah beyaz, keskinleştirildi"); Kaydet ile Fotoğraflar'a gitmeli. Aynısını saydam bir PNG ile yapın (arka plan saydam kalmalı). Asistana "bu resmi siyah beyaz yap ve biraz keskinleştir" deyin: sohbette kart çıkmalı, kartta aynı özet yazmalı. Android'de, yatay ekranda, büyük yazıyla ve VoiceOver/TalkBack ile kaydırıcıları (yukarı/aşağı kaydırma 5'er adım) deneyin.
- [x] Yeni özellik isteği (büyük; tasarım ve karar gerekiyor): Qutai içinde kullanıcının oluşturabildiği "uygulamalar" (18 Kas). **Yapıldı (19 Kas, `c8b927a` ve sonrası; listede 21 Kasım'a kadar açık kalmıştı):** asistan uygulamayı yazıyor, önizlemesini açıyor, "Uygulamalarım"a kaydediyor; uygulama ağsız, ayrı bir web görünümünde çalışıyor, verisi telefonda, dışa aktarılabiliyor, yedeğe giriyor; 21 Kasım'dan beri menüsünde "Bildir" var. Köprü bilerek yalnızca depolama, arayüz ve pano veriyor (konum gibi yerel yetenekler yok: Apple 4.7.2). Tasarım: [22-apps.md](design/22-apps.md) (`APPS-*`). Mağaza tarafı (inceleme notu, risk 2.2): [store-submission.md](store-submission.md). Örnek: "bana bir uygulama oluştur, burada notlarımı tutabileyim" → Qutai uygulamanın JavaScript kodunu yazar, uygulama Qutai içinde çalışır. Sahibinin istedikleri: bir altyapı ve sözleşme (contract); telefondan köprülenen yetenekler (örnek: konum); verinin telefonda tutulması; uygulamaların dışa aktarılabilmesi; verileriyle birlikte yedeğe ve sunucu yedeğine girmesi. Yönetici notu: önerilen mimari sahibine anlatıldı (yalıtılmış web görünümünde çalışan mini uygulamalar, izinli köprü API'si, uygulama başına depolama, tek dosyalık paket biçimi). Sayfa betikleri isteğiyle aynı güvenlik sorularını paylaşır ama daha güvenlidir: uygulama kendi boş sayfasında çalışır, başka sitelerin oturumuna erişmez.

### 19 Kasım'da bildirilenler ("düzelt" bekleniyor)

Sahibi "yazdıklarımı incele, ben düzelt deyince düzelt" dedi; hiçbirine dokunulmadı. Her maddede kodda bulunan neden yazılıdır.

- [x] Adres çubuğuna yazarken öneri listesi akıcı değil: geçmişte her harfte arama yapılıyor ve liste her tuşta boşalıp yeniden doluyor (19 Kas; 0.1.3). İstek: bir gecikme (debounce) eklensin ve liste daha yumuşak dolsun. Kodda bulunan (`src/components/OmniboxSuggestions.tsx`): yerel öneriler (geçmiş, yer imleri, açık sekmeler) her tuşta gecikmesiz sorgulanıyor (satır 49-58); web önerilerinde gecikme var ama yerelde yok. Asıl titreme şuradan: yeni sorgunun sonucu gelene kadar eski sonuçlar atılıyor (`localItems = local.query === query ? local.items : []`, satır 88-89), yani her harfte liste bir an boş kalıp yeniden çiziliyor. Düzeltme yönü: yerel aramaya kısa bir gecikme (yaklaşık 100-150 ms, hızlı yazarken ara sorgular atlanır); yeni sonuç gelene kadar önceki sonuçları göstermeye devam etmek (boşaltmamak); satırların kararlı anahtarlarla çizilmesi ki değişmeyen satırlar yerinde kalsın; satır sayısı değişince yüksekliğin yumuşak geçmesi ("hareketi azalt" açıkken anlık); yapıştırma ve "Qutai'a sor" satırlarının yerinden oynamaması. **Düzeltildi (19 Kas, 1341bc3):** liste harfler arasında hiç boşalmıyor, yeni yanıt gelince bir kerede değişiyor; geç gelen eski yanıt yenisinin yerine geçmiyor; yerel arama 120 ms bekliyor (duraklamadan sonraki ilk harf ve boşaltılan alan anında), geçmiş ve arama motoru önerileri birlikte geliyor; "Qutai'a sor" ve arama/adres satırı en üstte sabit; satırlar yumuşakça beliriyor ("hareketi azalt" açıkken anlık); parmak listedeyken liste değişmiyor. Geçmiş sorgusu yeni bir dizinle yaklaşık yarı sürede çalışıyor. Bulma çubuğundaki sayı ve geçmiş aramasındaki dönen simge de her harfte yanıp sönmüyor. Denendi: iOS simülatöründe (iPhone 18 Pro, Release, 4.000 geçmiş kaydı) boş alan, "gal" (geçmiş satırları), "galx" (geçmiş satırları gitti, web önerileri geldi, yazılan metin tekrarlanmadı), alanı silme (Yapıştır satırı anında). Denenmedi: telefonda hızlı yazma, gizli sekme, "hareketi azalt" açıkken, Android, kare kare titreme kaydı (simülatörün kaydı yazarken kare atlıyor).
  - Sahibinin kararı (19 Kas): arama motoruna öneri isteği yalnızca yazmaya 200 ms ara verilince gidiyor; duraksamadan yazılan bir kelime tek istek, bitmiş metinle. Geçmiş önerileri kendi 120 ms düzeninde kalıyor; motor satırları geldiğinde listeye katılıyor, liste boşalmıyor.
  - [ ] Telefonda bakın: adres çubuğuna hızlıca "galatasaray" yazın, birkaç harf silin, alanı temizleyin, yapıştırın; normal ve gizli sekmede, bir de "hareketi azalt" açıkken. Liste hiç boşalmamalı, satırlar yanıp sönmemeli, "Qutai'a sor" yerinden oynamamalı; web önerileri ancak yazmaya kısa bir ara verince yenilenmeli.
- [x] İlk açılışta "Get started" ekranındaki ve ardından gelen "Privacy and terms" ekranındaki metinler ekrana sığmıyor (19 Kas; 0.1.3, telefonda). İstek: bu iki ekrandaki metinler daha küçük olsun. **Düzeltildi (19 Kas):** neden: iki ekranın yazıları sonraki adımlarla aynı büyüklükteydi (başlık 26, metin 15-16 pt, logo 72) ve resmî derlemedeki gizlilik özeti uzun dillerde 600-730 karakter tutuyor; küçük bir telefonda metin aşağı taşıyor, "Okudum ve kabul ediyorum" kutusu kaydırınca görünen yere kalıyor, sabit 52 pt yüksekliğindeki düğme büyük yazı boyutunda etiketini kesiyordu. Şimdi: daha küçük yazı (14-15 pt, özellik metinleri 13 pt), 760 dp'den kısa ekranlarda ve yatayda daha da sıkı (yatayda logo adın yanında); yazılar sistemin yazı boyutuyla en çok 1,4 katına kadar büyüyor, ötesinde ekran kayıyor (daha fazlası varsa kaydırma çubuğu bir an görünüyor); onay kutusu Kabul düğmesiyle birlikte altta sabit; düğme etiketi sığmazsa kesilmiyor, düğme uzuyor. Denetlenen: tür denetimi, lint, testler; iOS simülatöründe (iPhone 18 Pro, yüklü Release derlemeye yalnızca yeni JS paketi konarak) İngilizce ve Almanca, normal ve en büyük yazı boyutunda, dikey ve yatayda: metin kesilmiyor, en büyük boyutta yatayda metin kayıyor, onay kutusu ve düğme altta. Denenmedi: 360 x 640 dp'lik küçük bir telefon (öyle bir simülatörde uygulama yüklü değil), Android, resmî (pro) derlemenin uzun metinleri.
  - [ ] Telefonda bakın: uygulama verisini silip açın; "Get started" ve "Privacy and terms" ekranlarını dikey ve yatay, normal ve en büyük yazı boyutunda, Türkçe ve İngilizce (mümkünse Almanca ya da Fransızca) inceleyin. Metin kesilmemeli, üst üste binmemeli; düğme ve onay kutusu her zaman altta görünmeli; sığmayan kısım kaydırılarak okunabilmeli.
- [x] Hesap ekranında giriş yöntemlerinin ("Signed in with email", "Google" gibi) yanında hangi e-posta adresiyle giriş yapıldığı yazsın (19 Kas; 0.1.3). Bilinen: sunucunun `GET /me` yanıtındaki `methods` listesi adresi yalnızca `email` yöntemi için veriyor; Google ve Apple için adres dönmüyor, yani sunucu tarafında da değişiklik gerekir (Apple'da gizli aktarma adresi olabilir; ne gösterileceği kararlaştırılmalı). **Düzeltildi (19 Kas; sunucu yeniden kurulunca görünür):** sunucu şimdiye kadar hesap başına tek adres tutuyordu (son girişteki), yöntem başına değil; Google ve Apple'ın birlikte olduğu bir hesapta hangi adresin hangisine ait olduğu bilinemiyordu. Artık her Google ve Apple yöntemi kendi girişinin verdiği adresi tutuyor (yeni sütun `identities.email`, geçiş 0012; her girişte adres gelirse güncellenir, adressiz giriş silmez; eski kayıtlar yalnızca hesapta tek bir Google ya da Apple yöntemi varsa dolduruldu, diğerleri o yöntemle bir sonraki girişte dolar). `GET /me` bu adresi yönteme ekliyor. Uygulama "Giriş yöntemleri" listesinde "E-posta: ad@ornek.com", "Google: ad@gmail.com" gösteriyor; Apple'ın "E-postamı Gizle" aktarma adresi yerine "Apple: gizli e-posta" yazıyor. Eski sunucuyla adres gelmez, yöntem adı tek başına görünür (bugünkü gibi). Günlüklere adres yazılmıyor. Denetlenen: arka uçta `npm test` (API 540, yönetim paneli 78; yeni `method-emails` testleri, günlük testi dahil), `npm run typecheck`, `npm run lint`; uygulamada `test:account`, `test:i18n`, tür denetimi, lint.
  - [ ] Sahibi: sunucuyu yeniden kurun (`backend/` içinde üretim kurulum komutu geçiş 0012'yi uygular). Sonra telefonda Ayarlar › Hesap: Google ile, Apple ile (adresi gizleyerek ve göstererek) ve e-postayla girin ya da yöntem ekleyin; her yöntemin yanında doğru adres, gizli Apple adresinde "gizli e-posta" yazmalı. Daha önce eklenmiş ama o günden beri kullanılmamış bir Google/Apple yöntemi adres göstermeyebilir; o yöntemle bir kez yeniden girince görünür.
- [x] Kurulumun (onboarding) ilk adımında dil seçimi olsun: burada uygulamanın dili seçilsin, varsayılan cihazın dili olsun (19 Kas; 0.1.3). **Düzeltildi (19 Kas):** kurulumun ilk adımı artık dil: on dil, her biri kendi dilinde yazılı; uygulamanın o an gösterdiği dil seçili gelir (telefonun dili ya da en yakını, yoksa İngilizce). Bir dile dokununca kurulum hemen o dile geçer. Seçim, Ayarlar › Dil ile aynı ayardır: Android'de aynı uygulama dili ayarı (13 ve üstünde telefonun Ayarlar › Uygulamalar › Qutai › Dil'i; önceden seçili dile dönülürse "Sistem varsayılanı" kalır); iOS'ta Ayarlar › Qutai › Dil'in yazdığı aynı değer (iOS izin pencereleri ve hızlı eylemler bu dile bir sonraki açılıştan itibaren geçer). Yalnızca gizlilik metinleri yeniden sorulduğunda dil adımı çıkmaz. Denetlenen: tür denetimi, lint, `test:i18n`; iOS simülatöründe: Deutsch'a dokununca ekran hemen Almanca, uygulamanın kendi `AppleLanguages` değeri `["de"]`; uygulama kapatılıp açılınca Almanca ve Deutsch seçili açılıyor; English'e dönünce değer siliniyor ve uygulama yeniden İngilizce açılıyor (ilk denemede silme çalışmıyordu: React Native'in `Settings.set` null'u yerel tarafa iletmiyor; düzeltildi). Denenmedi: Android (13 öncesi ve sonrası), iOS Ayarlar › Qutai › Dil ekranında görünmesi.
  - [ ] Telefonda bakın (iOS ve Android): uygulama verisini silip açın; ilk ekranda telefonun dili seçili olmalı. Başka bir dil seçin: başlık ve düğme hemen değişmeli; "Devam" ile ilerleyin, kurulumu bitirin. Ayarlar › Dil aynı dili göstermeli (iOS'ta uygulamayı kapatıp açınca iOS Ayarlar › Qutai › Dil de aynı dili göstermeli, izin pencereleri o dilde gelmeli). Bir de dil adımında başka dil seçip yeniden telefonun diline dönün: Android'de Ayarlar › Dil "Sistem varsayılanı" kalmalı.
- [x] Kurulumdaki örnek adlar ("Ayşe", "Ahmet" gibi) seçili dile göre olsun: her dilde o dilde yaygın adlar kullanılsın (19 Kas; 0.1.3). On dilin hepsi için. **Düzeltildi (19 Kas):** "Ahmet" ve "Ayşe", kurulumun "Qutai'ın kullanabilecekleri" adımındaki Kişiler satırından geliyordu ve on dilin hepsinde aynıydı; ayrıca "Kendinizi tanıtın" örneği Almanca, İspanyolca, Portekizce ve Fransızcada İngilizce "Sam" adını kullanıyordu. Şimdi her dil kendi yaygın adlarını kullanıyor: Türkçe Ahmet/Ayşe, İngilizce James/Emma, Almanca Thomas/Anna (örnekte Lukas), İspanyolca Carlos/Lucía (Pablo), Portekizce João/Ana (Lucas), Fransızca Thomas/Julie, Japonca 健太/美咲, Korece 민준/서연, Rusça Сергей/Ольга, Endonezce Budi/Dewi; ad kutusundaki örnekler (Ayşe, Jane, Erika, Ana, Maria, Marie, 花子, 지은, Анна, Siti) zaten yereldi. Kurulum dışında bulunan ve değiştirilmeyenler raporda ve `docs/design/31-onboarding.md` › Limits'te: İngilizce ve Türkçe gizlilik politikasındaki "call Ahmet" örneği, asistanın komutundaki ve kişi arama aracındaki örnekler, İngilizce ve İspanyolca "İstanbul'dan Ankara'ya uçuş" önerisi. Denetlenen: `test:i18n`.
  - [ ] Telefonda bakın: dil adımında birkaç dil seçip "Qutai'ın kullanabilecekleri" adımındaki Kişiler satırını ve "Bana kendinizden bahsedin" metin kutusundaki örneği okuyun; adlar o dile uygun olmalı.
- [x] Kurulumdaki "Bana kendinizden bahsedin" ("Tell me about yourself") ekranı daha kullanıcı dostu olsun (19 Kas; 0.1.3). İstek: ilk aşamada üç seçenek çıksın: "Konuşarak söylemek istiyorum", "Yazmak istiyorum", "Bana soru sor". Büyük mikrofon ve dinleme görünümü yalnızca "konuşarak" seçilince gelsin; şimdi ekran doğrudan mikrofonla açılıyor. "Bana soru sor" seçeneğinin nasıl çalışacağı (soruların sesle mi yazıyla mı sorulacağı, kaç soru) düzeltme sırasında kararlaştırılacak. **Düzeltildi (19 Kas):** adım artık üç seçenekle açılıyor ("Konuşarak söylemek istiyorum", "Yazmak istiyorum", "Bana soru sor") ve altta "Şimdi değil"; seçeneklerin altında tek satırlık gizlilik notu var. Büyük mikrofon, söylenmeye değer konular ve mikrofonun altındaki gizlilik notu yalnızca "Konuşarak" seçilince geliyor; mikrofon izni ancak bir mikrofona dokununca isteniyor. "Yazmak istiyorum" doğrudan metin kutusunu açıyor. **"Bana soru sor" için kurulan varsayılan (değiştirilebilir):** beş kısa, sabit ve çevrilmiş soru, ekranda yazıyla, birer birer: adınız, şehriniz, yemek (beslenme, alerji), alışveriş ve teslimat, yanıt tarzı; her biri bir öneri düğmesiyle, yazarak ya da küçük mikrofonla yanıtlanır ya da atlanır; hoparlör düğmesi açılırsa sorular sesli okunur. Soruları sormak için yapay zekâ gerekmez; yazılan ya da söylenen yanıtlar, takip sorularındaki gibi tek bir istekle notlara dönüştürülür ve hepsi aynı "Anladıklarım" sayfasında kontrol edilip aynı yere (hafıza, yanıt tarzı satırı) kaydedilir. Yapay zekâ yoksa yalnızca "Bana soru sor" çıkar ve yanıtlar verildiği gibi listelenir. İlk sorudan ya da yazma sayfasından geri, üç seçeneğe döner. Denetlenen: tür denetimi, lint, `test:intro` (yeni akış testleriyle), `test:i18n`; iOS simülatöründe İngilizce ve Almanca: yapay zekâsız tek seçenek, beş soru (yazılan ad, atlamalar, "Karte", "Kurz und knapp"), "Das habe ich verstanden" sayfasında iki satır, "Gespeichert … 2"; anahtar girilince üç seçenek, "Ich möchte es sprechen" ile mikrofon sayfası ve geri, "Ich möchte tippen" ile metin kutusu. Bu denemede iki düzeltme yapıldı: soru sayfası artık her yeni soruda aşağı kayıyor (beşinci soru görünmüyordu) ve "Bana soru sor"daki yemek sorusu "Yemekten hiç bahsetmediniz" yerine "Yemekte tercihleriniz ya da kısıtlarınız var mı?" diye soruluyor. Denenmedi: gerçek konuşma, mikrofon izni, yapay zekâyla ikinci istek (sahte yapay zekâ kurulmadı).
  - [ ] Telefonda bakın: kurulumda ve Ayarlar › Asistan › Hafıza › "Kendinizi tanıtın"da üç seçenek görünmeli, mikrofon görünmemeli ve izin sorulmamalı. "Konuşarak": büyük mikrofon, dokununca izin ve dinleme. "Yazmak": metin kutusu. "Bana soru sor": beş soru birer birer; birini yazarak, birini mikrofonla, birini öneriyle yanıtlayın, birini atlayın; "Anladıklarım" sayfasında doğru notlar; kaydedip Hafıza'da görün. Yapay zekâ ayarlamadan da deneyin: yalnızca "Bana soru sor" çıkmalı, yanıtlar yazdığınız gibi listelenmeli.
- [x] Kurulumdaki "her sayfayı sizinle okur" anlamındaki tanıtım cümlesi yanıltıcı: asistan her sayfayı kendiliğinden, her seferinde okuyormuş gibi anlaşılıyor; oysa yalnızca siz isteyince okur (20 Kas; 0.1.3). İstek: "dilerseniz okuyabilir" anlamında ya da daha iyi bir ifade. Aynı ifade web sitesinde de olabilir; uygulamada on dilin hepsinde ve web sitesinde (İngilizce, Türkçe) taranıp düzeltilecek. "düzelt" denince bakılacak. **Düzeltildi (20 Kas):** cümle yalnızca kurulumun ilk ekranındaydı (ilk özellik başlığı) ve on dilin hepsinde aynı anlamdaydı; şimdi "İstediğinizde sayfayı okur" (İngilizce "Reads the page when you ask"). Üstteki tanıtım cümlesi de "İstediğinizde sayfaları okuyan ve işlerinizi sizin yerinize yapan…" oldu (İngilizce "…when you ask"). Seçenekler: Türkçe "Sorduğunuzda sayfayı okur", "Bulunduğunuz sayfayı ona sorun"; İngilizce "Reads the page you are on, on request", "Ask about the page you are on". Uygulamada başka yerde (ayarlar, izin metinleri) aynı iddia yok; hukuki metinler zaten "istediğinizde" diyor. Web sitesi bu oturumda değiştirilmedi: `webpage/src/i18n/en.ts` ve `tr.ts` içinde `meta.description`, `meta.appDescription`, `hero.lede`, `statement.text`, `agent.lede` ("sayfaları sizin için okur", "Sayfayı okur") aynı izlenimi verebilir. Kural `INTRO-27`. Simülatörde İngilizce, Almanca ve Türkçe karşılama ekranında görüldü.
  - [ ] Telefonda bakın: kurulumun karşılama ekranında üstteki cümle ve ilk özellik "İstediğinizde…" diye okunmalı; birkaç dil seçip uzun dillerde (Almanca, Rusça, Endonezce) başlığın taşmadığına bakın.
- [x] Kurulumdaki "Yapay zekânızı seçin" adımında iki seçenek var: "Qutai Kredileri" ve kendi yapay zekâ anahtarınız. İkincisi ekranın altında kalıyor, kaydırmadan görünmüyor (20 Kas; 0.1.3, telefonda). İstek: iki seçenek de ilk bakışta görünsün; öneri: akordeon (iki başlık görünür, dokunulan açılır, diğeri kapanır). "düzelt" denince bakılacak. **Düzeltildi (20 Kas):** önerdiğiniz akordeon yapıldı. İki başlık ("Qutai Kredileri" ve "Kendi yapay zekâ anahtarımı kullan") her zaman görünür; Qutai Kredileri açık başlar, bir başlığa dokununca o açılır, diğeri kapanır (sayfa değişmez, bulanıklaşma yok). Kendi anahtarınızın sağlayıcı ve anahtar alanları artık ayrı bir ekran değil, kendi bölümünün içinde açılıyor; alttaki düğme açık bölüme göre "Qutai ile devam et" ya da "Devam" / "Şimdilik atla". Sığması için: 760 dp altındaki ekranlarda ve yatayda açıklama cümlesi gösterilmiyor; Qutai bölümündeki "sunucumuzdan geçer" satırı kaldırıldı (aynı bilgi oturum açmadan önce çıkan açıklama penceresinde var); başlıkların yazısı sistem yazı boyutuyla en çok 1,3, açık Qutai bölümünün yazısı en çok 1,2 kat büyüyor (küçük ekranda biraz daha küçük yazıyla), ötesinde adım kaydırılır. Profesyonel modu olmayan sürümde yalnızca anahtar alanları var, akordeon yok. "Qutai Kredilerine dön" bağlantısı ve "ya da" yazısı kaldırıldı. Kural `INTRO-28`. iPhone SE simülatöründe (375 x 667, bu makinedeki en küçük iOS ekranı) İngilizce, Almanca ve Türkçe görüldü: iki başlık kaydırmadan görünüyor, Almanca en büyük erişilebilirlik yazı boyutunda da; ilk denemede 1,4 katta ikinci başlık kesiliyordu, yazı sınırları bu yüzden düşürüldü. Akordeonun açılıp kapanması ve düğmenin değişmesi de görüldü. 360 x 640 dp bir Android'de denenemedi (öykünücü açılmadı, bellek).
  - [ ] Telefonda bakın (küçük bir telefonda, büyük yazıyla da): "Yapay zekânızı seçin" adımında iki başlık kaydırmadan görünmeli; "Kendi yapay zekâ anahtarımı kullan"a dokunun: alanlar açılmalı, Qutai bölümü kapanmalı, düğme "Şimdilik atla" olmalı; anahtar girince "Devam"; Qutai başlığına dokunun: geri açılmalı; geri okuyla bir önceki adıma dönülmeli.

### 20 Kasım'da bildirilenler

Sahibi telefonda, yavaş bir bağlantıda bildirdi (20 Kas; 0.1.3).

- [x] Google'ı açıp bir sonuca dokununca bir süre hiçbir şey değişmiyor: adres çubuğu da sayfa da aynı kalıyor; bir
      şeyin olduğu belli değil. İstek: dokunur dokunmaz bir şeyin yüklendiği görünsün (Chrome'daki gibi). Kodda bilinen:
      yükleniyor çizgisi (`tab.loading`) ancak WebView'in yükleme başlangıcında açılıyor; bu da sitenin ilk yanıtından
      sonra geliyor, yani ondan önceki bekleme görünmüyor.
      **Düzeltildi (20 Kas):** dokunur dokunmaz sekmeye ait "bekleyen gezinme" başlıyor: ilerleme çizgisi hemen %10'da
      çıkıp yavaşça %30'a ilerliyor, site yanıt verince gerçek ilerlemeyi izliyor, geri gitmiyor; adres çubuğu sayfa
      açılana kadar ekrandaki sayfayı gösteriyor, altında "localhost açılıyor…" yazıyor; 4 sn sonra "henüz yanıt
      vermiyor" ve Durdur, 25 sn sonra "Bağlantı çok yavaş", Tekrar deneyin ve Durdur. iOS simülatöründe yavaş sunucuyla
      görüldü (`node scripts/slow-server/server.mjs`, 10 sn'lik sonuç); Android'de denenemedi (öykünücü bu makinede
      bellek yetmediği için yanıt vermedi). Kurallar `TABS-18`…`TABS-22`.
  - [ ] Telefonda bakın (Android ve iOS, yavaş bağlantıda ya da `adb reverse tcp:8823 tcp:8823` ile yavaş sunucuda):
        bir sonuca dokunun; çizgi hemen çıkmalı, adres değişmemeli, altta "… açılıyor" yazmalı; 4 ve 25 saniyedeki
        satırlar ve düğmeler; Durdur'da çizgi hemen kaybolmalı ve eski sayfa kalmalı; "Hareketi azalt" açıkken çizgi
        kaymadan adım adım ilerlemeli; yeni sekme sayfasından bir adres açınca beyaz ekran yerine yeni sekme sayfası
        site yanıt verene kadar kalmalı; çevrimdışıyken bir bağlantıya dokunun: "İnternet bağlantısı yok" hemen
        görünmeli, hata sayfası bağlantı gelince kendiliğinden bir kez yeniden açılmalı.
- [ ] Bu yükleme beklerken başka bir sekme açılıyor; yükleme bitince sayfa sanki yeni açılan sekmede yükleniyor.
      Nedeni henüz bilinmiyor.
      **Yeniden üretilemedi (20 Kas):** iOS simülatöründe (yavaş sunucu, yeni sekme açma, uyuyan sekmeye geçme) ve
      gerçek `Browser`/`Tab` sınıflarıyla çalışan senaryo testlerinde (Android ve iOS olay sırasıyla) her yükleme kendi
      sekmesinde kaldı; Android öykünücüsü bellek yetmediği için çalıştırılamadı. Kodda bulunan olası yol: Android'de
      bir sayfanın geç açtığı pencere (yavaş yanıttan sonra) yeni sekme olarak öne geçip kullanıcının açtığı sekmenin
      önüne çıkıyordu. Koruma eklendi: sayfanın açtığı pencere yalnızca sayfa ekrandayken ve son 3 sn'de dokunulduysa
      öne gelir, yoksa arkada açılır ve "Bir sayfa yeni bir sekme açtı" (Göster) yazar (`TABS-23`); yüklemesi bekleyen
      sekme bellek uyarısında uyutulmaz (`TABS-10`). Senaryolar kalıcı test: `npm run test:navigation`.
  - [ ] Telefonda (Android) bakın: yavaş bağlantıda Google'da bir sonuca dokunup hemen yeni sekme açın; sonuç ilk
        sekmede açılmalı, yeni sekme yeni sekme sayfası olarak kalmalı. Sorun yine olursa: kaç sekme açıktı, yeni
        sekme nasıl açıldı (menü, sekmeler ekranı) ve sekme sayısı arttı mı, not edin.
- [x] Kurulumdaki yanıt tarzı / "özel talimat" seçimi ("kısa ve öz" ve diğer seçenekler) kaldırılsın: yanıt tarzı hep "kısa ve öz" olsun, kullanıcıya hiç sorulmasın (20 Kas; 0.1.3). Kapsam düzeltmede netleşecek: kurulumdaki seçim adımı, "Bana soru sor" akışının beşinci sorusu (yanıt tarzı) ve varsayılan değer. Ayarlar'daki özel talimat alanı kalır (sahibi yalnızca kurulumda sorulmasını istemedi; aksi söylenirse o da değişir). "düzelt" denince bakılacak. **Düzeltildi (20 Kas):** yanıt tarzı artık hiçbir yerde sorulmuyor: "Bana soru sor" dört soru soruyor (ad, şehir, yemek, alışveriş ve teslimat); konuşarak ya da yazarak tanıtımdan sonraki ek sorularda ve yazılı soruların sayfalarında da yanıt tarzı yok. Varsayılan: kurulum bittiğinde özel talimatlarda yanıt tarzı satırı yoksa, eskiden "Kısa ve öz" seçilince eklenen satırın aynısı ("Kısa ve öz yanıt ver.", kurulumun dilinde) özel talimatlara eklenir; Ayarlar › Asistan › Özel talimatlarda görünür, değiştirilebilir, silinebilir. Kullanıcı tanıtımda kendisi "ayrıntılı yanıt isterim" derse onunki geçerli. Güncellemeyle var olan kullanıcıların özel talimatlarına dokunulmaz (yalnızca ilk kurulum ekler). Asistanın sabit talimatları değişmedi, yani ajan profili aynı (`npm run profile:check` değişiklik göstermedi), sunucuya yeni profil kaydı gerekmez. Ayarlar'daki özel talimat alanı aynen duruyor. Kural `INTRO-29`. Simülatörde (Türkçe) "Bana soru sor" kartında "Tek tek dört kısa soru" ve akışta "Soru 1 / 4" … "4 / 4", ardından doğrudan "Anladıklarım" görüldü (kartın "beş kısa soru" metni bu kontrolde bulunup on dilde düzeltildi). Kurulum sonunda özel talimata satırın eklendiği ekranda görülmedi, yalnızca testlerle denetlendi.
  - [ ] Telefonda bakın: uygulama verisini silip kurulumu baştan yapın; "Bana soru sor" dört soru sormalı, yanıt tarzı sorulmamalı; kurulum bitince Ayarlar › Asistan › Özel talimatlarda "Kısa ve öz yanıt ver." satırı olmalı. Bir de "Kendinizi tanıtın"da "ayrıntılı yanıtları severim" deyin: o satır kalmalı, kısa satır eklenmemeli.
- [x] Kurulumdan "varsayılan tarayıcı yap" adımı kaldırılsın (20 Kas; 0.1.3). Ayarlar'daki varsayılan tarayıcı seçeneği kalır. "düzelt" denince bakılacak. **Düzeltildi (20 Kas):** kurulumdaki "Qutai'yi varsayılan tarayıcınız yapın" adımı kaldırıldı; son adım artık reklam ve izleyicilere karşı koruma, düğmesi "Gezinmeye başla". Uygulamanın Ayarlar'ında aslında böyle bir seçenek yoktu (yalnızca kurulumda ve asistanın "ayarları aç" aracında vardı); kaybolmasın diye aynı cümle, düğme ve ipucuyla Ayarlar › Arama sayfasının altına taşındı: "Varsayılan tarayıcı yap" telefonun varsayılan tarayıcı ekranını açar. Kural `INTRO-30`. Simülatörde kurulum yedi adım ve son adım koruma ("Gezinmeye başla") olarak görüldü; Ayarlar › Arama'daki yeni bölüm ekranda görülmedi.
  - [ ] Telefonda bakın: kurulumu baştan yapın; koruma adımından sonra kurulum bitmeli, varsayılan tarayıcı adımı çıkmamalı, üstteki nokta sayısı bir azalmalı; Ayarlar › Arama'nın altında "Qutai'ı varsayılan tarayıcınız yapın" bölümü olmalı; "Varsayılan tarayıcı yap" telefonun ekranını açmalı (iOS: Ayarlar › Qutai › Varsayılan Tarayıcı Uygulaması; Android: varsayılan uygulamalar).
- [x] Kurulumda "Hangi şehirde yaşıyorsunuz" sorusunda bir düğmeyle mevcut konum istenip ilçe, il, ülke kaydedilebilsin; "bunu daha önce yapıyorduk, gizlemişiz" (20 Kas). **Düzeltildi (20 Kas):** düğme 14 Kasım'dan beri yazılı soruların şehir sayfasındaydı ve çalışıyordu; 19 Kasım'da "Bana soru sor" ana yol olunca o akışın şehir sorusuna eklenmemişti, yazılı sorular da yalnızca yazma ekranından ya da bir hatadan sonra açılır kaldı. Yani bilerek gizlenmemiş, yeniden düzenlemede kaybolmuş. Aynı düğme artık "Bana soru sor"un şehir sorusunda ve konuşarak ya da yazarak tanıtımdan sonraki şehir sorusunda da var. Konum izni yalnızca düğmeye dokununca istenir; konum bir kez okunur, telefonun adres servisi (iOS'ta Apple'ınki, çoğu Android'de Google'ınki) yer adına çevirir; koordinatlar saklanmaz, yapay zekâya gitmez. Alana ilçe, il, ülke yazılır ("Kadıköy, İstanbul, Türkiye"; mahalle, sokak yok; Japonca ve Korecede büyükten küçüğe); kullanıcı düzeltebilir, silebilir, atlayabilir; yazılan şehirle aynı yere kaydedilir. İzin verilmezse, konum kapalıysa, 30 sn'de konum gelmezse, internet yoksa ya da yer adı bulunamazsa kısa bir satır çıkar, metin alanı yerinde kalır. iOS izin metni on dilde zaten bu kullanımı anlatıyordu; yeni izin ya da metin yok, yeni yerel derleme gerekmez. Kural `INTRO-31` (ayrıca `DATA-17`, `OSPERM-6` güncellendi). Yalnızca testlerle denetlendi (simülatörde denenmedi).
  - [ ] Telefonda bakın: kurulumda "Bana soru sor" › şehir sorusunda "Konumumu kullan"a dokunun; izin o an sorulmalı (daha önce değil); alana "ilçe, il, Türkiye" gelmeli, düzeltip "İleri" deyin; "Anladıklarım"da şehir doğru olmalı. Bir de izni reddedin: kısa bir satır çıkmalı, yazarak yanıtlayabilmelisiniz. Uçak modunda deneyin: "yer adı bulunamadı" satırı.
- [x] Qutai Kredileri'nde katman seçimi ("Qutai Hızlı", "Qutai", "Qutai Pro") kaldırılsın: kullanıcıya seçenek gösterilmesin, hep hızlı katman kullanılsın, yani arkada Claude Haiku (20 Kas; 0.1.3). Bilinenler: katmanlar sunucudaki `model_tiers` ayarında; şimdiki varsayılan `standard` (Claude Sonnet 5.5), `fast` = Claude Haiku 5.5 ve adım sınırı 25 (standartta 40). Varsayılanı değiştirmek panelden yapılabilir; seçimin arayüzden kalkması uygulama değişikliği ister. Düzeltmede sorulacak: hızlı katmanın adım sınırı 25'te mi kalsın, derin araştırma da Haiku ile mi çalışsın, kendi anahtarıyla kullananların model seçimi aynen kalsın mı. "düzelt" denince bakılacak. **Düzeltildi (20 Kas):** katman seçimi arayüzün her yerinden kalktı: Ayarlar › Asistan › Qutai Kredileri'nde katman listesi, "kredi/adım" satırları ve "Bunlar hangi yapay zekâ modellerini kullanıyor" yok (yerine tek satır: "Yapay zekâ modelini Qutai seçer ve uygulama güncellemesi olmadan değiştirebilir…"); panel başlığının altındaki sohbet menüsünde Qutai Kredileri tek satır; başlıkta "Qutai · bakiye", Ayarlar özetinde "Qutai Kredileri"; yanıt maliyetinde "Model: Qutai Kredileri" ve altında yanıtı veren gerçek model. Kurulumda zaten katman seçimi yoktu. Her istek, sunucunun `/config` içinde varsayılan işaretlediği katmanla gider (uygulamada katman adı ya da model yazılı değil); yani modeli panelden siz belirlersiniz. **Dikkat:** isteğiniz "hep hızlı katman (Haiku)" idi; bugün sunucudaki varsayılan `standard` (Sonnet). Haiku için panelde Settings › `model_tiers` içinde `default: true` işaretini `fast` katmanına taşıyın (o zaman adım sınırı da `fast`ın 25'i olur; derin araştırma da aynı katmanla çalışır). Sunucu ne katman ne model içeren isteği bugün reddediyor (400 `bad_request`); bu yüzden uygulama katmanı boş göndermek yerine `/config`'deki varsayılanın kimliğini gönderiyor, sunucu değişikliği gerekmedi. Eski sürümde seçilmiş bir katman (ör. "Qutai Pro") saklı kalır ama okunmaz, bir şey bozmaz; varsayılan katman değişirse ya da adı değişirse (`tier_unknown`) uygulama `/config`'i yeniden okuyup bir kez yeniden dener. Kendi anahtarıyla kullananların sağlayıcı ve model seçimi aynen duruyor. Katmanları anlatan metinler on dilde silindi, hata metinleri yeniden yazıldı. Asistana giden kimlik notu artık katman adı içermiyor ("Qutai Kredileri üzerinde çalışıyorsun"); bu mesaja eklenen bir not, ajan profili değişmedi. Kural `CRED-39`. Ekranda görülmedi (sunucu ve oturum gerekiyor): yalnızca testlerle denetlendi.
  - [ ] Telefonda bakın (Qutai Kredileriyle oturum açıkken): Ayarlar › Asistan'da katman listesi olmamalı; panel başlığına dokununca açılan menüde "Qutai Kredileri" tek satır olmalı; bir mesaj gönderin, yanıtın maliyetine dokunun: "Model: Qutai Kredileri" ve "Yanıtlayan: …" görünmeli. Panelde varsayılan katmanı değiştirip (ör. `fast`) yeni bir sohbette yine sorun: yanıtlayan model değişmeli, uygulama güncellemesi gerekmeden. Eski sürümde "Qutai Pro" seçmiş bir telefonda güncellemeden sonra mesaj göndermek hatasız çalışmalı.
- [x] Yönetim paneli, önceki maddenin devamı (20 Kas): "Prices and packs" ekranında şimdiki gibi birçok modelin verisi olmasın, yalnızca kullanılan model (Claude Haiku) görünsün; ayrıca varsayılan model panelden seçilebilsin (bugün "Haiku 5.5", yarın "Haiku 5.6" çıkınca panelden değiştirilebilsin, dağıtım gerekmeden). Bilinenler: `prices` tablosu yalnızca eklemeye açık (satır silinmez, güncellenmez), yani eski modellerin fiyatları veritabanında kalır ama ekranda gizlenebilir; model bugün `model_tiers` ve `allowed_models` ayarlarının JSON'unda duruyor, panelde ham JSON olarak düzenleniyor; fiyatı girilmemiş bir model sunucuda reddediliyor (`price_missing`), yani yeni model seçilmeden önce panelden fiyatı girilebilmeli. "düzelt" denince bakılacak. **Yapıldı (20 Kas, backend 58ab26f):** Prices and packs ekranının başında artık **Model** bölümü var: kullanılan model, çıktı sınırı, web araması ve uygulamanın gönderdiği katman (`standard`; eski uygulamaların `fast` ve `pro` istekleri de aynı modele gider). **Switch model…** ile başka bir model kimliği (ör. `claude-haiku-5-6`) seçilir; kaydetmeden önce izinli modeller ve katmanın şimdiki ve sonraki hali gösterilir, ikisi tek bir denetim kaydıyla (`model.switch`) birlikte değişir, dağıtım gerekmez. Fiyatı geçerli olmayan modele geçiş reddedilir; yeni modelin fiyatı önce **Enter new prices…** ile girilir (bütün fiyat alanları, milyon token başına dolar, kaynak sayfa, başlangıç zamanı; yalnızca yeni satır eklenir). Fiyat tablosu yalnızca kullanılan modeli ve panelden fiyatı girilen (hazırlanan) modelleri gösterir; ötekiler "Show all models" altında, hiçbir satır silinmedi. Kredi paketleri aynı; ekranda paket kimliğinin App Store Connect, Play Console ve RevenueCat'te de bulunması gerektiği yazıyor. Denendi: testler (model geçişi, fiyatsız modele geçişin reddi, eski katman adları) ve yerel panelde production'a benzer ayarlarla (üç katman, Sonnet varsayılan) Haiku'ya geçiş tıklanarak. Uygulamada değişiklik gerekmedi; migration yok. **Sizin yapacağınız:** sonraki dağıtımdan sonra production'da `backend/DEPLOY-prod.md` › "Tek modele ve %100 kâr payına geçiş" adımları (Switch model… → `claude-haiku-5-5`); ardından uygulamada bir Qutai Kredisi görevi çalıştırın ve panelin Usage and cost ekranında isteğin `claude-haiku-5-5` ile karşılandığını görün (uygulama artık modeli göstermiyor, `CRED-44`).
- [x] Fiyatlandırma kararları (sahibi, 20 Kas): 1 kredi = 1 sent kalır (`creditsPerUsd` 100); kâr payı %100 olur (`marginBps` 10000, sağlayıcı maliyetinin iki katı; gerekçe: mağaza komisyonu %15 ila %30, %30 kâr payı komisyonu karşılamıyor); temel alınan model Claude Haiku. Yönetim panelinde modelin fiyat alanının yanında bir "kontrol et" düğmesi olsun: Anthropic'in fiyat sayfasından okuduğunu yalnızca öneri olarak göstersin, sahibi onaylamadan hiçbir şey uygulanmasın (Anthropic'in fiyat döndüren bir API'si yok; sayfa okunamaz ya da biçimi değişmişse düğme bunu açıkça söylesin). Production'daki `pricing` ayarı panelden değiştirilecek (dağıtım betiği var olan ayarı ezmez); betikteki ilk değer de %100 yapılacak. Kâr payı panelden ayarlanabilsin: bugün Settings › `pricing` içinde ham JSON olarak (`marginBps`) değiştirilebiliyor; istek, yüzde olarak girilen anlaşılır bir alan ve yanında örnek hesap (1 $ maliyet kaç kredi düşer). Paket fiyatları (0,99 $ = 100 kredi, 4,99 $ = 500, 9,99 $ = 1000 önerildi) RevenueCat kurulurken kesinleşecek. "düzelt" denince yapılacak. **Yapıldı (20 Kas, backend 58ab26f):** Prices and packs › **Margin** bölümünde kâr payı yüzde olarak (ör. `100`) ve yanında "1 dolar maliyet başına kredi" alanıyla girilir; pencere, kullanılan modelin geçerli fiyatlarıyla tipik bir adımın ve on adımlık bir görevin bize maliyetini ve kullanıcıdan düşülecek krediyi canlı gösterir (Haiku 5.5, 100 kredi/$, %100: adım 0,00113 $ → 0,23 kredi; on adım 0,0113 $ → 2,26 kredi), kaydetmeden önce neyin değişeceğini yazar; kayda geçer. Modelin fiyat tablosunun yanında **Check prices** düğmesi Anthropic'in fiyat sayfasını (yalnızca basınca) okur ve geçerli fiyatların yanında öneri olarak gösterir; **Accept…** demeden hiçbir şey kaydedilmez, kabul edilirse yeni fiyat satırları eklenir. Sayfa okunamazsa, model bulunamazsa ya da sayılar güvenle okunamazsa bunu açıkça söyler ve sayfanın bağlantısını verir. Yerel sunucudan gerçek sayfayla denendi: Sonnet 5.5 ve Haiku 5.5 için "The page matches the prices in force." çıktı. Tohum ve dağıtım betiğinin ilk değerleri artık yalnızca Haiku, 100 kredi/$ ve %100. Paket fiyatları RevenueCat kurulurken kesinleşecek (değişmedi). **Sizin yapacağınız:** production'da aynı adımlar, Change margin… → `100` (`backend/DEPLOY-prod.md`); Check prices'ı bir kez de production'da deneyin.
- [x] Asistanın sunduğu seçenekler görsel kutular (kartlar) olarak gösterilsin (20 Kas; 0.1.3): hem sohbet panelinde hem de sayfa içinde alttaki bantta açılan menüde. Örnek: "bana kırmızı bir kazak bul" denince bugün yalnızca bir mağaza bağlantısı veriliyor; istek, her seçeneğin ürün resmi, adı, fiyatı ve kaynağıyla bir kutu olması, dokununca açılması. Genel olarak buradaki arayüz daha gösterişli olsun. Düzeltmede ele alınacaklar: asistanın kartları yapılı biçimde vermesi (talimat ya da araç değişir, yani ajan profili değişir ve sunucuya yeni profil kaydı gerekir); resimlerin sitelerden yüklenmesi telefondan o sitelere istek demektir (tasarım kaydında "telefondan ne çıkar" güncellenir; gizli sekmede davranış kararlaştırılır); resmi olmayan ya da yüklenemeyen seçenekte kart yine düzgün görünmeli; ürün dışındaki seçenekler (otel, uçuş, makale, yer) için de aynı kart. "düzelt" denince bakılacak. **Yapıldı (20 Kas):** asistanın yeni `show_options` aracı birkaç seçeneği kart olarak gösteriyor: resim, ad, sayfadaki haliyle fiyat, tek satır ayrıntı (satıcı, puan, tarih…) ve site adı; ürün, otel, uçuş, yer, makale için aynı kart. Sohbet panelinde ve sayfanın altındaki bandın açtığı yanıt kartında yana kaydırılan bir sıra (telefon genişliğinde iki kart ve üçüncünün kenarı); dokununca bağlantı sohbet bağlantıları gibi sekmenin grubunda açılır, uzun basınca "Yeni sekmede aç", "Gizli sekmede aç", "Bağlantıyı kopyala", "Paylaş". Resimleri model vermiyor: uygulama sayfadaki bağlantının içindeki ya da kartındaki resmi kendisi buluyor; fiyat yalnızca okunan sayfada geçiyorsa gösteriliyor (bunun için read_page, 80 karakterde kesilen ürün bağlantılarına `prices="…"` ekliyor). Uygulama tarafında kurallar: yalnızca https, kartta bağlantının kendi alan adı görünür, düz metin ve uzunluk sınırı, en çok 8 kart; resimler çerez ve Referer olmadan, en çok 600 KB, yalnızca JPEG/PNG/GIF/WebP (SVG yok), bellekte tutulur; reklam engelleme açıkken listedeki reklam alan adlarından resim yüklenmez. Resim yüklenemezse kartta sitenin harfi rozet olarak görünür, boşluk kalmaz. **Gizli sekmede** resimler kendiliğinden yüklenmez, "Resimleri göster" düğmesiyle yüklenir (varsayılan, sizin onayınızı bekliyor). Gizlilik politikalarına (açık kaynak ve pro, İngilizce ve Türkçe) resim istekleri eklendi; **sürüm numarası artırılmadı**, kullanıcılara yeniden onaylatmak sizin kararınız. Kurallar `UI-23`…`UI-26`, `UNTR-20`, `DATA-24`, `INC-29`. **Ajan profili değişti** (`0a7612232842…` → `59d25db9d8ea…`): yeni paketin konuşabilmesi için profil yerel sunucuda kaydedilmeli ve production sunucusu yeniden dağıtılmalı. Yeni yerel derleme gerekmez (yalnızca JavaScript). Denendi: testler (`npm run test:assistant` içinde 15 yeni test) ve iPhone 18 Pro simülatöründe, sahte yapay zekâ ile Trendyol'un gerçek "kırmızı kazak" arama sayfasında: panelde kartlar gerçek ürün resimleri ve fiyatlarla göründü, dokununca ürün aynı grupta yeni sekmede açıldı, uzun basınca menü çıktı, resimsiz kartlarda harf rozeti, kaydedilmiş sohbet uygulama yeniden açılınca kartlarıyla geri geldi, gizli sekmede "Resimleri göster" çalıştı, koyu temada düzgün, http/`javascript:`/sahte alan adı kartları atıldı ve uydurma fiyat gösterilmedi. **Denenmedi:** gerçek bir modelle (yeni profil sunucuda kayıtlı değildi; küçük modelin kartları ne kadar iyi doldurduğu bilinmiyor), bandın açtığı yanıt kartında kartlar (sesli görev gerekiyor), Android, büyük yazı boyutu ve yatay ekran.
  - [ ] Telefonda bakın (yeni paket ve yeni profil kayıtlı sunucuyla): "bana kırmızı bir kazak bul" deyin; panelde resimli kartlar gelmeli, metin yanıtı kartları tekrar saymamalı. Q düğmesine basılı tutup sesle aynı isteği verin: bandın açtığı yanıt kartında kartlar görünmeli. Bir otel ya da uçuş araması da deneyin. Gizli sekmede "Resimleri göster" davranışını onaylayın ya da değiştirin; gizlilik politikası sürümünün artırılıp artırılmayacağına karar verin.
- [x] Kartların devamı (20 Kas, telefonda): sayfa açmadan "bana kırmızı bir kazak bul" denince kartlar resimsiz geliyor ve yanıt "kartlarda fiyat var" diyor ama kartlarda fiyat yok. Karar (sahibi): her ürün aramasında mağaza sayfası açılmasın (ek kredi istenmiyor), web aramasından gelen kartlar resimsiz kalsın; yalnızca talimat netleşsin. **Yapıldı (20 Kas):** asistan artık uygulamanın kartlardan çıkardığı fiyatı ya da resmi kartlarda varmış gibi söylemiyor (aracın sonucu kaç kartta resim ve fiyat olduğunu da söylüyor). Kural `UI-23`.
- [x] Asistan seçim sorusu sorduğunda (örneğin "kazak bul" denince önce "Kadın" / "Erkek" düğmeleri) panel açılmadan, soru ve düğmeler sayfanın üstünde bir baloncukta gösterilsin; sığmıyorsa panel açılsın (sahibi, 20 Kas). **Yapıldı (20 Kas):** panel kapalıyken biten görev kısa bir soruyla bitiyorsa (soru en çok 140 karakter düz metin, 2 ila 4 seçenek, her biri en çok 28 karakter; yazı büyüdükçe sınırlar küçülür) soru, sonuç kartıyla aynı görünümde sayfanın altında çıkıyor: başlık "Qutai soruyor", soru, seçenek düğmeleri, "Sohbeti aç" ve kapat. Bir seçeneğe dokununca cevap gönderiliyor ve görev panel açılmadan şeritte sürüyor. Liste, tablo, bağlantı ya da uzun soru, 5 ve daha fazla seçenek, ya da paneli siz açık tuttuysanız eskisi gibi panel açılıyor. Asistandan soruyu tek kısa cümle yazması isteniyor. Kural `WORK-17`. Ajan profili yine değişti (`d02fbd22…`): sunucuya kaydedilip yeniden dağıtılmalı. Yalnızca testlerle denetlendi (kural ve durum makinesi), ekranda görülmedi.
  - [ ] Telefonda bakın: sayfa açıkken "bana kazak bul" deyin; asistan "Kadın mı erkek mi?" diye sorarsa baloncukta düğmeler çıkmalı, birine dokununca panel açılmadan devam etmeli. "Sohbeti aç" paneli açmalı. Uzun bir soru (ya da çok seçenekli) paneli açmalı. Baloncuğun büyüklüğünü ve sınırları (140 / 4 / 28) beğenip beğenmediğinizi söyleyin.
- [x] Yönetim paneli › Settings sayfası okunabilir olsun (20 Kas): bugün her ayar ham JSON metni olarak gösteriliyor ve düzenleniyor. İstek: her ayar için adı ve ne işe yaradığı yazan, alan alan düzenlenen bir form (sayı alanı, açma kapama düğmesi, liste, yüzde, dolar); birimler insan diliyle (mikro USD yerine dolar, baz puan yerine yüzde, saniye); kaydetmeden önce neyin değişeceği gösterilsin. Ham JSON yalnızca "gelişmiş" altında kalsın. Denetim kaydı ve gerekçe alanı aynen kalır. Sahibi "bunları düzelt" dedikten hemen sonra yazdı; panel işiyle (not 6 ve 7) birlikte yapılacak. **Yapıldı (20 Kas, backend 58ab26f):** Settings ekranının en üstünde **Emergency** bölümü var: bütün yapay zekâ isteklerini durdurma / sürdürme ve bakım modu, durum renkli ve tek düğmeyle. Altında her ayar adı, ne işe yaradığını söyleyen bir cümle ve değerleriyle (dolar, yüzde, saniye, MB, sürüm) gösterilir; **Change** alan alan bir form açar, her alan kendi hata iletisini gösterir, kaydetmeden önce "What will change" eski → yeni değerleri listeler. Ham JSON yalnızca **Advanced (JSON)** altında. Gerekçe ve denetim kaydı aynen; sunucu her değeri eskisi kadar sıkı denetler. Sunucu yedeği sınırları (`backup_limits`) da artık panelden değişir. Panel İngilizce kaldı. Yerel panelde denendi: acil durdurma ve geri alma, bakım düğmesi, yedek sınırında aralık dışı değer hatası ve kaydetme, telefon genişliğinde yatay kaydırma yok. **Sizin bakacağınız:** production panelinde Settings ekranını açıp ayarların okunduğunu görün; acil durum düğmelerini production'da denemeyin (gerçek kullanıcıları durdurur).
- [x] ~~Bakım modu ve zorunlu güncelleme mesajlarının altındaki "Ayrıntılar" bağlantısı çalışmıyor (20 Kas; 0.1.3, production sunucusuyla). İstek: ya gerçekten ayrıntı gösterilsin ya da düğme hiç gösterilmesin. Yapılacak: neden çalışmadığı bulunur; gösterilecek ayrıntı varsa (bakımda panelden girilen mesaj, güncellemede gereken en düşük sürüm ve kurulu sürüm) açılır, yoksa düğme gizlenir; zorunlu güncellemede mağaza sayfasını açan bir "Güncelle" düğmesi olup olmadığına da bakılır. Uygulama oturumuyla (not 1 ila 5) birlikte yapılacak.~~ İPTAL (sahibi, 20 Kas): bağlantılar çalışıyormuş; yapılacak bir şey yok.
- [x] Ziyaret edilen sitelere giden User-Agent'taki `qutai.<build>` eki kaldırılsın, yalnızca Qutai sunucusuna giden isteklerde kalsın (sahibi, 20 Kas). **Yapıldı (20 Kas):** sekmeler (gizli sekme ve masaüstü görünümü dahil), okuyucu, kayıtlı sayfalar, PDF okuyucu, uygulamalar, sayfa betikleri ve arama önerileri telefonun gerçek User-Agent'ını gönderiyor (19 Kasım öncesi gibi); yapay zekâ sağlayıcıları, arama motorları, filtre listeleri, indirmeler ve resim kaydetme de 19 Kasım öncesindeki gibi. Yalnızca Qutai sunucusuna giden istekler `Qutai/0.1.3 (iOS) qutai.103` gibi bir User-Agent gönderiyor; karar isteğin adresine (köken) göre tek yerde veriliyor. Android indirme motoru eski koduna döndü; yeni yerel derleme gerekmez. Kural `DATA-23`. Yalnızca testlerle denetlendi (`npm run test:useragent`), telefonda ya da simülatörde görülmedi.
  - [ ] Telefonda bakın (yeni paketle; 19-20 Kasım paketleri eki hâlâ gönderir): bir sekmede `https://httpbin.org/user-agent` açın (sunucuya giden başlık) ve `https://www.whatismybrowser.com/detect/what-is-my-user-agent` açın (sayfanın gördüğü `navigator.userAgent`): ikisinde de `qutai.` olmamalı, Android'de Chrome'a benzer dize, iPhone'da Safari'nin dizesi (sonunda `Mobile/…`) görünmeli. Masaüstü görünümünde ve gizli sekmede aynısı. Bir dosya indirin (Android ve iOS): indirme çalışmalı. Pro paketle oturum açıkken sunucunun kaydında (`wrangler tail` ya da panel) istekler `Qutai/<sürüm> (iOS|Android) qutai.<build>` görünmeli.
- [x] Qutai içinde açılan tüm pencerelerde ve düğmelerde köşe yuvarlaklığı biraz azaltılsın; koddaki tekrar eden stiller temaya alınsın (sahibi, 20 Kas). **Yapıldı (20 Kas):** köşe değerleri artık tek yerde, `src/ui/theme.ts` içindeki `radii`: pencereler (iletişim kutuları, alttan açılan sayfalar, yan panel, sayfa üstündeki yanıt kartı ve soru baloncuğu, bildirim baloncukları, indirme ve seçim çubukları) 16–22'den 14'e; asistanın cam sayfası ve sayfa üstündeki çalışma bandı 26'dan 18'e; menüler, adres çubuğu önerileri ve sohbet baloncukları 12; kartlar 14–16'dan 12'ye; eskiden hap biçimli ana düğmeler 18–26'dan 14'e; küçük düğmeler, metin alanları, uyarı kutuları ve bölümlü seçiciler 10–12'den 8'e. Yuvarlak kalanlar: yuvarlak simge düğmeleri, Qutai düğmesi, anahtarlar, ilerleme çizgileri, rozetler ve seçim çipleri (sorulara verilen cevap düğmeleri, gün seçimi gibi). Adres çubuğu, bulma çubuğu, yeni sekme arama alanı, sohbet yazma alanı, web sayfaları ve sekme küçük resimleri değişmedi. Kart, uyarı kutusu, metin alanı, bölümlü seçici ve onay kutusu stilleri `common()` ile tek yerden geliyor. Kural `UI-27`. Telefonda ve simülatörde görülmedi; yalnızca tip denetimi, lint ve testler.
  - [ ] Telefonda bakın (açık ve koyu temada, bir de büyük yazı boyutunda ve yatayda): bir onay penceresi (ör. geçmişi sil), alttan açılan bir sayfa (sayfa menüsü › Yazı boyutu ya da site izinleri), sayfa menüsü, adres çubuğu önerileri, asistan paneli ve baloncukları, sesli görevde alttaki bant ve yanıt kartı, bir bildirim baloncuğu (ör. yer imi eklendi), indirme çubuğu; kurulum ekranlarındaki ana düğmeler (artık hap değil, köşeleri yuvarlatılmış dikdörtgen), Ayarlar kartları ve Kaydet düğmesi, Hesap ve Kredi ekranları, Sekmeler ekranındaki bölümlü seçici. Köşeler birbiriyle uyumlu görünmeli, iki satıra düşen düğme yazısı ve küçük simge düğmeleri kesilmemeli. Hap biçimli ana düğmelerin dikdörtgene dönmesi hoşunuza gitmezse tek değerle geri alınır (`radii.button`).
- [x] Kod incelemesinin arayüz bulguları (sahibi, 20 Kas): akan yanıt ve yazarken bütün uygulamanın yeniden çizilmesi, yanıt gelirken yukarı kaydırılamaması, profil sorularında çift dokunuşla aynı bilginin iki kez kaydedilmesi, sekme ve çerez listelerinin hepsinin birden çizilmesi, sabit yükseklikli düğmelerin uzun çeviride ve büyük yazıda kesilmesi, kullanılmayan çeviri anahtarları. **Yapıldı (20 Kas):** kurallar `UI-28` ile `UI-32` ve `LANG-23`. Telefonda ve simülatörde görülmedi; yalnızca tip denetimi, lint ve testler.
  - [ ] Telefonda bakın (açık ve koyu temada): uzun bir yanıt akarken yukarı kaydırın; liste sizi sona geri çekmemeli, sağ altta aşağı oklu yuvarlak düğme çıkmalı, dokununca en sona gitmeli; en sona kendiniz kaydırınca düğme kaybolmalı ve yanıt yine takip edilmeli.
  - [ ] Telefonda bakın: uzun bir sohbette (50+ mesaj) hızlı yazın; harfler gecikmemeli, mikrofon ve gönder düğmesi her zamanki gibi çalışmalı; sohbetteki kartların düğmeleri (Ara, Mesajlarda aç, Paylaş, Kaydet, seçenek kartları) eskisi gibi çalışmalı.
  - [ ] Telefonda bakın: 40+ sekmeyle sekme ekranını açın, hızlıca kaydırın (küçük resimler gelmeli, boş kart kalmamalı); bir kartı uzun basıp sürükleyin (sürüklenen kart diğerlerinin üstünde görünmeli, bıraktığınız yere taşınmalı, grup başlığına bırakınca gruba girmeli); karşılaştırma modu, arama, grup açıp kapama ve grup adını klavye açıkken düzenleme; telefon yan çevrilince 3 sütun.
  - [ ] Telefonda bakın: çok çerezli bir sitede (ör. büyük bir haber sitesi) sayfa menüsü › Çerezler; liste hızlı açılmalı ve kaymalı, her alan adı tek kart gibi görünmeli, Değeri göster / Kopyala / Sil ve Tümünü sil çalışmalı.
  - [ ] Telefonda bakın, en büyük yazı boyutunda ve Almanca gibi uzun bir dilde: kurulum, profil soruları, sesli tanıtım, Hafıza, Görevler, kilit ekranı, Yedekleme, Verileri temizle, Ayarlar › Kaydet ve hata ekranındaki ana düğmeler; yazı iki satıra inmeli, kesilmemeli. Profil sorularında ve sesli tanıtımda Kaydet'e iki kez hızla dokunun: bilgi bir kez kaydedilmeli (Hafıza'da tek satır).
  - [ ] Telefonda bakın: Ayarlar, Gönderilenler, Sekmeler, Yer imleri ve geçmiş, Uygulamalarım, Site izinleri, Çerezler, İndirilenler, Kayıtlı sayfalar, QR tarayıcı ve Görevler ekranlarını tek tek açıp geri hareketiyle (Android'de geri tuşu, iOS'ta aşağı kaydırma) kapatın; her biri eskisi gibi kayarak açılıp kapanmalı. İndirme bildirimine dokunarak İndirilenler'i başka bir ekran açıkken açın: o ekran kapanıp İndirilenler açılmalı (iOS'ta açılmazsa söyleyin).

### 21 Kasım'da bildirilenler ("düzelt" bekleniyor)

Sahibi "not et, ben düzelt deyince alttaki ajanlara düzelttir" dedi; hiçbirine dokunulmadı.

- [x] Adres çubuğuna bir şey yazınca açılan öneri listesindeki "Qutai'a sor" satırına dokununca, dokunuş arkadaki sayfaya da geçiyor: satırın altındaki sayfa öğesine de basılmış oluyor (olay arkaya yayılıyor). Öneri listesindeki her satıra (ve listenin boşluklarına) dokunuş yalnızca o satırı tetiklemeli, altındaki web sayfasına hiç ulaşmamalı. Bakılacaklar: öneri katmanının dokunuşu tüketip tüketmediği (Android'de WebView'in üstündeki görünüme geçen dokunuşun aşağı düşmesi, `onPressIn`/`onPress` sırasında klavyenin kapanıp listenin kaybolmasıyla dokunuşun "bırakma" kısmının sayfaya gitmesi), diğer öneri satırlarında (arama, geçmiş, yer imi) da aynısının olup olmadığı, iOS'ta da olup olmadığı. (21 Kas; hangi telefonda olduğu belirtilmedi)
  - Düzeltildi (21 Kas, `77c4103`): neden Android'deydi: öneri listesi ve karartılmış alan adres çubuğunun kendi kutusunun dışına sarkıyordu. React Native dokunuşu buldu (satır çalıştı), ama Android dokunuşu yalnızca bütün üst görünümlerinin içinde kalan bir görünüme verir; bu yüzden aynı dokunuş alttaki web sayfasına da gitti. Emülatörde yeniden üretildi: "Ask Qutai" satırına dokununca sayfadaki düğme de basıldı. Şimdi liste ve karartma, sayfa ve çubuk kadar büyük ayrı bir katmanda çiziliyor. Emülatörde adres çubuğu üstteyken ve alttayken denendi: "Qutai'a sor", arama önerisi, geçmiş satırı ve boş (karartılmış) alan yalnızca kendi işini yapıyor, sayfaya hiç dokunuş gitmiyor; yazarken çubuktaki temizle (×) düğmesi çalışıyor. Ekran okuyucu da satırları artık doğru yerde buluyor. iOS'ta katman zaten dokunuşu alıyordu (React Native iOS'ta kutu dışına sarkan görünümü de yakalar); simülatörde denenemedi (simülatöre erişim izni yanıtsız kaldı).
  - Telefonda bakın (önce Honor'da, sonra iPhone'da): içinde düğme ya da bağlantı olan bir sayfada adres çubuğuna bir şey yazın; "Qutai'a sor" satırına, bir arama önerisine, bir geçmiş/yer imi satırına ve listenin dışındaki karartılmış alana ayrı ayrı dokunun. Yalnızca o satırın işi olmalı, arkadaki sayfada hiçbir şey açılmamalı ya da basılmamalı. Adres çubuğunu alta alıp da deneyin.
- [x] Adres çubuğuna dokununca bazen klavye açılmıyor: alan odaklanmış görünüyor (adres seçili, × görünüyor, öneri listesi açık) ama klavye gelmiyor. Altındaki sayfa bir Google arama sonucuydu (yapay zekâ cevabı, uzun adres). (21 Kas 17:08, Honor / Android 15, 0.1.9 (109))
  - Düzeltildi (21 Kas, `f42ec15`): neden Android'deydi ve 77c4103'ten önce de vardı (emülatörde 0.1.8'de de çıktı; öneri katmanı yol açmadı). React Native alanı odaklarken klavyeyi aynı anda istiyor; Android 14 ve sonrasında klavye hizmeti yeni alana biraz sonra geçtiği için, odak web sayfasından gelince istek düşüyordu (logcat: `onFailed at PHASE_CLIENT_VIEW_SERVED`). Emülatörde Google sayfasını kaydırıp çubuğa dokununca neredeyse her seferinde oldu. Artık alan odaklandıktan sonra kısa aralıklarla (60, 250, 600 ms) bakılıyor; alan hâlâ odaklıysa ve klavye yoksa yeniden isteniyor (sayfa odağı bırakırken klavyeyi kapatırsa da). Back ile kapattıktan sonra odaklı çubuğa dokunmak klavyeyi geri açıyor. Emülatörde: kaydırdıktan sonra ve sayfaya dokunduktan sonra her denemede klavye açıldı; öneri satırına dokunuş yine sayfaya geçmiyor. iOS değişmedi.
  - Telefonda bakın (Honor): bir Google arama sonucunu açın, aşağı kaydırın, çubuğu geri getirmek için biraz yukarı kaydırıp adres çubuğuna dokunun; klavye her seferinde açılmalı (birkaç kez, ayrıca sayfada bir yere dokunduktan sonra da deneyin). Klavyeyi Back ile kapatıp odaklı çubuğa yeniden dokunun: klavye geri gelmeli. Klavye bir an açılıp kendiliğinden kapanırsa ya da Back'ten hemen sonra yeniden açılırsa söyleyin.
## 14. "Kendinizi tanıtın" (sesle tanıtım, 17 Kasım)

iOS simülatöründe yazarak ve sahte yapay zekâyla denendi (simülatöre mikrofondan ses verilemiyor; aynı akış yazılan metinle sürüldü). Telefonda sesle deneyin. Ayrıntı: `docs/voice-introduction.md`.

Kurulumda (yeni kurulum ya da uygulama verisini silerek):
- [ ] "Yapay zekânızı bağlayın" adımında bir anahtar girin (ya da Qutai Kredileri); sonraki "Bana kendinizden bahsedin" sayfasında büyük mikrofon, "Söylemeye değer olanlar" listesi ve hemen mikrofonun altında gizlilik notu görünür.
- [ ] Mikrofona dokunup 20-30 saniye konuşun (adınız, şehriniz, bir alerji, kapıda ödeme, kısa yanıtlar): konuşurken metin canlı yazılır; duraklamalarda dinleme kesilmez; "Dinlemeyi durdur" ile biter.
- [ ] "Duyduklarım" sayfasında metni düzeltin, "Biraz daha konuşun" ile ekleyin, "Devam".
- [ ] En çok üç kısa soru gelir, yalnızca söylemediğiniz konular için (yaş ve cinsiyet hiç sorulmaz). Bir soruyu sesle, birini yazarak (klavyenin "ileri" tuşu da geçer), birini öneriye dokunarak yanıtlayın, birini geçin.
- [ ] "Soruları sesli oku" açıkken her soru okunur; konuşmaya başlayınca okuma susar.
- [ ] "Anladıklarım" sayfasında her not düzenlenir ve silinir; alerji satırında "Yapay zekâdan gizle" açıp kaydedin: Ayarlar › Asistan › Hafıza'da kilitli "Gıda alerjisi · •••" olarak görünür.
- [ ] Yanıt tarzı Ayarlar › Asistan › Özel talimatlar'a tek satır olarak yazılır.
- [ ] "Yazmayı tercih ederim" aynı akışı klavyeyle yapar; "Bunun yerine soruları yanıtlayın" eski soruları açar.

Hata yolları:
- [ ] Yapay zekâ adımını geçin: sayfa bunu açıkça söyler ve "Bunun yerine soruları yanıtlayın" çıkar.
- [ ] Uçak modunda "Devam": "Yapay zekâya ulaşamadım" ve söyledikleriniz kopyalanabilir halde görünür; "Sorularla devam edin" soruları açar, metin soruların üstünde durur.
- [ ] Konuşurken uygulamadan çıkın: mikrofon kapanır, dönünce duyulan kısım "Duyduklarım"dadır.
- [ ] Mikrofon iznini reddedin: uygulamanın kendi uyarısı çıkar, sayfa başa döner ("Hiçbir şey duymadım" demez).

Erişilebilirlik ve görünüm:
- [ ] TalkBack / VoiceOver: her yeni soruya odak gelir; balonlar "Qutai soruyor: …" / "Yanıtınız: …" diye okunur; öneri düğmeleri seçili durumunu söyler.
- [ ] En büyük yazı boyutu, koyu tema, yatay ekran: sözcükler bölünmez, düğmeler erişilebilir kalır.
- [ ] Ayarlar › Asistan › Hafıza › "Kendinizi tanıtın" aynı akışı açar; gizli sekme açıkken düğme pasiftir.
- [ ] Tanıtımı ikinci kez yapın ve başka bir ad söyleyin: "Anladıklarım"da ad satırının altında "Şunun yerine geçer: “Hitap: …”" yazar; kaydedince Hafıza'da tek ad satırı kalır. Alerjiler ise eklenir, yerine geçmez.
- [ ] Türkçe arayüzde metinler "siz" ile, yapay zekânın notları Türkçe; adlar ve markalar söylendiği gibi.

## 15. Kişiler: "Ahmet'i ara", "Ayşe'ye WhatsApp'tan yaz", "bu sayfayı Mehmet Bey'e e-postayla gönder" (19 Kasım)

Yeni yerel derleme gerekir (`expo-contacts`). Ayrıntı: `docs/contacts.md`. Gerçek kişilere arama ya da mesaj göndermeyin:
simülatörde/emülatörde uydurma kişiler ekleyin (aynı ada sahip iki kişi, iki numaralı bir kişi, yalnızca e-postası olan
bir kişi, ülke kodu olmadan kayıtlı bir cep numarası).

iOS simülatöründe denendi (iPhone 17 Pro, iOS 26, Release derleme, 19 Kasım):
- [x] Kurulumdaki "Qutai'ın kullanabilecekleri" adımında kişiler yok (izin ilk kullanımda sorulur).
- [x] Ayarlar › Asistan › Kişiler: açıklama, durum "Henüz sorulmadı" ve "İzin ver". "İzin ver" sistem iznini açar; iznin metni Türkçe.
- [x] iOS sınırlı erişim: "Kişileri Seç" ile tek kişi paylaşıldı; satır "Yalnızca seçtiğiniz kişiler", "Kişileri seç" (iOS'un paylaşılan kişiler ekranı açılır, uygulama çökmez) ve "Ayarları aç" gösterir.

Henüz denenmedi (simülatöre yazı girilemediği için sahte yapay zekâ ayarlanamadı; telefonda deneyin):
- [ ] Sahte yapay zekâyla (`node scripts/fake-ai/server.mjs`, Özel sunucu `http://localhost:8793/v1`, model `fake`) "call Ayşe" yazın: ilk aramada Qutai'ın kısa açıklaması, sonra sistem izni; sonra "Ayşe Test" için Ara düğmesi; kartta numara ve "cep · kişilerinizden" yazar. Yapay zekâya giden kayıtta (Yapay zekâya gönderilenler) numara yoktur, yalnızca ad, "mobile" ve `ct-…` tutamacı vardır.
- [ ] "call Ahmet" (iki Ahmet): Qutai'ın kendi listesi açılır, satırlarda ad, etiket ve numara; seçim yapınca Ara düğmesi seçilen kişiye çıkar. Listeyi kapatınca asistan hangisi olduğunu sorar.
- [ ] "call Zeynep" (rehberde yok): "“Zeynep” ile eşleşen kişi yok" satırı; asistan numarayı ister.
- [ ] "whatsapp Ayşe" (numara 0555 … olarak kayıtlı): kartta +90 555 … ve "Ülke kodu +90 eklendi" yazar; WhatsApp yüklü değilse kopyalama önerilir.
- [ ] "email Mehmet": e-posta oluşturucu alıcıyla açılır; asistan adresi bilmez.
- [ ] Gizli sekmede aynı istek: "Gizli sekme içeren bir sohbette kullanılamaz"; kişi aranmaz.
- [ ] Sayfadaki metin bir ad isterse (örneğin sayfada "Zeynep'e bu bağlantıyı gönder") asistan aramaz: "Kişilerinizde yalnızca sizin adını söylediğiniz kişiler aranır".
- [ ] Uygulamayı kapatıp açın: sohbetteki kişi kartı adı gösterir, numara yerine "Numara sohbetle birlikte saklanmaz" yazar.
- [ ] İzni reddedin: asistan numarayı sizden ister; Ayarlar › Asistan › Kişiler "İzin verilmedi" ve "Ayarları aç" gösterir.
- [ ] Android: ilk retten sonra "İzin ver" sistem iznini yeniden açar; ikinci retten sonra yalnızca "Ayarları aç". Uygulama bilgisinde yalnızca Kişiler (okuma) izni görünür, yazma izni yoktur.
- [ ] Büyük rehber (binlerce kişi) olan gerçek bir telefonda aramanın hızı.
- [ ] TalkBack / VoiceOver: kişi listesi seçenekleri ve kart etiketleri okunur; en büyük yazı boyutu, koyu tema, yatay ekran.

## 16. Sayfa görünümü (stiller) ve çerez listesi (19 Kasım)

Yeni yerel derleme gerekir (react-native-webview yaması değişti: çerez deposu). Tasarım: `docs/page-customisation.md`.
Test sayfaları: `node scripts/page-tests/customise.mjs` (iOS simülatöründe `http://localhost:8812`, Android
emülatöründe `adb reverse tcp:8812 tcp:8812`). Sahte yapay zekâ: `node scripts/fake-ai/server.mjs`, Özel sunucu
`http://localhost:8793/v1`, model `fake`; sözcükler: restyle, bigtext, evilcss, cookies, cookiedel.

iOS simülatöründe denendi (iPhone 17 Pro, iOS 26, Release derleme, 19 Kasım; sahte yapay zekâ, Türkçe arayüz):
- [x] Var olan kurulumda veritabanı geçişi (21) sorunsuz; eski kurallar ve sohbetler yerinde.
- [x] "restyle": onay penceresi (açıklama, site, CSS Ayrıntılar altında); Uygula → bağlantı hemen kırmızı; kartta "Bu site için sakla…" ve "Geri al". Geri al → mavi, kart "Stil kaldırıldı".
- [x] Sakla (varsayılan "Bu site ve alt alan adları") → Kendi kurallarım › Stiller'de "Links in red"; veritabanında temizlenmiş CSS (`!important` ile). Yeni sekmede sayfa: "At first paint: rgb(255, 0, 0)" (yanıp sönme yok); pushState sonrası kırmızı.
- [x] Sayfa menüsü › "Bu sayfada stilleri kapat" → mavi + bildirim; "Bu sayfada stilleri aç" → kırmızı.
- [x] Kendi kurallarım › Stiller: anahtarı kapatmak açık sayfaya hemen yansıdı (mavi); "Düzenle" ad, kapsam ve CSS ile açılıyor.
- [x] Gerçek, oturum gerektirmeyen sayfa (example.com) "bigtext": koyu arka plan ve büyük yazı hemen uygulandı.
- [x] Çerezler (sayfa menüsü › Diğer › Çerezler ve asistan kartı "Çerezleri göster"): qt_session (HttpOnly, oturum), qt_pref, qt_script; değer dokununca görünüyor, Kopyala; tek çerez silindi (oturum uyarısıyla), liste yenilendi. Sayfa JS'i qt_session'ı göremiyor.
- [x] "cookies": asistanın cevabında ad, yol, süre, boyut, HttpOnly/Secure/SameSite, birinci taraf; değer yok. Gösterilen qt_session değeri uygulamanın hiçbir dosyasında (veritabanı, sohbetler, "Yapay zekâya gönderilenler") bulunmadı. Eylem geçmişinde stil uygulamaları var, çerez listesi yok (tasarım gereği).
- Bulunan ve düzeltilen (cihazda yeniden denenmedi): "Sakla" penceresindeki ad alanı klavyeyi açıp başlığı ve açıklamayı gizliyordu: alan kaldırıldı (ad, açıklamadır; Kendi kurallarım'da değiştirilir). Düzenleyicinin ipucunda "!important" satır sonunda bölünüyordu.
- Not: simülatör aracı yerel anahtarlara (Switch) dokunmayı iletmiyor, sürükleme gerekiyor; uygulama hatası değil.

Denenmedi: Android (yerel derleme yapılmadı; `RNCWebViewCookies.java` hiç derlenmedi), gizli sekme, "Yalnızca okuma"/"Engellendi" kipleri cihazda (testlerde var), "evilcss" cihazda (testlerde var), dosya dışa/içe aktarma ve yedekten geri yükleme cihazda, VoiceOver, büyük yazı, koyu tema, yatay ekran.

- [ ] `/style` sayfasında "restyle": onay penceresinde açıklama, site, CSS Ayrıntılar altında; Uygula → bağlantılar hemen kırmızı; sohbette kart: "Bu site için sakla…" ve "Geri al".
- [ ] "Geri al" → bağlantılar mavi; kart "Stil kaldırıldı".
- [ ] Yeniden "restyle" → Sakla (ad + kapsam) → sayfayı yenileyin: "At first paint" satırı kırmızı (sayfa yanıp sönmez); pushState/replaceState/hash düğmelerinde kırmızı kalır.
- [ ] Sayfa menüsü › "Bu sayfada stilleri kapat" → mavi; "Bu sayfada stilleri aç" → kırmızı.
- [ ] Ayarlar › Gizlilik ve güvenlik › Filtre listeleri › Kendi kurallarım › Stiller: anahtar, Düzenle (CSS'e `@import "x"` yazın: kaydedilmez, cümle + Ayrıntılar), "Nerede uygulanacağını değiştir", sil. Reklam engelleme kapalıyken de çalışır.
- [ ] "evilcss": hiçbir şey sorulmadan reddedilir; sayfa değişmez.
- [ ] "bigtext" gerçek, oturum gerektirmeyen bir sayfada (örneğin bir Wikipedia maddesi): yazı büyür, arka plan koyu; Sakla, yenile, kapat, geri al.
- [ ] Gizli sekmede "restyle": onayda gizli sekme notu; kartta "Sakla" yok. Kalıcı stiller gizli sekmede de uygulanır (gizleme kuralları gibi).
- [ ] Siteyi "Yalnızca okuma" yapın: "restyle" reddedilir, "cookies" çalışır, "cookiedel" reddedilir. "Engellendi": hepsi reddedilir.
- [ ] `/cookies` sayfasında "cookies": cevapta qt_session (HttpOnly), qt_pref, qt_script; değer yok; "Yapay zekâya gönderilenler" kaydında da değer yok. Kart › "Çerezleri göster".
- [ ] Çerezler ekranı (kart, sayfa menüsü › Daha fazla › Çerezler, site izin sayfası › "Bu sitenin çerezleri"): alan adına göre gruplu; "Değeri göster" → değer, "Kopyala"; sayfadaki "Page JavaScript sees" satırında qt_session yok.
- [ ] Tek çerezi silin (oturum kapanabilir uyarısı) → liste yenilenir; "Tümünü sil" → liste boş; sayfayı yenileyince sunucu yeniden kurar.
- [ ] "cookiedel": onay penceresinde ad ve alan adı, değer yok; Vazgeç → silinmez; Sil → silinir.
- [ ] Gizli sekmede çerez ekranı yalnızca o sekmenin çerezlerini gösterir (normal sekmedeki qt_session görünmez).
- [ ] Kurallar dosyasını dışa aktarın (stiller `! [style]` blokları), stili silin, içe aktarın: stiller listelenir, "Kapalı olarak içe aktar" / "Açık olarak içe aktar".
- [ ] Yedekle, stili silin, geri yükleyin: stil geri gelir.
- [ ] Android ve iOS, büyük yazı, koyu/açık tema, yatay ekran, TalkBack/VoiceOver: kart düğmeleri, çerez eylemleri ve stil düzenleyicisi okunur; sözcükler bölünmez.

## 17. Sayfada betik çalıştırma ve kalıcı betikler (19 Kasım)

Yeni yerel derleme gerekmez (yalnızca JavaScript değişti); Release denemesi için uygulama yeniden derlenir. Tasarım:
`docs/page-customisation.md` › Scripts. Test sayfaları: `node scripts/page-tests/scripts.mjs` (iOS simülatöründe
`http://localhost:8813`). Sahte yapay zekâ: `node scripts/fake-ai/server.mjs`, Özel sunucu `http://localhost:8793/v1`,
model `fake`; sözcükler: countlinks, marklinks, editlinks, evilscript, injected, traptable, loginscript, checkoutscript.

iOS simülatöründe denendi (iPhone 18 Pro, iOS 27, Release derleme, 19 Kasım; sahte yapay zekâ, İngilizce arayüz):
- [x] Ayar kapalıyken "countlinks": hiçbir şey sorulmadan reddedildi; cevap Ayarlar › Asistan'ı gösteriyor. Adım satırı "Scripts are off in Settings".
- [x] Ayarı açarken açıklamalı onay penceresi; açıldı.
- [x] "countlinks": onay penceresinde açıklama, site, "sealed copy" satırı, Ayrıntılar'da tam kod; Çalıştır → kopyada 22, "page-data" işaretleri arasında; sayfa değişmedi.
- [x] "marklinks": kırmızı "live page" ve "Changes the page" satırları; Çalıştır → bağlantılar kırmızı çerçeveli; kart "Keep for this site…"; kapsam seçeneklerinde "everywhere" yok; Sakla → "Script kept in My rules".
- [x] Sayfa yeni sekmede yeniden açılınca saklanan betik kendiliğinden çalıştı (22 işaretli bağlantı).
- [x] Sayfa menüsü › "Scripts off for this page": sayfa yenilendi, betik çalışmadı (0).
- [x] `/login` sayfasında "loginscript": hiçbir şey sorulmadan reddedildi (şifre alanı); saklanan betik o sayfada çalışmadı, Kendi kurallarım'da "Skipped …: sensitive page".
- [x] Kendi kurallarım › Scripts: ad, nerede, ne zaman, kırmızı "Changes the page", son çalışma, anahtar. Kodu değiştirip Kaydet → "Let this script run on localhost:8813?" onayı (Ayrıntılar'da kod); Onayla → kaydedildi, son çalışma sıfırlandı.
- Bulunan: `CODE_SIGNING_ALLOWED=NO` ile derlenen simülatör uygulamasında anahtar zinciri yok (ayarlar kaydedilemiyor, betik mührü yapılamaz); ad hoc imzayla (`CODE_SIGN_IDENTITY=-`) derlenince çalıştı. Uygulama hatası değil.

Android: `./gradlew :app:assembleRelease --max-workers=2` derlendi (Hermes paketiyle), cihazda denenmedi.

Denenmedi (cihazda): gizli sekme, "Yalnızca okuma"/"Engellendi" kipleri, kurallar dosyası dışa/içe aktarma, yedekten geri yükleme, "evilscript"/"injected"/"traptable" (testlerde var), Android'de akış (yalnızca derlendi), VoiceOver, büyük yazı, koyu tema, yatay ekran, Türkçe arayüz.

- [ ] Ayar kapalıyken (varsayılan) `/links` sayfasında "countlinks": hiçbir şey sorulmadan reddedilir; cevap, betiklerin Ayarlar › Asistan'dan açılabileceğini söyler.
- [ ] Ayarlar › Asistan › "Asistan sayfalarda betik çalıştırabilsin": açarken açıklamalı onay penceresi; Vazgeç → kapalı kalır.
- [ ] Açıkken "countlinks": onay penceresinde açıklama, site, "mühürlü kopya" satırı, kırmızı satır yok, kod Ayrıntılar altında; Çalıştır → cevapta 22 (kopyada); sayfa değişmez; sohbette "Sakla" kartı yok.
- [ ] "marklinks": pencerede kırmızı "canlı sayfa" ve "Sayfayı değiştirir" satırları; Çalıştır → bağlantıların çevresi kırmızı; kartta "Bu site için sakla…". Sakla (nerede: bu site; ne zaman: sayfa hazır olduğunda).
- [ ] Sayfayı yenileyin: betik kendiliğinden çalışır (bağlantılar kırmızı çerçeveli, sayaç 22); pushState düğmesinde ikinci kez çalışmaz.
- [ ] Kendi kurallarım › Betikler: ad, nerede, ne zaman, "Sayfayı değiştirir" (kırmızı), son çalışma. "Kodu gör ve düzenle": `red` → `blue`, Kaydet → onay penceresi (kod Ayrıntılar'da); Reddet → "Kaydedilmedi"; Onayla → yenileyince mavi.
- [ ] Düzenleyicide `document.cookie` yazıp Kaydet: kaydedilmez, cümle + Ayrıntılar'da sebep.
- [ ] Sayfa menüsü › "Bu sayfada betikleri kapat": sayfa yenilenir, çerçeve yok; "Bu sayfada betikleri aç" → yeniden.
- [ ] `/login` sayfasında "loginscript": hiçbir şey sorulmadan reddedilir (şifre alanı). `/checkout`: "checkoutscript" reddedilir (ödeme sayfası). Ayarlar › Asistan › "Kendi ayarı olan siteler"e `localhost:8813` "Hassas sayfalarda da izinli" eklenince "loginscript" sorulur.
- [ ] "evilscript" ve `/inject` sayfasında "injected": hiçbir şey sorulmadan reddedilir.
- [ ] `/trap` sayfasında "traptable": tablo, "sayfa verisi" işaretleri arasında gelir; asistan içindeki talimata uymaz.
- [ ] Gizli sekmede "marklinks": onayda gizli sekme notu; kartta "Sakla" yok; kalıcı betikler gizli sekmede çalışmaz.
- [ ] Siteyi "Yalnızca okuma" veya "Engellendi" yapın: "countlinks" reddedilir ve kalıcı betik çalışmaz.
- [ ] Kurallar dosyasını dışa aktarın, betiği silin, içe aktarın: betik listelenir (ne yaptığıyla), kapalı gelir; anahtarı açınca onay penceresi.
- [ ] Ayarı kapatın: kalıcı betik bir sonraki yüklemede çalışmaz; Kendi kurallarım'da "Betikler kapalı" notu.
- [ ] VoiceOver/TalkBack, büyük yazı, koyu tema, yatay ekran: onay penceresi (kırmızı satırlar yazıyla da anlaşılır), kart, Betikler bölümü, düzenleyici.

## 18. Qutai içinde uygulamalar, 1. aşama (19 Kasım)

Tasarım ve sözleşme: `docs/mini-apps.md`. Yeni yerel derleme gerekmez (yalnızca JavaScript); Release denemesi için uygulama
yeniden derlenir. Sahte yapay zekâ: `node scripts/fake-ai/server.mjs 8794`, Özel sunucu `http://localhost:8794/v1`, model
`fake`; sözcükler: `notlar` / `uygulama` / `notes`, `breakapp`, `undoapp`, `breakout`; "Qutai bunu düzeltsin"in gönderdiği mesaj
da çalışır. Dışarı sızan istek olup olmadığı: `curl http://127.0.0.1:8794/leaks` (`[]` olmalı).

iOS simülatöründe denendi (iPhone 18 Pro, Release, ad hoc imza, 19 Kasım; sahte yapay zekâ, İngilizce arayüz):
- [x] Yeni sekmede "Uygulamalarım" bölümü ve davet kartı (henüz uygulama yokken).
- [x] "bana bir uygulama oluştur, burada notlarımı tutabileyim": rehber → oluşturma → önizleme; "Notlarım" Türkçe açıldı, temaya uygun.
- [x] Not ekleme (Qutai'ın "Not kaydedildi" bildirimi), arama ("PEYNIR" → "peynir" bulundu; eşleşmeyen aramada boş durum metni), düzenleme, silme (Qutai'ın onay penceresi, "Uygulamadan: Notlarım" satırıyla).
- [x] Qutai kapatılıp açılınca not duruyordu; yeni sekmede "Notlarım" kutucuğundan açıldı.
- [x] "breakapp": hata ekranı "“Notlarım” bir sorunla karşılaştı"; Ayrıntılar'da `app.js:129` ve hata metni (satır doğru).
- [x] "Qutai bunu düzeltsin": asistan düzeltti (sürüm 3), önizleme 0 sorun; sohbet kartında Aç / Geri al.
- [x] Kartta Geri al → "sürüm 2'ye dönüldü"; uygulama menüsü › Sürümler'de 3 sürüm, "Bu sürümü kullan" ile sürüm 3'e dönüldü.
- [x] "breakout": 41/41 deneme engellendi (ağ, WebSocket, WebRTC, işçi, resim, eval, çerçeveler, üst pencere, çerez ve web depolama, köprü, kota, form, bağlantı, yönlendirme, meta refresh); sunucunun `/leaks` listesi boş.
- [x] Uygulama menüsü › Uygulamayı sil: sürüm sayısı ve veri boyutuyla onay; silindi, Uygulamalarım'dan kalktı.
- [x] Koyu temada açılınca uygulama koyu.
- Bulunan ve düzeltilen: `about:blank` kökeninde WebKit uygulama hatalarını "Script error." olarak, satırsız veriyordu; her uygulamaya `.invalid` altında kendi kökeni verildi (yeniden denendi: satır ve mesaj geliyor). Tema, uygulama açılırken değişirse eski temada kalıyordu; "hazır" anında tema yeniden gönderiliyor (bu düzeltme cihazda yeniden denenmedi).

Android: `./gradlew :app:assembleRelease --max-workers=2` derlendi (Hermes paketiyle); emülatörde çalıştırılmadı.

Denenmedi (cihazda): Android'de çalıştırma, açıkken tema değişimi, VoiceOver/TalkBack, büyük yazı, yatay ekran, Türkçe arayüz, panoyu okuma izni penceresi (testlerde var), gizli sekmeden reddedilme (testlerde var), takılma ekranı ve çökme ekranı.

- [ ] Gizli sekmede "notlar": asistan uygulama yapamayacağını söyler; hiçbir uygulama oluşmaz.
- [ ] Büyük yazıda (Ayarlar › Erişilebilirlik › Daha Büyük Metin) "Notlarım": metin büyür, düğmeler sığar; yatay ekranda da.
- [ ] VoiceOver/TalkBack: başlık, "Yeni not" düğmesi, arama alanının etiketi, not listesi ve "Not kaydedildi" duyurusu okunur.
- [ ] Android geri tuşu: düzenleyicide geri tuşu düzenleyiciyi kapatır, ana listede uygulamayı kapatır.
- [ ] Uygulamalarım'da uzun basma: Aç / Yeniden adlandır / Sil; yeniden adlandırınca yeni sürüm oluşur, veriler kalır.
- [ ] Ana menü › Kitaplık › Uygulamalarım ekranı ve "Uygulama iste" düğmesi asistana taslak koyar (göndermez).
- [ ] Android'de "breakout": sonuçlar ve `/leaks` (emülatör yerel sunucuya açık metin isteklerini reddeder; `adb reverse` ile).

## 19. Qutai içinde uygulamalar, 2. aşama: dışa/içe aktarma, yedek, Android ağ engeli (19 Kasım)

Tasarım: `docs/mini-apps.md` › 8. **Yeni yerel derleme gerekir** (iOS'ta `.qutaiapp` dosya türü ve "Qutai'da aç",
Android'de "Birlikte aç" ve WebView yamasındaki uygulama kum havuzu). Deneme dosyaları:
`node --no-warnings --experimental-transform-types --import ./scripts/test-support/loader.mjs scripts/app-tests/export-fixtures.ts <klasör> <port>`
(verili notlar, break-out uygulaması, değiştirilmiş ve daha yeni sürümlü dosya); break-out sızıntıları sahte yapay zekâ
sunucusunun `/leaks` listesine düşer (`node scripts/fake-ai/server.mjs <port>`).

Her telefonda denenecekler:
- [ ] Uygulamalarım › uzun basma › Dosya olarak dışa aktar: veri varsa "Verisiz / Verilerimle" sorusu (varsayılan verisiz, verilerin kişisel olabileceği yazıyor); paylaşım sayfası açılır; Dosyalar'a kaydedilir. Uygulama menüsünden de aynı.
- [ ] Uygulamalarım › Uygulama içe aktar: dosya seçici; içe aktarma ekranı: simge, ad, "başka biri yazdı", boyut, izinler sade sözlerle, uyarı, dosya listesi (dokununca kod, yalnızca okunur), veri sayısı ve boyutu ("Verilerini de getir" kapalı).
- [ ] İçe aktarılan uygulama kapalı gelir; açınca onay ekranı aynı özeti gösterir; "Aç" sonrası çalışır.
- [ ] Dosyalar uygulamasında `.qutaiapp` dosyasına dokunmak / paylaş › Qutai: içe aktarma ekranı açılır (Qutai kapalıyken de).
- [ ] Qutai'ın kendi tarayıcısında indirilen `.qutaiapp`: İndirilenler › Aç → içe aktarma ekranı; gizli sekmede indirilen: "Gizli sekmeden uygulama içe aktarılamaz".
- [ ] Aynı uygulamayı yeniden içe aktarma: "İkisini de tut" (ad "… 2", ayrı veri) ve "… yerine koy" (eski sürüm Sürümler'de; veriler korunur; dosyanın verisi seçiliyse ikinci onay).
- [ ] Bozuk / değiştirilmiş / daha yeni / uygulama olmayan / yedek dosyası: tek cümlelik hata, Ayrıntılar'da teknik satır.
- [ ] Ayarlar › Yedekleme › dışa aktar: "Uygulamalarım" ve "Uygulamalarımın verileri" açık, boyut yazıyor; geri yüklemede özet "Uygulamalar: N, verileriyle"; uygulama silinip yedek geri yüklenince (aynı telefon) açık ve verileriyle geri gelir.
- [ ] Başka telefonda geri yükleme: uygulama kapalı gelir, verileri durur, onay ekranından açılır.
- [ ] Qutai hesabına yedek: aynı iki anahtar; sınırı aşan yedek uygulama verileri olmadan yapılır ve bunu söyler.
- [ ] Android: "breakout" içe aktarılıp açılır; sonuçlar ve `/leaks` boş (yoğun iş parçacığı yarışı dahil).
- [ ] Büyük yazı, VoiceOver/TalkBack, koyu tema, yatay ekran: içe aktarma ve onay ekranları okunur ve sığar.

19 Kasım sonuçları (Claude, simülatör ve emülatörde):
- iOS (iPhone 18 Pro simülatörü, Release): dışa aktarma (verilerle, Dosyalar'a kayıt), silip Dosyalar'dan geri açma,
  içe aktarma ekranı, kod görüntüleyici, onay ve "Aç", notların geri gelmesi; şifreli yedek (anahtarlar ve boyut,
  "Uygulamalar: 2, verileriyle"), uygulama silinip birleştirerek geri yükleme (açık ve mühürlü, 2 belgesiyle);
  değiştirilmiş dosya hatası; break-out 46/46 engellendi, `/leaks` boş. Hepsi tamam.
- Android (emülatör, API 36, Release): Dosyadan "Birlikte aç" ile içe aktarma ekranı, "İkisini de tut", onay ve "Aç";
  break-out **45/46**: yoğun iş parçacığı yarışı dahil gezinme ve ağ denemelerinin hepsi engellendi, `/leaks` boş.
  Kalan tek hata: `about:blank` çerçevesinin `window[0]` üzerinden yeni bir `RTCPeerConnection` alınabiliyor
  (docs/mini-apps.md › What can't be blocked). Bu denemede bulunup düzeltildi (903a3f6): uygulama açılırken yerel
  çökme ve uygulamanın kendi belgesinin 403 alması.
- Denenmedi: başka telefonda geri yükleme ve sınırı aşan sunucu yedeği (yalnızca birim testleri), Qutai'ın kendi
  İndirilenler'inden içe aktarma, "Yerine koy", Android'de dışa aktarma ve yedek, büyük yazı, ekran okuyucu, koyu tema,
  yatay ekran, gerçek telefon.

## 20. Güvenlik geçişi: şifreler ve kodlar, silme ve hesap onayı, ödeme düğmesi, gizli sekme, ayar aracı, uygulamalar (19 Kasım)

Hazırlık: `node --no-warnings --experimental-transform-types --import ./scripts/test-support/loader.mjs scripts/page-tests/serve.mjs`
(sayfa: `http://localhost:8811/guards`) ve sahte yapay zekâ `node scripts/fake-ai/server.mjs 8794` (Özel uç nokta
`http://localhost:8794/v1`, model `fake`; Android'de `adb reverse tcp:8794 tcp:8794` ve `tcp:8811`).

- [x] `/guards` sayfası: 34/34 (masaüstü Chromium ve iOS simülatöründe WebKit). Şifre, maskeli alan, doğrulama kodu,
      `one-time-code`, kart numarası, CVC, gölge DOM'daki özel öğe ve bölünmüş kod kutuları gizli sayılıyor; adet,
      posta kodu, promosyon kodu, telefon, yorum, e-posta sayılmıyor; read_page, form değerleri, betik kopyası değer
      göstermiyor; ödeme, silme ve hesap basışları doğru sınıflanıyor.
- [x] "typepass" (iOS simülatörü): şifre alanına yazma reddedildi, "Qutai şifre veya kod yazmaz" satırı, model
      kullanıcıdan alanı kendisinin doldurmasını istemesi gerektiğini öğreniyor.
- [x] "delete thing" (iOS simülatörü): "Delete" onaysız reddedildi ("Bu değişiklik önce onayınızı gerektirir"), Qutai'ın
      penceresi "localhost:8811 sitesinde bu silinsin mi?" başlığı, sayfa başlığı "Photos" ve öğe "beach.jpg" ile
      açıldı; Onayla'dan sonra tek basış yapıldı; İptal'de basılmadı ve model "hiçbir şey değişmedi" dedi.
- [x] "weaken" (iOS simülatörü): reklam engelleme ve çerez bandı gizleme kapatılamadı, gri "Bu ayarı yalnızca siz
      Ayarlar'da değiştirebilirsiniz" satırı.
- [ ] Gizli sekmede "Her işlemden önce sor" açıkken bir tıklama onayı: "Bu sitede her zaman izin ver" kutusu yok
      (birim testinde var; simülatörde anahtar dokunuşu araçla değişmedi, elle denenmeli).
- [ ] Bir uygulamada hata, "Qutai bunu düzeltsin": mesaj kutusu dolu geliyor, gönderilmiyor; console satırlarında
      değer yok (`<string 14>` gibi), hata satırı, dosya ve satır var (birim testinde var; cihazda denenmedi).
- [ ] Silme onayı Android'de, ödeme düğmesi bağlamla (ikon düğme, "Devam et" + toplam) bir cihazda.
- [x] Uygulamalarda çerçeve yolları: kırılma uygulamasının 25 yeni çerçeve denemesi masaüstü Chromium'da engellendi
      (`/app-breakout`; Chromium, Android gibi çerçevelere koruma betiği koymuyor). Android öykünücüsünde denenmedi
      (yerel yama değişmedi).
- [ ] iPhone'da sil ve yeniden kur: geri yüklenen betikler ve uygulamalar kapalı geliyor (mühür anahtarı silindi).
- [ ] Sunucu yedeği geri yükleme teklifi: her yeni oturum açışta bir kez; "Şimdi değil" sonrası bir sonraki oturum açışta
      yine; aynı oturumda tekrar yok; bu telefonun kendi son yedeği teklif edilmiyor (pro yapı, cihazda denenmedi).
- [ ] Kurulumda "Qutai neleri kullanabilir" adımında Kişiler satırı; atlanırsa ilk aramada eskisi gibi soruluyor;
      iOS'ta sınırlı erişimde "Kişileri seç" (cihazda denenmedi).

## 21. Sayfalara gizlenmiş talimatlar: ölçüm ve yeni korumalar (20 Kasım)

Ölçüm sonuçları: `docs/prompt-injection-tests.md`. Tuzak sayfaları telefonda denemek için Mac'te:
`node --no-warnings --experimental-transform-types --import ./scripts/injection-tests/loader.mjs scripts/injection-tests/serve.ts 8815`
(Android'de `adb reverse tcp:8815 tcp:8815`; iPhone'da Mac'in yerel adresi). Liste: `http://localhost:8815/`.

- [x] Ölçüm (bilgisayarda, uygulamanın gerçek asistan döngüsüyle, telefonsuz): 35 tuzak sayfası, Claude Haiku 5.5'te
      4'er, Claude Sonnet 5.5'te 3'er kez, düzeltmelerden önce ve sonra; her tuzağa uyan yazılı bir modelle de
      uygulamanın kendi katmanı ölçüldü. `npm run test:injection` geçiyor.
- [ ] Sıradan işler yeni bir soru çıkarmıyor: bir arama, adını verdiğiniz bir siteyi açma ("trendyol'da su ısıtıcısı
      bakar mısınız"), "ayakkabı numaram 42, bunu hatırlayın" (bellek sorusu çıkmamalı).
- [ ] `/page-title` sayfasında "Bu sayfayı özetler misiniz?": özet geliyor (eskiden Haiku "This content is not available
      in your region" diyordu).
- [ ] `/hidden-white` ve `/other-tab` sayfaları: özet veya karşılaştırma geliyor, asistan sayfadaki talimattan söz
      ediyor; bir adres açmaya kalkarsa Qutai'ın "… sitesini, adresinde şu bilgiyle aç:" penceresi çıkıyor (Türkçe metin,
      "Qutai'ın belleğindeki bilgileriniz" satırı, Reddet ile hiçbir şey açılmıyor).
- [ ] Bellek penceresi: Türkçe yazıp asistanın başka dilde kaydettiği bir bilgi (örneğin "vejetaryenim, bunu hatırlayın")
      "Qutai'ın belleğine kaydet: …" sorusunu çıkarabilir; çıkıyorsa metni ve sıklığı not edin (bilerek kabul edilen
      bir sürtünme, `UNTR-23`).
- [ ] Ayar penceresi: bir makale sayfasında "Bu sayfayı özetler misiniz?" dedikten sonra asistan bir ayarı değiştirmeye
      kalkarsa Qutai'ın "Qutai'ın ayarlarını değiştir:" penceresi çıkıyor; "koyu temaya geçer misiniz" gibi kendi
      isteğinizde pencere çıkmıyor (`UNTR-25`).
- [ ] `/aria-label` sayfası: "Subscribe – 149 TL/month" düğmesine asistan onaysız basamıyor; ödemeler kapalıyken
      "ödeme size bırakıldı" deniyor (`PAY-27`).

## 22. Kod incelemesi düzeltmeleri: onay denetimleri, sayfa betiği, adresler, depolama (20 Kasım, telefonda denenmedi)

Bilgisayarda testlerle denendi; telefon ve öykünücü kullanılamadı. En riskli kısım sayfa betiğinin yeni kurulumu
(`UNTR-26`): iki platformda da aşağıdakileri deneyin.

- [ ] iPhone ve Android: bir haber sitesinde "Bu sayfayı özetler misiniz?" çalışıyor; bir düğmeye bastırma, bir alana
      yazdırma (örneğin bir arama kutusu) çalışıyor; birkaç bağlantıdan geçtikten sonra (yeni sayfalar) asistan hâlâ
      okuyup basabiliyor; geri ve ileri gittikten sonra da.
- [ ] Android: bir sayfa açılır açılmaz (yüklenmesi bitmeden) asistana okuma yaptırın; "Qutai's page script could not be
      set up" hatası çıkmamalı. Çok iframe'li bir sayfada (reklamlı bir haber sitesi) sayfalar eskisinden yavaş açılmıyor.
- [ ] Okuma modunda sayfada bul (Bul çubuğu) çalışıyor.
- [ ] Android, "Arka planda çalışmaya devam et" açık: uygulama arka plandayken asistan bir sayfayı okuyup bir düğmeye
      basabiliyor (bildirimle devam).
- [ ] Ödeme, silme ve gönderme onayları eskisi gibi soruluyor: `/guards` test sayfası (scripts/page-tests/serve.mjs,
      `adb reverse tcp:8811 tcp:8811`) telefonda da hepsi geçiyor.
- [ ] Yavaş bir sayfada (ağ yavaşken) bir "Satın al" düğmesine bastırmaya çalışın: "Qutai bu adımı denetleyemedi"
      satırı çıkabilir, düğmeye basılmamalı (`PAY-28`).
- [ ] Asistan bir görevde yeni bir sekme açıp orada çalışırken o sekmeyi kapatın: sohbette "Qutai'ın çalıştığı sekme
      kapatıldı" satırı çıkıyor, asistan ekrandaki başka sekmede bir şeye basmıyor; sekme listesine bakıp devam ediyor
      (`TABS-27`).
- [ ] Bir gizli sekme açıkken normal bir sekmede "Açık sekmelerimi listeler misiniz?": gizli sekme yalnızca numarasıyla
      geçiyor, başlığı ve adresi sohbette, "Yapay zekâya gönderilenler" kaydında ve geçmişte yok (`INC-2`).
- [ ] "https://… adresindeki PDF'i indirir misiniz?" (adresi siz yazın): indirme penceresi adı gösteriyor, türü ve
      boyutu göstermiyor; "Bir daha sorma" açık olsa da soruluyor; Reddet'ten önce o adrese istek gitmiyor (`DL-5`).
- [ ] Bir sitenin "Qutai'ın yapabilecekleri"ni "Engellendi" yapın (örneğin example.com); asistana
      "https://example.com./ adresini açar mısınız" ve "https://kullanici@example.com/ adresini açar mısınız" deyin:
      ikisi de engelleniyor (`SITE-25`). Yerel bir sunucuda (örneğin 192.168.1.2:3000) sekme listesinde ve "açılıyor"
      satırında bağlantı noktası görünüyor.
- [ ] Bir önceki sürümden güncelleyin (sürüm atlamadan, verili bir telefonda): açık sekmeler, sohbetler, bellek, yer
      imleri, kayıtlı görevler ve site izinleri yerinde (`DATA-25`).
- [ ] Telefonun deposu doluyken bir sohbet yürütün: "Qutai bazı verilerini bu telefona kaydedemedi…" bildirimi bir kez
      çıkıyor, uygulama çalışmaya devam ediyor (`DATA-26`).
- [ ] Hesapla (pro sürüm): oturum açıkken uygulamayı birkaç saat sonra yeniden açın; oturum açık kalıyor (`ACC-53`).
- [ ] Rastgele değerler artık güvenli kaynaktan (`DATA-27`): bir harita sitesinde "konumumu kullan" (Qutai'ın konum
      sorusu çıkıyor), bir görüntülü görüşme test sayfasında kamera (Qutai'ın kamera sorusu), bir videoyu arka planda
      çalma ve kilit ekranı denetimleri (Android: bildirimdeki oynatıcı) eskisi gibi çalışıyor; "Bu sayfayı özetler
      misiniz?" ve bir sayfada betik çalıştırma da.

## 23. Görevin yaşam döngüsü: tek görev yeri, Durdur, kayıt noktaları, uzun sohbet, taslaklar, ayarlar (20 Kasım, telefonda denenmedi)

Görevin başlangıcından bitişine kadar olan kısım App.tsx'ten `src/task/` altına taşındı ve Node'da sınandı
(`npm run test:tasks`); aşağıdakiler yalnızca telefonda görülebilir.

- [ ] Bir görev başlatın ve hemen ardından Qutai düğmesine basılı tutup sesle ikinci bir istek söyleyin: ikinci görev
      başlamıyor, "Qutai başka bir sekmede çalışıyor" bildirimi çıkıyor ve söylediğiniz metin o sohbetin yazı alanında
      duruyor; ilk görev kesintisiz sürüyor (`TABS-11`).
- [ ] Bir görev çalışırken Durdur'a basın, hemen ardından başka bir sekmede sesle yeni bir istek söyleyin: yeni görev
      başlıyor; durdurulan görevin bitişi yeni görevin şeridini, sayfadaki işaretini ve (Android) arka plan bildirimini
      kapatmıyor (`TASK-17`).
- [ ] Bir görev çalışırken görevin sekmesini kapatın, sonra başka bir sekmede yeni bir görev başlatın: yeni görev
      başlıyor ve sonuna kadar çalışıyor; kapatılan sekmeyi "Son kapatılanlar"dan geri açınca sohbeti "Durduruldu"
      satırıyla duruyor (`TABS-11`, `TASK-17`).
- [ ] Yavaş açılan bir sayfada (ağ yavaşken, ya da `scripts/slow-server`) asistan sayfayı açarken Durdur'a basın:
      "Durduruldu" yaklaşık bir saniye içinde çıkıyor (önceden 15 saniyeye kadar sürebiliyordu); ardından aynı sohbette
      yeni bir mesaj hatasız yanıtlanıyor (`TASK-18`).
- [ ] Asistan "10 saniye bekle" derken ya da bir düğmeye bastıktan sonra sayfanın yüklenmesini beklerken Durdur'a basın:
      aynı şekilde hemen duruyor (`TASK-18`).
- [ ] Bir görevin ortasında (birkaç adım sonra) uygulamayı uygulama değiştiriciden kapatın (öldürün) ve yeniden açın:
      sohbette mesajınız ve yapılan adımlar duruyor, sonunda "Qutai bu görev sürerken kapandı. Yukarıdaki adımlar
      yapıldı, sonrasında hiçbir şey çalışmadı." satırı var; çalışıyormuş gibi görünen hiçbir şey yok (yarım yazılmış
      yanıt, şerit, parıltı); aynı sohbette "devam et" deyince görev hatasız sürüyor (`TABS-28`).
- [ ] Aynısını Qutai Kredileri ile yapın: öldürmeden önce harcanan krediler bakiyede ve hesap dökümünde düşülmüş
      görünüyor (iade yok); yarım kalan görevin altında maliyet satırı yok (`TABS-28`).
- [ ] Uzun bir sohbet: aynı sohbette 30-40 kez birkaç sayfa okutun (ya da yedekten uzun bir sohbet geri yükleyin);
      yanıtlar gelmeye devam ediyor, "Yapay zekâya gönderilenler" kaydında istek boyutu bir noktadan sonra büyümüyor,
      ilk mesajda "[Earlier messages of this conversation were left out…]" notu görünüyor; ekranda sohbetin tamamı
      duruyor; uygulama zamanla yavaşlamıyor ve bellekten kapanmıyor (`PERF-11`).
- [ ] Uzun bir görevde (birkaç ekran görüntüsü alan) Anthropic anahtarıyla: maliyet ayrıntısında adımlar arasında
      önbellekten okuma sürüyor (önbellek bozulmadı) (`PERF-11`).
- [ ] Android, "Arka planda çalışmaya devam et" açık: bir görev başlatın, Qutai'dan çıkın, görev bildirimle sürüyor;
      bildirimdeki Durdur görevi hemen durduruyor; geri dönünce sohbette adımlar ve "Durduruldu" var. Görev arka plandayken
      telefonu kilitleyip birkaç dakika bekleyin ve sonra uygulamayı öldürüp açın: o ana kadarki adımlar kaydedilmiş
      (`TASK-17`, `TABS-28`).
- [ ] İki sekmede hızla taslak yazın: birinci sekmede bir şey yazıp hemen (bir saniye içinde) ikinci sekmeye geçip orada
      yazın, ardından uygulamayı öldürüp açın: iki sekmenin taslağı da duruyor (`TABS-29`).
- [ ] Taslak yazarken hemen Ana ekrana çıkın ve uygulamayı öldürün: taslak duruyor (`TABS-29`).
- [ ] Ayarlar › Gizlilik'te "Uygulama kilidi"ni açın; Face ID / parmak izi sorulurken (sormadan önce) asistanın bir
      görevde reklam engellemeyi kapatmasını sağlayın (ya da iki ayarı hızlıca art arda değiştirin): onaydan sonra iki
      değişiklik de kalıcı, uygulamayı yeniden açınca da (`DATA-28`).

## 24. Sunucu kod incelemesi düzeltmeleri: panel izin listesi, kredi tutma, ayarlar, e-posta sınırları, dağıtım kaydı (20 Kasım, sonraki dağıtımdan sonra)

Sunucu (backend `d8e0590`…`d583011`) ve paket betiği (`319a6d4`). Yerelde testlerle denendi; production'da denenmedi.
Dağıtımda yeni bir migration var (0013, yalnızca yeni bir tablo ekler). Dağıtmadan önce `backend/scripts/deploy-prod.mjs`
içindeki `CONFIG.adminAllowlist` listesinde kendi adresiniz olduğuna bakın (`yuxel@sonsuzdongu.com` yazılı); liste boşsa
betik dağıtmaz, adresiniz yoksa panel sizi de içeri almaz.

- [ ] `npm run deploy:prod` önce "Ön denetim" yapıyor (commit edilmemiş değişiklik, typecheck, testler) ve sonunda
      "Dağıtım kaydı" yazıyor; panelin Overview ekranında "Deployed" bölümünde sunucu ve uygulama commit kimlikleri ile
      ajan profili görünüyor (`SRV-26`).
- [ ] Panel açılıyor (adresiniz izin listesinde). Mümkünse Access'e girebilen ama listede olmayan başka bir adresle
      deneyin: panel 401 veriyor (`CRED-32`).
- [ ] Overview'da "Sign-in mails" kutusu bu saatin ve son 24 saatin postalarını sınırlarla birlikte gösteriyor;
      Settings › "Sign-in mail caps" formu açılıyor (`ACC-19`).
- [ ] Settings › "Request limits"te yeni "Tokens reserved per web search" alanı 8 000 gösteriyor (kayıtlı ayarda yoksa
      varsayılan); bir değişiklik kaydetmek "What will change" ile çalışıyor (`SRV-25`, `CRED-14`).
- [ ] Telefonda Qutai Kredileri ile bir görev başlatın ve ilk yanıt gelmeden uygulamayı öldürün; hemen yeniden açıp yeni
      bir görev başlatın: "başka bir görev sürüyor" hatası çıkmamalı, bakiye düşmemiş olmalı (`CRED-45`).
- [ ] Yanıt akarken uygulamadan çıkın, dönünce aynı adım yeniden gönderilir: o adım ikinci kez ücretlendirilmemeli;
      tamamlanmış bir yanıtın aynısını tekrar göndermek ise ücretlendirilir (`CRED-17`).
- [ ] Derin araştırmada bir adımın tuttuğu kredi artık daha yüksek (Haiku ile yaklaşık 71 kredi); bakiyesi bunun altında
      olan hesap derin araştırma adımında "yetersiz kredi" alır. Bu tutarı Settings › Request limits › "Tokens reserved
      per web search" ile ayarlayabilirsiniz (`CRED-14`).
- [ ] Sonraki mağaza paketi (`npm run build:aab -- --pro-mode`): paket betiği sonunda paketi denetliyor; test girişi
      sırrı ya da test girişi değişkeni pakette olursa "not fit to ship" diyerek durur (`BUILD-9`).

## 25. Yerel Android düzeltmeleri (20 Kasım, 0.1.4)

Kod okunarak bulundu, derlemede denetlendi; telefonda görülmedi.

- [ ] Asistan bildirimi: bir görev başlatıp uygulamadan çıkın. Durum çubuğundaki küçük simge beyaz bir leke değil, üç yıldızlı asistan simgesi olmalı; bildirim açılınca başlık ve adım görünmeli. Görev bitince ve asistan soru sorunca gelen bildirimlerde de aynı simge olmalı. Mümkünse Android 8 ya da 8.1 bir cihazda da deneyin (eski simge orada çökme nedeni olabiliyordu).
- [ ] Pencere içinde pencere: çok uzun (dikey, 9:21'den dar) bir videoyu oynatırken ana ekrana dönün; video küçük pencerede sürmeli. Normal yatay ve dikey videolarda davranış değişmemeli.

## 26. Kısayollar Qutai'ın dilinde, parola alanlarında göz simgesi (20 Kasım, telefonda denenmedi)

Kısayollar için yeni bir yerel derleme (APK) gerekir; parola alanları yalnız JavaScript'tir.

Uygulama simgesinin kısayolları (Android, `LANG-19`):

- [ ] Telefon İngilizce, Qutai Türkçe (Ayarlar › Dil › Türkçe). Qutai'ı bir kez açıp kapatın, simgeye uzun basın: dört
      kısayol Türkçe ve bu sırayla olmalı: "Yeni sekme", "Gizli sekme", "Qutai'a sor", "QR tara". İngilizce bir kopya
      ya da beşinci bir kısayol olmamalı. Her birine dokunun: yeni sekme, gizli sekme, asistan, QR tarayıcı açılmalı.
- [ ] Uygulama kilidi açıkken bir kısayola dokunun: önce kilit ekranı gelmeli. Gizli sekme kilidi açıkken "Gizli
      sekme": gizli sekme kilidi sorulmalı.
- [ ] Qutai'ın dilini Qutai'ın ayarlarından İngilizce yapın, Qutai'ı açmadan (ana ekrana dönüp) simgeye uzun basın:
      kısayollar İngilizce olmalı. Android 13 ve üstünde birkaç saniye sürebilir. Sonra "Sistem varsayılanı" seçin:
      telefonun dilinde olmalı.
- [ ] Qutai Türkçe iken telefonun dilini değiştirin (örneğin Almanca), Qutai'ı açmadan simgeye uzun basın: kısayollar
      Türkçe kalmalı. Qutai "Sistem varsayılanı" iken telefonun dilini değiştirin: kısayollar yeni dile geçmeli.
- [ ] Güncelleme: telefonda 0.1.4 (104) kuruluyken bir kısayolu (örneğin "Yeni sekme") ana ekrana sabitleyin, sonra yeni
      APK'yı üzerine kurun ve Qutai'ı açmadan simgeye uzun basın: dört kısayol Qutai'ın dilinde görünmeli, kopya
      olmamalı. Ana ekrandaki sabitlenmiş eski kısayol gri ve kullanılamaz olur (Android bunu kendisi yapar, uygulama
      geri açamaz): silip menüden yeniden sabitleyin; yeni sabitlenen, dil değişince adını değiştirmeli.
- [ ] Yeni kurulum (kaldırıp kurun): Qutai'ı açmadan önce simgenin menüsünde kısayol olmaz (bilinen ve kabul edilen
      durum); bir kez açtıktan sonra dördü görünmeli.
- [ ] Elinizde Android 12 ya da daha eski bir telefon varsa: Qutai'ın dilini Qutai'ın ayarlarından Türkçe yapın (telefon
      İngilizce), simgeye uzun basın: kısayollar Türkçe olmalı.
- [ ] iPhone: değişiklik yok. Simgeye uzun basınca hızlı eylemler Qutai'ın dilinde olmalı (iOS bunu kendisi yapar).

Parola alanlarındaki göz (`UI-33`): dosya yedeğini dışa aktarma, sunucu yedeği parolası (parola koyma ve
değiştirme), yedek dosyasını açma ve girişten sonra sunucu yedeğini geri yükleme ekranları.

- [ ] Her parola alanının sağ ucunda bir göz simgesi var; altındaki "Parolayı göster" bağlantısı artık yok. Göze dokunun:
      yazı görünmeli, simge çizgili göze dönmeli; yine dokunun: noktalar geri gelmeli. Parola ve tekrarı alanlarının her
      birinin kendi gözü var, biri diğerini etkilememeli.
- [ ] Klavye açıkken, bir şey yazıp göze dokunun: klavye kapanmamalı, imleç yerinde kalmalı (sona ya da başa
      atlamamalı), yazmaya devam edince harf imlecin olduğu yere eklenmeli. Ortaya bir imleç koyup deneyin.
- [ ] iPhone: parolayı gösterip bir harf yazın, sonra gizleyip hemen bir harf daha yazın: yazılanın tamamı kalmalı (iOS
      normalde gizlenen alanı ilk tuşta siler; Qutai bunu düzeltiyor). Gizledikten sonra bir kez silme tuşu: yalnız bir
      harf silinmeli.
- [ ] Android: göster/gizle arasında yazı tipi değişmemeli (eşit aralıklı yazıya dönmemeli); görünürken klavyede
      kelime önerisi çıkmamalı.
- [ ] Uzun bir parola (40 karakter ve üstü): alan taşmamalı, yazı gözün altına girmemeli, göz hep görünmeli. Büyük yazı
      boyutunda da (telefonun yazı boyutu en büyükte) deneyin.
- [ ] Yanlış parolayla yedek açın: alanın kenarı kırmızı olmalı, hata alanın hemen altında görünmeli ve okunmalı.
- [ ] TalkBack / VoiceOver: göz "Parolayı göster" diye okunmalı, dokununca "Parola görünüyor", tekrar dokununca "Parola
      gizli" denmeli ve düğmenin adı "Parolayı gizle" olmalı. Gizliyken alanın içindeki yazı okunmamalı.
- [ ] Telefonun parola yöneticisi: yedek parolası koyarken yeni parola önerisi ya da kaydetme teklifi çıkabilir,
      yedeği açarken kayıtlı parolayı doldurmayı önerebilir (önceden bu alanlarda kapalıydı).

### Kurulumda sunucu yedeğini geri yükleme teklifi (20 Kasım, `BACK-21`, pro mod)

Sunucuda yedeği olan bir hesapla:

- [ ] Yeni kurulum (kaldırıp kurun), kurulumda "Qutai ile devam et" ile giriş yapın: hesap ekranında hemen "Yedeğiniz
      var, geri yüklensin mi?" sorusu çıkmalı (profil sorularından önce).
- [ ] "Geri yükle": parola bu telefonda kayıtlı değilse parola ekranı açılır (gözlü alan). Klavye açılmalı, parola yanlışsa
      hata alanın altında görünmeli; "Vazgeç" ve geri tuşu kuruluma dönmeli. Doğru parolayla özet ve "birleştir"
      seçili gelmeli; geri yükleyince uygulama yeniden başlamalı ve kurulum yerine tarayıcı açılmalı: yer imleri, geçmiş,
      anılar ve ayarlar gelmiş, asistan tanıtımı çıkmamış, Qutai Credits seçili olmalı. Uygulama kilidi ve izinler
      telefonun kendi hâlinde kalmalı (yedekten gelmez).
- [ ] "Şimdi değil": kurulum devam etmeli; kurulum bitince tarayıcıda teklif yeniden çıkmamalı.
- [ ] Teklif görünmeden kurulumdan çıkın (giriş yapıp hemen uygulamayı kapatın): yeniden açınca kurulum bitince
      tarayıcıda teklif bir kez çıkmalı.
- [ ] Çıkış yapıp yeniden giriş yapın (Ayarlar › Hesap): asistan tanıtımı ekrandayken bile, tanıtım kapanınca teklif
      bir kez çıkmalı (önceden hiç çıkmıyordu).
- [ ] Yedeği olmayan hesap: soru çıkmamalı; o oturumda ilk yedek alınınca da bu telefonun kendi yedeği olduğu için
      sorulmamalı.

## 27. Kurulumda geri yükleme takılıyordu (20 Kasım, 0.1.5'te bildirildi)

Sahibi telefonda gördü: kurulumda yedeği geri yüklerken ekran "Restoring…" yazısında kalıyordu (birleştir ve değiştir, ikisinde de). Neden: geri yükleme veritabanını uygulama yeniden başlayana kadar tutuyor; kurulumun "tanıtım görüldü" kaydı ise veritabanını yeniden isteyip sonsuza dek bekliyordu. Kayıt artık geri yüklemenin kendi veritabanı bağlantısıyla yazılıyor. Yalnızca tip denetimi ve testlerle doğrulandı.

- [ ] Uygulama verisini silin, kurulumda Qutai hesabına girin, yedeği geri yükleyin (önce "birleştir", sonra aynı denemeyi "değiştir" ile): "geri yüklendi" penceresi gelmeli, Tamam'dan sonra uygulama tarayıcıda yeniden açılmalı, sekmeler ve hatıralar yerinde olmalı, asistan tanıtımı yeniden çıkmamalı.
- [ ] Android (yeni yerel kodla derlenen APK): sayfa betiği belge başında kuruluyor (`UNTR-26`, `documentStartScript`).
      Bir haber sitesini açar açmaz "Bu sayfayı özetler misiniz?" deyin, sonra birkaç bağlantıdan geçin: her sayfada
      okuma, basma ve yazma çalışıyor. Qutai içindeki bir uygulamayı da açın: ağ engeli eskisi gibi çalışıyor.

## 28. Tarayıcı: kaydırınca gizlenen adres çubuğu, belirgin alan adı, çöken sayfa, Android'de form uyarısı (20 Kasım, telefonda denenmedi)

Cihaz yoktu; mantık birim testlerinde (`npm run test:navigation`). Android'deki form uyarısı yeni yerel kod ister: yeni
derlenen APK ile deneyin. Yavaş sayfa ve form için yerel sunucu: `node scripts/slow-server/server.mjs` (Android'de
`adb reverse tcp:8823 tcp:8823`; sayfa `http://localhost:8823/`, form `/form`).

- [ ] **Kaydırınca gizlenen çubuk (`UI-36`), Android ve iOS, çubuk üstte ve altta ayrı ayrı:** uzun bir haber
      sayfasında aşağı kaydırın: çubuk kayarak gizlenmeli, sayfa zıplamamalı, metin yerinden oynamamalı; birazcık
      yukarı kaydırınca hemen geri gelmeli; sayfanın en üstünde hep görünmeli; en üstte aşağı çekip yenileme
      çalışmalı.
  - [ ] Kendi sabit başlığı olan bir sitede (örneğin sabit menülü bir haber sitesi) çubuk görünürken sitenin başlığı
        çubuğun altında kalmamalı; çubuk alttayken sitenin sabit alt şeridi de çubuğun altında kalmamalı.
  - [ ] Kısa bir sayfada (`http://localhost:8823/form`) ve bir harita sayfasında (Google Haritalar) çubuk hiç
        gizlenmemeli.
  - [ ] Çubuk gizliyken: bir bağlantıya dokunun (yükleme başlayınca çubuk gelmeli), bir alana dokunup klavyeyi açın,
        sayfada bul'u açın, Qutai panelini açın, bir metin seçin, asistana bir iş verin: her birinde çubuk görünmeli.
  - [ ] Yatay ekranda ve çentikli telefonda: durum çubuğu ve alt güvenli alan bozulmamalı, çubuk durum çubuğunun
        üstüne taşmamalı.
  - [ ] Ayarlar › "Adres çubuğunu hep göster" açıkken çubuk hiç gizlenmemeli. "Hareketi azalt" açıkken çubuk kaymadan
        bir anda gizlenip görünmeli.
- [ ] **Adres çubuğunda alan adı (`UI-34`, `UI-35`):** `https://mail.google.com/mail/u/0/` gibi bir adreste
      "google.com" koyu, "mail." ve yol soluk görünmeli; https için "https://" yazmamalı, http sayfada kırmızı kilit
      işareti kalmalı. Çok uzun bir alt alan adı (örneğin `https://a.very.long.subdomain.chain.example.co.uk/x`) soldan
      kısalmalı, "example.co.uk" görünmeli. `http://192.168.1.1:8080/` ve `http://localhost:8823/` düzgün görünmeli.
  - [ ] `https://bücher.de` Unicode olarak ("bücher.de"), Kiril harfli sahte "аррӏе.com"
        (`https://xn--80ak6aa92e.com`) punycode olarak görünmeli.
  - [ ] Adres çubuğuna dokunun ve hemen yazın: eski adres tamamen silinip yerine yazılmalı (iOS'ta önce adresin sonuna
        ekleniyordu). Android ve iOS'ta, yeni sekmede ve dolu bir sayfada deneyin.
- [ ] **Çöken sayfa (`TABS-30`):** Android'de `chrome://crash` adresini açın (iOS'ta bir sayfayı bellek
      doldurarak çökertmek gerekir; çok sayıda ağır sekme açmak işe yarayabilir): ilk seferde sayfa kendiliğinden bir kez
      yeniden yüklenmeli; bir dakika içinde yine çökerse "Bu sayfa çalışmayı durdurdu", Yeniden yükle ve Sekmeyi kapat
      görünmeli, kendiliğinden yeniden yüklenmemeli. Arka plandaki bir sekme çökerse o sekmeye dönünce yüklenmeli.
      Asistan o sekmede çalışırken sayfa çökerse asistan beklemeden "sayfa çalışmayı durdurdu" hatası almalı.
- [ ] **Android'de form uyarısı (`TABS-25`, yeni yerel kodla):** `http://localhost:8823/form` sayfasında Send'e basın,
      sonuç sayfasında yeniden yükleyin: "Form yeniden gönderilsin mi?" sorulmalı. Vazgeç: sayfa olduğu gibi kalmalı,
      çizgi kaybolmalı; "Yeniden gönder": sonuç sayfası (POST) yeniden gelmeli. Soruyu 30 saniye açık bırakın: form
      gönderilmemeli, sayfa takılı kalmamalı. Aynısını geri/ileri ile de deneyin. iOS'ta önceki gibi sorulmalı.
- [ ] Dokunmadan açılan açılır pencereler: iki platform da sessizce engelliyor ve uygulamaya haber vermiyor, bu yüzden
      bildirim eklenmedi; `http://localhost:8823/popup` sayfasında kendiliğinden açılan pencere açılmamalı, düğmeyle
      açılan açılmalı.

## 29. Yasal metinler on dilde, yasal sürüm artışı (20 Kasım; açık kaynak 4, pro 6; telefonda denenmedi)

- [ ] Güncellemeden sonra uygulamayı açın: tarayıcıdan önce yalnızca "Gizlilik politikamızı ve koşullarımızı
      güncelledik" adımı bir kez gelmeli; kabul edince tarayıcı açılmalı, sonraki açılışta bir daha sorulmamalı.
- [ ] Uygulama dilini Almanca, Japonca ve Rusça yapıp (Ayarlar › Dil) Ayarlar › Hakkında'dan Gizlilik Politikası'nı ve
      Kullanım Koşulları'nı açın: metin o dilde olmalı, üstte "İngilizce gösteriliyor" notu olmamalı; en sondaki
      "Değişiklikler" bölümünün son cümlesi İngilizce sürümün geçerli olduğunu söylemeli. Kişiler bölümündeki örnek
      o dilin adıyla olmalı (Thomas, 健太, Сергей).
- [ ] Küçük ekranlı bir telefonda (ya da en büyük yazı boyutunda) Japonca ve Almanca metinde en sona kadar kaydırın:
      kesilen ya da üst üste binen satır olmamalı.
- [ ] Türkçe metin önceki gibi olmalı (İngilizce'nin geçerli olduğunu söyleyen cümle yok).

## 30. Google Play ile kredi satın alma (RevenueCat; 20 Kasım; yeni yerel kodla, telefonda denenmedi)

Önce: sunucu ve RevenueCat kurulumu `backend/DEPLOY-prod.md` › "Satın almaları açmak" sırasıyla yapılmış olmalı
(üç paket panelde, panel › Settings › Test purchases in production sizin hesabınız için açık). Paket:
`EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` ile yapılmış pro AAB, Play'in test kanalından kurulmuş; telefonda Play Store'da
yalnızca lisans test hesabı açık.

- [ ] Ayarlar › Hesap › Qutai Credits › Kredi satın al: üç paket (100, 500, 1000 kredi) **Play'in fiyatıyla** (sizin
      para biriminizde) görünmeli; panelde olmayan bir Play ürünü görünmemeli, Play'de olmayan bir panel paketi de
      görünmemeli. Altta "Krediler … uygulama üzerinden iade edilmez" notu olmalı.
- [ ] 100'lük paketi "Test card, always approves" ile alın: Play'in sayfası açılmalı, bitince "100 kredi eklendi.
      Bakiyeniz şimdi …" yazmalı; bakiye **sunucunun cevabından sonra** artmalı. Panel › Payments: satır
      "google (sandbox)", gelir boş; Overview'da "test (sandbox) purchases recorded" notu ve kırmızı "ON" uyarısı.
- [ ] Aynı paketi hemen yeniden alın: Play "zaten sahipsiniz" dememeli (paket tüketildi), ikinci alım da eklenmeli.
- [ ] Play'in sayfasını geri tuşuyla kapatın: "Satın alma iptal edildi. Hiçbir ücret alınmadı." yazmalı.
- [ ] "Test card, always declines": "Satın alma tamamlanmadı…" yazmalı, kredi eklenmemeli.
- [ ] "Slow test card, approves after a few minutes": "Satın alma onay ya da ödeme bekliyor…" yazmalı; birkaç dakika
      sonra (uygulama açıkken ya da kapatıp açınca) krediler eklenmeli (webhook ya da "Eksik kredileri denetle").
- [ ] Bağlantı kopması: satın alma sayfasında ödemeyi onaylamadan hemen önce uçak modunu açın (Play yine de
      tamamlayabilir) ya da onaydan hemen sonra uygulamayı kapatın; sonra bağlantıyı açıp uygulamayı açın: krediler bir
      kez eklenmeli ("önceki bir satın almadan … kredi eklendi"), iki kez değil. Panelde aynı işlem tek satır olmalı.
- [ ] "Eksik kredileri denetle": eksik bir şey yoksa "Eksik bir şey yok…" yazmalı; daha önce eklenmiş bir satın alma
      yeniden eklenmemeli.
- [ ] Aktarılan işlem kimliği: panel › Payments'taki satırın işlem kimliği `GPA.` ile başlamalı (README › Buying
      credits › The transaction id on Android).
- [ ] Çıkış yapın, başka bir Qutai hesabıyla girin, satın alma ekranını açın: önceki hesabın satın almaları bu hesaba
      eklenmemeli. Test satın alma ayarında listede olmayan bu hesapla bir test satın alması yapın: "Bu satın alma başka
      bir hesaba ait…" ya da destek mesajı çıkmalı, kredi eklenmemeli (ayar yalnızca listedeki hesaplara izin verir).
- [ ] Play'den bir test satın almasını iade edin (Play Console › Order management › Refund): birkaç dakika içinde
      krediler geri alınmalı, panelde satır "refunded" olmalı.
- [ ] Google hesabı olmayan ya da Play Store'u olmayan bir cihaz/emülatör: "Bu cihazda uygulama mağazası üzerinden
      satın alma yapılamıyor…" yazmalı, Satın al düğmesi olmamalı.
- [ ] Panel › Settings › Test purchases in production'ı kapatın, yeni bir test satın alması yapın: kredi eklenmemeli
      (destek mesajı), Play iadeyi 3 gün içinde kendisi yapar ya da Play Console'dan iade edin.
- [ ] Pro olmayan (açık kaynak) APK: `aapt dump permissions <apk>` listesinde `com.android.vending.BILLING` olmamalı;
      `apkanalyzer dex packages <apk> | grep -c com.revenuecat` 0 olmalı.
- [ ] `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` olmadan (`--without-purchases`) yapılan pro paket: satın alma ekranı paketleri
      fiyatsız gösterip "Bu Qutai sürümünde kredi satın alınamıyor…" demeli.

## 31. Video reklamlarını engelle (21 Kasım; `BLK-29`, `BLK-30`, `BLK-31`; yalnızca JS, yeni derleme gerekmez; telefonda denenmedi)

Bilgisayarda WebKit ile desteklenen bir video sitesinin masaüstü sayfalarında denendi (sayfanın oynatıcı verisinde ve
sayfa içi geçişte reklam alanları kalmadı, video "oynatılabilir" kaldı); telefonda video oynarken görülmedi, sessize
alma yalnızca birim testlerinde denendi. Android'de sayfa betiği belge başında yüklenir (WebView 87 ve üstü); daha eski
WebView'da ilk video yine reklamla başlayabilir: o zaman reklam sessize alınmalı, sona sarılmalı, atlanmalı.
Desteklenen siteler: `src/content/videoAds.ts` içindeki kural tablosu (`hosts`).

- [ ] Kurulumun son adımında (koruma) "Video reklamlarını engelle" anahtarı kapalı görünmeli, altında tek cümle olmalı.
- [ ] Ayarlar › Gizlilik ve güvenlik: anahtar "Çerez bildirimlerini gizle"nin altında, kapalı.
- [ ] Anahtar kapalıyken desteklenen bir video sitesinin mobil sayfasında reklam çıkan bir video açın (popüler bir
      müzik videosu): reklam oynamalı (karşılaştırma için).
- [ ] Anahtarı açın, sekmeyi yenileyin ya da yeni sekmede aynı videoyu açın: reklam hiç başlamamalı, video
      doğrudan oynamalı; ses, ileri sarma, altyazı, yorumlar ve önerilen videolar çalışmalı.
- [ ] Sayfadan çıkmadan önerilen başka bir videoya geçin (sayfa içi geçiş): yine reklamsız başlamalı.
- [ ] Ana sayfada ve aramada "Sponsorlu" video kutuları ve banner'lar görünmemeli.
- [ ] Sitede oturum açın: oturum açma, abonelikler ve beğeni çalışmalı.
- [ ] Sitenin müzik sayfası ve başka bir sitedeki gömülü video (ör. bir haber sitesi): reklamsız başlamalı.
- [ ] Gizli sekmede aynı video: reklamsız başlamalı.
- [ ] Sitenin sayfasında "Burada reklam ve izleyicileri engelle"yi kapatın, yenileyin: reklam yine oynamalı.
- [ ] **Reklam yine de başlarsa (yedek):** reklam hemen sessize alınmalı (ses hiç duyulmamalı), sona sarılmalı ya da
      "Reklamı atla" kendisi basılmalı; reklam bitince ses geri gelmeli. Bunu denemek için: Android'de eski bir
      WebView'lu emülatör ya da anahtar kapalıyken reklam başlayınca anahtarı açıp sekmeyi yenilemeden sayfa içinde
      başka bir videoya geçin.
  - [ ] Videoyu reklamdan önce kendiniz sessize aldıysanız reklamdan sonra da sessiz kalmalı.
  - [ ] Reklamda sessiz bir donmuş kare bir an kalabilir; uzun sürerse yazın.
- [ ] Sitenin "reklam engelleyici" uyarısı çıkarsa yazın (gizlenmiyor).
- [ ] Asistana "video reklamlarını engelle" deyin: açabilmeli; "kapat" deyince kapatmamalı, Ayarlar'ı önermeli.

## 32. Kod incelemesi düzeltmeleri (21 Kasım; commit 8379e6c; telefonda denenmedi)

Mağazaya gönderilecek derlemede, gönderimden önce bir kez denenecekler ([store-submission.md](store-submission.md) › §5).

- [ ] **AI anahtarı güncellemeden sonra yerinde (iPhone, `AI-33`):** eski derlemede kendi API anahtarınızı kaydedin,
      üzerine yeni derlemeyi kurun, uygulamayı açın: anahtar Ayarlar › AI sağlayıcısı'nda duruyor ve asistana bir istek
      atılabiliyor. Özel uç nokta kullanıyorsanız başlık değerleri de yerinde. Android'de aynı deneme.
- [ ] Yeni kurulumda (eski veri yok) anahtar kaydedilip uygulama kapatılıp açılınca yerinde.
- [ ] Sekme değiştiricide sekmeyi sürükleme takılmadan çalışıyor (`PERF-12`).
- [ ] Sayfayı PDF olarak kaydetme ve bir görseli indirme çalışıyor; çok yavaş bir sayfada sonsuza kadar beklemiyor,
      hata veriyor.
- [ ] Android: süresi dolmuş ya da kendinden imzalı sertifikalı bir sitede "Yine de devam et" çalışıyor ve aynı
      site için yeniden sormuyor; başka bir site için yeniden soruyor.
- [ ] "Gezinme verilerini temizle" normalde eskisi gibi bitiyor (`DATA-30`; hata metni yalnızca silme başarısız olursa
      çıkar, elle denemek zor).
- [ ] Kredi satın alma (sandbox) eskisi gibi tamamlanıyor ve kredi ekleniyor (`BUY-35`).

## 33. Güvenlik paketi (26 Kasım kod incelemesi; **yeni yerel derleme gerekir** (Android, `DATA-34`); telefonda denenmedi)

- [ ] **Android, User-Agent (`DATA-34`):** yeni derlemede bir "what is my user agent" sayfası açın: dizgi
      `Mozilla/5.0 (Linux; Android 10; K) … Chrome/<sürüm>.0.0.0 Mobile Safari/537.36` biçiminde, içinde `wv`,
      `Version/4.0` ya da telefon modeli yok; sürüm, telefondaki Android System WebView sürümüyle aynı.
- [ ] Android: Google ile giriş ve Gmail "desteklenmeyen tarayıcı" demeden açılıyor (eskisi gibi).
- [ ] Android tablet: dizgide `Mobile` yok.
- [ ] **Sesli otomatik oynatma (`MEDIA-29`, `MEDIA-31`):** ayar kapalıyken sesli video dokunmadan başlamıyor,
      dokununca başlıyor; içinde gömülü oynatıcı (iframe) olan bir sayfada da (YouTube gömülü bir haber sayfası) aynı.
- [ ] Kilit ekranı ve bildirimdeki oynat / duraklat / ileri-geri düğmeleri çalışıyor (iOS ve Android); arka planda ses
      sürüyor, PiP açılıyor (Android).
- [ ] iOS: gömülü oynatıcıda (iframe) çalan ses kilit ekranında görünüyor; ses durunca sekme uykuya geçebiliyor.
- [ ] **Kamera, mikrofon, konum (`WPERM-21`):** bir görüntülü görüşme sitesinde (ör. meet.jit.si) izin sorusu çıkıyor,
      "İzin ver" sonrası kamera çalışıyor, adres çubuğundaki gösterge yanıyor; uygulamadan çıkınca kamera duruyor,
      dönünce sürüyor. Bir harita sitesinde "Konumumu kullan" çalışıyor.
- [ ] Android: bir sitenin kendi "Paylaş" düğmesi sistem paylaşım sayfasını açıyor (`WPERM-15`).
- [ ] Android, arka planda görev: uygulama arka plandayken süren bir görev sayfayı okuyup devam ediyor (`TASK`).
- [ ] **iOS, gizli sekme indirmesi (`INC-31`):** gizli sekmede bir dosya indirin, İndirilenler'de açın ya da paylaşın;
      bütün gizli sekmeleri kapatın: kayıt listeden gidiyor. iPhone Depolama'da Qutai'nin "Belgeler ve Veriler" boyutu
      dosya kadar azalıyor. Normal sekmede indirilen dosya yerinde duruyor ve açılıyor.
- [ ] iOS: güncellemeden sonra ilk açılışta İndirilenler listesindeki eski dosyaların hepsi açılıyor (süpürme
      listedeki hiçbir dosyayı silmiyor).
- [ ] **Gizli değer + Enter (`PAY-30`):** hafızada gizli bir değer (ör. pasaport numarası) varken asistandan onu bir
      yorum kutusuna yazıp göndermesini isteyin: yazmıyor, nedenini söylüyor. Bir formun kimlik numarası alanına
      yazması istenince soru çıkıyor ve yazıyor.
- [ ] "Her işlemden önce sor" açıkken aynı gizli değerin aynı sitede ikinci kez yazılması için onay soruluyor
      (`TOOL-34`).
- [ ] **Engelli site sekmesi (`SITE-28`):** bir siteyi "Engelli" yapın, o sitede bir sekme açık kalsın; başka bir
      sekmede asistana "açık sekmelerimi listele" deyin: o sekmenin başlığını ve adresini söylemiyor, yalnızca siteyi
      ve engelli olduğunu söylüyor.
- [ ] **Adres kontrolü (`UNTR-22`):** "trendyol.com'dan sipariş 1234567'yi takip et" deyince Trendyol adresi sorusuz
      açılıyor (eskisi gibi).

## 34. Görünür hatalar (26 Kasım kod incelemesi; Android indirme düzeltmesi için **yeni yerel derleme gerekir**; telefonda denenmedi)

- [ ] **Arama bağlantısı (`UI-83`):** Qutai açıkken ve kapalıyken `qutai://search?q=hava%20durumu` bağlantısını açın
      (Kestirmeler › "URL'yi Aç" ya da `adb shell am start -a android.intent.action.VIEW -d "qutai://search?q=hava%20durumu"`):
      yeni sekme açılıyor, adres alanında "hava durumu" yazılı ve gönderilmemiş. `qutai://new-tab` boş alanla açılıyor.
- [ ] **Geçmiş (`UI-71`):** 60'tan fazla ziyaret varken "Seç" › "Tümünü seç" › "Sil": liste boş kalmıyor, daha eski
      ziyaretler geliyor. Hepsi silinince "Geçmiş yok" görünüyor. Aynısı bir aramanın sonuçlarında da.
- [ ] **Yarıda kesilen yanıt (`AI-37`):** asistan yanıt yazarken uçak modunu açın: yanıt "bitti" gibi kalmıyor, bağlantı
      hatası gösteriliyor (Anthropic anahtarı ve Qutai Kredileri ile ayrı ayrı).
- [ ] Uzun düşünen bir modelle (ör. araştırma) birkaç dakikalık sessizlik görevi kesmiyor.
- [ ] **Gemini (`AI-13`):** "Gemini yanıtlarını akıt" açıkken geçersiz bir anahtarla soru sorun: hata bir kez
      gösteriliyor (istek iki kez gitmiyor).
- [ ] **Kredi kontrolü (`BUY-36`):** uçak modunda "Eksik kredileri kontrol et": "Mağazaya ulaşılamadı…" bildirimi
      çıkıyor. Kredi satın al ekranı uçak modunda açılınca fiyat satırında "Tekrar deneyin" var; bağlantı gelince
      dokunmak fiyatları getiriyor.
- [ ] **Klavye kısayolları (`UI-76`, Mac ve iPad):** ⋮ menüsü, bir onay sorusu, yazı boyutu ya da model sayfası açıkken
      ⌘W, ⌘T, ⌘R hiçbir şey yapmıyor; kapatınca yeniden çalışıyor. ⌥Space (konuşma) eskisi gibi.
- [ ] **Android indirme (`DL-8`, yeni derleme):** adresinde `|`, `[` ya da boşluk olan bir dosya bağlantısı iniyor;
      yönlendirmeli bir indirme (ör. GitHub sürüm dosyası) ve oturum gerektiren bir indirme eskisi gibi çalışıyor;
      duraklat ve sürdür çalışıyor.
- [ ] **Web sitesi (`WEB-18`, deploy sonrası):** `curl -I https://<site>/review/qutai-fgs-download.mp4` yanıtında
      `X-Robots-Tag: noindex, nofollow` var; video bağlantıyla açılıyor.
- [ ] iOS'ta temiz kurulumdan sonra (`npm install`) sesle yazma çalışıyor (konuşma tanıma yaması küçültüldü).
