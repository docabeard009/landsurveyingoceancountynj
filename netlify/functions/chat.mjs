/* =====================================================================
   Lakeland Surveying — AI chat backend  (Netlify Function)
   Runs server-side. Holds the API key. Never exposed to the browser.

   AUTO-LEARNING: the bot's page knowledge comes from knowledge-data.mjs,
   which is regenerated from your live HTML on every deploy by
   scripts/build-knowledge.mjs. Add or edit a page, deploy, and the bot
   knows it — no edits here needed.

   Pick your model provider with the PROVIDER env var:
     PROVIDER = claude      (Anthropic)   -> needs ANTHROPIC_API_KEY
     PROVIDER = openai      (GPT)         -> needs OPENAI_API_KEY
     PROVIDER = perplexity  (Perplexity)  -> needs PERPLEXITY_API_KEY
   Default is claude. Model strings live in PROVIDERS below.
   ===================================================================== */

import KNOWLEDGE from "./knowledge-data.mjs"; // auto-generated page index
import { getStore } from "@netlify/blobs";   // built-in Netlify storage (for logging questions)

/* ---- Log each visitor question so you can mine it for SEO/AEO. ---- */
async function logQuestion(q) {
  try {
    if (!q || !q.trim()) return;
    const store = getStore("chat-questions");
    const key = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    await store.setJSON(key, { q: q.trim().slice(0, 300), ts: new Date().toISOString() });
  } catch (e) {
    console.error("[log] skipped:", e.message); // never let logging break the chat
  }
}

/* ---- Core facts: always included, hand-set (rarely change). ---- */
const CORE_FACTS = `
BUSINESS: Lakeland Surveying, Inc. — a licensed New Jersey land surveying firm, 50+ years in business (since 1972). Shore office in Lavallette, NJ. Robotic total stations + GPS.
SERVICE AREA: All of Ocean County and Monmouth County, NJ — barrier-island shore towns (Lavallette, Ortley Beach, Seaside, Bay Head, Mantoloking, Point Pleasant, all of Long Beach Island) plus the mainland (Toms River, Brick, Stafford, etc.).
CONTACT: Phone (609) 201-4717. Text 917.463.6042. Free quotes. Hours Mon-Fri 8am-5pm; messages returned promptly.
`;

const GUARDRAILS = `STRICT RULES:
- Keep replies short: 2-4 sentences, warm and plain-spoken. No markdown headers.
- Use ONLY the business facts and site content provided. Never invent facts, prices, or credentials.
- NEVER state a specific license or PLS number. Say the team will confirm credentials directly; give the phone number.
- NEVER determine a property's flood zone, base flood elevation, or LOMA eligibility. Explain it needs a surveyed elevation, then point to a call or quote.
- NEVER quote a specific price or guarantee a turnaround. Say pricing is per-property and turnaround depends on the job; invite a quote or call.
- If asked something outside land surveying or not in the content, politely redirect to how Lakeland can help.
- Make it easy to act: mention calling (609) 201-4717, texting 917.463.6042, or requesting a quote when it fits.`;

/* ---- Always-on catalog: every page title so the bot knows what exists. ---- */
const CATALOG = (KNOWLEDGE || []).map(p => `- ${p.title || p.slug} (${p.slug})`).join("\n");

