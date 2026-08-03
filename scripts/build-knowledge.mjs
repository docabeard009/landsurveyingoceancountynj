/* build-knowledge.mjs — v2. Runs on each Netlify deploy. Indexes every content
   page (root + areas/ + services/ + guides/) into netlify/functions/knowledge-data.mjs
   so the chatbot auto-learns new/edited pages. Read-only; never fails a deploy.

   WHAT CHANGED FROM v1 (why the bot couldn't answer site questions):
   1. v1 truncated page text to 900 chars. Median page has ~2,700 chars of real
      content, so the bot only ever saw ~30% of any page. Now caps at 6,000.
   2. v1 kept the shared top-bar + breadcrumb boilerplate (identical first ~153
      chars of every page), eating a chunk of that tiny budget. Now stripped.
   3. v1 removed <script> blocks BEFORE reading them — which threw away every
      FAQPage JSON-LD block on the site. That is 820 hand-written Q&A pairs
      across 268 pages, i.e. the single best answer source you have. Now
      extracted into a `faqs` array and searched directly by the chat function.
   4. Adds `county` and `kind` tags so the bot can reason about coverage
      ("do you cover my town") without guessing.
   ------------------------------------------------------------------------- */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT  = join(ROOT, "netlify", "functions", "knowledge-data.mjs");
const SKIP_DIRS = new Set(["node_modules", ".git", "netlify", "scripts", "assets", ".github"]);
const SKIP_FILE = f => /^(google|bingsiteauth|404)/i.test(f);

const TEXT_CAP = 6000;   // was 900
const FAQ_A_CAP = 700;   // per answer
const HEAD_CAP = 20;     // was 12

const COUNTIES = ["Ocean", "Monmouth", "Atlantic", "Cape May", "Cumberland", "Salem", "Gloucester", "Camden", "Burlington"];

/* ---------- helpers ---------- */
function stripBlock(h, t) {
  return h.replace(new RegExp("<" + t + "\\b[^>]*>[\\s\\S]*?</" + t + ">", "gi"), " ");
}
function pick(re, h) { const m = h.match(re); return m ? m[1].trim() : ""; }
function decode(s) {
  return String(s)
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/&rsquo;/g, "'").replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(+n); } catch { return " "; } });
}

/* Remove the site-wide top bar + breadcrumb that prefixes every page.
   Kept deliberately conservative so a template change degrades gracefully. */
function stripChrome(text) {
  let t = text;
  t = t.replace(/^\s*NJ License[\s\S]{0,220}?quick response\s*/i, "");
  t = t.replace(/^\s*Home(?:\s*\/\s*[^/]{1,60}){1,4}\s*\/\s*/, "");
  t = t.replace(/\s*Text 917\.463\.6042 for quick response\s*/gi, " ");
  return t.replace(/\s+/g, " ").trim();
}

/* Pull FAQPage Q&A pairs out of JSON-LD. This is the highest-value content
   on the site and v1 discarded 100% of it. */
