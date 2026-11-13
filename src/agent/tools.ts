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
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'save_screenshot',
    description:
      "Save a screenshot of the visible part of the current page to the user's photo library. " +
      'Scroll first if the user wants a specific part of the page.',
    input_schema: { type: 'object', properties: {} },
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
