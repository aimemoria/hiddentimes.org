// HiddenTimes logo geometry.
//
// The shapes were measured from the original artwork (letters, badge, tagline).
// SPACING (further down) then lays them out with even, adjustable gaps.
// Edit the numbers here to adjust the logo; everything else (SVG files,
// the <ht-logo> element, animations) is built from this file.

import { TAGLINE_GLYPHS } from './tagline-paths.js';

// ---------- the round mark ----------

// The original badge is very slightly taller than wide (rx 219.75 vs ry 226.5).
// Set rx and ry to the same value for a perfect circle.
const BASE_CIRCLE = { cx: 226.75, cy: 232.5, rx: 219.75, ry: 226.5 };

// The white symbol inside the circle is one closed line, drawn with a thick
// stroke and rounded corners. Straight runs + quadratic curves at each corner.
const BASE_SYMBOL = {
  strokeWidth: 35,
  d: [
    'M121.4 154',
    'Q121.5 70.5 176.2 133.5',     // top-left corner
    'L223.5 188',
    'Q243.5 211 266.9 191.5',      // upper notch
    'L314.2 152.1',
    'Q353 119.8 353.2 170.3',      // top-right corner
    'L353.7 280.5',
    'Q354 335 311.5 300.9',        // bottom-right corner
    'L265.9 264.2',
    'Q242.5 245.4 223.7 268.8',    // lower notch
    'L176.6 327.6',
    'Q121 397.1 121.1 308.1',      // bottom-left corner
    'Z',
  ].join(' '),
};

// ---------- the wordmark: H I D D E N T I M E S ----------

const TOP = 95.5;      // cap top
const BOT = 272;       // baseline
const STEM = 45;       // stroke width of the letters

const rect = (x, w = STEM) => `M${x} ${TOP}H${x + w}V${BOT}H${x}Z`;

const H = (x) =>
  `M${x} ${TOP}H${x + STEM}V162H${x + 114}V${TOP}H${x + 159}V${BOT}H${x + 114}V205H${x + STEM}V${BOT}H${x}Z`;

// D: straight back, half-circle bowl; counter cut out with even-odd fill
const D = (x) => {
  const r = (BOT - TOP) / 2;
  return `M${x} ${TOP}H${x + 67.5}A${r} ${r} 0 0 1 ${x + 67.5} ${BOT}H${x}Z` +
         `M${x + STEM} 137H${x + 65}A45.75 45.75 0 0 1 ${x + 65} 228.5H${x + STEM}Z`;
};

// E: floating top bar, then a lower "L" with middle bar; bar ends are cut on a slant
const E = (x) =>
  `M${x - 11.5} ${TOP}H${x + 129}L${x + 106.5} 138H${x + 13}Z` +
  `M${x} 162H${x + 118}L${x + 93} 205H${x + STEM}V230H${x + 128}L${x + 108.5} ${BOT}H${x}Z`;

const N = (x) =>
  `M${x} ${TOP}H${x + 33}L${x + 110} 190V${TOP}H${x + 155}V${BOT}H${x + 120}` +
  `L${x + STEM} 180.5V${BOT}H${x}Z`;

const T = (x) =>
  `M${x} ${TOP}H${x + 133.5}L${x + 117} 138H${x + 83}V${BOT}H${x + 38}V138H${x}Z`;

const M = (x) =>
  `M${x} ${TOP}H${x + 35}L${x + 96.5} 174L${x + 158} ${TOP}H${x + 194}V${BOT}H${x + 148}` +
  `V183L${x + 97} 244L${x + STEM} 184V${BOT}H${x}Z`;

// S: built from bars with rounded turns; slanted cuts on the top-right and bottom-left ends
const S = (x) => {
  const p = (n) => x + n; // x offset helper (S origin = its left edge, 1927 in the artwork)
  return [
    `M${p(51)} ${TOP}H${p(136.5)}L${p(113.5)} 138H${p(51)}`,
    `Q${p(45)} 138 ${p(45)} 144V156Q${p(45)} 162 ${p(51)} 162H${p(71)}`,
    `C${p(103)} 162 ${p(138)} 175 ${p(138)} 208V224`,
    `C${p(138)} 258 ${p(103)} ${BOT} ${p(73)} ${BOT}H${p(-5)}L${p(17.5)} 230H${p(83)}`,
    `Q${p(91)} 230 ${p(91)} 222V213Q${p(91)} 205 ${p(83)} 205H${p(68)}`,
    `C${p(28)} 205 ${p(0)} 190 ${p(0)} 162V140C${p(0)} 118 ${p(18)} ${TOP} ${p(51)} ${TOP}Z`,
  ].join('');
};

