/* =====================================================================
   review-portal.mjs — private dashboard: is the client actually asking?

   Protect it: set an env var PORTAL_KEY (any hard-to-guess string).
   View at:  /.netlify/functions/review-portal?key=YOUR_KEY

   Reads the events written by review-log.mjs.
   ===================================================================== */
import { getStore } from "@netlify/blobs";

const DAY = 86400000;

async function loadAll(store, cap = 5000) {
  const { blobs } = await store.list();
  const keys = blobs.map(b => b.key).sort().slice(-cap);
  const rows = [];
  const batch = 40;
  for (let i = 0; i < keys.length; i += batch) {
    const slice = keys.slice(i, i + batch);
    const got = await Promise.all(slice.map(k => store.get(k, { type: "json" }).catch(() => null)));
    for (const r of got) if (r && r.ev) rows.push(r);
  }
  rows.sort((a, b) => new Date(b.ts) - new Date(a.ts)); // newest first
  return rows;
}

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function ago(ts) {
  const d = Math.floor((Date.now() - new Date(ts)) / DAY);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7)  return d + "d ago";
  if (d < 60) return Math.floor(d / 7) + "w ago";
  return Math.floor(d / 30) + "mo ago";
}

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " +
         d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function tally(rows, field) {
  const m = new Map();
  for (const r of rows) {
    const v = (r[field] || "").trim();
    if (!v) continue;
    m.set(v, (m.get(v) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

/* 12-week bar chart, inline SVG — no libraries */
function chart(sent) {
  const weeks = 12, now = Date.now();
  const buckets = new Array(weeks).fill(0);
  const labels  = new Array(weeks).fill("");
  for (let i = 0; i < weeks; i++) {
    const end = now - i * 7 * DAY;
    labels[weeks - 1 - i] = new Date(end).toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
  }
  for (const r of sent) {
    const w = Math.floor((now - new Date(r.ts)) / (7 * DAY));
    if (w >= 0 && w < weeks) buckets[weeks - 1 - w]++;
  }
  const max = Math.max(3, ...buckets);
  const W = 760, H = 150, pad = 26, bw = (W - pad * 2) / weeks;

  const bars = buckets.map((v, i) => {
    const h = v / max * (H - 44);
    const x = pad + i * bw + bw * 0.16;
    const y = H - 24 - h;
    const w = bw * 0.68;
    const col = v === 0 ? "#DCE4EA" : (i >= weeks - 4 ? "#E2731B" : "#2C7DA0");
    const lbl = v > 0 ? `<text x="${x + w / 2}" y="${y - 5}" class="bv">${v}</text>` : "";
    return `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(h, 1)}" rx="2" fill="${col}"/>${lbl}
            <text x="${x + w / 2}" y="${H - 8}" class="bl">${labels[i]}</text>`;
  }).join("");

  // target line: 3 asks/week
  const ty = H - 24 - (3 / max * (H - 44));
  const target = max >= 3
    ? `<line x1="${pad}" y1="${ty}" x2="${W - pad}" y2="${ty}" stroke="#C7972F" stroke-width="1.5" stroke-dasharray="4 4"/>
       <text x="${W - pad}" y="${ty - 5}" text-anchor="end" class="tg">target · 3/wk</text>`
    : "";

  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${target}${bars}</svg>`;
}

function page(rows, client) {
  const sent   = rows.filter(r => r.ev === "sent");
  const landed = rows.filter(r => r.ev === "landed");

  const now = Date.now();
  const since = d => sent.filter(r => now - new Date(r.ts) < d * DAY).length;
  const s7 = since(7), s30 = since(30);

  const lastAsk = sent[0]?.ts || null;
  const quietDays = lastAsk ? Math.floor((now - new Date(lastAsk)) / DAY) : null;

  // health banner
  let health, healthClass;
  if (!sent.length) {
    health = "No review requests sent yet. If the tool has been live more than a few days, check in — it may not be installed on his phone.";
    healthClass = "warn";
  } else if (quietDays >= 14) {
    health = `No asks in ${quietDays} days. The tool has gone cold — worth a phone call.`;
    healthClass = "bad";
  } else if (quietDays >= 8) {
    health = `Last ask was ${quietDays} days ago. Momentum is slipping — a nudge would help.`;
    healthClass = "warn";
  } else if (s30 >= 8) {
    health = `On pace — ${s30} asks in the last 30 days, last one ${ago(lastAsk)}. This is what good looks like.`;
    healthClass = "good";
  } else {
    health = `Active — last ask ${ago(lastAsk)}. Target is 2–3 a month minimum; currently at ${s30}.`;
    healthClass = "ok";
  }

  const rate = sent.length ? Math.round(landed.length / sent.length * 100) : 0;

  const feed = rows.slice(0, 120).map(r => {
    const isL = r.ev === "landed";
    return `<tr>
      <td class="ts">${fmtDate(r.ts)}<span class="rel">${ago(r.ts)}</span></td>
      <td><span class="tag ${isL ? "t-land" : "t-sent"}">${isL ? "★ Landed" : "Asked"}</span></td>
      <td class="who">${esc(r.who) || "—"}</td>
      <td>${esc(r.town) || "<span class='dim'>—</span>"}</td>
      <td>${esc(r.service) || "<span class='dim'>—</span>"}</td>
      <td><span class="plat p-${r.platform}">${r.platform === "yelp" ? "Yelp" : "Google"}</span></td>
      <td class="dim">${r.channel === "email" ? "email" : r.channel === "sms" ? "text" : "—"}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="7" class="empty">Nothing logged yet. Send a review request from the app and refresh this page.</td></tr>`;

  const bar = (list, total) => list.slice(0, 8).map(([k, v]) =>
    `<div class="brow"><span class="bk">${esc(k)}</span><span class="btrack"><span class="bfill" style="width:${Math.round(v / total * 100)}%"></span></span><b>${v}</b></div>`
  ).join("") || `<div class="dim" style="padding:8px 0">—</div>`;

  const towns    = tally(sent, "town");
  const services = tally(sent, "service");
  const maxT = towns[0]?.[1] || 1, maxS = services[0]?.[1] || 1;

  const gCount = sent.filter(r => r.platform === "google").length;
  const yCount = sent.filter(r => r.platform === "yelp").length;

  const csv = JSON.stringify(rows.map(r => ({
    ts: r.ts, ev: r.ev, who: r.who, town: r.town, service: r.service, platform: r.platform, channel: r.channel
  })));

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Review Activity — ${esc(client)}</title>
<style>
:root{--navy:#0B2A45;--navy2:#16405F;--blue:#2C7DA0;--orange:#E2731B;--brass:#C7972F;
--ink:#13293A;--muted:#69818F;--line:#DCE4EA;--paper:#F4F7F9;--ok:#1E7A5A;--bad:#B4442E;
--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--paper);color:var(--ink);font-family:var(--sans);line-height:1.5;font-size:15px}
header{background:var(--navy);color:#fff;padding:22px 0;border-bottom:3px solid var(--orange)}
.wrap{max-width:900px;margin:0 auto;padding:0 20px}
.eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--brass)}
h1{font-size:24px;font-weight:700;letter-spacing:-.3px;margin-top:3px}
.sub{font-family:var(--mono);font-size:11px;color:#8FB0C4;margin-top:4px;letter-spacing:.05em}
main{padding:22px 0 60px}

.health{padding:14px 16px;border-radius:10px;margin-bottom:18px;font-size:15px;border-left:4px solid}
.health b{display:block;font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:3px}
.health.good{background:#F1F8F5;border-color:var(--ok);color:#14513C}
.health.ok{background:#EDF5F8;border-color:var(--blue);color:#1D5670}
.health.warn{background:#FEF6EF;border-color:var(--orange);color:#8A4610}
.health.bad{background:#FCF0ED;border-color:var(--bad);color:#8A2E1D}

.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:22px}
.stat{background:#fff;border:1px solid var(--line);border-top:3px solid var(--blue);border-radius:9px;padding:12px 13px}
.stat.hi{border-top-color:var(--orange)}
.stat.br{border-top-color:var(--brass)}
.stat .l{font-family:var(--mono);font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted)}
.stat .v{font-size:26px;font-weight:700;color:var(--navy);line-height:1.15;margin-top:3px}
.stat .n{font-size:11px;color:var(--muted)}

h2{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:26px 0 10px;font-weight:700}
.card{background:#fff;border:1px solid var(--line);border-radius:10px;padding:16px}
.chart{width:100%;height:auto;display:block}
.bv{font-family:var(--mono);font-size:9px;fill:var(--navy);text-anchor:middle;font-weight:700}
.bl{font-family:var(--mono);font-size:8px;fill:var(--muted);text-anchor:middle}
.tg{font-family:var(--mono);font-size:8px;fill:var(--brass)}

.cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.brow{display:flex;align-items:center;gap:9px;padding:5px 0;font-size:14px}
.bk{flex:0 0 40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.btrack{flex:1;height:7px;background:#EDF1F4;border-radius:4px;overflow:hidden}
.bfill{display:block;height:100%;background:var(--blue);border-radius:4px}
.brow b{font-family:var(--mono);font-size:12px;width:22px;text-align:right;color:var(--navy)}

.tw{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line);border-radius:10px;background:#fff}
table{width:100%;min-width:660px;border-collapse:collapse}
th{background:var(--navy);color:#fff;text-align:left;padding:9px 11px;font-family:var(--mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;font-weight:400}
td{padding:9px 11px;border-bottom:1px solid var(--line);font-size:14px;vertical-align:top}
tr:last-child td{border-bottom:0}
tr:nth-child(even) td{background:#FAFCFD}
.ts{font-family:var(--mono);font-size:11.5px;white-space:nowrap;color:var(--muted)}
.ts .rel{display:block;font-size:10px;opacity:.75}
.who{font-weight:600}
.dim{color:var(--muted)}
.tag{font-family:var(--mono);font-size:9px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;padding:3px 6px;border-radius:3px;white-space:nowrap}
.t-sent{background:#E3F0F5;color:var(--blue)}
.t-land{background:#F7EDD2;color:#8A6716}
.plat{font-family:var(--mono);font-size:10px;font-weight:700}
.p-google{color:var(--blue)}
.p-yelp{color:var(--bad)}
.empty{text-align:center;color:var(--muted);padding:32px 12px}
.bar{display:flex;gap:8px;align-items:center;margin-top:14px}
button{font-family:var(--sans);font-size:13px;font-weight:600;border:1.5px solid var(--line);background:#fff;color:var(--navy);border-radius:8px;padding:9px 14px;cursor:pointer}
button:hover{border-color:var(--blue)}
.foot{font-family:var(--mono);font-size:10px;color:var(--muted);margin-top:26px;letter-spacing:.05em;line-height:1.7}
@media(max-width:720px){.stats{grid-template-columns:repeat(2,1fr)}.cols{grid-template-columns:1fr}
.scrollhint{display:block}}
.scrollhint{display:none;font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
</style></head><body>

<header><div class="wrap">
  <div class="eyebrow">FOUND · Review Activity</div>
  <h1>${esc(client)}</h1>
  <div class="sub">${sent.length} ASKS · ${landed.length} LANDED · UPDATED ${new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).toUpperCase()}</div>
</div></header>

<main class="wrap">

  <div class="health ${healthClass}">
    <b>Status</b>${esc(health)}
  </div>

  <div class="stats">
    <div class="stat hi"><div class="l">Last 7 days</div><div class="v">${s7}</div><div class="n">asks sent</div></div>
    <div class="stat"><div class="l">Last 30 days</div><div class="v">${s30}</div><div class="n">asks sent</div></div>
    <div class="stat"><div class="l">All time</div><div class="v">${sent.length}</div><div class="n">asks sent</div></div>
    <div class="stat br"><div class="l">Reviews landed</div><div class="v">${landed.length}</div><div class="n">marked by client</div></div>
    <div class="stat"><div class="l">Conversion</div><div class="v">${sent.length ? rate + "%" : "—"}</div><div class="n">asked → landed</div></div>
  </div>

  <h2>Asks per week — last 12 weeks</h2>
  <div class="card">${chart(sent)}</div>

  <h2>Where the asks are coming from</h2>
  <div class="cols">
    <div class="card">
      <div class="l" style="font-family:var(--mono);font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);margin-bottom:8px">By town</div>
      ${bar(towns, maxT)}
    </div>
    <div class="card">
      <div class="l" style="font-family:var(--mono);font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);margin-bottom:8px">By job type</div>
      ${bar(services, maxS)}
    </div>
  </div>
  <div class="card" style="margin-top:14px">
    <div class="l" style="font-family:var(--mono);font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);margin-bottom:8px">By platform</div>
    ${bar([["Google", gCount], ["Yelp", yCount]].filter(x => x[1]), Math.max(gCount, yCount, 1))}
  </div>

  <h2>Activity feed</h2>
  <div class="scrollhint">Swipe the table sideways &rarr;</div>
  <div class="tw"><table>
    <tr><th>When</th><th>What</th><th>Customer</th><th>Town</th><th>Job type</th><th>Platform</th><th>Sent via</th></tr>
    ${feed}
  </table></div>

  <div class="bar">
    <button onclick="location.reload()">Refresh</button>
    <button id="csv">Download CSV</button>
  </div>

  <div class="foot">
    NO PHONE NUMBERS OR EMAIL ADDRESSES ARE STORED HERE. NAMES ARE TRUNCATED ON THE DEVICE BEFORE SENDING.<br>
    "LANDED" IS SELF-REPORTED — IT REFLECTS WHAT THE CLIENT TAPPED IN THE APP, NOT A VERIFIED GOOGLE REVIEW COUNT.<br>
    EVENTS SENT WHILE OFFLINE ARE QUEUED ON THE DEVICE AND ARRIVE LATE. TIMESTAMPS ARE SERVER-SIDE.
  </div>
</main>

<script>
const DATA = ${csv};
document.getElementById('csv').addEventListener('click', function(){
  const head = ["timestamp","event","customer","town","service","platform","channel"];
  const q = v => '"' + String(v ?? "").replace(/"/g,'""') + '"';
  const rows = [head.join(",")].concat(DATA.map(r => [r.ts,r.ev,r.who,r.town,r.service,r.platform,r.channel].map(q).join(",")));
  const blob = new Blob([rows.join("\\n")], {type:"text/csv"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "review-activity.csv";
  a.click();
});
</script>
</body></html>`;
}

export default async (request) => {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!process.env.PORTAL_KEY || key !== process.env.PORTAL_KEY) {
    return new Response("Not authorized. Add ?key=YOUR_PORTAL_KEY to the URL.", { status: 401 });
  }
  const client = url.searchParams.get("client") || "Lakeland Surveying";
  try {
    const store = getStore("review-events");
    const rows = await loadAll(store);
    return new Response(page(rows, client), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
    });
  } catch (e) {
    console.error("review-portal error:", e);
    return new Response("Could not load portal: " + e.message, { status: 500 });
  }
};
