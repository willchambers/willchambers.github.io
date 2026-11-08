/* Accordion — optional. Native <details> does the work (see
   css/components/accordion.css); this script adds:
   - aria-disabled="true" on a summary keeps that item shut;
   - name="…" exclusivity for browsers without native support;
   - API: el.jewelAccordion.openAll() / .closeAll() (multi-open accordions). */

Jewel.register('accordion', (root) => {
  const items = () => [...root.querySelectorAll(':scope > .accordion__item')];

  root.addEventListener('click', (e) => {
    const head = e.target.closest('.accordion__head');
    if (head?.getAttribute('aria-disabled') === 'true') e.preventDefault();
  });

  // Fallback for the native exclusive accordion (details[name]).
  const nativeExclusive = 'name' in HTMLDetailsElement.prototype;
  if (!nativeExclusive) {
    root.addEventListener('toggle', (e) => {
      const item = e.target;
      const name = item.getAttribute?.('name');
      if (!item.open || !name) return;
      items().forEach((other) => { if (other !== item && other.getAttribute('name') === name) other.open = false; });
    }, true);
  }

  root.jewelAccordion = {
    openAll: () => items().forEach((d) => { if (d.querySelector('.accordion__head')?.getAttribute('aria-disabled') !== 'true') d.open = true; }),
    closeAll: () => items().forEach((d) => { d.open = false; }),
  };
});
