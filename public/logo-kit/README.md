# @hiddentimes/logo

The HiddenTimes logo, drawn entirely in code. It was rebuilt from the original artwork and matches it at about 98% pixel by pixel.

- **Always sharp**: it's vector, so it stays crisp from a favicon to a billboard.
- **Changes colour**: switches automatically between light and dark backgrounds, or takes any colours you choose.
- **Easy to animate**: the badge, the symbol, every letter and every tagline letter are separate pieces.
- **Small**: about 11 KB for the full logo.

See it live at **`/logo-kit/demo.html`** while the site is running.

---

## 1. On a web page (easiest)

```html
<script type="module" src="/logo-kit/src/element.js"></script>

<ht-logo></ht-logo>
```

| Attribute | Values | Default |
|---|---|---|
| `variant` | `full` · `mark` (badge only) · `wordmark` (letters only) | `full` |
| `tagline` | `false` hides "Discover the Unknown" | shown |
| `theme`   | `light` · `dark` · `mono` (one colour, follows CSS `color`) · `auto` (reads the background behind it) · `system` (follows the device's dark mode) | `light` |
| `animate` | any of `draw` `reveal` `hover` `loop`, separated by spaces | none |
| `label`   | the name screen readers announce | `HiddenTimes` |

```html
<ht-logo theme="auto" animate="draw hover"></ht-logo>   <!-- the site header uses this -->
<ht-logo variant="mark" theme="dark"></ht-logo>
<ht-logo variant="mark" animate="loop"></ht-logo>       <!-- loading indicator -->
```

**Size:** set a height in CSS. The width follows.

```css
ht-logo { height: 48px; }
```

**Colours:** override any of the three colours.

```css
ht-logo {
  --ht-ink: #0b1056;      /* HIDDENTIMES letters */
  --ht-accent: #F2A603;   /* tagline */
  --ht-mark-bg: #0b1056;  /* badge: the brush ring and the symbol */
}
```

**Your own animation:** style the pieces from outside with `::part()`. Each letter has `--i`, its position number, for staggered timing.

```css
ht-logo::part(letter) {
  animation: wave 1.6s calc(var(--i) * 90ms) ease-in-out infinite;
  transform-box: fill-box;
}
@keyframes wave { 50% { transform: translateY(-10%); } }
```

Pieces: `svg`, `mark`, `circle`, `symbol`, `wordmark`, `letter`, `tagline`, `tagline-letter`.

**From JavaScript:**

```js
const logo = document.querySelector('ht-logo');
logo.replay();                      // play the entrance animation again
logo.setAttribute('theme', 'dark'); // colours change without restarting animations
logo.refresh();                     // with theme="auto": re-read the background after you change it
```

Animations are switched off automatically for people whose device is set to reduce motion.

## 2. As image files

The `dist/` folder has ready-made SVG files for anywhere that takes a normal image: social media, documents, email signatures, print.

| File | Use on |
|---|---|
| `logo-light.svg` / `logo-dark.svg` | light / dark backgrounds |
| `logo-light-no-tagline.svg` / `logo-dark-no-tagline.svg` | small spaces |
| `mark-light.svg` / `mark-dark.svg` / `mark-mono.svg` | profile pictures, favicons, app icons |
| `wordmark-light.svg` / `wordmark-dark.svg` | where the badge is shown separately |
| `logo-mono.svg` | one-colour printing, stamps, engraving |
| `favicon.svg` | browser-tab icon: the badge with a solid brush (no dry streaks, which turn to noise at 16 px) on a white rounded square, visible on light and dark tab bars |
| `mark-light-256.png` | phone home-screen icon (rendered from `mark-light.svg` on white) |
| `brush-underline.svg` | a short brush stroke the website uses (as a CSS mask, coloured yellow) for the active-menu underline and the dash on text-only story cards, so the pages match the logo |

After changing anything in `src/`, rebuild the files with:

```
npm run build
```

## 3. From JavaScript or Node

```js
import { renderLogo } from './index.js';

const svg = renderLogo({ variant: 'full', theme: 'dark', tagline: true, height: 64 });
// or your own colours:
renderLogo({ theme: { ink: '#fff', accent: '#F2A603', markBg: '#F2A603', markFg: '#000' } });
```

---

## Changing the design

All the geometry is in **`src/shapes.js`**, with comments.

**Spacing:** change `SPACING` near the bottom of the file. Everything else repositions itself: the letters, the badge centring and the crop.

```js
export const SPACING = {
  tracking: 0,         // letter-spacing of the name, in ems (like CSS letter-spacing)
  markGap: 80,         // between the badge and the text
  taglineGap: 56,      // between HIDDENTIMES and the tagline
  taglineTracking: 20, // extra space between tagline letters
  taglineWordGap: 24,  // extra space between tagline words
};
```

For scale, the letters are about 265 units tall (the d reaches 290); the round badge is about 453. Other changes you can make:

- **Badge ring:** its brush is `RING_STYLE` and its shape `ensoBrush()` (start angle, how far round it goes, texture seed) in `src/letters-design.js`.
- **Symbol size inside the ring:** `SYMBOL_SCALE` in `src/symbol-path.js`.
- **Thinner or thicker symbol:** change `width` in `SYMBOL_BRUSH_STYLE` (in `src/letters-design.js`).
- **Brand colours:** change `THEMES` in `src/render.js`.

### The HiddenTimes letters and the brush-painted symbol

**HiddenTimes** is our own **dry-brush lettering**, drawn for this logo. It's not a font, so there's no font file or licence. The letters stand upright, with even space between them, and the name is one word.

Each letter is a few brush strokes. The brush presses in heavily at the start and runs dry toward the end, where the stroke breaks into bristle streaks. The edges are rough, like paint on paper. The thin bars of the H and the T are fast, dry strokes that sweep past their letters.

The **badge** is an open **brush ring** (an ensō), one stroke that starts heavy and runs dry, with a small gap left open, like something still to be discovered. The **symbol** inside is painted with the same brush, as two strokes that overlap where they meet. Ring, symbol and letters are all brush strokes in the same ink, so the whole logo reads as one painting. The "draw" animation paints the ring around and the symbol in.

**How it's built:**
- `src/letters-design.js` holds the design: the brush settings (`B`, `DRY`, `STREAK`, `TEX`), the layout numbers (`SLANT`, `WIDE`, `TRACK`, `SIZE`), each letter's stroke points, and `SEED`, which fixes the texture so the logo is identical every time.
- `npm run build` paints everything once and writes the finished shapes to `src/brush-paths.js`, so browsers receive ready-made shapes and the logo appears instantly. Points that change the outline by less than `SIMPLIFY` (1 unit, about a tenth of a pixel in the header) are dropped, which keeps the full logo at about 10 KB compressed.
- Don't edit `brush-paths.js` by hand: change `letters-design.js` and run `npm run build`.

**Saved alternatives** are kept in Git under tags:

| Tag | Letters |
|---|---|
| `logo-archivo-medium` | HIDDENTIMES in Archivo Medium (sans-serif) |
| `logo-bold-hidden` | **HIDDEN** in Archivo Bold, TIMES in Archivo Light |

To bring one back (for example the Archivo Medium version):

```
git checkout logo-archivo-medium -- packages/hiddentimes-logo/src
```

Then run `npm run build`. Those versions used font outlines (`src/wordmark-paths.js`) instead of `src/letters-design.js`, which can then be deleted.

### Changing the tagline

The tagline letters are stored as shapes, so the logo looks the same everywhere, even where fonts can't load. The font is Montserrat ExtraBold Italic, which is free (SIL Open Font License). To use different words, regenerate `src/tagline-paths.js` from the font with a tool such as `opentype.js`, or ask your developer.

## Files

```
index.js              entry point (renderLogo, THEMES, shapes)
src/shapes.js         ← the logo's geometry; edit here
src/letters-design.js our own brush letters + brush for the symbol; edit here
src/brush-paths.js    the painted shapes (generated by npm run build)
src/symbol-path.js    the symbol's line (the brush follows it)
scripts/build-letters.js  paints letters-design.js into brush-paths.js
src/tagline-paths.js  tagline letter shapes (generated)
src/render.js         builds the SVG + colour themes
src/element.js        the <ht-logo> element + animations
scripts/build.js      writes dist/*.svg
dist/                 ready-made SVG files
demo.html             live playground
```
