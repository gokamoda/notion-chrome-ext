/* "Back to top" button at the bottom right of the page, shown once the page is scrolled down.
 * It lives in the pane's shadow root (nothing is added to Notion's DOM) and scrolls the page's
 * own scroller. Notion's AI button sits 24px from the right and bottom edges, 40px wide
 * (observed 2026-11-14); this button is centred above it, or takes its place (centred on it)
 * while the AI button is not shown. With the pane open it moves left of the pane.
 */
(() => {
  'use strict';
  const { el } = NotionLinksUI;
  // Shown after scrolling this far (px).
  const THRESHOLD = 400;

  function create(shadow, { getScroller, getOffset }) {
    const button = el('button', '', shadow);
    button.id = 'jump-top';
    button.hidden = true;
    button.title = 'ページの先頭へ';
    button.setAttribute('aria-label', 'ページの先頭へ');
    const ns = 'http://www.w3.org/2000/svg',
      svg = document.createElementNS(ns, 'svg');
    for (const [k, v] of Object.entries({
      viewBox: '0 0 24 24',
      width: '18',
      height: '18',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    }))
      svg.setAttribute(k, v);
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M12 19V5M5 12l7-7 7 7');
    svg.append(path);
    button.append(svg);
    let enabled = false,
      frame = 0;

    function update() {
      const scroller = getScroller();
      button.hidden = !enabled || !scroller || scroller.scrollTop < THRESHOLD;
      button.style.setProperty('--jump-offset', `${getOffset()}px`);
      if (!button.hidden) {
        const ai = document.querySelector('.notion-ai-button');
        button.classList.toggle('low', !ai?.getClientRects().length);
      }
    }

    /* Notion renders the blocks above the view only as they come into view and adjusts the
     * scroll position while doing so, which cuts the browser's smooth scroll short (observed
     * 2026-11-14: it stopped three times, the last at 1494px). So the scroll is animated here:
     * each frame moves to 80% of the current position, read again every frame, until the top.
     * After 2 seconds it jumps to the top. A wheel, touch or key input from the user ends it. */
    let animation = 0;
    function stop() {
      cancelAnimationFrame(animation);
      animation = 0;
    }
    for (const type of ['wheel', 'touchstart', 'keydown'])
      document.addEventListener(type, () => animation && stop(), { capture: true, passive: true });
    button.addEventListener('click', () => {
      const scroller = getScroller();
      if (!scroller) return;
      stop();
      const start = performance.now();
      const step = (now) => {
        const top = scroller.scrollTop;
        scroller.scrollTop = top < 2 || now - start > 2000 ? 0 : Math.floor(top * 0.8);
        animation = scroller.scrollTop > 0 ? requestAnimationFrame(step) : 0;
      };
      animation = requestAnimationFrame(step);
    });
    // Scroll events do not bubble; capture them from the page's scroller.
    document.addEventListener(
      'scroll',
      () => {
        if (!enabled || frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          update();
        });
      },
      { capture: true, passive: true },
    );

    return {
      button,
      apply(on) {
        enabled = !!on;
        update();
      },
    };
  }

  globalThis.NotionLinksJumpTop = Object.freeze({ create });
})();
