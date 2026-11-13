import type { ToolDefinition } from './types';

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
    name: 'save_pdf',
    description:
      'Turn the current page into a PDF and open the system share sheet, where the user can save it (e.g. to Files) or send it. ' +
      'Use when the user asks for a PDF, a printable copy, or to save the page as a document.',
    input_schema: { type: 'object', properties: {} },
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
];
