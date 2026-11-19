// Anonymous reading analytics. No cookies, nothing stored on the device.
// Counts time only while the page is visible AND the reader has been active in the last minute,
// so a tab left open in the background doesn't count as reading.
(() => {
  // respect "Do not track" and Global Privacy Control
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl) return;
  if (!('crypto' in window) || !crypto.randomUUID) return;

  const id = crypto.randomUUID();
  const send = (data) => {
    const body = JSON.stringify({ id, ...data });
    if (navigator.sendBeacon && navigator.sendBeacon('/api/collect', new Blob([body], { type: 'application/json' }))) return;
    fetch('/api/collect', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
  };

  send({ t: 'start', path: location.pathname, ref: document.referrer });

  const IDLE_AFTER = 60 * 1000;
  let seconds = 0, lastInput = Date.now(), maxScroll = 0, sent = { s: 0, d: 0 };

  ['scroll', 'mousemove', 'keydown', 'touchstart', 'click', 'wheel'].forEach((e) =>
    addEventListener(e, () => { lastInput = Date.now(); }, { passive: true }));

  // how far through the story (or the page) the reader has got, in %
  const article = document.querySelector('.prose') || document.querySelector('main');
  const measure = () => {
    if (!article) return;
    const r = article.getBoundingClientRect();
    const seen = Math.min(r.height, Math.max(0, innerHeight - r.top));
    const pct = r.height > 0 ? Math.round((seen / r.height) * 100) : 100;
    if (pct > maxScroll) maxScroll = Math.min(100, pct);
  };
  addEventListener('scroll', measure, { passive: true });
  measure();

  setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - lastInput < IDLE_AFTER) seconds++;
  }, 1000);

  const flush = () => {
    if (seconds === sent.s && maxScroll === sent.d) return;
    sent = { s: seconds, d: maxScroll };
    send({ t: 'ping', s: seconds, d: maxScroll });
  };
  setInterval(flush, 15000);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  addEventListener('pagehide', flush);
})();
