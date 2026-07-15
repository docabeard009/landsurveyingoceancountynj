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

// Track text-button (sms:) and call-button (tel:) taps in GA4.
// These links never hit the server and GA's enhanced measurement ignores
// sms:/tel:, so without this they're invisible. Fires a custom event per tap.
(function () {
  function send(name, a) {
    if (typeof gtag !== 'function') return;
    gtag('event', name, {
      link_url: a.getAttribute('href') || '',
      link_text: (a.textContent || '').trim(),
      page_path: location.pathname
    });
  }
  document.querySelectorAll('a[href^="sms:"]').forEach(a =>
    a.addEventListener('click', () => send('sms_click', a)));
  document.querySelectorAll('a[href^="tel:"]').forEach(a =>
    a.addEventListener('click', () => send('call_click', a)));
})();
