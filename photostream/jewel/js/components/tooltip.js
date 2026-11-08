/* Tooltip — shows .tooltip__bubble while its trigger is hovered or has
   keyboard focus. The bubble opens in the top layer (Jewel.float), so a
   panel can't clip it; it flips above when there's no room below, and its
   pointer follows the trigger even when the bubble is nudged on screen.
   Esc hides it, and only it: inside a modal dialog the first Esc closes
   the tooltip and the next closes the dialog. Moving the pointer onto the
   bubble keeps it open (WCAG 1.4.13). The text stays linked by aria-describedby while hidden, so
   screen readers read it with the control. */

Jewel.register('tooltip', (el) => {
  const bubble = el.querySelector('.tooltip__bubble');
  const trigger = el.querySelector('[aria-describedby]') || el.firstElementChild;
  if (!bubble || !trigger) return;

  const DELAY = 300; // ms before showing on hover, so passing the pointer over doesn't flash it
  let unfloat = null;
  let timer = 0;

  function show() {
    clearTimeout(timer);
    if (unfloat) return;
    bubble.style.removeProperty('--tooltip-arrow-x');
    unfloat = Jewel.float(bubble, trigger, { align: 'center' });
    // Point at the trigger's middle, wherever the bubble ended up.
    const a = trigger.getBoundingClientRect();
    const b = bubble.getBoundingClientRect();
    bubble.style.setProperty('--tooltip-arrow-x', `${Math.round(a.left + a.width / 2 - b.left)}px`);
  }
  function hide() {
    clearTimeout(timer);
    unfloat?.();
    unfloat = null;
  }
  function hideSoon() {
    clearTimeout(timer);
    timer = setTimeout(hide, 100);
  }

  el.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch') return;
    clearTimeout(timer);
    timer = setTimeout(show, DELAY);
  });
  el.addEventListener('pointerleave', hideSoon);
  bubble.addEventListener('pointerenter', () => clearTimeout(timer));
  bubble.addEventListener('pointerleave', hideSoon);
  trigger.addEventListener('focus', () => { if (trigger.matches(':focus-visible')) show(); });
  trigger.addEventListener('blur', hide);
  trigger.addEventListener('click', hide);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !unfloat) return;
    e.preventDefault(); // keep a <dialog> around the trigger open
    hide();
  });
});
