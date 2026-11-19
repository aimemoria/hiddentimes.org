// Picks where stories are saved: PostgreSQL when DATABASE_URL is set, otherwise a local file.
const config = require('../config');
const { createPostgresStore } = require('./postgres');
const { createJsonStore } = require('./json-file');

// Encrypted, verified connections by default.
//   DATABASE_SSL=auto       encrypt + verify for remote databases, plain for localhost (default)
//   DATABASE_SSL=require    always encrypt + verify
//   DATABASE_SSL=disable    no encryption (only for a database on the same machine)
//   DATABASE_CA_FILE=path   the provider's certificate, e.g. Supabase's "SSL certificate" download
//   DATABASE_CA=<text>      the same certificate pasted as text (use this on hosting services)
function sslOption(url) {
  const mode = config.DATABASE_SSL;
  if (mode === 'disable') return false;
  const local = /@(localhost|127\.0\.0\.1)(:|\/)/.test(url);
  if (mode === 'auto' && local) return false;
  const ssl = { rejectUnauthorized: true };
  // DATABASE_CA: the certificate text itself (for hosting services, which can't hold private files)
  // DATABASE_CA_FILE: path to the certificate file (for this computer)
  if (process.env.DATABASE_CA) ssl.ca = process.env.DATABASE_CA.replace(/\\n/g, '\n');
  else if (process.env.DATABASE_CA_FILE) ssl.ca = require('fs').readFileSync(process.env.DATABASE_CA_FILE, 'utf8');
  return ssl;
}

function createStore() {
  if (config.usePostgres) {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: config.DATABASE_URL, ssl: sslOption(config.DATABASE_URL), max: 10 });
    return createPostgresStore(pool);
  }
  return createJsonStore(config.LOCAL_DATA_FILE);
}

module.exports = { createStore };
