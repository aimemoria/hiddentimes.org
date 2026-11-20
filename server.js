// HiddenTimes server.
//   Stories  → PostgreSQL (DATABASE_URL) or, for local development only, data/stories.json
//   Images   → S3-compatible online storage (S3_*) or, for local development only, uploads/
//   Pages    → built here on the server, so search engines and share previews see everything
// Settings: see .env.example

const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const config = require('./lib/config');
const { createStore } = require('./lib/store');
const { createMedia } = require('./lib/media');
const views = require('./lib/views');
const seo = require('./lib/seo');
const analytics = require('./lib/analytics');
const { hashPassword, verifyPassword } = require('./lib/passwords');
const { sameTitle, agentProblems } = require('./lib/publish-rules');
const { fetchImage } = require('./lib/fetch-image');
const {
  clean, slugify, safeUrl, youtubeId, makeExcerpt, readResources, sniffImage, newId, randomSuffix, readMinutes,
} = require('./lib/util');

if (config.ON_VERCEL && !config.usePostgres) {
  // Vercel can't keep files, so the local data/ fallback would lose every story
  throw new Error('DATABASE_URL is not set. Add it in Vercel → Project → Settings → Environment Variables.');
}
const store = createStore();
const media = createMedia();
// prepares the database tables once; every request waits for it (see the first middleware)
const ready = store.init();
ready.catch(() => {}); // the error is reported where `ready` is used

if (!process.env.ADMIN_PASSWORD) {
  console.warn('! ADMIN_PASSWORD is not set, using the default "hiddentimes". Set it before going live.');
}

// ---------- sessions ----------
// A signed-in admin carries a signed cookie: "<expiry>.<password version>.<signature>".
// Nothing is kept in the server's memory, so it works on hosts that start fresh copies of the
// server at any time (Vercel). The signature uses a key derived from SESSION_SECRET (or, if that
// isn't set, ADMIN_PASSWORD), so a cookie can't be made up. The "password version" is a short
// fingerprint of the current password: changing the password makes every older cookie invalid.
const COOKIE = 'ht_admin';
const PASSWORD_KEY = 'admin_password_hash';
const SESSION_KEY = crypto.createHash('sha256')
  .update('hiddentimes-session|' + (process.env.SESSION_SECRET || config.ADMIN_PASSWORD)).digest();
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('base64url');
const sign = (s) => crypto.createHmac('sha256', SESSION_KEY).update(s).digest('base64url');

const passwordVersion = async () => {
  const stored = await store.getSetting(PASSWORD_KEY);
  return sha(stored ? stored.value : 'starting:' + config.ADMIN_PASSWORD).slice(0, 16);
};
const makeSession = async () => {
  const body = `${Date.now() + config.SESSION_HOURS * 3600 * 1000}.${await passwordVersion()}`;
  return `${body}.${sign(body)}`;
};
const sessionCookie = (req, token) =>
  `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${config.SESSION_HOURS * 3600}${req.secure ? '; Secure' : ''}`;

const getCookie = (req, name) => {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
};
const isAuthed = async (req) => {
  const parts = (getCookie(req, COOKIE) || '').split('.');
  if (parts.length !== 3) return false;
  const [expires, version, signature] = parts;
  const expected = sign(`${expires}.${version}`);
  if (signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  if (!(Number(expires) > Date.now())) return false;
  return version === await passwordVersion();
};
const requireAuth = (req, res, next) =>
  isAuthed(req).then((ok) => (ok ? next() : res.status(401).json({ error: 'Not signed in' })), next);
// The admin password: once changed in Account, a scrypt hash in the database is used.
// Until then, the starting password from ADMIN_PASSWORD (.env / hosting settings) works.
const passwordMatches = async (input) => {
  const stored = await store.getSetting(PASSWORD_KEY);
  if (stored) return verifyPassword(input, stored.value);
  const a = crypto.createHash('sha256').update(String(input)).digest();
  const b = crypto.createHash('sha256').update(config.ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
};

// login throttle: 8 failed tries per 15 minutes per IP
const failures = new Map();
const tooManyFailures = (ip) => {
  const f = failures.get(ip);
  if (!f) return false;
  if (Date.now() - f.first > 15 * 60 * 1000) { failures.delete(ip); return false; }
  return f.count >= 8;
};
const noteFailure = (ip) => {
  const f = failures.get(ip) || { count: 0, first: Date.now() };
  f.count++; failures.set(ip, f);
};

// ---------- uploads (kept in memory, checked, then sent to storage) ----------
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.MAX_IMAGE_BYTES, files: 1 } });
const uploadCover = (req, res, next) =>
  upload.single('coverFile')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? `Image is larger than ${config.MAX_IMAGE_BYTES / 1024 / 1024} MB` : 'Upload failed' });
    next();
  });

