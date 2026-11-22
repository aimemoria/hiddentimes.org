// The HiddenTimes letters: our own dry-brush lettering, drawn for this logo (no font file).
//
// Each letter is a few brush strokes. A stroke is a path of points (y goes UP from the baseline, in
// logo units). It is painted with a heavy brush that presses in at the start, is thinner when it
// moves along its own edge, and runs dry toward the end: the stroke breaks into bristle streaks
// (STREAK on the big downstrokes, TEX on the smaller ones, DRY on the thin, fast bars of H and T).
// The letters lean forward (italic) like the badge and tagline, with even space between them,
// and "HiddenTimes" is one word.
//
// To restyle: change the brush (B, DRY, STREAK, TEX), the layout numbers below (SLANT, WIDE,
// TRACK, SIZE), or a letter's points in LETTERS; then run  npm run build  (in packages/hiddentimes-logo)
// The texture comes from a fixed seed (SEED), so the logo is identical every time.
// The same brush also paints the symbol in the badge (symbolBrush, at the bottom).
// This file runs at build time only (scripts/build-letters.js writes the result to brush-paths.js).

// seeded random, so the brush texture is the same every build
export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Catmull-Rom spline through the points, sampled every `step` units
function spline(pts, step = 4) {
  const P = [pts[0], ...pts, pts[pts.length - 1]], out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(2, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// smooth noise along the stroke for a rough, hand-painted edge
function edgeNoise(n, rand, amp) {
  const keys = Array.from({ length: Math.ceil(n / 6) + 2 }, () => (rand() * 2 - 1) * amp);
  return (i) => { const a = i / 6, k = Math.floor(a), f = a - k; return keys[k] * (1 - f) + keys[k + 1] * f; };
}

const B = { width: 50, angle: 35, minRatio: 0.5, bristles: 0, tail: 0.4, rough: 1.7, taper: 0.22 };
const DRY = { bristles: 4, tail: 0.45, taper: 0, width: 24 };   // a fast thin stroke: the brush runs dry and splits
const STREAK = { bristles: 5, tail: 0.6, taper: 0.12 };         // a heavy stroke with dry streaks running inside it
const TEX = { bristles: 4, tail: 0.4, taper: 0.1 };              // a lighter dry texture toward the end of a stroke

// outline polygons for one stroke
// Drop points that don't change the outline by more than `tol` logo units (Ramer-Douglas-Peucker),
// so the files stay small. 1 unit is about a tenth of a pixel in the site header.
const SIMPLIFY = 1;
function simplify(pts, tol = SIMPLIFY) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    let far = -1, fd = tol;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / len; if (d > fd) { fd = d; far = i; } }
    if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

export function paint(points, o, rand) {
  const opt = { ...B, ...o };
  const pts = spline(points), n = pts.length;
  // direction, curvature limit
  const dir = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; });
  const nibA = (opt.angle * Math.PI) / 180, nib = [Math.cos(nibA), Math.sin(nibA)];
  const width = pts.map((p, i) => {
    const t = i / (n - 1);
    const across = Math.abs(dir[i][0] * nib[1] - dir[i][1] * nib[0]);          // brush is thinner moving along its own edge
    let w = opt.width * (opt.minRatio + (1 - opt.minRatio) * across);
    w *= t < 0.06 ? 0.75 + 0.25 * (t / 0.06) : 1;                              // presses in at the start
    if (opt.taper) w *= 1 - Math.max(0, (t - (1 - opt.taper)) / opt.taper) * 0.85; // lifts off at the end
    // keep tight curves from folding over themselves
    if (i > 2 && i < n - 3) {
      const a = pts[i - 3], b = pts[i], c = pts[i + 3];
      const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]), ac = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const area2 = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
      if (area2 > 1e-6) w = Math.min(w, 1.9 * (ab * bc * ac) / (2 * area2));
    }
    return w;
  });
  const normal = dir.map(([x, y]) => [-y, x]);
  const polys = [];
  const band = (i0, i1, off0, off1, wf, seedAmp) => { // a band across the stroke, from off0..off1 (fractions of width, -0.5..0.5)
    const nl = edgeNoise(n, rand, seedAmp), nr = edgeNoise(n, rand, seedAmp);
    const L = [], R = [];
    for (let i = i0; i <= i1; i++) {
      const w = width[i] * wf(i), p = pts[i], nm = normal[i];
      L.push([p[0] + nm[0] * (w * off1 + nl(i)), p[1] + nm[1] * (w * off1 + nl(i))]);
      R.push([p[0] + nm[0] * (w * off0 + nr(i)), p[1] + nm[1] * (w * off0 + nr(i))]);
    }
    polys.push([...simplify(L), ...simplify(R.reverse())]);
  };
  const k = opt.bristles;
  if (!k) { band(0, n - 1, -0.5, 0.5, () => 1, opt.rough); return polys; }      // a solid stroke
  const split = Math.floor(n * (1 - opt.tail));
  band(0, Math.min(n - 1, split + 4), -0.5, 0.5, () => 1, opt.rough);            // the solid body
  for (let b = 0; b < k; b++) {                                                  // the tail splits into bristles
    const gap = opt.bristles > 4 ? 0.012 + rand() * 0.03 : 0.02 + rand() * 0.04;
    const o0 = -0.5 + b / k, o1 = -0.5 + (b + 1) / k - gap;
    const end = Math.min(n - 1, Math.floor(n * (0.86 + rand() * 0.14)));
    band(split, end, o0, o1, (i) => 1 - Math.max(0, (i - split) / (end - split + 1)) * 0.25, opt.rough * 0.6);
  }
  return polys;
}

