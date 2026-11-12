// Merge page-structure data with mounted edits, retaining blocks virtualized out of the DOM.
(() => {
  'use strict';

  function create() {
    const CAP = 2000,
      dom = NotionLinksDOM,
      { pageLink } = NotionLinksCore;
    let blocks = new Map(),
      heads = new Map(),
      forwardItems = [],
      capped = false;

    function collect(ctx, url) {
      if (!ctx) return;
      const mounted = [...ctx.root.querySelectorAll('[data-block-id]')],
        mountedHeads = new Map(
          dom.headings(ctx).map((h) => [NotionLinksPageData.normalize(h.id), h]),
        );
      // A block can be rendered as several elements with the same data-block-id: list items
      // contain an empty, zero-height element with the item's id (observed 2026-11-13). Links
      // found under any of them are merged, so a later empty one cannot erase the item's links.
      const seen = new Set();
      for (const block of mounted) {
        const id = NotionLinksPageData.normalize(block.getAttribute('data-block-id'));
        if (!blocks.has(id) && blocks.size >= CAP) {
          capped = true;
          continue;
        }
        const links = dom
          .forward({ root: block }, url)
          .filter((item) =>
            [...block.querySelectorAll('a[href]')].some(
              (a) =>
                pageLink(a.href, url)?.id === item.id && a.closest('[data-block-id]') === block,
            ),
          );
        const merged = seen.has(id) ? NotionLinksCore.dedupe([...blocks.get(id), ...links]) : links;
        seen.add(id);
        blocks.set(id, merged.slice(0, CAP));
        if (mountedHeads.has(id)) heads.set(id, { ...heads.get(id), ...mountedHeads.get(id) });
        else heads.delete(id);
      }
      const all = new Map();
      const groups = mounted.length ? blocks.values() : [dom.forward(ctx, url)];
      for (const links of groups)
        for (const item of links) {
          if (all.size < CAP) all.set(item.id, item);
          else capped = true;
        }
      forwardItems = [...all.values()];
    }

    function reset() {
      blocks.clear();
      heads.clear();
      forwardItems = [];
      capped = false;
    }

    function seed(data) {
      blocks = new Map(data.blockLinks);
      heads = new Map(data.headings.map((h) => [NotionLinksPageData.normalize(h.id), h]));
    }

    return {
      collect,
      reset,
      seed,
      get forwardItems() {
        return forwardItems;
      },
      get capped() {
        return capped;
      },
      get headings() {
        return [...heads.values()].sort((a, b) =>
          a.order !== undefined && b.order !== undefined
            ? a.order - b.order
            : (a.top || 0) - (b.top || 0),
        );
      },
    };
  }

  globalThis.NotionLinksSnapshot = Object.freeze({ create });
})();