/* ---- Retrieval: pick the pages most relevant to the user's question. ---- */
const STOP = new Set(["the","and","for","are","you","your","with","from","that","this","have","need","what","does","can","how","our","who","where","when","near","doe","get","got","out","about"]);
function tokens(s) {
  return (String(s).toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => w.length >= 3 && !STOP.has(w));
}
function retrieve(userText, k = 4) {
  const q = tokens(userText);
  if (!q.length || !Array.isArray(KNOWLEDGE)) return [];
  const scored = KNOWLEDGE.map(p => {
    const title = (p.title || "").toLowerCase();
    const slug = (p.slug || "").toLowerCase();
    const heads = (p.headings || []).join(" ").toLowerCase();
    const desc = (p.desc || "").toLowerCase();
    const text = (p.text || "").toLowerCase();
    let s = 0;
    for (const w of q) {
      if (title.includes(w) || slug.includes(w)) s += 3;
      if (heads.includes(w)) s += 2;
      if (desc.includes(w)) s += 1;
      if (text.includes(w)) s += 1;
    }
    return { p, s };
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k);
  return scored.map(x => x.p);
}

function buildSystem(userText) {
  const hits = retrieve(userText);
  let ctx = "";
  if (hits.length) {
    ctx = "\n\nRELEVANT PAGES FROM THE SITE (use these to answer):\n" +
      hits.map(p => {
        const url = "https://landsurveyingoceancountynj.com/" + p.slug;
        return `• ${p.title} — ${url}\n  ${p.desc || ""}\n  ${(p.text || "").slice(0, 500)}`;
      }).join("\n\n");
  }
  return `You are the friendly website assistant for Lakeland Surveying, a licensed New Jersey land surveying firm. Help visitors find the right survey, confirm the service area, and guide them to call, text, or request a quote.

BUSINESS FACTS:${CORE_FACTS}

PAGES ON THE SITE:
${CATALOG}
${ctx}

${GUARDRAILS}`;
}

/* ---- Provider adapters. Update the `model` line if a name is deprecated. ---- */
const PROVIDERS = {
  claude: {
    key: "ANTHROPIC_API_KEY",
    model: "claude-haiku-4-5-20251001", // fast + cheap; "claude-sonnet-5" for higher quality
    url: "https://api.anthropic.com/v1/messages",
    build(messages, system) {
      return {
        headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: { model: this.model, max_tokens: 400, system, messages: messages.map(m => ({ role: m.role, content: m.content })) }
      };
    },
    parse(data) { return (data.content || []).map(b => b.text || "").join("").trim(); }
  },
  openai: {
    key: "OPENAI_API_KEY",
    model: "gpt-4o-mini",
    url: "https://api.openai.com/v1/chat/completions",
    build(messages, system) {
      return {
        headers: { "content-type": "application/json", "authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
        body: { model: this.model, max_tokens: 400, messages: [{ role: "system", content: system }, ...messages] }
      };
    },
    parse(data) { return (data.choices?.[0]?.message?.content || "").trim(); }
  },
  perplexity: {
    key: "PERPLEXITY_API_KEY",
    model: "sonar",
    url: "https://api.perplexity.ai/chat/completions",
    build(messages, system) {
      return {
        headers: { "content-type": "application/json", "authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}` },
        body: { model: this.model, max_tokens: 400, messages: [{ role: "system", content: system }, ...messages] }
      };
    },
    parse(data) { return (data.choices?.[0]?.message?.content || "").trim(); }
  }
};

const FALLBACK = "Sorry — I hit a snag. Please call us at (609) 201-4717 or text 917.463.6042 and we'll help you right away.";

export default async (request) => {
  const cors = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  try {
    const { messages } = await request.json();
    if (!Array.isArray(messages) || messages.length === 0) return json({ reply: "How can I help with your survey?" }, cors);

    const trimmed = messages.slice(-10)
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));

    const lastUser = [...trimmed].reverse().find(m => m.role === "user");
    await logQuestion(lastUser ? lastUser.content : ""); // capture for insights
    const system = buildSystem(lastUser ? lastUser.content : "");

    const name = (process.env.PROVIDER || "claude").toLowerCase();
    const provider = PROVIDERS[name] || PROVIDERS.claude;
    if (!process.env[provider.key]) { console.error("Missing API key env var:", provider.key); return json({ reply: FALLBACK }, cors); }

    const cfg = provider.build(trimmed, system);
    const resp = await fetch(provider.url, { method: "POST", headers: cfg.headers, body: JSON.stringify(cfg.body) });
    if (!resp.ok) { console.error("Provider error", resp.status, (await resp.text()).slice(0, 500)); return json({ reply: FALLBACK }, cors); }

    const data = await resp.json();
    return json({ reply: provider.parse(data) || FALLBACK }, cors);
  } catch (e) {
    console.error("Function error:", e);
    return json({ reply: FALLBACK }, cors);
  }
};

function json(obj, cors) {
  return new Response(JSON.stringify(obj), { status: 200, headers: { "content-type": "application/json", ...cors } });
}
