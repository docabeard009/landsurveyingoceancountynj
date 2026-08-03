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

   ---------------------------------------------------------------------
   SELF-TEST (new): if the bot ever says "I hit a snag", open this in a
   browser to see the REAL reason instead of guessing:

     https://landsurveyingoceancountynj.com/.netlify/functions/chat?selftest=YOUR_INSIGHTS_KEY

   It reports: which provider is active, whether the key is present,
   the live HTTP status from the provider, and the provider's own error
   message. Gated behind INSIGHTS_KEY so visitors can never see it.
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
SERVICE AREA: Nine New Jersey counties, town by town — Ocean, Monmouth, Atlantic, Cape May, Cumberland, Salem, Gloucester, Camden and Burlington. Coverage runs from the barrier-island shore (Lavallette, Long Beach Island, Seaside, the Wildwoods, Ocean City, Atlantic City, Cape May) to the bayfront and Delaware River towns, and the inland/Pinelands mainland (Toms River, Cherry Hill, Vineland, Mount Laurel, Washington Township, etc.). Based in the Lavallette shore office; available across all 21 NJ counties.
CONTACT: Phone 917.463.6042. Text 917.463.6042. Free quotes. Hours Mon-Fri 8am-5pm; messages returned promptly.
`;

const GUARDRAILS = `STRICT RULES:
- Keep replies short: 2-5 sentences, warm and plain-spoken. No markdown headers.
- Answer the question directly from the site content provided. If a published answer is supplied, use its substance rather than a vaguer paraphrase.
- Refer to pages by name ("our Flood Elevation Certificates page"), never paste raw URLs.
- Use ONLY the business facts and site content provided. Never invent facts, prices, or credentials.
- NEVER state a specific license or PLS number. Say the team will confirm credentials directly; give the phone number.
- NEVER determine a property's flood zone, base flood elevation, or LOMA eligibility. Explain it needs a surveyed elevation, then point to a call or quote.
- NEVER quote a specific price or guarantee a turnaround. Say pricing is per-property and turnaround depends on the job; invite a quote or call.
- If asked something outside land surveying or not in the content, politely redirect to how Lakeland can help.
- Make it easy to act: mention calling 917.463.6042, texting 917.463.6042, or requesting a quote when it fits.`;

/* =====================================================================
   RETRIEVAL v2 — this is what makes the bot able to answer site questions.

   v1 problems:
     - Dumped all 284 page titles into every prompt (~6,600 tokens of noise)
       while giving the model only 4 pages x 500 chars of ACTUAL content.
     - Scored terms flatly, so "survey" (on every page) outweighed the rare
       word that actually identified the right page.
     - Never looked at the FAQ pairs, because v1 of the builder discarded them.

   v2:
     - Compact catalog: services/guides/hubs listed in full, 256 towns
       collapsed to name lists grouped by county. Same coverage, ~1/4 the size.
     - IDF weighting so rare terms (town names, "LOMA", "stakeout") dominate.
     - Bigram phrase bonus for multi-word matches.
     - Searches all 820 FAQ pairs directly and puts the best ones first.
     - Feeds ~6x more page content per answer, budgeted across 6 pages.
   ===================================================================== */

const PAGES = Array.isArray(KNOWLEDGE) ? KNOWLEDGE : [];

/* ---- Compact catalog: full coverage, a fraction of the tokens. ---- */
const CATALOG = (() => {
  const lines = [];
  const named = PAGES.filter(p => p.kind !== "town");
  const group = (label, kinds) => {
    const rows = named.filter(p => kinds.includes(p.kind));
    if (!rows.length) return;
    lines.push(label + ":");
    rows.forEach(p => lines.push(`  - ${p.title || p.slug} (${p.slug})`));
  };
  group("SERVICE PAGES", ["service"]);
  group("COUNTY HUB PAGES", ["county-hub"]);
  group("GUIDES & TOOLS", ["guide", "tool"]);
  group("MAIN PAGES", ["core", "page"]);

  const towns = PAGES.filter(p => p.kind === "town");
  if (towns.length) {
    const byCounty = {};
    towns.forEach(p => { (byCounty[p.county || "Other"] ||= []).push(p); });
    lines.push(`TOWN PAGES (${towns.length} towns; each lives at areas/<town-slug>.html):`);
    Object.keys(byCounty).sort().forEach(c => {
      const names = byCounty[c]
        .map(p => (p.title || p.slug).replace(/\s*(Land\s+)?Surveying?.*$/i, "").replace(/,\s*NJ.*$/i, "").trim() || p.slug)
        .sort();
      lines.push(`  ${c} County (${names.length}): ${names.join(", ")}`);
    });
  }
  return lines.join("\n");
})();

/* ---- Tokenising + IDF. ---- */
const STOP = new Set(["do","am","is","are","be","was","if","in","on","at","to","of","or","by","it","me","my","we","us","so","no","an","as","the","and","for","are","you","your","with","from","that","this","have","need","what","does","can","how","our","who","where","when","near","get","got","out","about","its","was","but","not","all","any","has","had","will","would","should","there","their","them","they","been","were","just","also","than","then","into","over","some","more","much","very","does","did","doing","tell","know","like","want","help","please","hi","hello","thanks"]);
function tokens(s) {
  return (String(s).toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter(w => w.length >= 2 && !STOP.has(w));
}
function bigrams(ts) {
  const out = [];
  for (let i = 0; i < ts.length - 1; i++) out.push(ts[i] + " " + ts[i + 1]);
  return out;
}

/* Pre-compute WORD SETS (not substrings) once per cold start.
   Substring matching was the bug in v1: `text.includes("am")` matches inside
   "Camden", `includes("do")` matches nearly every page. Token sets make
   matching word-exact, which is what actually finds the right page. */
function tokenSet(s) { return new Set(tokens(s)); }
function bigramSet(s) { return new Set(bigrams(tokens(s))); }
function slugWords(slug) { return String(slug || "").replace(/[/._-]+/g, " "); }

const DOCS = PAGES.map(p => {
  const faqBlob = (p.faqs || []).map(f => f.q + " " + f.a).join(" ");
  const faqQs = (p.faqs || []).map(f => f.q).join(" ");
  return {
    p,
    title: tokenSet((p.title || "") + " " + slugWords(p.slug) + " " + (p.county || "")),
    heads: tokenSet((p.headings || []).join(" ")),
    faq:   tokenSet(faqBlob),
    desc:  tokenSet(p.desc || ""),
    text:  tokenSet(p.text || ""),
    bigTitle: bigramSet((p.title || "") + " " + (p.headings || []).join(" ") + " " + faqQs),
    bigBody:  bigramSet(p.text || " " + faqBlob)
  };
});

const DF = (() => {
  const df = new Map();
  for (const d of DOCS) {
    const seen = new Set([...d.title, ...d.heads, ...d.faq, ...d.desc, ...d.text]);
    for (const w of seen) df.set(w, (df.get(w) || 0) + 1);
  }
  return df;
})();
const N = Math.max(DOCS.length, 1);
function idf(w) {
  const d = DF.get(w) || 0;
  return Math.log(1 + N / (1 + d)); // rare terms score far higher than "survey"
}

/* ---- Page-type priors + geographic intent. ----
   256 of 279 pages are town pages that all mention "flood zone", "LOMA", "VE"
   in near-identical copy. Without a prior they tie and alphabetical order wins,
   so "what is a LOMA" returned Aberdeen. Rule: if the visitor names a place,
   town pages are what they want. If they don't, the service/guide pages are. */
const KIND_PRIOR = { service: 1.35, guide: 1.30, tool: 1.30, core: 1.15, "county-hub": 1.10, page: 1.0, town: 1.0 };
const GENERIC_PLACE_WORDS = new Set(["land","surveying","surveyor","surveyors","survey","surveys","nj","new","jersey","township","borough","city","county","town","area","service","services","lakeland"]);
const PLACE_WORDS = (() => {
  const set = new Set();
  for (const p of PAGES) {
    if (p.kind !== "town" && p.kind !== "county-hub") continue;
    for (const w of tokens((p.title || "") + " " + slugWords(p.slug))) {
      if (!GENERIC_PLACE_WORDS.has(w)) set.add(w);
    }
    if (p.county) for (const w of tokens(p.county)) set.add(w);
  }
  return set;
})();
function mentionsPlace(qs) { return qs.some(w => PLACE_WORDS.has(w)); }

/* ---- Page retrieval. ---- */
function retrieve(userText, k = 6) {
  const qs = tokens(userText);
  if (!qs.length || !DOCS.length) return [];
  const bg = bigrams(qs);
  const geo = mentionsPlace(qs);
  const scored = [];
  for (const d of DOCS) {
    let s = 0;
    for (const w of qs) {
      const weight = idf(w);
      if (d.title.has(w)) s += weight * 3.0;
      if (d.faq.has(w))   s += weight * 2.5;
      if (d.heads.has(w)) s += weight * 2.0;
      if (d.desc.has(w))  s += weight * 1.5;
      if (d.text.has(w))  s += weight * 1.0;
    }
    for (const b of bg) {
      if (d.bigTitle.has(b)) s += 6;
      else if (d.bigBody.has(b)) s += 2;
    }
    if (s <= 0) continue;
    s *= (KIND_PRIOR[d.p.kind] || 1);
    if (!geo && d.p.kind === "town") s *= 0.65; // no place named -> prefer the service page
    scored.push({ d, s });
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, k).map(x => x.d.p);
}

/* ---- FAQ retrieval: every published Q&A pair, searched directly. ---- */
const FAQ_INDEX = [];
for (const p of PAGES) {
  for (const f of (p.faqs || [])) {
    FAQ_INDEX.push({
      q: f.q, a: f.a, title: p.title || p.slug, slug: p.slug, kind: p.kind,
      qt: tokenSet(f.q), at: tokenSet(f.a), qb: bigramSet(f.q), ab: bigramSet(f.a)
    });
  }
}
function retrieveFaqs(userText, k = 6) {
  const qs = tokens(userText);
  if (!qs.length || !FAQ_INDEX.length) return [];
  const bg = bigrams(qs);
  const geo = mentionsPlace(qs);
  const scored = [];
  for (const f of FAQ_INDEX) {
    let s = 0;
    for (const w of qs) {
      const weight = idf(w);
      if (f.qt.has(w)) s += weight * 2.5;      // matching the QUESTION matters most
      else if (f.at.has(w)) s += weight * 1.0;
    }
    for (const b of bg) {
      if (f.qb.has(b)) s += 7;
      else if (f.ab.has(b)) s += 3;
    }
    if (s <= 0) continue;
    s *= (KIND_PRIOR[f.kind] || 1);
    if (!geo && f.kind === "town") s *= 0.65;
    scored.push({ f, s });
  }
  scored.sort((a, b) => b.s - a.s);
  const top = scored.slice(0, k);
  if (!top.length) return [];
  const cut = top[0].s * 0.45; // drop the weak tail rather than padding with noise
  return top.filter(x => x.s >= cut).map(x => x.f);
}

/* ---- Static half of the system prompt (identical every request -> cacheable). ---- */
const SYSTEM_STATIC = `You are the friendly website assistant for Lakeland Surveying, a licensed New Jersey land surveying firm. Help visitors find the right survey, confirm the service area, and guide them to call, text, or request a quote.

