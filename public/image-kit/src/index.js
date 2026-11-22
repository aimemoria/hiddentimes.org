// @hiddentimes/image-shrink
// Makes photos small enough to upload, in the browser, before they are sent.
//
//   import { shrinkImage } from '/image-kit/src/index.js';
//   const result = await shrinkImage(file);          // result.file is ready to upload
//
// How it keeps quality:
//   1. Images that already fit (size and dimensions) are returned untouched, so there's no loss at all.
//   2. Big images are scaled down only to the size screens actually need (default 2400 px, sharp on retina).
//   3. They're saved at high quality (WebP 0.9, visually lossless). Quality only steps down if the
//      file is still over the byte limit, and never below `minQuality`.
//   4. Downscaling is done in halving steps, which keeps edges and fine detail crisp.
// Bonus: phone photos are turned the right way up, and hidden data (GPS location, camera info) is removed.

const DEFAULTS = {
  maxWidth: 2400,
  maxHeight: 2400,
  maxBytes: 3.5 * 1024 * 1024, // fits under a 4 MB upload limit with room to spare
  quality: 0.9,                // starting quality (0–1); 0.9 is visually lossless for photos
  minQuality: 0.7,             // never go below this; shrink dimensions instead
  type: 'auto',                // 'auto' (WebP, or JPEG where WebP isn't supported) | 'image/webp' | 'image/jpeg'
  keepIfFits: true,            // return the original file when it's already small enough
};

const DECODABLE = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/bmp'];

export class ShrinkError extends Error {}

/**
 * @param {File|Blob} file
 * @param {Partial<typeof DEFAULTS>} [options]
 * @returns {Promise<{ file: File, changed: boolean, width: number, height: number,
 *                     originalSize: number, size: number, type: string, quality: number|null }>}
 */
export async function shrinkImage(file, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const name = file.name || 'image';

  // Animated GIFs would lose their animation on a canvas: pass them through.
  if (file.type === 'image/gif') {
    if (file.size > o.maxBytes) throw new ShrinkError(`This GIF is ${formatBytes(file.size)}. Please use one under ${formatBytes(o.maxBytes)}.`);
    return passThrough(file);
  }
  if (file.type && !DECODABLE.includes(file.type)) {
    throw new ShrinkError('Please choose a JPG, PNG, WebP or GIF image.');
  }

  const bitmap = await decode(file);
  const { width: w0, height: h0 } = bitmap;
  const scale = Math.min(1, o.maxWidth / w0, o.maxHeight / h0);

  // Already fits: don't touch it.
  if (o.keepIfFits && scale === 1 && file.size <= o.maxBytes && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    close(bitmap);
    return passThrough(file, w0, h0);
  }

  const outType = o.type === 'auto' ? ((await supportsWebp()) ? 'image/webp' : 'image/jpeg') : o.type;
  let width = Math.max(1, Math.round(w0 * scale));
  let height = Math.max(1, Math.round(h0 * scale));
  let canvas = resize(bitmap, width, height);
  close(bitmap);

  // JPEG has no transparency: put a white background behind see-through pixels.
  if (outType === 'image/jpeg' && hasTransparency(canvas)) canvas = flatten(canvas);

  // Find the highest quality that fits; if even minQuality is too big, shrink a bit and retry.
  // Highest quality that fits at the current size. Usually the first try (o.quality) already fits.
  // Otherwise a short binary search between minQuality and quality. null = doesn't fit even at minQuality.
  const fitQuality = async () => {
    const top = await encode(canvas, outType, o.quality);
    if (top.size <= o.maxBytes) return { blob: top, quality: o.quality };
    const floor = await encode(canvas, outType, o.minQuality);
    if (floor.size > o.maxBytes) return { blob: null, floorSize: floor.size };
    let lo = o.minQuality, hi = o.quality, best = { blob: floor, quality: o.minQuality };
    for (let i = 0; i < 3; i++) {
      const mid = +((lo + hi) / 2).toFixed(3);
      const b = await encode(canvas, outType, mid);
      if (b.size <= o.maxBytes) { best = { blob: b, quality: mid }; lo = mid; } else hi = mid;
    }
    return best;
  };

  let fit = await fitQuality();
  for (let round = 0; !fit.blob && round < 6; round++) {
    // too big even at minQuality: file size grows with pixel count, so scale by √(target / size), with a margin
    const f = Math.max(0.5, Math.min(0.92, Math.sqrt(o.maxBytes / fit.floorSize) * 0.95));
    width = Math.max(1, Math.round(width * f));
    height = Math.max(1, Math.round(height * f));
    canvas = resize(canvas, width, height);
    fit = await fitQuality();
  }
  if (!fit.blob) throw new ShrinkError("Couldn't make this image small enough. Please choose a smaller photo.");
  const { blob, quality } = fit;

  // If re-saving didn't help, the original is better.
  if (o.keepIfFits && scale === 1 && file.size <= blob.size && file.size <= o.maxBytes) return passThrough(file, w0, h0);

  const ext = outType === 'image/webp' ? '.webp' : '.jpg';
  const out = new File([blob], name.replace(/\.[^.]+$/, '') + ext, { type: outType, lastModified: Date.now() });
  return { file: out, changed: true, width, height, originalSize: file.size, size: out.size, type: outType, quality };
}

/** "6.2 MB", "480 KB" */
export function formatBytes(n) {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1).replace(/\.0$/, '') + ' MB';
  return Math.max(1, Math.round(n / 1024)) + ' KB';
}

// ---------- internals ----------

const passThrough = (file, width = 0, height = 0) =>
  ({ file, changed: false, width, height, originalSize: file.size, size: file.size, type: file.type, quality: null });

async function decode(file) {
  try {
    // 'from-image' applies the phone's rotation flag (EXIF orientation)
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // older browsers: decode through an <img>
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } catch {
      throw new ShrinkError("This image couldn't be opened. Try saving it as JPG or PNG first.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

const close = (b) => { if (b && typeof b.close === 'function') b.close(); };

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Downscale in halving steps (each step at most 2×), which keeps detail sharp.
function resize(source, width, height) {
  let sw = source.width, sh = source.height;
  let current = source;
  while (sw / 2 >= width && sh / 2 >= height) {
    sw = Math.round(sw / 2); sh = Math.round(sh / 2);
    current = draw(current, sw, sh);
  }
  return draw(current, width, height);
}

function draw(source, w, h) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  return c;
}

function hasTransparency(canvas) {
  // check a downsized copy, which is fast even for big images
  const probe = draw(canvas, Math.min(256, canvas.width), Math.min(256, canvas.height));
  const data = probe.getContext('2d').getImageData(0, 0, probe.width, probe.height).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}

function flatten(canvas) {
  const c = makeCanvas(canvas.width, canvas.height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(canvas, 0, 0);
  return c;
}

const encode = (canvas, type, quality) => new Promise((resolve, reject) =>
  canvas.toBlob((b) => (b ? resolve(b) : reject(new ShrinkError('Could not save the image.'))), type, quality));

let webpSupport;
async function supportsWebp() {
  if (webpSupport !== undefined) return webpSupport;
  const b = await new Promise((r) => makeCanvas(1, 1).toBlob(r, 'image/webp', 0.8));
  webpSupport = Boolean(b && b.type === 'image/webp');
  return webpSupport;
}
