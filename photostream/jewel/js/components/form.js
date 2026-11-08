/* Form — validation, counters, auto-grow, busy state and settable errors.
   Load this before other form components (tag-input, dropzone, post-form):
   they use Jewel.field to show errors.

   <form class="form" data-component="form" novalidate
         data-success="Saved.">…fields…
     <p class="form__error" role="alert"></p>
     <p class="form__status" role="status"></p>
   </form>

   Behavior
   - Validates each control on blur (after the first edit) and every control
     on submit, then focuses the first error.
   - Counters: add data-counter to an input/textarea with maxlength and a
     .field__counter in its .field.
   - On a valid submit it dispatches 'jewel:submit' (bubbles) with
     detail { formData, form, waitUntil(promise) }. If a listener passes a
     promise to waitUntil, the form is busy until it settles: resolve →
     success message and reset; reject → the draft stays and the error's
     message is shown as the form error.

   API (on the form element): form.jewelForm
     .validate() → boolean      .setBusy(bool)
     .setError(nameOrEl, msg)   .setFormError(msg)   .setStatus(msg)
     .clearErrors()             .isDirty()           .reset()

   Global helpers: Jewel.field.setError(control, msg), Jewel.field.clearError(control),
   Jewel.field.suggest(control, text), which fills a value only if the person
   hasn't typed in it yet and marks it "suggested" until they edit. */

