/* Sheet — see css/components/sheet.css for markup.
   Opens from any element with data-sheet-open="<dialog id>" (for example
   the .fab). Uses a modal <dialog>, so the page behind is inert and focus
   stays inside.

   - Close: the × button [data-sheet-close], Esc, or a click on the backdrop.
     If a form inside has unsaved changes, an in-sheet bar asks
     "Discard this draft?" before closing.
   - Focus returns to the element that opened it. The page can't scroll
     behind it.
   - Keyboard-aware: while open, --sheet-vh follows visualViewport, so on
     phones the sheet shrinks above the on-screen keyboard, and the focused
     field is kept in view.

   API: dialog.jewelSheet  .open(opener?)  .close({ force })  .requestClose()
   Events: 'jewel:sheetopen', 'jewel:sheetclose' on the dialog. */

(() => {
  const html = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  Jewel.register('sheet', (dialog) => {
    let opener = null;
    const vv = window.visualViewport;
    const forms = () => [...dialog.querySelectorAll('form')];
    const dirty = () => forms().some((f) => f.jewelForm?.isDirty());

    // Confirm bar, built once and placed under the sheet's header.
    const confirm = document.createElement('div');
    confirm.className = 'sheet__confirm';
    confirm.hidden = true;
    confirm.setAttribute('role', 'alertdialog');
    confirm.setAttribute('aria-label', 'Discard this draft?');
    confirm.innerHTML = `
      <span>Discard this draft?</span>
      <span class="cluster" style="--cluster-gap: var(--space-2)">
        <button class="btn btn--ghost" type="button" data-keep>Keep editing</button>
        <button class="btn" type="button" data-discard>Discard</button>
      </span>`;
    dialog.querySelector('.sheet__head')?.after(confirm);

    const syncViewport = () => {
      if (!vv) return;
      dialog.style.setProperty('--sheet-vh', `${vv.height}px`);
    };
    const keepFocusedInView = (e) => {
      const el = e.target;
      if (!el.matches?.('input, textarea, select')) return;
      // Wait for the keyboard to finish animating in.
      setTimeout(() => el.scrollIntoView({ block: 'nearest', behavior: reduced.matches ? 'auto' : 'smooth' }), 250);
    };

    const api = {
      open(from) {
        if (dialog.open) return;
        opener = from || document.activeElement;
        confirm.hidden = true;
        syncViewport();
        vv?.addEventListener('resize', syncViewport);
        html.classList.add('has-open-sheet');
        dialog.showModal();
        cleaned = false;
        const first = dialog.querySelector('[autofocus]') || dialog.querySelector('.sheet__body input:not([type="hidden"]):not(.dropzone__input), .sheet__body textarea, .sheet__body select');
        // On touch devices, don't pop the keyboard on open.
        if (first && !matchMedia('(pointer: coarse)').matches) first.focus();
        dialog.dispatchEvent(new CustomEvent('jewel:sheetopen'));
      },
      close({ force = false } = {}) {
        if (!dialog.open) return;
        if (!force && dirty()) return api.requestClose();
        dialog.close();
        cleanup();   // don't wait for the 'close' event; it can be deferred
      },
      requestClose() {
        if (!dirty()) return api.close({ force: true });
        confirm.hidden = false;
        confirm.querySelector('[data-keep]').focus();
      },
    };
    dialog.jewelSheet = api;

    confirm.querySelector('[data-keep]').addEventListener('click', () => {
      confirm.hidden = true;
      (dialog.querySelector('[aria-invalid="true"]') || dialog.querySelector('.sheet__body input:not([type="hidden"]), .sheet__body textarea'))?.focus();
    });
    confirm.querySelector('[data-discard]').addEventListener('click', () => {
      forms().forEach((f) => (f.jewelForm ? f.jewelForm.reset() : f.reset()));
      api.close({ force: true });
    });

    dialog.addEventListener('cancel', (e) => {       // Esc
      e.preventDefault();
      if (!confirm.hidden) { confirm.hidden = true; return; }
      api.requestClose();
    });
    // Backdrop clicks land on the dialog itself. Require the press to start
    // there too, so selecting text and releasing outside doesn't close it.
    let downOnBackdrop = false;
    dialog.addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === dialog; });
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog && downOnBackdrop) api.requestClose();
      downOnBackdrop = false;
    });
    dialog.querySelectorAll('[data-sheet-close]').forEach((b) => b.addEventListener('click', () => api.requestClose()));
    dialog.addEventListener('focusin', keepFocusedInView);

    // Runs once per close, whether api.close() or a native close got there first.
    let cleaned = true;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      vv?.removeEventListener('resize', syncViewport);
      if (!document.querySelector('dialog.sheet[open]')) html.classList.remove('has-open-sheet');
      confirm.hidden = true;
      if (opener?.isConnected) opener.focus();
      dialog.dispatchEvent(new CustomEvent('jewel:sheetclose'));
    }
    dialog.addEventListener('close', cleanup);
  });

  // Openers anywhere on the page.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sheet-open]');
    if (!btn) return;
    const dialog = document.getElementById(btn.dataset.sheetOpen);
    dialog?.jewelSheet?.open(btn);
  });
})();
