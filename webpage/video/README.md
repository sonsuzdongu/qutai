# Qutai tanıtım videoları: dizi şeması

Her özellik için ayrı, kısa bir video; hepsi aynı kalıpta. İzleyen ikinci videoda neyin geleceğini bilir, dizi bir
bütün gibi durur. Sitede her bölüm kendi özelliğinin yanında oynar; sosyal medyada tek tek paylaşılır.

## Kalıp (her bölüm)

| Bölüm | Süre | Ne olur |
|---|---|---|
| 1. Açılış kartı | 2 sn | Bölümün minyatüründen bir kesit (yavaş yakınlaşma) ve tek cümlelik başlık: "Sizi tanır." |
| 2. Görev | 10–20 sn | Uygulamanın gerçek ekran kaydı: kullanıcı bir şey ister, asistan adım adım yapar |
| 3. Vurgu anı | 2–3 sn | Özelliğin kendisini gösteren tek an yakınlaştırılır, üstünde bir rozet: "Hatırlandı" |
| 4. Kontrol anı | 2–4 sn | Qutai'ın önce sorduğu ya da durduğu an (onay, kişisel bilgi sorusu, ödemede durma) |
| 5. Kapanış kartı | 3 sn | Q logosu, bölümün sloganı, "Açık kaynak · Yakında App Store ve Google Play'de" |

Toplam 25–35 sn. Her bölümden 15 sn'lik kısa bir kesit de çıkar (açılış, vurgu anı, kapanış).

"Kontrol anı" her bölümde var: dizinin imzası bu. Qutai iş yapar ama kontrol sizde kalır.

## Görsel dil

- **Biçim:** Ana kayıt dikey (9:16, telefon ekranı). Sitede ve yatay platformlarda 16:9 versiyonu: parşömen zemin
  üzerinde altın çerçeveli telefon, yanında altyazı.
- **Renkler ve yazı:** Sitenin renkleri (parşömen `#f2e7cf`, teal `#2287A5`, altın çizgiler), başlıklarda serif, altyazıda
  sans.
- **Altyazı:** Her zaman var (çoğu kişi sessiz izler). Türkçe ve İngilizce ayrı dosya.
- **Vurgu:** Yakınlaştırma ve teal bir çerçeve; rozetlerde emoji yok, çizgi ikon.
- **Müzik:** Hafif, ritmik, sözsüz; bölüm boyunca aynı. Seslendirme isteğe bağlı; altyazı tek başına yetmeli.

## Kurallar (dürüstlük ve hukuk)

- **Yalnızca gerçek kayıt.** Ekrandaki her şey uygulamanın gerçek bir çalışmasından. Arayüz montajla değiştirilmez;
  yalnızca kırpma, yakınlaştırma, hız ve üstüne eklenen film grafikleri (rozet, altyazı) var.
- **Hızlandırılan yerler belirtilir:** köşede küçük "Hızlandırıldı" etiketi.
- **Birkaç çekim, en iyisi seçilir:** Asistanın davranışı modele göre değişir. Ama sonuç uydurulmaz: o çekimde
  gerçekten olan gösterilir.
- **Demo siteler:** Başka şirketlerin sitelerini ve logolarını kullanmayız. Her bölüm için markasız bir demo site
  (`video/demo-sites/`) kurulur ve kayıt orada yapılır. Böylece her çekim tekrarlanabilir olur. Demo siteler gerçek
  bir site gibi görünür (üstte "demo" yazmaz), ama hayalîdir ve hiçbir şey almaz; bu yüzden filmin kapanışında
  "Restoran ve sipariş sitesi bu kayıt için hazırlanmış bir örnektir." notu bulunur.
