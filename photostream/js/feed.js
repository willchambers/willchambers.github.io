// Feed markup. Each post follows the journal's post page: label (date and
// place), title, description as the lede, then the photo and its tags.

import { esc, formatDate, slugify } from './format.js';

// Portraits taller than 4:5 are cropped in the feed, as on Instagram. Tapping
// opens the whole photo.
const MIN_RATIO = 4 / 5;
const ratioOf = (photo) => Math.max(photo.width / photo.height || 1, MIN_RATIO).toFixed(4);

// Jewel badges on the photo's top-left corner. Publishing pulses until the
// post is live.
const STATUS = {
  private: '<span class="badge" data-place="top-left" title="Only in your library">Private</span>',
  publishing: '<span class="badge badge--accent badge--busy" data-place="top-left" title="On its way to the site"><span class="badge__dot"></span>Publishing…</span>',
};

function photoLink(post, photo, { className, ratio, eager }) {
  const caption = [post.title, post.location].filter(Boolean).join(' — ');
  const viewer = `data-lightbox-item data-caption="${esc(caption)}"${
    post.description ? ` data-description="${esc(post.description)}"` : ''}`;
  const size = `width="${photo.width}" height="${photo.height}"`;
  const loading = eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';

  if (photo.source === 'site') {
    return `<a class="${className}" href="${esc(photo.src)}" style="--ratio: ${ratio}" ${viewer}>` +
      `<img src="${esc(photo.src)}" srcset="${esc(photo.srcset)}" sizes="(min-width: 44rem) 40rem, 100vw" ` +
      `${size} alt="${esc(photo.alt)}" ${loading} decoding="async"></a>`;
  }
  // Library photos need the token, so feed.js leaves src empty and
  // observeLibraryImages() fills it in as the post nears the screen.
  return `<a class="${className}" href="#" style="--ratio: ${ratio}" ${viewer}>` +
    `<img data-library-src="${esc(photo.thumb)}" ${size} alt="${esc(photo.alt)}" decoding="async"></a>`;
}

function media(post, eager) {
  const ratio = ratioOf(post.photos[0]);
  if (post.photos.length === 1) {
    return photoLink(post, post.photos[0], { className: 'figure__media post__photo', ratio, eager });
  }
  const slides = post.photos
    .map((photo, i) => photoLink(post, photo, { className: 'carousel__slide figure__media post__photo', ratio, eager: eager && i === 0 }))
    .join('');
  return `<div class="carousel" data-component="carousel" role="group" aria-roledescription="carousel" aria-label="${post.photos.length} photos">` +
    `<div class="carousel__track">${slides}</div>` +
    `<span class="badge carousel__count" data-place="top-right" aria-hidden="true"></span></div>`;
}

export function renderPost(post, index) {
  const tags = post.topics.map((name) => ({ name, slug: slugify(name) }));
  const status = STATUS[post.status];

  return `
<article class="panel panel--pad post" data-panel="solid" id="post-${esc(post.id)}" data-status="${post.status}" data-tags="${esc(tags.map((t) => t.slug).join(' '))}">
  <p class="label"><time datetime="${post.date.toISOString()}">${esc(formatDate(post.date))}</time>${post.location ? ` · ${esc(post.location)}` : ''}</p>
  <h2 class="post__title">${esc(post.title)}</h2>
  ${post.description ? `<p class="lede post__lede">${esc(post.description)}</p>` : ''}
  <figure class="figure bleed post__figure">
    ${media(post, index === 0)}
    ${status || ''}
  </figure>
  ${tags.length ? `<div class="cluster post__tags">${tags.map((t) => `<a class="tag tag--button" href="#tag=${esc(t.slug)}">${esc(t.name)}</a>`).join('')}</div>` : ''}
</article>`;
}

export function renderFilter(tags) {
  const unique = [...new Map(tags.map((name) => [slugify(name), name])).entries()];
  if (!unique.length) return '';
  return `
<div class="filter cluster stream__filter" data-component="filter" data-filter-target="#feed" data-filter-noun="posts" role="group" aria-label="Filter by tag">
  <button class="tag tag--button" type="button" data-filter="*" aria-pressed="true">All</button>
  ${unique.map(([slug, name]) => `<button class="tag tag--button" type="button" data-filter="${esc(slug)}" aria-pressed="false">${esc(name)}</button>`).join('')}
  <span class="filter__status visually-hidden" aria-live="polite"></span>
</div>`;
}

/** Fill in library photos as they come near the screen. */
export function observeLibraryImages(root, load) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      const img = entry.target;
      const link = img.closest('a');
      img.dataset.requested = '';
      load(img.dataset.librarySrc)
        .then((url) => { img.src = url; link.href = url; })
        .catch(() => { link.dataset.state = 'error'; delete img.dataset.requested; });
    }
  }, { rootMargin: '1200px 0px' });
  // Posts kept across a refresh already have their photo, or are fetching it.
  root.querySelectorAll('img[data-library-src]:not([data-requested])').forEach((img) => observer.observe(img));
}
