# Qutai: lansman taslakları

20 Kasım 2026. Plan ve kurallar: [launch-plan.md](launch-plan.md). Her taslak, gideceği yerin dilinde. Köşeli
parantezli yerler (`[TestFlight link]`) doldurulacak. Göndermeden önce: sürüm numarası, bağlantılar ve "henüz
mağazada değil" cümlesinin o günkü durumla aynı olduğunu kontrol edin.

**Hacker News uyarısı:** HN kuralları AI ile yazılmış ya da AI ile düzenlenmiş metni yasaklıyor. Aşağıdaki HN
bölümü bu yüzden bitmiş metin değil, söylenecekler listesidir. Başlığı ve ilk yorumu kendi kelimelerinizle,
kendi İngilizcenizle yazın; kusursuz olması gerekmiyor, sizin olması gerekiyor.

---

## 1. Show HN

**Gönderilecek bağlantı:** `https://github.com/sonsuzdongu/qutai`

**Başlık seçenekleri** (80 karakter sınırı; abartı yok):

1. `Show HN: Qutai – open-source mobile browser with an AI agent, bring your own key`
2. `Show HN: An open-source AI browser for iOS and Android that asks before it pays`
3. `Show HN: Qutai – a phone browser whose assistant uses the page, with your own key`

Önerim 1: HN okuru için en önemli üç şey (açık kaynak, mobil, kendi anahtar) başlıkta.

**İlk yorumda söylenecekler** (sırayla, kendi cümlelerinizle):

- Kim olduğunuz: Türkiye'den tek geliştirici, neden yaptınız (bir cümle: telefonda AI'ın sayfayla bir şey
  yapamaması / verinin kime gittiğini bilmemek).
- Ne yaptığı, bir örnekle: iki ürün sekmesini karşılaştırıp ucuzunu sepete eklemesi; her adımı gösterdiği; ödeme,
  paylaşım, silme ve hesap değişikliği için Qutai'ın kendi penceresinde onay beklediği.
- Nasıl denenir: iOS TestFlight `[link]`, Android test `[link]`, ya da kaynaktan derleme (README'deki komut). Kayıt
  gerekmez; Anthropic, OpenAI, Gemini, OpenRouter anahtarı ya da OpenAI uyumlu kendi sunucunuz (Ollama, LM Studio,
  vLLM).
- Veri nereye gidiyor: kendi anahtarla telefondan doğrudan sağlayıcıya; Qutai sunucusu yok. "What was sent to the AI"
  her isteği gösteriyor. Bellek, geçmiş, sohbetler telefonda.
- Nasıl yapıldı: Expo / React Native; iOS'ta WebKit, Android'de sistem WebView, yani kendi motoru yok. Ajan sayfayı
  erişilebilirlik ağacı benzeri bir özetle okuyup ref numaralarıyla dokunuyor (bunu kendi koda bakarak doğru
  anlatın).
- Güvenlik modeli ve dürüst sınır: prompt injection çözülmüş değil. Onay pencerelerini sayfa metni açamıyor; şifre,
  kart, CVV ve tek kullanımlık kod alanlarına yazmayı uygulama reddediyor; betikler varsayılan kapalı. Ama yanlı bir
  özet ya da onay gerektirmeyen yanlış bir adım olabilir. Kötü niyetli sayfa örnekleri gönderen olursa çok sevinirsiniz.
- Durum: 0.1.3, iç testten yeni çıkıyor; çoğu özellik testlerle ve simülatörde doğrulandı, birçok telefonda değil.
- İş modeli, kısaca: uygulama ücretsiz ve Apache-2.0; ileride anahtarı olmayanlar için ücretli "Qutai Credits"
  (sunucudan geçer, içerik saklanmaz) planlanıyor; kendi anahtar yolu kalacak.
- Ne istiyorsunuz: hangi sitede takıldığı, güvenlik eleştirisi, iOS/Android'de çökme raporları. (Oy ya da "destek"
  istemeyin.)

**Sık sorulara hazır cevap notları** (kendi cümlelerinizle):

- "Why a browser and not an extension?" → Mobilde Chrome eklenti almıyor; ajan sekmelere, sekme gruplarına ve onay
  pencerelerine tarayıcının kendisinde ihtiyaç duyuyor.