// Save an uploaded image to storage. Returns null when no file was sent.
async function storeCover(req) {
  if (!req.file || !req.file.size) return null;
  const kind = sniffImage(req.file.buffer);
  if (!kind) { const e = new Error('Please upload a JPG, PNG, WebP or GIF image'); e.status = 400; throw e; }
  return media.put({ buffer: req.file.buffer, ext: kind.ext, contentType: kind.type });
}

// Download an image from a web address and save a copy in our storage (agent publishing page).
async function storeCoverFromUrl(url) {
  const buffer = await fetchImage(url, { maxBytes: config.MAX_FETCHED_IMAGE_BYTES, siteUrl: config.SITE_URL });
  const kind = sniffImage(buffer);
  if (!kind) { const e = new Error('The image address did not return a JPG, PNG, WebP or GIF image.'); e.status = 400; throw e; }
  return media.put({ buffer, ext: kind.ext, contentType: kind.type });
}

// ---------- shared publishing checks (admin dashboard + agent publishing page) ----------
const isAgent = (req) => req.body.mode === 'agent';
const submissionIdOf = (req) => {
  const v = String(req.body.submissionId || '').toLowerCase();
  return analytics.UUID.test(v) ? v : null;
};
const withUrl = (s) => ({ ...s, url: config.SITE_URL + views.storyPath(s) });
const reject = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });
// the categories readers can see: those of published stories (a draft can't invent a new one)
const existingCategories = (all) => views.categories(all.filter((s) => s.published !== false));

// Checks every save must pass. Returns true when the request was answered with an error.
async function failsChecks(req, res, f, { exceptId = null, hasCover }) {
  if (!f.title) return reject(res, 400, 'A title is required'), true;
  if (!f.body && !f.link) return reject(res, 400, 'Add the story text, a link, or both'), true;
  const all = await store.listAll();
  const twin = sameTitle(all, f.title, exceptId);
  if (twin) {
    reject(res, 409, `A story with this title already exists${twin.published === false ? ' (as a draft)' : ''}: "${twin.title}". Choose a different topic or title.`,
      { existing: { id: twin.id, title: twin.title, published: twin.published !== false, url: withUrl(twin).url } });
    return true;
  }
  if (isAgent(req)) {
    const problems = agentProblems(f, { publishing: f.published, hasCover, categories: existingCategories(all) });
    if (problems.length) return reject(res, 400, problems.join(' '), { problems }), true;
  }
  return false;
}

const readFields = (body) => {
  const link = safeUrl(body.link);
  const text = clean(body.body, 200000);
  return {
    title: clean(body.title, 160),
    category: clean(body.category, 40) || 'Stories',
    author: clean(body.author, 80),
    excerpt: clean(body.excerpt, 300) || makeExcerpt(text),
    body: text,
    link,
    youtubeId: youtubeId(link),
    coverAlt: clean(body.coverAlt, 200),
    coverCredit: clean(body.coverCredit, 300),
    readMinutes: readMinutes(text),
    resources: readResources(body.resources),
    featured: body.featured === 'true' || body.featured === 'on' || body.featured === true,
    published: !(body.published === 'false' || body.published === false),
  };
};

const uniqueSlug = async (title, exceptId = null) => {
  const base = slugify(title);
  let slug = base;
  while (await store.slugTaken(slug, exceptId)) slug = `${base}-${randomSuffix()}`;
  return slug;
};

const publicView = ({ published, coverKey, ...s }) => s;

// async route helper: errors go to the error handler instead of crashing
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- app ----------
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind a host's proxy (Vercel, Render…): real visitor IP + https detection
app.use((req, res, next) => ready.then(() => next(), next));

// One true address. Anyone arriving on another of our domains (hiddentimes.com typed by mistake,
// the bare hiddentimes.org without www, http://) is sent to SITE_URL with a permanent redirect,
// so visitors land in the right place and search engines count everything under one address.
const SITE = new URL(config.SITE_URL);
const isLocalHost = (h) => h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.local');
const isPreviewHost = (h) => h.endsWith('.vercel.app') || h.endsWith('.onrender.com') || h.endsWith('.pages.dev');
app.use((req, res, next) => {
  const host = (req.hostname || '').toLowerCase();
  if (!host || isLocalHost(host) || isPreviewHost(host) || isLocalHost(SITE.hostname)) return next();
  const wrongHost = host !== SITE.hostname;
  const wrongScheme = SITE.protocol === 'https:' && req.protocol !== 'https';
  if (!wrongHost && !wrongScheme) return next();
  res.redirect(301, SITE.origin + req.originalUrl);
});

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  if (req.path.startsWith('/admin') || req.path.startsWith('/api/')) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

