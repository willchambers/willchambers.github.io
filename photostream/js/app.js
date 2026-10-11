// Photostream: start-up, the feed, and posting.
//
// The feed draws straight away from what's saved on the phone, then checks
// the network and updates in place: unchanged posts are kept as they are
// (their photos don't reload), and the post you're looking at stays put.
// A new post appears at once; while it's publishing the feed checks the
// site every few seconds until it's live.

import { initComposer } from './composer.js';
import { explain } from './github.js';
import { esc } from './format.js';
import {
  addToSavedIndex, cacheLibraryImage, fetchLibraryIndex, libraryImageUrl, savedLibraryIndex,
} from './library.js';
import { fetchSitePosts, mergePosts, savedSitePosts, tagsByRecency } from './posts.js';
import { observeLibraryImages, renderFilter, renderPost } from './feed.js';
import { libraryPhoto, publishToSite } from './publish.js';
import { publishing } from './publishing.js';
import { settings } from './settings.js';
import { initSettings } from './settings-sheet.js';
import { registerServiceWorker } from './sw-register.js';

const $ = (selector) => document.querySelector(selector);
const REFRESH_AFTER = 60_000;   // on returning to the app
const WATCH_EVERY = 8_000;      // while a post is publishing
const WATCH_FOR = 15 * 60_000;  // …for at most this long per post

// ---- Rendering ------------------------------------------------------------

// A short fingerprint of what a post shows, to tell whether it changed.
function fingerprint(value) {
  const text = JSON.stringify(value);
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

const fromHTML = (html) => {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
};

// Keep the first visible post at the same place on screen while the feed
// changes above it. (Safari doesn't anchor scrolling by itself.)
function keepPlace(update) {
  const top = $('.site-header').getBoundingClientRect().bottom;
  const anchor = [...document.querySelectorAll('#feed > .post')]
    .find((post) => !post.hidden && post.getBoundingClientRect().bottom > top);
  const before = anchor?.getBoundingClientRect().top;
  update();
  const after = anchor && document.getElementById(anchor.id);
  if (after && window.scrollY > 0) window.scrollBy(0, after.getBoundingClientRect().top - before);
}

// Jewel notices: info by default, 'accent' for updates, 'error' for
// failures. News that arrives in the background is announced (status).
const actionHTML = (action) => (action.href
  ? `<a class="btn btn--ghost" href="${esc(action.href)}">${esc(action.label)}</a>`
  : `<button class="btn btn--ghost" type="button"${action.sheet ? ` data-sheet-open="${esc(action.sheet)}"` : ''}>${esc(action.label)}</button>`);

const noticeHTML = ({ text, tone, role, action }) => `
  <div class="notice${tone ? ` notice--${tone}` : ''}"${role ? ` role="${role}"` : ''}>
    <p class="notice__text">${esc(text)}</p>
    ${action ? `<div class="notice__actions">${actionHTML(action)}</div>` : ''}
  </div>`;

// Good news ("… is live") stays up for a couple of minutes, across refreshes.
let news = [];
function renderNotices(notices) {
  news = news.filter((item) => item.until > Date.now());
  $('[data-stream-notices]').innerHTML = [...news, ...notices].map(noticeHTML).join('');
}

let filterPrint = '';
let currentPosts = [];
function renderFeed(posts) {
  currentPosts = posts;
  const count = posts.length;
  $('[data-stream-count]').textContent = `Photostream · ${count} ${count === 1 ? 'post' : 'posts'}`;

  const tags = tagsByRecency(posts);
  if (fingerprint(tags) !== filterPrint) {
    filterPrint = fingerprint(tags);
    $('[data-stream-filter]').innerHTML = renderFilter(tags);
  }

  const feed = $('#feed');
  const existing = new Map([...feed.children].map((el) => [el.id, el]));
  const nodes = posts.map((post, index) => {
    const print = fingerprint(post);
    const current = existing.get(`post-${post.id}`);
    if (current?.dataset.print === print) return current;
    const node = fromHTML(renderPost(post, index));
    node.dataset.print = print;
    return node;
  });
  keepPlace(() => feed.replaceChildren(...(nodes.length ? nodes : [fromHTML(
    '<section class="panel panel--pad" data-panel="solid"><p class="caption">No photos yet.</p></section>',
  )])));

  Jewel.mount($('#main'));
  // A filter chosen before the update (#tag=…) still applies.
  if (location.hash.startsWith('#tag=')) window.dispatchEvent(new HashChangeEvent('hashchange'));

  const token = settings.token;
  if (token) observeLibraryImages(feed, (path) => libraryImageUrl(path, token));
}

// ---- Loading --------------------------------------------------------------

const offline = (err) => err?.status === 0 || err instanceof TypeError || !navigator.onLine;

async function showSaved() {
  const token = settings.token;
  const [site, library] = await Promise.all([savedSitePosts(), token ? savedLibraryIndex() : null]);
  if (site || library) renderFeed(mergePosts(site || [], library || [], publishing.all()));
}

let lastRefresh = 0;
let refreshing = null;

function refresh() {
  refreshing ??= (async () => {
    lastRefresh = Date.now();
    const token = settings.token;
    const [site, library] = await Promise.allSettled([
      fetchSitePosts(),
      token ? fetchLibraryIndex(token) : Promise.resolve([]),
    ]);
    const [savedSite, savedLibrary] = await Promise.all([
      site.status === 'rejected' ? savedSitePosts() : null,
      library.status === 'rejected' && token ? savedLibraryIndex() : null,
    ]);

    const notices = [];
    const wentOffline = [site, library].some((r) => r.status === 'rejected' && offline(r.reason));
    if (wentOffline && (savedSite || savedLibrary)) {
      notices.push({ text: "You're offline. Showing what's saved on this phone.", role: 'status' });
    } else {
      if (site.status === 'rejected') {
        notices.push({ text: "Couldn't load your published photos from willchambers.github.io. Check your connection.", tone: 'error', role: 'status' });
      }
      if (library.status === 'rejected') {
        // Token problems (expired, no access) are fixed in Settings.
        const tokenProblem = [401, 403, 404].includes(library.reason?.status);
        notices.push({
          text: explain(library.reason), tone: 'error', role: 'status',
          action: tokenProblem ? { label: 'Open Settings', sheet: 'settings' } : null,
        });
      }
    }
    if (!token) {
      notices.push({
        text: 'Showing published photos only. Connect GitHub to see your private library too.',
        action: { label: 'Connect GitHub', sheet: 'settings' },
      });
    }

    const sitePosts = site.status === 'fulfilled' ? site.value : savedSite || [];
    if (site.status === 'fulfilled') noteLive(sitePosts);
    renderNotices(notices);
    renderFeed(mergePosts(
      sitePosts,
      library.status === 'fulfilled' ? library.value : savedLibrary || [],
      publishing.all(),
    ));
    watchPublishing();
  })().finally(() => { refreshing = null; });
  return refreshing;
}

// ---- Publishing -------------------------------------------------------------------

// A publishing post that has turned up in the site's feed is live.
function noteLive(sitePosts) {
  const onSite = new Set(sitePosts.map((post) => post.id));
  for (const [id, record] of Object.entries(publishing.all())) {
    if (!onSite.has(id)) continue;
    publishing.clear(id);
    news.push({
      text: `“${record.title || 'Your post'}” is live on willchambers.github.io.`,
      tone: 'accent',
      role: 'status',
      action: { label: 'See it on the site', href: 'https://willchambers.github.io/photos/' },
      until: Date.now() + 2 * 60_000,
    });
  }
}

// While anything is publishing, check the site every few seconds.
let watchTimer = 0;
function watchPublishing() {
  clearTimeout(watchTimer);
  const watching = Object.values(publishing.all())
    .filter((record) => record.state === 'publishing' && Date.now() - record.since < WATCH_FOR);
  if (watching.length) watchTimer = setTimeout(refresh, WATCH_EVERY);
}

// "Try again" on a failed post, or "Publish to site" on a private one.
async function publishLater(id, button) {
  const token = settings.token;
  const post = ((await savedLibraryIndex()) || []).find((p) => p.id === id);
  if (!token || !post) return;
  button.disabled = true;
  button.textContent = 'Publishing…';
  publishing.set(id, { state: 'publishing', title: post.title, error: null });
  await showSaved();
  try {
    await publishToSite({ post, full: await libraryPhoto(post, token), token });
  } catch (err) {
    // publishToSite records its own failures; this catches the photo download.
    if (publishing.get(id)?.state !== 'failed') publishing.set(id, { state: 'failed', error: err.message });
  }
  refresh();
}

$('#feed').addEventListener('click', (e) => {
  const button = e.target.closest('[data-publish]');
  if (button) publishLater(button.dataset.publish, button);
});

// ---- Start ----------------------------------------------------------------

// Tap the name: back to the top, and check for new posts.
$('[data-refresh]').addEventListener('click', (e) => {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: Jewel.reducedMotion.matches ? 'auto' : 'smooth' });
  refresh();
});

