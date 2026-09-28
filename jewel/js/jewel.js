/* Jewel Design System — core.
   - Jewel.theme: get/set the page theme; persisted, defaults to the OS.
   - Jewel.register(name, init): component registry. Every element with
     data-component="<name>" is passed to init(el) once the DOM is ready.

   Load order (all with `defer`, which runs them in document order before
   DOMContentLoaded):
     <script src="js/jewel.js" defer></script>
     <script src="js/components/<name>.js" defer></script>  …one per component */

(() => {
  const root = document.documentElement;
  const THEME_KEY = 'jewel-theme';

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  /* ---- Theme ------------------------------------------------------------ */
  const darkQuery = matchMedia('(prefers-color-scheme: dark)');

  const theme = {
    /** 'light' | 'dark' — what the page is showing right now. */
    get() { return root.dataset.theme || (darkQuery.matches ? 'dark' : 'light'); },
    set(value) {
      root.dataset.theme = value;
      store.set(THEME_KEY, value);
      root.dispatchEvent(new CustomEvent('jewel:themechange', { detail: value }));
    },
    toggle() { theme.set(theme.get() === 'dark' ? 'light' : 'dark'); },
  };

  // Until the viewer picks a theme, keep following the OS.
  darkQuery.addEventListener('change', () => {
    if (!store.get(THEME_KEY)) {
      root.dispatchEvent(new CustomEvent('jewel:themechange', { detail: theme.get() }));
    }
  });

  /* ---- Component registry ---------------------------------------------- */
  const registry = new Map();
  const mounted = new WeakMap(); // element → Set of component names already run
  let ready = false;

  // data-component may list several names ("form post-form"); they run in
  // the order written, each once per element.
  function mount(scope = document) {
    scope.querySelectorAll('[data-component]').forEach((el) => {
      const done = mounted.get(el) || new Set();
      mounted.set(el, done);
      el.dataset.component.split(/\s+/).filter(Boolean).forEach((name) => {
        const init = registry.get(name);
        if (!init || done.has(name)) return;
        done.add(name);
        try { init(el); } catch (err) { console.error(`[jewel] ${name}:`, err); }
      });
    });
  }

  function register(name, init) {
    registry.set(name, init);
    if (ready) mount(); // registered late: mount straight away
  }

  document.addEventListener('DOMContentLoaded', () => { ready = true; mount(); });

  window.Jewel = {
    theme,
    register,
    /** Call after inserting new markup (e.g. fetched content) to wire it up. */
    mount,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)'),
  };
})();
