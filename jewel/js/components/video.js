/* Video — plays muted while in view, pauses out of view, never autoplays
   under prefers-reduced-motion, and remembers if the viewer paused it.
   Markup: see css/components/video.css. */

(() => {
  const reducedMotion = Jewel.reducedMotion;

  const inView = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      const video = target.querySelector('video');
      if (isIntersecting && !reducedMotion.matches && target.dataset.userPaused !== 'true') {
        video.play().catch(() => { /* autoplay blocked; the button still works */ });
      } else if (!isIntersecting) {
        video.pause();
      }
    });
  }, { threshold: 0.4 });

  const all = [];

  // Pause everything if the viewer turns on reduced motion mid-session.
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) all.forEach((v) => v.pause());
  });

  Jewel.register('video', (wrap) => {
    const video = wrap.querySelector('video');
    if (!video) return;
    all.push(video);

    video.muted = true;
    video.playsInline = true;
    video.removeAttribute('autoplay');

    const btn = wrap.querySelector('[data-video-toggle]');
    const sync = () => {
      wrap.dataset.state = video.paused ? 'paused' : 'playing';
      btn?.setAttribute('aria-label', video.paused ? 'Play video' : 'Pause video');
    };
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    sync();

    btn?.addEventListener('click', () => {
      wrap.dataset.userPaused = String(!video.paused);
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    });

    inView.observe(wrap);
  });
})();
