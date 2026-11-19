// Story storage in PostgreSQL (Supabase, Neon, Railway, Render, AWS RDS, your own server…).
const fs = require('fs');
const path = require('path');

const { readMinutes } = require('../util');

const SCHEMA = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'schema.sql'), 'utf8');

const COLUMNS = `id, slug, title, category, author, excerpt, link, youtube_id, cover_url, cover_key,
  cover_alt, featured, published, created_at, updated_at, read_minutes`;

const toStory = (r, resources) => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  category: r.category,
  author: r.author,
  excerpt: r.excerpt,
  ...(r.body !== undefined ? { body: r.body } : {}),
  ...(r.has_body !== undefined ? { hasBody: r.has_body } : {}),
  link: r.link,
  youtubeId: r.youtube_id,
  cover: r.cover_url,
  coverKey: r.cover_key || null,
  coverAlt: r.cover_alt,
  readMinutes: r.read_minutes || 0,
  featured: r.featured,
  published: r.published,
  createdAt: new Date(r.created_at).toISOString(),
  updatedAt: new Date(r.updated_at).toISOString(),
  ...(resources ? { resources } : {}),
});

/**
 * @param {object} pool  a `pg` Pool (or anything with the same query/connect API)
 */
function createPostgresStore(pool) {
  // run fn inside one transaction on one connection
  const tx = async (fn) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  };

  const resourcesFor = async (db, ids) => {
    if (!ids.length) return new Map();
    const { rows } = await db.query(
      'SELECT story_id, title, url FROM story_resources WHERE story_id = ANY($1::uuid[]) ORDER BY story_id, position', [ids]);
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.story_id)) map.set(r.story_id, []);
      map.get(r.story_id).push({ title: r.title, url: r.url });
    }
    return map;
  };

  const writeResources = async (db, storyId, list) => {
    await db.query('DELETE FROM story_resources WHERE story_id = $1', [storyId]);
    for (let i = 0; i < list.length; i++) {
      await db.query('INSERT INTO story_resources (story_id, position, title, url) VALUES ($1, $2, $3, $4)',
        [storyId, i, list[i].title, list[i].url]);
    }
  };

  const values = (s) => [s.id, s.slug, s.title, s.category, s.author || '', s.excerpt || '', s.body || '',
    s.link || '', s.youtubeId || '', s.cover || '', s.coverKey || null, s.coverAlt || '',
    Boolean(s.featured), s.published !== false, s.createdAt, s.updatedAt, s.readMinutes || 0];

  return {
    kind: 'postgres',

    async init() {
      await pool.query(SCHEMA);
      // fill in reading time for stories saved before the column existed
      const { rows } = await pool.query("SELECT id, body FROM stories WHERE read_minutes = 0 AND body <> ''");
      for (const r of rows) await pool.query('UPDATE stories SET read_minutes = $2 WHERE id = $1', [r.id, readMinutes(r.body)]);
    },

    // Published stories for the public site, newest first (without the long body).
    async listPublished() {
      const { rows } = await pool.query(
        `SELECT ${COLUMNS}, length(body) > 0 AS has_body FROM stories WHERE published ORDER BY created_at DESC`);
      return rows.map((r) => toStory(r));
    },

    // Everything, for the admin page.
    async listAll() {
      const { rows } = await pool.query(`SELECT ${COLUMNS}, body FROM stories ORDER BY created_at DESC`);
      const res = await resourcesFor(pool, rows.map((r) => r.id));
      return rows.map((r) => toStory(r, res.get(r.id) || []));
    },

    async findBySlug(slug, { publishedOnly = true } = {}) {
      const { rows } = await pool.query(
        `SELECT ${COLUMNS}, body FROM stories WHERE slug = $1 ${publishedOnly ? 'AND published' : ''}`, [slug]);
      if (!rows[0]) return null;
      const res = await resourcesFor(pool, [rows[0].id]);
      return toStory(rows[0], res.get(rows[0].id) || []);
    },

    async findById(id) {
      const { rows } = await pool.query(`SELECT ${COLUMNS}, body FROM stories WHERE id = $1`, [id]);
      if (!rows[0]) return null;
      const res = await resourcesFor(pool, [id]);
      return toStory(rows[0], res.get(id) || []);
    },

    async slugTaken(slug, exceptId = null) {
      const { rows } = await pool.query('SELECT 1 FROM stories WHERE slug = $1 AND id IS DISTINCT FROM $2::uuid', [slug, exceptId]);
      return rows.length > 0;
    },

    async insert(s) {
      await tx(async (db) => {
        await db.query(
          `INSERT INTO stories (id, slug, title, category, author, excerpt, body, link, youtube_id, cover_url, cover_key,
             cover_alt, featured, published, created_at, updated_at, read_minutes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`, values(s));
        await writeResources(db, s.id, s.resources || []);
      });
      return this.findById(s.id);
    },

    async update(s) {
      await tx(async (db) => {
        const v = values(s);
        v.splice(14, 1); // created_at never changes on update
        await db.query(
          `UPDATE stories SET slug=$2, title=$3, category=$4, author=$5, excerpt=$6, body=$7, link=$8, youtube_id=$9,
             cover_url=$10, cover_key=$11, cover_alt=$12, featured=$13, published=$14, updated_at=$15,
             read_minutes=$16
           WHERE id = $1`, v);
        await writeResources(db, s.id, s.resources || []);
      });
      return this.findById(s.id);
    },

    async remove(id) {
      await pool.query('DELETE FROM stories WHERE id = $1', [id]);
    },

    // keep a record of every uploaded file
    async recordMedia({ key, url, contentType, size, storyId = null }) {
      await pool.query(
        `INSERT INTO media (key, url, content_type, size_bytes, story_id) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (key) DO UPDATE SET story_id = EXCLUDED.story_id`, [key, url, contentType, size, storyId]);
    },
    async forgetMedia(key) {
      await pool.query('DELETE FROM media WHERE key = $1', [key]);
    },

    // ---------- settings ----------
    async getSetting(key) {
      const { rows } = await pool.query('SELECT value, updated_at FROM settings WHERE key = $1', [key]);
      return rows[0] ? { value: rows[0].value, updatedAt: new Date(rows[0].updated_at).toISOString() } : null;
    },
    async setSetting(key, value) {
      await pool.query(
        'INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
        [key, value]);
    },
    async deleteSetting(key) { await pool.query('DELETE FROM settings WHERE key = $1', [key]); },

    // ---------- analytics ----------
    async recordView(v) {
      await pool.query(
        `INSERT INTO page_views (id, visitor, path, story_id, country, region, city, referrer, device, started_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now()) ON CONFLICT (id) DO NOTHING`,
        [v.id, v.visitor, v.path, v.storyId || null, v.country, v.region, v.city, v.referrer, v.device]);
    },
    // only the browser that started a visit can update it (same anonymous visitor code), for up to 6 hours
    async updateView(id, visitor, seconds, scroll) {
      await pool.query(
        `UPDATE page_views SET active_seconds = GREATEST(active_seconds, $3), max_scroll = GREATEST(max_scroll, $4), updated_at = now()
         WHERE id = $1 AND visitor = $2 AND started_at > now() - interval '6 hours'`, [id, visitor, seconds, scroll]);
    },
    async viewsSince(since) {
      const { rows } = await pool.query(
        `SELECT visitor, path, story_id, country, region, city, referrer, device, started_at, active_seconds, max_scroll
         FROM page_views WHERE started_at >= $1 ORDER BY started_at LIMIT 500000`, [since]);
      return rows.map((r) => ({
        visitor: r.visitor, path: r.path, storyId: r.story_id, country: r.country, region: r.region, city: r.city,
        referrer: r.referrer, device: r.device, startedAt: new Date(r.started_at).toISOString(),
        seconds: r.active_seconds, scroll: r.max_scroll,
      }));
    },

    async close() { if (pool.end) await pool.end(); },
  };
}

module.exports = { createPostgresStore };
