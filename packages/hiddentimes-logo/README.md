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

**Colours:** override any of the four colours.

```css
ht-logo {
  --ht-ink: #0b1056;      /* HIDDENTIMES letters */
  --ht-accent: #F2A603;   /* tagline */
  --ht-mark-bg: #0b1056;  /* badge */
  --ht-mark-fg: #ffffff;  /* symbol inside the badge */
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
| `mark-light-256.png` | phone home-screen icon (rendered from `mark-light.svg`) |

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
  tracking: 0.12,      // letter-spacing of HIDDENTIMES, in ems (like CSS letter-spacing)
  markGap: 80,         // between the badge and the text
  taglineGap: 56,      // between HIDDENTIMES and the tagline
  taglineTracking: 20, // extra space between tagline letters
  taglineWordGap: 24,  // extra space between tagline words
};
```

For scale, the letters are 203 units tall (`WORDMARK_CAP` in `src/wordmark-paths.js`); the round badge is about 453. Other changes you can make:

- **Perfect circle:** the original badge is very slightly oval. Set `rx` and `ry` in `CIRCLE` to the same value.
- **Thinner or thicker symbol:** change `SYMBOL.strokeWidth`.
- **Brand colours:** change `THEMES` in `src/render.js`.

### The HIDDENTIMES letters

HIDDENTIMES is set in **Archivo Light**, the website's own sans-serif, so the logo matches the page. The letters are stored as shapes in `src/wordmark-paths.js`, taken from the font's own outlines with their normal letter widths and kerning, so the logo looks the same everywhere, even where web fonts can't load. Archivo is free (SIL Open Font License). To change the weight or the typeface, regenerate that file from another font file with a tool such as `opentype.js`.

**Saved alternative:** a version with **HIDDEN** in Archivo Bold and TIMES in Archivo Light is kept in Git under the tag `logo-bold-hidden`. To bring back its letters:

```
git checkout logo-bold-hidden -- packages/hiddentimes-logo/src/wordmark-paths.js
```

Then set `tracking: 0.06` in `src/shapes.js` and run `npm run build`.

### Changing the tagline

The tagline letters are stored as shapes, so the logo looks the same everywhere, even where fonts can't load. The font is Montserrat ExtraBold Italic, which is free (SIL Open Font License). To use different words, regenerate `src/tagline-paths.js` from the font with a tool such as `opentype.js`, or ask your developer.

## Files

```
index.js              entry point (renderLogo, THEMES, shapes)
src/shapes.js         ← the logo's geometry; edit here
src/tagline-paths.js  tagline letter shapes (generated)
src/render.js         builds the SVG + colour themes
src/element.js        the <ht-logo> element + animations
scripts/build.js      writes dist/*.svg
dist/                 ready-made SVG files
demo.html             live playground
```
