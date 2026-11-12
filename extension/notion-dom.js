/* Notion-specific DOM assumptions (body, headings, toolbar). No internal API calls.
 * Observed on app.notion.com, Japanese UI, 2026-11-12; see README.
 */
(() => {
  'use strict';
  const { pageLink, dedupe } = globalThis.NotionLinksCore;
  const BODY = '.notion-page-content';
  const EXCLUDED =
    '.notion-collection_view-block, .notion-collection_view_page-block, nav, aside, [role="navigation"]';

  function context(doc, url) {
    const page = pageLink(url, url);
    const roots = [...doc.querySelectorAll(BODY)].filter(
      (n) => n.isConnected && n.getClientRects().length,
    );
    if (!page)
      return { error: 'NotionページIDを識別できません。通常のページURLで開いてください。' };
    if (roots.length !== 1)
      return {
        error: roots.length
          ? '複数ページ表示は未対応です。サイドピークを閉じてください。'
          : '本文を未検出。読み込み・ログイン・DOM変更を確認してください。',
      };
    const root = roots[0];
    const frame = root.closest('.notion-frame');
    // Prevent reading the previous page during an SPA navigation transition.
    const titles = [...(frame || doc).querySelectorAll('.notion-page-block[data-block-id]')].filter(
      (n) => !n.closest(BODY) && n.querySelector('[contenteditable]'),
    );
    const matching = titles.find(
      (n) => n.getAttribute('data-block-id').replaceAll('-', '').toLowerCase() === page.id,
    );
    if (!matching)
      return { error: 'ページの描画待ち、または未対応のDOMです。更新で再試行してください。' };
    return {
      page,
      root,
      frame,
      title: matching.textContent.trim() || '無題',
      scroller: root.closest('.notion-scroller.vertical'),
    };
  }

  function links(container, base) {
    const items = [];
    for (const anchor of container.querySelectorAll('a[href]')) {
      if (anchor.closest(EXCLUDED)) continue;
      const link = pageLink(anchor.getAttribute('href'), base);
      if (!link) continue;
      const title = (anchor.textContent || '').trim().replace(/\s+/g, ' ');
      items.push({
        ...link,
        title: title || `ページ ${link.id.slice(0, 8)}（名前を取得できません）`,
      });
    }
    return dedupe(items);
  }

  function forward(ctx, base) {
    // Only links in body blocks. Page properties, header, breadcrumbs and sidebar are outside BODY.
    return links(ctx.root, base);
  }

  function toolbar(doc) {
    return doc.querySelector('.notion-topbar-action-buttons');
  }

  /* Where the pane toggle goes: just before the Share button, i.e. right of "edited ..." time.
   * Observed 2026-11-12: .notion-topbar-action-buttons > div > (time, div{display:contents} > [role=button][aria-label=共有], ...). */

  function shareAnchor(bar) {
    let node = bar.querySelector(
      '[role="button"][aria-label="共有"],[role="button"][aria-label="Share"]',
    );
    while (
      node &&
      node.parentElement &&
      node.parentElement !== bar &&
      node.parentElement.parentElement !== bar
    )
      node = node.parentElement;
    return node && node.parentElement ? node : null;
  }

  function headingLevel(block) {
    if (block.classList.contains('notion-header_4-block')) return 4;
    if (block.classList.contains('notion-sub_sub_header-block')) return 3;
    if (block.classList.contains('notion-sub_header-block')) return 2;
    if (block.classList.contains('notion-header-block')) return 1;
    return 0;
  }

  // Inline equations render as KaTeX (visible glyphs + MathML). Use the LaTeX source from
  // the TeX annotation instead, matching the page-structure titles.

  function plainText(node) {
    if (!node.querySelector('.notion-text-equation-token')) return node.textContent;
    const copy = node.cloneNode(true);
    for (const token of copy.querySelectorAll('.notion-text-equation-token')) {
      token.replaceWith(
        token.querySelector('annotation[encoding="application/x-tex"]')?.textContent ??
          token.querySelector('.katex-html')?.textContent ??
          '',
      );
    }
    return copy.textContent;
  }

  function headings(ctx) {
    return [...ctx.root.querySelectorAll('[data-block-id]')].flatMap((block) => {
      const level = headingLevel(block);
      if (!level || block.closest(EXCLUDED)) return [];
      // Toggle headings start with a contenteditable="false" toggle button; use the text element.
      const editable =
        block.querySelector(
          '[data-content-editable-leaf="true"],:is(h2,h3,h4,h5)[contenteditable="true"]',
        ) || block.querySelector('[contenteditable="true"]');
      return [
        {
          id: block.getAttribute('data-block-id'),
          level,
          title:
            plainText(editable || block)
              .trim()
              .replace(/\s+/g, ' ') || '無題の見出し',
          top:
            (ctx.scroller?.scrollTop || 0) +
            block.getBoundingClientRect().top -
            (ctx.scroller?.getBoundingClientRect().top || 0),
        },
      ];
    });
  }

  globalThis.NotionLinksDOM = Object.freeze({
    context,
    forward,
    toolbar,
    shareAnchor,
    headingLevel,
    headings,
  });
})();
