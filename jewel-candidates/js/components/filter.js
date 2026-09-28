/* Filter — tag buttons that hide non-matching items in a target container.
   Markup: see css/components/filter.css. data-filter="*" shows everything.
   Opening the page with #tag=<slug> starts on that tag. */

Jewel.register('filter', (group) => {
  const target = document.querySelector(group.dataset.filterTarget);
  if (!target) return;

  const buttons = [...group.querySelectorAll('[data-filter]')];
  const status = group.querySelector('.filter__status');
  const noun = group.dataset.filterNoun || 'items';

  const apply = (tag) => {
    if (!buttons.some((b) => b.dataset.filter === tag)) tag = '*';
    let shown = 0;
    target.querySelectorAll('[data-tags]').forEach((item) => {
      const match = tag === '*' || item.dataset.tags.split(/\s+/).includes(tag);
      item.hidden = !match;
      if (match) shown += 1;
    });
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === tag)));
    if (status) status.textContent = `Showing ${shown} ${noun}`;
  };

  group.addEventListener('click', (e) => {
    const button = e.target.closest('[data-filter]');
    if (!button) return;
    apply(button.dataset.filter);
    const hash = button.dataset.filter === '*' ? '' : `#tag=${button.dataset.filter}`;
    history.replaceState(null, '', location.pathname + location.search + hash);
  });

  const fromHash = location.hash.match(/^#tag=([\w-]+)$/);
  if (fromHash) apply(fromHash[1]);
});
