/**
 * English copy. `tr.ts` must have exactly these keys (TypeScript checks it).
 * Strings marked "app:" are the app's own UI strings (src/i18n/en.ts in the app), used in the phone mock
 * so it shows the product as it is.
 */
export const en = {
  'meta.title': 'Qutai: Agentic Browser',
  'meta.description':
    'Qutai is the AI assistant in your phone’s browser: an open-source browser for iPhone and Android whose assistant reads the page when you ask and uses it for you, with Qutai Credits or your own AI key; keeps your data on your phone and asks before sensitive actions. In development.',
  'meta.ogAlt': 'The Qutai logo, a blue Q, next to the words: Qutai, Agentic Browser.',
  'meta.appDescription':
    'An open-source AI browser for iOS and Android whose assistant reads a web page when you ask and uses it for you, with Qutai Credits or your own AI provider key.',

  'nav.skip': 'Skip to content',
  'nav.label': 'Sections',
  'nav.agent': 'What it does',
  'nav.privacy': 'Privacy',
  'nav.browser': 'Browser',
  'nav.compare': 'Compare',
  'nav.openSource': 'Open source',
  'nav.status': 'Status',
  'nav.features': 'Features',
  'nav.github': 'GitHub',
  'nav.home': 'Qutai home',

  'lang.label': 'Language',
  'lang.current': 'English',
  'lang.other': 'Türkçe',
  'lang.otherShort': 'TR',
  'lang.switchTo': 'Türkçe sürüme geç',

  'hero.eyebrow': 'AI-first browser',
  'hero.title': 'Built with AI. Built for AI.',
  'hero.tagline': 'The AI assistant in your phone’s browser.',
  'hero.lede':
    'Qutai is a browser for iPhone and Android whose assistant reads the page when you ask, and uses it for you.',
  'hero.github': 'View on GitHub',
  'hero.status': 'In development. Coming to the App Store and Google Play; not released yet.',

  'hero.chip1': 'Reads your tabs',
  'hero.chip2': 'Remembers you',
  'hero.chip3': 'Asks first',
  'hero.chip4':
    'Qutai Credits or your own key',

  'statement.kicker': 'About Qutai',
  'statement.text':
    'Qutai is a browser with an assistant at its core. When you ask, it reads the page, compares your tabs, fills in forms, books and researches, remembers what you tell it on your phone, and stops to ask before anything that matters.',

  'art.placeholder': 'Miniature in preparation',
  'art.hero.alt': 'Ottoman miniature: robot scribes in colourful kaftans read web pages on tablets in a palace library, with the Golden Horn and Galata Tower through the window.',
  'art.compare.alt': 'Ottoman miniature: a robot in a bazaar shop weighs two pairs of slippers on a balance while two tablets show the shops’ pages and a customer looks on.',
  'art.checkout.alt': 'Ottoman miniature: a robot fills in an order form at a counter and waits, while the patron holds the purse.',
  'art.booking.alt': 'Ottoman miniature: in a garden courtyard a robot writes a dinner booking on a calendar scroll beside an old telephone while a table is set.',
  'art.research.alt': 'Ottoman miniature: at night, a robot scholar writes a report among open books, a celestial globe and an astrolabe.',
  'art.memory.alt': 'Ottoman miniature: a robot kneels and sorts keepsakes into an inlaid chest while its owner watches from the sofa.',

  'agent.compare.kicker': 'Read, compare, decide',
  'agent.checkout.kicker': 'Cart, details, payment',
  'agent.booking.kicker': 'Book, note, remind',
  'agent.research.kicker': 'Search, read, cite',

  'start.kicker': 'Getting started',
  'start.title': 'Three steps, once it is out.',
  'start.step1.title': 'Install Qutai',
  'start.step1.body': 'Not in the stores yet: build it from the repository today, or follow the project on GitHub.',
  'start.step2.title':
    'Choose how to reach the AI',
  'start.step2.body':
    'Sign in and use Qutai Credits, with no key to manage. Or add your own key: Anthropic, OpenAI, Gemini, OpenRouter or your own server.',
  'start.step3.title': 'Give it a task',
  'start.step3.body': 'Tap the Q in the address bar and say what you need, in your own words.',

  'mock.label':
    'Illustration of the Qutai app: a shop page with the assistant panel open. The user asks Qutai to compare the shoe with the one in another tab and add the cheaper one to the cart. Qutai reads both tabs, answers, and a dialog asks the user to allow the click on Add to cart.',
  'mock.caption': 'Illustration, simplified from the app’s interface and strings.',
  'mock.url': 'shop.example/trail-runner',
  'mock.pageKicker': 'Running',
  'mock.pageTitle': 'Trail Runner 4',
  'mock.pagePrice': '€89',
  'mock.pageButton': 'Add to cart',
  'mock.panelTitle': 'Qutai', // app: chat.title
  'mock.model': 'Claude · this chat', // app: chat.modelThisChat
  'mock.user': 'Compare this with the shoe in my other tab and add the cheaper one to my cart, size 42.',
  'mock.actionReadTab': 'Reading tab 2', // app: action.readTab
  'mock.actionReadPage': 'Reading the page', // app: action.readPage
  'mock.answer': 'This one is €12 cheaper with the same sole and drop. Adding size 42 to your cart.',
  'mock.confirmTitle': 'Qutai wants to do this', // app: confirm.title
  'mock.confirmBody': 'Clicking (ref 31)', // app: action.click
  'mock.confirmAlways': 'Always allow on shop.example', // app: confirm.always
  'mock.deny': 'Deny', // app: confirm.deny
  'mock.allow': 'Allow', // app: confirm.allow
  'mock.placeholder': 'Give a task…', // app: chat.placeholder

  'agent.kicker': 'The assistant',
  'agent.title': 'Hand it the tedious part.',
  'agent.lede':
    'Qutai’s assistant works in your tabs when you ask: it reads the page, taps, types, opens and compares tabs, step by step. Every step is shown as it happens, the page it works on glows softly, and you can stop it at any time; when it is done, the steps fold into one line. And it remembers what you tell it, so each task needs less explaining than the last.',
  'agent.memory.kicker': 'Memory, on your phone',
  'agent.memory.title': 'It gets to know you, and keeps it on your phone.',
  'agent.memory.body':
    'Tell Qutai your addresses, sizes, diet or budget. When you set it up, you can tell it about yourself by voice or by typing, or let it ask you a few short questions: it asks at most three follow-ups and shows everything it understood for you to check before anything is saved, and you can hide health details from the AI. It files what it learns under categories, uses it in later tasks without asking again, and follows your custom instructions in every request. The more you use it, the less you have to explain.',
  'agent.memory.point1': 'Sorted into categories: identity and contact, addresses, shopping and delivery, travel, food and diet, budget, general preferences',
  'agent.memory.point2': 'Stored on the phone; yours to see, edit and delete in Settings, and included in your encrypted backup',
  'agent.memory.point3': 'Sent only with your requests, to the AI provider you chose (through Qutai’s server with Qutai Credits), and listed in “What was sent to the AI”; ID numbers and memories you lock go only as a label',
  'agent.memory.point4': 'Never passwords, card numbers or one-time codes; it asks per site before entering your details',
  'agent.compare.title': 'Compare products across tabs',
  'agent.compare.body':
    'Open two or three product pages and ask which one fits. Qutai reads each tab without switching away, notes prices, delivery times and specs, and answers with a table it can also hand you as a CSV file.',
  'agent.compare.step1': 'Reading tab 2',
  'agent.compare.step2': 'Reading tab 3',
  'agent.compare.step3': 'Price, delivery, warranty side by side',
  'agent.checkout.title': 'Shops for you, all the way to checkout',
  'agent.checkout.body':
    'It puts what you want in the cart and enters your name, address and the delivery note you saved, after asking whether it may use your remembered details on that site. Then you choose who pays: press the last button yourself, or turn on “Let the assistant complete payments” in Settings and approve each payment in Qutai’s own window, which shows the site, the total on the page, the order and the payment method. Card numbers, security codes, passwords and one-time codes are never typed, and your bank’s check (3-D Secure) stays with you.',
  'agent.checkout.step1': 'Enter your personal information on shop.example?', // app: personal.title
  'agent.checkout.step2': 'Typed into [12]', // app: action.typeRedacted
  'agent.checkout.step3': 'Pay €64.90 on shop.example?', // app: approval.payTitle
  'agent.booking.title': 'Book it, then put it in your calendar',
  'agent.booking.body':
    'Find a table or an appointment and fill in the form. Afterwards Qutai offers to add it to your calendar or set a reminder, showing the details for you to approve. When a place takes bookings by phone, you get a Call button and dial yourself.',
  'agent.booking.step1': 'Calendar event: Dinner, Friday 20:00', // app: action.addCalendarEvent
  'agent.booking.callName': 'Rose Street Kitchen',
  'agent.booking.callNumber': '+44 20 7946 0123', // a number set aside for fiction
  'agent.booking.call': 'Call', // app: chat.call
  'agent.research.title': 'Research with sources',
  'agent.research.body':
    'Deep research searches and reads many pages and PDFs, takes notes and writes a report with its sources listed under the answer. Share it as a PDF. It takes a few minutes and uses more of your API credit.',
  'agent.research.step1': 'Searched: e-bike rules in London', // app: action.webSearch
  'agent.research.step2': 'Reading the page',
  'agent.research.step3': 'Sources',
  'agent.footnote':
    'What the assistant manages depends on the model you choose and on the site. These are examples of what the code supports; most of it has not yet been tested on a real phone.',

  'privacy.kicker': 'Privacy by design',
  'privacy.title': 'Your choice. Your phone. Your say.',
  'privacy.lede':
    'You choose how Qutai reaches the AI. Sign in and use Qutai Credits: no key to manage, and requests pass through Qutai’s server, which doesn’t store or log them. Or use your own key, and requests go from your phone straight to your provider, with no Qutai account and no Qutai server in between.',
  'privacy.diagramLabel':
    'Diagram of the two ways to reach the AI. With Qutai Credits, in the official builds: requests go from your phone through Qutai’s server to the AI, without being stored or logged there. With your own key, in every build: your phone sends requests directly to the AI provider you chose, with no Qutai server in between.',
  'privacy.routeOwn': 'With your own key',
  'privacy.routeOwnTag':
    'Every build',
  'privacy.routeService': 'With the Qutai service',
  'privacy.routeServiceTag':
    'Official builds',
  'privacy.diagramPhone': 'Your phone',
  'privacy.diagramPhoneSub': 'tabs, history, memory, chats',
  'privacy.diagramProvider': 'Your AI provider',
  'privacy.diagramProviderSub': 'with your own key',
  'privacy.diagramNone': 'No Qutai server',
  'privacy.diagramQutai': 'Qutai’s server',
  'privacy.diagramQutaiSub': 'not stored or logged',
  'privacy.diagramAi': 'The AI',
  'privacy.diagramAiSub': 'no key of your own',
  'privacy.key.title': 'Bring your own AI key',
  'privacy.key.body':
    'Use a key from Anthropic, OpenAI, Google Gemini or OpenRouter, or your own OpenAI-compatible server (Ollama, LM Studio, vLLM), with a button to test the connection. Choose the model, even per conversation. This route always stays, next to Qutai Credits.',
  'privacy.device.title': 'Stays on the phone',
  'privacy.device.body':
    'Tabs, history, bookmarks, chats and the assistant’s memory are stored on the device. Passwords, card numbers and one-time codes are never put in memory; ID numbers and memories you lock reach the AI only as a label.',
  'privacy.sites.title': 'Permissions per site',
  'privacy.sites.body':
    'For each site, the assistant may act freely, ask before every action, only read, or stay out. Separately, you decide whether it may enter your remembered details there, and whether the page may use your camera, microphone or location.',
  'privacy.log.title': 'What was sent to the AI',
  'privacy.log.body':
    'A list of every request: when, which provider and model, which site, and what went with it. The content itself is kept only in memory until the app closes. Each answer also shows the tokens it used and, where the price is known, roughly what it cost.',
  'privacy.incognito.title': 'Incognito means nothing saved',
  'privacy.incognito.body':
    'Incognito tabs keep no history, and conversations that touch them stay in memory only. Memory, location and calendar are off there, and the incognito tabs can be locked.',
  'privacy.confirm.title': 'Asks before it matters',
  'privacy.confirm.body':
    'Sensitive steps wait for your yes. Posts, comments, reviews and messages sent through a site go out only after you approve them in Qutai’s own window, which shows the exact text; words on a web page can never approve them. Calls, texts, WhatsApp messages and emails are only drafts that you send. A notification, a calendar entry, a reminder, reading your calendar or location, and an ordinary download can be allowed with “Don’t ask again”, which you can take back in Settings; a no is never remembered. Uploads and risky files are asked about every time.',
  'privacy.contacts.title': 'Your contacts stay on the phone',
  'privacy.contacts.body':
    '“Call James” or “email this to Mr Clarke”: the assistant looks up only the name you said, on the phone. The AI sees matching names and labels such as “mobile”, never numbers or addresses. If several people match, you pick in Qutai’s own list, and you still tap Call or send the message yourself. Asked at first use, off in incognito.',
  'privacy.scripts.title': 'Scripts only if you allow them',
  'privacy.scripts.body':
    'Off by default. Turned on, the assistant answers questions like “how many links are here?” with a script on a sealed copy of the page, with no internet and no sign-in. A script on the live page needs your approval with its full code and warnings, is refused on sign-in, payment and bank pages, and can then do what the site’s own code can do. Scripts you keep run only on their site and are asked about again when their code changes.',
  'privacy.apps.title': 'Your own apps, sealed off',
  'privacy.apps.body':
    'Ask for “an app where I can keep my notes” and Qutai writes it, opens a preview, fixes its own errors and changes it when you ask, keeping earlier versions so you can go back. Your apps wait in My apps on the new tab page. Each runs in its own view, apart from your browsing: no internet, no other sites’ cookies or sign-ins, no other app’s data. Its data stays on the phone, up to 5 MB per app. Share an app as a file; an imported one stays off until you approve it, and apps go into your encrypted backup. Writing an app is an ordinary assistant request, paid with your own key or Qutai Credits.',
  'privacy.note':
    'The Qutai service is optional: sign in with Apple, Google or email, use Qutai Credits instead of your own key, with nothing to choose: Qutai picks the model. Qutai’s server keeps your account, your credits and, for each request, the model, the token count and the cost, and sees the app’s version and build; not your messages or pages. Builds from the repository leave it out and never contact a Qutai server.',

  'browser.kicker': 'And a browser too',
  'browser.title': 'Everything you expect from a browser, minus the tracking.',
  'browser.tabs.title': 'Tabs and groups',
  'browser.tabs.body': 'A tab group shares one conversation with the assistant. Idle tabs sleep to save memory.',
  'browser.reader.title': 'Reader mode and read aloud',
  'browser.reader.body':
    'Light, dark or sepia, serif or sans, easier-reading spacing. Read aloud follows the article paragraph by paragraph, in the language each part is written in, with the phone’s own voices (on iPhone, the most natural one you have installed).',
  'browser.blocking.title': 'Ad and tracker blocking',
  'browser.blocking.body':
    'Pick EasyList, EasyPrivacy or AdGuard Turkish, or add any list by its address; lists are downloaded on the phone and their rules that block whole domains are used. Ask the assistant to hide an empty ad box or block a domain: once you approve and choose where it applies, the rule goes to My rules, where you can switch it off, export or import it.',
  'browser.audio.title': 'Plays in the background',
  'browser.audio.body':
    'Audio keeps playing with the screen locked. On iPhone a video goes on as sound only; on Android it can shrink to picture-in-picture. Some sites such as YouTube still stop it.',
  'browser.private.title': 'Incognito tabs',
  'browser.private.body': 'Their own cookies and site data, gone when you close them, with an optional biometric lock.',
  'browser.backup.title': 'Encrypted backup',
  'browser.backup.body':
    'No account needed and no sync: export everything to one password-protected file and import it on another phone.',
  'browser.bookmarks.title': 'Bookmarks in folders',
  'browser.bookmarks.body': 'Import the file Chrome, Firefox, Safari or Edge exports, and export the same format.',
  'browser.voice.title': 'Voice input',
  'browser.voice.body':
    'Dictate tasks with the phone’s own speech recognition, on the device when the phone and language allow. Hold the Q button to talk without opening the panel; Qutai listens in the language of your conversation.',
  'browser.save.title': 'PDF and full-page screenshots',
  'browser.save.body': 'Save a page as PDF or a stitched screenshot of the whole page, or keep it for offline reading.',
  'browser.more': 'See every feature, with example requests',
  'browser.styles.title': 'Your own look for any site',
  'browser.styles.body':
    'Ask for red links, bigger text or a dark background. The assistant proposes the styles; you approve and try them, then keep them for that site in My rules, where you can switch them off, edit, export or import them. Styles can’t load anything from the internet.',
  'browser.cookies.title': 'See a page’s cookies',
  'browser.cookies.body':
    'Ask which cookies a page has: a list grouped by site with each cookie’s name and settings, HttpOnly ones included. Their values never go to the AI; you can show or delete them on screen.',
  'browser.images.title': 'Edit images on the phone',
  'browser.images.body':
    'Crop and resize, or apply greyscale, sepia, invert, auto enhance, brightness, contrast, saturation, sharpen or blur: with one-tap presets and sliders, or by asking the assistant. The editing is done on the phone, not on a server.',

  'compare.kicker': 'Comparison',
  'compare.title': 'How Qutai compares on mobile',
  'compare.lede':
    'The mobile apps only, from each vendor’s own public pages. Where we could not confirm something, the cell says so instead of guessing.',
  'compare.checked': 'Last checked: {date}',
  'compare.caption': 'Features of Qutai and other mobile browsers with AI assistants',
  'compare.feature': 'Feature',
  'compare.yes': 'Yes',
  'compare.partial': 'Partly',
  'compare.no': 'No',
  'compare.unknown': 'Not confirmed',
  'compare.legend': 'Key',
  'compare.source': 'Source',
  'compare.sourceFor': 'Source for {name}: {feature}',
  'compare.pickLabel': 'Compare Qutai with',
  'compare.pickHint': 'Wider screens show the whole table.',
  'compare.excluded': 'Not in the table: {list}.',
  'compare.methodologyLink': 'How we compared',
  'compare.methodology.title': 'How we compared',
  'compare.methodology.1':
    'We looked at each browser’s iPhone and Android app, not its desktop version: a feature that exists only on desktop counts as not available here.',
  'compare.methodology.2':
    'Every competitor cell is based on the vendor’s own pages: feature pages, help centres, pricing pages and store listings. Each cell links its source and the date we checked it. If we could not confirm a feature from such a page, the cell says “Not confirmed”, which does not mean the feature is missing.',
  'compare.methodology.3':
    'Qutai’s column describes what is in its source code today. Qutai is not released yet, and most of these features have not yet been tested on a real phone.',
  'compare.methodology.4':
    'Product names are trademarks of their owners. This comparison reflects public information as of the date above and is not endorsed by any of the companies named.',
  'compare.correction': 'Report a correction',
  'compare.notes': 'Notes',

  'oss.kicker': 'Open source',
  'oss.title': 'Read every line. Build it yourself.',
  'oss.body':
    'The whole app is in the repository under the Apache License 2.0: the agent, its safety rules, what is sent to the AI and how. You can build it with your own toolchain, or in the cloud with your own Expo account.',
  'oss.buildLabel': 'Build it on your machine',
  'oss.repo': 'Repository',
  'oss.license': 'Licence',

  'status.kicker': 'Status',
  'status.title': 'Where it stands, honestly.',
  'status.body':
    'Qutai is in development. It is not in the App Store or Google Play yet, and most of what this page describes is implemented in the code but has not yet been tested on a real phone.',
  'status.today': 'In the code today',
  'status.today.1': 'The assistant: reading, tapping, typing, fixing form errors, tabs, deep research with sources',
  'status.today.2':
    'Qutai Credits with an account, or five provider options with your own key and a model per conversation',
  'status.today.3': 'Memory with categories and hidden entries, per-site permissions, the “sent to the AI” log',
  'status.today.4': 'Calendar reading and writing, reminders, a Call button, text, WhatsApp and email drafts, also to people found in your contacts by name',
  'status.today.5': 'Saved tasks you can run by name, reminders, PDF reading, image attachments and on-phone image filters, downloads and CSV export',
  'status.today.6': 'Reader mode, read aloud, voice input, ad and tracker blocking with your own rules, encrypted backup',
  'status.today.7': 'Ten interface languages (English, Turkish, German, Spanish, Brazilian Portuguese, French, Japanese, Korean, Russian, Indonesian), following the phone or chosen in Settings; labels for screen readers and room for large text',
  'status.today.8': 'Your own styles for sites, a page’s cookie list whose values never go to the AI, and scripts on pages (off by default, approved with the code shown)',
  'status.today.9': 'Small apps the assistant writes for you inside Qutai: offline, kept apart from your browsing, with versions to go back to',
  'status.limits': 'Limits to know',
  'status.limits.1': 'Background tasks are Android-only and opt-in, with a notification when a task ends or needs you; on iPhone a task pauses when you leave the app',
  'status.limits.2': 'Scheduled tasks are reminders: nothing runs while Qutai is closed',
  'status.limits.3': 'You complete payments yourself, unless you let the assistant pay; then each payment waits for your approval in Qutai’s window',
  'status.limits.4': 'Sharing to Qutai and the home screen widget are Android-only for now',
  'status.limits.5': 'A script you approve on the live page can do what the site’s own code can do, with your sign-in there; questions that only read the page run on a sealed copy instead',
  'status.limits.6': 'Apps have no internet and no phone features such as location, camera or notifications yet',
  'status.limits.7':
    'Hidden instructions on web pages: we test against pages built to mislead the assistant and keep tightening the app’s own checks, but we are not perfect. Paying, posting, deleting, account changes, calls and messages always wait for your tap, yet the assistant can still be misled into a slanted summary, a bad link or a step that needs no approval. Read what an approval says before you tap, and treat the assistant’s summary of an unfamiliar page as a summary, not a verdict',
  'status.planned': 'Planned',
  'status.planned.1': 'Release in the App Store and Google Play',
  'status.planned.2': 'End-to-end encrypted sync for those who choose an account',
  'status.planned.3': 'Buying Qutai Credits in the App Store and Google Play',
  'status.planned.4': 'Share extension and widget on iPhone',
  'status.planned.5': 'For apps: phone features such as location, notifications and the camera, internet for sites you choose, a home-screen shortcut',

  'footer.tagline': 'Agentic Browser',
  'footer.privacy':
    'This website makes no requests to other servers and sets no cookies, except one that remembers your language if you switch it.',
  'footer.licenseNote': 'The code is licensed under Apache-2.0.',
  'footer.github': 'GitHub',
  'footer.issues': 'Issues',
  'footer.license': 'Licence',
  'footer.appPrivacy': 'App privacy policy',
  'footer.terms': 'App terms of use',
  'footer.deleteAccount': 'Delete your account',
  'footer.support': 'Support',

  'policy.metaTitle': 'Privacy Policy · Qutai',
  'policy.metaDescription':
    'The privacy policy of the Qutai app: what stays on your phone, what leaves it and to whom, your Qutai account and Qutai Credits.',
  'policy.updated': 'Last updated',
  'policy.note': 'This is the privacy policy of the Qutai app for iPhone and Android, the same text the app shows.',
  'policy.home': 'Back to the Qutai home page',

  'terms.metaTitle': 'Terms of Use · Qutai',
  'terms.metaDescription':
    'The terms of use of the Qutai app: your AI key and Qutai Credits, websites, the assistant, ad blocking, page styles and scripts, apps, downloads, acceptable use and your rights.',
  'terms.note': 'These are the terms of use of the Qutai app for iPhone and Android, the same text the app shows.',

  'deletion.metaTitle': 'Delete your Qutai account · Qutai',
  'deletion.metaDescription': 'How to delete your Qutai account and its data, in the app or by email without the app, and what is deleted and kept.',
  'deletion.title': 'Delete your Qutai account',
  'deletion.intro': 'This page is for the Qutai app for iPhone and Android. You can delete your Qutai account and the data kept with it on Qutai’s server at any time, in the app or, without the app, by email.',
  'deletion.inApp.heading': 'In the app',
  'deletion.inApp.body': '• Open Qutai, then Settings › Account.\n• Tap Delete account and confirm.\n• If you signed in with Apple, your iPhone asks you to confirm with Apple once more, so Qutai can also withdraw its access at Apple.\nThe account is deleted at once and you are signed out on every device.',
  'deletion.byEmail.heading': 'Without the app',
  'deletion.byEmail.body': 'Write to {email} from the email address you use for Qutai (for an Apple or Google sign-in, the address shown under Settings › Account), with the subject “Delete my Qutai account”. We may send a code to that address to make sure the request is yours. We delete the account within 30 days, usually much sooner, and write back when it is done.',
  'deletion.deleted.heading': 'What is deleted',
  'deletion.deleted.body': '• Your account, its sign-in methods (Apple, Google, email) and their addresses\n• Your sessions on every device\n• Your Qutai Credits balance and credit history. Unused credits are lost and are not refunded, except where the law or the store requires it\n• Backups you kept on Qutai’s server\n• Your customer record at the payments service (RevenueCat)',
  'deletion.kept.heading': 'What is kept',
  'deletion.kept.body': '• Purchase records, for as long as tax law requires, without any link to you\n• Reports you sent about an answer or an app, without your account, until they are deleted after 180 days\n• What is stored on your phone stays until you clear it (Settings › Clear browsing data) or remove the app\n• If you used your own AI key, what you sent to that AI provider is covered by the provider’s own terms',
  'deletion.noAccount.heading': 'Using Qutai without an account',
  'deletion.noAccount.body': 'If you only use your own AI key and never signed in, Qutai has no account of yours on its server. Everything is on your phone: clear it in Settings › Clear browsing data, or remove the app.',
  'deletion.home': 'Back to the Qutai home page',

  'support.metaTitle': 'Support · Qutai',
  'support.metaDescription': 'Help with the Qutai app for iPhone and Android: how to reach us, what to include in your message, and answers to common questions.',
  'support.title': 'Qutai support',
  'support.intro': 'Help with the Qutai app for iPhone and Android.',
  'support.contact.heading': 'Contact us',
  'support.contact.body': 'Write to {email}. We usually answer within a few working days.',
  'support.include.heading': 'What to include',
  'support.include.body': '• The app version, from Settings › About\n• Your phone model\n• What you did, what happened and what you expected; a screenshot helps\nPlease never send passwords, card numbers or one-time codes.',
  'support.faq.heading': 'Common questions',
  'support.signIn.q': 'How do I sign in to use Qutai Credits?',
  'support.signIn.a': 'Choose Qutai Credits during setup, or open Settings › Account, and sign in with Apple, Google or a code sent to your email (the choices depend on your phone). Qutai Credits need a Qutai account; your own AI key doesn’t.',
  'support.credits.q': 'Where are the credits I bought?',
  'support.credits.a': 'Credits belong to your Qutai account, not to the phone. You see the balance in Settings › Account › Qutai Credits, and it is there on any phone where you sign in with the same account.',
  'support.missing.q': 'I paid, but the credits didn’t arrive',
  'support.missing.a': 'Open Settings › Account › Qutai Credits and tap Check for missing credits: Qutai looks for store purchases that weren’t credited and adds them. Credits aren’t a subscription, so there is no Restore purchases button; this is the way to recover them. If they are still missing, write to us with the date of the purchase.',
  'support.ownKey.q': 'Can I use my own AI key instead?',
  'support.ownKey.a': 'Yes. In Settings › Assistant, choose a provider and add your key. Requests then go from your phone straight to that provider, and no credits are used.',
  'support.report.q': 'How do I report an answer or an app?',
  'support.report.a': 'Open the ⋮ menu under the assistant’s answer, or the menu of an app in My apps or of a running app, and choose Report. Pick a reason; the answer’s text, or the app’s name and code, goes with the report only if you leave that box ticked. Reports go to Qutai’s team.',
  'support.delete.q': 'How do I delete my account?',
  'support.delete.a': 'In the app: Settings › Account › Delete account. Without the app, by email: see {deleteLink}.',
  'support.deleteLink': 'Delete your Qutai account',
  'support.privacy.q': 'What happens to my data?',
  'support.privacy.a': 'Your tabs, history, conversations and memory are stored only on your phone. What leaves it, where it goes and why is in the {privacyLink}.',
  'support.openSource.q': 'Is this the same app as the open-source code?',
  'support.openSource.a': 'The whole app is open source. A build you make from the repository works with your own AI key only: it has no account and no Qutai Credits, and never contacts Qutai’s server. The official builds add the account and Qutai Credits.',
  'support.home': 'Back to the Qutai home page',

  'notFound.title': 'Page not found',
  'notFound.body': 'This page does not exist.',
  'notFound.home': 'Go to the home page',
} as const;

export type MessageKey = keyof typeof en;
export type Messages = { readonly [K in MessageKey]: string };
