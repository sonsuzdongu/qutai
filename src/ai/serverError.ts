/**
 * Reading an AI server's error answer: its short message, and what kind of failure it is. Pure (no React Native),
 * so "Test connection" (customTest.ts), the request code (http.ts) and the Node tests share one reading.
 *
 * Servers answer errors in many shapes: OpenAI's `{ error: { message } }` (also OpenRouter, Ollama, vLLM, LM Studio),
 * `{ error: "text" }`, Gemini's `[{ error: { message } }]`, Cloudflare's API envelope
 * `{ success: false, errors: [{ code, message }] }`, FastAPI's `{ detail }`, a bare `{ message }`, plain text, or an
 * HTML page from a proxy or web server.
 */

export type FailureKind =
  /** Nothing at this address answers Chat Completions: wrong path, a web page, or a different API. */
  | 'path'
  | 'auth'
  | 'model'
  /** The server or model says it can't take tools (function calling). */
  | 'tools'
  | 'rateLimit'
  | 'server'
  /** Any other refusal; the server's message says why. */
  | 'badRequest';

const MAX_MESSAGE = 200;

/** Looks like an HTML page rather than an API answer. */
export function isHtml(text: string): boolean {
  return /^\s*(<!doctype html|<html|<head|<body|<\?xml|<!--|<h1|<title)/i.test(text);
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Has OpenAI's error field (`error` as an object with a message, or a string). */
function openAiEnvelope(json: unknown): boolean {
  const body = Array.isArray(json) ? json[0] : json;
  if (!isObj(body)) return false;
  const e = body.error;
  return typeof e === 'string' || (isObj(e) && typeof e.message === 'string');
}

/** The message inside a JSON error body, whatever its shape ('' when none). */
function jsonMessage(json: unknown): string {
  const body = Array.isArray(json) ? json[0] : json;
  if (!isObj(body)) return '';
  const e = body.error;
  if (typeof e === 'string') return e;
  if (isObj(e) && str(e.message)) return str(e.message);
  if (Array.isArray(body.errors)) {
    const parts = body.errors
      .map((x) => (isObj(x) ? str(x.message) : str(x)))
      .filter(Boolean);
    if (parts.length) return parts.join('; ');
  }
  if (str(body.message)) return str(body.message);
  if (str(body.detail)) return str(body.detail);
  if (Array.isArray(body.detail)) {
    const parts = body.detail.map((x) => (isObj(x) ? str(x.msg) : '')).filter(Boolean);
    if (parts.length) return parts.join('; ');
  }
  return '';
}

/**
 * Removes anything that looks like a credential from a server's message before it is shown: the values the app sent
 * (`secrets`: the API key and extra header values), bearer tokens and common key shapes. A server can echo what it
 * received ("Invalid key sk-…"); the message is shown on screen and kept in error text.
 */
export function redact(message: string, secrets: string[] = []): string {
  let out = message;
  for (const s of secrets) {
    const v = s.trim();
    if (v.length >= 4) out = out.split(v).join('…');
  }
  return out
    .replace(/\b(bearer|basic)\s+[^\s"',;]+/gi, '$1 …')
    .replace(/\b(sk|pk|rk|key|gsk|xai|csk)[-_][A-Za-z0-9_-]{8,}/g, '…')
    .replace(/\bAIza[0-9A-Za-z_-]{20,}/g, '…');
}

/** The server's short message: collapsed whitespace, at most 200 characters, credentials removed; '' for an HTML page. */
export function serverMessage(text: string, json: unknown = parse(text), secrets: string[] = []): string {
  let message = jsonMessage(json);
  if (!message && json === undefined && !isHtml(text)) message = text;
  message = redact(message.replace(/\s+/g, ' ').trim(), secrets);
  return message.length > MAX_MESSAGE ? `${message.slice(0, MAX_MESSAGE - 1)}…` : message;
}

const MODEL_MISSING = /model/i;
const NOT_FOUND = /not.?found|does not exist|doesn't exist|unknown|no such|invalid model/i;
const NO_ROUTE = /no route|route not found|not found for (the |this )?(uri|url|path)|unknown (url|path|endpoint|route)|cannot (post|get)|no handler|page not found|endpoint not found|^not found$/i;
const TOOLS = /\btools?\b|tool[_ ]?(use|choice|call)|function[_ ]?call/i;

/** The model named in the request isn't there. */
export function isModelMissing(message: string): boolean {
  return MODEL_MISSING.test(message) && NOT_FOUND.test(message);
}

/**
 * What a failed Chat Completions request means. A wrong path is told apart from a refused request: a 404 that isn't
 * about the model, a 400/405 whose message says the URI has no route, an HTML page, or a JSON body that isn't
 * OpenAI's error shape (another API answered).
 */
export function classifyFailure(status: number, text: string, json: unknown = parse(text)): FailureKind {
  const message = jsonMessage(json) || (json === undefined && !isHtml(text) ? text : '');
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rateLimit';
  if (status === 501) return 'path';
  if (status >= 500) return 'server';
  if (isModelMissing(message)) return 'model';
  if ((status === 400 || status === 404 || status === 422) && TOOLS.test(message)) return 'tools';
  if (status === 404 || status === 405) return 'path';
  if (isHtml(text)) return 'path';
  if (NO_ROUTE.test(message.trim())) return 'path';
  if (json !== undefined && !openAiEnvelope(json) && isObj(json) && (json.success === false || Array.isArray(json.errors))) {
    return 'path';
  }
  return 'badRequest';
}
