// HiddenTimes logo: turns the geometry into SVG markup.

import { CIRCLE, SYMBOL, LETTERS, TAGLINE, VIEWBOX, MARK_SHIFT_NO_TAGLINE } from './shapes.js';

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
  const badge = (extra) =>
    `<ellipse class="ht-circle" part="circle" cx="${CIRCLE.cx}" cy="${CIRCLE.cy}" rx="${CIRCLE.rx}" ry="${CIRCLE.ry}" ${fill(c.markBg)}${extra}/>`;

  if (variant !== 'wordmark') {
    const symbolPath = `d="${SYMBOL.d}" fill="none" stroke-width="${SYMBOL.strokeWidth}" stroke-linejoin="round" stroke-linecap="round" pathLength="1"`;
    if (c.markFg === 'knockout') {
      mark = `<defs><mask id="${id}-k" maskUnits="userSpaceOnUse" x="-20" y="-20" width="500" height="540">
        <rect x="-20" y="-20" width="500" height="540" fill="#fff"/><path ${symbolPath} stroke="#000"/></mask></defs>
      <g class="ht-mark" part="mark">
        ${badge(` mask="url(#${id}-k)"`)}
      </g>`;
    } else {
      mark = `<g class="ht-mark" part="mark">
        ${badge('')}
        <path class="ht-symbol" part="symbol" ${symbolPath} ${o.css ? `style="stroke:${c.markFg}"` : `stroke="${c.markFg}"`}/>
      </g>`;
    }
    if (markShift) mark = `<g transform="translate(0 ${markShift})">${mark}</g>`;
  }

  let words = '';
  if (variant !== 'mark') {
    words = `<g class="ht-wordmark" part="wordmark" ${fill(c.ink)}>
      ${LETTERS.map((l, i) => `<path class="ht-letter" part="letter" style="--i:${i}" fill-rule="evenodd" d="${l.d}"/>`).join('')}
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
