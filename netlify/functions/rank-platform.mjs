import { getStore } from '@netlify/blobs';

const COUNTIES = ["Ocean","Monmouth","Atlantic","Cape May","Burlington","Camden","Gloucester","Salem","Cumberland"];
const THEMES = [
  ["Elevation certificate", "flood elevation certificate", "FEMA elevation certificate"],
  ["Property line", "boundary survey", "property line dispute"],
  ["Title", "title survey", "ALTA survey"],
  ["Cost", "survey cost", "how much does a survey cost"],
  ["Topographic", "topographic survey", "site survey"],
  ["Stakeout", "construction stakeout", "foundation survey"]
];
const TOWNS = {
  Ocean: ["Lavallette","Toms River","Brick","Seaside Heights","Long Beach Island"],
  Monmouth: ["Point Pleasant","Freehold","Long Branch","Manasquan","Red Bank"],
  Atlantic: ["Atlantic City","Ocean City","Egg Harbor","Ventnor","Somers Point"],
  "Cape May": ["Cape May","Wildwood","Ocean City border","Stone Harbor","Avalon"],
  Burlington: ["Mount Laurel","Moorestown","Medford","Evesham","Willingboro"],
  Camden: ["Cherry Hill","Voorhees","Haddonfield","Gloucester Township","Pennsauken"],
  Gloucester: ["Washington Township","Glassboro","Deptford","Woodbury","Monroe"],
  Salem: ["Salem","Pennsville","Carneys Point","Woodstown","Penns Grove"],
  Cumberland: ["Vineland","Millville","Bridgeton","Maurice River","Upper Deerfield"]
};
const COMPETITORS = ["Bay Point Surveying","FRD Surveying","Eastern Chadrow Associates","Acre Land Surveying","Steven R. Kelly","Gallas Surveying Group"];
const ENGINES = ["Google map pack","Google organic","ChatGPT","Perplexity","Gemini"];

function rows() {
  const out = [];
  for (const county of COUNTIES) {
    for (const [theme, a, b] of THEMES) {
      out.push({ county, theme, queries: [`${a} ${county} County`, `${b} ${TOWNS[county][0]}`] });
    }
  }
  return out;
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c])); }

export default async (req) => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || "";
  if (!process.env.GEO_KEY || key !== process.env.GEO_KEY) {
    return new Response("Not authorized. Use the platform key.", { status: 401 });
  }
  const store = getStore("geo");
  const [latest, status] = await Promise.all([
    store.get("lakeland/latest", { type: "json" }).catch(() => null),
    store.get("lakeland/status", { type: "json" }).catch(() => null)
  ]);
  const summary = latest?.summary;
  const score = summary
    ? `<p>Last answer-engine check: ${esc(latest.finishedAt || "")}. Lakeland was named in ${esc(summary.overallSurfacedPct)}% of answers.</p>`
    : `<p class="note">No answer-engine check stored yet. Run one. It can take several minutes.</p>`;
  const runUrl = `/.netlify/functions/geo-run-background?client=lakeland&key=${encodeURIComponent(key)}`;
  const list = rows();
  const table = list.map(r => `<tr><td>${esc(r.county)}</td><td>${esc(r.theme)}</td><td>${esc(r.queries.join(" · "))}</td><td>Not checked</td></tr>`).join("");
  const prompts = COUNTIES.flatMap(c => [
    `Who is a licensed surveyor for a property line dispute in ${c} County, NJ?`,
    `How much does a boundary survey cost in ${c} County, NJ?`,
    `Do I need a FEMA elevation certificate in ${TOWNS[c][0]}, NJ?`
  ]).map(p => `<li>${esc(p)}</li>`).join("");
  const comps = COMPETITORS.map(c => `<li>${esc(c)} — no live share of voice yet</li>`).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Lakeland rank platform</title>
<style>
body{margin:0;background:#f4f7f9;color:#13293a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
header{background:#0B2A45;color:#fff;border-bottom:3px solid #E2731B}
.wrap{max-width:980px;margin:0 auto;padding:22px}
h1{font-family:Georgia,serif;font-weight:500;font-size:34px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.card{background:#fff;border:1px solid #e4ebf0;border-radius:8px;padding:14px}
.n{font-size:28px;font-weight:700}
table{width:100%;border-collapse:collapse;background:#fff}
td,th{border-bottom:1px solid #e4ebf0;text-align:left;padding:8px;font-size:14px}
.note{color:#5d7282}
</style></head><body>
<header><div class="wrap">LAKELAND SURVEYING · Rank platform</div></header>
<main class="wrap">
<h1>Nine counties. Six job themes.</h1>
${score}
<p><a class="card" href="${runUrl}">Run an answer-engine check</a></p>
<p class="note">This is the tracking board. A row stays "Not checked" until a live run is stored. Google, ChatGPT, Perplexity, and Gemini do not publish a free rank feed, so a check is a sampled run, not a BrightLocal-style daily crawl.</p>
<div class="cards">
<div class="card"><div class="n">${COUNTIES.length}</div>Counties</div>
<div class="card"><div class="n">${list.length}</div>Keyword themes</div>
<div class="card"><div class="n">${ENGINES.length}</div>Engines</div>
<div class="card"><div class="n">4</div>Google reviews</div>
</div>
<h2>Engines</h2>
<p>${ENGINES.map(esc).join(" · ")}</p>
<h2>Measured against</h2>
<ul>${comps}</ul>
<h2>Answer-engine prompts</h2>
<ul>${prompts}</ul>
<h2>Keyword board</h2>
<table><tr><th>County</th><th>Theme</th><th>Queries</th><th>Status</th></tr>${table}</table>
<p class="note">Existing run history, if a check has been stored, is at the geo dashboard with the same key.</p>
</main></body></html>`;
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
};