function extractFaqs(html) {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let raw = m[1].trim();
    if (!/FAQPage/i.test(raw)) continue;
    let data;
    try { data = JSON.parse(raw); } catch { continue; }
    const nodes = Array.isArray(data) ? data : (data["@graph"] ? data["@graph"] : [data]);
    for (const node of nodes) {
      if (!node || !/FAQPage/i.test(String(node["@type"] || ""))) continue;
      const list = Array.isArray(node.mainEntity) ? node.mainEntity : (node.mainEntity ? [node.mainEntity] : []);
      for (const item of list) {
        const q = decode(String(item?.name || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
        const aRaw = item?.acceptedAnswer?.text ?? item?.acceptedAnswer ?? "";
        const a = decode(String(aRaw).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
        if (q && a) out.push({ q, a: a.slice(0, FAQ_A_CAP) });
        if (out.length >= 40) return out;
      }
    }
  }
  return out;
}

/* County detection. Two stages, because the footer lists all nine counties
   and a naive scan matches everything:
     1) Count mentions in the CLEANED body (nav/header/footer already gone).
     2) Fall back to the raw HTML, but only accept a strict outlier — the
        footer mentions each county evenly, so the page's own county wins.
   A tie means "no confident county" and we leave it blank rather than guess. */
function countCounties(str) {
  const counts = {};
  for (const c of COUNTIES) {
    const n = (str.match(new RegExp(c + "\\s+County", "gi")) || []).length;
    if (n) counts[c] = n;
  }
  return counts;
}
function strictWinner(counts) {
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return "";
  if (ranked.length === 1) return ranked[0][0];
  return ranked[0][1] > ranked[1][1] ? ranked[0][0] : "";
}
function detectCounty(html, cleanBody) {
  return strictWinner(countCounties(cleanBody || "")) || strictWinner(countCounties(html));
}

function classify(slug) {
  const s = slug.toLowerCase();
  if (s.startsWith("services/") || /(surveys?|stakeout|certificates)\.html$/.test(s)) return "service";
  if (/-county\.html$/.test(s)) return "county-hub";
  if (s.startsWith("areas/") && basename(s) !== "index.html") return "town";
  if (s.startsWith("guides/")) return "guide";
  if (/calculator/.test(s)) return "tool";
  if (/^(index|about|contact|blog)\.html$/.test(s)) return "core";
  return "page";
}

function extract(html, slug) {
  const title = decode(pick(/<title[^>]*>([\s\S]*?)<\/title>/i, html))
    .replace(/\s*[|—-]\s*Lakeland Surveying.*$/i, "").trim();
  const desc = decode(pick(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i, html));

  const headings = [];
  const hre = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let hm;
  while ((hm = hre.exec(html)) && headings.length < HEAD_CAP) {
    const t = decode(hm[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (t && !headings.includes(t)) headings.push(t);
  }

  // Read FAQ schema BEFORE stripping <script>.
  const faqs = extractFaqs(html);

  let body = html.replace(/<head[\s\S]*?<\/head>/i, " ");
  ["script", "style", "nav", "header", "footer", "svg", "form", "noscript"].forEach(t => { body = stripBlock(body, t); });
  body = decode(body.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  body = stripChrome(body).slice(0, TEXT_CAP);
  const county = detectCounty(html, body);

  return { title, desc, headings, text: body, faqs, county, kind: classify(slug) };
}

function walk(dir, rel = "") {
  let out = [];
  let entries = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (SKIP_DIRS.has(e)) continue;
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    const r = rel ? rel + "/" + e : e;
    if (st.isDirectory()) out = out.concat(walk(p, r));
    else if (e.toLowerCase().endsWith(".html") && !SKIP_FILE(e)) out.push(r);
  }
  return out;
}

function build() {
  const rels = walk(ROOT);
  // The repo keeps root-level duplicates of pages that also live in areas/ and
  // services/. Index the subdirectory copy only, or the bot burns retrieval
  // slots on two identical pages.
  const subBasenames = new Set(rels.filter(r => r.includes("/")).map(r => basename(r)));
  const pages = [];
  for (const rel of rels) {
    const base = basename(rel);
    // Skip root-level duplicates (keep the subdirectory canonical);
    // always keep root index.html (homepage).
    if (!rel.includes("/") && base !== "index.html" && subBasenames.has(base)) continue;
    try {
      const info = extract(readFileSync(join(ROOT, rel), "utf8"), rel);
      if (!info.title && !info.text) continue;
      pages.push({ slug: rel, ...info });
    } catch (e) {
      console.error("[knowledge] skip", rel, e.message);
    }
  }

  const faqCount = pages.reduce((n, p) => n + (p.faqs ? p.faqs.length : 0), 0);
  const textChars = pages.reduce((n, p) => n + (p.text || "").length, 0);

  const banner = "/* AUTO-GENERATED by scripts/build-knowledge.mjs on each deploy. Do not edit by hand. */\n";
  try {
    writeFileSync(OUT, banner + "export default " + JSON.stringify(pages) + ";\n", "utf8");
    console.log(`[knowledge] indexed ${pages.length} pages, ${faqCount} FAQ pairs, ${textChars} content chars -> ${OUT}`);
  } catch (e) {
    console.error("[knowledge] WRITE FAILED (keeping existing):", e.message);
  }
}

try { build(); } catch (e) { console.error("[knowledge] fatal (ignored):", e.message); }
process.exit(0);
