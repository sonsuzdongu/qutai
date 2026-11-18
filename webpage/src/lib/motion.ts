/**
 * Scroll-linked depth and reveals. Transform and opacity only, passive listeners, one requestAnimationFrame
 * per scrolled frame. Nothing runs when the visitor prefers reduced motion, and without JavaScript the page
 * is complete (reveals are either CSS scroll-driven animations, which leave content visible, or skipped).
 */
export function startMotion() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) return;

  // Depth: each [data-depth] layer moves by that factor of how far its own block (the parent) is from the middle of
  // the viewport, so the shift stays small (about ±depth × half a screen) however long the section is. Measured
  // against the whole section, a layer far down a long section drifted onto the text next to it. Off where the
  // columns stack (narrow screens): there a layer sits right above or below text and any shift can cover it.
  const stacked = window.matchMedia('(max-width: 900px)');
  const layers = Array.from(document.querySelectorAll<HTMLElement>('[data-depth]')).map((el) => ({
    el,
    depth: Number(el.dataset.depth) || 0,
    block: el.parentElement ?? document.body,
  }));
  let queued = false;
  const update = () => {
    queued = false;
    const vh = window.innerHeight;
    for (const { el, depth, block } of layers) {
      if (stacked.matches) {
        el.style.transform = '';
        continue;
      }
      const r = block.getBoundingClientRect();
      if (r.bottom < -vh || r.top > 2 * vh) continue; // far off screen
      const fromMiddle = r.top + r.height / 2 - vh / 2;
      el.style.transform = `translate3d(0, ${(-fromMiddle * depth).toFixed(1)}px, 0)`;
    }
  };
  const onScroll = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(update);
    }
  };
  if (layers.length) {
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
  }

  // Reveals: browsers with scroll-driven animations do it in CSS. Elsewhere, only elements still below the
  // viewport are hidden, so nothing visible ever blinks out.
  if (!CSS.supports('animation-timeline: view()') && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.remove('pending');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    for (const el of document.querySelectorAll<HTMLElement>('.reveal')) {
      if (el.getBoundingClientRect().top > window.innerHeight) {
        el.classList.add('pending');
        io.observe(el);
      }
    }
  }

  // If the preference changes while the page is open, put everything back in place.
  reduce.addEventListener('change', () => {
    if (!reduce.matches) return;
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    for (const { el } of layers) el.style.transform = '';
    for (const el of document.querySelectorAll('.reveal.pending')) el.classList.remove('pending');
  });
}
