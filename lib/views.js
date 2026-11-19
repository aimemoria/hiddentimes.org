// Page templates. Every public page is built on the server, complete, so search engines
// and social apps (WhatsApp, Facebook, X, LinkedIn) see the real title, text and picture.
const config = require('./config');
const { esc, formatDate, readTime, hostOf } = require('./util');
const { renderMarkdown } = require('./markdown');

const { SITE_URL, SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION } = config;

const abs = (u) => (!u ? '' : /^https?:\/\//i.test(u) ? u : SITE_URL + (u.startsWith('/') ? u : '/' + u));
const storyPath = (s) => '/story/' + encodeURIComponent(s.slug);
const sectionPath = (name) => '/section/' + encodeURIComponent(name);
const mins = (s) => s.readMinutes || 0;
const readLabel = (s) => (mins(s) ? `${mins(s)} min read` : '');
const coverOf = (s) => s.cover || (s.youtubeId ? `https://i.ytimg.com/vi/${s.youtubeId}/hqdefault.jpg` : '');
const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

const icons = {
  play: '<svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M2 1.2v9.6L10.5 6z"/></svg>',
  arrow: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4"/></svg>',
  back: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M14 8H3M7 4L3 8l4 4"/></svg>',
  out: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 3H3v10h10v-3M9 2h5v5M14 2L7 9"/></svg>',
};

const categories = (stories) => {
  const count = new Map();
  stories.forEach((s) => count.set(s.category, (count.get(s.category) || 0) + 1));
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
};

const ORG = {
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL + '/',
  logo: { '@type': 'ImageObject', url: SITE_URL + '/logo-kit/dist/mark-light-256.png', width: 256, height: 256 },
};

// ---------- layout ----------

function layout({ title, description, path, image, imageAlt, type = 'website', extraMeta = '', jsonLd = [],
  body, stories = [], active = '', scripts = [], status = 200 }) {
  const url = SITE_URL + path;
  const cats = categories(stories).slice(0, 4);
  const nav = [['Latest', '/']].concat(cats.map((c) => [c, sectionPath(c)]))
    .concat(stories.some((s) => s.youtubeId) ? [['Podcasts', sectionPath('podcasts')]] : []);
  const robots = status === 200 ? 'index, follow, max-image-preview:large' : 'noindex';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="${robots}">
  ${status === 200 ? `<link rel="canonical" href="${esc(url)}">` : ''}
  <meta property="og:site_name" content="${esc(SITE_NAME)}">
  <meta property="og:type" content="${type}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:locale" content="en_GB">
  ${image ? `<meta property="og:image" content="${esc(abs(image))}">
  <meta property="og:image:alt" content="${esc(imageAlt || title)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${esc(abs(image))}">` : '<meta name="twitter:card" content="summary">'}
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  ${extraMeta}
  <link rel="alternate" type="application/rss+xml" title="${esc(SITE_NAME)}" href="${SITE_URL}/feed.xml">
  <link rel="icon" href="/logo-kit/dist/mark-light.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/logo-kit/dist/mark-light-256.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/style.css">
  <script type="module" src="/logo-kit/src/element.js"></script>
  ${jsonLd.map(ld).join('\n  ')}
</head>
<body>
  <header class="site-header">
    <div class="wrap">
      <a class="logo" href="/" aria-label="${esc(SITE_NAME)} home"><ht-logo theme="auto" tagline="false" animate="draw hover"><img src="/logo-kit/dist/logo-light-no-tagline.svg" alt="${esc(SITE_NAME)}"></ht-logo></a>
      <nav class="nav" aria-label="Sections">
        ${nav.map(([label, href], i) =>
          `<a href="${href}"${label === active ? ' class="is-active" aria-current="page"' : i > 2 && label !== 'Podcasts' ? ' class="nav-extra"' : ''}>${esc(label)}</a>`).join('')}
      </nav>
    </div>
  </header>

  <main id="main">
${body}
  </main>

  <footer class="site-footer">
    <div class="wrap">
      <a href="/" aria-label="${esc(SITE_NAME)} home"><ht-logo theme="auto" tagline="false"><img src="/logo-kit/dist/logo-light-no-tagline.svg" alt="${esc(SITE_NAME)}"></ht-logo></a>
      <span>© ${new Date().getFullYear()} ${esc(SITE_NAME)}</span>
    </div>
  </footer>

  <script src="/assets/js/common.js" defer></script>
  ${status === 200 ? '<script src="/assets/js/track.js" defer></script>' : ''}
  ${scripts.map((s) => `<script src="${s}" defer></script>`).join('\n  ')}
</body>
</html>`;
}

// ---------- pieces ----------

// a story card; data-* feeds the caption next to the fan
function card(s, extra = '') {
  const img = coverOf(s);
  return `<a class="card${img ? '' : ' card--text'}" href="${storyPath(s)}" ${extra}
      data-kicker="${esc([s.category, formatDate(s.createdAt), readLabel(s)].filter(Boolean).join(' · '))}" data-title="${esc(s.title)}"
      data-excerpt="${esc(s.excerpt)}" data-cta="${s.hasBody === false ? 'Listen' : 'Read story'}">
      ${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async">` : ''}
      ${s.youtubeId ? `<span class="badge-play" title="Has a podcast episode">${icons.play}</span>` : ''}
      <div class="card-meta">
        <span class="kicker">${esc(s.category)}${mins(s) ? ` · ${mins(s)} min` : ''}</span>
        <h3>${esc(s.title)}</h3>
      </div>
    </a>`;
}

function caption(s) {
  return `<span class="kicker">${esc([s.category, formatDate(s.createdAt), readLabel(s)].filter(Boolean).join(' · '))}</span>
    <h3><a href="${storyPath(s)}">${esc(s.title)}</a></h3>
    ${s.excerpt ? `<p>${esc(s.excerpt)}</p>` : ''}
    <a class="more" href="${storyPath(s)}">${s.hasBody === false ? 'Listen' : 'Read story'} ${icons.arrow}</a>`;
}

function shelf(title, list, href) {
  const shown = list.slice(0, 7);
  const mid = (shown.length - 1) / 2;
  const start = Math.floor(mid);
  return `
    <section class="shelf" aria-labelledby="shelf-${esc(title).replace(/\W+/g, '-')}">
      <div class="wrap">
        <div class="shelf-head">
          <h2 id="shelf-${esc(title).replace(/\W+/g, '-')}">${esc(title)}<span>${list.length}</span></h2>
          <a href="${href}">View all</a>
        </div>
        <div class="shelf-body">
          <div class="fan">${shown.map((s, i) =>
            card(s, `style="--o:${i - mid};z-index:${i + 1}"${i === start ? ' data-start' : ''}`)).join('')}</div>
          <div class="fan-caption" aria-live="polite">${caption(shown[start])}</div>
        </div>
      </div>
    </section>`;
}

// ---------- pages ----------

function homePage(stories) {
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: SITE_URL + '/', description: SITE_DESCRIPTION },
    { '@context': 'https://schema.org', ...ORG },
  ];
  const title = `${SITE_NAME} | ${SITE_TAGLINE}`;

  if (!stories.length) {
    return layout({ title, description: SITE_DESCRIPTION, path: '/', jsonLd, stories, active: 'Latest',
      body: `<div class="wrap empty"><h1 class="visually-hidden">${esc(SITE_NAME)}</h1><h2>No stories yet.</h2><p>New stories will appear here soon.</p></div>` });
  }

  const hero = stories.find((s) => s.featured) || stories[0];
  const rest = stories.filter((s) => s !== hero);
  const img = coverOf(hero);

  const shelves = [];
  if (rest.length) shelves.push(['Latest', rest, '/section/all']);
  categories(stories).forEach((c) => {
    const list = stories.filter((s) => s.category === c);
    if (list.length >= 2) shelves.push([c, list, sectionPath(c)]);
  });
  const pods = stories.filter((s) => s.youtubeId);
  if (pods.length >= 2) shelves.push(['Podcasts', pods, sectionPath('podcasts')]);

  jsonLd.push({
    '@context': 'https://schema.org', '@type': 'ItemList', name: 'Latest stories',
    itemListElement: stories.slice(0, 20).map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE_URL + storyPath(s), name: s.title })),
  });

  const body = `
    <h1 class="visually-hidden">${esc(SITE_NAME)}: ${esc(SITE_TAGLINE)}</h1>
    <section class="hero">
      <div class="wrap hero-grid">
        <div class="hero-text">
          <span class="kicker">${hero.featured ? 'Featured' : 'New'} · ${esc(hero.category)}${mins(hero) ? ` · ${mins(hero)} min read` : ''}</span>
          <h2 class="hero-title"><a href="${storyPath(hero)}">${esc(hero.title)}</a></h2>
          ${hero.excerpt ? `<p>${esc(hero.excerpt)}</p>` : ''}
          <div class="actions">
            <a class="btn" href="${storyPath(hero)}">${hero.hasBody === false ? 'Open' : 'Read the story'} ${icons.arrow}</a>
            ${hero.youtubeId ? `<a class="btn btn--ghost" href="${esc(hero.link)}" target="_blank" rel="noopener">${icons.play} Listen</a>` : ''}
          </div>
        </div>
        ${img
          ? `<a class="hero-media" href="${storyPath(hero)}" tabindex="-1" aria-hidden="true"><img src="${esc(img)}" alt="${esc(hero.coverAlt || hero.title)}" fetchpriority="high" decoding="async"></a>`
          : `<a class="hero-media is-text" href="${storyPath(hero)}" tabindex="-1" aria-hidden="true">${esc(hero.title)}</a>`}
      </div>
    </section>
    ${shelves.map(([t, list, href]) => shelf(t, list, href)).join('')}`;

  return layout({ title, description: SITE_DESCRIPTION, path: '/', image: img || '/logo-kit/dist/mark-light-256.png',
    imageAlt: hero.coverAlt || hero.title, jsonLd, body, stories, active: 'Latest', scripts: ['/assets/js/home.js'] });
}

function sectionPage(name, stories) {
  let list, title;
  if (name === 'all') { list = stories; title = 'All stories'; }
  else {
    list = stories.filter((s) => s.category === name);
    title = name;
    if (!list.length && name.toLowerCase() === 'podcasts') { list = stories.filter((s) => s.youtubeId); title = 'Podcasts'; }
  }
  if (!list.length) return null;

  const path = sectionPath(name);
  const description = `${title} on ${SITE_NAME}: ${list.slice(0, 3).map((s) => s.title).join(', ')}${list.length > 3 ? ' and more' : ''}.`;
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${title} | ${SITE_NAME}`, url: SITE_URL + path,
      hasPart: list.slice(0, 50).map((s) => ({ '@type': 'Article', headline: s.title, url: SITE_URL + storyPath(s) })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: title, item: SITE_URL + path } ] },
  ];
  const body = `
    <div class="wrap">
      <div class="page-head">
        <a class="back" href="/">${icons.back} Home</a>
        <h1>${esc(title)}</h1>
      </div>
      <div class="grid">${list.map((s) => card(s)).join('')}</div>
    </div>`;
  return layout({ title: `${title} | ${SITE_NAME}`, description, path, image: coverOf(list[0]), jsonLd, body, stories, active: title });
}

