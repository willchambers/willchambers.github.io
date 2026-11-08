/* Dropdown — see css/components/dropdown.css for markup.
   WAI-ARIA menu button: Enter, Space or ↓ opens on the first item, ↑ on the
   last; ↑ ↓ Home End move; letters jump (type-ahead); Esc closes and returns
   focus to the button; Tab or a click outside closes.

   Choosing an item fires 'jewel:select' on .dropdown (bubbles), detail
   { item, value } (value = data-value or the item's text). menuitemradio
   items move aria-checked within the menu; menuitemcheckbox items toggle.
   A data-label-from-choice attribute on .dropdown copies the chosen
   radio's text into the trigger ("Sort: Newest").
   API: el.jewelDropdown.open() / .close() */

(() => {
  let uid = 0;
  const openMenus = new Set();

  document.addEventListener('pointerdown', (e) => {
    openMenus.forEach((dd) => { if (!dd.root.contains(e.target)) dd.close(false); });
  });

  Jewel.register('dropdown', (root) => {
    const trigger = root.querySelector('.dropdown__trigger');
    const menu = root.querySelector('.dropdown__menu');
    if (!trigger || !menu) return;
    const items = () => [...menu.querySelectorAll('[role^="menuitem"]')];
    const usable = () => items().filter((i) => i.getAttribute('aria-disabled') !== 'true');

    menu.id ||= `jewel-menu${++uid}`;
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-controls', menu.id);
    trigger.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
    items().forEach((i) => { i.tabIndex = -1; });

    const baseLabel = trigger.textContent.trim();
    const showChoice = () => {
      if (!('labelFromChoice' in root.dataset)) return;
      const on = menu.querySelector('[role="menuitemradio"][aria-checked="true"]');
      if (on) trigger.firstChild.textContent = `${baseLabel}: ${on.textContent.trim()} `;
    };
    showChoice();

    let unfloat = null;

    const api = {
      root,
      open(focus = 'first') {
        if (!menu.hidden) return;
        openMenus.forEach((dd) => dd.close(false));
        unfloat = Jewel.float(menu, trigger, { align: root.dataset.align === 'end' ? 'end' : 'start', width: 'min' });
        trigger.setAttribute('aria-expanded', 'true');
        openMenus.add(api);
        const list = usable();
        (focus === 'last' ? list.at(-1) : menu.querySelector('[aria-checked="true"]:not([aria-disabled="true"])') || list[0])?.focus();
      },
      close(returnFocus = true) {
        if (menu.hidden) return;
        unfloat?.();
        unfloat = null;
        trigger.setAttribute('aria-expanded', 'false');
        openMenus.delete(api);
        if (returnFocus) trigger.focus();
      },
    };
    root.jewelDropdown = api;

    trigger.addEventListener('click', () => (menu.hidden ? api.open() : api.close()));
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); api.open('first'); }
      if (e.key === 'ArrowUp') { e.preventDefault(); api.open('last'); }
    });

    function choose(item) {
      if (item.getAttribute('aria-disabled') === 'true') return;
      const role = item.getAttribute('role');
      if (role === 'menuitemradio') {
        menu.querySelectorAll('[role="menuitemradio"]').forEach((i) => i.setAttribute('aria-checked', String(i === item)));
        showChoice();
      } else if (role === 'menuitemcheckbox') {
        item.setAttribute('aria-checked', String(item.getAttribute('aria-checked') !== 'true'));
      }
      root.dispatchEvent(new CustomEvent('jewel:select', {
        bubbles: true,
        detail: { item, value: item.dataset.value ?? item.textContent.trim() },
      }));
      if (role !== 'menuitemcheckbox') api.close();
    }

    menu.addEventListener('click', (e) => {
      const item = e.target.closest('[role^="menuitem"]');
      if (!item) return;
      if (item.getAttribute('aria-disabled') === 'true') { e.preventDefault(); return; }
      choose(item);
    });

    let typed = '';
    let typedAt = 0;
    menu.addEventListener('keydown', (e) => {
      const list = usable();
      const at = list.indexOf(document.activeElement);
      const go = (i) => { e.preventDefault(); list[(i + list.length) % list.length]?.focus(); };
      switch (e.key) {
        case 'ArrowDown': return go(at + 1);
        case 'ArrowUp': return go(at - 1);
        case 'Home': return go(0);
        case 'End': return go(list.length - 1);
        case 'Escape': e.preventDefault(); return api.close();
        case 'Tab': return api.close(false);
        case 'Enter':
        case ' ':
          if (document.activeElement.tagName !== 'A' || e.key === ' ') {
            e.preventDefault();
            choose(document.activeElement);
          }
          return;
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const now = Date.now();
            typed = now - typedAt > 600 ? e.key.toLowerCase() : typed + e.key.toLowerCase();
            typedAt = now;
            const match = list.find((i) => i.textContent.trim().toLowerCase().startsWith(typed));
            match?.focus();
          }
      }
    });
  });
})();
