// Getting a photo ready to post, on the phone:
//   full  WebP, 2400px or smaller on the long side (the same rule as /admin)
//   thumb WebP, 960px wide or smaller, for the feed
//
// Redrawing the photo on a canvas also drops its EXIF data, GPS location
// included, so nothing private rides along. WebP comes from the browser
// where it can encode it, and from a WebAssembly encoder in a worker where
// it can't (Safari).

const FULL_MAX = 2400;
const THUMB_WIDTH = 960;
const FULL_QUALITY = 85;  // as /admin's media settings
const THUMB_QUALITY = 80;

export class PhotoError extends Error {}

// ---- Decoding --------------------------------------------------------------
async function decode(file) {
  try {
    // from-image: turn the photo the way the camera meant it.
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Some formats (HEIC outside Safari, odd JPEGs) only decode in an <img>.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } catch {
      throw new PhotoError("Couldn't read this photo. Try another one, or take a screenshot of it and post that.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

const sizeOf = (source) => ({
  width: source.naturalWidth || source.width,
  height: source.naturalHeight || source.height,
});

// Fit inside max × max (or max wide, for the thumb), never enlarging.
function fit({ width, height }, maxWidth, maxHeight = maxWidth) {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function draw(source, { width, height }) {
  const canvas = typeof OffscreenCanvas === 'function'
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

// ---- Encoding --------------------------------------------------------------
const toBlob = (canvas, type, quality) => (canvas.convertToBlob
  ? canvas.convertToBlob({ type, quality })
  : new Promise((resolve) => canvas.toBlob(resolve, type, quality)));

let worker = null;
let nextId = 0;
const waiting = new Map();

function encoder() {
  if (worker) return worker;
  worker = new Worker(new URL('./encode-worker.js', import.meta.url), { type: 'module' });
  worker.addEventListener('message', ({ data }) => {
    const job = waiting.get(data.id);
    waiting.delete(data.id);
    if (data.error) job?.reject(new Error(data.error));
    else job?.resolve(new Blob([data.webp], { type: 'image/webp' }));
  });
  worker.addEventListener('error', () => {
    for (const job of waiting.values()) job.reject(new Error('The WebP encoder failed to load.'));
    waiting.clear();
    worker = null;
  });
  return worker;
}

function encodeInWorker(canvas, quality) {
  const { width, height } = canvas;
  const pixels = canvas.getContext('2d').getImageData(0, 0, width, height).data.buffer;
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    encoder().postMessage({ id, width, height, pixels, quality }, [pixels]);
  });
}

async function webp(canvas, quality, { native = true } = {}) {
  const blob = native ? await toBlob(canvas, 'image/webp', quality / 100).catch(() => null) : null;
  if (blob?.type === 'image/webp') return blob;   // Safari returns PNG here
  return encodeInWorker(canvas, quality);
}

// ---- The whole job --------------------------------------------------------------
/**
 * { full, thumb, width, height } from a picked photo.
 * { native: false } skips the browser's own encoder (to test the worker).
 */
export async function preparePhoto(file, { native = true } = {}) {
  const source = await decode(file);
  try {
    const fullSize = fit(sizeOf(source), FULL_MAX);
    const fullCanvas = draw(source, fullSize);
    // The thumb comes from the 2400px copy, which downscales more cleanly
    // than going straight from a 12-megapixel original.
    const thumbCanvas = draw(fullCanvas, fit(fullSize, THUMB_WIDTH, Infinity));
    const [full, thumb] = await Promise.all([
      webp(fullCanvas, FULL_QUALITY, { native }),
      webp(thumbCanvas, THUMB_QUALITY, { native }),
    ]);
    return { full, thumb, width: fullSize.width, height: fullSize.height };
  } catch (err) {
    if (err instanceof PhotoError) throw err;
    throw new PhotoError("Couldn't get this photo ready to post. Try again, or pick another photo.");
  } finally {
    source.close?.();
  }
}
