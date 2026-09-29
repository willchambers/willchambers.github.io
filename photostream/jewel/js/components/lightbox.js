/* Lightbox — opens [data-lightbox-item] links in a full-screen viewer.
   Put data-component="lightbox" on the container. Each item is a link to the
   full image (so it still works without JS), with an optional data-caption
   and an optional data-description (a second, quieter line).
   Items hidden by a filter (or inside a hidden parent) are skipped. Arrow keys
   and swipes move between photos; Esc closes and focus returns to the photo
   that opened it. */

(() => {
  const icon = (d) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="${d}"/></svg>`;

  let dialog, img, caption, count, prevBtn, nextBtn;
  let items = [];
  let index = 0;
  let opener = null;

  // Every way out (button, Esc, click outside the photo) comes through here,
  // so focus goes back to the photo that opened the viewer.
  function close() {
    if (dialog.open) dialog.close();
    opener?.focus();
    opener = null;
  }

  function build() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.className = 'lightbox';
    dialog.setAttribute('aria-label', 'Photo viewer');
    dialog.innerHTML = `
      <div class="lightbox__bar">
        <span class="label lightbox__count"></span>
        <button class="btn btn--ghost btn--icon" type="button" data-lightbox-close aria-label="Close">${icon('M6 6l12 12M18 6L6 18')}</button>
      </div>
      <figure class="lightbox__figure"><img class="lightbox__img" alt=""></figure>
      <div class="lightbox__footer">
        <button class="btn btn--ghost btn--icon" type="button" data-lightbox-prev aria-label="Previous photo">${icon('M15 5l-7 7 7 7')}</button>
        <p class="caption lightbox__caption" aria-live="polite"></p>
        <button class="btn btn--ghost btn--icon" type="button" data-lightbox-next aria-label="Next photo">${icon('M9 5l7 7-7 7')}</button>
      </div>`;
    document.body.append(dialog);

    img = dialog.querySelector('.lightbox__img');
    caption = dialog.querySelector('.lightbox__caption');
    count = dialog.querySelector('.lightbox__count');
    prevBtn = dialog.querySelector('[data-lightbox-prev]');
    nextBtn = dialog.querySelector('[data-lightbox-next]');

    dialog.querySelector('[data-lightbox-close]').addEventListener('click', close);
    prevBtn.addEventListener('click', () => show(index - 1));
    nextBtn.addEventListener('click', () => show(index + 1));

    // Esc: take over from the browser's own close so close() runs.
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });

    // A click on the empty area around the photo closes the viewer.
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || e.target.classList.contains('lightbox__figure')) close();
    });

    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });

    let startX = null;
    dialog.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    dialog.addEventListener('touchend', (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
      startX = null;
    });
  }

  function preload(i) {
    const item = items[(i + items.length) % items.length];
    if (item) new Image().src = item.href;
  }

  function show(i) {
    index = (i + items.length) % items.length;
    const item = items[index];
    img.src = item.href;
    img.alt = item.querySelector('img')?.alt || '';
    caption.textContent = item.dataset.caption || '';
    if (item.dataset.description) {
      const more = document.createElement('span');
      more.className = 'lightbox__description';
      more.textContent = item.dataset.description;
      caption.append(more);
    }
    count.textContent = `${index + 1} / ${items.length}`;
    const single = items.length < 2;
    prevBtn.hidden = single;
    nextBtn.hidden = single;
    preload(index + 1);
    preload(index - 1);
  }

  Jewel.register('lightbox', (container) => {
    container.addEventListener('click', (e) => {
      const item = e.target.closest('[data-lightbox-item]');
      // Let modified clicks open the image in a new tab as usual.
      if (!item || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      build();
      items = [...container.querySelectorAll('[data-lightbox-item]')].filter((el) => !el.closest('[hidden]'));
      opener = item;
      show(items.indexOf(item));
      dialog.showModal();
    });
  });
})();
