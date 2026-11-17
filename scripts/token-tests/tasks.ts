/**
 * Representative assistant tasks as scripted tool loops: what the model answers at each step (text and tool calls)
 * and what each tool returns, in the formats src/agent/executeTool.ts produces. The replay (simulate.ts) sends them
 * through the app's real request code, so the request bodies are the ones the app would send.
 */
import { formPage, listPage, productPage, readArticle, shortPage } from './fixtures';

export type ScriptedCall = { name: string; input: Record<string, unknown>; result: string; isError?: boolean; screenshot?: boolean };
export type ScriptedStep = { text?: string; calls: ScriptedCall[] };
export type ScriptedMessage = { user: string; tab: { id: string; title: string; url: string }; steps: ScriptedStep[] };
export type Task = { id: string; name: string; memory?: boolean; messages: ScriptedMessage[] };

const ARTICLE = { tab: 't1', url: 'https://news.example/2026/11/energy-prices-winter' };

export const TASKS: Task[] = [
  {
    id: 'plain',
    name: 'Plain question',
    messages: [
      {
        user: 'What is the difference between a heat pump and an air conditioner?',
        tab: { id: 't1', title: 'New tab', url: 'about:blank' },
        steps: [{ text: 'A heat pump moves heat in both directions: it can heat and cool. An air conditioner only cools. ' + 'Both use the same refrigerant cycle; a heat pump adds a reversing valve.', calls: [] }],
      },
    ],
  },
  {
    id: 'summarise',
    name: 'Read and summarise a long article',
    messages: [
      {
        user: 'Summarise this article in five bullet points.',
        tab: { id: 't1', title: 'Energy prices this winter', url: ARTICLE.url },
        steps: [
          { calls: [{ name: 'read_page', input: {}, result: readArticle(11, ARTICLE) }] },
          { calls: [{ name: 'read_page', input: { offset: 140 }, result: readArticle(11, { ...ARTICLE, offset: 140 }) }] },
          { text: summary(5), calls: [] },
        ],
      },
    ],
  },
  {
    id: 'form',
    name: 'Fill in a form (clicks and typing)',
    messages: [
      {
        user: 'Fill in the contact form: my name is Deniz Kaya, email deniz@example.com, topic Delivery, order AB123456, ' + 'message: my parcel has not arrived after ten days. Untick the newsletter. Do not send it yet.',
        tab: { id: 't1', title: 'Contact us', url: 'https://shop.example/contact' },
        steps: [
          { calls: [{ name: 'read_page', input: {}, result: formPage(21) }] },
          { calls: [{ name: 'type', input: { ref: 20, text: 'Deniz Kaya' }, result: 'Typed into ref=20 (input:text "Full name").' }] },
          { calls: [{ name: 'type', input: { ref: 21, text: 'deniz@example' }, result: 'Typed into ref=21 (input:email "Email").\nThe field reports an error:\n- ref=21: Please enter a part following \'@\'.\nFix these before submitting again.' }] },
          { calls: [{ name: 'type', input: { ref: 21, text: 'deniz@example.com' }, result: 'Typed into ref=21 (input:email "Email").' }] },
          { calls: [{ name: 'select_option', input: { ref: 23, value: 'Delivery' }, result: 'Selected "Delivery" in ref=23 (select "Topic").' }] },
          { calls: [{ name: 'type', input: { ref: 24, text: 'AB123456' }, result: 'Typed into ref=24 (input:text "Order number").' }] },
          { calls: [{ name: 'type', input: { ref: 25, text: 'My parcel has not arrived after ten days.' }, result: 'Typed into ref=25 (textarea "Your message").' }] },
          { calls: [{ name: 'click', input: { ref: 26 }, result: 'Clicked ref=26 (input:checkbox "Send me offers and news by email"): now unchecked.' }] },
          {
            calls: [
              {
                name: 'read_page',
                input: {},
                result: formPage(21, { values: { name: 'Deniz Kaya', email: 'deniz@example.com', topic: 'Delivery', order: 'AB123456', message: 'My parcel has not arrived after ten days.' }, ticked: false }),
              },
            ],
          },
          { text: 'The form is filled in: name, email, topic Delivery, order AB123456 and your message; the newsletter box is unticked. ' + 'The privacy policy box still needs ticking before it can be sent. Shall I tick it and send?', calls: [] },
        ],
      },
    ],
  },
  {
    id: 'two-tabs',
    name: 'Compare across two tabs',
    messages: [
      {
        user: 'Compare the first two headphones in these results on battery life and price, and tell me which is better value.',
        tab: { id: 't1', title: 'Wireless headphones', url: 'https://shop.example/search?q=wireless+headphones' },
        steps: [
          { calls: [{ name: 'read_page', input: {}, result: listPage(31, { tab: 't1', url: 'https://shop.example/search?q=wireless+headphones', title: 'Wireless headphones' }) }] },
          {
            calls: [
              { name: 'open_tab', input: { url: 'https://shop.example/p/31-0' }, result: 'Opened tab t2 (https://shop.example/p/31-0) in the background. Read it with read_tab.' },
              { name: 'open_tab', input: { url: 'https://shop.example/p/31-1' }, result: 'Opened tab t3 (https://shop.example/p/31-1) in the background. Read it with read_tab.' },
            ],
          },
          { calls: [{ name: 'read_tab', input: { tab_id: 't2' }, result: productPage(32, { tab: 't2', url: 'https://shop.example/p/31-0', title: 'Headphones A' }, 'read_tab') }] },
          { calls: [{ name: 'take_notes', input: { notes: 'A: 189 EUR, 40 h battery, 4.4 stars (812 reviews).' }, result: 'Notes saved.' }] },
          { calls: [{ name: 'read_tab', input: { tab_id: 't3' }, result: productPage(33, { tab: 't3', url: 'https://shop.example/p/31-1', title: 'Headphones B' }, 'read_tab') }] },
          { calls: [{ name: 'close_tabs', input: { tab_ids: ['t2', 't3'], keep_tab_id: 't1' }, result: 'Closed 2 tabs.' }] },
          { text: 'Headphones A: 189 EUR, 40 hours. Headphones B: 149 EUR, 30 hours. B costs 21 % less for 25 % less battery; ' + 'A is better value per hour of battery, B if you rarely go past a day without charging.', calls: [] },
        ],
      },
    ],
  },
  {
    id: 'memory-task',
    name: 'Saved task with memory, then a follow-up',
    memory: true,
    messages: [
      {
        user: 'Run my saved task "weekly groceries".',
        tab: { id: 't1', title: 'New tab', url: 'about:blank' },
        steps: [
          { calls: [{ name: 'get_saved_task', input: { name: 'weekly groceries' }, result: 'Saved task "Weekly groceries":\nOpen my usual supermarket, search for oat milk, wholemeal bread and bananas, and tell me the cheapest of each.' }] },
          { calls: [{ name: 'search_history', input: { by_site: true, keywords: 'supermarket' }, result: 'Most visited sites matching "supermarket":\n1. market.example (41 visits)\n2. grocer.example (7 visits)' }] },
          { calls: [{ name: 'navigate', input: { url: 'https://market.example/search?q=oat+milk' }, result: 'Opened https://market.example/search?q=oat+milk. Call read_page to see it.' }] },
          { calls: [{ name: 'read_page', input: {}, result: listPage(41, { tab: 't1', url: 'https://market.example/search?q=oat+milk', title: 'oat milk' }, 24) }] },
          { calls: [{ name: 'navigate', input: { url: 'https://market.example/search?q=wholemeal+bread' }, result: 'Opened https://market.example/search?q=wholemeal+bread. Call read_page to see it.' }] },
          { calls: [{ name: 'read_page', input: {}, result: listPage(42, { tab: 't1', url: 'https://market.example/search?q=wholemeal+bread', title: 'wholemeal bread' }, 24) }] },
          { calls: [{ name: 'navigate', input: { url: 'https://market.example/search?q=bananas' }, result: 'Opened https://market.example/search?q=bananas. Call read_page to see it.' }] },
          { calls: [{ name: 'read_page', input: {}, result: listPage(43, { tab: 't1', url: 'https://market.example/search?q=bananas', title: 'bananas' }, 24) }] },
          { calls: [{ name: 'remember', input: { text: 'Usual supermarket: market.example', category: 'shopping' }, result: 'Remembered.' }] },
          { text: 'Cheapest at market.example: oat milk 1.19 EUR (1 l), wholemeal bread 1.49 EUR (500 g), bananas 1.29 EUR per kg.', calls: [] },
        ],
      },
      {
        user: 'Add all three to the basket.',
        tab: { id: 't1', title: 'bananas', url: 'https://market.example/search?q=bananas' },
        steps: [
          { calls: [{ name: 'click', input: { ref: 31 }, result: 'Clicked ref=31 (button "Add to basket").' }] },
          { calls: [{ name: 'navigate', input: { url: 'https://market.example/search?q=oat+milk' }, result: 'Opened https://market.example/search?q=oat+milk. Call read_page to see it.' }] },
          { calls: [{ name: 'read_page', input: {}, result: listPage(41, { tab: 't1', url: 'https://market.example/search?q=oat+milk', title: 'oat milk' }, 24) }] },
          { calls: [{ name: 'click', input: { ref: 31 }, result: 'Clicked ref=31 (button "Add to basket").' }] },
          { calls: [{ name: 'navigate', input: { url: 'https://market.example/search?q=wholemeal+bread' }, result: 'Opened https://market.example/search?q=wholemeal+bread. Call read_page to see it.' }] },
          { calls: [{ name: 'read_page', input: {}, result: listPage(42, { tab: 't1', url: 'https://market.example/search?q=wholemeal+bread', title: 'wholemeal bread' }, 24) }] },
          { calls: [{ name: 'click', input: { ref: 31 }, result: 'Clicked ref=31 (button "Add to basket").' }] },
          { text: 'All three are in the basket.', calls: [] },
        ],
      },
    ],
  },
  {
    id: 'long',
    name: 'Long task: six pages, notes, two screenshots',
    messages: [
      {
        user: 'Find a 4-star hotel in Lisbon for 12–14 December under 150 EUR a night with breakfast, check three options, ' + 'and give me a short comparison.',
        tab: { id: 't1', title: 'New tab', url: 'about:blank' },
        steps: [
          { calls: [{ name: 'navigate', input: { url: 'https://hotels.example/search?city=lisbon&in=2026-12-12&out=2026-12-14' }, result: 'Opened https://hotels.example/search?city=lisbon. Call read_page to see it.' }] },
          { calls: [{ name: 'read_page', input: {}, result: listPage(51, { tab: 't1', url: 'https://hotels.example/search?city=lisbon', title: 'Hotels in Lisbon' }) }] },
          { calls: [{ name: 'click', input: { ref: 18 }, result: 'Clicked ref=18 (button "Filter").' }] },
          { calls: [{ name: 'view_screenshot', input: {}, result: 'Screenshot of the visible part of tab t1.', screenshot: true }] },
          { calls: [{ name: 'read_page', input: {}, result: listPage(52, { tab: 't1', url: 'https://hotels.example/search?city=lisbon&stars=4&breakfast=1', title: 'Hotels in Lisbon' }) }] },
          { calls: [{ name: 'open_tab', input: { url: 'https://hotels.example/h/52-0' }, result: 'Opened tab t2 (https://hotels.example/h/52-0) in the background. Read it with read_tab.' }] },
          { calls: [{ name: 'read_tab', input: { tab_id: 't2' }, result: productPage(53, { tab: 't2', url: 'https://hotels.example/h/52-0', title: 'Hotel Alfama' }, 'read_tab') }] },
          { calls: [{ name: 'take_notes', input: { notes: 'Alfama: 138 EUR/night, breakfast incl., 8.7, free cancellation to 10 Dec.' }, result: 'Notes saved.' }] },
          { calls: [{ name: 'open_tab', input: { url: 'https://hotels.example/h/52-1' }, result: 'Opened tab t3 (https://hotels.example/h/52-1) in the background. Read it with read_tab.' }] },
          { calls: [{ name: 'read_tab', input: { tab_id: 't3' }, result: productPage(54, { tab: 't3', url: 'https://hotels.example/h/52-1', title: 'Hotel Chiado' }, 'read_tab') }] },
          { calls: [{ name: 'take_notes', input: { notes: 'Chiado: 146 EUR/night, breakfast 12 EUR extra, 9.0, non-refundable.' }, result: 'Notes saved.' }] },
          { calls: [{ name: 'open_tab', input: { url: 'https://hotels.example/h/52-2' }, result: 'Opened tab t4 (https://hotels.example/h/52-2) in the background. Read it with read_tab.' }] },
          { calls: [{ name: 'read_tab', input: { tab_id: 't4' }, result: productPage(55, { tab: 't4', url: 'https://hotels.example/h/52-2', title: 'Hotel Belem' }, 'read_tab') }] },
          { calls: [{ name: 'view_screenshot', input: {}, result: 'Screenshot of the visible part of tab t1.', screenshot: true }] },
          { calls: [{ name: 'take_notes', input: { notes: 'Belem: 129 EUR/night, breakfast incl., 8.4, free cancellation to 11 Dec.' }, result: 'Notes saved.' }] },
          { calls: [{ name: 'read_page', input: {}, result: shortPage(56, { tab: 't1', url: 'https://hotels.example/search?city=lisbon&stars=4&breakfast=1', title: 'Hotels in Lisbon' }) }] },
          { calls: [{ name: 'close_tabs', input: { tab_ids: ['t2', 't3', 't4'], keep_tab_id: 't1' }, result: 'Closed 3 tabs.' }] },
          { text: summary(4), calls: [] },
        ],
      },
    ],
  },
];

function summary(n: number): string {
  return Array.from({ length: n }, (_, i) => `- Point ${i + 1}: prices this winter are expected to stay about 12 % above last year, with the largest rises in December.`).join('\n');
}
