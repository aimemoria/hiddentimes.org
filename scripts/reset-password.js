// Forgot the admin password? This removes the saved one, so the starting password
// (ADMIN_PASSWORD in .env, or in your hosting settings) works again.
//   npm run reset:password
const { createStore } = require('../lib/store');

(async () => {
  const store = createStore();
  await store.init();
  await store.deleteSetting('admin_password_hash');
  await store.close();
  console.log('Done. Sign in with the starting password (ADMIN_PASSWORD), then set a new one in Admin → Account.');
})().catch((e) => { console.error('Could not reset:', e.message); process.exit(1); });
