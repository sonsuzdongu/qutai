import type { ToolDefinition } from './types';

/**
 * The assistant's page customisation tools (definitions only: pure, for the agent profile export). They run in
 * agent/pageCustomTool.ts; docs/page-customisation.md has the design.
 */
export const PAGE_CUSTOM_TOOLS: ToolDefinition[] = [
  {
    name: 'restyle_page',
    description:
      'Change how the current page looks with CSS, only when the user asks. apply: css plus a short description ' +
      "in the user's language; the user approves, sees it at once and may keep it for the site. CSS only: no " +
      '@import, url(), fonts or at-rules except @media/@supports; declarations become !important. undo: remove a ' +
      'style not kept. list: kept styles here.',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['apply', 'undo', 'list'] },
        css: { type: 'string', description: 'apply: the stylesheet' },
        description: { type: 'string', description: 'apply: what it changes, e.g. "Links in red"' },
      },
      required: ['action'],
    },
  },
  {
    name: 'page_cookies',
    description:
      "The cookies that apply to the current page, from the browser's cookie store (HttpOnly included). list: " +
      'handle, name, domain, path, expiry, size, flags, first/third-party; never values. delete: handles from list; ' +
      'the user approves (it may sign them out).',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'delete'] },
        handles: { type: 'array', items: { type: 'string' }, description: 'delete: handles such as c3' },
      },
      required: ['action'],
    },
  },
  {
    name: 'run_script',
    description:
      "Run JavaScript on the page when reading it and other tools can't (count, extract a table, check the DOM). " +
      'The user approves each run, code shown. code: async function body returning JSON. where copy (default): sealed ' +
      'copy, no network; page: live page, only to change it. Refused: cookies, storage, passwords, clicks, submits, ' +
      'navigation, eval, network but same-site fetch. Untrusted result.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: "an async function body; return the result (pageUrl is the page's address)" },
        description: { type: 'string', description: "one sentence in the user's language: what it does and returns" },
        where: { type: 'string', enum: ['copy', 'page'] },
      },
      required: ['code', 'description'],
    },
  },
];

export const PAGE_CUSTOM_TOOL_NAMES = new Set(PAGE_CUSTOM_TOOLS.map((tool) => tool.name));
