import type { ToolDefinition } from './types';

/**
 * The assistant's tool for the user's own apps (definition only: pure, for the agent profile export). It runs in
 * agent/appTool.ts; docs/mini-apps.md › How the assistant builds an app has the design.
 */
export const APP_TOOLS: ToolDefinition[] = [
  {
    name: 'apps',
    description:
      "The user's own small apps (HTML/CSS/JS, offline, run in Qutai). Only when the user asks for an app or a change. " +
      'guide: the contract and rules; call once before create/update. list. read: app_id, file?. create: name, ' +
      'description, icon, language, permissions, files. update: app_id, edits [{file,find,replace}] and/or files ' +
      '(null deletes), note. preview: app_id; opens it and returns errors and console. undo: app_id.',
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['guide', 'list', 'read', 'create', 'update', 'preview', 'undo'] },
        app_id: { type: 'string' },
        file: { type: 'string', description: 'read: one file' },
        name: { type: 'string' },
        description: { type: 'string' },
        icon: { type: 'object', properties: { name: { type: 'string' }, color: { type: 'string' } } },
        language: { type: 'string', description: "the app's language code, e.g. tr" },
        permissions: { type: 'array', items: { type: 'string' } },
        files: { type: 'object', description: 'file name → full text' },
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: { file: { type: 'string' }, find: { type: 'string' }, replace: { type: 'string' } },
            required: ['file', 'find', 'replace'],
          },
        },
        note: { type: 'string', description: "update: what changed, in the user's language" },
      },
      required: ['action'],
    },
  },
];

export const APP_TOOL_NAMES = new Set(APP_TOOLS.map((tool) => tool.name));
