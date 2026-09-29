/* Tag input — see css/components/tag-input.css for markup.
   Keys: Enter or comma adds; Backspace in an empty box removes the last tag.
   Pasting "a, b, c" adds all three. Duplicates (case-insensitive) are
   rejected and the existing chip flashes. Leaving the box adds what's typed.

   Options (data-*): max="10", required, suggestions='["Street","Pond"]'
   The hidden input submits the tags as a JSON array of display strings.

   API: el.jewelTags
     .get() → string[]   .set(string[])   .add(text)   .remove(text)
     .setSuggestions(string[])
   Event: 'jewel:tagschange' (bubbles) with detail { tags } */

Jewel.register('tag-input', (root) => {
  const list = root.querySelector('.tag-input__list');
  const text = root.querySelector('.tag-input__text');
  const hidden = root.querySelector('input[type="hidden"]');
  const max = Number(root.dataset.max) || Infinity;
  const required = root.hasAttribute('data-required');
  let tags = [];
  let suggestions = [];
  try { suggestions = JSON.parse(root.dataset.suggestions || '[]'); } catch { suggestions = []; }

  // Live region for announcements ("Added Street, 3 of 10").
  const live = document.createElement('span');
  live.className = 'visually-hidden';
  live.setAttribute('aria-live', 'polite');
  root.append(live);
  const say = (msg) => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = msg; }); };

  // Suggestions row, rendered right after the input box.
  const sugWrap = document.createElement('div');
  sugWrap.className = 'tag-input__suggest';
  sugWrap.innerHTML = '<p class="field__hint" aria-hidden="true">Recent</p>';
  const sugList = document.createElement('ul');
  sugList.className = 'tag-input__suggestions';
  sugList.setAttribute('aria-label', 'Suggested tags');
  sugWrap.append(sugList);
  root.after(sugWrap);

  const norm = (s) => s.trim().replace(/\s+/g, ' ');
  const has = (s) => tags.some((t) => t.toLowerCase() === s.toLowerCase());
  const emit = () => root.dispatchEvent(new CustomEvent('jewel:tagschange', { bubbles: true, detail: { tags: [...tags] } }));

  function render() {
    list.replaceChildren(...tags.map((t) => {
      const li = document.createElement('li');
      li.className = 'chip';
      const label = document.createElement('span');
      label.textContent = t;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip__remove';
      btn.setAttribute('aria-label', `Remove tag ${t}`);
      btn.textContent = '×';
      btn.addEventListener('click', () => { api.remove(t); text.focus(); });
      li.append(label, btn);
      return li;
    }));
    hidden.value = tags.length ? JSON.stringify(tags) : '';
    const full = tags.length >= max;
    text.readOnly = full;
    text.placeholder = full ? `Limit of ${max} reached` : (text.dataset.placeholder ??= text.placeholder);
    renderSuggestions();
    validate();
  }

  function renderSuggestions() {
    const open = suggestions.filter((s) => !has(s));
    sugWrap.hidden = !open.length || tags.length >= max;
    sugList.replaceChildren(...open.map((s) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip--suggest';
      b.textContent = `+ ${s}`;
      b.setAttribute('aria-label', `Add tag ${s}`);
      b.addEventListener('click', () => { api.add(s); text.focus(); });
      li.append(b);
      return li;
    }));
  }

  function validate() {
    text.setCustomValidity(required && !tags.length ? 'Add at least one tag.' : '');
    if (text.getAttribute('aria-invalid') === 'true' && text.checkValidity()) Jewel.field?.clearError(text);
  }

  function flash(t) {
    const chip = [...list.children].find((li) => li.firstChild.textContent.toLowerCase() === t.toLowerCase());
    if (!chip) return;
    chip.classList.add('is-duplicate');
    setTimeout(() => chip.classList.remove('is-duplicate'), 900);
  }

  const api = {
    get: () => [...tags],
    set(next) { tags = []; (next || []).forEach((t) => { const n = norm(String(t)); if (n && !has(n) && tags.length < max) tags.push(n); }); render(); emit(); },
    add(raw) {
      const t = norm(String(raw || ''));
      if (!t) return false;
      if (has(t)) { flash(t); say(`${t} is already added`); return false; }
      if (tags.length >= max) { say(`Limit of ${max} tags reached`); return false; }
      tags.push(t);
      render(); emit();
      say(`Added ${t}${max < Infinity ? `, ${tags.length} of ${max}` : ''}`);
      return true;
    },
    remove(raw) {
      const i = tags.findIndex((t) => t.toLowerCase() === String(raw).toLowerCase());
      if (i < 0) return;
      const [t] = tags.splice(i, 1);
      render(); emit(); say(`Removed ${t}`);
    },
    setSuggestions(next) { suggestions = (next || []).map((s) => norm(String(s))).filter(Boolean); renderSuggestions(); },
  };
  root.jewelTags = api;

  const commit = () => {
    const parts = text.value.split(',');
    parts.forEach((p) => api.add(p));
    text.value = '';
  };

  text.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !text.value && tags.length) {
      e.preventDefault();
      api.remove(tags[tags.length - 1]);
    }
  });
  text.addEventListener('paste', (e) => {
    const s = e.clipboardData?.getData('text') || '';
    if (s.includes(',')) { e.preventDefault(); s.split(',').forEach((p) => api.add(p)); }
  });
  text.addEventListener('blur', () => { if (text.value.trim()) commit(); });
  text.addEventListener('jewel:validate', validate);
  root.addEventListener('click', (e) => { if (e.target === root || e.target === list) text.focus(); });
  text.form?.addEventListener('reset', () => setTimeout(() => api.set([])));

  render();
});
