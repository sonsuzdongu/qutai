import type { ToolDefinition } from './types';

/**
 * The assistant's site-rule tools (definitions only: pure, for the agent profile export). They run in
 * agent/siteRulesTool.ts; the rules themselves are content/siteRules.ts.
 */
export const SITE_RULE_TOOLS: ToolDefinition[] = [
  {
    name: 'try_hide',
    description:
      'Hide leftover ad boxes or empty gaps on the current page, without saving. find: lists boxes that take room ' +
      'but show nothing (or hold an ad frame), with a suggested CSS selector each. try: hides the given selectors on ' +
      'this page only (replacing an earlier try) and reports what each matched and the page height before and after; ' +
      'over-broad selectors are refused. undo: shows them again. Saved rules come from save_site_rules.',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['find', 'try', 'undo'] },
        selectors: { type: 'array', items: { type: 'string' }, description: 'try: CSS selectors (at most 10)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'save_site_rules',
    description:
      "Save blocking rules for the current tab's site, after a successful try_hide. hide: CSS selectors to hide on " +
      'every visit; block_domains: ad or tracker domains to block (on every site, like the filter lists). The user ' +
      'approves in a dialog and picks where hiding applies (this page, pages under its path, this site, or this site ' +
      'and its subdomains). Only when the user asked for it.',
    input_schema: {
      type: 'object',
      properties: {
        hide: { type: 'array', items: { type: 'string' }, description: 'CSS selectors (at most 10)' },
        block_domains: { type: 'array', items: { type: 'string' }, description: 'Domains such as ads.example.com (at most 10)' },
      },
    },
  },
  {
    name: 'site_rules',
    description:
      "List the user's own blocking rules for the current tab's site (list), or remove some by id (remove; the user " +
      'confirms).',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'remove'] },
        ids: { type: 'array', items: { type: 'string' }, description: 'remove: rule ids from list' },
      },
      required: ['action'],
    },
  },
];

export const SITE_RULE_TOOL_NAMES = new Set(SITE_RULE_TOOLS.map((tool) => tool.name));
