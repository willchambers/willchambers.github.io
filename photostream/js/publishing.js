// Posts on their way to the site, remembered on this phone so "Publishing…"
// survives the app being closed, and a failure can be retried.
//
//   { [id]: { state: 'publishing' | 'failed', title, pr?, error?, since } }
//
// A post leaves this list when it shows up in the site's /photos.json.

const KEY = 'photostream.publishing';

const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
};
const save = (all) => {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage full */ }
};

export const publishing = {
  all: load,
  get: (id) => load()[id] || null,
  set(id, record) {
    const all = load();
    all[id] = { ...all[id], ...record, since: all[id]?.since ?? Date.now() };
    save(all);
  },
  clear(id) {
    const all = load();
    delete all[id];
    save(all);
  },
  /** Ids still on their way (not failed). */
  pending: () => Object.entries(load()).filter(([, r]) => r.state === 'publishing').map(([id]) => id),
};