// Coming back to the app after a while, or getting signal back.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - lastRefresh > REFRESH_AFTER) refresh();
});
window.addEventListener('online', () => refresh());

// The "+" button only makes sense once GitHub is connected.
const showFab = () => { $('.fab').hidden = !settings.token; };

initSettings({
  onChange: () => {
    lastRefresh = 0;
    showFab();
    showSaved().then(refresh);
  },
});

initComposer({
  // Recent tags and places, most recent first, for the composer's suggestions.
  suggestions: () => ({
    tags: tagsByRecency(currentPosts),
    places: [...new Set(currentPosts.map((post) => post.location).filter(Boolean))],
  }),
  // The post is safe in the library: show it at once, from the photo that's
  // already on the phone, and let the network catch up.
  onPosted: async (post, ready) => {
    await Promise.all([cacheLibraryImage(post.photos[0].thumb, ready.thumb), addToSavedIndex(post)]);
    await showSaved();
    window.scrollTo({ top: 0, behavior: Jewel.reducedMotion.matches ? 'auto' : 'smooth' });
    watchPublishing();
  },
  onPublished: () => refresh(),
});
showFab();

// A new release took over. Reload quietly if nobody's looking; otherwise ask.
registerServiceWorker({
  onUpdate: () => {
    if (document.visibilityState === 'hidden') return location.reload();
    const notice = fromHTML(noticeHTML({
      text: 'Photostream has been updated.', tone: 'accent', role: 'status', action: { label: 'Reload' },
    }));
    notice.querySelector('button').addEventListener('click', () => location.reload());
    $('[data-stream-notices]').prepend(notice);
  },
});

showSaved().finally(refresh);
