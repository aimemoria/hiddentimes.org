// HiddenTimes logo: turns the geometry into SVG markup.

import { CIRCLE, SYMBOL, SYMBOL_BRUSH, RING, LETTERS, TAGLINE, VIEWBOX, MARK_SHIFT_NO_TAGLINE } from './shapes.js';

// Colour sets. "light" is for light backgrounds, "dark" for dark ones.
export const THEMES = {
  light: { ink: '#000000', accent: '#F2A603', markBg: '#000000', markFg: '#FFFFFF' },
  dark:  { ink: '#FFFFFF', accent: '#F2A603', markBg: '#FFFFFF', markFg: '#000000' },
  mono:  { ink: 'currentColor', accent: 'currentColor', markBg: 'currentColor', markFg: 'knockout' },
};

let uid = 0;

/**
 * Build the logo as an SVG string.
 *
 * @param {object}  [o]
 * @param {'full'|'mark'|'wordmark'} [o.variant='full']
 * @param {boolean} [o.tagline=true]    show "Discover the Unknown"
 * @param {'light'|'dark'|'mono'|object} [o.theme='light']  a theme name, or your own colours
 *                                       { ink, accent, markBg, markFg } ('knockout' cuts the symbol out)
 * @param {boolean} [o.css=false]        true = colours come from CSS variables instead of fixed values
 *                                       (--ht-ink, --ht-accent, --ht-mark-bg, --ht-mark-fg)
 * @param {string}  [o.title='HiddenTimes']
 * @param {number}  [o.height]           sets width/height attributes (else it scales to its container)
 */
export function renderLogo(o = {}) {
  const variant = o.variant || 'full';
  const tagline = o.tagline !== false;
  const base = typeof o.theme === 'object' ? { ...THEMES.light, ...o.theme } : THEMES[o.theme || 'light'] || THEMES.light;
  const title = String(o.title ?? 'HiddenTimes').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  const c = o.css
    ? { ink: `var(--ht-ink, ${base.ink})`, accent: `var(--ht-accent, ${base.accent})`,
        markBg: `var(--ht-mark-bg, ${base.markBg})`, markFg: base.markFg === 'knockout' ? 'knockout' : `var(--ht-mark-fg, ${base.markFg})` }
    : base;
  const fill = (v) => (o.css ? `style="fill:${v}"` : `fill="${v}"`);

  const vbKey = variant === 'wordmark' ? (tagline ? 'wordmark' : 'wordmarkNoTagline')
    : variant === 'mark' ? 'mark' : (tagline ? 'full' : 'fullNoTagline');
  // full logo without tagline: badge moves so HIDDENTIMES sits on its vertical centre
  const markShift = variant === 'full' && !tagline ? MARK_SHIFT_NO_TAGLINE : 0;
  const [vx, vy, vw, vh] = VIEWBOX[vbKey];
  const size = o.height ? ` height="${o.height}" width="${Math.round((o.height * vw) / vh)}"` : '';
  const id = `ht${++uid}`;

  let mark = '';

  if (variant !== 'wordmark') {
    // The badge is an open brush ring (ensō) with the brush-painted symbol inside, both in the
    // badge colour (markBg). Each is shown through a wide line along its own path (in a mask):
    // animating those lines (.ht-symbol) makes the paint appear as if it were being painted.
    const pad = 70;
    const box = `maskUnits="userSpaceOnUse" x="${+(CIRCLE.cx - CIRCLE.rx - pad).toFixed(2)}" y="${+(CIRCLE.cy - CIRCLE.ry - pad).toFixed(2)}" width="${+(CIRCLE.rx * 2 + pad * 2).toFixed(2)}" height="${+(CIRCLE.ry * 2 + pad * 2).toFixed(2)}"`;
    const guide = (d, w) => `<path class="ht-symbol" d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" pathLength="1"/>`;
    mark = `<defs><mask id="${id}-r" ${box}>${guide(RING.guide, 110)}</mask><mask id="${id}-s" ${box}>${guide(SYMBOL.d, 80)}</mask></defs>
      <g class="ht-mark" part="mark">
        <path class="ht-circle" part="circle" d="${RING.d}" mask="url(#${id}-r)" ${fill(c.markBg)}/>
        <path class="ht-symbol-paint" part="symbol" d="${SYMBOL_BRUSH}" mask="url(#${id}-s)" ${fill(c.markBg)}/>
      </g>`;
    if (markShift) mark = `<g transform="translate(0 ${markShift})">${mark}</g>`;
  }

  let words = '';
  if (variant !== 'mark') {
    words = `<g class="ht-wordmark" part="wordmark" ${fill(c.ink)}>
      ${LETTERS.map((l, i) => `<path class="ht-letter" part="letter" style="--i:${i}" d="${l.d}"/>`).join('')}
    </g>`;
    if (tagline) {
      words += `<g class="ht-tagline" part="tagline" ${fill(c.accent)}>
        ${TAGLINE.map((g, i) => `<path class="ht-tagline-letter" part="tagline-letter" style="--i:${i}" d="${g.d}"/>`).join('')}
      </g>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}"${size} role="img" aria-label="${title}" class="ht-logo" part="svg">` +
    `${title ? `<title>${title}</title>` : ''}${mark}${words}</svg>`;
}
