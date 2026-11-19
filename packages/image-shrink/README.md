# @hiddentimes/image-shrink

Makes photos small enough to upload, right in the browser, before they're sent. It has no dependencies.

```js
import { shrinkImage, formatBytes } from '/image-kit/src/index.js';

const r = await shrinkImage(file);
// r.file  → ready to upload (File)
// r.changed, r.width, r.height, r.originalSize, r.size, r.type, r.quality
console.log(`${formatBytes(r.originalSize)} → ${formatBytes(r.size)}`);
```

## How it keeps quality

1. **Leaves small images alone.** An image that already fits the size and dimensions is returned untouched, with zero loss.
2. **Resizes only as much as needed.** Large images are scaled to 2,400 px on the long side by default, which is sharp even on retina screens. A cover is never shown larger than about 1,000 px (2,000 on retina).
3. **Saves at high quality.** It uses WebP at quality 0.9, which looks the same as the original. Quality only steps down (0.85, 0.80…) if the file is still too big, and never below `minQuality`. After that it shrinks the dimensions a little instead.
4. **Keeps detail crisp.** Downscaling happens in halving steps, so edges and fine texture don't blur.

**Also:** phone photos are turned the right way up, transparent PNGs keep their transparency, and hidden photo data (GPS location, camera model) is removed. Animated GIFs are passed through unchanged, because a canvas would freeze them.

## Options

| Option | Default | Meaning |
|---|---|---|
| `maxWidth` / `maxHeight` | `2400` | largest dimensions in pixels |
| `maxBytes` | `3.5 MB` | the file is guaranteed to end up under this |
| `quality` | `0.9` | starting quality, 0 to 1 |
| `minQuality` | `0.7` | quality never goes lower than this |
| `type` | `'auto'` | `'auto'` (WebP, or JPEG on old browsers), `'image/webp'` or `'image/jpeg'` |
| `keepIfFits` | `true` | return the original file when it's already small enough |

## Self-test

With the site running, open `/image-kit/test.html`. It checks a 6000×4000 photo, a small photo (left untouched), a transparent PNG, a tight 300 KB limit and a non-image file.

## Errors

Errors are thrown as `ShrinkError` with a message you can show to people directly, for example "Please choose a JPG, PNG, WebP or GIF image."
