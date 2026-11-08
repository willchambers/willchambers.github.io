/* Date picker — see css/components/datepicker.css for markup.

   Typing: the field accepts the page language's order (en-GB 5/10/2026,
   en-US 10/5/2026) and ISO (2026-10-05); it's tidied on blur. A date it
   can't read, or one outside min/max, sets a custom validity message, so
   form.js shows it like any other field error.

   Calendar (opened by the button, or Alt+↓ in the field): a grid of day
   buttons with one tab stop. ← → a day, ↑ ↓ a week, Home/End the week's
   ends, PageUp/PageDown a month (Shift: a year), Enter picks, Esc closes
   and returns focus to the button. A click outside closes it.

   Events: 'jewel:datechange' on .datepicker (bubbles), detail { date, value }
   (value is YYYY-MM-DD, or '' when cleared).
   API: el.jewelDatepicker.value (get/set ISO), .open(), .close() */

(() => {
  let uid = 0;
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '');
  const day = (y, m, d) => { const x = new Date(y, m, d); x.setHours(12); return x; };   // noon: no DST edge cases
  const same = (a, b) => a && b && iso(a) === iso(b);
  const today = () => { const n = new Date(); return day(n.getFullYear(), n.getMonth(), n.getDate()); };
  const fromIso = (s) => {
    if (s === 'today') return today();
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s || '');
    if (!m) return null;
    const d = day(+m[1], +m[2] - 1, +m[3]);
    return d.getMonth() === +m[2] - 1 ? d : null;
  };
  const addDays = (d, n) => day(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const addMonths = (d, n) => {
    const last = day(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
    return day(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last));
  };

  Jewel.register('datepicker', (root) => {
    const input = root.querySelector('.datepicker__input');
    const toggle = root.querySelector('.datepicker__toggle');
    const hidden = root.querySelector('input[type="hidden"]');
    if (!input || !toggle) return;
    const id = `jewel-dp${++uid}`;
    const lang = document.documentElement.lang || navigator.language || 'en-GB';
    const min = fromIso(root.dataset.min);
    const max = fromIso(root.dataset.max);
    const weekStart = Number(root.dataset.weekStart ?? 1);

    // Field order and separator from the locale, e.g. ['day','month','year'] and '/'.
    const parts = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(day(2026, 9, 5));
    const order = parts.filter((p) => p.type !== 'literal').map((p) => p.type);
    const sep = parts.find((p) => p.type === 'literal')?.value || '/';
    const format = (d) => order.map((t) => (t === 'day' ? d.getDate() : t === 'month' ? d.getMonth() + 1 : d.getFullYear())).join(sep);
    if (!input.placeholder) input.placeholder = order.map((t) => ({ day: 'DD', month: 'MM', year: 'YYYY' }[t])).join(sep);

    const monthFmt = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' });
    const dayFmt = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const wdShort = new Intl.DateTimeFormat(lang, { weekday: 'short' });
    const wdLong = new Intl.DateTimeFormat(lang, { weekday: 'long' });

    function parse(text) {
      const t = text.trim();
      if (!t) return null;
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t)) return fromIso(t);
      const nums = t.split(/[^\d]+/).filter(Boolean).map(Number);
      if (nums.length !== 3) return undefined;
      const f = Object.fromEntries(order.map((k, i) => [k, nums[i]]));
      if (f.year < 100) f.year += 2000;
      const d = day(f.year, f.month - 1, f.day);
      return d.getDate() === f.day && d.getMonth() === f.month - 1 ? d : undefined;
    }
    const outOfRange = (d) => (min && d < min) || (max && d > max);

    let value = null;
    let view = today();

    function setValue(d, { announce = true, write = true } = {}) {
      value = d;
      if (write) input.value = d ? format(d) : '';
      if (hidden) hidden.value = iso(d);
      input.setCustomValidity('');
      if (window.Jewel.field && input.getAttribute('aria-invalid') === 'true') Jewel.field.clearError(input);
      if (announce) root.dispatchEvent(new CustomEvent('jewel:datechange', { bubbles: true, detail: { date: d, value: iso(d) } }));
    }

    function check() {
      const d = parse(input.value);
      if (d === null) { setValue(null, { write: false }); return; }
      if (d === undefined) {
        value = null;
        if (hidden) hidden.value = '';
        input.setCustomValidity(`Enter a date like ${format(today())}.`);
        return;
      }
      if (outOfRange(d)) {
        value = null;
        if (hidden) hidden.value = '';
        const msg = min && max ? `Choose a date from ${format(min)} to ${format(max)}.`
          : min ? `Choose a date on or after ${format(min)}.` : `Choose a date on or before ${format(max)}.`;
        input.setCustomValidity(msg);
        return;
      }
      setValue(d);
    }
    input.addEventListener('change', check);
    input.addEventListener('blur', () => { if (value) input.value = format(value); });

    // ---- Calendar ---------------------------------------------------------
    const panel = document.createElement('div');
    panel.className = 'datepicker__panel';
    panel.id = `${id}-panel`;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Choose date');
    panel.hidden = true;
    panel.innerHTML = `
      <div class="datepicker__head">
        <button class="datepicker__nav datepicker__nav--prev" type="button" aria-label="Previous month"></button>
        <p class="datepicker__month" id="${id}-month" aria-live="polite"></p>
        <button class="datepicker__nav datepicker__nav--next" type="button" aria-label="Next month"></button>
      </div>
      <table class="datepicker__grid" role="grid" aria-labelledby="${id}-month">
        <thead><tr></tr></thead><tbody></tbody>
      </table>
      <div class="datepicker__foot">
        <button class="btn btn--text" type="button" data-dp-today>Today</button>
        <button class="btn btn--text" type="button" data-dp-clear>Clear</button>
      </div>`;
    root.append(panel);
    const monthEl = panel.querySelector('.datepicker__month');
    const prev = panel.querySelector('.datepicker__nav--prev');
    const next = panel.querySelector('.datepicker__nav--next');
    const body = panel.querySelector('tbody');

    const head = panel.querySelector('thead tr');
    for (let i = 0; i < 7; i++) {
      const d = day(2026, 9, 4 + ((weekStart + i) % 7));   // 4 Oct 2026 is a Sunday
      head.insertAdjacentHTML('beforeend', `<th scope="col" abbr="${wdLong.format(d)}">${wdShort.format(d).slice(0, 2)}</th>`);
    }
    if (outOfRange(today())) panel.querySelector('[data-dp-today]').disabled = true;

    toggle.setAttribute('aria-haspopup', 'dialog');
    toggle.setAttribute('aria-controls', panel.id);
    toggle.setAttribute('aria-expanded', 'false');

    function render(focus) {
      monthEl.textContent = monthFmt.format(view);
      const first = day(view.getFullYear(), view.getMonth(), 1);
      const start = addDays(first, -((first.getDay() - weekStart + 7) % 7));
      let html = '';
      for (let w = 0; w < 6; w++) {
        html += '<tr>';
        for (let i = 0; i < 7; i++) {
          const d = addDays(start, w * 7 + i);
          const cls = d.getMonth() !== view.getMonth() ? ' is-outside' : '';
          html += `<td><button class="datepicker__day${cls}" type="button" tabindex="-1" data-date="${iso(d)}"
            aria-label="${dayFmt.format(d)}"${same(d, value) ? ' aria-pressed="true"' : ''}${same(d, today()) ? ' aria-current="date"' : ''}${outOfRange(d) ? ' disabled' : ''}>${d.getDate()}</button></td>`;
        }
        html += '</tr>';
      }
      body.innerHTML = html;
      prev.disabled = !!min && addMonths(first, -1) < day(min.getFullYear(), min.getMonth(), 1);
      next.disabled = !!max && addMonths(first, 1) > max;
      const target = body.querySelector(`[data-date="${iso(view)}"]`);
      if (target) { target.tabIndex = 0; if (focus) target.focus(); }
    }

    function clamp(d) { return min && d < min ? min : max && d > max ? max : d; }

    let unfloat = null;

    function open() {
      if (!panel.hidden) return;
      view = clamp(value || today());
      render();
      unfloat = Jewel.float(panel, root, { align: root.dataset.align === 'end' ? 'end' : 'start' });
      toggle.setAttribute('aria-expanded', 'true');
      body.querySelector('[tabindex="0"]')?.focus();
    }
    function close(returnFocus = true) {
      if (panel.hidden) return;
      unfloat?.();
      unfloat = null;
      toggle.setAttribute('aria-expanded', 'false');
      if (returnFocus) toggle.focus();
    }

    toggle.addEventListener('click', () => (panel.hidden ? open() : close()));
    input.addEventListener('keydown', (e) => { if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); open(); } });
    prev.addEventListener('click', () => { view = clamp(addMonths(view, -1)); render(); });
    next.addEventListener('click', () => { view = clamp(addMonths(view, 1)); render(); });
    panel.querySelector('[data-dp-today]').addEventListener('click', () => { setValue(today()); close(); });
    panel.querySelector('[data-dp-clear]').addEventListener('click', () => { setValue(null); close(false); input.focus(); });

    body.addEventListener('click', (e) => {
      const b = e.target.closest('.datepicker__day');
      if (!b || b.disabled) return;
      setValue(fromIso(b.dataset.date));
      close();
    });
    body.addEventListener('keydown', (e) => {
      const moves = {
        ArrowLeft: () => addDays(view, -1), ArrowRight: () => addDays(view, 1),
        ArrowUp: () => addDays(view, -7), ArrowDown: () => addDays(view, 7),
        Home: () => addDays(view, -((view.getDay() - weekStart + 7) % 7)),
        End: () => addDays(view, 6 - ((view.getDay() - weekStart + 7) % 7)),
        PageUp: () => addMonths(view, e.shiftKey ? -12 : -1),
        PageDown: () => addMonths(view, e.shiftKey ? 12 : 1),
      };
      if (moves[e.key]) { e.preventDefault(); view = clamp(moves[e.key]()); render(true); }
    });
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
    document.addEventListener('pointerdown', (e) => { if (!root.contains(e.target)) close(false); });
    root.addEventListener('focusout', (e) => { if (!panel.hidden && e.relatedTarget && !root.contains(e.relatedTarget)) close(false); });

    const initial = fromIso(root.dataset.value || hidden?.value || '');
    if (initial) setValue(initial, { announce: false });
    else if (input.value) check();

    root.jewelDatepicker = {
      get value() { return iso(value); },
      set value(s) { setValue(fromIso(s)); },
      open, close,
    };
  });
})();
