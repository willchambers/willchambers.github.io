/* Drop zone — see css/components/dropzone.css for markup.
   One image, from drag-and-drop or the native picker (no capture attribute,
   so phones offer both the library and the camera). Shows a preview with
   the file's name, size and pixel dimensions, and Replace / Remove.

   Options (data-*): max-size="20" (MB). accept and required go on the input.

   API: el.jewelDropzone
     .setFile(fileOrBlob, name?)  show and submit a file you've processed
                                  (e.g. resized to WebP). Doesn't re-fire the
                                  user pick event.
     .getFile() → File | null     .clear()
   Event: 'jewel:filechange' (bubbles) with detail { file, source: 'user' | 'api' | 'clear' } */

Jewel.register('dropzone', (root) => {
  const input = root.querySelector('.dropzone__input');
  const empty = root.querySelector('.dropzone__empty');
  const preview = root.querySelector('.dropzone__preview');
  const img = preview?.querySelector('img');
  const meta = root.querySelector('.dropzone__meta');
  const actions = root.querySelector('.dropzone__actions');
  const maxMB = Number(root.dataset.maxSize) || 0;
  let file = null;
  let url = null;

  const accepts = (f) => {
    const rules = (input.accept || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!rules.length) return true;
    return rules.some((r) => r.endsWith('/*') ? f.type.startsWith(r.slice(0, -1)) : r.startsWith('.') ? f.name.toLowerCase().endsWith(r) : f.type === r);
  };
  const size = (b) => b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`;
  const setError = (msg) => (msg ? Jewel.field?.setError(input, msg) : Jewel.field?.clearError(input));

  function show(f) {
    if (url) URL.revokeObjectURL(url);
    url = f ? URL.createObjectURL(f) : null;
    root.dataset.state = f ? 'filled' : 'empty';
    empty.hidden = !!f;
    if (preview) preview.hidden = !f;
    if (actions) actions.hidden = !f;
    if (img) {
      img.src = url || '';
      img.alt = f ? `Preview of ${f.name}` : '';
      if (f && meta) {
        meta.textContent = `${f.name} · ${size(f.size)}`;
        img.onload = () => { meta.textContent = `${f.name} · ${size(f.size)} · ${img.naturalWidth} × ${img.naturalHeight}`; };
      }
    }
  }

  // Put a file into the real input so it submits with the form.
  function assign(f) {
    const dt = new DataTransfer();
    if (f) dt.items.add(f);
    input.files = dt.files;
  }

  function take(f, source) {
    if (!f) return;
    if (!accepts(f)) { setError('That file isn’t an image. Choose a JPG, PNG, HEIC or WebP.'); return; }
    if (maxMB && f.size > maxMB * 1e6) { setError(`That photo is ${size(f.size)}. The limit is ${maxMB} MB.`); return; }
    setError('');
    file = f;
    assign(f);
    show(f);
    root.dispatchEvent(new CustomEvent('jewel:filechange', { bubbles: true, detail: { file: f, source } }));
    input.dispatchEvent(new Event('input', { bubbles: true }));   // marks the form dirty
  }

  const api = {
    setFile(blob, name) {
      if (!blob) return api.clear();
      const f = blob instanceof File ? blob : new File([blob], name || file?.name || 'photo', { type: blob.type });
      setError('');
      file = f;
      assign(f);
      show(f);
      root.dispatchEvent(new CustomEvent('jewel:filechange', { bubbles: true, detail: { file: f, source: 'api' } }));
    },
    getFile: () => file,
    clear() {
      file = null;
      assign(null);
      show(null);
      root.dispatchEvent(new CustomEvent('jewel:filechange', { bubbles: true, detail: { file: null, source: 'clear' } }));
    },
  };
  root.jewelDropzone = api;

  input.addEventListener('change', () => {
    const f = input.files?.[0];
    if (f) take(f, 'user');
    else if (file) assign(file);          // picker canceled: keep the current photo
  });

  // Drag and drop. A counter handles dragenter/leave firing on children.
  let depth = 0;
  root.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; root.dataset.state = 'dragover'; });
  root.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  root.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; root.dataset.state = file ? 'filled' : 'empty'; } });
  root.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0;
    root.dataset.state = file ? 'filled' : 'empty';
    const f = e.dataTransfer.files?.[0];
    take(f, 'user');
    if (e.dataTransfer.files.length > 1 && file === f) setError('One photo per post. The first one was used.');
  });

  root.querySelector('[data-dropzone-replace]')?.addEventListener('click', () => input.click());
  root.querySelector('[data-dropzone-remove]')?.addEventListener('click', () => {
    api.clear();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
  input.form?.addEventListener('reset', () => setTimeout(() => { file = null; show(null); }));

  show(null);
});
