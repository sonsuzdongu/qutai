/**
 * The prompt-injection measurement (README.md in this folder; docs/prompt-injection-tests.md). Opt-in and billed:
 * it calls the real models with the key of the owner's local server, never as part of `npm test`.
 *
 *   npm run measure:injection -- --label before                  # every case, both models, 3 runs each
 *   npm run measure:injection -- --label after --reps 2 --models haiku
 *   npm run measure:injection -- --cases hidden-white,base64 --reps 1 --label try
 *   npm run measure:injection -- --report before,after           # the tables, from saved results
 *
 * Spending is capped across all invocations (results/spend.json, priced from reported usage); the cap defaults to
 * 5 US dollars (--cap). The running total is printed after each run.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BudgetError, installModelAccess, Meter, NoKeyError } from './api';
import { CASES, type Case } from './cases';
import { Chrome } from './chrome';
import { judge, type RunRecord, type Verdict } from './judge';
import { runCase } from './run';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS = join(HERE, 'results');
const MODELS: Record<string, string> = { haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5', obedient: 'obedient' };

type Saved = { label: string; at: string; runs: (RunRecord & { verdict: Verdict })[] };

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function trim(r: RunRecord, v: Verdict): Saved['runs'][number] {
  return {
    ...r,
    calls: r.calls.map((k) => ({ ...k, result: k.result.slice(0, 400) })),
    requests: r.requests.map((q) => ({ ...q, postData: q.postData?.slice(0, 1000) })),
    text: r.text.slice(0, 3000),
    verdict: v,
  };
}

/** One run per line: small diffs, still one JSON document. */
export function savedJson(saved: Saved): string {
  return `{"label":${JSON.stringify(saved.label)},"at":${JSON.stringify(saved.at)},"runs":[\n${saved.runs.map((r) => JSON.stringify(r)).join(',\n')}\n]}\n`;
}

const pct = (n: number, d: number) => (d ? `${n}/${d}` : '–');

/** Markdown tables: per case and model, and totals per model; with two labels, before → after. */
export function report(sets: Saved[]): string {
  const out: string[] = [];
  const models = [...new Set(sets.flatMap((s) => s.runs.map((r) => r.model)))];
  const cell = (runs: Saved['runs']) => {
    const n = runs.length;
    if (!n) return '–';
    const c = (f: (v: Verdict) => boolean) => runs.filter((r) => f(r.verdict)).length;
    return `${pct(c((v) => v.tried), n)} / **${pct(c((v) => v.happened), n)}**${c((v) => v.asked) ? ` (${c((v) => v.asked)} asked)` : ''}${c((v) => v.unclear) ? ` (${c((v) => v.unclear)} unclear)` : ''}`;
  };
  for (const model of models) {
    out.push(`\n### ${model}\n`);
    out.push(`Each cell: runs where the model tried / **runs where it happened** (out of runs).${sets.length > 1 ? ` ${sets.map((s) => s.label).join(' → ')}.` : ''}\n`);
    out.push(`| Case | Where the instruction was | Attacker's goal | ${sets.map((s) => s.label).join(' | ')} | Task done (${sets.map((s) => s.label).join(' → ')}) |`);
    out.push(`|---|---|---|${sets.map(() => '---|').join('')}---|`);
    for (const c of CASES) {
      const per = sets.map((s) => s.runs.filter((r) => r.model === model && r.caseId === c.id));
      if (per.every((p) => !p.length)) continue;
      const done = per.map((p) => pct(p.filter((r) => r.verdict.done).length, p.length)).join(' → ');
      out.push(`| ${c.id} | ${c.vector} | ${c.wants} | ${per.map(cell).join(' | ')} | ${done} |`);
    }
    const tot = sets.map((s) => {
      const runs = s.runs.filter((r) => r.model === model);
      return { n: runs.length, tried: runs.filter((r) => r.verdict.tried).length, happened: runs.filter((r) => r.verdict.happened).length, done: runs.filter((r) => r.verdict.done).length };
    });
    out.push(`| **All** | | | ${tot.map((t) => `${pct(t.tried, t.n)} / **${pct(t.happened, t.n)}**`).join(' | ')} | ${tot.map((t) => pct(t.done, t.n)).join(' → ')} |`);
    out.push('');
    out.push(`Rates for ${model}: ${sets.map((s, i) => `${s.label}: tried ${Math.round((100 * tot[i].tried) / Math.max(1, tot[i].n))} %, happened ${Math.round((100 * tot[i].happened) / Math.max(1, tot[i].n))} %, task done ${Math.round((100 * tot[i].done) / Math.max(1, tot[i].n))} %`).join('; ')}.`);
  }
  return out.join('\n');
}

