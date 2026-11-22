import type { LegalDocument, LegalKind, LegalLanguage } from './documents';

/**
 * The privacy policy and terms of the pro-mode builds (accounts, Qutai Credits, buying credits: `accountsEnabled`).
 * Builds without pro mode show `documents.ts` unchanged. Written from what the app and the server actually do
 * (README.md › Accounts, › Qutai Credits; backend/README.md › Purchases); have them checked by a lawyer before the
 * store release (TODO.md › Legal).
 */
export const PRO_LEGAL_UPDATED = '2026-11-21';

export const PRO_DOCUMENTS: Record<LegalLanguage, Record<LegalKind, LegalDocument>> = {
  en: {
    privacy: {
      title: 'Privacy Policy',
      intro:
        'Qutai is a web browser with an AI assistant. We built it so your browsing stays on your phone. Qutai’s own ' +
        'server is used only for your Qutai account (sign-in, Qutai Credits, purchases in the app and backups), and only ' +
        'when you choose them. We do not sell your data, and Qutai has no tracking or advertising; anonymous usage ' +
        'statistics are sent only if you allow them.',
      sections: [
        {
          heading: 'Who we are',
          body:
            'Qutai is made by Osman Yuksel (“we”), who is responsible for the data described in this policy. For ' +
            'questions about your privacy, or to ask for a copy or the deletion of what Qutai’s server keeps about ' +
            'you, write to qutai@sonsuzdongu.com.',
        },
        {
          heading: 'What stays on your phone',
          body:
            'Your tabs, history, bookmarks, saved pages, downloads, site permissions, the assistant’s memory, its ' +
            'action history and your conversations are stored only on this device, also when you are signed in, unless ' +
            'you back them up to your Qutai account (below). API ' +
            'keys and your sign-in are kept in the phone’s encrypted storage. Incognito tabs save nothing on the phone except files you download from them; their ' +
            'conversations are not saved.',
        },
        {
          heading: 'What leaves your phone, and to whom',
          body:
            '• Websites you visit receive what any browser sends them, and the details you ask the assistant to type ' +
            'into them (such as your name or address in a form).\n• With your own API key, your message and the ' +
            'content the assistant needs (the page text, screenshots when it looks at a page, files and images you ' +
            'attach, the result of a script you approved on a page, when you ask about cookies their names, sites and settings but never their values, your memory ' +
            'and custom instructions) go directly to the AI provider you chose (Anthropic, ' +
            'OpenAI, Google, OpenRouter or your own server). Qutai’s server is not involved. Your calendar events and your location are sent only after you confirm, each time, unless ' +
            'you chose “Don’t ask again” for them (you can undo this in Settings › Assistant › ' +
            '“Allowed without asking”); in conversations with incognito tabs they are never used.\n• With Qutai Credits, the same content goes to ' +
            'Qutai’s server first, which passes it to the AI provider (Anthropic, OpenAI or Google) under Qutai’s own ' +
            'account and sends the answer back. Qutai’s server does not store or log this content. The app asks ' +
            'before you use Qutai Credits for the first time.\n• If web search is on, the AI provider may run searches ' +
            'for you. The providers’ privacy policies and terms apply to what they receive.\n• If search suggestions ' +
            'are on, what you type in the address bar is sent to your search engine (never from incognito tabs).\n• If ' +
            'you tap “Use my location” in setup, your approximate position is sent to the phone’s address service ' +
            '{{ios:(Apple’s)|android:(usually Google’s)|web:(Apple’s on an iPhone; on Android usually Google’s)}} to find the name of the place. Only the place name ' +
            'is kept.\n• If you speak to the assistant and the phone can’t recognise that language on the device ' +
            'itself, the audio goes to the phone’s speech service {{ios:(Apple’s)|android:(usually Google’s)|web:(Apple’s or Google’s)}}, only after you have agreed ' +
            'once in Qutai and never in incognito conversations. Qutai and the AI service receive only the text.\n• ' +
            'When the assistant shows you options as cards, their pictures are loaded from the sites (or the sites’ image servers) that show them, without your cookies, also for options you don’t open; in incognito conversations only when you tap “Show images”.\n• ' +
            'While “Block ads and trackers” is on, the filter lists you chose are downloaded from their publishers ' +
            '(such as EasyList and AdGuard) and updated every few days. These requests contain nothing about your ' +
            'browsing.\n• ' +
            'If you report an answer or an app (⋮ › Report), the report goes to Qutai’s server: the reason, your note, the answer’s text or the app’s name and code only if you leave “Include” ticked, whether the answer came from Qutai Credits or your own key, the app version, the phone’s system and the app’s language, and your account if you are signed in. Reports are kept 180 days and are used only to find and fix harmful answers and apps.',
        },
        {
          heading: 'Your Qutai account',
          body:
            'An account is optional; you need one only for Qutai Credits, purchases in the app and backups in your ' +
            'account. You sign in with Apple, with Google or with your email address. With email, we send a message ' +
            'with a one-time code and a link to the address you enter, through our email service (Mailjet); the code ' +
            'works for 10 minutes and only on the phone that asked for it, and to prevent abuse the server counts how ' +
            'many codes are sent to each address and phone. Qutai’s server keeps: an account number; the sign-in ' +
            'methods the account has (Apple, Google, email) and the email addresses that come with them (with Apple ' +
            'this can be a private relay address); when the account was created and last used; your signed-in devices ' +
            '(a random device id, not your phone’s identifiers); and your credits: the balance, purchases and credits ' +
            'added, and for each assistant request the model, the number of tokens, what it cost and when. It does ' +
            'not keep your messages, pages or answers.',
        },
        {
          heading: 'Backups in your Qutai account',
          body:
            'Only if you choose it (Settings › Backup), Qutai’s server keeps your backup file: the same data as a backup ' +
            'you export (bookmarks, history, the assistant’s memory, saved tasks, site settings and preferences; open ' +
            'tabs, conversations, activity and AI keys only if you include them). It is encrypted on your phone with a ' +
            'password you choose before it is sent; Qutai cannot read it and cannot recover the password, which is kept ' +
            'only on your phone. With each backup the server also keeps when it was made, its size, the app version and ' +
            'the kind of phone {{ios:(for example “iPhone · iOS 26”)|android:(for example “Android 16”)|web:(for example “iPhone · iOS 26”)}}. The newest backups are kept (3 at present) and older ones ' +
            'are deleted; you can delete them at any time, and deleting your account deletes them.',
        },
        {
          heading: 'Purchases in the app',
          body:
            'Qutai Credits and anything else sold in the app are bought through {{ios:the App Store|android:Google Play|web:the App Store or Google Play}}; your payment details stay with {{ios:Apple|android:Google|web:Apple or Google}} and never reach Qutai. A payments service (RevenueCat) ' +
            'receives your Qutai account number and the store’s purchase record so the purchase can be confirmed, ' +
            'added to your account and restored on another phone. Qutai keeps a record of each purchase (store, ' +
            'transaction, product, credits, price paid and dates), which tax law requires us to keep, also after the ' +
            'account is deleted, without the link to you. Refunds are handled by {{ios:Apple|android:Google|web:Apple or Google}} under their own ' +
            'rules.',
        },
        {
          heading: 'Qutai’s server and who else processes data',
          body:
            'Qutai’s server runs on Cloudflare, which also stores the backups. Like any server, it sees your IP ' +
            'address with each request; it uses it only to limit how many requests can be made, and Qutai’s own logs ' +
            'never contain your IP address, email address, messages, pages or sign-in tokens (they hold a request id, your ' +
            'account number, what was asked for, how long it took and, for assistant requests, the model, tokens and ' +
            'cost). The companies that process data for Qutai, each under its own privacy policy, are: Cloudflare ' +
            '(the server), {{ios:Apple (sign-in and the App Store), Google (sign-in)|android:Google (sign-in and Google Play), Apple (sign-in)|web:Apple and Google (sign-in and the stores)}}, Mailjet (sign-in emails), RevenueCat ' +
            '(purchases) and, with Qutai Credits, Anthropic, OpenAI and Google (the AI). We share your data with no ' +
            'one else, except when the law requires it (for example a court order) or to protect Qutai and its users ' +
            'against fraud and abuse.',
        },
        {
          heading: 'How long data is kept',
          body:
            'On your phone: until you delete it or uninstall Qutai. On Qutai’s server: your account, its sign-in ' +
            'methods, devices and credit history until you delete the account; backups as described above; sign-in ' +
            'codes until they are used or expire; purchase records as long as tax law requires, without the link to ' +
            'you once the account is deleted.',
        },
        {
          heading: 'Anonymous usage statistics (only if you allow them)',
          body:
            'Qutai asks you once whether it may send anonymous usage statistics. Nothing is sent unless you tap Allow, and ' +
            'you can change your answer at any time in Settings › Privacy and security. If you allow it, the app sends ' +
            'Qutai’s server a few fixed facts: which features are used, that setup was finished, that an assistant task ' +
            'finished or failed (with only the kind of error, such as a network error), and that the screen for buying ' +
            'credits was opened, together with the app version, {{ios:that it is an iPhone|android:that it is Android|web:the ' +
            'kind of phone}}, the app’s language and a random number made for this on your phone. That number is not linked ' +
            'to your account, your sign-in or any other identifier, and it is deleted when you turn the setting off; the ' +
            'server keeps only a shortened, scrambled form of it. Nothing is sent from incognito tabs or conversations, and ' +
            'never web addresses, page content, searches, what you write or the assistant’s memory. Qutai uses no advertising ' +
            'identifier and does not track you across apps or websites. The statistics are stored by Cloudflare and kept for ' +
            'three months.',
        },
        {
          heading: 'Checking requests and preventing misuse',
          body:
            'To protect Qutai Credits from misuse, when you sign in and when the assistant uses Qutai Credits the app asks ' +
            '{{ios:Apple’s App Attest service|android:Google Play’s integrity service|web:Apple’s App Attest service on an ' +
            'iPhone or Google Play’s integrity service on Android}} to confirm that the request comes from the genuine Qutai ' +
            'app on a real device, and sends that confirmation to Qutai’s server. {{ios:Apple receives a key made for this on ' +
            'your phone and a digest of the request; Qutai’s server keeps the key’s public part and a counter, not linked to ' +
            'your account, and deletes them after 180 days without use.|android:Google receives a digest of the request and ' +
            'checks the app and the device; Qutai’s server keeps only the result, with your signed-in session, for up to an ' +
            'hour.|web:Apple or Google receives a digest of the request; Qutai’s server keeps only what it needs to check it, ' +
            'not linked to your account.}} The check never includes the content of your requests. Qutai’s server also counts, ' +
            'per day, how many requests were refused by its limits or failed this check, and for each account how often that ' +
            'happened; these counts are kept for 30 days. An account can be marked for a person at Qutai to review (for ' +
            'example after many refused requests, or a refund of credits that were already spent); a mark never blocks ' +
            'anything by itself and is deleted with the account.',
        },
        {
          heading: 'Your contacts',
          body:
            'If you allow it, the assistant can find a person you name (for example “call James”) in your phone’s ' +
            'contacts. Qutai looks up only names you say yourself, on your phone; your address book is never uploaded ' +
            'or listed. The AI service receives only the names that match and the kinds of number or address each ' +
            'has (such as “mobile” or “work email”), never the numbers or addresses themselves: you see those on the ' +
            'button or draft, and you call or send yourself. Numbers and addresses from your contacts are not saved ' +
            'with your conversations, the assistant’s memory or your backups. Contacts are not used in conversations with incognito ' +
            'tabs. You can change the permission in Settings.',
        },
        {
          heading: 'Blocking, page styles, scripts and apps',
          body:
            'Blocking ads, trackers and video ads happens on your phone: the filter lists are downloaded to the phone ' +
            '(see above) and each page’s requests are checked against them there, so nothing about the pages you ' +
            'visit goes to the lists’ publishers or to Qutai. “Hide cookie banners” only hides the banners; it never ' +
            'accepts or refuses cookies for you. Your own rules, kept styles and kept scripts are stored only on the ' +
            'phone and, if you make one, in your backups (the file you export, or the backup in your Qutai account), ' +
            'encrypted with your password. When the assistant writes a style or a script, the AI service receives ' +
            'your request and the page content it needs, as with any question, and the result of a script you ' +
            'approved goes to it too; Qutai refuses scripts that touch cookies, and a script’s result is never kept ' +
            'in the assistant’s memory, in backups or in the action history. Apps inside Qutai are stored only on the ' +
            'phone and, if you include them, in your backups. When you ask Qutai to make or fix an app, its code and ' +
            'its error messages go to the AI service; what you save in an app never does. Apps cannot reach the ' +
            'internet or see websites or their cookies.',
        },
        {
          heading: 'Passwords and payment details',
          body:
            'Qutai doesn’t let the assistant’s memory keep passwords, card numbers, card security codes, card ' +
            'expiry dates, one-time codes or bank account numbers (IBAN). ID and passport numbers can be kept only ' +
            'under identity or travel; they are hidden from the AI service, which sees only a label, and Qutai types ' +
            'the number into a site itself after you confirm. Before the assistant first enters your saved personal ' +
            'details on a site, Qutai asks you (you can change this for each site). You can also require your ' +
            'confirmation before every action, and block the assistant on sites of your choice.',
        },
        {
          heading: 'Your control',
          body:
            'You can view and delete the assistant’s memory, clear history, cookies and other data in Settings, and ' +
            'remove your API keys at any time. You can delete your backups from Qutai’s server in Settings › Backup. ' +
            'You can stop using Qutai Credits, sign out, or delete your account in Settings › Account: deleting it ' +
            'removes the account, its balance and its history from Qutai’s server (purchase records stay without the ' +
            'link to you, as above) and asks the payments service to delete its record of you. You can also write to ' +
            'qutai@sonsuzdongu.com to ask for a copy of what Qutai’s server keeps about you, or for its correction or ' +
            'deletion. Uninstalling Qutai deletes everything it stored on the phone, except files you saved ' +
            'outside it, such as {{ios:files you saved to the Files app|android:downloads in Android’s Downloads folder|web:downloads in Android’s Downloads folder or in the Files app on an iPhone}} and pictures saved to your ' +
            'photos.',
        },
        {
          heading: 'Security',
          body:
            'Connections to Qutai’s server use HTTPS. Sign-in tokens are kept on the server only in hashed form and ' +
            'on your phone in its encrypted storage, and backups are encrypted on your phone before they are sent.',
        },
        {
          heading: 'Children',
          body:
            'Qutai is not directed at children under 13, and we do not knowingly collect data from them. In some ' +
            'countries you must be older (for example 16) to agree to this policy yourself; below that age a parent ' +
            'or guardian must agree for you.',
        },
        {
          heading: 'Changes',
          body: 'If this policy changes, Qutai shows the new version and asks you to accept it before you continue.',
        },
      ],
    },
    terms: {
      title: 'Terms of Use',
      intro: 'By using Qutai you agree to these terms. Please read them together with the Privacy Policy.',
      sections: [
        {
          heading: 'Two ways to use the assistant',
          body:
            '• Your own API key: using it is an agreement between you and that provider. Its terms, privacy policy ' +
            'and prices apply, and you are responsible for your account there and every cost billed to your key; ' +
            'Qutai is not a party to that agreement and cannot refund those costs.\n' +
            '• Qutai Credits: the assistant’s requests go through Qutai’s server and are paid with credits from your ' +
            'Qutai account. You need an account to use them.',
        },
        {
          heading: 'Qutai Credits',
          body:
            'Credits are bought in the app through {{ios:the App Store|android:Google Play|web:the App Store or Google Play}}, at the price the store shows, and are ' +
            'added to your Qutai account once the purchase is confirmed. They pay only for the assistant’s requests in ' +
            'Qutai, at the credit prices shown for each model; what each answer cost is shown under it. A request first ' +
            'holds the most it could cost and gives back what it did not use. Credits belong to your Qutai account, can ' +
            'be used on any phone you sign in on, cannot be transferred or exchanged for money, and are not refunded ' +
            'except where the law or the store’s refund rules require it; refunds are handled by {{ios:Apple|android:Google|web:Apple or Google}}. If a ' +
            'purchase is refunded, its credits are taken back, which can make the balance negative until you top it up. ' +
            'Credits do not expire. Models, credit prices and limits can change; the current ones are shown in the app before you use them. ' +
            'Qutai Credits can be paused for maintenance or be unavailable at times.',
        },
        {
          heading: 'Your account',
          body:
            'Keep your sign-in (Apple, Google or your email) secure; what is done with your account is your responsibility. We may ' +
            'suspend an account that breaks these terms. If you delete your account, its remaining credits are lost.',
        },
        {
          heading: 'Qutai is a browser',
          body:
            'Qutai shows websites that other people run. We do not control, check or endorse websites, their content, ' +
            'or the products and services they offer, and we are not responsible for them. Websites and their content ' +
            'belong to their owners. Each website’s own terms and the law apply when you use it, and you are ' +
            'responsible for following them. Links, search results and suggestions, including the assistant’s, are ' +
            'not recommendations from us.',
        },
        {
          heading: 'The assistant acts on your behalf',
          body:
            'The assistant can read pages, click, type, fill in forms and prepare posts, messages and orders when you ' +
            'ask it to. Before it posts or submits text on a site, Qutai asks for your approval. Completing a payment ' +
            'is off until you turn on “Let the assistant complete payments” in Settings › Assistant; even then, each ' +
            'payment needs your approval in Qutai’s own dialog, which shows the total. AI can make mistakes: check ' +
            'what you are approving, and review purchases, bookings, payments, posts, messages, deletions, account ' +
            'changes and other important actions before they are completed. You are responsible for the actions you ' +
            'ask for or approve, as if you had taken them yourself. Your purchases and other dealings with websites, ' +
            'sellers and other people are between you and them: Qutai is not a party to them and never handles your ' +
            'payments to them. You can require confirmation before every action in Settings, and block the assistant ' +
            'on sites of your choice.',
        },
        {
          heading: 'AI answers',
          body:
            'Answers, summaries, translations and anything else the AI writes can be wrong, incomplete or out of ' +
            'date. They are not professional advice, for example medical, legal, financial or tax advice: for such ' +
            'matters, ask a qualified professional. Check important information before you rely on it.',
        },
        {
          heading: 'Blocking ads and trackers',
          body:
            'Blocking ads and trackers, hiding cookie banners and blocking video ads are features you choose: you can ' +
            'turn each one off in Settings › Privacy and security, and turn blocking off for one site in its sheet ' +
            '(“Block video ads” is off until you turn it on). Blocking works only in the pages you open on your ' +
            'phone; it does not change websites themselves. The filter lists are made by third parties under their ' +
            'own licences (for example EasyList under GPLv3 or CC BY-SA 3.0, and AdGuard under GPLv3); your phone ' +
            'downloads them from their publishers, and Settings shows each list’s home page and licence. We do not ' +
            'guarantee what is or is not blocked: lists can block too much or too little, and a site may break, show ' +
            'less, or ask you to turn blocking off. Whether to use blocking on a site is your decision, and that ' +
            'site’s terms apply to your visit.',
        },
        {
          heading: 'Page styles and scripts',
          body:
            'You can ask the assistant to change how a page looks (a style) or to run a script on a page, keep them ' +
            'for a site, and write, edit, import and export them yourself. Scripts are off until you turn them on in ' +
            'Settings › Assistant. Qutai shows each style and script the assistant writes and runs it only after you ' +
            'approve it, and imported scripts stay off until you approve them. Styles and scripts run only in pages ' +
            'you open, on your phone. Qutai refuses some risky code, but it does not review code that you write, edit ' +
            'or import, and it cannot guarantee what any code does: a script runs with your sign-in on that site, can ' +
            'change or break the page, and can affect your account there. Approve only what you understand and trust. ' +
            'You are responsible for the styles and scripts you approve, keep, import or share.',
        },
        {
          heading: 'Apps inside Qutai',
          body:
            'Apps inside Qutai are written by the AI at your request. They run sealed off from the internet and from ' +
            'websites, but they are not tested or reviewed by us and come with no warranty: an app can have mistakes ' +
            'or lose the data saved in it, so export or back up anything important. Apps you import from a file can ' +
            'come from anyone and are not reviewed by us; Qutai shows you what an imported app is and what it may use ' +
            'before you turn it on. You are responsible for the apps you turn on and the apps you share with others.',
        },
        {
          heading: 'Downloads and installing files',
          body:
            'You decide what to download, open and install. Qutai warns you before it downloads files that can ' +
            'install or run code, but it does not scan files for viruses or other harm. {{ios:Qutai never installs anything itself. Downloaded files can harm|android:Opening a downloaded app (an APK file) hands it to the system installer; Qutai never installs anything itself. Files and apps from outside Google Play can harm|web:On Android, opening a downloaded app (an APK file) hands it to the system installer; Qutai never installs anything itself. Files and apps from outside the App Store and Google Play can harm}} your phone or your data; downloading, ' +
            'opening and installing them is your responsibility, as is having the right to do so.',
        },
        {
          heading: 'Acceptable use',
          body:
            'Do not use Qutai, Qutai Credits, the assistant, styles, scripts or apps to:\n' +
            '• break the law or other people’s rights, such as their privacy, copyright or trademarks;\n' +
            '• break the terms of websites or AI providers;\n' +
            '• get around passwords, access controls, paywalls, copy protection (DRM) or other technical protection;\n' +
            '• collect, track or publish other people’s personal data unlawfully;\n' +
            '• send spam, create fake accounts or reviews, post or act in bulk automatically, or overload websites;\n' +
            '• deceive or defraud anyone, or spread malware;\n' +
            '• misuse, attack or overload Qutai’s server.\n' +
            'We may suspend an account used in these ways.',
        },
        {
          heading: 'No warranty and limits of liability',
          body:
            'Qutai is provided “as is” and “as available”. We work to make it useful and safe, but we do not promise ' +
            'that it will always work, be free of errors, block what you expect or work with every website, and we ' +
            'give no warranties beyond those the law requires. To the extent the law allows, we are not liable for ' +
            'losses caused by websites and their content, by other people, by AI providers’ services, by filter ' +
            'lists, by styles, scripts and apps you approve or import, or by actions you asked for or approved, nor ' +
            'for indirect losses such as lost profits. Nothing in these terms limits liability for intent or gross ' +
            'negligence, for death or personal injury, or any other liability that the law does not allow to be ' +
            'limited or excluded.',
        },
        {
          heading: 'Your rights as a consumer',
          body:
            'If you use Qutai as a consumer, you keep every right that the law where you live gives consumers and ' +
            'that cannot be waived by contract, such as your rights under Turkish consumer law (Law No. 6502 on ' +
            'Consumer Protection) and the consumer law of the European Union and the European Economic Area. Nothing ' +
            'in these terms limits or excludes those rights; where a term conflicts with them, those rights apply.',
        },
        {
          heading: 'Changes',
          body: 'If these terms change, Qutai shows the new version and asks you to accept it before you continue.',
        },
      ],
    },
  },
  tr: {
    privacy: {
      title: 'Gizlilik Politikası',
      intro:
        'Qutai, yapay zekâ asistanı olan bir web tarayıcısıdır. Gezinmeniz telefonunuzda kalsın diye tasarlandı. Qutai’ın ' +
        'kendi sunucusu yalnızca Qutai hesabınız (oturum açma, Qutai Kredileri, uygulama içi satın alma ve yedekler) ' +
        'için, yalnızca siz bunları seçtiğinizde kullanılır. Verilerinizi satmayız; Qutai’da izleme veya reklam yoktur, ' +
        'anonim kullanım istatistikleri yalnızca siz izin verirseniz gönderilir.',
      sections: [
        {
          heading: 'Biz kimiz',
          body:
            'Qutai’ı Osman Yuksel (“biz”) geliştirir ve bu politikada anlatılan verilerden o sorumludur. ' +
            'Gizliliğinizle ilgili sorularınız için ya da Qutai’ın sunucusunun sizinle ilgili sakladıklarının bir ' +
            'kopyasını veya silinmesini istemek için qutai@sonsuzdongu.com adresine yazın.',
        },
        {
          heading: 'Telefonunuzda kalanlar',
          body:
            'Sekmeleriniz, geçmişiniz, yer imleriniz, kaydedilen sayfalar, indirilenler, site izinleri, asistanın ' +
            'hafızası, işlem geçmişi ve sohbetleriniz, oturum açmış olsanız da yalnızca bu cihazda saklanır; bunları ' +
            'Qutai hesabınıza yedeklemeyi seçerseniz yedek sunucuda da tutulur (aşağıda). API ' +
            'anahtarları ve oturumunuz telefonun şifreli deposunda tutulur. Gizli sekmeler, onlardan indirdiğiniz dosyalar dışında telefona hiçbir şey kaydetmez; ' +
            'sohbetleri kaydedilmez.',
        },
        {
          heading: 'Telefonunuzdan çıkanlar ve kime gittiği',
          body:
            '• Ziyaret ettiğiniz siteler, her tarayıcının gönderdiği bilgileri ve asistandan o siteye yazmasını ' +
            'istediğiniz bilgileri (örneğin bir formdaki adınızı veya adresinizi) alır.\n• Kendi API anahtarınızla, ' +
            'mesajınız ve asistanın ihtiyaç duyduğu içerik (sayfa metni, sayfaya baktığında ekran görüntüleri, ' +
            'eklediğiniz dosya ve görseller, bir sayfada onayladığınız bir betiğin sonucu, çerezleri sorduğunuzda adları, siteleri ve ayarları ama hiçbir zaman ' +
            'değerleri, hafızanız ve özel talimatlarınız) doğrudan seçtiğiniz yapay zekâ ' +
            'sağlayıcısına (Anthropic, OpenAI, Google, OpenRouter veya kendi sunucunuz) gider. Qutai’ın sunucusu ' +
            'araya girmez. Takvim etkinlikleriniz ve konumunuz, bunlar için “Bir daha sorma”yı seçmediyseniz ' +
            'yalnızca her seferinde onayladığınızda gönderilir (bunu Ayarlar › Asistan › “Sormadan ' +
            'izin verilenler”den geri alabilirsiniz); gizli sekmelerin yer aldığı sohbetlerde hiç ' +
            'kullanılmaz.\n• ' +
            'Qutai Kredileriyle aynı içerik önce Qutai’ın sunucusuna gider; sunucu onu Qutai’ın kendi hesabıyla ' +
            'yapay zekâ sağlayıcısına (Anthropic, OpenAI veya Google) iletir ve yanıtı geri gönderir. Qutai’ın ' +
            'sunucusu bu içeriği saklamaz ve kayda geçirmez. Uygulama, Qutai Kredilerini ilk kez kullanmadan önce ' +
            'size sorar.\n• Web araması açıksa yapay zekâ sağlayıcısı sizin için arama yapabilir. Sağlayıcıların ' +
            'aldıkları için kendi gizlilik politikaları ve koşulları geçerlidir.\n• Arama önerileri açıksa adres ' +
            'çubuğuna yazdıklarınız arama motorunuza gönderilir (gizli sekmelerden asla).\n• Kurulumda “Konumumu ' +
            'kullan”a dokunursanız, yer adını bulmak için yaklaşık konumunuz telefonun adres hizmetine {{ios:(Apple’ınkine)|android:(genellikle Google’ınkine)|web:(iPhone’da Apple’ınkine, Android’de genellikle Google’ınkine)}} gönderilir. Yalnızca yer adı saklanır.\n• Asistana ' +
            'sesle yazdığınızda telefon o dili cihazın kendisinde tanıyamıyorsa ses, telefonun konuşma hizmetine {{ios:(Apple’ın)|android:(genellikle Google’ın)|web:(Apple’ın ya da Google’ın)}} gider; bu yalnızca Qutai’da bir kez izin verdikten sonra olur, gizli ' +
            'sohbetlerde asla. Qutai ve yapay zekâ hizmeti yalnızca metni alır.\n• Asistan seçenekleri kartlarla ' +
            'gösterdiğinde kartların resimleri, onları gösteren sitelerden (ya da sitelerin resim sunucularından) çerezleriniz gönderilmeden yüklenir; açmadığınız seçenekler için de. Gizli sohbetlerde yalnızca “Resimleri göster”e dokunduğunuzda.\n• “Reklam ve izleyicileri engelle” ' +
            'açıkken seçtiğiniz filtre listeleri yayıncılarından (örneğin EasyList ve AdGuard) indirilir ve birkaç ' +
            'günde bir güncellenir. Bu isteklerde gezinmenizle ilgili hiçbir şey yoktur.\n• ' +
            'Bir cevabı ya da uygulamayı bildirirseniz (⋮ › Bildir), bildirim Qutai’ın sunucusuna gider: sebep, notunuz, yalnızca “Ekle” işaretli kalırsa cevabın metni ya da uygulamanın adı ve kodu, cevabın Qutai Kredileriyle mi kendi anahtarınızla mı geldiği, uygulama sürümü, telefonun sistemi ve uygulamanın dili, giriş yaptıysanız da hesabınız. Bildirimler 180 gün saklanır ve yalnızca zararlı cevapları ve uygulamaları bulup düzeltmek için kullanılır.',
        },
        {
          heading: 'Qutai hesabınız',
          body:
            'Hesap isteğe bağlıdır; yalnızca Qutai Kredileri, uygulama içi satın almalar ve hesabınızdaki yedekler ' +
            'için gerekir. Apple, Google ya da e-posta adresinizle oturum açarsınız. E-postayla açarken girdiğiniz ' +
            'adrese e-posta hizmetimiz (Mailjet) aracılığıyla tek kullanımlık bir kod ve bir bağlantı göndeririz; kod ' +
            '10 dakika ve yalnızca onu isteyen telefonda geçerlidir, kötüye kullanımı önlemek için sunucu her adrese ' +
            've telefona kaç kod gönderildiğini sayar. Qutai’ın sunucusu şunları saklar: bir hesap numarası; hesabın ' +
            'oturum açma yöntemleri (Apple, Google, e-posta) ve bunlarla gelen e-posta adresleri (Apple’da bu, gizli ' +
            'bir yönlendirme adresi olabilir); hesabın oluşturulma ve son kullanılma zamanı; oturum açtığınız ' +
            'cihazlar (telefonunuzun kimlikleri değil, rastgele bir cihaz numarası); ve kredileriniz: bakiye, satın ' +
            'almalar ve eklenen krediler, her asistan isteği için model, token sayısı, maliyet ve zaman. ' +
            'Mesajlarınızı, sayfaları veya yanıtları saklamaz.',
        },
        {
          heading: 'Qutai hesabınızdaki yedekler',
          body:
            'Yalnızca siz seçerseniz (Ayarlar › Yedekleme), Qutai’ın sunucusu yedek dosyanızı saklar: dışa ' +
            'aktardığınız bir yedekle aynı veriler (yer imleri, geçmiş, asistanın hafızası, kayıtlı görevler, site ' +
            'ayarları ve tercihler; açık sekmeler, sohbetler, etkinlik ve yapay zekâ anahtarları yalnızca bunları dahil ' +
            'ederseniz). Dosya gönderilmeden önce telefonunuzda seçtiğiniz bir parolayla şifrelenir; Qutai onu okuyamaz ' +
            've yalnızca telefonunuzda tutulan parolayı kurtaramaz. Sunucu her yedekle birlikte ne zaman yapıldığını, ' +
            'boyutunu, uygulama sürümünü ve telefon türünü {{ios:(örneğin “iPhone · iOS 26”)|android:(örneğin “Android 16”)|web:(örneğin “iPhone · iOS 26”)}} de saklar. En yeni yedekler ' +
            'tutulur (şu an 3), eskileri silinir; yedekleri istediğiniz an silebilirsiniz, hesabınızı silmek onları da ' +
            'siler.',
        },
        {
          heading: 'Uygulama içi satın alma',
          body:
            'Qutai Kredileri ve uygulamada satılan her şey {{ios:App Store|android:Google Play|web:App Store veya Google Play}} aracılığıyla satın alınır; ödeme bilgileriniz {{ios:Apple’da|android:Google’da|web:Apple veya Google’da}} kalır, Qutai’a asla ulaşmaz. Satın almanın doğrulanıp ' +
            'hesabınıza eklenebilmesi ve başka bir telefonda geri yüklenebilmesi için bir ödeme hizmeti (RevenueCat) ' +
            'Qutai hesap numaranızı ve mağazanın satın alma kaydını alır. Qutai her satın almanın kaydını (mağaza, ' +
            'işlem, ürün, kredi, ödenen tutar ve tarihler) vergi mevzuatı gereği saklar; hesap silindikten sonra da, ' +
            'sizinle bağlantısı olmadan. İadeleri {{ios:Apple|android:Google|web:Apple veya Google}} kendi kurallarına göre yapar.',
        },
        {
          heading: 'Qutai’ın sunucusu ve verileri işleyen diğerleri',
          body:
            'Qutai’ın sunucusu Cloudflare üzerinde çalışır; yedekler de orada saklanır. Her sunucu gibi o da her ' +
            'istekte IP adresinizi görür; bunu yalnızca istek sayısını sınırlamak için kullanır ve Qutai’ın kendi ' +
            'kayıtlarında IP adresiniz, e-posta adresiniz, mesajlarınız, sayfalar veya oturum anahtarları asla ' +
            'bulunmaz (kayıtlarda bir istek numarası, hesap numaranız, istenen işlem, ne kadar sürdüğü ve asistan ' +
            'isteklerinde model, token ve maliyet bulunur). Qutai için veri işleyen şirketler, her biri kendi ' +
            'gizlilik politikasına göre: Cloudflare (sunucu), {{ios:Apple (oturum açma ve App Store), Google (oturum açma)|android:Google (oturum açma ve Google Play), Apple (oturum açma)|web:Apple ve Google (oturum açma ve mağazalar)}}, Mailjet ' +
            '(oturum açma e-postaları), RevenueCat (satın almalar) ve Qutai Kredileriyle Anthropic, OpenAI ve Google ' +
            '(yapay zekâ). Verilerinizi başka kimseyle paylaşmayız; yasanın gerektirdiği durumlar (örneğin bir ' +
            'mahkeme kararı) ve Qutai’ı ve kullanıcılarını dolandırıcılık ve kötüye kullanıma karşı korumak dışında.',
        },
        {
          heading: 'Verilerin ne kadar saklandığı',
          body:
            'Telefonunuzda: siz silene ya da Qutai’ı kaldırana kadar. Qutai’ın sunucusunda: hesabınız, oturum açma ' +
            'yöntemleri, cihazları ve kredi geçmişi siz hesabı silene kadar; yedekler yukarıda anlatıldığı gibi; ' +
            'oturum açma kodları kullanılana ya da süresi dolana kadar; satın alma kayıtları vergi mevzuatının ' +
            'gerektirdiği süre boyunca, hesap silindikten sonra sizinle bağlantısı olmadan.',
        },
        {
          heading: 'Anonim kullanım istatistikleri (yalnızca izin verirseniz)',
          body:
            'Qutai, anonim kullanım istatistikleri gönderip gönderemeyeceğini size bir kez sorar. İzin ver’e dokunmadığınız ' +
            'sürece hiçbir şey gönderilmez; cevabınızı istediğiniz zaman Ayarlar › Gizlilik ve güvenlik bölümünden ' +
            'değiştirebilirsiniz. İzin verirseniz uygulama Qutai’ın sunucusuna birkaç sabit bilgi gönderir: hangi ' +
            'özelliklerin kullanıldığı, kurulumun bittiği, bir asistan görevinin bittiği ya da başarısız olduğu (yalnızca ağ ' +
            'hatası gibi hata türüyle) ve kredi satın alma ekranının açıldığı; bunlarla birlikte uygulama sürümü, ' +
            '{{ios:iPhone olduğu|android:Android olduğu|web:telefonun türü}}, uygulamanın dili ve telefonunuzda bu iş için ' +
            'üretilen rastgele bir sayı. Bu sayı hesabınıza, oturum açmanıza ya da başka bir kimliğe bağlı değildir ve ayarı ' +
            'kapattığınızda silinir; sunucu onun yalnızca kısaltılmış ve karıştırılmış bir biçimini saklar. Gizli sekmelerden ' +
            've sohbetlerden hiçbir şey gönderilmez; web adresleri, sayfa içeriği, aramalar, yazdıklarınız ya da asistanın ' +
            'hafızası asla gönderilmez. Qutai reklam kimliği kullanmaz ve sizi uygulamalar ya da siteler arasında izlemez. ' +
            'İstatistikler Cloudflare’de saklanır ve üç ay tutulur.',
        },
        {
          heading: 'İsteklerin denetlenmesi ve kötüye kullanımın önlenmesi',
          body:
            'Qutai Kredilerini kötüye kullanıma karşı korumak için, oturum açtığınızda ve asistan Qutai Kredilerini ' +
            'kullandığında uygulama, isteğin gerçek bir cihazdaki gerçek Qutai uygulamasından geldiğini doğrulaması için ' +
            '{{ios:Apple’ın App Attest hizmetine|android:Google Play’in bütünlük hizmetine|web:iPhone’da Apple’ın App Attest ' +
            'hizmetine, Android’de Google Play’in bütünlük hizmetine}} başvurur ve bu doğrulamayı Qutai’ın sunucusuna ' +
            'gönderir. {{ios:Apple, telefonunuzda bu iş için üretilen bir anahtarı ve isteğin bir özetini alır; Qutai’ın ' +
            'sunucusu anahtarın açık kısmını ve bir sayacı hesabınıza bağlamadan saklar ve 180 gün kullanılmazsa ' +
            'siler.|android:Google, isteğin bir özetini alır ve uygulamayı ve cihazı denetler; Qutai’ın sunucusu yalnızca ' +
            'sonucu, oturumunuzla birlikte en fazla bir saat saklar.|web:Apple ya da Google isteğin bir özetini alır; ' +
            'Qutai’ın sunucusu yalnızca denetim için gerekeni, hesabınıza bağlamadan saklar.}} Denetim, isteklerinizin ' +
            'içeriğini asla kapsamaz. Qutai’ın sunucusu ayrıca, sınırlarına takılarak reddedilen ya da bu denetimden ' +
            'geçemeyen istekleri günlük olarak ve her hesap için ne kadar sık olduğunu sayar; bu sayılar 30 gün tutulur. Bir ' +
            'hesap, Qutai’dan bir kişinin incelemesi için işaretlenebilir (örneğin çok sayıda reddedilen istekten ya da ' +
            'harcanmış kredilerin iadesinden sonra); işaret tek başına hiçbir şeyi engellemez ve hesapla birlikte silinir.',
        },
        {
          heading: 'Kişileriniz',
          body:
            'İzin verirseniz asistan, adını söylediğiniz bir kişiyi (örneğin “Ahmet’i ara”) telefonunuzun ' +
            'kişilerinde bulabilir. Qutai yalnızca sizin söylediğiniz adları, telefonunuzda arar; kişi listeniz hiçbir ' +
            'zaman yüklenmez ya da listelenmez. Yapay zekâ hizmeti yalnızca eşleşen adları ve her birinde hangi tür ' +
            'numara ya da adres bulunduğunu (“cep” ya da “iş e-postası” gibi) alır, numaraların ve adreslerin ' +
            'kendisini asla almaz: bunları düğmede ya da taslakta siz görürsünüz, aramayı ya da gönderimi siz ' +
            'yaparsınız. Kişilerinizden gelen numaralar ve adresler sohbetlerinizle, asistanın hafızasıyla ya da ' +
            'yedeklerinizle birlikte saklanmaz. Gizli sekmelerin yer aldığı sohbetlerde kişiler kullanılmaz. İzni Ayarlar’dan ' +
            'değiştirebilirsiniz.',
        },
        {
          heading: 'Engelleme, sayfa stilleri, betikler ve uygulamalar',
          body:
            'Reklamların, izleyicilerin ve video reklamlarının engellenmesi telefonunuzda olur: filtre listeleri ' +
            'telefona indirilir (yukarıda) ve her sayfanın istekleri orada bu listelerle karşılaştırılır; böylece ' +
            'ziyaret ettiğiniz sayfalarla ilgili hiçbir şey listelerin yayıncılarına ya da Qutai’a gitmez. “Çerez ' +
            'bildirimlerini gizle” yalnızca bildirimleri gizler; sizin yerinize çerezleri hiçbir zaman kabul etmez ya ' +
            'da reddetmez. Kendi kurallarınız, kalıcı stilleriniz ve kalıcı betikleriniz yalnızca telefonda ve yedek ' +
            'alırsanız, parolanızla şifrelenmiş olarak yedeklerinizde (dışa aktardığınız dosyada ya da Qutai ' +
            'hesabınızdaki yedekte) saklanır. Asistan bir stil ya da betik yazarken yapay zekâ hizmeti, her soruda ' +
            'olduğu gibi isteğinizi ve gereken sayfa içeriğini alır; onayladığınız bir betiğin sonucu da ona gider. ' +
            'Qutai çerezlere dokunan betikleri reddeder ve bir betiğin sonucu asistanın hafızasında, yedeklerde ya da ' +
            'işlem geçmişinde hiçbir zaman tutulmaz. Qutai içindeki uygulamalar yalnızca telefonda ve dahil ederseniz ' +
            'yedeklerinizde saklanır. Qutai’dan bir uygulama yapmasını ya da düzeltmesini istediğinizde uygulamanın ' +
            'kodu ve hata iletileri yapay zekâ hizmetine gider; bir uygulamaya kaydettikleriniz hiçbir zaman gitmez. ' +
            'Uygulamalar internete erişemez, siteleri ve sitelerin çerezlerini göremez.',
        },
        {
          heading: 'Şifreler ve ödeme bilgileri',
          body:
            'Qutai, asistanın hafızasına şifre, kart numarası, kart güvenlik kodu, kartın son kullanma tarihi, tek ' +
            'kullanımlık kod ve banka hesap numarası (IBAN) kaydedilmesine izin vermez. Kimlik ve pasaport ' +
            'numaraları yalnızca kimlik veya seyahat bilgisi olarak kaydedilebilir; yapay zekâ hizmetinden gizlenir, ' +
            'hizmet yalnızca bir etiket görür ve numarayı siz onayladıktan sonra siteye Qutai kendisi yazar. Asistan ' +
            'kayıtlı kişisel bilgilerinizi bir siteye ilk kez girmeden önce Qutai size sorar (bunu her site için ' +
            'değiştirebilirsiniz). Ayrıca her işlemden önce onayınızın istenmesini seçebilir, seçtiğiniz sitelerde ' +
            'asistanı engelleyebilirsiniz.',
        },
        {
          heading: 'Kontrol sizde',
          body:
            'Asistanın hafızasını Ayarlar’dan görüp silebilir; geçmişi, çerezleri ve diğer verileri temizleyebilir, ' +
            'API anahtarlarınızı istediğiniz an kaldırabilirsiniz. Yedeklerinizi Ayarlar › Yedekleme’den Qutai’ın ' +
            'sunucusundan silebilirsiniz. Ayarlar › Hesap’tan Qutai Kredilerini kullanmayı bırakabilir, oturumu ' +
            'kapatabilir ya da hesabınızı silebilirsiniz: silmek hesabı, bakiyesini ve geçmişini Qutai’ın ' +
            'sunucusundan kaldırır (satın alma kayıtları yukarıdaki gibi sizinle bağlantısı olmadan kalır) ve ödeme ' +
            'hizmetinden sizinle ilgili kaydını silmesini ister. Qutai’ın sunucusunun sizinle ilgili sakladıklarının ' +
            'bir kopyasını, düzeltilmesini veya silinmesini qutai@sonsuzdongu.com adresine yazarak da ' +
            'isteyebilirsiniz. Qutai’ı kaldırmak telefonda sakladığı her şeyi siler; Qutai dışına kaydettiğiniz ' +
            'dosyalar, örneğin {{ios:Dosyalar uygulamasına kaydettiğiniz dosyalar|android:Android’in İndirilenler klasöründeki indirmeler|web:Android’in İndirilenler klasöründeki ya da iPhone’da Dosyalar uygulamasındaki indirmeler}} ve fotoğraflarınıza ' +
            'kaydettiğiniz resimler kalır.',
        },
        {
          heading: 'Güvenlik',
          body:
            'Qutai’ın sunucusuyla bağlantılar HTTPS kullanır. Oturum anahtarları sunucuda yalnızca özetlenmiş (hash) ' +
            'olarak, telefonunuzda ise şifreli depoda tutulur; yedekler gönderilmeden önce telefonunuzda şifrelenir.',
        },
        {
          heading: 'Çocuklar',
          body:
            'Qutai 13 yaşından küçük çocuklara yönelik değildir ve onlardan bilerek veri toplamayız. Bazı ülkelerde ' +
            'bu politikayı kendiniz kabul edebilmek için daha büyük (örneğin 16 yaşında) olmanız gerekir; bu yaşın ' +
            'altında bir ebeveyn veya vasinin sizin adınıza kabul etmesi gerekir.',
        },
        {
          heading: 'Değişiklikler',
          body: 'Bu politika değişirse Qutai yeni sürümü gösterir ve devam etmeden önce kabul etmenizi ister.',
        },
      ],
    },
    terms: {
      title: 'Kullanım Koşulları',
      intro: 'Qutai’ı kullanarak bu koşulları kabul etmiş olursunuz. Lütfen Gizlilik Politikası ile birlikte okuyun.',
      sections: [
        {
          heading: 'Asistanı kullanmanın iki yolu',
          body:
            '• Kendi API anahtarınız: bunu kullanmak sizinle o sağlayıcı arasında bir sözleşmedir. Sağlayıcının ' +
            'koşulları, gizlilik politikası ve fiyatları geçerlidir; oradaki hesabınızdan ve anahtarınıza yansıyan ' +
            'her ücretten siz sorumlusunuz. Qutai bu sözleşmenin tarafı değildir ve bu ücretleri iade edemez.\n' +
            '• Qutai Kredileri: asistanın istekleri Qutai’ın sunucusundan geçer ve Qutai hesabınızdaki kredilerle ' +
            'ödenir. Kullanmak için bir hesabınız olması gerekir.',
        },
        {
          heading: 'Qutai Kredileri',
          body:
            'Krediler uygulama içinden {{ios:App Store|android:Google Play|web:App Store veya Google Play}} aracılığıyla, mağazanın gösterdiği fiyatla satın ' +
            'alınır ve satın alma doğrulandığında Qutai hesabınıza eklenir. Yalnızca Qutai’da asistanın isteklerinin ' +
            'ücretini, her model için gösterilen kredi fiyatlarıyla öder; her yanıtın ne kadar tuttuğu altında ' +
            'gösterilir. Bir istek önce tutabileceği en yüksek tutarı ayırır, kullanmadığını geri verir. Krediler Qutai ' +
            'hesabınıza aittir, oturum açtığınız her telefonda kullanılabilir, devredilemez, paraya çevrilemez ve ' +
            'yasaların ya da mağazanın iade kurallarının gerektirdiği durumlar dışında iade edilmez; iadeleri {{ios:Apple|android:Google|web:Apple veya Google}} yürütür. Bir satın alma iade edilirse kredileri geri alınır; bu, bakiyeyi yeniden kredi alana kadar ' +
            'eksiye düşürebilir. Kredilerin süresi dolmaz. Modeller, kredi fiyatları ve sınırlar değişebilir; güncel olanlar kullanmadan önce ' +
            'uygulamada gösterilir. Qutai Kredileri bakım nedeniyle durdurulabilir ya da zaman zaman kullanılamayabilir.',
        },
        {
          heading: 'Hesabınız',
          body:
            'Oturum açma yönteminizi (Apple, Google veya e-postanız) güvende tutun; hesabınızla yapılanlardan siz sorumlusunuz. Bu koşulları ' +
            'çiğneyen bir hesabı askıya alabiliriz. Hesabınızı silerseniz kalan kredileri kaybolur.',
        },
        {
          heading: 'Qutai bir tarayıcıdır',
          body:
            'Qutai, başkalarının işlettiği web sitelerini gösterir. Siteleri, içeriklerini ya da sundukları ürün ve ' +
            'hizmetleri kontrol etmeyiz, denetlemeyiz veya onaylamayız ve bunlardan sorumlu değiliz. Siteler ve ' +
            'içerikleri sahiplerine aittir. Bir siteyi kullanırken o sitenin kendi koşulları ve yasalar geçerlidir; ' +
            'bunlara uymak sizin sorumluluğunuzdadır. Asistanınkiler dahil bağlantılar, arama sonuçları ve öneriler ' +
            'bizim tavsiyemiz değildir.',
        },
        {
          heading: 'Asistan sizin adınıza işlem yapar',
          body:
            'İstediğinizde asistan sayfaları okuyabilir, tıklayabilir, yazabilir, form doldurabilir; gönderi, mesaj ' +
            've sipariş hazırlayabilir. Bir sitede metin yayımlamadan ya da göndermeden önce Qutai onayınızı ister. ' +
            'Ödemeyi tamamlamak, Ayarlar › Asistan’da “Asistan ödemeleri tamamlasın”ı açana kadar kapalıdır; açık ' +
            'olduğunda da her ödeme, toplam tutarı gösteren Qutai’ın kendi penceresinde onayınızı gerektirir. Yapay ' +
            'zekâ hata yapabilir: neyi onayladığınızı kontrol edin; satın alma, rezervasyon, ödeme, gönderi, mesaj, ' +
            'silme, hesap değişikliği ve diğer önemli işlemleri tamamlanmadan önce gözden geçirin. İstediğiniz ya da ' +
            'onayladığınız işlemlerden, onları kendiniz yapmışsınız gibi siz sorumlusunuz. Siteler, satıcılar ve ' +
            'başka kişilerle yaptığınız alışverişler ve diğer işler sizinle onlar arasındadır: Qutai bunların tarafı ' +
            'değildir ve onlara yaptığınız ödemelere hiçbir zaman aracılık etmez. Ayarlar’dan her işlemden önce onay ' +
            'istenmesini seçebilir, seçtiğiniz sitelerde asistanı engelleyebilirsiniz.',
        },
        {
          heading: 'Yapay zekâ yanıtları',
          body:
            'Yapay zekânın yazdığı yanıtlar, özetler, çeviriler ve diğer her şey yanlış, eksik ya da güncelliğini ' +
            'yitirmiş olabilir. Bunlar profesyonel tavsiye değildir; örneğin tıbbi, hukuki, mali ya da vergi ' +
            'tavsiyesi değildir: bu tür konularda yetkin bir uzmana danışın. Önemli bilgilere güvenmeden önce onları ' +
            'kontrol edin.',
        },
        {
          heading: 'Reklam ve izleyici engelleme',
          body:
            'Reklam ve izleyicileri engellemek, çerez bildirimlerini gizlemek ve video reklamlarını engellemek sizin ' +
            'seçtiğiniz özelliklerdir: her birini Ayarlar › Gizlilik ve güvenlik’ten kapatabilir, bir site için ' +
            'engellemeyi o sitenin sayfasından kapatabilirsiniz (“Video reklamlarını engelle” siz açana kadar ' +
            'kapalıdır). Engelleme yalnızca telefonunuzda açtığınız sayfalarda çalışır; sitelerin kendisini ' +
            'değiştirmez. Filtre listelerini üçüncü taraflar kendi lisanslarıyla hazırlar (örneğin EasyList GPLv3 ya ' +
            'da CC BY-SA 3.0, AdGuard GPLv3 lisansıyla); telefonunuz onları yayıncılarından indirir, Ayarlar da her ' +
            'listenin ana sayfasını ve lisansını gösterir. Neyin engellenip neyin engellenmeyeceğini garanti etmeyiz: ' +
            'listeler fazla ya da eksik engelleyebilir; bir site bozulabilir, daha az şey gösterebilir ya da ' +
            'engellemeyi kapatmanızı isteyebilir. Bir sitede engellemeyi kullanıp kullanmamak sizin kararınızdır ve ' +
            'ziyaretiniz için o sitenin koşulları geçerlidir.',
        },
        {
          heading: 'Sayfa stilleri ve betikler',
          body:
            'Asistandan bir sayfanın görünüşünü değiştirmesini (stil) ya da bir sayfada betik çalıştırmasını ' +
            'isteyebilir, bunları bir site için kalıcı yapabilir; ayrıca kendiniz yazabilir, düzenleyebilir, içe ve ' +
            'dışa aktarabilirsiniz. Betikler, siz Ayarlar › Asistan’dan açana kadar kapalıdır. Qutai, asistanın ' +
            'yazdığı her stili ve betiği size gösterir ve yalnızca siz onayladıktan sonra çalıştırır; içe aktarılan ' +
            'betikler siz onaylayana kadar kapalı kalır. Stiller ve betikler yalnızca telefonunuzda, açtığınız ' +
            'sayfalarda çalışır. Qutai riskli bazı kodları reddeder, ancak sizin yazdığınız, düzenlediğiniz ya da içe ' +
            'aktardığınız kodu incelemez ve hiçbir kodun ne yapacağını garanti edemez: bir betik o sitede sizin ' +
            'oturumunuzla çalışır, sayfayı değiştirebilir ya da bozabilir ve oradaki hesabınızı etkileyebilir. ' +
            'Yalnızca anladığınız ve güvendiğiniz şeyleri onaylayın. Onayladığınız, kalıcı yaptığınız, içe ' +
            'aktardığınız ya da paylaştığınız stillerden ve betiklerden siz sorumlusunuz.',
        },
        {
          heading: 'Qutai içindeki uygulamalar',
          body:
            'Qutai içindeki uygulamaları, sizin isteğiniz üzerine yapay zekâ yazar. İnternetten ve sitelerden ' +
            'yalıtılmış olarak çalışırlar, ancak bizim tarafımızdan test edilmez ya da incelenmez ve hiçbir garanti ' +
            'olmadan sunulur: bir uygulamada hatalar olabilir ya da içine kaydedilen veriler kaybolabilir; önemli ' +
            'olan her şeyi dışa aktarın ya da yedekleyin. Bir dosyadan içe aktardığınız uygulamalar herhangi birinden ' +
            'gelebilir ve bizim tarafımızdan incelenmez; Qutai içe aktarılan bir uygulamanın ne olduğunu ve neleri ' +
            'kullanabileceğini, siz onu açmadan önce gösterir. Açtığınız ve başkalarıyla paylaştığınız uygulamalardan ' +
            'siz sorumlusunuz.',
        },
        {
          heading: 'İndirmeler ve dosya yükleme',
          body:
            'Neyi indireceğinize, açacağınıza ve yükleyeceğinize siz karar verirsiniz. Qutai, uygulama yükleyebilen ' +
            'ya da kod çalıştırabilen dosyaları indirmeden önce sizi uyarır, ancak dosyaları virüslere ya da başka ' +
            'zararlara karşı taramaz. {{ios:Qutai hiçbir şeyi kendisi yüklemez. İndirilen dosyalar telefonunuza|android:İndirilen bir uygulamayı (APK dosyası) açmak, onu sistemin yükleyicisine verir; Qutai hiçbir şeyi kendisi yüklemez. Google Play dışından gelen dosyalar ve uygulamalar telefonunuza|web:Android’de indirilen bir uygulamayı (APK dosyası) açmak, onu sistemin yükleyicisine verir; Qutai hiçbir şeyi kendisi yüklemez. App Store ve Google Play dışından gelen dosyalar ve uygulamalar telefonunuza}} ya da verilerinize zarar verebilir; bunları indirmek, açmak ve ' +
            'yüklemek, bunu yapma hakkınızın olması da dahil, sizin sorumluluğunuzdadır.',
        },
        {
          heading: 'Kabul edilebilir kullanım',
          body:
            'Qutai’ı, Qutai Kredilerini, asistanı, stilleri, betikleri ya da uygulamaları şunlar için kullanmayın:\n' +
            '• yasaları ya da başkalarının gizlilik, telif veya marka gibi haklarını çiğnemek;\n' +
            '• sitelerin ya da yapay zekâ sağlayıcılarının koşullarını çiğnemek;\n' +
            '• şifreleri, erişim denetimlerini, ödeme duvarlarını, kopya korumasını (DRM) ya da başka teknik ' +
            'korumaları aşmak;\n' +
            '• başkalarının kişisel verilerini hukuka aykırı biçimde toplamak, izlemek ya da yayımlamak;\n' +
            '• istenmeyen ileti göndermek, sahte hesap ya da yorum oluşturmak, otomatik olarak toplu gönderi ya da ' +
            'işlem yapmak veya siteleri aşırı yüklemek;\n' +
            '• kimseyi aldatmak ya da dolandırmak veya kötü amaçlı yazılım yaymak;\n' +
            '• Qutai’ın sunucusunu kötüye kullanmak, ona saldırmak ya da aşırı yüklemek.\n' +
            'Bu şekillerde kullanılan bir hesabı askıya alabiliriz.',
        },
        {
          heading: 'Garanti yoktur ve sorumluluğun sınırları',
          body:
            'Qutai “olduğu gibi” ve “sunulabildiği kadarıyla” sunulur. Onu yararlı ve güvenli kılmak için çalışırız, ' +
            'ancak her zaman çalışacağına, hatasız olacağına, beklediğinizi engelleyeceğine ya da her siteyle ' +
            'çalışacağına söz vermeyiz ve yasaların gerektirdiklerinin ötesinde garanti vermeyiz. Yasaların izin ' +
            'verdiği ölçüde; siteler ve içeriklerinin, başka kişilerin, yapay zekâ sağlayıcılarının hizmetlerinin, ' +
            'filtre listelerinin, onayladığınız ya da içe aktardığınız stillerin, betiklerin ve uygulamaların ya da ' +
            'istediğiniz veya onayladığınız işlemlerin yol açtığı kayıplardan ve kâr kaybı gibi dolaylı kayıplardan ' +
            'sorumlu değiliz. Bu koşullardaki hiçbir şey kast ya da ağır ihmalden, ölüm ya da bedensel zarardan doğan ' +
            'sorumluluğu veya yasaların sınırlanmasına ya da kaldırılmasına izin vermediği başka bir sorumluluğu ' +
            'sınırlamaz.',
        },
        {
          heading: 'Tüketici olarak haklarınız',
          body:
            'Qutai’ı tüketici olarak kullanıyorsanız, yaşadığınız yerin yasalarının tüketicilere tanıdığı ve ' +
            'sözleşmeyle vazgeçilemeyen her hakkınız saklıdır; örneğin 6502 sayılı Tüketicinin Korunması Hakkında ' +
            'Kanun’dan ve Avrupa Birliği ile Avrupa Ekonomik Alanı tüketici hukukundan doğan haklarınız. Bu ' +
            'koşullardaki hiçbir şey bu hakları sınırlamaz ya da kaldırmaz; bir hüküm bunlarla çelişirse bu haklar ' +
            'geçerli olur.',
        },
        {
          heading: 'Değişiklikler',
          body: 'Bu koşullar değişirse Qutai yeni sürümü gösterir ve devam etmeden önce kabul etmenizi ister.',
        },
      ],
    },
  },
};
