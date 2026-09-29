/* Carousel — keeps the "1 / 3" count in step with the swipe position.
   Markup: see css/components/carousel.css. With one slide the count hides. */

Jewel.register('carousel', (el) => {
  const track = el.querySelector('.carousel__track');
  const count = el.querySelector('.carousel__count');
  if (!track || !count) return;

  const total = track.children.length;
  count.hidden = total < 2;
  if (total < 2) return;

  const update = () => {
    const index = Math.round(track.scrollLeft / track.clientWidth);
    count.textContent = `${Math.min(index, total - 1) + 1} / ${total}`;
  };
  track.addEventListener('scroll', update, { passive: true });
  update();
});
