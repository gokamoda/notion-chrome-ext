// Jump to virtualized headings and track the active heading while scrolling.
(() => {
  'use strict';

  function create({ getState, outline }) {
    const dom = NotionLinksDOM,
      wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function same(task) {
      const { epoch, currentID, pane } = getState();

      return (
        !task.cancelled &&
        task.epoch === epoch &&
        task.page === currentID &&
        task.path === `${location.pathname}${location.search}` &&
        !pane.hidden
      );
    }

    async function jump(item) {
      const { ctx, epoch, currentID, pageData } = getState();

      if (!ctx) return;
      const task = {
        epoch,
        page: currentID,
        path: `${location.pathname}${location.search}`,
        cancelled: false,
      };
      const root = ctx.root,
        scroller = ctx.scroller;
      const find = () =>
        [...root.querySelectorAll('[data-block-id]')].find(
          (n) => n.getAttribute('data-block-id') === item.id,
        );
      const target = pageData?.topIndex.get(NotionLinksPageData.normalize(item.id));
      let block = find(),
        low = 0,
        high = scroller ? Math.max(0, scroller.scrollHeight - scroller.clientHeight) : 0;
      for (let attempt = 0; !block && attempt < 14 && same(task) && scroller; attempt++) {
        const visible = [...root.querySelectorAll('[data-block-id]')]
          .map((n) =>
            pageData?.topIndex.get(NotionLinksPageData.normalize(n.getAttribute('data-block-id'))),
          )
          .filter(Number.isFinite);
        if (target !== undefined && visible.length) {
          const first = Math.min(...visible),
            last = Math.max(...visible);
          if (target < first) high = Math.min(high, scroller.scrollTop);
          else if (target > last) low = Math.max(low, scroller.scrollTop);
          else break; // A closed toggle must not be opened without a user action.
        }
        const next =
          target === undefined && Number.isFinite(item.top)
            ? Math.max(0, item.top - 24)
            : (low + high) / 2;
        if (attempt && Math.abs(next - scroller.scrollTop) < 2) break;
        scroller.scrollTop = next;
        await wait(180);
        block = find();
      }
      if (block && same(task)) block.scrollIntoView({ block: 'start', behavior: 'smooth' });
      else
        outline.status.textContent =
          '見出しを表示できません。閉じたトグル内の場合は本文で開いてください。';
    }

    function highlight() {
      const { ctx } = getState();

      if (!ctx) return;
      let active = '';
      for (const heading of dom.headings(ctx))
        if (heading.top <= (ctx.scroller?.scrollTop || 0) + 100) active = heading.id;
      for (const a of outline.list.querySelectorAll('a')) {
        const selected = a.dataset.blockId === active;
        a.toggleAttribute('data-active', selected);
        if (selected) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      }
    }

    let highlightTimer = null;

    document.addEventListener(
      'scroll',
      () => {
        if (!highlightTimer)
          highlightTimer = setTimeout(() => {
            highlightTimer = null;
            if (!getState().pane.hidden) highlight();
          }, 100);
      },
      true,
    );

    return { jump, highlight };
  }

  globalThis.NotionLinksOutline = Object.freeze({ create });
})();