- **Demo alan adı:** Kayıtta adres çubuğunda `localhost` görünmesin diye site bir alan adıyla ve https ile açılır
  (varsayılan `www.yourlocalfooddeliveryservice.com`, `DEMO_DOMAIN` ile değişir). Kurulum bir kez yapılır:
  1. `/etc/hosts` dosyasına (sudo ile) `127.0.0.1 www.yourlocalfooddeliveryservice.com yourlocalfooddeliveryservice.com`
     satırı eklenir. Simülatör Mac'in ad çözümlemesini kullandığı için bu satır onda da geçerlidir.
  2. `demo-sites/make-cert.sh [simülatör-udid]`: yerel bir sertifika yetkilisi ve alan adı için sertifika üretir
     (`demo-sites/.certs/`, git'e girmez) ve yetkiliyi yalnızca o simülatöre güvenilir olarak ekler.
  3. Kayıt sırasında `python3 demo-sites/serve.py`: 443'te https, 80'de https'e yönlendirme. macOS normal kullanıcıya
     bu portları yalnızca bütün arayüzlerde açtırır, yani site çalışırken yerel ağdan da görülebilir; kayıt bitince
     durdurulur. Hızlı bakış için `python3 demo-sites/serve.py --port 8090` (http://localhost:8090/).
  Android emülatörü Mac'in `/etc/hosts` dosyasını okumaz ve yerel sertifikaya güvenmez: `python3 demo-sites/dns.py`
  (alan adını 10.0.2.2'ye çevirir, gerisini olduğu gibi iletir; yalnızca bu Mac'ten gelen sorulara yanıt verir),
  emülatörü `-dns-server <Mac'in yerel IP'si>` ile başlatın ve siteyi `python3 demo-sites/serve.py --plain-80` ile
  açın (80. port siteyi http ile verir). Kayıt bitince ikisini de durdurun.
  Alan adı bugün kimseye kayıtlı değil (2026-11-17), ama başkası alabilir; filmler yayımlanmadan önce alan adını
  almak ya da sahibinin kendi alan adını kullanmak daha güvenli.
- **Kişisel veri:** Kayıtta test hesabı ve test hafızası kullanılır; gerçek adres, telefon ve kart yok.
- **Sağlık ve güvenlik:** Diyet veya alerji içeren bölümlerde kapanışa küçük bir not: "Alerjen bilgisini her zaman
  restoranla doğrulayın."
- **Rakip yok:** Videolarda rakip adı ya da görüntüsü geçmez; kıyas sitedeki kaynaklı tabloda kalır.

## Kayıt düzeni

- **Cihaz:** iOS Simülatör ya da gerçek telefon, uygulamanın geliştirme sürümü.
- **Tutarlılık:** Açık tema, büyük yazı boyutu kapalı, saat 9:41, tam pil. Bütün bölümlerde aynı model seçili.
- **Ayarlar:** "Benimle ilgili bilgileri hatırla" açık; reklam engelleme açık.
- **Anahtar:** AI anahtarını uygulamaya sahibi girer.
- **Kayıt:** `xcrun simctl io booted recordVideo` (simülatör) ya da telefonun ekran kaydı. Ham dosyalar
  `video/raw/` klasörüne konur; bu klasör git'e girmez. Simülatör kaydı yalnızca ekran değişince kare yazar; kurgu
  betiği önce sabit 30 kare/sn'ye çevirir.
- **Kurgu:** Her bölümün bir betiği var (`edit_01.py`): ham kayıtlardan 9:16, 16:9 ve 15 sn'lik kesiti, WebM, VTT
  altyazı ve kapak görselini `video/out/` klasörüne üretir (git'e girmez). ffmpeg ve Pillow gerekir.

## Bölümler

| # | Bölüm | Vurgu anı | Kontrol anı |
|---|---|---|---|
| 1 | [Sizi tanır](01-hafiza.md): hafıza ve glutensiz sipariş | "Hatırlanıyor" satırı, sonra kendiliğinden "glutensiz" araması | Kişisel bilgi sorusu, ödemede durma |
| 2 | Sekmeler arası karşılaştırma | "Sekme 2 okunuyor" ve karşılaştırma tablosu | Sepete eklemeden önce onay |
| 3 | Rezervasyon ve takvim | Takvim etkinliği kartı, Ara düğmesi | Takvime yazmadan önce onay |
| 4 | Kaynaklı araştırma | Yanıtın altındaki kaynak kartları | — (yalnızca okuma) |
| 5 | Kendi anahtarınız | Sohbet başına model seçimi | — |
| 6 | Yapay zekâya gönderilenler | İstek listesi: ne, hangi siteden, nereye | — |
