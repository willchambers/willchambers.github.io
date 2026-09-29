// The private library, read through the GitHub API with the user's token.
//
// Layout of the library branch (see README.md):
//   index.json          every post, newest first: what the feed reads
//   posts/<id>.md       each post in the site's photo-set format
//   photos/<id>.webp    the photo, 2400px or smaller
//   thumbs/<id>.webp    960px copy for the feed

import { config } from './config.js';
import { readRaw } from './github.js';
import { forgetJSON, loadJSON, saveJSON } from './saved.js';

const IMAGE_CACHE = 'photostream-library-v1';
const SAVED_INDEX = 'library-index.json';

/** The library's posts from GitHub; also saved on the phone for next time. */
export async function fetchLibraryIndex(token) {
  const res = await readRaw(config.library, 'index.json', token, { cache: 'no-store' });
  const data = await res.json();
  const posts = Array.isArray(data.posts) ? data.posts : [];
  await saveJSON(SAVED_INDEX, posts);
  return posts;
}

/** The library's posts as last seen, or null. */
export const savedLibraryIndex = () => loadJSON(SAVED_INDEX);

// Library files are fetched with the token, so they can't go straight into an
// <img src>. Each one is downloaded once, kept in Cache Storage under a URL
// inside the app's scope (/photostream/__library/…), and handed out as an
// object URL.
const cacheKey = (path) => new URL(`../__library/${path}`, import.meta.url).href;
const openCache = () => ('caches' in self ? caches.open(IMAGE_CACHE).catch(() => null) : null);

export async function libraryImageUrl(path, token) {
  const cache = await openCache();
  let res = await cache?.match(cacheKey(path));
  if (!res) {
    // GitHub's raw responses aren't typed as images; store them as WebP.
    const bytes = await (await readRaw(config.library, path, token)).arrayBuffer();
    res = new Response(new Blob([bytes], { type: 'image/webp' }), {
      headers: { 'Content-Type': 'image/webp' },
    });
    await cache?.put(cacheKey(path), res.clone());
  }
  return URL.createObjectURL(await res.blob());
}

/** Remove everything private from the phone (used when the token is removed). */
export async function forgetLibrary() {
  await forgetJSON(SAVED_INDEX);
  if ('caches' in self) await caches.delete(IMAGE_CACHE).catch(() => {});
}