BUSINESS FACTS:${CORE_FACTS}

EVERYTHING ON THIS WEBSITE:
${CATALOG}

${GUARDRAILS}`;

/* ---- Dynamic half: the retrieved answers for this specific question. ---- */
function buildContext(userText) {
  const parts = [];

  const faqs = retrieveFaqs(userText);
  if (faqs.length) {
    parts.push("ANSWERS ALREADY PUBLISHED ON THE SITE (prefer these; they are approved copy):\n" +
      faqs.map(f => `Q: ${f.q}\nA: ${f.a}\n(from: ${f.title})`).join("\n\n"));
  }

  const hits = retrieve(userText);
  if (hits.length) {
    const budget = [2500, 2500, 1500, 1500, 1000, 1000];
    parts.push("RELEVANT PAGE CONTENT:\n" +
      hits.map((p, i) => {
        const head = `• ${p.title}${p.county ? ` [${p.county} County]` : ""} — page: ${p.slug}`;
        const body = (p.text || "").slice(0, budget[i] || 800);
        return `${head}\n  ${p.desc || ""}\n  ${body}`;
      }).join("\n\n"));
  }

  if (!parts.length) {
    parts.push("No specific page matched this question. Answer from the business facts above, or say the team can confirm and give the phone number.");
  }
  return parts.join("\n\n");
}

/* ---- Provider adapters. Update the `model` line if a name is deprecated. ---- */
const PROVIDERS = {
  claude: {
    key: "ANTHROPIC_API_KEY",
    model: "claude-haiku-4-5-20251001", // fast + cheap; "claude-sonnet-5" for higher quality
    url: "https://api.anthropic.com/v1/messages",
    build(messages, system) {
      const sys = typeof system === "string"
        ? [{ type: "text", text: system }]
        : [{ type: "text", text: system.static, cache_control: { type: "ephemeral" } }, { type: "text", text: system.dynamic }];
      return {
        headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: { model: this.model, max_tokens: 600, system: sys, messages: messages.map(m => ({ role: m.role, content: m.content })) }
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
        body: { model: this.model, max_tokens: 600, messages: [{ role: "system", content: flatten(system) }, ...messages] }
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
        body: { model: this.model, max_tokens: 600, messages: [{ role: "system", content: flatten(system) }, ...messages] }
      };
    },
    parse(data) { return (data.choices?.[0]?.message?.content || "").trim(); }
  }
};

function flatten(system) { return typeof system === "string" ? system : system.static + "\n\n" + system.dynamic; }

/* Bump this string whenever you edit this file — it is echoed by the
   self-test so you can confirm at a glance that your deploy actually landed. */
const BUILD = "chat.mjs v2 — retrieval v2 (FAQ index + IDF scoring)";

const FALLBACK = "Sorry — I hit a snag. Please call us at 917.463.6042 or text 917.463.6042 and we'll help you right away.";

/* ---- Which provider is active right now. ---- */
function activeProvider() {
  const name = (process.env.PROVIDER || "claude").trim().toLowerCase();
  const provider = PROVIDERS[name] || PROVIDERS.claude;
  const resolved = PROVIDERS[name] ? name : "claude";
  return { name: resolved, requested: name, provider };
}

/* ---- fetch with an abort timeout so we never hit Netlify's hard 10s kill. ---- */
async function fetchWithTimeout(url, opts, ms = 8500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* ---- Call the provider. Retries once on 429/5xx. Returns detail on failure. ---- */
async function callProvider(provider, messages, system) {
  const cfg = provider.build(messages, system);
  let last = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetchWithTimeout(provider.url, {
        method: "POST",
        headers: cfg.headers,
        body: JSON.stringify(cfg.body)
      });

      if (resp.ok) {
        const data = await resp.json();
        const text = provider.parse(data);
        if (text) return { ok: true, text };
        last = { ok: false, status: resp.status, detail: "Provider returned 200 but the reply was empty." };
      } else {
        const body = (await resp.text()).slice(0, 600);
        last = { ok: false, status: resp.status, detail: body };
        console.error("Provider error", resp.status, body);
        // Only retry transient failures. 401/400/404 will never fix themselves.
        if (resp.status !== 429 && resp.status < 500) return last;
      }
    } catch (e) {
      last = { ok: false, status: 0, detail: e.name === "AbortError" ? "Request timed out after 8.5s." : e.message };
      console.error("Provider call threw:", last.detail);
    }
    if (attempt === 0) await new Promise(r => setTimeout(r, 600));
  }
  return last || { ok: false, status: 0, detail: "Unknown failure." };
}

/* ---- Self-test: GET ?selftest=INSIGHTS_KEY ---- */
async function selfTest() {
  const { name, requested, provider } = activeProvider();
  const rawKey = process.env[provider.key] || "";
  const out = {
    checkedAt: new Date().toISOString(),
    providerRequested: requested,
    providerActive: name,
    model: provider.model,
    keyEnvVar: provider.key,
    keyPresent: Boolean(rawKey),
    keyLength: rawKey.length,
    keyFingerprint: rawKey ? rawKey.slice(0, 8) + "…" + rawKey.slice(-4) : null,
    knowledgeEntries: Array.isArray(KNOWLEDGE) ? KNOWLEDGE.length : 0,
    staticPromptChars: 0,
    knowledgeFaqPairs: 0,
    sampleContextChars: 0,
    blobsWritable: null,
    providerStatus: null,
    providerDetail: null,
    roundTripMs: null,
    verdict: null
  };

  try {
    out.staticPromptChars = SYSTEM_STATIC.length;
    out.knowledgeFaqPairs = FAQ_INDEX.length;
    const probe = buildContext("do I need an elevation certificate in Lavallette");
    out.sampleContextChars = probe.length;
    out.sampleFaqHits = retrieveFaqs("do I need an elevation certificate in Lavallette").length;
    out.samplePageHits = retrieve("do I need an elevation certificate in Lavallette").map(p => p.slug);
  } catch (e) { out.retrievalError = e.message; }

  try {
    const store = getStore("chat-questions");
    await store.setJSON("selftest-ping", { ts: out.checkedAt });
    out.blobsWritable = true;
  } catch (e) {
    out.blobsWritable = "ERROR: " + e.message;
  }

  if (!out.keyPresent) {
    out.verdict = `MISSING KEY — the env var ${provider.key} is not set on this Netlify site/deploy context. Add it in Site configuration → Environment variables, then redeploy.`;
    return out;
  }

  const t0 = Date.now();
  const res = await callProvider(provider, [{ role: "user", content: "Reply with the single word: OK" }], { static: "You are a test harness.", dynamic: "Reply with exactly: OK" });
  out.roundTripMs = Date.now() - t0;
  out.providerStatus = res.ok ? 200 : res.status;
  out.providerDetail = res.ok ? res.text.slice(0, 120) : res.detail;

  if (res.ok) {
    out.verdict = "HEALTHY — the provider answered. If the widget still fails, hard-refresh the page (the browser may be caching an old chat-widget.js).";
  } else if (res.status === 401 || res.status === 403) {
    out.verdict = `BAD KEY — ${provider.key} is present but rejected (${res.status}). It was almost certainly rotated or revoked. Generate a fresh key and update it on Netlify.`;
  } else if (res.status === 400 && /credit|balance|quota|billing/i.test(String(res.detail))) {
    out.verdict = "OUT OF CREDIT — the account has no usable balance. Top up billing on the provider account.";
  } else if (res.status === 404) {
    out.verdict = `BAD MODEL NAME — "${provider.model}" was not found. Update the model string in PROVIDERS.`;
  } else if (res.status === 429) {
    out.verdict = "RATE LIMITED — too many requests or a spend cap was hit. Check the provider's usage limits.";
  } else if (res.status === 0) {
    out.verdict = "NETWORK/TIMEOUT — the function could not complete the call to the provider.";
  } else {
    out.verdict = `PROVIDER ERROR ${res.status} — see providerDetail below for the provider's own message.`;
  }
  return out;
}

