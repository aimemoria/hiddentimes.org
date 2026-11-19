// Build step for Vercel (runs as `npm run build` on every deploy).
// Vercel serves everything in public/ straight from its fast file network, not through the server,
// so the logo kit, the image shrinker and the two Markdown helpers are copied in there.
// On this computer you don't need this: `npm start` serves the same files from their own folders.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

const copies = [
  ['packages/hiddentimes-logo', 'logo-kit'],
  ['packages/image-shrink', 'image-kit'],
  ['node_modules/marked/marked.min.js', 'vendor/marked.min.js'],
  ['node_modules/dompurify/dist/purify.min.js', 'vendor/purify.min.js'],
];

for (const [from, to] of copies) {
  const src = path.join(ROOT, from);
  const dest = path.join(PUBLIC, to);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, {
    recursive: true,
    // the packages' own build tools and package files aren't needed by visitors
    filter: (p) => !/[\\/](scripts|node_modules)([\\/]|$)/.test(path.relative(ROOT, p)) && !p.endsWith('package.json'),
  });
  console.log(`copied ${from} → public/${to}`);
}
