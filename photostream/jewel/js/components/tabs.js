/* Tabs — see css/components/tabs.css for markup.
   Follows the WAI-ARIA tabs pattern with automatic activation: arrow keys
   move and select, Home/End jump to the ends, disabled tabs are skipped.
   Only the selected tab is in the tab order; Tab moves on into its panel.

   data-tabs-hash on .tabs: selecting a tab writes #<panel id> to the URL,
   and loading that URL opens it.
   Events: 'jewel:tabchange' on .tabs, detail { tab, panel, index }.
   API: el.jewelTabs.select(index) */

(() => {
  let uid = 0;

  Jewel.register('tabs', (root) => {
    const list = root.querySelector('[role="tablist"]');
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const panels = [...root.querySelectorAll(':scope > [role="tabpanel"]')];
    const base = root.id || `jewel-tabs${++uid}`;

    tabs.forEach((tab, i) => {
      const panel = panels[i];
      if (!panel) return;
      tab.id ||= `${base}-tab${i}`;
      panel.id ||= `${base}-panel${i}`;
      tab.setAttribute('aria-controls', panel.id);
      panel.setAttribute('aria-labelledby', tab.id);
      if (!panel.querySelector('a, button, input, select, textarea, [tabindex]')) panel.tabIndex = 0;
    });

    function select(index, { focus = false, fromHash = false } = {}) {
      const tab = tabs[index];
      if (!tab || tab.disabled) return;
      tabs.forEach((t, i) => {
        const on = i === index;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        if (panels[i]) panels[i].hidden = !on;
      });
      if (focus) tab.focus();
      // Bring the tab into view inside a scrolling row, without scrolling the page.
      const lr = list.getBoundingClientRect();
      const tr = tab.getBoundingClientRect();
      if (tr.left < lr.left) list.scrollLeft -= lr.left - tr.left;
      else if (tr.right > lr.right) list.scrollLeft += tr.right - lr.right;
      if ('tabsHash' in root.dataset && !fromHash && panels[index]) {
        history.replaceState(null, '', `#${panels[index].id}`);
      }
      root.dispatchEvent(new CustomEvent('jewel:tabchange', { bubbles: true, detail: { tab, panel: panels[index], index } }));
    }

    const enabled = () => tabs.filter((t) => !t.disabled);
    function step(from, dir) {
      const on = enabled();
      const at = on.indexOf(tabs[from]);
      return tabs.indexOf(on[(at + dir + on.length) % on.length]);
    }

    list.addEventListener('click', (e) => {
      const tab = e.target.closest('[role="tab"]');
      if (tab) select(tabs.indexOf(tab));
    });
    list.addEventListener('keydown', (e) => {
      const current = tabs.indexOf(document.activeElement);
      if (current < 0) return;
      const vertical = list.getAttribute('aria-orientation') === 'vertical';
      const next = { [vertical ? 'ArrowDown' : 'ArrowRight']: 1, [vertical ? 'ArrowUp' : 'ArrowLeft']: -1 }[e.key];
      let to = null;
      if (next) to = step(current, next);
      else if (e.key === 'Home') to = tabs.indexOf(enabled()[0]);
      else if (e.key === 'End') to = tabs.indexOf(enabled().at(-1));
      if (to === null) return;
      e.preventDefault();
      select(to, { focus: true });
    });

    const fromHash = () => {
      const i = panels.findIndex((p) => `#${p.id}` === location.hash);
      if (i >= 0) select(i, { fromHash: true });
    };

    let initial = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true' && !t.disabled);
    if (initial < 0) initial = tabs.indexOf(enabled()[0]);
    select(initial, { fromHash: true });
    if ('tabsHash' in root.dataset) { fromHash(); addEventListener('hashchange', fromHash); }

    root.jewelTabs = { select: (i) => select(i) };
  });
})();
