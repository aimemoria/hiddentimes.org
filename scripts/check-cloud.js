// Checks that the online database and image storage in .env work, without changing your stories.
//   npm run check:cloud
const config = require('../lib/config');

const ok = (m) => console.log('  ✓ ' + m);
const bad = (m, hint) => { console.log('  ✗ ' + m); if (hint) console.log('    → ' + hint); };

// a 1×1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

(async () => {
  let failed = false;

  console.log('\nDatabase');
  if (!config.usePostgres) { bad('DATABASE_URL is empty in .env'); failed = true; }
  else {
    try {
      const { createStore } = require('../lib/store');
      const store = createStore();
      await store.init();
      const n = (await store.listAll()).length;
      ok(`connected, tables ready (${n} stories online)`);
      await store.close();
    } catch (e) {
      failed = true;
      const m = e.message || String(e);
      bad('could not connect: ' + m,
        /password authentication/i.test(m) ? 'the database password in DATABASE_URL is wrong (replace [YOUR-PASSWORD])'
        : /ENOENT/.test(m) ? 'the certificate file is missing: save it as certs/supabase-ca.crt'
        : /self.signed|certificate/i.test(m) ? 'certificate problem: check DATABASE_CA_FILE points to the downloaded Supabase certificate'
        : /ENOTFOUND|getaddrinfo/i.test(m) ? 'the address in DATABASE_URL is wrong, or use the Session pooler string'
        : /ETIMEDOUT|ECONNREFUSED/i.test(m) ? 'cannot reach the database: use the Session pooler connection string'
        : '');
    }
  }

  console.log('\nImage storage');
  if (!config.useS3) { bad('S3_BUCKET, S3_ACCESS_KEY_ID or S3_SECRET_ACCESS_KEY is empty in .env'); failed = true; }
  else {
    try {
      const { createMedia } = require('../lib/media');
      const media = createMedia();
      const up = await media.put({ buffer: PNG, ext: '.png', contentType: 'image/png' });
      ok('upload works');
      const r = await fetch(up.url);
      if (r.ok) ok('images are publicly visible: ' + up.url.replace(/\/[^/]+$/, '/…'));
      else { failed = true; bad(`uploaded, but readers can't see it (HTTP ${r.status})`, 'make the bucket Public, and check S3_PUBLIC_URL'); }
      await media.remove(up.key);
      ok('delete works (test image removed)');
    } catch (e) {
      failed = true;
      const m = e.message || String(e);
      bad('storage error: ' + m,
        /S3_PUBLIC_URL/.test(m) ? 'fill in S3_PUBLIC_URL'
        : /NoSuchBucket|not found/i.test(m) ? 'the bucket name in S3_BUCKET does not exist'
        : /InvalidAccessKeyId|SignatureDoesNotMatch|Forbidden|AccessDenied/i.test(m) ? 'access key or secret is wrong, or S3_REGION does not match'
        : '');
    }
  }

  console.log(failed ? '\nSomething needs fixing (see → above).\n' : '\nAll good. Next: npm run migrate:cloud\n');
  process.exit(failed ? 1 : 0);
})();
