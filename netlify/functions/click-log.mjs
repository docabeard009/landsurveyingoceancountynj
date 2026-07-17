/* =====================================================================
   click-log.mjs — write endpoint for text/call button taps.

   main.js POSTs here whenever a visitor taps a text (sms:) or call
   (tel:) button. Events are stored in Netlify Blobs and read back by
   click-insights.mjs.

   PRIVACY: the only phone number involved is Lakeland's OWN number
   (the one being tapped). No visitor phone number, name, or contact
   detail is ever captured — those never leave the visitor's device.

   POST /.netlify/functions/click-log
   Body: { "events": [ { "type":"sms|call", "path":"/toms-river", "num":"917.463.6042", "at":1699999999999 } ] }
   ===================================================================== */
import { getStore } from "@netlify/blobs";

const MAX_EVENTS = 30;    // per request
const MAX_FIELD  = 120;   // chars per string field
const VALID_TYPE = new Set(["sms", "call"]);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type"
};

function clean(v, max = MAX_FIELD) {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function sanitize(e) {
  const type = clean(e.type).toLowerCase();
  if (!VALID_TYPE.has(type)) return null;
  return {
    type,
    path: clean(e.path) || "/",       // which page the tap happened on
    num:  clean(e.num, 40),           // the business number that was tapped
    ts:   new Date().toISOString(),   // server time — client clocks lie
    at:   typeof e.at === "number" ? e.at : Date.now()
  };
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers: CORS });
  }
  if (request.method !== "POST") {
    return new Response("POST only", { status: 405, headers: CORS });
  }

  try {
    const body = await request.json();
    const raw = Array.isArray(body?.events) ? body.events.slice(0, MAX_EVENTS) : [];
    const events = raw.map(sanitize).filter(Boolean);

    if (!events.length) {
      return new Response(JSON.stringify({ ok: true, stored: 0 }), {
        status: 200, headers: { ...CORS, "content-type": "application/json" }
      });
    }

    const store = getStore("click-events");
    await Promise.all(events.map((e, i) => {
      // timestamp-prefixed key so list() comes back in chronological order
      const key = Date.now() + "-" + String(i).padStart(2, "0") + "-" + Math.random().toString(36).slice(2, 8);
      return store.setJSON(key, e);
    }));

    return new Response(JSON.stringify({ ok: true, stored: events.length }), {
      status: 200, headers: { ...CORS, "content-type": "application/json" }
    });

  } catch (e) {
    console.error("click-log error:", e.message);
    // Never let logging break the visitor's tap — fail quietly.
    return new Response(JSON.stringify({ ok: false }), {
      status: 500, headers: { ...CORS, "content-type": "application/json" }
    });
  }
};
