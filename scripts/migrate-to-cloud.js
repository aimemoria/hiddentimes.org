// Copies the stories and images saved on this computer (data/stories.json + uploads/)
// into your online database and online image storage.
//
//   1. Fill in DATABASE_URL and the S3_* values in .env
//   2. npm run migrate:cloud
//
// Safe to run more than once: stories that are already in the database are skipped.
const fs = require('fs');
const path = require('path');
const config = require('../lib/config');
const { createJsonStore } = require('../lib/store/json-file');
const { createStore } = require('../lib/store');
const { createMedia } = require('../lib/media');
const { sniffImage } = require('../lib/util');

(async () => {
  if (!config.usePostgres) { console.error('Set DATABASE_URL in .env first.'); process.exit(1); }
  if (!config.useS3) { console.error('Set the S3_* values in .env first.'); process.exit(1); }

  const local = createJsonStore(config.LOCAL_DATA_FILE);
  const db = createStore();
  const media = createMedia();
  await db.init();

  const stories = await local.listAll();
  console.log(`Found ${stories.length} stories on this computer.`);
  let copied = 0, skipped = 0, images = 0;

  for (const s of stories) {
    if (await db.findById(s.id)) { skipped++; console.log(`  skip   ${s.title} (already online)`); continue; }

    let { cover, coverKey } = s;
    if (coverKey) {
      const file = path.join(config.LOCAL_UPLOADS_DIR, coverKey);
      if (fs.existsSync(file)) {
        const buffer = fs.readFileSync(file);
        const kind = sniffImage(buffer);
        if (kind) {
          const up = await media.put({ buffer, ext: kind.ext, contentType: kind.type });
          cover = up.url; coverKey = up.key; images++;
          s._media = up;
        }
      } else {
        console.warn(`  !      image missing for "${s.title}": ${file}`);
        cover = ''; coverKey = null;
      }
    }

    await db.insert({ ...s, cover, coverKey });
    if (s._media) await db.recordMedia({ ...s._media, storyId: s.id });
    copied++;
    console.log(`  copied ${s.title}`);
  }

  console.log(`\nDone: ${copied} stories and ${images} images copied, ${skipped} already online.`);
  console.log('Your local files are untouched. Once the live site looks right, you can archive data/ and uploads/.');
  await db.close();
})().catch((e) => { console.error('Migration failed:', e.message); process.exit(1); });
