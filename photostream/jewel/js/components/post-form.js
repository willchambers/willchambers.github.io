/* Post form — turns a valid 'jewel:submit' into a 'jewel:post' event with
   the post as plain data. There's no backend: the page (or app) listens for
   'jewel:post' and does the work.

   <form class="form" data-component="form post-form" novalidate data-success="Posted.">
     photo (dropzone), title, description, location, alt, tags (tag-input),
     publish (switch)…
   </form>

   'jewel:post' (bubbles) detail:
     { file, title, description, location, alt, tags: string[], publish: boolean,
       formData, form, waitUntil(promise) }
   Fields that aren't in the form come through as '' / [] / null.
   Pass a promise to waitUntil to keep the form busy while you upload:
   resolve → "Posted." and a reset; reject(new Error('…')) → the message is
   shown and the draft stays. With no waitUntil, it succeeds at once. */

Jewel.register('post-form', (form) => {
  form.addEventListener('jewel:submit', (e) => {
    if (e.target !== form) return;
    const { formData, waitUntil } = e.detail;
    const val = (name) => (form.elements[name]?.value ?? '').trim();
    const dz = form.querySelector('[data-component~="dropzone"]');
    let tags = [];
    try { tags = JSON.parse(val('tags') || '[]'); } catch { tags = []; }
    const publish = form.elements.publish;

    const pending = [];
    const detail = {
      file: dz?.jewelDropzone?.getFile() || formData.get('photo') || null,
      title: val('title'),
      description: val('description'),
      location: val('location'),
      alt: val('alt'),
      tags,
      publish: publish ? publish.checked : true,
      formData,
      form,
      waitUntil: (p) => pending.push(Promise.resolve(p)),
    };
    form.dispatchEvent(new CustomEvent('jewel:post', { bubbles: true, detail }));
    if (pending.length) waitUntil(Promise.all(pending));
  });
});
