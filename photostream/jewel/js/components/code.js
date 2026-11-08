/* Code snippet — see css/components/code.css for markup.
   Copies the <code> text (or the <pre>'s) with the Clipboard API, falling
   back to a selection + execCommand where that isn't allowed (http pages).
   The button says "Copied" for two seconds; a polite live region repeats
   it for screen readers. Event: 'jewel:copy' on .code, detail { text }. */

Jewel.register('code', (root) => {
  const button = root.querySelector('.code__copy');
  const source = root.querySelector('.code__body code') || root.querySelector('.code__body');
  if (!button || !source) return;

  const label = button.textContent.trim() || 'Copy';
  const live = document.createElement('span');
  live.className = 'visually-hidden';
  live.setAttribute('aria-live', 'polite');
  root.append(live);
  let timer;

  function fallbackCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok ? Promise.resolve() : Promise.reject(new Error('copy failed'));
  }

  function show(state, text) {
    button.dataset.state = state;
    button.textContent = text;
    live.textContent = text;
    clearTimeout(timer);
    timer = setTimeout(() => {
      delete button.dataset.state;
      button.textContent = label;
      live.textContent = '';
    }, 2000);
  }

  button.addEventListener('click', () => {
    const text = source.textContent.replace(/\n$/, '');
    const copy = navigator.clipboard?.writeText ? navigator.clipboard.writeText(text).catch(() => fallbackCopy(text)) : fallbackCopy(text);
    copy
      .then(() => {
        show('copied', 'Copied');
        root.dispatchEvent(new CustomEvent('jewel:copy', { bubbles: true, detail: { text } }));
      })
      .catch(() => show('failed', 'Press Ctrl+C to copy'));
  });
});
