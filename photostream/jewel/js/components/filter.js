/* Filter — tag buttons that hide non-matching items in a target container.
   Markup: see css/components/filter.css. data-filter="*" shows everything.
   Opening the page with #tag=<slug>, or following a #tag=<slug> link later,
   applies that tag. Buttons and items are looked up on every change, so
   markup rendered after the page loaded works too. */

Jewel.register('filter', (group) => {
  const target = document.querySelector(group.dataset.filterTarget);
  if (!target) return;

  const status = group.querySelector('.filter__status');
  const noun = group.dataset.filterNoun || 'items';
  const buttons = () => [...group.querySelectorAll('[data-filter]')];

  // Scrolling row (.filter--scroll): bring the pressed tag into view, e.g.
  // after a #tag= link picked one that was scrolled off. Only the row
  // scrolls sideways; the page doesn't move.
  const revealPressed = () => {
    if (!group.classList.contains('filter--scroll')) return;
    const b = group.querySelector('[aria-pressed="true"]');
    if (!b) return;
    const edge = parseFloat(getComputedStyle(group).scrollPaddingInlineStart) || 0;
    const row = group.getBoundingClientRect();
    const r = b.getBoundingClientRect();
    let dx = 0;
    if (r.left < row.left + edge) dx = r.left - row.left - edge;
    else if (r.right > row.right - edge) dx = r.right - row.right + edge;
    if (dx) group.scrollBy({ left: dx, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  const apply = (tag) => {
    if (!buttons().some((b) => b.dataset.filter === tag)) tag = '*';
    const items = target.querySelectorAll('[data-tags]');
    let shown = 0;
    items.forEach((item) => {
      const match = tag === '*' || item.dataset.tags.split(/\s+/).includes(tag);
      item.hidden = !match;
      if (match) shown += 1;
    });
    buttons().forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === tag)));
    revealPressed();
    // "Showing 1 of 3 projects" reads right for any count.
    if (status) status.textContent = `Showing ${shown} of ${items.length} ${noun}`;
  };

  const tagFromHash = () => location.hash.match(/^#tag=([\w-]+)$/)?.[1];

  group.addEventListener('click', (e) => {
    const button = e.target.closest('[data-filter]');
    if (!button || button.disabled || group.getAttribute('aria-disabled') === 'true') return;
    apply(button.dataset.filter);
    const hash = button.dataset.filter === '*' ? '' : `#tag=${button.dataset.filter}`;
    history.replaceState(null, '', location.pathname + location.search + hash);
  });

  // #tag= links elsewhere on the page (e.g. a tag on a post).
  window.addEventListener('hashchange', () => {
    if (group.isConnected) apply(tagFromHash() || '*');
  });

  if (tagFromHash()) apply(tagFromHash());
});
