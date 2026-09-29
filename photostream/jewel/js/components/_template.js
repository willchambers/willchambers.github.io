/* Component: <name>
   Copy to js/components/<name>.js and add to the page after jewel.js:
     <script src="js/components/<name>.js" defer></script>

   init(el) runs once for each element with data-component="<name>",
   including elements added later via Jewel.mount(container).

   Guidelines:
   - Keep state on the element (data-state="…") and let CSS style it.
   - Use aria-* for anything a screen reader should know.
   - Check Jewel.reducedMotion.matches before starting motion.
   - Listen for 'jewel:themechange' on <html> if you need to react to theme. */

Jewel.register('name', (el) => {
  const button = el.querySelector('[data-name-trigger]');

  button?.addEventListener('click', () => {
    const open = el.dataset.state === 'open';
    el.dataset.state = open ? 'closed' : 'open';
    button.setAttribute('aria-expanded', String(!open));
  });
});
