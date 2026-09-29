// Registers the service worker (sw.js), which keeps the app working offline.
// When a new release takes over, onUpdate() is called so the page can offer
// a reload (or reload itself while nobody is looking).

export function registerServiceWorker({ onUpdate }) {
  if (!('serviceWorker' in navigator)) return;
  const hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker
    .register(new URL('../sw.js', import.meta.url), { scope: './' })
    .catch(() => { /* no offline support in this browser; the app still works */ });

  // The first install also takes control; only a replacement is an update.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) onUpdate();
  });
}