// Each letter: how to draw it, and how wide it is for spacing purposes.
// "width" is the optical right edge. For letters whose bars are cut on a slant
// (E, T) it sits midway along the slant so the gaps *look* even.
const WORD = [
  { ch: 'H', draw: H,    width: 159 },
  { ch: 'I', draw: rect, width: STEM },
  { ch: 'D', draw: D,    width: 155.75 },
  { ch: 'D', draw: D,    width: 155.75 },
  { ch: 'E', draw: E,    width: 120 },
  { ch: 'N', draw: N,    width: 155 },
  { ch: 'T', draw: T,    width: 125 },
  { ch: 'I', draw: rect, width: STEM },
  { ch: 'M', draw: M,    width: 194 },
  { ch: 'E', draw: E,    width: 120 },
  { ch: 'S', draw: S,    width: 138 },
];

// ---------- spacing (all in logo units; the letters are 176.5 units tall) ----------
export const SPACING = {
  letterGap: 42,       // space between letters of HIDDENTIMES (original artwork: uneven, 7 to 22)
  markGap: 80,         // space between the badge and the text (original: 38)
  taglineGap: 56,      // space between HIDDENTIMES and the tagline (original: 20)
  taglineTracking: 20, // extra space between tagline letters (original: 0)
  taglineWordGap: 24,  // extra space between tagline words, on top of the tracking
};

// Shift every coordinate pair in an absolute path (M/L/Q/C/Z only) by dx, dy.
const shiftPath = (d, dx, dy) =>
  d.replace(/([MLQCZ])([^MLQCZ]*)/g, (m, cmd, args) => {
    const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    return cmd + n.map((v, i) => +(v + (i % 2 ? dy : dx)).toFixed(2)).join(' ');
  });

// ---------- lay everything out ----------

// badge stays where it was horizontally; text starts markGap after it
const textX = BASE_CIRCLE.cx + BASE_CIRCLE.rx + SPACING.markGap;

let x = textX;
export const LETTERS = WORD.map((l, i) => {
  const out = { ch: l.ch, d: l.draw(x) };
  x += l.width + SPACING.letterGap;
  return out;
});
const wordRight = x - SPACING.letterGap + 6; // last letter's real right edge (+ S overshoot)

// tagline: keep its left edge lined up with the H (as in the original), push it down,
// and open up the letter spacing (spaces between words get the same extra room)
const TAG_TOP = 292, TAG_BOTTOM = 379, ORIGINAL_H_X = 485;
const tagDY = BOT + SPACING.taglineGap - TAG_TOP;
const tagDX = textX - ORIGINAL_H_X;
let spaces = 0;
const PHRASE = 'Discover the Unknown';
const spaceBefore = [];
for (const ch of PHRASE) { if (ch === ' ') spaces++; else spaceBefore.push(spaces); }
export const TAGLINE = TAGLINE_GLYPHS.map((g, i) => ({
  ch: g.ch,
  d: shiftPath(g.d, tagDX + SPACING.taglineTracking * (i + spaceBefore[i]) + SPACING.taglineWordGap * spaceBefore[i], tagDY),
}));

// badge: centred vertically on the text block (wordmark top → tagline bottom)
const blockTop = TOP, blockBottom = TAG_BOTTOM + tagDY;
const blockBottomNoTag = BOT;
const badgeDY = (blockTop + blockBottom) / 2 - BASE_CIRCLE.cy;

export const CIRCLE = { ...BASE_CIRCLE, cy: BASE_CIRCLE.cy + badgeDY };
export const SYMBOL = { ...BASE_SYMBOL, d: shiftPath(BASE_SYMBOL.d, 0, badgeDY) };

// Without the tagline, HIDDENTIMES alone sits on the badge's vertical centre:
// the badge moves by this much (applied by render.js).
export const MARK_SHIFT_NO_TAGLINE = +((TOP + BOT) / 2 - CIRCLE.cy).toFixed(2);

// ---------- crop boxes for each layout ----------
const pad = 6;
const tagRight = 1784 + tagDX + SPACING.taglineTracking * (TAGLINE.length - 1 + spaces) + SPACING.taglineWordGap * spaces;
const right = Math.max(wordRight, tagRight) + pad;
const badgeTop = CIRCLE.cy - CIRCLE.ry - pad, badgeH = CIRCLE.ry * 2 + pad * 2;
const textLeft = textX - 14; // italic tagline leans left of the H
const box = (x0, y0, x1, y1) => [x0, y0, x1 - x0, y1 - y0].map((v) => +v.toFixed(2));

export const VIEWBOX = {
  full:     box(0, badgeTop, right, badgeTop + badgeH),                      // badge + text
  fullNoTagline: box(0, badgeTop + MARK_SHIFT_NO_TAGLINE, wordRight + pad,
                     badgeTop + MARK_SHIFT_NO_TAGLINE + badgeH),            // badge + HIDDENTIMES
  mark:     box(0, badgeTop, BASE_CIRCLE.cx * 2, badgeTop + badgeH),         // badge only
  wordmark: box(textLeft, TOP - pad, right, blockBottom + pad),              // text, no badge
  wordmarkNoTagline: box(textX - pad, TOP - pad, wordRight + pad, blockBottomNoTag + pad),
};
