// HiddenTimes logo geometry.
//
// The shapes were measured from the original artwork (letters, badge, tagline).
// SPACING (further down) then lays them out with even, adjustable gaps.
// Edit the numbers here to adjust the logo; everything else (SVG files,
// the <ht-logo> element, animations) is built from this file.

import { TAGLINE_GLYPHS } from './tagline-paths.js';
import { WORDMARK, WORDMARK_EM, WORDMARK_CAP } from './wordmark-paths.js';

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
// HIDDENTIMES is Archivo Medium, the website's own sans-serif, in one medium weight
// (outlines in wordmark-paths.js, so the logo looks the same everywhere, even without web fonts).

const BOT = 272;       // baseline
const TOP = BOT - WORDMARK_CAP; // cap top (letter height comes from wordmark-paths.js)

// ---------- spacing (all in logo units; the letters are WORDMARK_CAP = 176.5 units tall) ----------
export const SPACING = {
  tracking: 0.08,      // letter-spacing of HIDDENTIMES, in ems like CSS (0 = the font's normal spacing)
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

// Set the letters like the browser sets text: each one's advance width, plus the font's
// kerning, plus the tracking. The first letter's ink starts exactly at textX.
const trackingUnits = SPACING.tracking * WORDMARK_EM;
let pen = textX - WORDMARK[0].inkLeft;
let wordRight = textX;
export const LETTERS = WORDMARK.map((g) => {
  const out = { ch: g.ch, weight: g.weight, d: shiftPath(g.d, pen, 0) };
  wordRight = pen + g.inkRight;                      // the last letter's real right edge
  pen += g.advance + g.kern + trackingUnits;
  return out;
});

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
