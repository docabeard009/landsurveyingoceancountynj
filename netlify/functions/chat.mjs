/* =====================================================================
   Lakeland Surveying — AI chat backend  (Netlify Function)
   Runs server-side. Holds the API key. Never exposed to the browser.

   Pick your model provider with the PROVIDER env var:
     PROVIDER = claude      (Anthropic)   -> needs ANTHROPIC_API_KEY
     PROVIDER = openai      (GPT)         -> needs OPENAI_API_KEY
     PROVIDER = perplexity  (Perplexity)  -> needs PERPLEXITY_API_KEY
   Default is claude.

   Model strings live in PROVIDERS below. If you ever get a
   "model not found" error, update the one line for your provider.
   ===================================================================== */

/* ---- Ground truth: the bot answers ONLY from this. Edit if the site changes. ---- */
const SITE_CONTEXT = `
BUSINESS: Lakeland Surveying, Inc. — a licensed New Jersey land surveying firm, 50+ years in business (since 1972). Shore office in Lavallette, NJ. Uses robotic total stations and GPS.

SERVICE AREA: All of Ocean County and Monmouth County, NJ. Strong on the barrier-island shore towns — Lavallette, Ortley Beach, Seaside Heights/Park, Bay Head, Mantoloking, Point Pleasant, and all of Long Beach Island (Ship Bottom, Surf City, Harvey Cedars, Barnegat Light, Beach Haven, Long Beach Township) — plus the mainland (Toms River, Brick, Stafford, etc.).

SERVICES:
- FEMA Elevation Certificates: document a building's elevation vs. the FEMA base flood elevation; used by insurers and towns to rate flood insurance and confirm compliance. A shore specialty.
- Boundary surveys: establish legal property lines, corners, and encroachments from deed/record research + field measurement. For fences, disputes, additions, decks.
- Title / ALTA-NSPS surveys: for real-estate closings, refinancing, lenders, and attorneys.
- Topographic surveys: contours, spot elevations, and site features for design, drainage, and permits.
- Construction stakeout: stake foundations, utilities, and site features to approved plans.
- Condominium surveys: master-deed exhibits, unit certifications, conversions.

CONTACT: Phone (609) 201-4717. Text 917.463.6042. Free quotes. Hours Mon-Fri 8am-5pm; messages returned promptly.
`;

/* ---- Behavior + hard guardrails (this is a LICENSED firm) ---- */
const SYSTEM_PROMPT = `You are the friendly website assistant for Lakeland Surveying, a licensed New Jersey land surveying firm. Help visitors understand which survey they need, confirm the service area, and guide them to contact the team or request a quote.

Use ONLY the business information below. Never invent facts.

${SITE_CONTEXT}

STRICT RULES:
- Keep replies short: 2-4 sentences, warm and plain-spoken. No markdown headers.
- NEVER state a specific license or PLS number. If asked, say the team will confirm credentials directly and give the phone number.
- NEVER determine a specific property's flood zone, base flood elevation, or whether it qualifies for a LOMA. Explain that this needs a surveyed elevation, then point them to call or request a quote.
- NEVER quote a specific price or guarantee a turnaround time. Say pricing is per-property and turnaround depends on the job, then invite a quote or call.
- If asked something outside land surveying or not covered above, politely redirect to how Lakeland can help.
- Always make it easy to act: mention calling (609) 201-4717, texting 917.463.6042, or requesting a quote when it fits naturally.`;

/* ---- Provider adapters. Update the `model` line if a name is deprecated. ---- */
const PROVIDERS = {
  claude: {
    key: "ANTHROPIC_API_KEY",
    model: "claude-haiku-4-5-20251001", // fast + cheap; use "claude-sonnet-5" for higher quality
    url: "https://api.anthropic.com/v1/messages",
    build(messages) {
      return {
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: {
          model: this.model,
          max_tokens: 400,
          system: SYSTEM_PROMPT,
          messages: messages.map(m => ({ role: m.role, content: m.content }))
        }
      };
    },
    parse(data) {
      return (data.content || []).map(b => b.text || "").join("").trim();
    }
  },

  openai: {
    key: "OPENAI_API_KEY",
    model: "gpt-4o-mini", // cheap + capable; update if needed
    url: "https://api.openai.com/v1/chat/completions",
    build(messages) {
      return {
        headers: {
          "content-type": "application/json",
          "authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: {
          model: this.model,
          max_tokens: 400,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages]
        }
      };
    },
    parse(data) {
      return (data.choices?.[0]?.message?.content || "").trim();
    }
  },

  perplexity: {
    key: "PERPLEXITY_API_KEY",
    model: "sonar", // Perplexity's base model; "sonar-pro" for more depth
    url: "https://api.perplexity.ai/chat/completions",
    build(messages) {
      return {
        headers: {
          "content-type": "application/json",
          "authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`
        },
        body: {
          model: this.model,
          max_tokens: 400,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages]
        }
      };
    },
    parse(data) {
      return (data.choices?.[0]?.message?.content || "").trim();
    }
  }
};

const FALLBACK = "Sorry — I hit a snag. Please call us at (609) 201-4717 or text 917.463.6042 and we'll help you right away.";

export default async (request) => {
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type"
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  try {
    const { messages } = await request.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ reply: "How can I help with your survey?" }, cors);
    }

    // trim to last 10 turns to control cost; keep only role/content
    const trimmed = messages.slice(-10)
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));

    const name = (process.env.PROVIDER || "claude").toLowerCase();
    const provider = PROVIDERS[name] || PROVIDERS.claude;

    if (!process.env[provider.key]) {
      console.error("Missing API key env var:", provider.key);
      return json({ reply: FALLBACK }, cors);
    }

    const cfg = provider.build(trimmed);
    const resp = await fetch(provider.url, {
      method: "POST",
      headers: cfg.headers,
      body: JSON.stringify(cfg.body)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Provider error", resp.status, errText.slice(0, 500));
      return json({ reply: FALLBACK }, cors);
    }

    const data = await resp.json();
    const reply = provider.parse(data) || FALLBACK;
    return json({ reply }, cors);
  } catch (e) {
    console.error("Function error:", e);
    return json({ reply: FALLBACK }, cors);
  }
};

function json(obj, cors) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { "content-type": "application/json", ...cors }
  });
}
