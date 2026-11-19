// Small helpers shared by the server, the stores and the page templates.
const crypto = require('crypto');

const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

const slugify = (s) =>
  String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'story';

const safeUrl = (v) => {
  const s = clean(v, 1000);
  if (!s) return '';
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch { return ''; }
};

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

const youtubeId = (url) => {
  if (!url) return '';
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
    let id = '';
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id = u.searchParams.get('v') || '';
      const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]+)/);
      if (!id && m) id = m[2];
    }
    return /^[\w-]{6,20}$/.test(id) ? id : '';
  } catch { return ''; }
};

// Markdown → plain text (for summaries, word counts, search descriptions)
const plainText = (md) => String(md || '')
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
  .replace(/[*_~`]+/g, '')
  .replace(/\s+/g, ' ').trim();

const makeExcerpt = (body, max = 180) => {
  const text = plainText(body);
  return text.length > max ? text.slice(0, max - 3).replace(/\s+\S*$/, '') + '…' : text;
};

// Estimated reading time: about 220 words a minute (an average adult reading online).
const READING_WPM = 220;
const readMinutes = (body) => {
  const words = plainText(body).split(/\s+/).filter(Boolean).length;
  return words ? Math.max(1, Math.round(words / READING_WPM)) : 0;
};
const readTime = (bodyOrMinutes) => {
  const m = typeof bodyOrMinutes === 'number' ? bodyOrMinutes : readMinutes(bodyOrMinutes);
  return m ? `${m} min read` : '';
};

// Resources arrive from the admin form as JSON: [{ title, url }]. Keep only valid http(s) links.
const readResources = (raw) => {
  let list = raw;
  if (typeof raw === 'string') { try { list = JSON.parse(raw || '[]'); } catch { return []; } }
  if (!Array.isArray(list)) return [];
  return list.slice(0, 30).map((r) => {
    const url = safeUrl(r && r.url);
    if (!url) return null;
    return { title: clean(r.title, 140) || hostOf(url), url };
  }).filter(Boolean);
};

// Identify an image from its first bytes, not from what the browser claims.
const sniffImage = (buf) => {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: 'image/jpeg', ext: '.jpg' };
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { type: 'image/png', ext: '.png' };
  if (buf.slice(0, 4).toString('ascii') === 'GIF8') return { type: 'image/gif', ext: '.gif' };
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return { type: 'image/webp', ext: '.webp' };
  return null;
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const newId = () => crypto.randomUUID();
const randomSuffix = () => crypto.randomBytes(2).toString('hex');

module.exports = {
  clean, slugify, safeUrl, hostOf, youtubeId, plainText, makeExcerpt, readTime, readMinutes,
  readResources, sniffImage, esc, formatDate, newId, randomSuffix,
};
