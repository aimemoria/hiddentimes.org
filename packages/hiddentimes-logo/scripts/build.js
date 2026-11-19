// Writes ready-made SVG files to dist/.  Run:  npm run build   (or: node scripts/build.js)
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderLogo } from '../index.js';

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
