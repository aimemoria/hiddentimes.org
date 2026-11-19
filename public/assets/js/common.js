// Shared browser helpers. Public pages arrive complete from the server; this only adds behaviour.
const HT = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const date = (iso) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // picture for a story: uploaded cover, else the YouTube thumbnail, else none
  const coverOf = (s) => s.cover || (s.youtubeId ? `https://i.ytimg.com/vi/${s.youtubeId}/hqdefault.jpg` : '');

  // Header slides away while scrolling down and comes back as soon as you scroll up.
  const autoHideHeader = () => {
    const h = document.querySelector('.site-header');
    if (!h || h.dataset.static !== undefined) return;
    let lastY = window.scrollY;
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY;
      h.classList.toggle('is-scrolled', y > 8);
      if (y < h.offsetHeight) h.classList.remove('is-hidden');        // near the top: always show
      else if (delta > 6 && !h.contains(document.activeElement)) h.classList.add('is-hidden');
      else if (delta < -6) h.classList.remove('is-hidden');
      if (Math.abs(delta) > 6) lastY = y;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    h.addEventListener('focusin', () => h.classList.remove('is-hidden')); // keyboard users always see it
    update();
  };

  // Markdown → safe HTML, for the admin preview (needs /vendor/marked.min.js and /vendor/purify.min.js)
  let purifyReady = false;
  const markdown = (text) => {
    if (!window.marked || !window.DOMPurify) {
      return String(text || '').split(/\n\s*\n/).filter((b) => b.trim())
        .map((b) => `<p>${esc(b.trim()).replace(/\n/g, '<br>')}</p>`).join('');
    }
    if (!purifyReady) {
      purifyReady = true;
      DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        if (node.tagName === 'A' && /^https?:/i.test(node.getAttribute('href') || '')) {
          const external = new URL(node.getAttribute('href'), location.href).host !== location.host;
          if (external) { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer'); }
        }
        if (node.tagName === 'IMG') node.setAttribute('loading', 'lazy');
      });
    }
    return DOMPurify.sanitize(marked.parse(String(text || ''), { gfm: true, breaks: true }),
      { FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'], FORBID_ATTR: ['style'] });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoHideHeader);
  else autoHideHeader();

  return { esc, date, coverOf, markdown };
})();
