// WebP encoding off the main thread, for browsers that can't encode WebP
// themselves (Safari: canvas silently hands back a PNG). Uses Squoosh's
// libwebp build, vendored in vendor/jsquash-webp/ (npm run vendor).
//
// In:  { id, width, height, pixels: ArrayBuffer (RGBA), quality }
// Out: { id, webp: ArrayBuffer } or { id, error }

import encode from '../vendor/jsquash-webp/encode.js';

self.addEventListener('message', async ({ data }) => {
  const { id, width, height, pixels, quality } = data;
  try {
    const image = new ImageData(new Uint8ClampedArray(pixels), width, height);
    const webp = await encode(image, { quality });
    self.postMessage({ id, webp }, [webp]);
  } catch (err) {
    self.postMessage({ id, error: err?.message || String(err) });
  }
});
