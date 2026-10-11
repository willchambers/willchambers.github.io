// The composer: the "+" button opens a Jewel sheet holding Jewel's post form
// (index.html, #post-sheet).
//
// - Picking a photo starts getting it ready straight away (2400px and 960px
//   WebP, on the phone), and asks Claude for an alt text draft.
// - Tags and places are suggested from recent posts.
// - The draft (fields and the ready photo) is kept on the phone until it's
//   posted, so closing the app doesn't lose it.
// - Post saves to the library, closes the sheet, and publishing (if it's
//   on) carries on in the background with its own status on the post.

import { draftAltText, plainAltText } from './alt-text.js';
import { preparePhoto } from './image.js';
import { publishToSite, saveToLibrary, siteIds } from './publish.js';
import { settings } from './settings.js';

const DRAFT_KEY = 'photostream.draft';
const DRAFT_CACHE = 'photostream-draft-v1';
const draftUrl = (name) => new URL(`../__draft/${name}`, import.meta.url).href;

// ---- The draft, kept on the phone -------------------------------------------------
const draft = {
  fields() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; }
  },
  saveFields(fields) {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(fields)); } catch { /* storage full */ }
  },
  async savePhoto(ready) {
    try {
      const cache = await caches.open(DRAFT_CACHE);
      await cache.put(draftUrl('full'), new Response(ready.full, { headers: { 'Content-Type': 'image/webp' } }));
      await cache.put(draftUrl('thumb'), new Response(ready.thumb, { headers: { 'Content-Type': 'image/webp' } }));
    } catch { /* storage full: the photo just won't survive a restart */ }
  },
  async photo(size) {
    try {
      const cache = await caches.open(DRAFT_CACHE);
      const [full, thumb] = await Promise.all([cache.match(draftUrl('full')), cache.match(draftUrl('thumb'))]);
      if (!full || !thumb || !size) return null;
      return { full: await full.blob(), thumb: await thumb.blob(), ...size };
    } catch {
      return null;
    }
  },
  async clear() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* nothing saved */ }
    if ('caches' in self) await caches.delete(DRAFT_CACHE).catch(() => {});
  },
};

