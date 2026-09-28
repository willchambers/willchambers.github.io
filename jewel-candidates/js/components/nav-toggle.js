/* Nav toggle — opens and closes the header nav on small screens.
   Markup: see css/components/nav-toggle.css. */

Jewel.register('nav-toggle', (header) => {
  const button = header.querySelector('[data-nav-toggle]');
  if (!button) return;

  const set = (open) => {
    header.dataset.state = open ? 'open' : 'closed';
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  set(false);

  button.addEventListener('click', () => set(header.dataset.state !== 'open'));

  header.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.dataset.state === 'open') {
      set(false);
      button.focus();
    }
  });

  // Growing past the breakpoint shows the inline nav again; reset the menu.
  matchMedia('(min-width: 40.0625rem)').addEventListener('change', (e) => {
    if (e.matches) set(false);
  });
});