const html = (res, body, status = 200) =>
  res.status(status).set('Cache-Control', 'public, max-age=0, must-revalidate').type('html').send(body);

// ---------- public pages (built on the server) ----------
app.get('/', ah(async (req, res) => html(res, views.homePage(await store.listPublished()))));

app.get('/section/:name', ah(async (req, res) => {
  const stories = await store.listPublished();
  const page = views.sectionPage(req.params.name, stories);
  return page ? html(res, page) : html(res, views.notFoundPage(stories), 404);
}));

app.get('/story/:slug', ah(async (req, res) => {
  const [story, stories] = await Promise.all([store.findBySlug(req.params.slug), store.listPublished()]);
  return story ? html(res, views.storyPage(story, stories)) : html(res, views.notFoundPage(stories), 404);
}));

// ---------- for search engines and feed readers ----------
app.get('/robots.txt', (req, res) => res.type('text/plain').send(seo.robotsTxt()));
app.get('/sitemap.xml', ah(async (req, res) =>
  res.type('application/xml').set('Cache-Control', 'public, max-age=600').send(seo.sitemapXml(await store.listPublished()))));
app.get('/feed.xml', ah(async (req, res) =>
  res.type('application/rss+xml').set('Cache-Control', 'public, max-age=600').send(seo.feedXml(await store.listPublished()))));

// ---------- public JSON API ----------
app.get('/api/stories', ah(async (req, res) => res.json((await store.listPublished()).map(publicView))));
app.get('/api/stories/:slug', ah(async (req, res) => {
  const s = await store.findBySlug(req.params.slug);
  return s ? res.json(publicView(s)) : res.status(404).json({ error: 'Story not found' });
}));

// ---------- sign in ----------
app.post('/api/login', ah(async (req, res) => {
  const ip = req.ip;
  if (tooManyFailures(ip)) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  if (!(await passwordMatches(req.body?.password || ''))) {
    noteFailure(ip);
    return res.status(401).json({ error: 'Wrong password' });
  }
  failures.delete(ip);
  res.setHeader('Set-Cookie', sessionCookie(req, await makeSession()));
  res.json({ ok: true });
}));

// ---------- account ----------
app.get('/api/admin/account', requireAuth, ah(async (req, res) => {
  const stored = await store.getSetting(PASSWORD_KEY);
  res.json({ passwordChangedAt: stored ? stored.updatedAt : null });
}));

app.post('/api/admin/password', requireAuth, ah(async (req, res) => {
  const ip = req.ip;
  if (tooManyFailures(ip)) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  const current = String(req.body?.current || '');
  const next = String(req.body?.next || '');
  if (!(await passwordMatches(current))) { noteFailure(ip); return res.status(400).json({ error: 'Your current password is not correct.' }); }
  if (next.length < 12) return res.status(400).json({ error: 'The new password needs at least 12 characters.' });
  if (next.length > 200) return res.status(400).json({ error: 'The new password is too long (200 characters at most).' });
  if (next === current) return res.status(400).json({ error: 'The new password must be different from the current one.' });
  await store.setSetting(PASSWORD_KEY, await hashPassword(next));
  // the new password makes every older cookie invalid (other devices are signed out);
  // this device gets a fresh cookie so it stays signed in
  res.setHeader('Set-Cookie', sessionCookie(req, await makeSession()));
  res.json({ ok: true });
}));
app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
  res.json({ ok: true });
});
app.get('/api/me', ah(async (req, res) => res.json({ authed: await isAuthed(req) })));

// ---------- analytics: visits reported by /assets/js/track.js ----------
const collectHits = new Map(); // ip -> { n, since }: at most 120 reports a minute per address
const tooChatty = (ip) => {
  const now = Date.now(), h = collectHits.get(ip);
  if (!h || now - h.since > 60000) { collectHits.set(ip, { n: 1, since: now }); return false; }
  return ++h.n > 120;
};
let slugCache = { at: 0, map: new Map() };
const storyIdForSlug = async (slug) => {
  if (Date.now() - slugCache.at > 60000) {
    slugCache = { at: Date.now(), map: new Map((await store.listPublished()).map((s) => [s.slug, s.id])) };
  }
  return slugCache.map.get(slug) || null;
};

