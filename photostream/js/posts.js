// One list of posts from two sources:
// - the site's /photos.json: everything published, including sets made in
//   /admin, with ready-made image sizes
// - the private library: everything posted from Photostream
//
// A post in both is live. It shows the site's copy, so edits made in /admin
// appear here too. A post only in the library is private, or publishing
// if it's on its way to the site.

import { config } from './config.js';
import { parseDate } from './format.js';
import { loadJSON, saveJSON } from './saved.js';

const SAVED_SITE = 'site-posts.json';

/** Published posts from the site; also saved on the phone for next time. */
export async function fetchSitePosts() {
  const res = await fetch(config.site.feed, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`photos.json: ${res.status}`);
  const data = await res.json();
  const posts = Array.isArray(data.posts) ? data.posts : [];
  await saveJSON(SAVED_SITE, posts);
  return posts;
}

/** Published posts as last seen, or null. */
export const savedSitePosts = () => loadJSON(SAVED_SITE);

const fromSite = (post) => ({
  id: post.id,
  title: post.title,
  description: post.description || '',
  date: parseDate(post.date),
  location: post.location || '',
  topics: post.topics || [],
  status: 'live',
  photos: (post.photos || []).map((photo) => ({
    source: 'site',
    src: photo.src,
    srcset: photo.srcset,
    width: photo.width,
    height: photo.height,
    alt: photo.alt || '',
  })),
});

const fromLibrary = (post) => ({
  id: post.id,
  title: post.title,
  description: post.description || '',
  date: parseDate(post.date),
  location: post.location || '',
  topics: post.topics || [],
  status: post.publish ? 'publishing' : 'private',
  photos: (post.photos || []).map((photo) => ({
    source: 'library',
    file: photo.file,
    thumb: photo.thumb,
    width: photo.width,
    height: photo.height,
    alt: photo.alt || '',
  })),
});

/** Newest first. Posts with no usable photo are left out. */
export function mergePosts(sitePosts = [], libraryPosts = []) {
  const byId = new Map();
  for (const post of libraryPosts) byId.set(post.id, fromLibrary(post));
  for (const post of sitePosts) byId.set(post.id, fromSite(post));
  return [...byId.values()]
    .filter((post) => post.photos.length && !Number.isNaN(post.date.getTime()))
    .sort((a, b) => b.date - a.date || b.id.localeCompare(a.id));
}

/** Every tag, most recently used first (posts are newest first), so today's
    event is at the front. */
export const tagsByRecency = (posts) => [...new Set(posts.flatMap((post) => post.topics))];