function storyPage(s, stories) {
  const path = storyPath(s);
  const img = coverOf(s);
  const description = s.excerpt || SITE_DESCRIPTION;
  const showCover = s.cover && !s.youtubeId;
  const meta = [s.author && `By ${s.author}`, formatDate(s.createdAt), readLabel(s) || readTime(s.body)].filter(Boolean);
  const more = stories.filter((x) => x.slug !== s.slug)
    .sort((a, b) => (b.category === s.category) - (a.category === s.category)).slice(0, 4);

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: s.title.slice(0, 110),
    description,
    url: SITE_URL + path,
    mainEntityOfPage: { '@type': 'WebPage', '@id': SITE_URL + path },
    datePublished: s.createdAt,
    dateModified: s.updatedAt,
    articleSection: s.category,
    ...(mins(s) ? { timeRequired: `PT${mins(s)}M` } : {}),
    ...(img ? { image: [abs(img)] } : {}),
    author: s.author ? { '@type': 'Person', name: s.author } : ORG,
    publisher: ORG,
    ...(s.youtubeId ? { video: {
      '@type': 'VideoObject', name: s.title, description,
      thumbnailUrl: [`https://i.ytimg.com/vi/${s.youtubeId}/hqdefault.jpg`],
      uploadDate: s.createdAt, embedUrl: `https://www.youtube.com/embed/${s.youtubeId}`, contentUrl: s.link,
    } } : {}),
  };
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL + '/' },
    { '@type': 'ListItem', position: 2, name: s.category, item: SITE_URL + sectionPath(s.category) },
    { '@type': 'ListItem', position: 3, name: s.title, item: SITE_URL + path } ] };

  const extraMeta = `<meta property="article:published_time" content="${s.createdAt}">
  <meta property="article:modified_time" content="${s.updatedAt}">
  <meta property="article:section" content="${esc(s.category)}">
  ${s.author ? `<meta name="author" content="${esc(s.author)}">` : ''}`;

  const body = `
    <article class="wrap article">
      <header class="article-head">
        <a class="kicker" href="${sectionPath(s.category)}">${esc(s.category)}</a>
        <h1>${esc(s.title)}</h1>
        ${s.excerpt ? `<p class="lede">${esc(s.excerpt)}</p>` : ''}
        <div class="byline">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</div>
      </header>

      ${showCover ? `<figure class="article-cover"><img src="${esc(s.cover)}" alt="${esc(s.coverAlt || s.title)}" fetchpriority="high" decoding="async"></figure>` : ''}

      ${s.youtubeId ? `
      <section class="listen" aria-label="Podcast episode">
        <div class="listen-head">
          <span class="dot">${icons.play}</span>
          <div><strong>Listen to this story</strong><small>Podcast episode on YouTube</small></div>
        </div>
        <div class="video">
          <iframe src="https://www.youtube-nocookie.com/embed/${esc(s.youtubeId)}?rel=0" title="${esc(s.title)}" loading="lazy"
            referrerpolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>
      </section>` : ''}

      ${s.body ? `<div class="prose">${renderMarkdown(s.body)}</div>` : ''}

      ${s.resources && s.resources.length ? `
      <section class="resources" aria-labelledby="res-title">
        <h2 id="res-title">Resources</h2>
        <ol>
          ${s.resources.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">
            <span class="res-title">${esc(r.title)}</span>
            <span class="res-host">${r.title === hostOf(r.url) ? '' : esc(hostOf(r.url))} ${icons.out}</span>
          </a></li>`).join('')}
        </ol>
      </section>` : ''}

      <div class="article-end">
        <a class="back" href="/">${icons.back} All stories</a>
        ${s.link ? `<a class="btn ${s.youtubeId ? 'btn--yellow' : ''}" href="${esc(s.link)}" target="_blank" rel="noopener">
          ${s.youtubeId ? `${icons.play} Watch on YouTube` : `Continue on ${esc(hostOf(s.link))} ${icons.out}`}
        </a>` : ''}
      </div>
    </article>

    ${more.length ? `
    <section class="shelf" aria-labelledby="more-title">
      <div class="wrap">
        <div class="shelf-head"><h2 id="more-title">Keep reading</h2><a href="/section/all">View all</a></div>
        <div class="grid" style="padding-bottom:40px">${more.map((x) => card(x)).join('')}</div>
      </div>
    </section>` : ''}`;

  return layout({ title: `${s.title} | ${SITE_NAME}`, description, path, image: img, imageAlt: s.coverAlt || s.title,
    type: 'article', extraMeta, jsonLd: [article, crumbs], body, stories, active: s.category });
}

function notFoundPage(stories = []) {
  return layout({ title: `Not found | ${SITE_NAME}`, description: SITE_DESCRIPTION, path: '/404', status: 404, stories,
    body: `<div class="wrap empty">
      <h1 class="empty-title">This page is hidden a little too well.</h1>
      <p>It may have moved or never existed.</p>
      <p style="margin-top:28px"><a class="btn" href="/">Back to stories</a></p>
    </div>` });
}

module.exports = { homePage, sectionPage, storyPage, notFoundPage, storyPath, sectionPath, coverOf, abs, categories };