app.post('/api/collect', ah(async (req, res) => {
  // The reply goes out only after saving: on Vercel the server is paused as soon as it answers,
  // so work left for afterwards could be lost. The browser sends these in the background anyway.
  const b = req.body || {};
  const ua = req.get('user-agent') || '';
  try {
    if (analytics.isBot(ua) || tooChatty(req.ip) || !analytics.UUID.test(String(b.id || ''))) return;
    if (await isAuthed(req)) return; // the signed-in admin isn't counted
    const visitor = analytics.visitorCode(req);
    if (b.t === 'start') {
      const path = String(b.path || '/').slice(0, 300);
      const slug = (path.match(/^\/story\/([^/?#]+)/) || [])[1];
      await store.recordView({
        id: b.id, visitor, path,
        storyId: slug ? await storyIdForSlug(decodeURIComponent(slug)) : null,
        ...analytics.locationOf(req),
        referrer: analytics.referrerOf(String(b.ref || '')),
        device: analytics.deviceOf(ua),
      });
    } else if (b.t === 'ping') {
      const seconds = Math.max(0, Math.min(4 * 3600, Math.floor(Number(b.s) || 0)));
      const scroll = Math.max(0, Math.min(100, Math.floor(Number(b.d) || 0)));
      await store.updateView(b.id, visitor, seconds, scroll);
    }
  } catch (e) {
    console.warn('analytics:', e.message);
  } finally {
    res.status(204).end();
  }
}));

app.get('/api/admin/analytics', requireAuth, ah(async (req, res) => {
  const days = [7, 30, 90, 365].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  let tz = String(req.query.tz || 'UTC');
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { tz = 'UTC'; }
  const since = new Date(Date.now() - (days + 1) * 864e5);
  const [views, stories] = await Promise.all([store.viewsSince(since), store.listAll()]);
  res.json(analytics.summarize(views, stories, { days, tz }));
}));

// ---------- admin API ----------
app.get('/api/admin/stories', requireAuth, ah(async (req, res) => res.json(await store.listAll())));

app.get('/api/admin/stories/:id', requireAuth, ah(async (req, res) => {
  const s = await store.findById(req.params.id);
  return s ? res.json(withUrl(s)) : res.status(404).json({ error: 'Story not found' });
}));

app.post('/api/admin/stories', requireAuth, uploadCover, ah(async (req, res) => {
  // The same submission sent again (double click, retry after a lost connection): answer with the
  // story it already created instead of making a second copy.
  const submissionId = submissionIdOf(req);
  if (submissionId) {
    const earlier = await store.findBySubmission(submissionId);
    if (earlier) return res.json({ ...withUrl(earlier), repeated: true });
  }

  const f = readFields(req.body);
  const pastedUrl = safeUrl(req.body.coverUrl);
  if (await failsChecks(req, res, f, { hasCover: Boolean(req.file || pastedUrl) })) return;

  // the agent page keeps a copy of web images in our own storage; the dashboard links them as before
  const uploaded = await storeCover(req) || (isAgent(req) && pastedUrl ? await storeCoverFromUrl(pastedUrl) : null);
  try {
    const now = new Date().toISOString();
    const story = await store.insert({
      id: newId(),
      slug: await uniqueSlug(f.title),
      ...f,
      cover: uploaded ? uploaded.url : pastedUrl,
      coverKey: uploaded ? uploaded.key : null,
      submissionId,
      createdAt: now,
      updatedAt: now,
    });
    if (uploaded) await store.recordMedia({ ...uploaded, storyId: story.id });
    res.status(201).json(withUrl(story));
  } catch (e) {
    if (uploaded) await media.remove(uploaded.key); // don't leave orphan files behind
    // two copies of one submission arrived at the same moment: the other one won, answer with its story
    if (e.code === '23505' && submissionId) {
      const earlier = await store.findBySubmission(submissionId);
      if (earlier) return res.json({ ...withUrl(earlier), repeated: true });
    }
    throw e;
  }
}));

app.put('/api/admin/stories/:id', requireAuth, uploadCover, ah(async (req, res) => {
  const old = await store.findById(req.params.id);
  if (!old) return res.status(404).json({ error: 'Story not found' });
  const f = readFields(req.body);
  const pastedUrl = safeUrl(req.body.coverUrl);
  const removing = req.body.removeCover === 'true';
  const hasCover = Boolean(req.file || (pastedUrl && !removing) || (old.cover && !removing));
  if (await failsChecks(req, res, f, { exceptId: old.id, hasCover })) return;

  const newUrl = pastedUrl && pastedUrl !== old.cover ? pastedUrl : '';
  const uploaded = await storeCover(req) || (isAgent(req) && newUrl && !removing ? await storeCoverFromUrl(newUrl) : null);
  let cover = old.cover, coverKey = old.coverKey;
  if (uploaded) { cover = uploaded.url; coverKey = uploaded.key; }
  else if (removing) { cover = ''; coverKey = null; }
  else if (newUrl) { cover = newUrl; coverKey = null; }

  try {
    const saved = await store.update({ ...old, ...f, cover, coverKey, updatedAt: new Date().toISOString() });
    if (uploaded) await store.recordMedia({ ...uploaded, storyId: saved.id });
    // the old uploaded image is no longer used: remove it from storage
    if (old.coverKey && old.coverKey !== coverKey) { await media.remove(old.coverKey); await store.forgetMedia(old.coverKey); }
    res.json(withUrl(saved));
  } catch (e) {
    if (uploaded) await media.remove(uploaded.key);
    throw e;
  }
}));

// For the agent publishing page: categories to choose from, and every story so far
// (newest first, without the long text) so topics aren't repeated and drafts can be continued.
app.get('/api/admin/agent/overview', requireAuth, ah(async (req, res) => {
  const all = await store.listAll();
  res.json({
    categories: existingCategories(all),
    stories: all.map((s) => ({
      id: s.id, title: s.title, category: s.category, published: s.published !== false,
      createdAt: s.createdAt, updatedAt: s.updatedAt, readMinutes: s.readMinutes, url: withUrl(s).url,
    })),
  });
}));

app.delete('/api/admin/stories/:id', requireAuth, ah(async (req, res) => {
  const s = await store.findById(req.params.id);
  if (!s) return res.status(404).json({ error: 'Story not found' });
  await store.remove(s.id);
  if (s.coverKey) { await media.remove(s.coverKey); await store.forgetMedia(s.coverKey); }
  res.json({ ok: true });
}));

// ---------- files ----------
if (media.kind === 'local folder') app.use('/uploads', express.static(config.LOCAL_UPLOADS_DIR, { maxAge: '30d' }));
app.use('/logo-kit', express.static(path.join(config.ROOT, 'packages', 'hiddentimes-logo'), { maxAge: '1d' }));
app.use('/image-kit', express.static(path.join(config.ROOT, 'packages', 'image-shrink'), { maxAge: '1d' }));
// Markdown reader + HTML cleaner for the admin preview
const vendor = {
  'marked.min.js': path.join(config.ROOT, 'node_modules', 'marked', 'marked.min.js'),
  'purify.min.js': path.join(config.ROOT, 'node_modules', 'dompurify', 'dist', 'purify.min.js'),
};
app.get('/vendor/:file', (req, res, next) =>
  (vendor[req.params.file] ? res.sendFile(vendor[req.params.file], { maxAge: '7d' }) : next()));
app.get('/admin', (req, res) => res.sendFile(path.join(config.PUBLIC_DIR, 'admin.html')));
app.get('/admin/agent-publish', (req, res) => res.sendFile(path.join(config.PUBLIC_DIR, 'agent-publish.html')));
// always re-check with the server (ETag), so updates to scripts and styles show up straight away
app.use(express.static(config.PUBLIC_DIR, { index: false, maxAge: 0, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));

// ---------- not found / errors ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use(ah(async (req, res) => html(res, views.notFoundPage(await store.listPublished().catch(() => [])), 404)));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (!err.status || err.status >= 500) console.error(err);
  const status = err.status || 500;
  const message = status < 500 ? err.message : 'Something went wrong on the server. Please try again.';
  if (req.path.startsWith('/api/')) return res.status(status).json({ error: message });
  res.status(status).type('text/plain').send(message);
});

// ---------- start ----------
// On this computer (`npm start`) the server listens on PORT.
// On Vercel the file is loaded and `app` is handed each request instead (module.exports below).
module.exports = app;

if (require.main === module) {
  ready.then(() => {
    app.listen(config.PORT, () => {
      console.log(`HiddenTimes running → ${config.SITE_URL}`);
      console.log(`Admin page          → ${config.SITE_URL}/admin`);
      console.log(`Stories stored in   → ${store.kind}${store.kind === 'local file' ? ' (set DATABASE_URL for the live site)' : ''}`);
      console.log(`Images stored in    → ${media.kind}${media.kind === 'local folder' ? ' (set S3_* for the live site)' : ''}`);
    });
  }, (e) => {
    console.error('Could not connect to the database:', e.message);
    process.exit(1);
  });
}
