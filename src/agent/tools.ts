import type { ToolDefinition } from './types';

/** Offered only while memory is turned on in settings. */
export const MEMORY_TOOLS: ToolDefinition[] = [
  {
    name: 'remember',
    description:
      'Save one lasting fact about the user for future conversations (stored on their phone; they can see and delete it in settings). ' +
      'Only facts the user told you themselves. Never passwords, one-time codes or payment card details.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'One short, self-contained fact, e.g. "Phone: +90 555 123 45 67"' },
      },
      required: ['text'],
    },
  },
  {
    name: 'forget',
    description: 'Delete a saved memory by its id (shown in brackets in the memory list).',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The memory id' } },
      required: ['id'],
    },
  },
];

export const TOOLS: ToolDefinition[] = [
  {
    name: 'read_page',
    description:
      'Read the current page as text. Interactive elements are listed as "[ref=N] kind "label"". ' +
      'Refs are only valid until the page changes; call this again after navigating or when an action fails. ' +
      'Long pages are split into chunks; pass the offset given at the end of the previous result to continue.',
    input_schema: {
      type: 'object',
      properties: {
        offset: { type: 'integer', description: 'Line to start reading from (default 0)' },
      },
    },
  },
  {
    name: 'read_source',
    description:
      "Read the current page's HTML source (as it is now in the DOM, so changes made by scripts are included). " +
      'Use this when the user asks about the source code; view-source: URLs cannot be opened. ' +
      'Pass a CSS selector to get only matching elements, e.g. "script:not([src])" for inline scripts or ' +
      '"style, link[rel=stylesheet]" for styles. ' +
      'Long sources are split into chunks; pass the offset given at the end of the previous result to continue.',
    input_schema: {
      type: 'object',
      properties: {
        offset: { type: 'integer', description: 'Character to start reading from (default 0)' },
        selector: { type: 'string', description: 'CSS selector; omit for the whole page' },
      },
    },
  },
  {
    name: 'navigate',
    description: 'Open a URL in the browser. Use full URLs (https://...).',
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'The URL to open' } },
      required: ['url'],
    },
  },
  {
    name: 'go_back',
    description: 'Go back to the previous page in history.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'click',
    description: 'Click (tap) an element by its ref from read_page.',
    input_schema: {
      type: 'object',
      properties: { ref: { type: 'integer', description: 'Element ref' } },
      required: ['ref'],
    },
  },
  {
    name: 'type',
    description: 'Type text into an input, textarea or contenteditable element.',
    input_schema: {
      type: 'object',
      properties: {
        ref: { type: 'integer', description: 'Element ref' },
        text: { type: 'string', description: 'Text to type' },
        clear: { type: 'boolean', description: 'Replace existing content (default true)' },
        submit: { type: 'boolean', description: 'Press Enter / submit the form afterwards (default false)' },
      },
      required: ['ref', 'text'],
    },
  },
  {
    name: 'select_option',
    description: 'Choose an option in a <select> element by option value or visible text.',
    input_schema: {
      type: 'object',
      properties: {
        ref: { type: 'integer', description: 'Element ref of the <select>' },
        value: { type: 'string', description: 'Option value or visible text' },
      },
      required: ['ref', 'value'],
    },
  },
  {
    name: 'scroll',
    description: 'Scroll the page. Useful for lazy-loaded content.',
    input_schema: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['up', 'down', 'top', 'bottom'] },
        amount: { type: 'number', description: 'Number of screens to scroll (default 1)' },
      },
      required: ['direction'],
    },
  },
  {
    name: 'scroll_to',
    description: 'Scroll an element into view so the user can see it.',
    input_schema: {
      type: 'object',
      properties: { ref: { type: 'integer', description: 'Element ref' } },
      required: ['ref'],
    },
  },
  {
    name: 'view_screenshot',
    description:
      'Look at the visible part of the current page as an image. Use it when the text from read_page is not enough: ' +
      'images, charts, maps, canvas content, layout, colours or visual state. Scroll first to see other parts.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'save_pdf',
    description:
      'Turn the current page into a PDF and open the system share sheet, where the user can save it (e.g. to Files) or send it. ' +
      'Use when the user asks for a PDF, a printable copy, or to save the page as a document.',
    input_schema: {
      type: 'object',
      properties: {
        from_screenshots: {
          type: 'boolean',
          description:
            'Build the PDF from screenshots of the whole page instead of its HTML (text is not selectable). ' +
            'Only when the user says the normal PDF looked wrong or empty, or the page is mostly a canvas, map or app-like drawing.',
        },
      },
    },
  },
  {
    name: 'save_screenshot',
    description:
      "Save a screenshot of the current page to the user's photo library: the visible part, or the whole page with full_page. " +
      'Scroll first if the user wants a specific part of the page.',
    input_schema: {
      type: 'object',
      properties: {
        full_page: {
          type: 'boolean',
          description:
            'Scroll through the whole page and save it as one tall image (very long pages are split into several images or cut off). ' +
            'Only when the user asks for the whole or full page.',
        },
      },
    },
  },
  {
    name: 'read_aloud',
    description:
      "Read text aloud with the device's text-to-speech voice. Pass `text` to read something you wrote (e.g. a summary); " +
      "omit it to read the main content of the current page. Reading continues after you reply; it doesn't block.",
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to read. Omit to read the current page.' },
        language: { type: 'string', description: 'BCP 47 language code of the text, e.g. "tr-TR" or "en-US"' },
      },
    },
  },
  {
    name: 'list_tabs',
    description: 'List open tabs with their ids, titles and URLs, and which one you are working in.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'open_tab',
    description: 'Open a URL in a new tab and switch to it. Use this to keep the current page while comparing others.',
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'The URL to open' } },
      required: ['url'],
    },
  },
  {
    name: 'read_tab',
    description:
      'Read another open tab as text without switching to it, e.g. to compare pages. Same format as read_page; ' +
      'its refs are only usable after switch_tab. Long pages are split; pass the offset from the previous result.',
    input_schema: {
      type: 'object',
      properties: {
        tab_id: { type: 'string', description: 'Tab id from list_tabs' },
        offset: { type: 'integer', description: 'Line to start reading from (default 0)' },
      },
      required: ['tab_id'],
    },
  },
  {
    name: 'click_at',
    description:
      'Click a point of the latest view_screenshot, for things without a ref (maps, canvases, image buttons). ' +
      'x and y are pixels in that screenshot. Prefer click with a ref whenever read_page lists the element.',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'Horizontal position in screenshot pixels' },
        y: { type: 'number', description: 'Vertical position in screenshot pixels' },
      },
      required: ['x', 'y'],
    },
  },
  {
    name: 'search_history',
    description:
      "Search the user's browsing history on this phone (normal tabs only) by words in page titles and addresses, " +
      'e.g. when they ask about a page they saw before. Turn their description into short keywords and an optional ' +
      'time range in days ago. Returns matching pages with the time of the last visit.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords that should appear in the title or address; empty lists all' },
        since_days_ago: { type: 'integer', description: 'Search from this many days ago (default 90)' },
        until_days_ago: { type: 'integer', description: 'Up to this many days ago (default 0, now)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'draft_email',
    description:
      "Open the phone's email composer with a draft. The user reviews it and decides whether to send; you cannot send email yourself.",
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'array', items: { type: 'string' }, description: 'Recipient email addresses (optional)' },
        subject: { type: 'string' },
        body: { type: 'string', description: 'Plain text body' },
      },
      required: ['subject', 'body'],
    },
  },
  {
    name: 'offer_call',
    description:
      'Show a Call button in the chat for a phone number, e.g. when the user asks to call a place you found. It does ' +
      'not call: the user taps the button and their phone opens the dialer. Take the number from the page or search ' +
      'result, never invent one. One plain number only: no * or # codes, pauses or extensions.',
    input_schema: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'The phone number as found, in any formatting, e.g. "+90 (212) 555 12 34"' },
        name: { type: 'string', description: 'Who the number belongs to, e.g. the pharmacy\'s name (optional)' },
      },
      required: ['phone'],
    },
  },
  {
    name: 'add_calendar_event',
    description:
      "Add an event to the user's calendar (e.g. a booked ticket, reservation or appointment). The user sees exactly " +
      "what will be added and confirms it. Use the current date, time and time zone given with the user's message to " +
      'work out dates like "tomorrow at 7". Only call this after the user has said they want it.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short event title, e.g. "Cinema: Dune (Hall 3)"' },
        start: {
          type: 'string',
          description: "ISO 8601 local date and time in the phone's time zone, e.g. 2026-11-15T19:30",
        },
        end: {
          type: 'string',
          description: "Same format as start; if unknown, estimate it (e.g. the film's length) or use start + 1 hour",
        },
        location: { type: 'string', description: 'Venue name and address (optional)' },
        notes: { type: 'string', description: 'Booking reference, seats, links (optional)' },
        alert_minutes_before: {
          type: 'integer',
          description: 'An alert this many minutes before the start (optional; 0 = at the start)',
        },
      },
      required: ['title', 'start', 'end'],
    },
  },
  {
    name: 'add_reminder',
    description:
      'Add a reminder: on iPhone to the Reminders app, on Android as a calendar event with an alarm (Android needs a due ' +
      'time). The user sees exactly what will be added and confirms it. Only call this after the user has said they want it.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What to be reminded of' },
        due: {
          type: 'string',
          description: 'When, as an ISO 8601 local date and time, e.g. 2026-11-15T09:00 (optional on iPhone)',
        },
        notes: { type: 'string', description: 'Extra details (optional)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'schedule_notification',
    description:
      'Schedule a notification from Qutai itself on this phone at a future time (e.g. "leave for the cinema"). ' +
      'The user sees it and confirms it. Only call this after the user has said they want it.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Notification title' },
        body: { type: 'string', description: 'Notification text' },
        time: {
          type: 'string',
          description: "ISO 8601 local date and time in the phone's time zone, e.g. 2026-11-15T19:30",
        },
      },
      required: ['title', 'body', 'time'],
    },
  },
  {
    name: 'open_settings',
    description:
      'Open a settings screen for the user. "system": Qutai\'s page in the phone\'s settings (permissions such as ' +
      'calendar, photos, camera and notifications; on iPhone also the default browser). "default_browser": the screen ' +
      'where the user picks their default browser app. "app": Qutai\'s own settings (AI provider and key, privacy, ' +
      'memory, site permissions). The user changes the setting themselves; you cannot change it for them.',
    input_schema: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: ['system', 'default_browser', 'app'], description: 'Which screen to open' },
      },
      required: ['target'],
    },
  },
  {
    name: 'switch_tab',
    description: 'Switch to another open tab by id. Further page tools act on that tab.',
    input_schema: {
      type: 'object',
      properties: { tab_id: { type: 'string', description: 'Tab id from list_tabs' } },
      required: ['tab_id'],
    },
  },
  {
    name: 'close_tab',
    description: 'Close a tab you opened and no longer need.',
    input_schema: {
      type: 'object',
      properties: { tab_id: { type: 'string', description: 'Tab id from list_tabs' } },
      required: ['tab_id'],
    },
  },
  {
    name: 'take_notes',
    description:
      'Write down what you found so far (prices, names, links, decisions) on tasks that span several pages. ' +
      'Older page content is removed from your context as you go; your notes are kept.',
    input_schema: {
      type: 'object',
      properties: { notes: { type: 'string', description: 'Short notes, e.g. "Shop A: 2,499 TL, ships tomorrow"' } },
      required: ['notes'],
    },
  },
  {
    name: 'close_tabs',
    description:
      'Close several tabs at once: the given tabs, and/or every tab of a group (group_id from list_tabs). ' +
      'Use it when a task is done to close the tabs that were opened for it; keep_tab_id stays open and is shown to the user.',
    input_schema: {
      type: 'object',
      properties: {
        tab_ids: { type: 'array', items: { type: 'string' }, description: 'Tab ids from list_tabs' },
        group_id: { type: 'string', description: 'Close all tabs of this group' },
        keep_tab_id: { type: 'string', description: 'A tab to keep open and switch to, e.g. the one with the result' },
      },
    },
  },
  {
    name: 'wait',
    description: 'Wait for the page to update (e.g. after an action that loads content).',
    input_schema: {
      type: 'object',
      properties: { seconds: { type: 'number', description: 'Seconds to wait, max 10' } },
      required: ['seconds'],
    },
  },
  {
    name: 'ask_user',
    description:
      'Ask the user to choose between options, shown to them as tappable buttons. Use this instead of writing a numbered ' +
      'list whenever you need the user to pick something (e.g. which product, which size, the options of a dropdown on the page, ' +
      'or whether to continue). Your turn ends here; their choice arrives as the next user message. ' +
      'They can also type a different answer.',
    input_schema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Short question shown above the buttons' },
        options: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 8,
          description: 'Between 2 and 8 short, distinct options (a few words each)',
        },
      },
      required: ['question', 'options'],
    },
  },
];
