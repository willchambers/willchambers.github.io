// Photostream: start-up and the feed.
//
// The feed draws straight away from what's saved on the phone, then checks
// the network and updates in place: unchanged posts are kept as they are
// (their photos don't reload), and the post you're looking at stays put.

import { explain } from './github.js';
import { esc } from './format.js';
import { fetchLibraryIndex, libraryImageUrl, savedLibraryIndex } from './library.js';
import { fetchSitePosts, mergePosts, savedSitePosts, tagsByRecency } from './posts.js';
import { observeLibraryImages, renderFilter, renderPost } from './feed.js';
import { settings } from './settings.js';
import { initSettings } from './settings-sheet.js';
import { registerServiceWorker } from './sw-register.js';

const $ = (selector) => document.querySelector(selector);
const REFRESH_AFTER = 60_000; // on returning to the app

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

const noticeHTML = ({ text, action }) => `
  <div class="stream__notice">
    <p class="caption">${esc(text)}</p>
    ${action ? `<button class="btn btn--ghost" type="button" data-sheet-open="${esc(action.sheet)}">${esc(action.label)}</button>` : ''}
  </div>`;

function renderNotices(notices) {
  $('[data-stream-notices]').innerHTML = notices.map(noticeHTML).join('');
}

let filterPrint = '';
function renderFeed(posts) {
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
  if (site || library) renderFeed(mergePosts(site || [], library || []));
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
      notices.push({ text: "You're offline. Showing what's saved on this phone." });
    } else {
      if (site.status === 'rejected') {
        notices.push({ text: "Couldn't load your published photos from willchambers.github.io. Check your connection." });
      }
      if (library.status === 'rejected') notices.push({ text: explain(library.reason) });
    }
    if (!token) {
      notices.push({
        text: 'Showing published photos only. Connect GitHub to see your private library too.',
        action: { label: 'Connect GitHub', sheet: 'settings' },
      });
    }

    renderNotices(notices);
    renderFeed(mergePosts(
      site.status === 'fulfilled' ? site.value : savedSite || [],
      library.status === 'fulfilled' ? library.value : savedLibrary || [],
    ));
  })().finally(() => { refreshing = null; });
  return refreshing;
}

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

initSettings({
  onChange: () => {
    lastRefresh = 0;
    showSaved().then(refresh);
  },
});

// A new release took over. Reload quietly if nobody's looking; otherwise ask.
registerServiceWorker({
  onUpdate: () => {
    if (document.visibilityState === 'hidden') return location.reload();
    const notice = fromHTML(noticeHTML({ text: 'Photostream has been updated.' }));
    const reload = fromHTML('<button class="btn btn--ghost" type="button">Reload</button>');
    reload.addEventListener('click', () => location.reload());
    notice.append(reload);
    $('[data-stream-notices]').prepend(notice);
  },
});

showSaved().finally(refresh);
