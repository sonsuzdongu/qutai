/**
 * English copy. `tr.ts` must have exactly these keys (TypeScript checks it).
 * Strings marked "app:" are the app's own UI strings (src/i18n/en.ts in the app), used in the phone mock
 * so it shows the product as it is.
 */
export const en = {
  'meta.title': 'Qutai: an AI browser that uses the page for you',
  'meta.description':
    'Qutai is an open-source AI browser for iPhone and Android. Its assistant reads and uses pages for you with your own AI key, keeps your data on your phone and asks before sensitive actions. In development.',
  'meta.ogAlt': 'The Qutai logo, a blue Q, next to the words: an AI browser that uses the page for you.',
  'meta.appDescription':
    'An open-source AI browser for iOS and Android whose assistant reads and uses web pages for you, with your own AI provider key.',

  'nav.skip': 'Skip to content',
  'nav.label': 'Sections',
  'nav.agent': 'What it does',
  'nav.privacy': 'Privacy',
  'nav.browser': 'Browser',
  'nav.compare': 'Compare',
  'nav.openSource': 'Open source',
  'nav.status': 'Status',
  'nav.github': 'GitHub',
  'nav.home': 'Qutai home',

  'lang.label': 'Language',
  'lang.current': 'English',
  'lang.other': 'Türkçe',
  'lang.otherShort': 'TR',
  'lang.switchTo': 'Türkçe sürüme geç',

  'hero.eyebrow': 'AI browser for iPhone and Android',
  'hero.title': 'A browser whose assistant reads the page and uses it for you.',
  'hero.lede':
    'Ask Qutai to compare, fill in, book or look something up. It works in your own tabs with your own AI key, keeps your data on your phone, and asks before anything that matters.',
  'hero.github': 'View on GitHub',
  'hero.status': 'In development. Coming to the App Store and Google Play; not released yet.',

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
  'mock.placeholder': 'Give Qutai a task…', // app: chat.placeholder

  'agent.kicker': 'The assistant',
  'agent.title': 'Hand it the tedious part.',
  'agent.lede':
    'Qutai’s assistant works in your tabs: it reads pages, taps, types, opens and compares tabs, step by step. Every step is shown as it happens, and you can stop it at any time.',
  'agent.compare.title': 'Compare products across tabs',
  'agent.compare.body':
    'Open two or three product pages and ask which one fits. Qutai reads each tab without switching away, notes prices, delivery times and specs, and answers with a table.',
  'agent.compare.step1': 'Reading tab 2',
  'agent.compare.step2': 'Reading tab 3',
  'agent.compare.step3': 'Price, delivery, warranty side by side',
  'agent.checkout.title': 'Fill the checkout, stop before payment',
  'agent.checkout.body':
    'It enters your name, address and the delivery note you saved, after asking whether it may use your remembered details on that site. At the payment step it stops: the assistant never types card numbers, passwords or one-time codes. You pay yourself.',
  'agent.checkout.step1': 'Enter your personal information on shop.example?', // app: personal.title
  'agent.checkout.step2': 'Typed into [12]', // app: action.typeRedacted
  'agent.checkout.step3': 'Stopped at payment: over to you',
  'agent.booking.title': 'Book it, then put it in your calendar',
  'agent.booking.body':
    'Find a table or an appointment and fill in the form. Afterwards Qutai offers to add it to your calendar or set a reminder, showing the details for you to approve. When a place takes bookings by phone, you get a Call button and dial yourself.',
  'agent.booking.step1': 'Calendar event: Dinner, Friday 20:00', // app: action.addCalendarEvent
  'agent.booking.callName': 'Kebap House',
  'agent.booking.callNumber': '+90 212 555 01 23',
  'agent.booking.call': 'Call', // app: chat.call
  'agent.research.title': 'Research with sources',
  'agent.research.body':
    'Deep research searches and reads many pages, takes notes and writes a report with its sources listed under the answer. Share it as a PDF. It takes a few minutes and uses more of your API credit.',
  'agent.research.step1': 'Searched: e-bike rules in Istanbul', // app: action.webSearch
  'agent.research.step2': 'Reading the page',
  'agent.research.step3': 'Sources',
  'agent.footnote':
    'What the assistant manages depends on the model you choose and on the site. These are examples of what the code supports; most of it has not yet been tested on a real phone.',

  'privacy.kicker': 'Privacy by design',
  'privacy.title': 'Your key. Your phone. Your say.',
  'privacy.lede':
    'There is no Qutai account and no Qutai server between you and the AI. Requests go from your phone straight to the provider you picked.',
  'privacy.diagramLabel':
    'Diagram: your phone sends requests directly to the AI provider you chose. There is no Qutai server in between.',
  'privacy.diagramPhone': 'Your phone',
  'privacy.diagramPhoneSub': 'tabs, history, memory, chats',
  'privacy.diagramProvider': 'The AI provider you chose',
  'privacy.diagramProviderSub': 'with your own key',
  'privacy.diagramNone': 'No Qutai server',
  'privacy.key.title': 'Bring your own AI key',
  'privacy.key.body':
    'Use a key from Anthropic, OpenAI, Google Gemini or OpenRouter, or your own OpenAI-compatible server (Ollama, LM Studio, vLLM). Choose the model, even per conversation.',
  'privacy.device.title': 'Stays on the phone',
  'privacy.device.body':
    'Tabs, history, bookmarks, chats and the assistant’s memory are stored on the device. Passwords, card numbers and one-time codes are never put in memory.',
  'privacy.sites.title': 'Permissions per site',
  'privacy.sites.body':
    'For each site, the assistant may act freely, ask before every action, only read, or stay out. Separately, you decide whether it may enter your remembered details there.',
  'privacy.log.title': 'What was sent to the AI',
  'privacy.log.body':
    'A list of every request: when, which provider and model, which site, and what went with it. The content itself is kept only in memory until the app closes.',
  'privacy.incognito.title': 'Incognito means nothing saved',
  'privacy.incognito.body':
    'Incognito tabs keep no history, and conversations that touch them stay in memory only. Memory, location and calendar are off there, and the incognito tabs can be locked.',
  'privacy.confirm.title': 'Asks before it matters',
  'privacy.confirm.body':
    'Sensitive actions need your yes. Calendar writes, location and notifications are confirmed every time; calls, texts and emails are only drafts that you send.',
  'privacy.note':
    'The open-source build will never use a Qutai server. Optional paid features (an account, sync, Qutai credits) are planned for the store builds and would use one only for those features.',

  'browser.kicker': 'And a browser too',
  'browser.title': 'Everything you expect from a browser, minus the tracking.',
  'browser.tabs.title': 'Tabs and groups',
  'browser.tabs.body': 'A tab group shares one conversation with the assistant. Idle tabs sleep to save memory.',
  'browser.reader.title': 'Reader mode and read aloud',
  'browser.reader.body':
    'Light, dark or sepia, serif or sans, easier-reading spacing. Read aloud follows the article paragraph by paragraph.',
  'browser.blocking.title': 'Ad and tracker blocking',
  'browser.blocking.body':
    'Pick EasyList, EasyPrivacy or AdGuard Turkish, or add any list by its address. Lists are downloaded on the phone; rules that block whole domains are used.',
  'browser.audio.title': 'Plays in the background',
  'browser.audio.body':
    'Audio keeps playing with the screen locked. On iPhone, video pauses unless it is in picture-in-picture.',
  'browser.private.title': 'Incognito tabs',
  'browser.private.body': 'Their own cookies and site data, gone when you close them, with an optional biometric lock.',
  'browser.backup.title': 'Encrypted backup',
  'browser.backup.body':
    'No account, no sync: export everything to one password-protected file and import it on another phone.',
  'browser.bookmarks.title': 'Bookmarks in folders',
  'browser.bookmarks.body': 'Import the file Chrome, Firefox, Safari or Edge exports, and export the same format.',
  'browser.voice.title': 'Voice input',
  'browser.voice.body':
    'Dictate tasks with the phone’s own speech recognition, on the device when the phone and language allow.',
  'browser.save.title': 'PDF and full-page screenshots',
  'browser.save.body': 'Save a page as PDF or a stitched screenshot of the whole page, or keep it for offline reading.',

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
  'compare.desktop': 'Desktop only',
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
    'We looked at each browser’s iPhone and Android app, not its desktop version. A feature that exists only on desktop is marked “Desktop only”.',
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
  'oss.trademark':
    'The licence covers the code. The Qutai name and logo are trademarks: a fork you publish needs its own name and icons, as TRADEMARKS.md explains.',
  'oss.repo': 'Repository',
  'oss.license': 'Licence',
  'oss.trademarks': 'Trademarks',

  'status.kicker': 'Status',
  'status.title': 'Where it stands, honestly.',
  'status.body':
    'Qutai is in development. It is not in the App Store or Google Play yet, and most of what this page describes is implemented in the code but has not yet been tested on a real phone.',
  'status.today': 'In the code today',
  'status.today.1': 'The assistant: reading, tapping, typing, tabs, deep research with sources',
  'status.today.2': 'Five provider options with your own key, and a model per conversation',
  'status.today.3': 'Memory with categories, per-site permissions, the “sent to the AI” log',
  'status.today.4': 'Calendar, reminders, Call button, text, WhatsApp and email drafts',
  'status.today.5': 'Saved tasks and reminders that open them at a set time',
  'status.today.6': 'Reader mode, read aloud, ad and tracker blocking, encrypted backup',
  'status.limits': 'Limits to know',
  'status.limits.1': 'Background tasks are Android-only and opt-in; on iPhone a task pauses when you leave the app',
  'status.limits.2': 'Scheduled tasks are reminders: nothing runs while Qutai is closed',
  'status.limits.3': 'Payments are always completed by you',
  'status.limits.4': 'Sharing to Qutai, the widget and home screen shortcuts are Android-only for now',
  'status.planned': 'Planned',
  'status.planned.1': 'Release in the App Store and Google Play',
  'status.planned.2': 'Optional account with end-to-end encrypted sync',
  'status.planned.3': 'Qutai credits as an alternative to your own key',
  'status.planned.4': 'Share extension and widget on iPhone',

  'footer.tagline': 'An AI browser that uses the page for you.',
  'footer.privacy':
    'This website makes no requests to other servers and sets no cookies, except one that remembers your language if you switch it.',
  'footer.trademark': 'Qutai and the Qutai logo are trademarks of Osman Yuksel. The code is licensed under Apache-2.0.',
  'footer.github': 'GitHub',
  'footer.issues': 'Issues',
  'footer.license': 'Licence',
  'footer.trademarks': 'Trademarks',
  'footer.appPrivacy': 'App privacy policy',

  'notFound.title': 'Page not found',
  'notFound.body': 'This page does not exist.',
  'notFound.home': 'Go to the home page',
} as const;

export type MessageKey = keyof typeof en;
export type Messages = { readonly [K in MessageKey]: string };