export function initComposer({ suggestions, onPosted, onPublished }) {
  const sheet = document.getElementById('post-sheet');
  const form = sheet.querySelector('#post-form');
  const dropzone = form.querySelector('[data-component~="dropzone"]');
  const tagInput = form.querySelector('[data-component~="tag-input"]');
  const places = document.getElementById('recent-places');
  const { title, description, location, alt, publish } = form.elements;
  const altHint = form.querySelector('#post-alt-hint');
  const plainHint = altHint.textContent;

  let photo = null;        // Promise of { full, thumb, width, height } for the current pick
  let size = null;         // { width, height } of the ready photo, for the draft
  let drafting = null;     // AbortController for a Claude draft in flight
  let claudeDrafted = false;

  // ---- Alt text -------------------------------------------------------------------
  const suggestPlain = () => {
    if (claudeDrafted) return;
    Jewel.field.suggest(alt, plainAltText({ title: title.value.trim(), location: location.value.trim() }));
  };

  async function suggestFromClaude(ready) {
    claudeDrafted = false;
    if (!settings.anthropicKey) { altHint.textContent = plainHint; suggestPlain(); return; }
    drafting?.abort();
    drafting = new AbortController();
    altHint.textContent = 'Claude is drafting a description…';
    try {
      const text = await draftAltText(ready.thumb, { title: title.value.trim(), signal: drafting.signal });
      if (!text) { altHint.textContent = plainHint; suggestPlain(); return; }
      claudeDrafted = Jewel.field.suggest(alt, text);
      altHint.textContent = claudeDrafted
        ? 'Drafted by Claude from the photo. Edit it or clear it; it never holds up posting.'
        : plainHint;
    } catch (err) {
      altHint.textContent = `${err.message} You can write it yourself, or leave it.`;
      suggestPlain();
    }
  }

  title.addEventListener('input', suggestPlain);
  location.addEventListener('input', suggestPlain);

  // ---- The photo ------------------------------------------------------------------
  function usePhoto(ready) {
    size = { width: ready.width, height: ready.height };
    photo = Promise.resolve(ready);
    dropzone.jewelDropzone.setFile(ready.full, 'photo.webp');
  }

  dropzone.addEventListener('jewel:filechange', (e) => {
    const { file, source } = e.detail;
    if (source === 'api') return; // our own setFile, below
    drafting?.abort();
    claudeDrafted = false;
    if (!file) { photo = null; size = null; altHint.textContent = plainHint; return; }

    // After the drop zone's own 'input' event, which clears the form status.
    queueMicrotask(() => form.jewelForm.setStatus('Getting the photo ready…'));
    const pending = preparePhoto(file);
    photo = pending;
    pending.then((ready) => {
      if (photo !== pending) return; // replaced by another pick meanwhile
      usePhoto(ready);
      form.jewelForm.setStatus('');
      draft.savePhoto(ready);
      saveFields();
      suggestFromClaude(ready);
    }).catch((err) => {
      if (photo !== pending) return;
      photo = null;
      form.jewelForm.setStatus('');
      form.jewelForm.setError('photo', err.message);
    });
  });

  // ---- Keeping the draft --------------------------------------------------------------
  const fields = () => ({
    title: title.value,
    description: description.value,
    location: location.value,
    alt: alt.value,
    tags: tagInput.jewelTags?.get() || [],
    publish: publish.checked,
    size,
  });
  let saveTimer = 0;
  const worthKeeping = (f) => Boolean(f.size || f.title || f.description || f.location || f.tags.length);
  const saveFields = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const current = fields();
      if (worthKeeping(current)) draft.saveFields(current);
      else draft.clear();
    }, 300);
  };
  form.addEventListener('input', saveFields);
  form.addEventListener('change', saveFields);
  form.addEventListener('jewel:tagschange', saveFields);

  async function restoreDraft() {
    if (form.jewelForm.isDirty() || photo) return;
    const saved = draft.fields();
    if (!saved || !worthKeeping(saved)) return;
    for (const [name, value] of Object.entries({ title: saved.title, description: saved.description, location: saved.location })) {
      if (value) {
        form.elements[name].value = value;
        form.elements[name].dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    if (saved.alt) Jewel.field.suggest(alt, saved.alt);
    if (saved.tags?.length) tagInput.jewelTags?.set(saved.tags);
    publish.checked = saved.publish !== false;
    const ready = await draft.photo(saved.size);
    if (ready) usePhoto(ready);
    form.jewelForm.setStatus('Your unfinished post is back.');
  }

  sheet.addEventListener('jewel:sheetopen', () => {
    const { tags, places: recent } = suggestions();
    tagInput.jewelTags?.setSuggestions(tags.slice(0, 12));
    places.replaceChildren(...recent.slice(0, 12).map((place) => Object.assign(document.createElement('option'), { value: place })));
    restoreDraft();
  });
  // Discarding in the sheet's "Discard this draft?" bar resets the form.
  form.addEventListener('reset', () => {
    clearTimeout(saveTimer);
    photo = null;
    size = null;
    claudeDrafted = false;
    altHint.textContent = plainHint;
    draft.clear();
  });

  // ---- Posting --------------------------------------------------------------------------
  async function post(detail) {
    const token = settings.token;
    if (!token) throw new Error('Connect GitHub in Settings first, so Photostream can save your photo.');
    if (!photo) throw new Error('Add a photo first.');
    const ready = await photo; // still getting ready? wait for it

    const fields = {
      title: detail.title,
      description: detail.description,
      location: detail.location,
      tags: detail.tags,
      publish: detail.publish,
      // Alt text never blocks posting; with none, the title stands in.
      alt: detail.alt || plainAltText({ title: detail.title, location: detail.location }),
    };
    // Avoid clashing with a name already on the site (only matters if publishing).
    const taken = fields.publish ? await siteIds(token).catch(() => new Set()) : new Set();
    const saved = await saveToLibrary({ fields, photo: ready, token, taken });

    // From here the photo is safe in the library.
    const publishing = fields.publish ? publishToSite({ post: saved, full: ready.full, token }) : null;
    onPosted(saved, ready);
    publishing?.then(() => onPublished(saved), () => onPublished(saved));
    await draft.clear();
    setTimeout(() => sheet.jewelSheet?.close({ force: true }), 800);
  }

  form.addEventListener('jewel:post', (e) => e.detail.waitUntil(post(e.detail)));
}