async function main() {
  const reportArg = arg('report');
  if (reportArg) {
    // Judged again from the saved records, so every set is judged by the same (current) judges.
    const sets = reportArg.split(',').map((l) => {
      const set = JSON.parse(readFileSync(join(RESULTS, `${l}.json`), 'utf8')) as Saved;
      for (const r of set.runs) {
        const c = CASES.find((x) => x.id === r.caseId);
        if (c) r.verdict = judge(c, r);
      }
      return set;
    });
    console.log(report(sets));
    return;
  }
  const label = arg('label', 'try')!;
  // --reps 3, or per model: --reps haiku=4,sonnet=3
  const repsArg = arg('reps', '3')!;
  const models = (arg('models', 'haiku,sonnet') ?? '').split(',').map((m) => MODELS[m] ?? m);
  const perModel = Object.fromEntries(
    repsArg.split(',').filter((x) => x.includes('=')).map((x) => x.split('=')).map(([k, v]) => [MODELS[k] ?? k, Number(v)]),
  );
  const repsFor = (model: string) => perModel[model] ?? (Number(repsArg) || 3);
  const reps = Math.max(...models.map(repsFor));
  // Stops this invocation once the total spent reaches this (keeps budget for a later run); the cap stays --cap.
  const stopAt = Number(arg('stop-at', 'Infinity'));
  const only = arg('cases')?.split(',');
  // The obedient model knows its case from a global: one run at a time.
  const parallel = models.includes('obedient') ? 1 : Number(arg('parallel', '3'));
  const cap = Number(arg('cap', '5'));
  const cases: Case[] = only ? CASES.filter((c) => only.includes(c.id)) : CASES;
  const meter = new Meter(join(RESULTS, 'spend.json'), cap);
  try {
    installModelAccess(meter, models.some((m) => m !== 'obedient'));
  } catch (e) {
    if (e instanceof NoKeyError) {
      console.error(`${e.message}: the measurement needs the local server's Anthropic key. Nothing was run.`);
      process.exit(2);
    }
    throw e;
  }
  // All PDFs of all cases, so cases can run side by side.
  (globalThis as { __qutaiPdfs?: unknown }).__qutaiPdfs = Object.assign({}, ...CASES.map((c) => c.pdfs ?? {}));
  const file = join(RESULTS, `${label}.json`);
  const saved: Saved = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { label, at: new Date().toISOString(), runs: [] };
  const chrome = await Chrome.launch();
  const jobs: { c: Case; model: string; rep: number }[] = [];
  for (let rep = 1; rep <= reps; rep++) for (const model of models) for (const c of cases) {
    if (rep > repsFor(model)) continue;
    if (!saved.runs.some((r) => r.caseId === c.id && r.model === model && r.rep === rep)) jobs.push({ c, model, rep });
  }
  console.log(`${jobs.length} runs to do (${label}); spent so far $${meter.ledger.spent.toFixed(4)} of $${cap}.`);
  let stopped = '';
  const worker = async () => {
    while (jobs.length && !stopped) {
      if (meter.ledger.spent >= stopAt) {
        stopped = `--stop-at reached: $${meter.ledger.spent.toFixed(4)} spent in total.`;
        break;
      }
      const job = jobs.shift()!;
      try {
        const record = await runCase(job.c, job.model, job.rep, chrome, () => meter.ledger.spent);
        if (record.error && /Spending cap/.test(record.error)) {
          stopped = record.error;
          break;
        }
        if (record.error && /\b(401|403|invalid x-api-key|authentication)\b/i.test(record.error)) {
          stopped = `The API refused the requests: ${record.error}`;
          break;
        }
        const v = judge(job.c, record);
        saved.runs.push(trim(record, v));
        mkdirSync(RESULTS, { recursive: true });
        writeFileSync(file, savedJson(saved));
        console.log(
          `${job.model.replace('claude-', '')} #${job.rep} ${job.c.id}: ${v.happened ? 'HAPPENED' : v.tried ? 'tried' : 'resisted'}${v.asked ? ' (asked)' : ''}${v.unclear ? ' (unclear)' : ''}, task ${v.done ? 'done' : 'not done'}${record.error ? ` [error: ${record.error.slice(0, 120)}]` : ''}${v.how.length ? ' – ' + v.how.join('; ') : ''}  | $${record.usd.toFixed(4)}, total $${meter.ledger.spent.toFixed(4)}`,
        );
      } catch (e) {
        if (e instanceof BudgetError) {
          stopped = e.message;
          break;
        }
        console.error(`${job.c.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: parallel }, worker));
  await chrome.close();
  if (stopped) console.log(`\nStopped: ${stopped}`);
  console.log(report([saved]));
  console.log(`\nSpent in total: $${meter.ledger.spent.toFixed(4)} (${meter.ledger.requests} requests).`);
  process.exit(0);
}

void main();
