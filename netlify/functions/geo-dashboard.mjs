// netlify/functions/geo-dashboard.mjs
// GET /.netlify/functions/geo-dashboard?client=lakeland&key=YOUR_KEY
// Renders the latest run: per-assistant scoreboard, per-cluster heatmap, and the
// ranked gap list (where the client is invisible).

import { getStore } from '@netlify/blobs';

const ASSISTANT_LABELS = {
  perplexity: 'Perplexity',
  openai: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
};

export default async (req) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get('client') || 'lakeland';
  const key = url.searchParams.get('key') || '';

  if (!process.env.GEO_KEY || key !== process.env.GEO_KEY) {
    return new Response('unauthorized', { status: 401 });
  }

  const store = getStore('geo');
  const [latest, status] = await Promise.all([
    store.get(`${slug}/latest`, { type: 'json' }).catch(() => null),
    store.get(`${slug}/status`, { type: 'json' }).catch(() => null),
  ]);

  const html = render(slug, latest, status);
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
};

function heat(pct) {
  if (pct >= 67) return 'var(--brass)';
  if (pct >= 34) return 'var(--survey)';
  return 'var(--orange)';
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function render(slug, run, status) {
  const s = run?.summary;
  const statusLine = status
    ? status.state === 'running'
      ? `Run in progress — started ${esc(status.startedAt)}`
      : status.state === 'error'
      ? `Last run errored: ${esc(status.error || '')}`
      : `Last run ${esc(run?.finishedAt || status.finishedAt || '')}`
    : 'No runs yet.';

  const scoreCards = s
    ? s.assistants
        .map((a) => {
          const d = s.byAssistant[a];
          return `<div class="card">
            <div class="card-h">${esc(ASSISTANT_LABELS[a] || a)}</div>
            <div class="big" style="color:${heat(d.citedPct)}">${d.citedPct}%</div>
            <div class="sub">cited &middot; ${d.surfacedPct}% surfaced &middot; ${d.answered} answered</div>
          </div>`;
        })
        .join('')
    : '';

  const clusterRows = s
    ? Object.entries(s.byCluster)
        .map(([id, c]) => {
          const label = run.config.clusters.find((x) => x.id === id)?.label || id;
          return `<tr>
            <td>${esc(label)}</td>
            <td class="num">${c.queries}</td>
            <td><div class="bar"><span style="width:${c.surfacedPct}%;background:${heat(c.surfacedPct)}"></span></div></td>
            <td class="num" style="color:${heat(c.surfacedPct)}">${c.surfacedPct}%</td>
          </tr>`;
        })
        .join('')
    : '';

  const gapRows = s
    ? s.gaps
        .map(
          (g) => `<tr class="${g.priority === 'high' ? 'hi' : ''}">
            <td><span class="pill ${g.priority}">${g.priority}</span></td>
            <td>${esc(g.query)}</td>
            <td class="dim">${esc(g.clusterId)}</td>
            <td class="dim">${g.competitorHits.length ? esc(g.competitorHits.join(', ')) : '&mdash;'}</td>
          </tr>`
        )
        .join('')
    : '';

  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GEO Visibility &middot; ${esc(slug)}</title>
<style>
  :root{--navy:#0B2A45;--survey:#2C7DA0;--orange:#E2731B;--brass:#C7972F;--ink:#0B2A45;--line:#e6ebf0;--bg:#f6f8fa;}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:'IBM Plex Sans',system-ui,sans-serif;}
  header{background:var(--navy);color:#fff;padding:22px 24px;}
  h1{margin:0;font-family:'Space Grotesk',sans-serif;font-size:20px;letter-spacing:.2px}
  .status{opacity:.75;font-size:13px;margin-top:4px;font-family:'IBM Plex Mono',monospace}
  main{max-width:960px;margin:0 auto;padding:24px}
  h2{font-family:'Space Grotesk',sans-serif;font-size:15px;text-transform:uppercase;letter-spacing:.6px;color:var(--survey);margin:28px 0 12px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
  .card{background:#fff;border:1px solid var(--line);border-radius:10px;padding:16px}
  .card-h{font-size:13px;color:#5b6b7a;font-weight:600}
  .big{font-family:'Space Grotesk',sans-serif;font-size:34px;font-weight:600;line-height:1.1;margin:6px 0}
  .sub{font-size:11px;color:#7a8895;font-family:'IBM Plex Mono',monospace}
  .headline{background:#fff;border:1px solid var(--line);border-radius:10px;padding:18px 20px;display:flex;align-items:baseline;gap:14px}
  .headline .n{font-family:'Space Grotesk',sans-serif;font-size:40px;font-weight:600;color:var(--navy)}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden}
  th,td{text-align:left;padding:10px 12px;font-size:13px;border-bottom:1px solid var(--line)}
  th{background:#fafbfc;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#7a8895}
  td.num{text-align:right;font-family:'IBM Plex Mono',monospace}
  td.dim{color:#7a8895;font-size:12px}
  .bar{height:8px;background:#eef1f4;border-radius:5px;overflow:hidden;min-width:120px}
  .bar span{display:block;height:100%}
  tr.hi td{background:#fff7f0}
  .pill{font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:2px 7px;border-radius:20px;font-weight:600}
  .pill.high{background:var(--orange);color:#fff}
  .pill.open{background:#eef1f4;color:#5b6b7a}
  .empty{color:#7a8895;padding:20px;background:#fff;border:1px dashed var(--line);border-radius:10px;text-align:center}
</style></head>
<body>
<header><h1>GEO Visibility &middot; ${esc(run?.config?.brand || slug)}</h1><div class="status">${statusLine}</div></header>
<main>
${
  s
    ? `<div class="headline"><span class="n" style="color:${heat(s.overallSurfacedPct)}">${s.overallSurfacedPct}%</span>
        <span>of <strong>${s.totalQueries}</strong> tracked queries surfaced ${esc(run.config.brand)} on at least one assistant.</span></div>

      <h2>By assistant (cited = your domain linked)</h2>
      <div class="cards">${scoreCards}</div>

      <h2>By cluster</h2>
      <table><thead><tr><th>Cluster</th><th class="num">Queries</th><th>Surfaced</th><th class="num">%</th></tr></thead>
      <tbody>${clusterRows}</tbody></table>

      <h2>Gaps &mdash; where you're invisible (${s.gaps.length})</h2>
      ${
        s.gaps.length
          ? `<table><thead><tr><th>Priority</th><th>Query</th><th>Cluster</th><th>Competitors seen</th></tr></thead>
             <tbody>${gapRows}</tbody></table>`
          : `<div class="empty">No gaps &mdash; every tracked query surfaced you somewhere. Expand the query set.</div>`
      }`
    : `<div class="empty">${statusLine}<br><br>Trigger a run:<br><code>POST /.netlify/functions/geo-run-background?client=${esc(slug)}&amp;key=YOUR_KEY</code></div>`
}
</main></body></html>`;
}
