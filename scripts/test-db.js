// Tests the PostgreSQL story storage against a real Postgres engine running in memory (PGlite).
//   npm run test:db
const assert = require('assert/strict');
const { createPostgresStore } = require('../lib/store/postgres');

(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite();

  // make PGlite look like a `pg` Pool
  const query = async (text, params) => {
    if (params && params.length) return pg.query(text, params);
    const results = await pg.exec(text);
    return results[results.length - 1] || { rows: [] };
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };

  const store = createPostgresStore(pool);
  await store.init();
  await store.init(); // running the schema twice must be harmless

  const now = Date.now();
  const iso = (offsetMin) => new Date(now + offsetMin * 60000).toISOString();
  const a = {
    id: '11111111-1111-4111-8111-111111111111', slug: 'first', title: 'First', category: 'History',
    author: 'Ann', excerpt: 'One', body: '# Hello', link: '', youtubeId: '', cover: 'https://cdn/x.jpg',
    coverKey: 'covers/2026/11/x.jpg', coverAlt: 'A picture', featured: true, published: true,
    resources: [{ title: 'Source A', url: 'https://a.example' }, { title: 'Source B', url: 'https://b.example' }],
    createdAt: iso(0), updatedAt: iso(0),
  };
  const b = { ...a, id: '22222222-2222-4222-8222-222222222222', slug: 'second', title: 'Second', body: '',
    link: 'https://youtu.be/abcdefghijk', youtubeId: 'abcdefghijk', coverKey: null, featured: false,
    published: false, resources: [], createdAt: iso(5), updatedAt: iso(5) };

  const savedA = await store.insert(a);
  assert.equal(savedA.title, 'First');
  assert.deepEqual(savedA.resources, a.resources, 'resources saved in order');
  await store.insert(b);

  // public list: published only, no body, hasBody flag
  const pub = await store.listPublished();
  assert.equal(pub.length, 1);
  assert.equal(pub[0].slug, 'first');
  assert.equal(pub[0].body, undefined);
  assert.equal(pub[0].hasBody, true);

  // admin list: everything, newest first, with body + resources
  const all = await store.listAll();
  assert.deepEqual(all.map((s) => s.slug), ['second', 'first']);
  assert.equal(all[1].resources.length, 2);

  assert.equal(await store.findBySlug('second'), null, 'drafts are hidden from the public');
  assert.equal((await store.findBySlug('second', { publishedOnly: false })).title, 'Second');
  assert.equal(await store.slugTaken('first'), true);
  assert.equal(await store.slugTaken('first', a.id), false, 'a story does not clash with itself');

  // update: new text, reordered/removed resources
  const upd = await store.update({ ...savedA, title: 'First (edited)', resources: [{ title: 'Only', url: 'https://c.example' }], updatedAt: iso(10) });
  assert.equal(upd.title, 'First (edited)');
  assert.deepEqual(upd.resources, [{ title: 'Only', url: 'https://c.example' }]);
  assert.equal(upd.coverAlt, 'A picture');

  // media records follow the story
  await store.recordMedia({ key: 'covers/2026/11/x.jpg', url: 'https://cdn/x.jpg', contentType: 'image/jpeg', size: 1234, storyId: a.id });
  await store.remove(a.id);
  assert.equal(await store.findById(a.id), null);
  const orphans = await pg.query('SELECT count(*)::int AS n FROM story_resources WHERE story_id = $1', [a.id]);
  assert.equal(orphans.rows[0].n, 0, 'resources are deleted with their story');
  const m = await pg.query('SELECT story_id FROM media WHERE key = $1', ['covers/2026/11/x.jpg']);
  assert.equal(m.rows[0].story_id, null, 'media row kept but unlinked');
  await store.forgetMedia('covers/2026/11/x.jpg');

  // reading time is saved with the story
  const rm = await store.insert({ ...a, id: '33333333-3333-4333-8333-333333333333', slug: 'third', readMinutes: 7, resources: [] });
  assert.equal(rm.readMinutes, 7);

  // publishing page: image credit is saved; one submission code can only ever create one story
  const sub = '55555555-5555-4555-8555-555555555555';
  const ag = await store.insert({ ...a, id: '66666666-6666-4666-8666-666666666666', slug: 'agent', coverCredit: 'Photo: Jane Doe, CC BY 4.0', submissionId: sub, resources: [] });
  assert.equal(ag.coverCredit, 'Photo: Jane Doe, CC BY 4.0');
  assert.equal((await store.findBySubmission(sub)).id, ag.id);
  await assert.rejects(store.insert({ ...a, id: '77777777-7777-4777-8777-777777777777', slug: 'agent-2', submissionId: sub, resources: [] }),
    (e) => e.code === '23505', 'the same submission is refused a second time');
  const agEdit = await store.update({ ...ag, coverCredit: 'Original illustration', submissionId: null, updatedAt: iso(20) });
  assert.equal(agEdit.coverCredit, 'Original illustration');
  assert.equal(agEdit.submissionId, sub, 'an edit never changes the submission code');
  assert.equal(await store.findBySubmission('88888888-8888-4888-8888-888888888888'), null);

  // analytics: record a visit, update it, read it back; only the same visitor code may update
  const vid = '44444444-4444-4444-8444-444444444444';
  await store.recordView({ id: vid, visitor: 'abc', path: '/story/third', storyId: rm.id, country: 'RW', region: 'Kigali', city: 'Kigali', referrer: 'google.com', device: 'mobile' });
  await store.recordView({ id: vid, visitor: 'abc', path: '/x', country: '', region: '', city: '', referrer: '', device: '' }); // duplicate ignored
  await store.updateView(vid, 'abc', 125, 80);
  await store.updateView(vid, 'abc', 60, 40);       // never goes backwards
  await store.updateView(vid, 'someone-else', 9999, 100); // ignored
  const views = await store.viewsSince(new Date(Date.now() - 864e5));
  assert.equal(views.length, 1);
  assert.equal(views[0].seconds, 125);
  assert.equal(views[0].scroll, 80);
  assert.equal(views[0].country, 'RW');
  await store.remove(rm.id);
  assert.equal((await store.viewsSince(new Date(0)))[0].storyId, null, 'visits kept when a story is deleted');

  // settings + password hashing
  const { hashPassword, verifyPassword } = require('../lib/passwords');
  assert.equal(await store.getSetting('admin_password_hash'), null);
  const h = await hashPassword('a long new password');
  assert.ok(!h.includes('a long new password'), 'hash never contains the password');
  await store.setSetting('admin_password_hash', h);
  await store.setSetting('admin_password_hash', h); // update in place
  const got = await store.getSetting('admin_password_hash');
  assert.equal(await verifyPassword('a long new password', got.value), true);
  assert.equal(await verifyPassword('wrong password', got.value), false);
  await store.deleteSetting('admin_password_hash');
  assert.equal(await store.getSetting('admin_password_hash'), null);

  console.log('Database tests passed ✓ (schema, insert, lists, drafts, slugs, update, resources, delete, media, read time, image credit, one story per submission, analytics, settings, password hashing)');
  await pg.close();
})().catch((e) => { console.error('Database test FAILED:', e); process.exit(1); });
