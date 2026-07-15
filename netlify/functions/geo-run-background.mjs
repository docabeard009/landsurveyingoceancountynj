// netlify/functions/geo-run-background.mjs
// Background function (up to 15 min). Trigger:
//   /.netlify/functions/geo-run-background?client=lakeland&key=YOUR_KEY
// Runs the full sweep to completion, logging progress, then writes results to
// Netlify Blobs. View results on the dashboard.

import { getStore } from '@netlify/blobs';
import { getClient } from '../../geo/clients/index.mjs';
import { ADAPTERS } from '../../geo/lib/assistants.mjs';
import { evaluateAnswer, aggregate } from '../../geo/lib/score.mjs';

const CONCURRENCY = 4; // queries processed in parallel; each fans out to N assistants

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

export default async (req) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get('client') || 'lakeland';
  const key = url.searchParams.get('key') || '';

  if (!process.env.GEO_KEY || key !== process.env.GEO_KEY) {
    console.log('geo-run: unauthorized (key mismatch)');
    return new Response('unauthorized', { status: 401 });
  }
  const config = getClient(slug);
  if (!config) {
    console.log(`geo-run: unknown client ${slug}`);
    return new Response(`unknown client: ${slug}`, { status: 404 });
  }

  const store = getStore('geo');
  const startedAt = new Date().toISOString();

  const enabled = Object.keys(config.assistants).filter(
    (a) => config.assistants[a]?.enabled !== false && ADAPTERS[a]
  );

  const queries = [];
  for (const cluster of config.clusters) {
    for (const q of cluster.queries) queries.push({ clusterId: cluster.id, query: q });
  }

  console.log(`geo-run: start slug=${slug} queries=${queries.length} assistants=${enabled.join(',') || 'NONE'}`);

  if (!enabled.length) {
    await store.setJSON(`${slug}/status`, { state: 'error', startedAt, error: 'no assistants enabled or no adapters' });
    return new Response('no assistants enabled', { status: 400 });
  }

  await store.setJSON(`${slug}/status`, { state: 'running', startedAt, total: queries.length, assistants: enabled });

  try {
    let done = 0;
    const rows = await pool(queries, CONCURRENCY, async ({ clusterId, query }) => {
      const answers = await Promise.all(
        enabled.map(async (a) => {
          try {
            const raw = await ADAPTERS[a](query, config.assistants[a]);
            if (!raw.ok) console.log(`geo-run: ${a} error on "${query}": ${raw.error}`);
            return [a, evaluateAnswer(raw, config)];
          } catch (e) {
            console.log(`geo-run: ${a} threw on "${query}": ${e}`);
            return [a, { ok: false, error: String(e), surfaced: false, competitorsCited: [] }];
          }
        })
      );
      done++;
      console.log(`geo-run: [${done}/${queries.length}] ${query}`);
      return { clusterId, query, results: Object.fromEntries(answers) };
    });

    const summary = aggregate(rows, config);
    const finishedAt = new Date().toISOString();
    const run = { slug, startedAt, finishedAt, config: publicConfig(config), summary, rows };

    await store.setJSON(`${slug}/runs/${startedAt}`, run);
    await store.setJSON(`${slug}/latest`, run);
    await store.setJSON(`${slug}/status`, {
      state: 'done', startedAt, finishedAt, total: queries.length,
      overallSurfacedPct: summary.overallSurfacedPct,
    });

    console.log(`geo-run: DONE overall=${summary.overallSurfacedPct}% gaps=${summary.gaps.length}`);
    return new Response(JSON.stringify({ ok: true, slug, queries: queries.length, overallSurfacedPct: summary.overallSurfacedPct }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    console.log(`geo-run: FAILED ${e && e.stack ? e.stack : e}`);
    await store.setJSON(`${slug}/status`, { state: 'error', startedAt, error: String(e) });
    return new Response(`error: ${e}`, { status: 500 });
  }
};

function publicConfig(c) {
  return {
    brand: c.brand,
    clientDomain: c.clientDomain,
    competitors: c.competitors || [],
    clusters: c.clusters.map((cl) => ({ id: cl.id, label: cl.label })),
  };
}