export default async (request) => {
  const cors = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  /* --- Diagnostic endpoint (gated by INSIGHTS_KEY) --- */
  if (request.method === "GET") {
    const url = new URL(request.url);

    // Only respond to a GET that explicitly asks for the self-test. A plain
    // GET stays a 405 exactly as before, so the endpoint looks unchanged to
    // anyone poking at it.
    if (url.searchParams.has("selftest")) {
      // .trim() both sides: a stray space or newline pasted into the Netlify
      // env var is a very easy way to get a silent mismatch.
      const token = String(url.searchParams.get("selftest") || "").trim();
      const secret = String(process.env.INSIGHTS_KEY || "").trim();

      // Fully authenticated -> complete report.
      if (secret && token && token === secret) {
        const report = await selfTest();
        return new Response(JSON.stringify({ build: BUILD, ...report }, null, 2), {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "no-store", ...cors }
        });
      }

      // INSIGHTS_KEY isn't configured, so there is no possible way to
      // authenticate — and refusing here would hide the very fact that
      // explains the failure. Return a REDACTED report instead: enough to
      // diagnose, with no key material of any kind. Setting INSIGHTS_KEY
      // switches this off and locks the endpoint down again.
      if (!secret) {
        const full = await selfTest();
        return new Response(JSON.stringify({
          build: BUILD,
          mode: "redacted (INSIGHTS_KEY is not set on this site)",
          providerActive: full.providerActive,
          model: full.model,
          keyEnvVar: full.keyEnvVar,
          keyPresent: full.keyPresent,
          providerStatus: full.providerStatus,
          roundTripMs: full.roundTripMs,
          knowledgeEntries: full.knowledgeEntries,
          knowledgeFaqPairs: full.knowledgeFaqPairs,
          providerDetail: full.providerDetail ? String(full.providerDetail).slice(0, 200) : null,
          verdict: full.verdict,
          note: "Set INSIGHTS_KEY in Netlify env vars to require a token here. No API key value is ever included in this response."
        }, null, 2), {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "no-store", ...cors }
        });
      }

      // Key IS configured but the token was wrong — say why, reveal nothing.
      const reason = /^(your_insights_key|your-insights-key|insights_key)$/i.test(token)
        ? "You pasted the placeholder. Replace it with the actual value of the INSIGHTS_KEY environment variable."
        : "The selftest token does not match INSIGHTS_KEY. Check for a typo, or a trailing space in the Netlify environment variable.";

      return new Response(JSON.stringify({
        build: BUILD,
        ok: false,
        insightsKeyConfigured: true,
        tokenReceivedLength: token.length,
        reason
      }, null, 2), {
        status: 401,
        headers: { "content-type": "application/json", "cache-control": "no-store", ...cors }
      });
    }

    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  try {
    const { messages } = await request.json();
    if (!Array.isArray(messages) || messages.length === 0) return json({ reply: "How can I help with your survey?" }, cors);

    const trimmed = messages.slice(-10)
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));

    const lastUser = [...trimmed].reverse().find(m => m.role === "user");
    await logQuestion(lastUser ? lastUser.content : ""); // capture for insights
    const system = { static: SYSTEM_STATIC, dynamic: buildContext(lastUser ? lastUser.content : "") };

    const { provider, name } = activeProvider();
    if (!process.env[provider.key]) {
      console.error("CHAT FAIL — missing API key env var:", provider.key, "(provider:", name + ")");
      return json({ reply: FALLBACK }, cors);
    }

    const res = await callProvider(provider, trimmed, system);
    if (!res.ok) {
      console.error("CHAT FAIL — provider", name, "status", res.status, "detail:", String(res.detail).slice(0, 400));
      return json({ reply: FALLBACK }, cors);
    }
    return json({ reply: res.text }, cors);
  } catch (e) {
    console.error("CHAT FAIL — exception:", e && e.stack ? e.stack : e);
    return json({ reply: FALLBACK }, cors);
  }
};

function json(obj, cors) {
  return new Response(JSON.stringify(obj), { status: 200, headers: { "content-type": "application/json", ...cors } });
}
