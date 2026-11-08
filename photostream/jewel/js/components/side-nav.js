/* Side nav — see css/components/side-nav.css for markup.
   Only needed when the nav sits in a .sheet--start drawer:
   - following a link closes the drawer (same-page anchors included);
   - the drawer closes itself when the screen grows past --bp-md, where
     the header shows its links again;
   - the menu button's aria-expanded follows the drawer. */

Jewel.register('side-nav', (nav) => {
  const dialog = nav.closest('dialog');
  if (!dialog) return;

  const close = () => dialog.jewelSheet ? dialog.jewelSheet.close({ force: true }) : dialog.close();

  nav.addEventListener('click', (e) => {
    if (e.target.closest('a[href]')) close();
  });

  const bp = getComputedStyle(document.documentElement).getPropertyValue('--bp-md').trim() || '48rem';
  const wide = matchMedia(`(min-width: ${bp})`);
  wide.addEventListener('change', () => { if (wide.matches && dialog.open) close(); });

  const openers = () => document.querySelectorAll(`[data-sheet-open="${dialog.id}"]`);
  const sync = (open) => openers().forEach((b) => b.setAttribute('aria-expanded', String(open)));
  sync(false);
  dialog.addEventListener('jewel:sheetopen', () => sync(true));
  dialog.addEventListener('jewel:sheetclose', () => sync(false));
});
