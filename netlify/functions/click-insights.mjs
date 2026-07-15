/* =====================================================================
   click-insights.mjs — private dashboard of text/call button taps.

   Shows how many people tapped the text (sms) and call (tel) buttons,
   and — most usefully — WHICH pages drove them. Same private-key gate
   as the chat insights dashboard (reuses INSIGHTS_KEY).

   View at:  /.netlify/functions/click-insights?key=YOUR_INSIGHTS_KEY
   ===================================================================== */
import { getStore } from "@netlify/blobs";

async function loadAll(store, cap = 8000) {
  const { blobs } = await store.list();
  const keys = blobs.map(b => b.key).sort().slice(-cap); // newest by timestamp-prefixed key
  const rows = [];
  const batch = 40;
  for (let i = 0; i < keys.length; i += batch) {
    const slice = keys.slice(i, i + batch);
    const got = await Promise.all(slice.map(k => store.get(k, { type: "json" }).catch(() => null)));
    for (const r of got) if (r && r.type) rows.push(r);
  }
  return rows;
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function page(rows) {
  const sms  = rows.filter(r => r.type === "sms").length;
  const call = rows.filter(r => r.type === "call").length;

  // taps per page, split by type
  const byPage = new Map();
  for (const r of rows) {
    const p = r.path || "/";
    const o = byPage.get(p) || { sms: 0, call: 0 };
    if (r.type === "sms") o.sms++; else o.call++;
    byPage.set(p, o);
  }
  const pages = [...byPage.entries()]
    .map(([p, o]) => [p, o.sms, o.call, o.sms + o.call])
    .sort((a, b) => b[3] - a[3])
    .slice(0, 150);

  const dates = rows.map(r => r.ts).filter(Boolean).sort();
  const range = dates.length ? `${dates[0].slice(0, 10)} → ${dates[dates.length - 1].slice(0, 10)}` : "—";

  const pRows = pages.map(([p, s, c, t]) =>
    `<tr><td class="c">${t}</td><td class="c" style="color:var(--signal)">${s}</td><td class="c" style="color:var(--water)">${c}</td><td>${esc(p)}</td></tr>`
  ).join("") || `<tr><td colspan="4" class="empty">No taps logged yet. Tap a text or call button on the live site from your phone, then refresh.</td></tr>`;

  const csvData = JSON.stringify(rows.map(r => ({ ts: r.ts || "", type: r.type || "", path: r.path || "", num: r.num || "" })));

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Tap Insights — Lakeland Surveying</title>
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
.stat.sms b{color:var(--signal)}.stat.call b{color:var(--water)}
h2{font-family:"Space Grotesk",sans-serif;font-size:16px;margin:30px 0 10px;display:flex;align-items:center;gap:10px}
.btn{background:var(--signal);color:#fff;border:none;border-radius:8px;padding:9px 14px;font-family:"IBM Plex Mono",monospace;font-size:12px;cursor:pointer;text-decoration:none}
.btn:hover{background:#c45f12}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
th{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);padding:10px 14px;text-align:left;border-bottom:1px solid var(--line)}
th.c{text-align:center;width:66px}
td{padding:9px 14px;border-top:1px solid #eef2f5;font-size:14.5px;vertical-align:top}
td.c{font-family:"IBM Plex Mono",monospace;font-weight:600;text-align:center}
.empty{color:var(--muted);text-align:center;padding:22px}
.note{color:var(--muted);font-size:12.5px;margin-top:24px;border-top:1px solid var(--line);padding-top:14px}
</style></head><body><div class="wrap">
<h1>Tap Insights</h1>
<div class="sub">Text &amp; call button taps on the live site · ${range}</div>
<div class="stats">
  <div class="stat"><b>${rows.length}</b><span>Total taps</span></div>
  <div class="stat sms"><b>${sms}</b><span>Text taps</span></div>
  <div class="stat call"><b>${call}</b><span>Call taps</span></div>
  <div class="stat"><b>${byPage.size}</b><span>Pages with taps</span></div>
</div>
<h2>Where people tap <a class="btn" id="csv" href="#">⬇ Download CSV</a></h2>
<table>
<thead><tr><th class="c">All</th><th class="c">Text</th><th class="c">Call</th><th>Page</th></tr></thead>
<tbody>${pRows}</tbody></table>
<p class="note">Ranked by total taps per page. The pages near the top are where visitors are most ready to
reach out — good candidates for a stronger call-to-action, and a signal of which towns convert. Text taps
are orange, call taps blue. CSV includes every tap with its timestamp for pivoting in a spreadsheet.
This page is private (noindex) — keep the URL key secret.</p>
</div>
<script>
const DATA = ${csvData};
document.getElementById('csv').addEventListener('click', function(e){
  e.preventDefault();
  const rows = [["timestamp","type","page","number"]].concat(
    DATA.map(r => [r.ts, r.type, '"'+String(r.path).replace(/"/g,'""')+'"', r.num])
  );
  const csv = rows.map(r => r.join(",")).join("\\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "button-taps.csv";
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
    const store = getStore("click-events");
    const rows = await loadAll(store);
    return new Response(page(rows), { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  } catch (e) {
    console.error("click-insights error:", e);
    return new Response("Could not load insights: " + e.message, { status: 500 });
  }
};
