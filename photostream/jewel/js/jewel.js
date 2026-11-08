/* Jewel Design System — core.
   - Jewel.theme: get/set the page theme; persisted, defaults to the OS.
   - Jewel.register(name, init): component registry. Every element with
     data-component="<name>" is passed to init(el) once the DOM is ready.
   - Jewel.float(layer, anchor, options): shows a menu, calendar or list
     next to its anchor in the top layer, so no panel can clip it.

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

  /* ---- Floating layers ---------------------------------------------------
     Menus, calendars and suggestion lists open in the top layer (popover),
     so a content panel's knockout mask or overflow can't clip them, and are
     placed next to their anchor with position: fixed. They flip above the
     anchor when there's no room below. Without popover support they fall
     back to their CSS position (absolute, under the anchor).
     options: align 'start' | 'end' | 'center', width 'min' (at least the anchor's) |
     'match' (exactly the anchor's) | null.
     Returns close(), which hides the layer and stops tracking. */
  function float(layer, anchor, { align = 'start', width = null } = {}) {
    const top = typeof layer.showPopover === 'function';
    layer.hidden = false;
    if (!top) return () => { layer.hidden = true; };
    if (!layer.hasAttribute('popover')) layer.setAttribute('popover', 'manual');
    layer.classList.add('is-floating');
    if (!layer.matches(':popover-open')) layer.showPopover();
    const gap = parseFloat(getComputedStyle(root).getPropertyValue('--space-1')) * parseFloat(getComputedStyle(root).fontSize) || 4;
    const edge = gap * 2;
    const place = () => {
      const a = anchor.getBoundingClientRect();
      if (width === 'min') layer.style.minWidth = `${a.width}px`;
      if (width === 'match') layer.style.width = `${a.width}px`;
      const r = layer.getBoundingClientRect();
      const below = a.bottom + gap + r.height <= innerHeight || innerHeight - a.bottom >= a.top;
      let y = below ? a.bottom + gap : a.top - gap - r.height;
      // Taller than the space on either side (a calendar on a phone): keep it on screen.
      y = Math.max(edge, Math.min(y, innerHeight - r.height - edge));
      let x = align === 'end' ? a.right - r.width
        : align === 'center' ? a.left + (a.width - r.width) / 2
        : a.left;
      x = Math.max(edge, Math.min(x, innerWidth - r.width - edge));
      layer.style.top = `${Math.round(y)}px`;
      layer.style.left = `${Math.round(x)}px`;
      layer.dataset.side = below ? 'bottom' : 'top';
    };
    place();
    addEventListener('scroll', place, true);
    addEventListener('resize', place);
    return () => {
      removeEventListener('scroll', place, true);
      removeEventListener('resize', place);
      if (layer.matches(':popover-open')) layer.hidePopover();
      layer.hidden = true;
    };
  }

  window.Jewel = {
    theme,
    register,
    float,
    /** Call after inserting new markup (e.g. fetched content) to wire it up. */
    mount,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)'),
  };
})();
