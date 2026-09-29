/* Theme toggle — switches the page between light and dark.
   <button class="btn btn--ghost btn--icon toggle" type="button"
           data-component="theme-toggle" aria-pressed="false">
     <svg class="toggle__off">…moon…</svg>
     <svg class="toggle__on">…sun…</svg>
   </button> */

Jewel.register('theme-toggle', (btn) => {
  const sync = () => {
    const dark = Jewel.theme.get() === 'dark';
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  };

  btn.addEventListener('click', () => Jewel.theme.toggle());
  document.documentElement.addEventListener('jewel:themechange', sync);
  sync();
});