(() => {
  let uid = 0;
  const idFor = (el, suffix) => {
    if (!el.id) el.id = `jewel-f${++uid}`;
    return `${el.id}-${suffix}`;
  };
  const describedBy = (el) => new Set((el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  const setDescribedBy = (el, set) => {
    if (set.size) el.setAttribute('aria-describedby', [...set].join(' '));
    else el.removeAttribute('aria-describedby');
  };

  /* ---- Field-level helpers (shared with other components) --------------- */
  const field = {
    errorEl(control) {
      const wrap = control.closest('.field');
      if (!wrap) return null;
      let err = wrap.querySelector(':scope > .field__error');
      if (!err) {
        err = document.createElement('p');
        err.className = 'field__error';
        err.hidden = true;
        wrap.append(err);
      }
      if (!err.id) err.id = idFor(control, 'error');
      return err;
    },
    setError(control, msg) {
      if (!msg) return field.clearError(control);
      const err = field.errorEl(control);
      control.setAttribute('aria-invalid', 'true');
      if (err) {
        err.textContent = msg;
        err.hidden = false;
        const ids = describedBy(control); ids.add(err.id); setDescribedBy(control, ids);
      }
    },
    clearError(control) {
      control.removeAttribute('aria-invalid');
      const err = control.closest('.field')?.querySelector(':scope > .field__error');
      if (err) {
        err.hidden = true;
        err.textContent = '';
        const ids = describedBy(control); ids.delete(err.id); setDescribedBy(control, ids);
      }
    },
    labelText(control) {
      const label = control.labels?.[0] || control.closest('.field')?.querySelector('.field__label');
      const text = label ? [...label.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() : '';
      return text || 'This field';
    },
    message(control) {
      const v = control.validity;
      const name = field.labelText(control);
      if (v.valueMissing) return control.dataset.msgRequired || (control.type === 'file' ? 'Add a photo.' : `${name} is required.`);
      if (v.tooLong) return control.dataset.msgTooLong || `${name} is too long.`;
      if (v.tooShort) return control.dataset.msgTooShort || `${name} is too short.`;
      if (v.typeMismatch) return control.dataset.msgType || `Enter a valid ${name.toLowerCase()}.`;
      if (v.patternMismatch) return control.dataset.msgPattern || `${name} isn't in the right format.`;
      if (v.customError) return control.validationMessage;
      return control.validationMessage;
    },
    // Fill a suggested value without clobbering anything the person typed.
    suggest(control, text) {
      if (control.dataset.touched === 'true' && !control.hasAttribute('data-suggested')) return false;
      control.value = text || '';
      if (text) control.setAttribute('data-suggested', '');
      else control.removeAttribute('data-suggested');
      const badge = control.closest('.field')?.querySelector('.field__badge');
      if (badge) badge.hidden = !text;
      control.dispatchEvent(new Event('jewel:suggest', { bubbles: true }));
      updateCounter(control);
      return true;
    },
  };

  function updateCounter(control) {
    if (!control.hasAttribute('data-counter')) return;
    const out = control.closest('.field')?.querySelector('.field__counter');
    const max = control.maxLength > 0 ? control.maxLength : Number(control.dataset.counter) || 0;
    if (!out || !max) return;
    const n = control.value.length;
    out.textContent = `${n} / ${max}`;
    out.classList.toggle('is-over', n > max);
  }

  const growable = !CSS.supports?.('field-sizing', 'content');
  function autogrow(el) {
    if (!growable || el.tagName !== 'TEXTAREA') return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }

  /* ---- Form component --------------------------------------------------- */
  Jewel.register('form', (form) => {
    form.noValidate = true;
    let dirty = false;
    let busy = false;
    const formError = form.querySelector('.form__error');
    const formStatus = form.querySelector('.form__status');
    const controls = () => [...form.elements].filter((el) => el.willValidate || el.type === 'file');

    const validateOne = (el) => {
      if (!el.willValidate) return true;
      // Components can set a custom message first (see tag-input, dropzone).
      el.dispatchEvent(new Event('jewel:validate'));
      if (el.checkValidity()) { field.clearError(el); return true; }
      field.setError(el, field.message(el));
      return false;
    };

    const api = {
      validate() {
        let first = null;
        controls().forEach((el) => { if (!validateOne(el) && !first) first = el; });
        if (first) {
          first.focus({ preventScroll: true });
          first.closest('.field, .dropzone')?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        }
        return !first;
      },
      setBusy(on) {
        busy = !!on;
        form.setAttribute('aria-busy', String(busy));
        form.querySelectorAll('button[type="submit"], .btn[data-submit]').forEach((b) => {
          b.setAttribute('aria-busy', String(busy));
          b.disabled = busy;
          if (!b.dataset.busyLabel) return;
          if (busy) {
            b.dataset.idleLabel = b.textContent;
            b.textContent = b.dataset.busyLabel;
          } else {
            // Put the label back only if it still shows the busy text. If the
            // app changed the text while busy ("Retry", "Uploading 2 of 3"),
            // keep the app's text. The app can also set data-idle-label while
            // busy to choose what comes back.
            if (b.textContent === b.dataset.busyLabel && b.dataset.idleLabel != null) b.textContent = b.dataset.idleLabel;
            delete b.dataset.idleLabel;
          }
        });
      },
      setError(target, msg) {
        const el = typeof target === 'string' ? form.elements[target] : target;
        const control = el instanceof RadioNodeList ? el[0] : el;
        if (control) field.setError(control, msg);
      },
      setFormError(msg) {
        if (!formError) return;
        formError.textContent = msg || '';
        formError.hidden = !msg;
      },
      setStatus(msg) {
        if (!formStatus) return;
        formStatus.textContent = msg || '';
        formStatus.hidden = !msg;
      },
      clearErrors() {
        controls().forEach((el) => field.clearError(el));
        api.setFormError('');
      },
      isDirty: () => dirty,
      reset() {
        form.reset();                 // components listen for the 'reset' event
        dirty = false;
        controls().forEach((el) => { delete el.dataset.touched; el.removeAttribute('data-suggested'); });
        form.querySelectorAll('.field__badge').forEach((b) => { b.hidden = true; });
        requestAnimationFrame(() => form.querySelectorAll('[data-counter]').forEach(updateCounter));
        api.clearErrors();
      },
    };
    form.jewelForm = api;

    form.addEventListener('input', (e) => {
      const el = e.target;
      dirty = true;
      el.dataset.touched = 'true';
      if (el.hasAttribute('data-suggested')) {
        el.removeAttribute('data-suggested');
        const badge = el.closest('.field')?.querySelector('.field__badge');
        if (badge) badge.hidden = true;
      }
      updateCounter(el);
      autogrow(el);
      if (el.getAttribute('aria-invalid') === 'true') validateOne(el);   // clear as soon as it's fixed
      api.setStatus('');
    });
    form.addEventListener('change', (e) => { dirty = true; e.target.dataset.touched = 'true'; });
    form.addEventListener('focusout', (e) => {
      const el = e.target;
      if (el.dataset?.touched === 'true') validateOne(el);
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      api.setFormError('');
      api.setStatus('');
      if (!api.validate()) {
        api.setFormError(form.dataset.msgInvalid || 'Check the highlighted fields.');
        return;
      }
      const pending = [];
      const detail = { form, formData: new FormData(form), waitUntil: (p) => pending.push(Promise.resolve(p)) };
      form.dispatchEvent(new CustomEvent('jewel:submit', { bubbles: true, detail }));
      if (!pending.length) {
        api.reset();
        api.setStatus(form.dataset.success || 'Done.');
        return;
      }
      api.setBusy(true);
      try {
        await Promise.all(pending);
        api.reset();
        api.setStatus(form.dataset.success || 'Done.');
      } catch (err) {
        api.setFormError(err?.message || 'Something went wrong. Your draft is still here.');
      } finally {
        api.setBusy(false);
      }
    });

    form.querySelectorAll('[data-counter]').forEach(updateCounter);
    form.querySelectorAll('textarea').forEach(autogrow);
  });

  Jewel.field = field;
})();