// ---------- the letters (y up, before slant). x-height 150, capitals 235 ----------
const X = 150;
const LETTERS = {
  H: { w: 150, s: [
    [[38, 238], [34, 160], [28, 60], [24, -2]],
    [[128, 242], [122, 140], [116, 50], [112, -4]],
    [[-6, 112], [60, 122], [130, 132], [176, 140]],                               // long crossbar, like the t in "salt"
  ], o: [STREAK, {}, DRY] },
  i: { w: 40, s: [
    [[22, X + 2], [18, 80], [14, 18], [20, 0], [34, 6]],
    [[16, 192], [26, 204]],
  ], o: [TEX, { width: 34, taper: 0.5 }] },
  d: { w: 104, s: [
    [[74, 120], [56, 146], [28, 136], [10, 86], [10, 30], [28, 2], [50, 8], [72, 50]],
    [[96, 262], [88, 150], [80, 40], [84, 0], [100, 8]],
  ], o: [{}, STREAK] },
  e: { w: 80, s: [
    [[12, 66], [48, 82], [64, 112], [50, 146], [22, 140], [6, 90], [10, 30], [32, 2], [66, 14]],
  ], o: [{ bristles: 4, tail: 0.3, taper: 0 }] },
  n: { w: 100, s: [
    [[18, X + 4], [16, 80], [14, -2]],
    [[18, 96], [36, 140], [62, 150], [80, 120], [80, 40], [84, 2], [100, 10]],
  ], o: [TEX, {}] },
  T: { w: 120, s: [
    [[-14, 222], [50, 232], [120, 240], [170, 248]],
    [[78, 238], [72, 140], [64, 50], [58, -4]],
  ], o: [DRY, STREAK] },
  m: { w: 150, s: [
    [[18, X + 4], [16, 80], [14, -2]],
    [[18, 104], [34, 142], [54, 150], [66, 124], [66, 50], [64, -2]],
    [[66, 106], [84, 142], [104, 150], [118, 120], [118, 40], [122, 2], [138, 10]],
  ], o: [TEX, {}, {}] },
  s: { w: 76, s: [
    [[70, 136], [50, 152], [22, 144], [12, 116], [30, 90], [58, 68], [66, 34], [48, 6], [18, 0], [-4, 22]],
  ], o: [{ bristles: 4, tail: 0.32, taper: 0.05 }] },
};
const SPACING = { H: -6, i: 4, d: 6, e: 6, n: -12, T: -10, m: 6, s: 8 };

const SLANT = 7;    // degrees of extra lean: the strokes already lean ~3°, so the letters lean ~10°, like the badge
const WIDE = 1.22;  // horizontal room inside and around the letters
const TRACK = 16;   // extra space between letters
const SIZE = 1.1;   // overall size (the strokes above are drawn at capital height ~240)
const SEED = 7;     // brush texture

// ---------- turn the strokes into the shapes the logo uses ----------
// One entry per letter, drawn at pen position x = 0 with the baseline at y = 272 (SVG, y down):
// advance = how far the next letter starts; inkLeft / inkRight = where the ink starts and ends.
const BASELINE = 272;
const rand = rng(SEED), tan = Math.tan((SLANT * Math.PI) / 180);
let top = 0;
export const WORDMARK = [...'HiddenTimes'].map((ch) => {
  const L = LETTERS[ch];
  let d = '', x0 = Infinity, x1 = -Infinity;
  L.s.forEach((stroke, k) => {
    for (const poly of paint(stroke.map(([a, b]) => [a * WIDE, b]), L.o?.[k] || {}, rand)) {
      d += 'M' + poly.map(([px, py]) => {
        const sx = (px + py * tan) * SIZE, sy = py * SIZE;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); top = Math.max(top, sy);
        return `${Math.round(sx)} ${Math.round(BASELINE - sy)}`;
      }).join('L') + 'Z';
    }
  });
  return { ch, d, advance: ((L.w + (SPACING[ch] || 0)) * WIDE + TRACK) * SIZE, inkLeft: +x0.toFixed(1), inkRight: +x1.toFixed(1), kern: 0 };
});

