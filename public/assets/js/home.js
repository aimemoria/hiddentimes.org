// Home page: makes the fanned card rows interactive. The cards themselves come from the server.
(() => {
  const hoverless = window.matchMedia('(hover: none)');
  const small = window.matchMedia('(max-width: 560px)');
  const ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4"/></svg>';

  // build the caption with textContent, so story text is never treated as HTML
  const fillCaption = (box, card) => {
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
    box.replaceChildren();
    box.append(el('span', 'kicker', card.dataset.kicker));
    const h = el('h3'); const a = el('a', '', card.dataset.title); a.href = card.getAttribute('href'); h.append(a); box.append(h);
    if (card.dataset.excerpt) box.append(el('p', '', card.dataset.excerpt));
    const more = el('a', 'more', card.dataset.cta + ' '); more.href = card.getAttribute('href');
    more.insertAdjacentHTML('beforeend', ARROW);
    box.append(more);
  };

  document.querySelectorAll('.fan').forEach((fan) => {
    const caption = fan.closest('.shelf').querySelector('.fan-caption');
    const all = [...fan.querySelectorAll('.card')];
    let cards = all;
    let active = -1;

    const setActive = (i) => {
      if (i === active || !cards[i]) return;
      active = i;
      cards.forEach((c, j) => c.classList.toggle('is-active', j === i));
      fillCaption(caption, cards[i]);
    };

    // phones fit 5 cards: hide the rest and re-centre the fan
    const layout = () => {
      cards = small.matches ? all.slice(0, 5) : all;
      all.forEach((c) => { c.hidden = !cards.includes(c); });
      const mid = (cards.length - 1) / 2;
      cards.forEach((c, i) => { c.style.setProperty('--o', i - mid); c.style.zIndex = i + 1; });
      active = -1;
      setActive(Math.floor(mid));
    };

    all.forEach((c) => {
      c.addEventListener('mouseenter', () => setActive(cards.indexOf(c)));
      c.addEventListener('focus', () => setActive(cards.indexOf(c)));
      c.addEventListener('click', (e) => {
        // on touch screens the first tap picks the card, the second opens it
        const i = cards.indexOf(c);
        if (hoverless.matches && i !== active) {
          e.preventDefault();
          fan.classList.add('is-open');
          setActive(i);
        }
      });
    });

    small.addEventListener('change', layout);
    layout();
  });
})();
