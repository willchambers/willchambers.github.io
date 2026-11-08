// Posts on their way to the site, remembered on this phone so "Publishing…"
// survives the app being closed, and a failure can be retried.
//
//   { [id]: { state: 'publishing' | 'failed', title, pr?, merged?, error?, since } }
//
// A post leaves this list when it shows up in the site's /photos.json.

const KEY = 'photostream.publishing';

// How long a merged post can take to appear on the site before the app says so.
export const GIVE_UP_AFTER = 15 * 60_000;
// How long one publish can run. It's normally seconds; past this it has hung.
const HUNG_AFTER = 5 * 60_000;

// Publishes this page is doing right now: id → when it started. An iPhone can
// suspend or end a home-screen app mid-publish, and this list doesn't survive
// that, so it tells a publish still running from one that stopped.
const running = new Map();

const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
};
const save = (all) => {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage full */ }
};

export const publishing = {
  all: load,
  set(id, record) {
    const all = load();
    all[id] = { ...all[id], ...record, since: record.since ?? all[id]?.since ?? Date.now() };
    save(all);
  },
  clear(id) {
    const all = load();
    delete all[id];
    save(all);
  },
  begin(id) { running.set(id, Date.now()); },
  end(id) { running.delete(id); },
  /** Still expected on the site: being published now, or merged and building. */
  onItsWay(id, record = load()[id]) {
    if (record?.state !== 'publishing') return false;
    if (Date.now() - (running.get(id) ?? 0) < HUNG_AFTER) return true;
    return Boolean(record.merged) && Date.now() - record.since < GIVE_UP_AFTER;
  },
};
