// The symbol inside the round badge: one closed line (straight runs + quadratic curves at the corners).
// Shared by shapes.js (layout) and scripts/build-letters.js (which paints it with the brush).

// The white symbol inside the circle is one closed line, drawn with a thick
// stroke and rounded corners. Straight runs + quadratic curves at each corner.
const DRAWN_SYMBOL = {
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

// The badge's area. The original badge is very slightly taller than wide (rx 219.75 vs ry 226.5).
// The brush ring is painted just inside it.
export const BASE_CIRCLE = { cx: 226.75, cy: 232.5, rx: 219.75, ry: 226.5 };

// Inside the brush ring the symbol is drawn a little smaller, so it has room to breathe.
const SYMBOL_SCALE = 0.84, SYMBOL_CENTRE = [237.4, 232.5];
const scalePath = (d) => d.replace(/-?\d+(\.\d+)?\s+-?\d+(\.\d+)?/g, (pair) => {
  const [x, y] = pair.split(/\s+/).map(Number);
  return `${+(SYMBOL_CENTRE[0] + (x - SYMBOL_CENTRE[0]) * SYMBOL_SCALE).toFixed(2)} ${+(SYMBOL_CENTRE[1] + (y - SYMBOL_CENTRE[1]) * SYMBOL_SCALE).toFixed(2)}`;
});

// The whole logo is italic: the badge leans forward by ITALIC degrees around its centre, like the
// letters and the tagline (points above the centre move right, points below move left).
export const ITALIC = 10;
const lean = Math.tan((ITALIC * Math.PI) / 180);
export const italicPoint = ([x, y]) => [x + (BASE_CIRCLE.cy - y) * lean, y];
const italicPath = (d) => d.replace(/-?\d+(\.\d+)?\s+-?\d+(\.\d+)?/g, (pair) => {
  const [x, y] = italicPoint(pair.split(/\s+/).map(Number));
  return `${+x.toFixed(2)} ${+y.toFixed(2)}`;
});

export const BASE_SYMBOL = { ...DRAWN_SYMBOL, d: italicPath(scalePath(DRAWN_SYMBOL.d)) };
