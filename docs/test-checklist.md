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
- [ ] "Bunlar hangi yapay zekâ modellerini kullanıyor" bağlantısı her kademenin şu anki modelini, adım sınırını ve Qutai'nin bunu değiştirebileceğini gösteriyor
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
- [ ] Emojili uzun bir metni seçip "Qutai'ye sor" deyin: soru gidiyor, hata yok

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
- [ ] Android ayarlarından Qutai'nin uygulama dili Türkçe yapılınca (telefon İngilizce) simgeye uzun basınca kısayollar Türkçe; widget yazıları da. Yaklaşık 10 saniye sürebilir.
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

Sahte satın alma (sunucuda `FAKE_PURCHASES=true`):
- [ ] Ayarlar › Hesap › Qutai Kredileri › Kredi satın al: "Test modu" yazısı görünür; "Al (test)" ile bakiye artar.
- [ ] Aynı ekran kurulumdaki "Kredi satın al" düğmesinden de açılır.

Ölçüm (her biri beş kez, ortanca değeri yazın):
- [ ] Soğuk açılış: `adb shell am force-stop com.sonsuzdongu.qutai && adb shell am start -W -n com.sonsuzdongu.qutai/.MainActivity` (TotalTime).
- [ ] Bellek: `adb shell dumpsys meminfo com.sonsuzdongu.qutai | grep -E "TOTAL PSS|TOTAL RSS"`: açılıştan sonra, 1, 5 ve 20 sekmeyle, panel açıkken ve görev sürerken.
- [ ] Takılma: `adb shell dumpsys gfxinfo com.sonsuzdongu.qutai reset`, uzun bir sayfayı 10 saniye kaydırın (görev varken ve yokken), sonra `adb shell dumpsys gfxinfo com.sonsuzdongu.qutai | grep -E "Janky|50th|90th"`.

## Bulunan sorunlar

Deneme sırasında çıkanları buraya yazın; toplu düzeltilir.

