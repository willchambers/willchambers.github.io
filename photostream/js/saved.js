// Data kept on the phone, so the feed opens instantly and still works with
// no signal. It lives in Cache Storage under URLs inside the app's scope
// (/photostream/__data/…) that are never fetched from the network.

const DATA_CACHE = 'photostream-data-v1';
const keyFor = (name) => new URL(`../__data/${name}`, import.meta.url).href;
const open = () => ('caches' in self ? caches.open(DATA_CACHE) : Promise.reject(new Error('no caches')));

export async function saveJSON(name, value) {
  try {
    const cache = await open();
    await cache.put(keyFor(name), new Response(JSON.stringify(value), {
      headers: { 'Content-Type': 'application/json' },
    }));
  } catch { /* storage full or unavailable: the app still works online */ }
}

export async function loadJSON(name) {
  try {
    const res = await (await open()).match(keyFor(name));
    return res ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function forgetJSON(name) {
  try { await (await open()).delete(keyFor(name)); } catch { /* nothing saved */ }
}
