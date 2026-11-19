// Files search engines and feed readers look for: robots.txt, sitemap.xml, feed.xml (RSS).
const config = require('./config');
const { esc } = require('./util');
const { storyPath, sectionPath, coverOf, abs, categories } = require('./views');

const { SITE_URL, SITE_NAME, SITE_DESCRIPTION } = config;

function robotsTxt() {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
}

// Every public page, with the date it last changed and its main picture.
function sitemapXml(stories) {
  const latest = (list) => list.reduce((m, s) => (s.updatedAt > m ? s.updatedAt : m), '1970-01-01T00:00:00.000Z');
  const newest = latest(stories);
  const urls = [
    { loc: SITE_URL + '/', lastmod: newest, priority: '1.0', changefreq: 'daily' },
    { loc: SITE_URL + '/section/all', lastmod: newest, priority: '0.6', changefreq: 'daily' },
    ...categories(stories).map((c) => ({
      loc: SITE_URL + sectionPath(c),
      lastmod: latest(stories.filter((s) => s.category === c)),
      priority: '0.6', changefreq: 'weekly',
    })),
    ...stories.map((s) => ({
      loc: SITE_URL + storyPath(s), lastmod: s.updatedAt, priority: '0.8', changefreq: 'monthly',
      image: coverOf(s) ? { loc: abs(coverOf(s)), title: s.coverAlt || s.title } : null,
    })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map((u) => `  <url>
    <loc>${esc(u.loc)}</loc>
    <lastmod>${esc(u.lastmod)}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${u.image ? `
    <image:image><image:loc>${esc(u.image.loc)}</image:loc><image:title>${esc(u.image.title)}</image:title></image:image>` : ''}
  </url>`).join('\n')}
</urlset>
`;
}

// RSS feed: the latest 30 stories, for feed readers and news apps.
function feedXml(stories) {
  const items = stories.slice(0, 30);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>${esc(SITE_NAME)}</title>
  <link>${SITE_URL}/</link>
  <description>${esc(SITE_DESCRIPTION)}</description>
  <language>en</language>
  <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
  ${items[0] ? `<lastBuildDate>${new Date(items[0].updatedAt).toUTCString()}</lastBuildDate>` : ''}
${items.map((s) => `  <item>
    <title>${esc(s.title)}</title>
    <link>${SITE_URL}${storyPath(s)}</link>
    <guid isPermaLink="false">${esc(s.id)}</guid>
    <pubDate>${new Date(s.createdAt).toUTCString()}</pubDate>
    <category>${esc(s.category)}</category>
    <description>${esc(s.excerpt)}</description>${coverOf(s) ? `
    <media:content url="${esc(abs(coverOf(s)))}" medium="image"/>` : ''}
  </item>`).join('\n')}
</channel>
</rss>
`;
}

module.exports = { robotsTxt, sitemapXml, feedXml };
