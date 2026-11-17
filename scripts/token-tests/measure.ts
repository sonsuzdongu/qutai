/**
 * Token consumption of the assistant, per task and provider (README in this folder; docs/performance-2026-11.md).
 *
 *   npm run measure:tokens                         # tables in Markdown
 *   npm run measure:tokens -- --json out.json      # also the raw figures
 *   npm run measure:tokens -- --compare before.json  # before → after per task and provider
 *   npm run measure:tokens -- --requests           # every request of every task
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { simulate, type Part, type SimProvider, type TaskRecord } from './simulate';
import { TASKS } from './tasks';

const PROVIDERS: SimProvider[] = ['anthropic', 'openai', 'gemini'];
const PARTS: Part[] = ['system', 'tools', 'history', 'page', 'toolResults', 'images'];

type Summary = {
  task: string;
  provider: SimProvider;
  requests: number;
  prompt: number;
  parts: Record<Part, number>;
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
  usd: number;
};

function summarise(r: TaskRecord): Summary {
  const parts = Object.fromEntries(PARTS.map((p) => [p, r.requests.reduce((a, q) => a + q.parts[p], 0)])) as Record<Part, number>;
  const sum = (f: (q: TaskRecord['requests'][number]) => number) => r.requests.reduce((a, q) => a + f(q), 0);
  return {
    task: r.task,
    provider: r.provider,
    requests: r.requests.length,
    prompt: sum((q) => q.prompt),
    parts,
    input: sum((q) => q.usage.input),
    cacheRead: sum((q) => q.usage.cacheRead),
    cacheWrite: sum((q) => q.usage.cacheWrite),
    output: sum((q) => q.output),
    usd: sum((q) => q.nanos) / 1e9,
  };
}

const k = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const usd = (n: number) => `$${n.toFixed(n < 0.1 ? 4 : 3)}`;
const pct = (a: number, b: number) => (a === 0 ? '–' : `${b <= a ? '−' : '+'}${Math.abs(Math.round(((b - a) / a) * 100))} %`);

async function main() {
  const args = process.argv.slice(2);
  const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
  const compare = args.includes('--compare') ? args[args.indexOf('--compare') + 1] : null;
  const records: TaskRecord[] = [];
  for (const task of TASKS) for (const p of PROVIDERS) records.push(await simulate(task, p));
  const summaries = records.map(summarise);

  console.log('## Prompt tokens by part (all requests of the task, estimated)\n');
  console.log('| Task | Provider | Requests | System | Tools | History | Page content | Tool results | Images | Prompt total |');
  console.log('|---|---|--:|--:|--:|--:|--:|--:|--:|--:|');
  for (const s of summaries) {
    console.log(`| ${s.task} | ${s.provider} | ${s.requests} | ${PARTS.map((p) => k(s.parts[p])).join(' | ')} | ${k(s.prompt)} |`);
  }
  console.log('\n## Billing view (simulated prompt caching, list prices)\n');
  console.log('| Task | Provider | Uncached input | Cache read | Cache write | Output | Cost |');
  console.log('|---|---|--:|--:|--:|--:|--:|');
  for (const s of summaries) {
    console.log(`| ${s.task} | ${s.provider} | ${k(s.input)} | ${k(s.cacheRead)} | ${k(s.cacheWrite)} | ${k(s.output)} | ${usd(s.usd)} |`);
  }

  if (args.includes('--requests')) {
    for (const r of records) {
      console.log(`\n### ${r.task} / ${r.provider}\n`);
      console.log('| # | System | Tools | History | Page | Tool results | Images | Prompt | Read | Write | Uncached |');
      console.log('|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|');
      r.requests.forEach((q, i) =>
        console.log(`| ${i + 1} | ${PARTS.map((p) => k(q.parts[p])).join(' | ')} | ${k(q.prompt)} | ${k(q.usage.cacheRead)} | ${k(q.usage.cacheWrite)} | ${k(q.usage.input)} |`),
      );
    }
  }

  if (compare) {
    const before: Summary[] = JSON.parse(readFileSync(compare, 'utf8')).summaries;
    console.log('\n## Before → after\n');
    console.log('| Task | Provider | Prompt tokens | Change | Cost | Change |');
    console.log('|---|---|--:|--:|--:|--:|');
    for (const s of summaries) {
      const b = before.find((x) => x.task === s.task && x.provider === s.provider);
      if (!b) continue;
      console.log(`| ${s.task} | ${s.provider} | ${k(b.prompt)} → ${k(s.prompt)} | ${pct(b.prompt, s.prompt)} | ${usd(b.usd)} → ${usd(s.usd)} | ${pct(b.usd, s.usd)} |`);
    }
    for (const p of PROVIDERS) {
      const sb = before.filter((x) => x.provider === p);
      const sa = summaries.filter((x) => x.provider === p);
      const tb = sb.reduce((a, x) => a + x.usd, 0);
      const ta = sa.reduce((a, x) => a + x.usd, 0);
      const pb = sb.reduce((a, x) => a + x.prompt, 0);
      const pa = sa.reduce((a, x) => a + x.prompt, 0);
      console.log(`| **all tasks** | ${p} | ${k(pb)} → ${k(pa)} | ${pct(pb, pa)} | ${usd(tb)} → ${usd(ta)} | ${pct(tb, ta)} |`);
    }
  }

  if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ summaries, records }, null, 1));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
