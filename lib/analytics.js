// Privacy-friendly analytics.
//   • no cookies and nothing stored on the visitor's device
//   • no IP addresses stored: each visitor gets an anonymous code that changes every day
//   • location comes from the hosting service (country / region / city), never finer than a city
//   • people with "Do not track" / Global Privacy Control switched on are not counted (see track.js)
const crypto = require('crypto');
const config = require('./config');

// secret used to make the daily anonymous codes (set ANALYTICS_SECRET; otherwise derived from the admin password)
const SECRET = process.env.ANALYTICS_SECRET ||
  crypto.createHash('sha256').update('ht-analytics:' + config.ADMIN_PASSWORD).digest('hex');

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python|headless|lighthouse|pingdom|uptime/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isBot = (ua) => !ua || BOT.test(ua);

// same person + same day = same code; tomorrow it's a different code
function visitorCode(req) {
  const day = new Date().toISOString().slice(0, 10);
  return crypto.createHmac('sha256', SECRET).update(`${day}|${req.ip}|${req.get('user-agent') || ''}`).digest('hex').slice(0, 20);
}

const deviceOf = (ua = '') =>
  /ipad|tablet|(android(?!.*mobile))/i.test(ua) ? 'tablet' : /mobi|iphone|android/i.test(ua) ? 'mobile' : 'desktop';

// Location headers added by the hosting service (Vercel, Cloudflare, Netlify, Fly…)
function locationOf(req) {
  const h = (name) => { const v = req.get(name); try { return v ? decodeURIComponent(v) : ''; } catch { return v || ''; } };
  const country = (h('x-vercel-ip-country') || h('cf-ipcountry') || h('x-country-code') || h('fly-client-country') || '').toUpperCase();
  const region = h('x-vercel-ip-country-region') || h('cf-region') || '';
  const city = h('x-vercel-ip-city') || h('cf-ipcity') || '';
  if (!country && /^(::1|127\.|::ffff:127\.|10\.|192\.168\.)/.test(req.ip || '')) return { country: 'LOCAL', region: '', city: 'This computer' };
  return { country: /^[A-Z]{2}$/.test(country) && country !== 'XX' ? country : '', region: region.slice(0, 60), city: city.slice(0, 80) };
}

function referrerOf(ref) {
  try {
    const host = new URL(ref).hostname.replace(/^www\.|^m\.|^l\.|^lm\./, '');
    if (host === new URL(config.SITE_URL).hostname.replace(/^www\./, '')) return '';
    return host.slice(0, 100);
  } catch { return ''; }
}

// ---------- turning visits into the dashboard ----------

const dayKey = (iso, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

const median = (arr) => {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y), m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
};
const avg = (arr) => (arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length) : 0);

const BUCKETS = [
  ['Under 10 s', 0, 10], ['10–30 s', 10, 30], ['30 s–1 min', 30, 60], ['1–3 min', 60, 180],
  ['3–10 min', 180, 600], ['10–30 min', 600, 1800], ['30 min +', 1800, Infinity],
];

/**
 * @param {Array} views   rows from store.viewsSince()
 * @param {Array} stories store.listAll() (for titles and estimated read times)
 * @param {{days:number, tz:string}} range
 */
