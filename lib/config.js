// All settings come from environment variables (or a .env file, see .env.example).
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;

const config = {
  ROOT,
  PORT,
  PUBLIC_DIR: path.join(ROOT, 'public'),

  // Public address of the site, used for canonical links, sitemap and share previews.
  SITE_URL: (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/+$/, ''),
  SITE_NAME: process.env.SITE_NAME || 'HiddenTimes',
  SITE_TAGLINE: process.env.SITE_TAGLINE || 'Discover the Unknown',
  SITE_DESCRIPTION: process.env.SITE_DESCRIPTION ||
    'Stories worth reading, and the podcasts behind them. History, mysteries and the people who shaped them.',

  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'hiddentimes',
  SESSION_HOURS: 12,

  // Database: set DATABASE_URL for PostgreSQL. Without it, stories stay in data/stories.json (local only).
  DATABASE_URL: process.env.DATABASE_URL || '',
  DATABASE_SSL: process.env.DATABASE_SSL || 'auto', // auto | require | disable

  // Image storage: set the S3_* values for online storage. Without them, images stay in uploads/ (local only).
  S3: {
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT || '',             // needed for Cloudflare R2, Supabase, Backblaze…
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    publicUrl: (process.env.S3_PUBLIC_URL || '').replace(/\/+$/, ''), // address images are served from
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  },

  LOCAL_DATA_FILE: process.env.LOCAL_DATA_FILE || path.join(ROOT, 'data', 'stories.json'),
  LOCAL_UPLOADS_DIR: path.join(ROOT, 'uploads'),
  MAX_IMAGE_BYTES: 8 * 1024 * 1024,
};

config.useS3 = Boolean(config.S3.bucket && config.S3.accessKeyId && config.S3.secretAccessKey);
config.usePostgres = Boolean(config.DATABASE_URL);

module.exports = config;