- 16 Kasım'da telefonda bulunanlar ve cila listesi düzeltildi (kısayol dili, "bir daha sorma", göreli zaman, giriş kutusu yazısı, mikrofon satırı, onay penceresi, seçenekler, adım özeti, görev bildirimi, kredi uyarısı, titreşim, yüklenme göstergesi, erişilebilirlik, tablet genişliği). Denenecekler 12. bölümde.
- [ ] Asistan panelinde sesle yazarken "Sesle yazma çalışmadı. Yeniden deneyin." uyarısı çıkıyor ama metin aslında yazılıyor (16 Kas, Honor / Android 15; "düzelt" bekleniyor). Mikrofon düğmesini bırakınca çıkıyor. Olası neden: tanıyıcı metni verdikten sonra geç gelen, eşlenmemiş bir hata kodu (`src/device/voiceInput.ts` › `handleError`).
- [ ] Adres çubuğundaki üç nokta menüsü ekrana tam sığmıyor. Ekran yüksekliğine göre boyutlanmalı; sığmazsa kaydırılabilir olmalı. (16 Kas; "düzelt" bekleniyor)
- [ ] Kayıtlı görev ("Deneme") asistana "Deneme adlı görevi çalıştır" denince çalışmıyor; asistan kayıtlı görevlere erişimi olmadığını söylüyor. Asistanın kayıtlı görevleri adıyla bulup çalıştırabilmesi gerekiyor (bugün böyle bir aracı yok; talimatı da "yapamazsın" diyor). (16 Kas; "düzelt" bekleniyor)
- [ ] Gözlem (aynı ekran görüntüsü): panel başlığındaki satır "Qutai K…02 kredi" diye ortadan kesiliyor; bakiye okunmuyor.
- [ ] İstek: "Qutai bu işlemi yapmak istiyor" türündeki bütün cihaz izni pencerelerinde "bir daha sorma" kutusu olsun: takvim okuma, takvim etkinliği, bildirim, hatırlatıcı, konum, dosya indirme vb. Kutu işaretli "İzin ver" denirse o tür için bir daha sorulmaz; "Reddet" hatırlanmaz, sonraki sefer yine sorulur. Bugün yalnızca bildirim, takvim etkinliği ve hatırlatıcıda var; takvim okumada yok. (16 Kas; "düzelt" bekleniyor)
- [ ] Onay reddedilince sohbette kırmızı satırda İngilizce "The user declined this. Ask them how to proceed." yazıyor (uygulama dili Türkçe). Bu, modele giden araç sonucu metni; kullanıcıya ham gösteriliyor. Kullanıcıya uygulama dilinde kısa bir satır ("Reddettiniz") gösterilmeli, hata rengi de olmamalı. (16 Kas; "düzelt" bekleniyor)
- [ ] Asistan cevap balonu bazen dar kalıyor (ekranın yarısı kadar; madde işaretli liste içeren cevapta metin dar bir sütuna sıkışıyor). Cevap balonu her zaman kullanılabilir genişliğe yayılmalı. (16 Kas, Honor / Android 15; "düzelt" bekleniyor)
- [ ] Gözlem (aynı ekran görüntüsü): kendi anahtarla panel başlığında sağlayıcı ve model adı "Anthropi…net 5.5" diye ortadan kesiliyor.
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
- [ ] Yeni özellik isteği (hata değil; tasarım ve karar gerekiyor): asistan sayfada daha fazlasını yapabilsin (18 Kas). Bugün yalnızca sayfayı okuyup blok gizleyebiliyor / alan adı engelleyebiliyor ("Kendi kurallarım").
  - (1) Sayfada JavaScript çalıştırabilsin: görev JS ile çözülebiliyorsa onu yapsın. Örnek: "bu sayfada hangi çerezler var" (HttpOnly çerezler dahil; bunlar sayfa JS'inden okunamaz, tarayıcının çerez deposundan okunmalı). Sahibinin ifadesiyle "bir eklenti (extension) altyapısına ihtiyacımız var".
  - (2) Sayfada CSS değişikliği yapabilsin ve Greasemonkey benzeri kalıcı kullanıcı betikleri / stilleri yazabilsin. Örnek: "sayfadaki bağlantıları kırmızı yap".
  - [x] 1. adım yapıldı (19 Kas): stiller ve çerez listesi. "Bağlantıları kırmızı yap", "bu sitede yazılar büyük olsun", "burada koyu arka plan": asistan CSS önerir, Qutai denetler (ağdan yükleme yok), her seferinde sorar, sayfa hemen değişir; sohbet kartında "Bu site için sakla…" ve "Geri al". Saklananlar "Kendi kurallarım › Stiller"de; sayfa menüsünde "Bu sayfada stilleri kapat". "Bu sayfada hangi çerezler var": tarayıcının çerez deposundan (HttpOnly dahil), yapay zekâya yalnızca ad, alan adı, yol, süre, boyut ve işaretler gider, değerler asla; "Çerezler" ekranında değer dokununca görünür, kopyalanır, silinir (onayla). Telefonda kontrol: bölüm 16. Tasarım: `docs/page-customisation.md`.
  - [ ] 2. adım açık: sayfada JavaScript çalıştırma ve kalıcı kullanıcı betikleri. Sonraki oturumun ihtiyaçları `docs/page-customisation.md` › "Step two" bölümünde (depolama, onay, içe aktarmada kapalı gelmesi, kaçış yolu).
  - Yönetici notu: güvenlik açısından en riskli özellik bu olur (sayfadaki gizli talimatların asistana betik çalıştırtması, oturum çerezlerinin sızması). Önerilen çerçeve sahibine anlatıldı: tek seferlik çalıştırma ile kalıcı kural ayrımı, her betik için kod gösterilerek onay, çerez değerlerinin yapay zekâya gitmemesi, "Kendi kurallarım"ın stil ve betikleri de kapsaması.
- [x] Yeni özellik isteği (karar gerekiyor): asistan ödeme onayını da verebilsin (18 Kas). Bugün asistan siparişi sepete kadar getiriyor, "Ödemeyi her zaman siz tamamlarsınız" kuralıyla son düğmeye basmıyor (sistem isteminde ve web sitesinde böyle yazıyor). Sahibi bunun kaldırılabilmesini / zorlanabilmesini istiyor. Yönetici notu: teknik olarak mümkün (istem ve onay kuralı değişir), ama gerçek para harcayan tek özellik olur; önerilen çerçeve sahibine anlatıldı: her ödemede uygulamanın kendi onay penceresi (tutar, satıcı, sayfanın görüntüsü), "bir daha sorma" yok, harcama sınırı, kart bilgisi ve doğrulama kodu asistana gitmez, varsayılan kapalı ayar.
  - Yapıldı (19 Kas, `4d97c4d`): Ayarlar › Asistan › "Asistan ödemeleri tamamlasın" (varsayılan kapalı; açarken bir kez daha soruluyor; yedekten geri gelmiyor, asistan kendisi açamıyor). Kapalıyken asistan siparişi hazırlayıp "son düğmeye siz basın" diyor; son ödeme düğmesine basması uygulamada engelleniyor. Açıkken her ödemede Qutai'nin kendi penceresi: site, sayfada okunan toplam ve bulunduğu satır, sipariş, sayfanın adlandırdığı ödeme yöntemi, varsa abonelik/yenileme; "bir daha sorma" yok. Onaydan sonra toplam değişirse basılmıyor, yeniden soruluyor. Kart numarası hiçbir zaman yazılmıyor. Harcama sınırı eklenmedi (para birimi sorunu, TODO › Kararlar).
  - Telefonda kontrol: ayar kapalıyken bir test mağazasında (ya da `node scripts/page-tests/serve.mjs` sayfasındaki "Checkout" bölümünde, sahte yapay zekâ ile "pay") ödeme isteyin: pencere çıkmamalı, adımda "Ödemeyi siz yapıyorsunuz (ayarınız)" yazmalı, asistan "Pay now" düğmesine sizin basmanızı söylemeli. Ayarı açın (onay penceresi), aynısını isteyin: pencerede €24.99, "Order total: €24.99" satırı ve "Visa •••• 4242" görünmeli; Vazgeç → ödenmemeli; Onayla → "Paid €24.99" yazmalı. "sneakpay" ile onaysız basış reddedilmeli.
- [x] İstek / hata: asistan onay verilse de paylaşım yapmıyor: sosyal platformlarda paylaşım ve yorum (örnek: YouTube'a yorum girmiyor) ve ödeme adımı (18 Kas). Sahibi bunların "zorlanabilmesini" istiyor. Kodda bulunan: sistem istemi bunları yasaklamıyor, yalnızca "geri alınamaz ya da hassas işlemden önce dur ve açık onay iste" diyor (satın alma/ödeme, mesaj/e-posta gönderme, paylaşma/yayınlama, silme, hesap ayarı); uygulamada ayrıca bir engel görünmüyor. Yani nedeni henüz bilinmiyor; düzeltme sırasında ayırt edilecek: (a) model onaydan sonra da çekiniyor ya da reddediyor mu (hangi sağlayıcı/modelde), (b) onay sohbet metniyle isteniyor ve cevap modele "kullanıcı onayladı" olarak net ulaşmıyor mu (uygulamanın kendi onay penceresi ve araç sonucu daha net olur), (c) teknik mi: YouTube yorum kutusu gibi zengin metin alanlarına yazma ya da "Gönder" düğmesine basma başarısız mı oluyor. Ödeme için ayrı madde yukarıda.
  - Nedenleri ve düzeltme (19 Kas, `44def75`, `257ba70`, `4d97c4d`): (c) yerel test sayfalarında (`scripts/page-tests/`) eski yazma/tıklama kodu 10 durumdan 7'sinde başarısızdı: özel öğenin gölge DOM'undaki alana yazmak hata veriyordu, `beforeinput` ile çalışan zengin editörler metni kaybediyordu, yalnızca pointer/touch dinleyen düğmeler tepki vermiyordu, keyup ile açılan "Yayınla" düğmesi kapalı kalıyordu ve hâlâ kapalı bir "Gönder" düğmesine basmak "Clicked" diye başarı sayılıyordu (model gönderdiğini sanıyordu). Şimdi 16 durumun hepsi geçiyor; yalnızca `isTrusted` denetleyen düğmeye hiçbir sayfa betiği basamaz. (b) onay sohbetle (ask_user) isteniyordu, "evet" sıradan bir kullanıcı mesajı olarak gidiyordu ve sayfa metninden ayırt edilemiyordu; şimdi `request_approval` aracı Qutai'nin penceresini açıyor, sonuç modele "kullanıcı onayladı, şimdi bas ve sonucu söyle, sohbette yeniden sorma" diyor. (a) istemdeki "dur ve açık onay iste" cümlesi onaydan sonra ne yapılacağını söylemiyordu ve e-posta/SMS/WhatsApp kurallarındaki "kullanıcı kendisi gönderir" kalıbı modele genelleniyor olabilir; gerçek modellerle doğrulanacak (README › Posting and paying, bu dosyada aşağıdaki el ile test).
  - Telefonda kontrol: `node scripts/page-tests/serve.mjs` sayfasında sahte yapay zekâ ile "post" deyin: yorum kutusuna yazmalı, "Comment on localhost:8811?" penceresinde tam metin ("Nice page! (Qutai test)") ve "Qutai sayfadaki “Post (shadow)” düğmesine bir kez basacak" görünmeli; Onayla → yorum listede bir kez görünmeli; Vazgeç → gönderilmemeli. Sonra gerçek bir modelle kendi test videonuzda/hesabınızda: "Bu videoya 'Harika video' diye yorum yaz" → pencere bir kez, sohbette ikinci bir "emin misiniz?" olmadan; onaydan sonra yorum gerçekten görünmeli. Android emülatörü yerel http sunucusunu reddettiği için cihazda henüz denenmedi.
  - Gerçek modellerle el ile test (sahibi; her biri kendi hesabınızda, kendi test içeriğinizle): Anthropic'in varsayılan modeli, OpenAI'nin varsayılan modeli, Gemini'nin varsayılan modeli ve Qutai Kredileri. Görevler: (1) kendi YouTube test videonuza "Bu videoya 'Qutai deneme yorumu' diye yorum yaz"; (2) kendi hesabınızdan bir foruma/yorum alanına kısa bir yanıt; (3) ödeme ayarı kapalıyken bir mağazada sepeti ödeme adımına kadar getirmesini isteyin; (4) ayar açıkken kayıtlı kartlı bir hesapta küçük tutarlı bir ödeme (ya da mağazanın test ortamı). Bakılacaklar: sohbette ayrıca "emin misiniz?" sorulmadan tek pencere çıkıyor mu; penceredeki metin/toplam sayfadakiyle aynı mı; Onayla'dan sonra model düğmeye basıp sonucu söylüyor mu (yoksa yeniden soruyor ya da reddediyor mu: hangi modelde, cevabın metni); Vazgeç'ten sonra duruyor mu; (3)'te "siparişiniz hazır, şu düğmeye siz basın" deyip duruyor mu; 3-D Secure sayfasında size bırakıyor mu.
- [x] Yeni özellik isteği (tasarım ve karar gerekiyor): telefonda küçük görsel ve video düzenlemeleri (18 Kas). Örnekler: resmi keskinleştirme, gri tonlama; sayfadaki bazı öğelerden video oluşturup galeriye kaydetme. Bugün var olan: `edit_image` aracı ve "Yeniden boyutlandır ya da kırp" sayfası (kırpma, döndürme, çevirme, boyut, biçim, hedef dosya boyutu; hepsi telefonda, Skia ile, hiçbir yere gönderilmeden). Filtreler (keskinleştirme, gri ton, parlaklık, kontrast, bulanıklık) aynı altyapıya küçük bir ek; video ise ayrı ve büyük bir iş (uygulamada video kodlayan bir kütüphane yok). Seçenekler sahibine anlatıldı.
  - Görsel kısmı yapıldı (19 Kas): `edit_image` filtreleri (siyah beyaz, sepya, ters çevirme, otomatik iyileştirme, parlaklık, kontrast, doygunluk, sıcaklık, keskinleştirme, bulanıklık) ve önizlemedeki "Düzenle" sayfasında "Filtreler" bölümü (hazır seçimler, kaydırıcılar, Sıfırla, canlı önizleme, basılı tutunca orijinal). Video kısmı sahibi tarafından ertelendi (19 Kas); bu iş kapsamında değil.
  - iOS simülatöründe denendi (iPhone 17 Pro, Türkçe): fotoğrafta Siyah beyaz + Keskinleştir, Otomatik iyileştir, parlaklık kaydırıcısı, Sıfırla, basılı tutunca "Özgün", yatay ekranda yan yana düzen; saydam PNG'de Sepya + Daha parlak + Daha fazla kontrast + Bulanıklık; iki kopya da Fotoğraflar'a kaydedildi, JPEG tamamen gri, PNG saydamlığını koruyor, renkler test hesabıyla birebir aynı. Denenmeyen: Android, sesli okuyucu, büyük yazı, asistanın sahte yapay zekâyla `edit_image` çağırması (simülatöre adres yazılamadı), sohbet kartındaki özet satırı.
  - [ ] Telefonda kontrol: bir fotoğraf ekleyip önizlemede "Düzenle"ye basın; her hazır seçimi (Özgün, Otomatik iyileştir, Siyah beyaz, Sepya, Keskinleştir, Daha parlak, Daha fazla kontrast, Bulanıklık) deneyin, önizleme hemen değişmeli, resme basılı tutunca orijinal görünmeli; "Kopya oluştur" ile kopya mesaja eklenmeli, başlığın altında yapılanlar Türkçe yazmalı ("Siyah beyaz, keskinleştirildi"); Kaydet ile Fotoğraflar'a gitmeli. Aynısını saydam bir PNG ile yapın (arka plan saydam kalmalı). Asistana "bu resmi siyah beyaz yap ve biraz keskinleştir" deyin: sohbette kart çıkmalı, kartta aynı özet yazmalı. Android'de, yatay ekranda, büyük yazıyla ve VoiceOver/TalkBack ile kaydırıcıları (yukarı/aşağı kaydırma 5'er adım) deneyin.
- [ ] Yeni özellik isteği (büyük; tasarım ve karar gerekiyor): Qutai içinde kullanıcının oluşturabildiği "uygulamalar" (18 Kas). Örnek: "bana bir uygulama oluştur, burada notlarımı tutabileyim" → Qutai uygulamanın JavaScript kodunu yazar, uygulama Qutai içinde çalışır. Sahibinin istedikleri: bir altyapı ve sözleşme (contract); telefondan köprülenen yetenekler (örnek: konum); verinin telefonda tutulması; uygulamaların dışa aktarılabilmesi; verileriyle birlikte yedeğe ve sunucu yedeğine girmesi. Yönetici notu: önerilen mimari sahibine anlatıldı (yalıtılmış web görünümünde çalışan mini uygulamalar, izinli köprü API'si, uygulama başına depolama, tek dosyalık paket biçimi). Sayfa betikleri isteğiyle aynı güvenlik sorularını paylaşır ama daha güvenlidir: uygulama kendi boş sayfasında çalışır, başka sitelerin oturumuna erişmez.

### 19 Kasım'da bildirilenler ("düzelt" bekleniyor)

Sahibi "yazdıklarımı incele, ben düzelt deyince düzelt" dedi; hiçbirine dokunulmadı. Her maddede kodda bulunan neden yazılıdır.

- [x] Adres çubuğuna yazarken öneri listesi akıcı değil: geçmişte her harfte arama yapılıyor ve liste her tuşta boşalıp yeniden doluyor (19 Kas; 0.1.3). İstek: bir gecikme (debounce) eklensin ve liste daha yumuşak dolsun. Kodda bulunan (`src/components/OmniboxSuggestions.tsx`): yerel öneriler (geçmiş, yer imleri, açık sekmeler) her tuşta gecikmesiz sorgulanıyor (satır 49-58); web önerilerinde gecikme var ama yerelde yok. Asıl titreme şuradan: yeni sorgunun sonucu gelene kadar eski sonuçlar atılıyor (`localItems = local.query === query ? local.items : []`, satır 88-89), yani her harfte liste bir an boş kalıp yeniden çiziliyor. Düzeltme yönü: yerel aramaya kısa bir gecikme (yaklaşık 100-150 ms, hızlı yazarken ara sorgular atlanır); yeni sonuç gelene kadar önceki sonuçları göstermeye devam etmek (boşaltmamak); satırların kararlı anahtarlarla çizilmesi ki değişmeyen satırlar yerinde kalsın; satır sayısı değişince yüksekliğin yumuşak geçmesi ("hareketi azalt" açıkken anlık); yapıştırma ve "Qutai'ye sor" satırlarının yerinden oynamaması. **Düzeltildi (19 Kas, 1341bc3):** liste harfler arasında hiç boşalmıyor, yeni yanıt gelince bir kerede değişiyor; geç gelen eski yanıt yenisinin yerine geçmiyor; yerel arama 120 ms bekliyor (duraklamadan sonraki ilk harf ve boşaltılan alan anında), geçmiş ve arama motoru önerileri birlikte geliyor; "Qutai'ye sor" ve arama/adres satırı en üstte sabit; satırlar yumuşakça beliriyor ("hareketi azalt" açıkken anlık); parmak listedeyken liste değişmiyor. Geçmiş sorgusu yeni bir dizinle yaklaşık yarı sürede çalışıyor. Bulma çubuğundaki sayı ve geçmiş aramasındaki dönen simge de her harfte yanıp sönmüyor. Denendi: iOS simülatöründe (iPhone 18 Pro, Release, 4.000 geçmiş kaydı) boş alan, "gal" (geçmiş satırları), "galx" (geçmiş satırları gitti, web önerileri geldi, yazılan metin tekrarlanmadı), alanı silme (Yapıştır satırı anında). Denenmedi: telefonda hızlı yazma, gizli sekme, "hareketi azalt" açıkken, Android, kare kare titreme kaydı (simülatörün kaydı yazarken kare atlıyor).
  - Sahibinin kararı (19 Kas): arama motoruna öneri isteği yalnızca yazmaya 200 ms ara verilince gidiyor; duraksamadan yazılan bir kelime tek istek, bitmiş metinle. Geçmiş önerileri kendi 120 ms düzeninde kalıyor; motor satırları geldiğinde listeye katılıyor, liste boşalmıyor.
  - [ ] Telefonda bakın: adres çubuğuna hızlıca "galatasaray" yazın, birkaç harf silin, alanı temizleyin, yapıştırın; normal ve gizli sekmede, bir de "hareketi azalt" açıkken. Liste hiç boşalmamalı, satırlar yanıp sönmemeli, "Qutai'ye sor" yerinden oynamamalı; web önerileri ancak yazmaya kısa bir ara verince yenilenmeli.
- [x] İlk açılışta "Get started" ekranındaki ve ardından gelen "Privacy and terms" ekranındaki metinler ekrana sığmıyor (19 Kas; 0.1.3, telefonda). İstek: bu iki ekrandaki metinler daha küçük olsun. **Düzeltildi (19 Kas):** neden: iki ekranın yazıları sonraki adımlarla aynı büyüklükteydi (başlık 26, metin 15-16 pt, logo 72) ve resmî derlemedeki gizlilik özeti uzun dillerde 600-730 karakter tutuyor; küçük bir telefonda metin aşağı taşıyor, "Okudum ve kabul ediyorum" kutusu kaydırınca görünen yere kalıyor, sabit 52 pt yüksekliğindeki düğme büyük yazı boyutunda etiketini kesiyordu. Şimdi: daha küçük yazı (14-15 pt, özellik metinleri 13 pt), 760 dp'den kısa ekranlarda ve yatayda daha da sıkı (yatayda logo adın yanında); yazılar sistemin yazı boyutuyla en çok 1,4 katına kadar büyüyor, ötesinde ekran kayıyor (daha fazlası varsa kaydırma çubuğu bir an görünüyor); onay kutusu Kabul düğmesiyle birlikte altta sabit; düğme etiketi sığmazsa kesilmiyor, düğme uzuyor. Denetlenen: tür denetimi, lint, testler; iOS simülatöründe (iPhone 18 Pro, yüklü Release derlemeye yalnızca yeni JS paketi konarak) İngilizce ve Almanca, normal ve en büyük yazı boyutunda, dikey ve yatayda: metin kesilmiyor, en büyük boyutta yatayda metin kayıyor, onay kutusu ve düğme altta. Denenmedi: 360 x 640 dp'lik küçük bir telefon (öyle bir simülatörde uygulama yüklü değil), Android, resmî (pro) derlemenin uzun metinleri.
  - [ ] Telefonda bakın: uygulama verisini silip açın; "Get started" ve "Privacy and terms" ekranlarını dikey ve yatay, normal ve en büyük yazı boyutunda, Türkçe ve İngilizce (mümkünse Almanca ya da Fransızca) inceleyin. Metin kesilmemeli, üst üste binmemeli; düğme ve onay kutusu her zaman altta görünmeli; sığmayan kısım kaydırılarak okunabilmeli.
- [x] Hesap ekranında giriş yöntemlerinin ("Signed in with email", "Google" gibi) yanında hangi e-posta adresiyle giriş yapıldığı yazsın (19 Kas; 0.1.3). Bilinen: sunucunun `GET /me` yanıtındaki `methods` listesi adresi yalnızca `email` yöntemi için veriyor; Google ve Apple için adres dönmüyor, yani sunucu tarafında da değişiklik gerekir (Apple'da gizli aktarma adresi olabilir; ne gösterileceği kararlaştırılmalı). **Düzeltildi (19 Kas; sunucu yeniden kurulunca görünür):** sunucu şimdiye kadar hesap başına tek adres tutuyordu (son girişteki), yöntem başına değil; Google ve Apple'ın birlikte olduğu bir hesapta hangi adresin hangisine ait olduğu bilinemiyordu. Artık her Google ve Apple yöntemi kendi girişinin verdiği adresi tutuyor (yeni sütun `identities.email`, geçiş 0012; her girişte adres gelirse güncellenir, adressiz giriş silmez; eski kayıtlar yalnızca hesapta tek bir Google ya da Apple yöntemi varsa dolduruldu, diğerleri o yöntemle bir sonraki girişte dolar). `GET /me` bu adresi yönteme ekliyor. Uygulama "Giriş yöntemleri" listesinde "E-posta: ad@ornek.com", "Google: ad@gmail.com" gösteriyor; Apple'ın "E-postamı Gizle" aktarma adresi yerine "Apple: gizli e-posta" yazıyor. Eski sunucuyla adres gelmez, yöntem adı tek başına görünür (bugünkü gibi). Günlüklere adres yazılmıyor. Denetlenen: arka uçta `npm test` (API 540, yönetim paneli 78; yeni `method-emails` testleri, günlük testi dahil), `npm run typecheck`, `npm run lint`; uygulamada `test:account`, `test:i18n`, tür denetimi, lint.
  - [ ] Sahibi: sunucuyu yeniden kurun (`backend/` içinde üretim kurulum komutu geçiş 0012'yi uygular). Sonra telefonda Ayarlar › Hesap: Google ile, Apple ile (adresi gizleyerek ve göstererek) ve e-postayla girin ya da yöntem ekleyin; her yöntemin yanında doğru adres, gizli Apple adresinde "gizli e-posta" yazmalı. Daha önce eklenmiş ama o günden beri kullanılmamış bir Google/Apple yöntemi adres göstermeyebilir; o yöntemle bir kez yeniden girince görünür.
- [x] Kurulumun (onboarding) ilk adımında dil seçimi olsun: burada uygulamanın dili seçilsin, varsayılan cihazın dili olsun (19 Kas; 0.1.3). **Düzeltildi (19 Kas):** kurulumun ilk adımı artık dil: on dil, her biri kendi dilinde yazılı; uygulamanın o an gösterdiği dil seçili gelir (telefonun dili ya da en yakını, yoksa İngilizce). Bir dile dokununca kurulum hemen o dile geçer. Seçim, Ayarlar › Dil ile aynı ayardır: Android'de aynı uygulama dili ayarı (13 ve üstünde telefonun Ayarlar › Uygulamalar › Qutai › Dil'i; önceden seçili dile dönülürse "Sistem varsayılanı" kalır); iOS'ta Ayarlar › Qutai › Dil'in yazdığı aynı değer (iOS izin pencereleri ve hızlı eylemler bu dile bir sonraki açılıştan itibaren geçer). Yalnızca gizlilik metinleri yeniden sorulduğunda dil adımı çıkmaz. Denetlenen: tür denetimi, lint, `test:i18n`; iOS simülatöründe: Deutsch'a dokununca ekran hemen Almanca, uygulamanın kendi `AppleLanguages` değeri `["de"]`; uygulama kapatılıp açılınca Almanca ve Deutsch seçili açılıyor; English'e dönünce değer siliniyor ve uygulama yeniden İngilizce açılıyor (ilk denemede silme çalışmıyordu: React Native'in `Settings.set` null'u yerel tarafa iletmiyor; düzeltildi). Denenmedi: Android (13 öncesi ve sonrası), iOS Ayarlar › Qutai › Dil ekranında görünmesi.
  - [ ] Telefonda bakın (iOS ve Android): uygulama verisini silip açın; ilk ekranda telefonun dili seçili olmalı. Başka bir dil seçin: başlık ve düğme hemen değişmeli; "Devam" ile ilerleyin, kurulumu bitirin. Ayarlar › Dil aynı dili göstermeli (iOS'ta uygulamayı kapatıp açınca iOS Ayarlar › Qutai › Dil de aynı dili göstermeli, izin pencereleri o dilde gelmeli). Bir de dil adımında başka dil seçip yeniden telefonun diline dönün: Android'de Ayarlar › Dil "Sistem varsayılanı" kalmalı.
- [x] Kurulumdaki örnek adlar ("Ayşe", "Ahmet" gibi) seçili dile göre olsun: her dilde o dilde yaygın adlar kullanılsın (19 Kas; 0.1.3). On dilin hepsi için. **Düzeltildi (19 Kas):** "Ahmet" ve "Ayşe", kurulumun "Qutai'nin kullanabilecekleri" adımındaki Kişiler satırından geliyordu ve on dilin hepsinde aynıydı; ayrıca "Kendinizi tanıtın" örneği Almanca, İspanyolca, Portekizce ve Fransızcada İngilizce "Sam" adını kullanıyordu. Şimdi her dil kendi yaygın adlarını kullanıyor: Türkçe Ahmet/Ayşe, İngilizce James/Emma, Almanca Thomas/Anna (örnekte Lukas), İspanyolca Carlos/Lucía (Pablo), Portekizce João/Ana (Lucas), Fransızca Thomas/Julie, Japonca 健太/美咲, Korece 민준/서연, Rusça Сергей/Ольга, Endonezce Budi/Dewi; ad kutusundaki örnekler (Ayşe, Jane, Erika, Ana, Maria, Marie, 花子, 지은, Анна, Siti) zaten yereldi. Kurulum dışında bulunan ve değiştirilmeyenler raporda ve `docs/design/31-onboarding.md` › Limits'te: İngilizce ve Türkçe gizlilik politikasındaki "call Ahmet" örneği, asistanın komutundaki ve kişi arama aracındaki örnekler, İngilizce ve İspanyolca "İstanbul'dan Ankara'ya uçuş" önerisi. Denetlenen: `test:i18n`.
  - [ ] Telefonda bakın: dil adımında birkaç dil seçip "Qutai'nin kullanabilecekleri" adımındaki Kişiler satırını ve "Bana kendinizden bahsedin" metin kutusundaki örneği okuyun; adlar o dile uygun olmalı.
- [x] Kurulumdaki "Bana kendinizden bahsedin" ("Tell me about yourself") ekranı daha kullanıcı dostu olsun (19 Kas; 0.1.3). İstek: ilk aşamada üç seçenek çıksın: "Konuşarak söylemek istiyorum", "Yazmak istiyorum", "Bana soru sor". Büyük mikrofon ve dinleme görünümü yalnızca "konuşarak" seçilince gelsin; şimdi ekran doğrudan mikrofonla açılıyor. "Bana soru sor" seçeneğinin nasıl çalışacağı (soruların sesle mi yazıyla mı sorulacağı, kaç soru) düzeltme sırasında kararlaştırılacak. **Düzeltildi (19 Kas):** adım artık üç seçenekle açılıyor ("Konuşarak söylemek istiyorum", "Yazmak istiyorum", "Bana soru sor") ve altta "Şimdi değil"; seçeneklerin altında tek satırlık gizlilik notu var. Büyük mikrofon, söylenmeye değer konular ve mikrofonun altındaki gizlilik notu yalnızca "Konuşarak" seçilince geliyor; mikrofon izni ancak bir mikrofona dokununca isteniyor. "Yazmak istiyorum" doğrudan metin kutusunu açıyor. **"Bana soru sor" için kurulan varsayılan (değiştirilebilir):** beş kısa, sabit ve çevrilmiş soru, ekranda yazıyla, birer birer: adınız, şehriniz, yemek (beslenme, alerji), alışveriş ve teslimat, yanıt tarzı; her biri bir öneri düğmesiyle, yazarak ya da küçük mikrofonla yanıtlanır ya da atlanır; hoparlör düğmesi açılırsa sorular sesli okunur. Soruları sormak için yapay zekâ gerekmez; yazılan ya da söylenen yanıtlar, takip sorularındaki gibi tek bir istekle notlara dönüştürülür ve hepsi aynı "Anladıklarım" sayfasında kontrol edilip aynı yere (hafıza, yanıt tarzı satırı) kaydedilir. Yapay zekâ yoksa yalnızca "Bana soru sor" çıkar ve yanıtlar verildiği gibi listelenir. İlk sorudan ya da yazma sayfasından geri, üç seçeneğe döner. Denetlenen: tür denetimi, lint, `test:intro` (yeni akış testleriyle), `test:i18n`; iOS simülatöründe İngilizce ve Almanca: yapay zekâsız tek seçenek, beş soru (yazılan ad, atlamalar, "Karte", "Kurz und knapp"), "Das habe ich verstanden" sayfasında iki satır, "Gespeichert … 2"; anahtar girilince üç seçenek, "Ich möchte es sprechen" ile mikrofon sayfası ve geri, "Ich möchte tippen" ile metin kutusu. Bu denemede iki düzeltme yapıldı: soru sayfası artık her yeni soruda aşağı kayıyor (beşinci soru görünmüyordu) ve "Bana soru sor"daki yemek sorusu "Yemekten hiç bahsetmediniz" yerine "Yemekte tercihleriniz ya da kısıtlarınız var mı?" diye soruluyor. Denenmedi: gerçek konuşma, mikrofon izni, yapay zekâyla ikinci istek (sahte yapay zekâ kurulmadı).
  - [ ] Telefonda bakın: kurulumda ve Ayarlar › Asistan › Hafıza › "Kendinizi tanıtın"da üç seçenek görünmeli, mikrofon görünmemeli ve izin sorulmamalı. "Konuşarak": büyük mikrofon, dokununca izin ve dinleme. "Yazmak": metin kutusu. "Bana soru sor": beş soru birer birer; birini yazarak, birini mikrofonla, birini öneriyle yanıtlayın, birini atlayın; "Anladıklarım" sayfasında doğru notlar; kaydedip Hafıza'da görün. Yapay zekâ ayarlamadan da deneyin: yalnızca "Bana soru sor" çıkmalı, yanıtlar yazdığınız gibi listelenmeli.
- [x] Kurulumdaki "her sayfayı sizinle okur" anlamındaki tanıtım cümlesi yanıltıcı: asistan her sayfayı kendiliğinden, her seferinde okuyormuş gibi anlaşılıyor; oysa yalnızca siz isteyince okur (20 Kas; 0.1.3). İstek: "dilerseniz okuyabilir" anlamında ya da daha iyi bir ifade. Aynı ifade web sitesinde de olabilir; uygulamada on dilin hepsinde ve web sitesinde (İngilizce, Türkçe) taranıp düzeltilecek. "düzelt" denince bakılacak. **Düzeltildi (20 Kas):** cümle yalnızca kurulumun ilk ekranındaydı (ilk özellik başlığı) ve on dilin hepsinde aynı anlamdaydı; şimdi "İstediğinizde sayfayı okur" (İngilizce "Reads the page when you ask"). Üstteki tanıtım cümlesi de "İstediğinizde sayfaları okuyan ve işlerinizi sizin yerinize yapan…" oldu (İngilizce "…when you ask"). Seçenekler: Türkçe "Sorduğunuzda sayfayı okur", "Bulunduğunuz sayfayı ona sorun"; İngilizce "Reads the page you are on, on request", "Ask about the page you are on". Uygulamada başka yerde (ayarlar, izin metinleri) aynı iddia yok; hukuki metinler zaten "istediğinizde" diyor. Web sitesi bu oturumda değiştirilmedi: `webpage/src/i18n/en.ts` ve `tr.ts` içinde `meta.description`, `meta.appDescription`, `hero.lede`, `statement.text`, `agent.lede` ("sayfaları sizin için okur", "Sayfayı okur") aynı izlenimi verebilir. Kural `INTRO-27`. Yalnızca tsc, lint ve testlerle denetlendi.
  - [ ] Telefonda bakın: kurulumun karşılama ekranında üstteki cümle ve ilk özellik "İstediğinizde…" diye okunmalı; birkaç dil seçip uzun dillerde (Almanca, Rusça, Endonezce) başlığın taşmadığına bakın.
- [ ] Kurulumdaki "Yapay zekânızı seçin" adımında iki seçenek var: "Qutai Kredileri" ve kendi yapay zekâ anahtarınız. İkincisi ekranın altında kalıyor, kaydırmadan görünmüyor (20 Kas; 0.1.3, telefonda). İstek: iki seçenek de ilk bakışta görünsün; öneri: akordeon (iki başlık görünür, dokunulan açılır, diğeri kapanır). "düzelt" denince bakılacak.

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
- [ ] Kurulumdaki yanıt tarzı / "özel talimat" seçimi ("kısa ve öz" ve diğer seçenekler) kaldırılsın: yanıt tarzı hep "kısa ve öz" olsun, kullanıcıya hiç sorulmasın (20 Kas; 0.1.3). Kapsam düzeltmede netleşecek: kurulumdaki seçim adımı, "Bana soru sor" akışının beşinci sorusu (yanıt tarzı) ve varsayılan değer. Ayarlar'daki özel talimat alanı kalır (sahibi yalnızca kurulumda sorulmasını istemedi; aksi söylenirse o da değişir). "düzelt" denince bakılacak.
- [ ] Kurulumdan "varsayılan tarayıcı yap" adımı kaldırılsın (20 Kas; 0.1.3). Ayarlar'daki varsayılan tarayıcı seçeneği kalır. "düzelt" denince bakılacak.
- [ ] Qutai Kredileri'nde katman seçimi ("Qutai Hızlı", "Qutai", "Qutai Pro") kaldırılsın: kullanıcıya seçenek gösterilmesin, hep hızlı katman kullanılsın, yani arkada Claude Haiku (20 Kas; 0.1.3). Bilinenler: katmanlar sunucudaki `model_tiers` ayarında; şimdiki varsayılan `standard` (Claude Sonnet 5.5), `fast` = Claude Haiku 5.5 ve adım sınırı 25 (standartta 40). Varsayılanı değiştirmek panelden yapılabilir; seçimin arayüzden kalkması uygulama değişikliği ister. Düzeltmede sorulacak: hızlı katmanın adım sınırı 25'te mi kalsın, derin araştırma da Haiku ile mi çalışsın, kendi anahtarıyla kullananların model seçimi aynen kalsın mı. "düzelt" denince bakılacak.
- [ ] Yönetim paneli, önceki maddenin devamı (20 Kas): "Prices and packs" ekranında şimdiki gibi birçok modelin verisi olmasın, yalnızca kullanılan model (Claude Haiku) görünsün; ayrıca varsayılan model panelden seçilebilsin (bugün "Haiku 5.5", yarın "Haiku 5.6" çıkınca panelden değiştirilebilsin, dağıtım gerekmeden). Bilinenler: `prices` tablosu yalnızca eklemeye açık (satır silinmez, güncellenmez), yani eski modellerin fiyatları veritabanında kalır ama ekranda gizlenebilir; model bugün `model_tiers` ve `allowed_models` ayarlarının JSON'unda duruyor, panelde ham JSON olarak düzenleniyor; fiyatı girilmemiş bir model sunucuda reddediliyor (`price_missing`), yani yeni model seçilmeden önce panelden fiyatı girilebilmeli. "düzelt" denince bakılacak.
- [ ] Fiyatlandırma kararları (sahibi, 20 Kas): 1 kredi = 1 sent kalır (`creditsPerUsd` 100); kâr payı %100 olur (`marginBps` 10000, sağlayıcı maliyetinin iki katı; gerekçe: mağaza komisyonu %15 ila %30, %30 kâr payı komisyonu karşılamıyor); temel alınan model Claude Haiku. Yönetim panelinde modelin fiyat alanının yanında bir "kontrol et" düğmesi olsun: Anthropic'in fiyat sayfasından okuduğunu yalnızca öneri olarak göstersin, sahibi onaylamadan hiçbir şey uygulanmasın (Anthropic'in fiyat döndüren bir API'si yok; sayfa okunamaz ya da biçimi değişmişse düğme bunu açıkça söylesin). Production'daki `pricing` ayarı panelden değiştirilecek (dağıtım betiği var olan ayarı ezmez); betikteki ilk değer de %100 yapılacak. Kâr payı panelden ayarlanabilsin: bugün Settings › `pricing` içinde ham JSON olarak (`marginBps`) değiştirilebiliyor; istek, yüzde olarak girilen anlaşılır bir alan ve yanında örnek hesap (1 $ maliyet kaç kredi düşer). Paket fiyatları (0,99 $ = 100 kredi, 4,99 $ = 500, 9,99 $ = 1000 önerildi) RevenueCat kurulurken kesinleşecek. "düzelt" denince yapılacak.
- [ ] Asistanın sunduğu seçenekler görsel kutular (kartlar) olarak gösterilsin (20 Kas; 0.1.3): hem sohbet panelinde hem de sayfa içinde alttaki bantta açılan menüde. Örnek: "bana kırmızı bir kazak bul" denince bugün yalnızca bir mağaza bağlantısı veriliyor; istek, her seçeneğin ürün resmi, adı, fiyatı ve kaynağıyla bir kutu olması, dokununca açılması. Genel olarak buradaki arayüz daha gösterişli olsun. Düzeltmede ele alınacaklar: asistanın kartları yapılı biçimde vermesi (talimat ya da araç değişir, yani ajan profili değişir ve sunucuya yeni profil kaydı gerekir); resimlerin sitelerden yüklenmesi telefondan o sitelere istek demektir (tasarım kaydında "telefondan ne çıkar" güncellenir; gizli sekmede davranış kararlaştırılır); resmi olmayan ya da yüklenemeyen seçenekte kart yine düzgün görünmeli; ürün dışındaki seçenekler (otel, uçuş, makale, yer) için de aynı kart. "düzelt" denince bakılacak.
- [ ] Yönetim paneli › Settings sayfası okunabilir olsun (20 Kas): bugün her ayar ham JSON metni olarak gösteriliyor ve düzenleniyor. İstek: her ayar için adı ve ne işe yaradığı yazan, alan alan düzenlenen bir form (sayı alanı, açma kapama düğmesi, liste, yüzde, dolar); birimler insan diliyle (mikro USD yerine dolar, baz puan yerine yüzde, saniye); kaydetmeden önce neyin değişeceği gösterilsin. Ham JSON yalnızca "gelişmiş" altında kalsın. Denetim kaydı ve gerekçe alanı aynen kalır. Sahibi "bunları düzelt" dedikten hemen sonra yazdı; panel işiyle (not 6 ve 7) birlikte yapılacak.
- [x] ~~Bakım modu ve zorunlu güncelleme mesajlarının altındaki "Ayrıntılar" bağlantısı çalışmıyor (20 Kas; 0.1.3, production sunucusuyla). İstek: ya gerçekten ayrıntı gösterilsin ya da düğme hiç gösterilmesin. Yapılacak: neden çalışmadığı bulunur; gösterilecek ayrıntı varsa (bakımda panelden girilen mesaj, güncellemede gereken en düşük sürüm ve kurulu sürüm) açılır, yoksa düğme gizlenir; zorunlu güncellemede mağaza sayfasını açan bir "Güncelle" düğmesi olup olmadığına da bakılır. Uygulama oturumuyla (not 1 ila 5) birlikte yapılacak.~~ İPTAL (sahibi, 20 Kas): bağlantılar çalışıyormuş; yapılacak bir şey yok.

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
- [x] Kurulumdaki "Qutai'nin kullanabilecekleri" adımında kişiler yok (izin ilk kullanımda sorulur).
- [x] Ayarlar › Asistan › Kişiler: açıklama, durum "Henüz sorulmadı" ve "İzin ver". "İzin ver" sistem iznini açar; iznin metni Türkçe.
- [x] iOS sınırlı erişim: "Kişileri Seç" ile tek kişi paylaşıldı; satır "Yalnızca seçtiğiniz kişiler", "Kişileri seç" (iOS'un paylaşılan kişiler ekranı açılır, uygulama çökmez) ve "Ayarları aç" gösterir.

Henüz denenmedi (simülatöre yazı girilemediği için sahte yapay zekâ ayarlanamadı; telefonda deneyin):
- [ ] Sahte yapay zekâyla (`node scripts/fake-ai/server.mjs`, Özel sunucu `http://localhost:8793/v1`, model `fake`) "call Ayşe" yazın: ilk aramada Qutai'nin kısa açıklaması, sonra sistem izni; sonra "Ayşe Test" için Ara düğmesi; kartta numara ve "cep · kişilerinizden" yazar. Yapay zekâya giden kayıtta (Yapay zekâya gönderilenler) numara yoktur, yalnızca ad, "mobile" ve `ct-…` tutamacı vardır.
- [ ] "call Ahmet" (iki Ahmet): Qutai'nin kendi listesi açılır, satırlarda ad, etiket ve numara; seçim yapınca Ara düğmesi seçilen kişiye çıkar. Listeyi kapatınca asistan hangisi olduğunu sorar.
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
- [x] Not ekleme (Qutai'nin "Not kaydedildi" bildirimi), arama ("PEYNIR" → "peynir" bulundu; eşleşmeyen aramada boş durum metni), düzenleme, silme (Qutai'nin onay penceresi, "Uygulamadan: Notlarım" satırıyla).
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

Tasarım: `docs/mini-apps.md` › 8. **Yeni yerel derleme gerekir** (iOS'ta `.qutaiapp` dosya türü ve "Qutai'de aç",
Android'de "Birlikte aç" ve WebView yamasındaki uygulama kum havuzu). Deneme dosyaları:
`node --no-warnings --experimental-transform-types --import ./scripts/credits-tests/loader.mjs scripts/app-tests/export-fixtures.ts <klasör> <port>`
(verili notlar, break-out uygulaması, değiştirilmiş ve daha yeni sürümlü dosya); break-out sızıntıları sahte yapay zekâ
sunucusunun `/leaks` listesine düşer (`node scripts/fake-ai/server.mjs <port>`).

Her telefonda denenecekler:
- [ ] Uygulamalarım › uzun basma › Dosya olarak dışa aktar: veri varsa "Verisiz / Verilerimle" sorusu (varsayılan verisiz, verilerin kişisel olabileceği yazıyor); paylaşım sayfası açılır; Dosyalar'a kaydedilir. Uygulama menüsünden de aynı.
- [ ] Uygulamalarım › Uygulama içe aktar: dosya seçici; içe aktarma ekranı: simge, ad, "başka biri yazdı", boyut, izinler sade sözlerle, uyarı, dosya listesi (dokununca kod, yalnızca okunur), veri sayısı ve boyutu ("Verilerini de getir" kapalı).
- [ ] İçe aktarılan uygulama kapalı gelir; açınca onay ekranı aynı özeti gösterir; "Aç" sonrası çalışır.
- [ ] Dosyalar uygulamasında `.qutaiapp` dosyasına dokunmak / paylaş › Qutai: içe aktarma ekranı açılır (Qutai kapalıyken de).
- [ ] Qutai'nin kendi tarayıcısında indirilen `.qutaiapp`: İndirilenler › Aç → içe aktarma ekranı; gizli sekmede indirilen: "Gizli sekmeden uygulama içe aktarılamaz".
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
- Denenmedi: başka telefonda geri yükleme ve sınırı aşan sunucu yedeği (yalnızca birim testleri), Qutai'nin kendi
  İndirilenler'inden içe aktarma, "Yerine koy", Android'de dışa aktarma ve yedek, büyük yazı, ekran okuyucu, koyu tema,
  yatay ekran, gerçek telefon.

## 20. Güvenlik geçişi: şifreler ve kodlar, silme ve hesap onayı, ödeme düğmesi, gizli sekme, ayar aracı, uygulamalar (19 Kasım)

Hazırlık: `node --no-warnings --experimental-transform-types --import ./scripts/credits-tests/loader.mjs scripts/page-tests/serve.mjs`
(sayfa: `http://localhost:8811/guards`) ve sahte yapay zekâ `node scripts/fake-ai/server.mjs 8794` (Özel uç nokta
`http://localhost:8794/v1`, model `fake`; Android'de `adb reverse tcp:8794 tcp:8794` ve `tcp:8811`).

- [x] `/guards` sayfası: 34/34 (masaüstü Chromium ve iOS simülatöründe WebKit). Şifre, maskeli alan, doğrulama kodu,
      `one-time-code`, kart numarası, CVC, gölge DOM'daki özel öğe ve bölünmüş kod kutuları gizli sayılıyor; adet,
      posta kodu, promosyon kodu, telefon, yorum, e-posta sayılmıyor; read_page, form değerleri, betik kopyası değer
      göstermiyor; ödeme, silme ve hesap basışları doğru sınıflanıyor.
- [x] "typepass" (iOS simülatörü): şifre alanına yazma reddedildi, "Qutai şifre veya kod yazmaz" satırı, model
      kullanıcıdan alanı kendisinin doldurmasını istemesi gerektiğini öğreniyor.
- [x] "delete thing" (iOS simülatörü): "Delete" onaysız reddedildi ("Bu değişiklik önce onayınızı gerektirir"), Qutai'nin
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
