/* =====================================================================
   review-log.mjs — write endpoint for the Review Request tool.

   The app (/reviews/) POSTs events here when Jack sends an ask or marks
   a review as landed. Events are stored in Netlify Blobs and read back
   by review-portal.mjs.

   PRIVACY: this deliberately stores NO phone numbers and NO email
   addresses. Names are truncated to "First L." on the client before
   they are ever sent. Contact details never leave the device.

   POST /.netlify/functions/review-log
   Body: { "events": [ {...}, {...} ] }
   ===================================================================== */
import { getStore } from "@netlify/blobs";

const MAX_EVENTS   = 50;   // per request
const MAX_FIELD    = 60;   // chars per string field
const VALID_EV     = new Set(["sent", "landed"]);
const VALID_PLAT   = new Set(["google", "yelp"]);
const VALID_CHAN   = new Set(["sms", "email", ""]);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type"
};

function clean(v) {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_FIELD);
}

function sanitize(e) {
  const ev = clean(e.ev).toLowerCase();
  if (!VALID_EV.has(ev)) return null;

  const platform = clean(e.platform).toLowerCase();
  const channel  = clean(e.channel).toLowerCase();

  return {
    ev,
    client:   clean(e.client) || "unknown",
    who:      clean(e.who),                                    // "Marie D." — never a full name
    town:     clean(e.town),
    service:  clean(e.service),
    platform: VALID_PLAT.has(platform) ? platform : "google",
    channel:  VALID_CHAN.has(channel) ? channel : "",
    ts:       new Date().toISOString(),                        // server time — client clocks lie
    at:       typeof e.at === "number" ? e.at : Date.now()     // client time, for offline replay
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
        status: 200,
        headers: { ...CORS, "content-type": "application/json" }
      });
    }

    const store = getStore("review-events");
    await Promise.all(events.map((e, i) => {
      // timestamp-prefixed key so list() comes back in chronological order
      const key = Date.now() + "-" + String(i).padStart(2, "0") + "-" + Math.random().toString(36).slice(2, 8);
      return store.setJSON(key, e);
    }));

    return new Response(JSON.stringify({ ok: true, stored: events.length }), {
      status: 200,
      headers: { ...CORS, "content-type": "application/json" }
    });

  } catch (e) {
    console.error("review-log error:", e.message);
    // Never let logging break the app — the app treats any failure as "retry later"
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" }
    });
  }
};
