// netlify/functions/geo-run-background.mjs
// Background function (up to 15 min). Trigger:
//   POST /.netlify/functions/geo-run-background?client=lakeland&key=YOUR_KEY
// Returns 202 immediately, then runs the full sweep and writes results to
// Netlify Blobs. Check progress/results on the dashboard.

import { getStore } from '@netlify/blobs';
import { getClient } from '../../geo/clients/index.mjs';
import { ADAPTERS } from '../../geo/lib/assistants.mjs';
import { evaluateAnswer, aggregate } from '../../geo/lib/score.mjs';

const CONCURRENCY = 4; // queries processed in parallel; each fans out to N assistants

// Bounded-concurrency map.
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
    return new Response('unauthorized', { status: 401 });
  }
  const config = getClient(slug);
  if (!config) return new Response(`unknown client: ${slug}`, { status: 404 });

  const store = getStore('geo');
  const startedAt = new Date().toISOString();

  const enabled = Object.keys(config.assistants).filter(
    (a) => config.assistants[a]?.enabled !== false && ADAPTERS[a]
  );

  // Flatten clusters into a query list.
  const queries = [];
  for (const cluster of config.clusters) {
    for (const q of cluster.queries) queries.push({ clusterId: cluster.id, query: q });
  }

  await store.setJSON(`${slug}/status`, {
    state: 'running',
    startedAt,
    total: queries.length,
    assistants: enabled,
  });

  // Kick off the sweep but don't block the 202 response.
  runSweep().catch(async (e) => {
    await store.setJSON(`${slug}/status`, { state: 'error', startedAt, error: String(e) });
  });

  async function runSweep() {
    const rows = await pool(queries, CONCURRENCY, async ({ clusterId, query }) => {
      const answers = await Promise.all(
        enabled.map(async (a) => {
          try {
            const raw = await ADAPTERS[a](query, config.assistants[a]);
            return [a, evaluateAnswer(raw, config)];
          } catch (e) {
            return [a, { ok: false, error: String(e), surfaced: false, competitorsCited: [] }];
          }
        })
      );
      return { clusterId, query, results: Object.fromEntries(answers) };
    });

    const summary = aggregate(rows, config);
    const finishedAt = new Date().toISOString();
    const run = { slug, startedAt, finishedAt, config: publicConfig(config), summary, rows };

    await store.setJSON(`${slug}/runs/${startedAt}`, run);
    await store.setJSON(`${slug}/latest`, run);
    await store.setJSON(`${slug}/status`, {
      state: 'done',
      startedAt,
      finishedAt,
      total: queries.length,
      overallSurfacedPct: summary.overallSurfacedPct,
    });
  }

  return new Response(JSON.stringify({ accepted: true, slug, queries: queries.length, assistants: enabled }), {
    status: 202,
    headers: { 'content-type': 'application/json' },
  });
};

function publicConfig(c) {
  return {
    brand: c.brand,
    clientDomain: c.clientDomain,
    competitors: c.competitors || [],
    clusters: c.clusters.map((cl) => ({ id: cl.id, label: cl.label })),
  };
}
