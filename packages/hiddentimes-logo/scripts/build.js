// Writes ready-made SVG files to dist/.  Run:  npm run build   (or: node scripts/build.js)
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderLogo } from '../index.js';
import { SMALL_RING_BASE, SMALL_SYMBOL_BASE } from '../src/brush-paths.js';
import { BASE_CIRCLE } from '../src/symbol-path.js';

const out = fileURLToPath(new URL('../dist/', import.meta.url));
mkdirSync(out, { recursive: true });

const files = {
  'logo-light.svg':            { theme: 'light' },
  'logo-dark.svg':             { theme: 'dark' },
  'logo-mono.svg':             { theme: 'mono' },
  'logo-light-no-tagline.svg': { theme: 'light', tagline: false },
  'logo-dark-no-tagline.svg':  { theme: 'dark', tagline: false },
  'mark-light.svg':            { theme: 'light', variant: 'mark' },
  'mark-dark.svg':             { theme: 'dark', variant: 'mark' },
  'mark-mono.svg':             { theme: 'mono', variant: 'mark' },
  'wordmark-light.svg':        { theme: 'light', variant: 'wordmark' },
  'wordmark-dark.svg':         { theme: 'dark', variant: 'wordmark' },
};

for (const [name, opts] of Object.entries(files)) {
  writeFileSync(out + name, renderLogo(opts) + '\n');
  console.log('dist/' + name);
}

// The browser-tab icon: the badge with a solid brush (no dry streaks, which turn to noise at 16 px)
// on a white rounded square, so it shows on light and dark tab bars alike.
{
  const { cx, cy, rx, ry } = BASE_CIRCLE, half = Math.max(rx, ry) + 34;
  const x = +(cx - half).toFixed(2), y = +(cy - half).toFixed(2), s = +(half * 2).toFixed(2);
  writeFileSync(out + 'favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${s} ${s}">` +
    `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${+(s * 0.22).toFixed(2)}" fill="#fff"/>` +
    `<path d="${SMALL_RING_BASE}" fill="#000"/><path d="${SMALL_SYMBOL_BASE}" fill="#000"/></svg>
`);
  console.log('dist/favicon.svg');
}
