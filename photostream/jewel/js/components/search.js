/* Search — see css/components/search.css for markup.
   - The × clears the box and puts focus back in it; Esc does the same
     (a second Esc with an empty box leaves the field).
   - "/" anywhere on the page (outside a text field) focuses the box, if the
     form has a .search__key.
   - data-suggestions='["…"]' turns it into a combobox: matching
     suggestions list under the box; ↑ ↓ move, Enter picks, Esc closes.
     Set them later with form.jewelSearch.setSuggestions([...]), e.g.
     from a fetch on 'jewel:searchinput'.
   Events (bubble from the form):
     'jewel:searchinput' detail { query }  as the person types (debounced)
     'jewel:search'      detail { query }  on Enter or picking a suggestion.
   A form without an action attribute doesn't navigate; with one, it
   submits normally after the event. */

(() => {
  let uid = 0;
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  Jewel.register('search', (form) => {
    const input = form.querySelector('.search__input');
    const clear = form.querySelector('.search__clear');
    if (!input) return;
    const id = `jewel-search${++uid}`;
    let suggestions = [];
    try { suggestions = JSON.parse(form.dataset.suggestions || '[]'); } catch { /* bad JSON: no suggestions */ }

    // Listbox, built once.
    const list = document.createElement('ul');
    list.className = 'search__suggestions';
    list.id = `${id}-list`;
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    form.append(list);
    let active = -1;
    let shown = [];
    let unfloat = null;

    const fire = (name) => form.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: { query: input.value.trim() } }));
    const syncClear = () => { if (clear) clear.hidden = !input.value; };

    function close() {
      unfloat?.();
      unfloat = null;
      list.hidden = true;
      active = -1;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }
    function render() {
      const q = input.value.trim().toLowerCase();
      shown = q ? suggestions.filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q).slice(0, 8) : [];
      if (!shown.length) return close();
      list.innerHTML = shown.map((s, i) => {
        const at = s.toLowerCase().indexOf(q);
        const label = `${esc(s.slice(0, at))}<mark>${esc(s.slice(at, at + q.length))}</mark>${esc(s.slice(at + q.length))}`;
        return `<li class="search__option" role="option" id="${id}-o${i}" aria-selected="false">${label}</li>`;
      }).join('');
      if (!unfloat) unfloat = Jewel.float(list, form, { width: 'match' });
      input.setAttribute('aria-expanded', 'true');
      active = -1;
    }
    function highlight(i) {
      const opts = [...list.children];
      if (!opts.length) return;
      active = (i + opts.length) % opts.length;
      opts.forEach((o, n) => o.setAttribute('aria-selected', String(n === active)));
      input.setAttribute('aria-activedescendant', opts[active].id);
      opts[active].scrollIntoView({ block: 'nearest' });
    }
    function pick(i) {
      input.value = shown[i];
      syncClear();
      close();
      fire('jewel:search');
    }

    const setup = () => {
      if (!suggestions.length) return;
      input.setAttribute('role', 'combobox');
      input.setAttribute('aria-autocomplete', 'list');
      input.setAttribute('aria-controls', list.id);
      input.setAttribute('aria-expanded', 'false');
    };
    setup();

    let timer;
    input.addEventListener('input', () => {
      syncClear();
      if (suggestions.length) render();
      clearTimeout(timer);
      timer = setTimeout(() => fire('jewel:searchinput'), 200);
    });
    input.addEventListener('keydown', (e) => {
      const open = !list.hidden;
      if (e.key === 'ArrowDown' && suggestions.length) { e.preventDefault(); if (!open) render(); highlight(active + 1); }
      else if (e.key === 'ArrowUp' && open) { e.preventDefault(); highlight(active - 1); }
      else if (e.key === 'Enter' && open && active >= 0) { e.preventDefault(); pick(active); }
      else if (e.key === 'Escape') {
        if (open) { e.preventDefault(); close(); }
        else if (input.value) { e.preventDefault(); input.value = ''; syncClear(); fire('jewel:searchinput'); }
        else input.blur();
      }
    });
    input.addEventListener('blur', () => setTimeout(close, 120));
    list.addEventListener('pointerdown', (e) => e.preventDefault());   // keep focus in the box
    list.addEventListener('click', (e) => {
      const opt = e.target.closest('.search__option');
      if (opt) pick([...list.children].indexOf(opt));
    });

    clear?.addEventListener('click', () => {
      input.value = '';
      syncClear();
      close();
      input.focus();
      fire('jewel:searchinput');
    });

    form.addEventListener('submit', (e) => {
      if (!form.hasAttribute('action')) e.preventDefault();
      close();
      fire('jewel:search');
    });

    if (form.querySelector('.search__key')) {
      document.addEventListener('keydown', (e) => {
        if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target;
        if (t.isContentEditable || t.matches?.('input, textarea, select')) return;
        e.preventDefault();
        input.focus();
      });
    }

    syncClear();
    form.jewelSearch = {
      setSuggestions(list) { suggestions = Array.isArray(list) ? list : []; setup(); if (document.activeElement === input) render(); },
      clear() { clear?.click(); },
    };
  });
})();
