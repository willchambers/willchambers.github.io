/* Password — the eye button shows and hides what was typed. The input
   goes back to hidden when its form is submitted, so a browser never
   saves the visible value in its history. */

Jewel.register('password', (el) => {
  const input = el.querySelector('input');
  const toggle = el.querySelector('.password__toggle');
  if (!input || !toggle) return;

  const noun = (toggle.getAttribute('aria-label') || 'Show password').replace(/^(Show|Hide)\s+/i, '');

  function set(visible) {
    input.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} ${noun}`);
  }

  toggle.addEventListener('click', () => {
    set(input.type === 'password');
    input.focus();
  });
  input.form?.addEventListener('submit', () => set(false));
});
