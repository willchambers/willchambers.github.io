// One list of posts from two sources:
// - the site's /photos.json: everything published, including sets made in
//   /admin, with ready-made image sizes
// - the private library: everything posted from Photostream
//
// A post in both is live. It shows the site's copy, so edits made in /admin
// appear here too. A post only in the library is private, publishing if
// it's on its way to the site, or failed if publishing it didn't work
// (js/publishing.js remembers which).

import { config } from './config.js';
import { parseDate } from './format.js';
import { GIVE_UP_AFTER, publishing } from './publishing.js';
import { loadJSON, saveJSON } from './saved.js';

const SAVED_SITE = 'site-posts.json';

/** Published posts from the site; also saved on the phone for next time. */
export async function fetchSitePosts() {
  // GitHub Pages' CDN keeps files for up to 10 minutes; a fresh query string
  // asks for the current build, so a new post shows up a minute after it's
  // merged rather than ten.
  const res = await fetch(`${config.site.feed}?t=${Date.now()}`, { cache: 'no-store' });
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

const STOPPED = "Publishing stopped before it finished, probably because the app closed.";
const SLOW = "This post was sent to the site but hasn't appeared there yet.";

// { status, error } for a post that's only in the library.
function libraryState(post, record, siteIsFresh) {
  if (record?.state === 'failed') return { status: 'failed', error: record.error };
  if (record) {
    if (publishing.onItsWay(post.id, record)) return { status: 'publishing' };
    return { status: 'failed', error: record.merged ? SLOW : STOPPED };
  }
  if (!post.publish) return { status: 'private' };
  // Meant for the site, but this phone has no record of it being published.
  // Only call that stopped against an up-to-date site feed. (new Date reads
  // the wall-clock time as local here, which is what an age needs.)
  const stale = siteIsFresh && Date.now() - new Date(post.date).getTime() > GIVE_UP_AFTER;
  return stale ? { status: 'failed', error: STOPPED } : { status: 'publishing' };
}

const fromLibrary = (post, record, siteIsFresh) => ({
  id: post.id,
  title: post.title,
  description: post.description || '',
  date: parseDate(post.date),
  location: post.location || '',
  topics: post.topics || [],
  error: '',
  ...libraryState(post, record, siteIsFresh),
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
export function mergePosts(sitePosts = [], libraryPosts = [], records = {}, { siteIsFresh = false } = {}) {
  const byId = new Map();
  for (const post of libraryPosts) byId.set(post.id, fromLibrary(post, records[post.id], siteIsFresh));
  for (const post of sitePosts) byId.set(post.id, fromSite(post));
  return [...byId.values()]
    .filter((post) => post.photos.length && !Number.isNaN(post.date.getTime()))
    .sort((a, b) => b.date - a.date || b.id.localeCompare(a.id));
}

/** Every tag, most recently used first (posts are newest first), so today's
    event is at the front. */
export const tagsByRecency = (posts) => [...new Set(posts.flatMap((post) => post.topics))];
