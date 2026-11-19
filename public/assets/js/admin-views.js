// Admin sections: Stories · Analytics · Account. The address (#analytics, #account) keeps your place.
(() => {
  const VIEWS = ['stories', 'analytics', 'account'];
  const links = [...document.querySelectorAll('.admin-nav a[data-view]')];
  const dash = document.getElementById('dash');

  const show = (view) => {
    if (!VIEWS.includes(view)) view = 'stories';
    VIEWS.forEach((v) => { document.getElementById(`view-${v}`).hidden = v !== view; });
    links.forEach((a) => {
      const on = a.dataset.view === view;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.dispatchEvent(new CustomEvent('ht:view', { detail: view }));
  };

  links.forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    history.replaceState(null, '', a.dataset.view === 'stories' ? location.pathname : `#${a.dataset.view}`);
    show(a.dataset.view);
    window.scrollTo({ top: 0 });
  }));

  // show the right section once signed in (and on first load)
  new MutationObserver(() => { if (!dash.hidden) show(location.hash.slice(1)); })
    .observe(dash, { attributes: true, attributeFilter: ['hidden'] });
  if (!dash.hidden) show(location.hash.slice(1));
})();
