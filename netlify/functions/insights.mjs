/* =====================================================================
   insights.mjs — private dashboard of what visitors type into the chat.
   For SEO/AEO mining: ranked questions, top keywords, CSV export.

   Protect it: set an env var INSIGHTS_KEY (any hard-to-guess string).
   View at:  /.netlify/functions/insights?key=YOUR_KEY
   ===================================================================== */
import { getStore } from "@netlify/blobs";

const STOP = new Set("the a an and or but for to of in on at by with from is are was were be been do does did i you your yours we our do we my me it this that these those need needs want get got can could would should how what when where why who which do you your near me about have has had not no yes".split(/\s+/));

function normalize(q) {
  return String(q).toLowerCase().replace(/\s+/g, " ").replace(/[?.!,]+$/g, "").trim();
}
function keywords(q) {
  return (String(q).toLowerCase().match(/[a-z0-9']+/g) || []).filter(w => w.length >= 3 && !STOP.has(w));
}

async function loadAll(store, cap = 5000) {
  const { blobs } = await store.list();
  const keys = blobs.map(b => b.key).sort().slice(-cap); // newest by timestamp-prefixed key
  const rows = [];
  const batch = 40;
  for (let i = 0; i < keys.length; i += batch) {
    const slice = keys.slice(i, i + batch);
    const got = await Promise.all(slice.map(k => store.get(k, { type: "json" }).catch(() => null)));
    for (const r of got) if (r && r.q) rows.push(r);
  }
  return rows;
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function page(rows) {
  // rank questions
  const qCount = new Map();
  for (const r of rows) { const n = normalize(r.q); if (n) qCount.set(n, (qCount.get(n) || 0) + 1); }
  const topQ = [...qCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100);

  // rank keywords
  const kCount = new Map();
  for (const r of rows) for (const w of keywords(r.q)) kCount.set(w, (kCount.get(w) || 0) + 1);
  const topK = [...kCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60);

  const dates = rows.map(r => r.ts).filter(Boolean).sort();
  const range = dates.length ? `${dates[0].slice(0, 10)} → ${dates[dates.length - 1].slice(0, 10)}` : "—";

  const qRows = topQ.map(([q, c]) => `<tr><td class="c">${c}</td><td>${esc(q)}</td></tr>`).join("") || `<tr><td colspan="2" class="empty">No questions logged yet. Ask the chatbot something on the live site, then refresh.</td></tr>`;
  const kRows = topK.map(([w, c]) => `<span class="kw">${esc(w)} <b>${c}</b></span>`).join(" ");

  // raw data for CSV (question + timestamp)
  const csvData = JSON.stringify(rows.map(r => ({ ts: r.ts || "", q: r.q || "" })));

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Chat Insights — Lakeland Surveying</title>
<style>
:root{--ink:#0B2A45;--ink-deep:#071a2c;--water:#2C7DA0;--signal:#E2731B;--brass:#C7972F;--line:#d9e1e7;--muted:#5b7184;--paper:#FBFAF6}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:"IBM Plex Sans",system-ui,sans-serif;line-height:1.5}
.wrap{max-width:900px;margin:0 auto;padding:28px 20px 60px}
h1{font-family:"Space Grotesk",sans-serif;font-size:24px;margin:0 0 4px}
.sub{color:var(--muted);font-family:"IBM Plex Mono",monospace;font-size:12px;letter-spacing:.03em;margin-bottom:22px}
.stats{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:26px}
.stat{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 18px;min-width:130px}
.stat b{display:block;font-family:"Space Grotesk",sans-serif;font-size:26px;color:var(--ink-deep)}
.stat span{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
h2{font-family:"Space Grotesk",sans-serif;font-size:16px;margin:30px 0 10px;display:flex;align-items:center;gap:10px}
.btn{background:var(--signal);color:#fff;border:none;border-radius:8px;padding:9px 14px;font-family:"IBM Plex Mono",monospace;font-size:12px;cursor:pointer;text-decoration:none}
.btn:hover{background:#c45f12}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
td{padding:9px 14px;border-top:1px solid #eef2f5;font-size:14.5px;vertical-align:top}
td.c{width:64px;font-family:"IBM Plex Mono",monospace;color:var(--water);font-weight:600;text-align:center}
tr:first-child td{border-top:none}
.empty{color:var(--muted);text-align:center;padding:22px}
.kws{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px;line-height:2.1}
.kw{display:inline-block;background:#e8f1f6;border:1px solid #cfe0ea;border-radius:999px;padding:3px 10px;font-size:13px;margin:2px}
.kw b{color:var(--water);font-family:"IBM Plex Mono",monospace;font-size:11px}
.note{color:var(--muted);font-size:12.5px;margin-top:24px;border-top:1px solid var(--line);padding-top:14px}
</style></head><body><div class="wrap">
<h1>Chat Insights</h1>
<div class="sub">What visitors are asking the site assistant · ${range}</div>
<div class="stats">
  <div class="stat"><b>${rows.length}</b><span>Questions logged</span></div>
  <div class="stat"><b>${qCount.size}</b><span>Unique questions</span></div>
  <div class="stat"><b>${kCount.size}</b><span>Distinct keywords</span></div>
</div>
<h2>Top keywords <span style="font-weight:400;color:var(--muted);font-size:12px">(raw material for pages &amp; FAQs)</span></h2>
<div class="kws">${kRows || '<span style="color:var(--muted)">—</span>'}</div>
<h2>Most-asked questions <a class="btn" id="csv" href="#">⬇ Download CSV</a></h2>
<table><tbody>${qRows}</tbody></table>
<p class="note">Ranked by how often each phrasing was typed. Use the top questions as answer-first
page/FAQ targets, and the keywords to spot demand you're not yet ranking for. CSV includes every
question with its timestamp for pivoting in a spreadsheet. This page is private (noindex) — keep the URL key secret; logged text may include things visitors typed about their property.</p>
</div>
<script>
const DATA = ${csvData};
document.getElementById('csv').addEventListener('click', function(e){
  e.preventDefault();
  const rows = [["timestamp","question"]].concat(DATA.map(r => [r.ts, '"'+String(r.q).replace(/"/g,'""')+'"']));
  const csv = rows.map(r => r.join(",")).join("\\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "chat-questions.csv";
  a.click();
});
</script>
</body></html>`;
}

export default async (request) => {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!process.env.INSIGHTS_KEY || key !== process.env.INSIGHTS_KEY) {
    return new Response("Not authorized. Add ?key=YOUR_INSIGHTS_KEY to the URL.", { status: 401 });
  }
  try {
    const store = getStore("chat-questions");
    const rows = await loadAll(store);
    return new Response(page(rows), { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  } catch (e) {
    console.error("insights error:", e);
    return new Response("Could not load insights: " + e.message, { status: 500 });
  }
};
