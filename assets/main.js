// Progressive enhancement flag — reveal-hiding only applies when JS runs
document.documentElement.classList.add('js');

// Mobile nav toggle
const burger = document.querySelector('.burger');
const header = document.querySelector('header.nav');
if (burger) {
  burger.addEventListener('click', () => {
    header.classList.toggle('mobile-open');
    document.body.style.overflow = header.classList.contains('mobile-open') ? 'hidden' : '';
  });
  // mobile: tap a top-level dropdown link toggles its submenu instead of navigating
  header.querySelectorAll('.menu > li > a').forEach(a => {
    a.addEventListener('click', e => {
      if (window.innerWidth <= 640 && a.nextElementSibling) {
        e.preventDefault();
        a.parentElement.classList.toggle('open-sub');
        const d = a.nextElementSibling;
        d.style.display = a.parentElement.classList.contains('open-sub') ? 'block' : 'none';
      }
    });
  });
}

// Scroll reveal (with graceful fallbacks)
const reveals = document.querySelectorAll('.reveal');
function revealAll(){ reveals.forEach(el => el.classList.add('in')); }
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: 0.12 });
  reveals.forEach(el => io.observe(el));
  // safety net: never leave content hidden if observer misfires
  setTimeout(() => {
    reveals.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && !el.classList.contains('in')) el.classList.add('in');
    });
  }, 2500);
} else {
  revealAll();
}

// Track text-button (sms:) and call-button (tel:) taps.
// These links never hit the server and GA ignores sms:/tel:, so without
// this they're invisible. Each tap fires a GA event AND a first-party
// log to /.netlify/functions/click-log (viewable in the Tap Insights
// dashboard). sendBeacon is used because the tap navigates away to the
// Messages/Phone app — it still delivers reliably as the page unloads.
(function () {
  function record(type, a) {
    var num = (a.textContent || "").trim();
    // 1) GA4 custom event
    if (typeof gtag === "function") {
      gtag("event", type === "sms" ? "sms_click" : "call_click", {
        link_url: a.getAttribute("href") || "",
        link_text: num,
        page_path: location.pathname
      });
    }
    // 2) First-party log to Netlify Blobs
    try {
      var payload = JSON.stringify({ events: [{ type: type, path: location.pathname, num: num, at: Date.now() }] });
      var url = "/.netlify/functions/click-log";
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
      } else {
        fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true });
      }
    } catch (e) { /* never block the tap */ }
  }
  document.querySelectorAll('a[href^="sms:"]').forEach(function (a) {
    a.addEventListener("click", function () { record("sms", a); });
  });
  document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
    a.addEventListener("click", function () { record("call", a); });
  });
})();
