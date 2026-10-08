import { getStore } from "@netlify/blobs";

function esc(s) { return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

async function countClicks() {
  try {
    const store = getStore("click-events");
    const { blobs } = await store.list();
    const keys = blobs.map(b => b.key).sort().slice(-2000);
    let sms = 0, call = 0;
    for (let i = 0; i < keys.length; i += 40) {
      const got = await Promise.all(keys.slice(i, i + 40).map(k => store.get(k, { type: "json" }).catch(() => null)));
      for (const r of got) {
        if (!r) continue;
        if (r.type === "sms") sms++;
        if (r.type === "call") call++;
      }
    }
    return { sms, call };
  } catch (e) {
    return { sms: 0, call: 0 };
  }
}

export default async (req) => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || "";
  const ok = key && (key === process.env.GEO_KEY || key === process.env.INSIGHTS_KEY || key === process.env.PORTAL_KEY);
  if (!ok) return new Response("Not authorized.", { status: 401 });
  const [clicks, geo] = await Promise.all([
    countClicks(),
    getStore("geo").get("lakeland/latest", { type: "json" }).catch(() => null)
  ]);
  const score = geo?.summary?.overallSurfacedPct;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Lakeland client platform</title>
<style>body{margin:0;background:#f4f7f9;color:#13293a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}header{background:#0B2A45;color:#fff;border-bottom:3px solid #E2731B}.wrap{max-width:980px;margin:0 auto;padding:22px}h1{font-family:Georgia,serif;font-weight:500}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.card{background:#fff;border:1px solid #e4ebf0;border-radius:8px;padding:14px}.n{font-size:28px;font-weight:700}.note{color:#5d7282}</style></head><body>
<header><div class="wrap">LAKELAND SURVEYING · Client platform</div></header>
<main class="wrap">
<h1>This month on the site</h1>
<div class="cards">
<div class="card"><div class="n">${clicks.call}</div>Call taps recorded</div>
<div class="card"><div class="n">${clicks.sms}</div>Text taps recorded</div>
<div class="card"><div class="n">${score == null ? "—" : esc(score) + "%"}</div>Named in answer-engine checks</div>
<div class="card"><div class="n">4</div>Google reviews on file</div>
</div>
<h2>What is live</h2>
<ul>
<li>Site calls and texts: recorded when someone taps the phone buttons. This is not the Google Business Profile call count.</li>
<li>Answer-engine check: last stored run. A 0% with 0 answers means the engine key failed, not that Lakeland ranked last.</li>
<li>Google Analytics property on the site: G-08X10CKB5T. This page cannot read that property until a GA4 data API login is connected.</li>
</ul>
<h2>Not connected yet</h2>
<ul>
<li>Formspree leads. No Formspree form ID is posted from this site yet.</li>
<li>Google Business Profile calls, direction requests, and website clicks. That needs the Business Profile account.</li>
<li>Google map rank. There is no free daily rank feed. A report is a sampled check.</li>
</ul>
<p class="note">Call and text detail is the click dashboard. Review asks are the review portal.</p>
</main></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
};