function summarize(views, stories, { days, tz }) {
  const byId = new Map(stories.map((s) => [s.id, s]));

  // a "visit" = one anonymous visitor on one day (their code changes daily)
  const visits = new Map();
  for (const v of views) {
    const day = dayKey(v.startedAt, tz);
    const key = `${day}|${v.visitor}`;
    if (!visits.has(key)) visits.set(key, { day, country: v.country, region: v.region, city: v.city, device: v.device, seconds: 0, pages: 0, stories: new Set(), first: v.startedAt });
    const x = visits.get(key);
    x.seconds += v.seconds; x.pages += 1;
    if (v.storyId && byId.has(v.storyId)) x.stories.add(v.storyId);
  }
  const visitList = [...visits.values()];

  // daily series, including days with no visits
  const daily = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = dayKey(new Date(today.getTime() - i * 864e5).toISOString(), tz);
    daily.push({ day: d, visitors: 0, views: 0, seconds: 0 });
  }
  const dailyIdx = new Map(daily.map((d) => [d.day, d]));
  for (const x of visitList) { const d = dailyIdx.get(x.day); if (d) { d.visitors++; d.seconds += x.seconds; } }
  for (const v of views) { const d = dailyIdx.get(dayKey(v.startedAt, tz)); if (d) d.views++; }
  daily.forEach((d) => { d.avgSeconds = d.visitors ? Math.round(d.seconds / d.visitors) : 0; delete d.seconds; });

  // stories: views, readers, time spent vs the estimated read time
  const storyStats = new Map();
  for (const v of views) {
    if (!v.storyId || !byId.has(v.storyId)) continue;
    if (!storyStats.has(v.storyId)) storyStats.set(v.storyId, { views: 0, readers: new Set(), secs: [], finished: 0 });
    const s = storyStats.get(v.storyId);
    const est = (byId.get(v.storyId).readMinutes || 0) * 60;
    s.views++; s.readers.add(v.visitor + dayKey(v.startedAt, tz)); s.secs.push(v.seconds);
    if (v.scroll >= 90 || (est && v.seconds >= est * 0.8)) s.finished++;
  }
  const topStories = [...storyStats.entries()].map(([id, s]) => {
    const st = byId.get(id);
    const avgSec = avg(s.secs);
    return {
      id, title: st.title, slug: st.slug, category: st.category, readMinutes: st.readMinutes || 0,
      views: s.views, readers: s.readers.size, avgSeconds: avgSec, medianSeconds: median(s.secs),
      finishedPct: Math.round((s.finished / s.views) * 100),
      // average time as a share of the estimated read time
      readPct: st.readMinutes ? Math.min(999, Math.round((avgSec / (st.readMinutes * 60)) * 100)) : null,
    };
  }).sort((a, b) => b.views - a.views || b.avgSeconds - a.avgSeconds);

  // locations
  const groupBy = (keyFn) => {
    const m = new Map();
    for (const x of visitList) {
      const k = keyFn(x); if (!k) continue;
      if (!m.has(k.key)) m.set(k.key, { ...k, visitors: 0, secs: [] });
      const g = m.get(k.key); g.visitors++; g.secs.push(x.seconds);
    }
    return [...m.values()].map(({ secs, ...g }) => ({ ...g, avgSeconds: avg(secs) })).sort((a, b) => b.visitors - a.visitors);
  };
  const countries = groupBy((x) => ({ key: x.country || '??', country: x.country || '' }));
  const cities = groupBy((x) => (x.city ? { key: `${x.country}|${x.city}`, country: x.country, region: x.region, city: x.city } : null)).slice(0, 15);

  // engagement: who stays longest, who leaves fastest (anonymous)
  const describe = (x) => ({
    day: x.day, country: x.country, region: x.region, city: x.city, device: x.device, seconds: x.seconds, pages: x.pages,
    stories: [...x.stories].map((id) => byId.get(id).title),
  });
  const sorted = [...visitList].sort((a, b) => b.seconds - a.seconds);
  const longest = sorted.slice(0, 10).map(describe);
  const shortest = sorted.filter((x) => x.seconds > 0).slice(-10).reverse().map(describe);
  const distribution = BUCKETS.map(([label, lo, hi]) => ({ label, visitors: visitList.filter((x) => x.seconds >= lo && x.seconds < hi).length }));

  const count = (field) => {
    const m = new Map();
    for (const x of field === 'referrer' ? views : visitList) {
      const k = (field === 'referrer' ? x.referrer : x[field]) || (field === 'referrer' ? '(direct or unknown)' : 'unknown');
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].map(([name, n]) => ({ name, count: n })).sort((a, b) => b.count - a.count);
  };

  const storyViews = views.filter((v) => v.storyId);
  return {
    range: { days, tz },
    totals: {
      visitors: visitList.length,
      views: views.length,
      avgDailyVisitors: Math.round((visitList.length / days) * 10) / 10,
      avgSecondsPerVisitor: avg(visitList.map((x) => x.seconds)),
      avgSecondsPerStory: avg(storyViews.map((v) => v.seconds)),
      bouncePct: visitList.length ? Math.round((visitList.filter((x) => x.seconds < 10).length / visitList.length) * 100) : 0,
    },
    daily, topStories, countries, cities, longest, shortest, distribution,
    referrers: count('referrer').slice(0, 10),
    devices: count('device'),
  };
}

module.exports = { isBot, visitorCode, deviceOf, locationOf, referrerOf, summarize, UUID };
