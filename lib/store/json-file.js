// Local development storage: one JSON file on this computer.
// Used automatically when DATABASE_URL is not set. Not for the live site.
const fs = require('fs');
const path = require('path');
const { readMinutes } = require('../util');

function createJsonStore(file) {
  const read = () => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')).map((s) => ({
        resources: [],
        coverAlt: '',
        coverCredit: '',
        submissionId: null,
        // older entries kept only the URL of uploaded images
        coverKey: s.coverKey !== undefined ? s.coverKey
          : (s.cover && s.cover.startsWith('/uploads/') ? s.cover.slice('/uploads/'.length) : null),
        ...s,
        readMinutes: s.readMinutes || readMinutes(s.body),
      }));
    } catch { return []; }
  };
  const write = (list) => {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
    fs.renameSync(tmp, file);
  };
  const viewsFile = path.join(path.dirname(file), 'analytics.json');
  const readViews = () => { try { return JSON.parse(fs.readFileSync(viewsFile, 'utf8')); } catch { return []; } };
  const writeViews = (list) => { fs.writeFileSync(viewsFile + '.tmp', JSON.stringify(list)); fs.renameSync(viewsFile + '.tmp', viewsFile); };
  const settingsFile = path.join(path.dirname(file), 'settings.json');
  const readSettings = () => { try { return JSON.parse(fs.readFileSync(settingsFile, 'utf8')); } catch { return {}; } };
  const writeSettings = (all) => { fs.writeFileSync(settingsFile + '.tmp', JSON.stringify(all, null, 2)); fs.renameSync(settingsFile + '.tmp', settingsFile); };
  const newestFirst = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
  const copy = (s) => JSON.parse(JSON.stringify(s));

  return {
    kind: 'local file',

    async init() {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (!fs.existsSync(file)) write([]);
    },
    async listPublished() {
      return read().filter((s) => s.published !== false).sort(newestFirst)
        .map(({ body, ...s }) => ({ ...s, hasBody: Boolean(body) }));
    },
    async listAll() { return read().sort(newestFirst); },
    async findBySlug(slug, { publishedOnly = true } = {}) {
      const s = read().find((x) => x.slug === slug && (!publishedOnly || x.published !== false));
      return s ? copy(s) : null;
    },
    async findById(id) {
      const s = read().find((x) => x.id === id);
      return s ? copy(s) : null;
    },
    async slugTaken(slug, exceptId = null) {
      return read().some((x) => x.slug === slug && x.id !== exceptId);
    },
    async findBySubmission(submissionId) {
      const s = read().find((x) => x.submissionId && x.submissionId === submissionId);
      return s ? copy(s) : null;
    },
    async insert(s) {
      const list = read();
      if (s.submissionId && list.some((x) => x.submissionId === s.submissionId)) {
        const e = new Error('duplicate submission'); e.code = '23505'; throw e; // same code as PostgreSQL
      }
      list.push(copy(s)); write(list); return copy(s);
    },
    async update(s) {
      const list = read();
      const i = list.findIndex((x) => x.id === s.id);
      if (i === -1) return null;
      list[i] = { ...copy(s), submissionId: list[i].submissionId || null }; // never changes on update
      write(list);
      return copy(s);
    },
    async remove(id) { write(read().filter((x) => x.id !== id)); },
    async recordMedia() {},
    async forgetMedia() {},
    // ---------- settings (local file) ----------
    async getSetting(key) { const s = readSettings()[key]; return s ? { ...s } : null; },
    async setSetting(key, value) { const all = readSettings(); all[key] = { value, updatedAt: new Date().toISOString() }; writeSettings(all); },
    async deleteSetting(key) { const all = readSettings(); delete all[key]; writeSettings(all); },

    // ---------- analytics (local file, kept to the latest 50,000 visits) ----------
    async recordView(v) {
      const list = readViews();
      if (list.some((x) => x.id === v.id)) return;
      list.push({ ...v, startedAt: new Date().toISOString(), seconds: 0, scroll: 0 });
      writeViews(list.slice(-50000));
    },
    async updateView(id, visitor, seconds, scroll) {
      const list = readViews();
      const x = list.find((r) => r.id === id && r.visitor === visitor && Date.now() - new Date(r.startedAt) < 6 * 3600e3);
      if (!x) return;
      x.seconds = Math.max(x.seconds, seconds); x.scroll = Math.max(x.scroll, scroll);
      writeViews(list);
    },
    async viewsSince(since) { return readViews().filter((r) => r.startedAt >= new Date(since).toISOString()); },

    async close() {},
  };
}

module.exports = { createJsonStore };
