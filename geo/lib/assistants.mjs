// geo/lib/assistants.mjs
// One adapter per grounded assistant. Each returns a normalized shape:
//   { ok: boolean, text: string, domains: string[], error?: string }
// `domains` = registrable domains the assistant cited (deduped, lowercased, www-stripped).
// Any adapter can fail independently without killing a run.

const DEFAULT_TIMEOUT_MS = 45000;

function toDomain(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  try {
    // Real URL
    const u = new URL(s.startsWith('http') ? s : `https://${s}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    // Gemini often hands back a site title rather than a URL. If it looks
    // domain-ish, keep it; otherwise drop it.
    s = s.toLowerCase().replace(/^www\./, '');
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : '';
  }
}

function dedupeDomains(list) {
  return [...new Set(list.map(toDomain).filter(Boolean))];
}

async function postJSON(url, { headers, body, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { httpError: `${res.status} ${JSON.stringify(json).slice(0, 300)}` };
    }
    return { json };
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------------
// Perplexity (OpenAI-compatible chat/completions, search built in)
// ---------------------------------------------------------------------------
async function perplexity(query, cfg = {}) {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return { ok: false, text: '', domains: [], error: 'no PERPLEXITY_API_KEY' };
  const { json, httpError } = await postJSON('https://api.perplexity.ai/chat/completions', {
    headers: { authorization: `Bearer ${key}` },
    body: {
      model: cfg.model || 'sonar',
      messages: [{ role: 'user', content: query }],
    },
  });
  if (httpError) return { ok: false, text: '', domains: [], error: httpError };
  const text = json?.choices?.[0]?.message?.content || '';
  const urls = [
    ...(Array.isArray(json?.citations) ? json.citations : []),
    ...((json?.search_results || []).map((r) => r?.url).filter(Boolean)),
  ];
  return { ok: true, text, domains: dedupeDomains(urls) };
}

// ---------------------------------------------------------------------------
// OpenAI (Responses API + web_search tool)
// ---------------------------------------------------------------------------
async function openai(query, cfg = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, text: '', domains: [], error: 'no OPENAI_API_KEY' };
  const { json, httpError } = await postJSON('https://api.openai.com/v1/responses', {
    headers: { authorization: `Bearer ${key}` },
    body: {
      model: cfg.model || 'gpt-5.5',
      tools: [{ type: 'web_search' }],
      input: query,
      max_output_tokens: 1500,
    },
  });
  if (httpError) return { ok: false, text: '', domains: [], error: httpError };

  let text = json?.output_text || '';
  const urls = [];
  for (const item of json?.output || []) {
    if (item.type === 'message') {
      for (const c of item.content || []) {
        if (c.type === 'output_text') {
          if (!text) text += c.text || '';
          for (const a of c.annotations || []) {
            if (a.type === 'url_citation' && a.url) urls.push(a.url);
          }
        }
      }
    }
    if (item.type === 'web_search_call') {
      for (const src of item.action?.sources || []) {
        if (src?.url) urls.push(src.url);
      }
    }
  }
  return { ok: true, text, domains: dedupeDomains(urls) };
}

// ---------------------------------------------------------------------------
// Gemini (generateContent + google_search tool)
// NOTE: grounding chunk URIs are Google redirect links, so the target domain is
// read from chunk.web.title (usually the site) plus anything parseable from text.
// ---------------------------------------------------------------------------
async function gemini(query, cfg = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, text: '', domains: [], error: 'no GEMINI_API_KEY' };
  const model = cfg.model || 'gemini-2.5-flash';
  const { json, httpError } = await postJSON(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      // New Gemini "auth keys" (AQ.Ab...) must be sent as a header, not ?key=.
      headers: { 'x-goog-api-key': key },
      body: {
        contents: [{ parts: [{ text: query }] }],
        tools: [{ google_search: {} }],
      },
    }
  );
  if (httpError) return { ok: false, text: '', domains: [], error: httpError };
  const cand = json?.candidates?.[0];
  const text = (cand?.content?.parts || []).map((p) => p.text || '').join('');
  const chunks = cand?.groundingMetadata?.groundingChunks || [];
  const raw = [];
  for (const ch of chunks) {
    if (ch?.web?.title) raw.push(ch.web.title);
    if (ch?.web?.uri) raw.push(ch.web.uri);
  }
  return { ok: true, text, domains: dedupeDomains(raw) };
}

// ---------------------------------------------------------------------------
// Claude (Messages API + web_search tool)
// ---------------------------------------------------------------------------
async function claude(query, cfg = {}) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, text: '', domains: [], error: 'no ANTHROPIC_API_KEY' };
  const { json, httpError } = await postJSON('https://api.anthropic.com/v1/messages', {
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: {
      model: cfg.model || 'claude-sonnet-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: query }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
    },
  });
  if (httpError) return { ok: false, text: '', domains: [], error: httpError };
  let text = '';
  const urls = [];
  for (const block of json?.content || []) {
    if (block.type === 'text') {
      text += block.text || '';
      for (const cit of block.citations || []) {
        if (cit?.url) urls.push(cit.url);
      }
    }
    if (block.type === 'web_search_tool_result') {
      for (const r of block.content || []) {
        if (r?.url) urls.push(r.url);
      }
    }
  }
  return { ok: true, text, domains: dedupeDomains(urls) };
}

export const ADAPTERS = { perplexity, openai, gemini, claude };
export { toDomain, dedupeDomains };