// Height of the tallest shape above the baseline (the ascender of the d).
export const WORDMARK_TOP = +top.toFixed(1);
export const WORDMARK_CAP = Math.round(240 * SIZE);

// The size letter-spacing (SPACING.tracking in shapes.js) is measured against, like a font's em.
export const WORDMARK_EM = 300;

// ---------- the symbol in the badge, painted with the same brush ----------
// The loop becomes two brush strokes, each starting heavy and running dry, overlapping where they meet.
function sampleLoop(d, step = 5) {
  const pts = []; let cur, start;
  for (const seg of d.match(/[MLQZ][^MLQZ]*/g)) {
    const n = seg.slice(1).trim().split(/\s+/).filter(Boolean).map(Number);
    const to = (x, y) => { const k = Math.max(1, Math.ceil(Math.hypot(x - cur[0], y - cur[1]) / step));
      for (let i = 1; i <= k; i++) pts.push([cur[0] + (x - cur[0]) * i / k, cur[1] + (y - cur[1]) * i / k]); cur = [x, y]; };
    if (seg[0] === 'M') { cur = n; start = n; pts.push(n); }
    else if (seg[0] === 'L') to(n[0], n[1]);
    else if (seg[0] === 'Q') { const [cx, cy, x, y] = n, a = cur, k = 16;
      for (let i = 1; i <= k; i++) { const t = i / k, u = 1 - t; pts.push([u * u * a[0] + 2 * u * t * cx + t * t * x, u * u * a[1] + 2 * u * t * cy + t * t * y]); } cur = [x, y]; }
    else to(start[0], start[1]);
  }
  return pts;
}
const SYMBOL_BRUSH_STYLE = { width: 40, minRatio: 0.72, bristles: 5, tail: 0.45, taper: 0.1, rough: 1.8 };
export function symbolBrush(symbolD, style = {}) {
  const loop = sampleLoop(symbolD), n = loop.length;
  // start each stroke on the straight left and right sides, so the overlaps fall on straight runs
  const near = (x, y) => loop.reduce((b, p, i) => (Math.hypot(p[0] - x, p[1] - y) < Math.hypot(loop[b][0] - x, loop[b][1] - y) ? i : b), 0);
  const cy = (Math.min(...loop.map((p) => p[1])) + Math.max(...loop.map((p) => p[1]))) / 2;
  const left = near(121, cy), right = near(354, cy);
  const run = (a, b) => { const out = []; for (let i = a; ; i = (i + 1) % n) { out.push(loop[i]); if (i === b) break; } return out; };
  const over = Math.round(n * 0.06);
  const rand = rng(11);
  const strokes = [run(left, (right + over) % n), run(right, (left + over) % n)];
  return strokes.map((s) => paint(s, { ...SYMBOL_BRUSH_STYLE, ...style }, rand)
    .map((poly) => 'M' + poly.map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join('L') + 'Z').join('')).join('');
}

// ---------- the badge: an open brush ring (ensō) around the symbol ----------
// One stroke around the circle, heavy at the start and running dry at the end, left a little open.
// Returns the painted ring and its guide line (the "draw" animation reveals the paint along it).
const RING_STYLE = { width: 54, minRatio: 0.7, bristles: 7, tail: 0.4, taper: 0.1, rough: 3 };
export function ensoBrush(cx, cy, r, { start = -100, sweep = 330, seed = 5, lean = (p) => p, style = {} } = {}) {
  const pts = [];
  for (let a = 0; a <= sweep; a += 10) { const t = ((a + start) * Math.PI) / 180; pts.push(lean([cx + r * Math.cos(t), cy + r * Math.sin(t)])); }
  const fmt = (p) => `${Math.round(p[0])} ${Math.round(p[1])}`;
  return {
    d: paint(pts, { ...RING_STYLE, ...style }, rng(seed)).map((poly) => 'M' + poly.map(fmt).join('L') + 'Z').join(''),
    guide: 'M' + pts.map(fmt).join('L'),
  };
}

// For tiny sizes (the browser-tab icon): the same ring and symbol painted with a solid brush,
// no dry streaks and a little heavier, so they stay crisp at 16 pixels.
export const SMALL_STYLE = { bristles: 0, rough: 1, taper: 0.05, minRatio: 0.85 };