- "Is the server open source?" → [karar 5'e göre]
- "User-Agent contains qutai.<build>?" → [karar 8'e göre]
- "Why should I trust a browser from one person?" → Kod açık, kendiniz derleyebilirsiniz; kaynaktan derlenen sürüm
  hiçbir Qutai sunucusuna bağlanmıyor.

---

## 2. Product Hunt

**Ad (≤40):** `Qutai`

**Tagline seçenekleri (≤60):**

1. `Open-source AI browser for your phone, with your own key` (57)
2. `A phone browser whose assistant uses the page for you` (53)
3. `AI browser for iOS and Android that asks before it acts` (55)

**Açıklama (≤500):**

> Qutai is an open-source browser for iPhone and Android with an assistant that reads the page and uses it for you.
> Compare products across tabs, fill in forms, book a table and add it to your calendar, or research with sources.
> Every step is shown, and paying, posting, deleting or changing accounts waits for your approval. Use your own key
> (Anthropic, OpenAI, Gemini, OpenRouter or your own server): requests go from your phone to your provider. Early
> beta, Apache-2.0.

(470 karakter.)

**Etiketler (≤3):** Browser, Artificial Intelligence, Open Source

**Bağlantı:** Mağaza sayfası varsa o; yoksa GitHub deposu.

**İlk yorum (maker comment):**

> Hi Product Hunt, I'm [ad], a solo developer from Turkey. I built Qutai because AI on my phone could talk about a
> page but couldn't do anything on it, and I never knew what was being sent where.
>
> What it does today:
> • Open two or three product tabs and ask which one fits. It reads each tab without switching away and answers with
>   a table (also as CSV).
> • "Add the cheaper one to my cart, size 42." It asks before using your saved address on that site. You pay, or you
>   let it pay and approve each payment in Qutai's own window. Card numbers, CVVs, passwords and one-time codes are
>   never typed.
> • Book a table, then add it to your calendar. Deep research with sources, shared as a PDF.
> • It remembers what you tell it (sizes, addresses, diet), on your phone, and you can see and delete every entry.
>
> How your data moves: with your own key, requests go straight from your phone to the provider you chose. "What was
> sent to the AI" lists every request. The whole app is on GitHub under Apache-2.0.
>
> What to know: this is version 0.1.3. Most features are tested in code and on simulators, not yet on many phones.
> Hidden instructions on web pages can still mislead an AI assistant; Qutai makes the risky steps wait for you, but
> read what an approval says before you tap. Paid "Qutai Credits" for people without a key are planned, not live.
>
> I'd love to hear where it got stuck, which sites broke it, and what you'd want it to do next.

**Galeri planı (1270×760, 5 görsel + video):**

1. Telefon çerçevesinde sekme karşılaştırması: "Compare this with my other tab", tablo cevabı. Başlık: "Reads your
   tabs".
2. Ödeme onayı penceresi (site, tutar, sipariş, yöntem). Başlık: "Asks before it pays".
3. "What was sent to the AI" listesi. Başlık: "See every request".
4. Ayarlar › sağlayıcı seçimi (Anthropic / OpenAI / Gemini / OpenRouter / kendi sunucu). Başlık: "Your key, your
   model".
5. Bellek kategorileri ve "Tell me about yourself" incelemesi. Başlık: "Remembers you, on your phone".
6. 60–90 sn demo videosu (aşağıda).

Görsellerde yalnızca gerçek ekran görüntüleri ve markasız demo siteler (`webpage/video/demo-sites/`), sitenin renkleri
ve minyatürleri.

---

## 3. Reddit

Her biri farklı topluluk ve farklı açı. Göndermeden önce o topluluğun kurallar sayfasını okuyun, gereken bayrağı
seçin, bağlantıyı kurallar izin veriyorsa koyun. Aynı gün birden fazla yere göndermeyin.

### r/LocalLLaMA

**Başlık:** `I built an Android/iOS browser whose agent can run on your own Ollama / LM Studio / vLLM server`

> I've been building Qutai, an open-source (Apache-2.0) mobile browser with an assistant that can read pages, tap,
> type and compare tabs. Besides the hosted providers, it takes any OpenAI-compatible endpoint, so you can point it
> at Ollama, LM Studio or vLLM on your own machine. There's a "test connection" button and you can choose the model
> per conversation.
>
> What I'd like to learn from this sub: which local models handle the tool calls well enough for multi-step page
> tasks (clicking, typing, reading a second tab), and where they fall apart. Smaller models will likely struggle
> with long pages; I haven't tested many.
>
> Notes: no cost figure is shown for custom endpoints (tokens only). With your own server nothing goes to any Qutai
> server. It's an early beta (0.1.3), solo project. Repo: [link]. Test builds: [links].

### r/androidapps

**Başlık:** `[DEV] Qutai – open-source browser with an AI assistant that uses the page (bring your own key, beta)`

> Hi, I'm the developer. Qutai is a browser for Android (and iOS) with an assistant built in. Examples of what it
> does: compare two product tabs and give you a table; fill in a booking form and offer to add it to your calendar;
> research a question across many pages and cite the sources.
>
> Android-specific: tasks can keep running in the background (opt-in, with a notification), share to Qutai, a home
> screen widget, picture-in-picture video.
>
> It works with your own key (Anthropic, OpenAI, Gemini, OpenRouter or your own server); requests go straight from
> your phone to that provider. Paying, posting and deleting wait for your approval.
>
> Honest status: beta 0.1.3, solo developer, Apache-2.0. Expect bugs. Join the test: [Play test link]. Source:
> [link]. Feedback and crash reports very welcome.

### r/browsers

**Başlık:** `New open-source mobile browser built around an AI assistant – looking for criticism`

> Qutai is a browser for iOS and Android (WebKit on iOS, the system WebView on Android, built with React Native), so
> it's not a new engine. The point is the assistant: it reads the page and the other tabs, taps and types for you,
> and stops for approval before paying, posting, deleting or changing account settings.
>
> The browser part: tabs and groups, incognito with an optional biometric lock, ad and tracker blocking with
> EasyList / EasyPrivacy / AdGuard lists or your own, reader mode with read aloud, bookmarks in folders with
> Chrome/Firefox/Safari import, encrypted backup instead of sync, background audio.
>
> Known gaps: no sync, no password manager of its own (it relies on the phone's autofill), no extensions. Hidden instructions on pages can still mislead the
> assistant. Beta, solo dev, Apache-2.0: [link]. What would make you switch, and what would stop you?

---

## 4. X / Bluesky dizisi

1. I've been building Qutai: an open-source browser for iPhone and Android with an AI assistant that reads the page
   and uses it for you. Beta, bring your own key. 🧵 [video]
2. Open two product tabs, ask "which one?", get a table. Say "add the cheaper one, size 42" and it does, asking
   before it uses your saved address.
3. Paying, posting, deleting and account changes wait for your tap in Qutai's own window. Words on a web page can't
   approve them. Card numbers, passwords and one-time codes are never typed.
4. Your key: Anthropic, OpenAI, Gemini, OpenRouter or your own Ollama/LM Studio. Requests go from your phone to
   your provider. "What was sent to the AI" lists every request.
5. Honest status: 0.1.3, solo dev, mostly tested in code and simulators. Prompt injection isn't solved; the
   limits are on the site.
6. Code (Apache-2.0): [GitHub]. Test builds: [links]. Tell me where it breaks.

(Bluesky'da 300 karakter sınırı var; her madde sığıyor. X'te emoji kullanmayın ya da yalnızca 🧵.)

---

## 5. Türkçe duyuru (LinkedIn, Türk geliştirici toplulukları, forumlar)

**Başlık seçenekleri:**

1. `Qutai: sayfayı sizin için kullanan açık kaynak bir telefon tarayıcısı (beta)`
2. `Telefonda AI asistanlı tarayıcı yaptım: kendi anahtarınızla, önce sorarak`
3. `Yerli ve açık kaynak bir AI tarayıcısı: Qutai'ı denemek ister misiniz?`

**Metin:**

> Bir süredir Qutai üzerinde çalışıyorum: iPhone ve Android için, içinde yapay zekâ asistanı olan açık kaynak bir
> tarayıcı. Asistan siz istediğinizde sayfayı okuyor ve sizin için kullanıyor.
>
> Neler yapabiliyor:
> • İki üç ürün sekmesini açıp "hangisi daha uygun?" diye sorabilirsiniz; sekmeleri değiştirmeden okuyup fiyat,
>   teslimat ve garantiyi tabloya döküyor.
> • Bir restoran ya da randevu formunu dolduruyor, sonra takvime eklemeyi öneriyor.
> • Birçok sayfa ve PDF okuyup kaynaklarıyla bir rapor yazıyor.
> • Ona söylediklerinizi (beden, adres, beslenme) telefonda saklıyor; her kaydı görüp silebilirsiniz.
>
> Kontrol sizde: ödeme, paylaşım, silme ve hesap değişikliği Qutai'ın kendi penceresinde onayınızı bekliyor. Kart
> numarası, şifre ve tek kullanımlık kod asla yazılmıyor.
>
> Kendi AI anahtarınızla çalışıyor (Anthropic, OpenAI, Gemini, OpenRouter ya da kendi sunucunuz). İstekler
> telefonunuzdan doğrudan seçtiğiniz sağlayıcıya gidiyor, arada Qutai sunucusu yok. Arayüz Türkçe dahil on dilde.
>
> Dürüst durum: sürüm 0.1.3, tek başıma geliştiriyorum. Özelliklerin çoğu testlerle ve simülatörde doğrulandı,
> birçok telefonda henüz denenmedi. Sayfalara gizlenmiş talimatlar bir AI asistanını yanıltabilir; riskli adımlar
> onayınızı bekliyor, ama onay penceresinde ne yazdığını okuyun.
>
> Denemek isterseniz: iOS [TestFlight bağlantısı], Android [Play test bağlantısı]. Kod: github.com/sonsuzdongu/qutai
> (Apache-2.0). Site: qutai.sonsuzdongu.com/tr/
>
> En çok şuna ihtiyacım var: hangi sitede takıldı, Türkçe metinlerde tuhaf gelen bir şey var mı, telefonunuzda
> çöktü mü? Yorumlara ya da GitHub'a yazabilirsiniz.

**Webrazzi / ShiftDelete için kısa not (e-posta veya form):**

> Merhaba, Qutai adında, iPhone ve Android için açık kaynak (Apache-2.0) bir yapay zekâ tarayıcısı geliştiriyorum.
> İçindeki asistan sayfayı okuyup kullanıyor: sekmeleri karşılaştırıyor, form dolduruyor, kaynaklı araştırma
> yapıyor; ödeme, paylaşım ve silme gibi adımlarda onay bekliyor. Kullanıcı kendi AI anahtarını kullanıyor, veriler
> telefondan doğrudan sağlayıcıya gidiyor. Türkiye'den tek kişilik bir proje; arayüz on dilde. [Mağaza
> bağlantıları] · [site] · [basın kiti]. Ekran görüntüleri ve kısa video ektedir. Sorularınızı memnuniyetle
> yanıtlarım.

---

## 6. Kısa basın notu (İngilizce)

> **Qutai, an open-source AI browser for iPhone and Android, opens its beta**
>
> [City], [date]. Qutai is a mobile browser with an assistant at its core: it reads the page and the user's other
> tabs, fills in forms, compares products, books and researches with sources, and remembers what the user tells it,
> on the phone. Paying, posting, deleting and account changes wait for the user's approval in Qutai's own window.
>
> Qutai works with the user's own AI key (Anthropic, OpenAI, Google Gemini, OpenRouter or a self-hosted server), so
> requests go straight from the phone to that provider. A log shows every request sent to the AI. The app is
> available in ten languages and its full source code is published under the Apache License 2.0.
>
> Qutai is built by a solo developer in Turkey. Version 0.1.3 is an early beta; the website lists its known limits,
> including the risk that hidden instructions on web pages mislead an AI assistant.
>
> Links: qutai.sonsuzdongu.com · github.com/sonsuzdongu/qutai · [press kit] · Contact: [address]

---

## 7. Demo videosu (60–90 sn)

Kurallar `webpage/video/README.md`'deki gibi: yalnızca gerçek kayıt, markasız demo siteler, hızlandırılan yerde
"Hızlandırıldı" etiketi, her zaman altyazı. Dikey 9:16 ana kayıt, PH ve YouTube için 16:9.

| Zaman | Ekran | Altyazı |
|---|---|---|
| 0–4 sn | Q logosu, minyatürden kesit | "A browser whose assistant uses the page for you." |
| 4–20 sn | Ayakkabı sayfası, ikinci sekme. Kullanıcı yazar: "Compare this with my other tab and add the cheaper one, size 42." "Reading tab 2" adımları, kenarda ışık | "It reads your tabs." |
| 20–30 sn | Tablo cevabı; "Add to cart" için onay penceresi, kullanıcı Allow'a basar | "It asks before it acts." |
| 30–42 sn | Ödeme sayfası: kişisel bilgi izni sorusu, adres yazılır, "Pay €64.90 on shop.example?" penceresi; kullanıcı bakar | "Paying waits for you. Card numbers are never typed." |
| 42–55 sn | Restoran formu doldurulur → "Calendar event: Dinner, Friday 20:00" onayı | "Book it, then put it in your calendar." |
| 55–68 sn | Ayarlar › sağlayıcı seçimi → "What was sent to the AI" listesi | "Your key. Every request listed." |
| 68–80 sn | GitHub sayfası, Apache-2.0 | "Open source. Early beta." |
| 80–90 sn | Q logosu, bağlantı, "iPhone & Android · beta" | — |

Türkçe sürüm aynı akış, altyazılar sitedeki Türkçe metinlerden ("Sekmelerinizi okur", "Önce sorar", "Kendi AI
anahtarınız").

---

## 8. r/droidappshowcase (26 Kasım 2026)

r/androidapps kendini tanıtma için bu topluluğu öneriyor. Kurallar sayfası bu ortamdan açılamadı. Bir ayna sayfasında
(Şubat 2026, [r.datuan.dev](https://r.datuan.dev/r/droidappshowcase)) şu yazıyor: başlık kısa ve açıklayıcı olsun,
gönderiden sonra doğru flair seçilsin, görseller doğrudan Reddit'e (ya da Imgur'a) yüklensin. Göndermeden önce kenar
çubuğunu okuyun; bağlantıların gövdede mi, yorumda mı istendiğine bakın.

**Vurgu (sahibin 26 Kasım notu):** Qutai'ın asıl gücü sekme karşılaştırması değil, formları doldurması ve
tarayıcıyı sizin yerinize kullanarak görevleri bitirmesi; bir de sizi hatırlaması. Gönderi buna göre kuruldu. Hikâye:
Claude in Chrome'u çok beğendiniz, mobilde karşılığını bulamadınız, en büyük rakip Comet de zayıf kaldı. Comet
cümlesi sizin kişisel deneyiminiz olarak yazıldı, olgu iddiası olarak değil; Reddit'te rakip kötülemek ters
tepebilir, o yüzden tek cümlede bırakın.

**Biçim:** Galeri gönderisi (5 ekran görüntüsü, doğrudan Reddit'e yüklenir) ve altında gövde metni. Görseller
Android'den, sırayla:

1. Bir form doldurulurken: alanın etrafındaki halka ve alttaki adım satırı ("Typing into …"), yanında Stop
2. "Enter your personal information on …?" sorusu (bir kez / her zaman / asla)
3. Qutai'ın yazdığı küçük bir uygulama: önizleme ya da yeni sekme sayfasındaki "My apps"
4. Ayarlar › Hafıza: kategorilere ayrılmış kayıtlar (test bilgileriyle)
5. Q'ya basılı tutarak sesli görev verme (dinleme anı)

Ekran görüntülerinde demo siteler ve test hesabı kullanın; gerçek adres, kart ya da bildirim görünmesin.

**Başlık seçenekleri:**

1. `Qutai – an AI agent that works in your mobile browser: it fills in forms and does tasks for you (open source)`
2. `I built an AI agent that lives in your phone's browser and does the tapping and typing for you`
3. `An open-source AI agent in a mobile browser, like Claude in Chrome but on your phone`
4. `I loved Claude in Chrome but found nothing like it on my phone, so I built Qutai: an open-source mobile browser that fills in forms and does tasks for you`

Önerim 1: "mobil tarayıcıda çalışan bir yapay zekâ ajanı" fikrini en kısa ve net söyleyen seçenek; ne yaptığını
(form, görev) ve açık kaynağı da içeriyor. 2 daha kişisel ve Reddit'in "ben yaptım" diline yakın. 3, Claude in
Chrome'u bilen okura ne olduğunu tek bakışta anlatır; ama başka bir ürünün adını başlıkta kullanmak bazı
topluluklarda reklam gibi algılanabilir. 4 önceki önerim, hikâyeyi başlıkta anlatıyor ama uzun.

**Gövde:**

> Hi! I'm the developer.
>
> I really liked Claude in Chrome on my computer: you give it a task and it does it in your browser. On my phone I
> couldn't find anything like it. The closest, Perplexity's Comet, felt weak when I tried it. So I built Qutai, a
> free, open-source (Apache-2.0) mobile browser with an assistant that uses the browser for you. It's on Google Play,
> and in beta on iPhone through TestFlight.
>
> Tap the Q in the address bar, or hold it and talk, and give it a task in your own words. It taps, types, picks
> options, scrolls and opens tabs, one visible step at a time: a ring marks the field it's about to type into, a
> line at the bottom says what it's doing, and you can stop it any time.
>
> What I use it for:
>
> - **Forms.** "Fill in this form with my details." It fills the fields, picks the options and fixes the errors the
>   form reports. Sign-ups, applications, contact forms, delivery details.
> - **Posting for you.** Comments, reviews and contact messages: it shows you the exact text and the button it will
>   press, and presses it once you say yes.
> - **Repeat jobs.** Save a request as a task and run it by name. On Android a task can keep working in the
>   background if you turn that on, with a notification when it's done or needs you.
> - **Vibe coding, inside the browser.** "Make me an app where I can keep my notes." Qutai writes it, opens a
>   preview, fixes its own errors and changes it when you ask, keeping earlier versions so you can go back. Your apps
>   wait in My apps on the new tab page. Each runs sealed off from your browsing: no internet, no other sites'
>   cookies, its data on the phone. You can share an app as a file.
> - **Orders and bookings.** It fills the cart and the checkout form; you pay, or approve each payment in Qutai's own
>   window. It books a table and offers to put it in your calendar.
>
> **It remembers you, on your phone.** Tell it once, by voice or by typing: your addresses, sizes, diet, budget,
> how you like answers. It sorts what it learns into categories and uses it in later tasks without asking again, so
> each task needs less explaining. Before your name, address or phone go into a site, it asks whether that site may
> have them: once, always or never. You can see, edit and delete every memory in Settings, and lock one so the AI
> only sees a label. Passwords, card numbers, one-time codes and IBANs are never kept, even if you ask.
>
> It's also a normal browser: tabs and groups, incognito tabs with a biometric lock, ad and tracker blocking,
> reader mode with read aloud, bookmark folders with Chrome import, an encrypted backup.
>
> Two ways to pay for the AI:
>
> - **Qutai Credits:** sign in and buy credits in the app, no key to manage. Requests pass through my server, which
>   doesn't store or log them.
> - **Your own key:** Anthropic, OpenAI, Gemini, OpenRouter, or your own server (Ollama, LM Studio). Requests then go
>   straight from your phone to that provider, no account needed.
>
> Either way, "What was sent to the AI" in Settings lists every request: which site, which model, what went with it.
>
> Honest bits: it's young (0.1.34), so expect rough edges. How well a task goes depends on the
> model and the site. Hidden instructions on web pages can still mislead any AI assistant: paying, posting,
> deleting and account changes always wait for your tap, but read what an approval says before you tap.
>
> Apps have no internet and no phone features such as the camera or location yet.
>
> I'd love to hear which forms and tasks it gets stuck on, and what's missing before you'd use it every day.
>
> Google Play: https://play.google.com/store/apps/details?id=com.sonsuzdongu.qutai
> iPhone beta (TestFlight): https://testflight.apple.com/join/q6QvR9Wx
> Source: https://github.com/sonsuzdongu/qutai
> Website: https://qutai.sonsuzdongu.com

**Sonrası:** Gönderiden hemen sonra flair seçin. İlk 2–3 saat yorumlara kendiniz cevap verin. Aynı gün aynı metni
başka bir topluluğa atmayın. Metni kendi sesinize göre değiştirin: Reddit, AI ile yazılmış gibi duran metinlere
sert tepki veriyor.
